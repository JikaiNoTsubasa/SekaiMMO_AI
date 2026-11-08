// Progression Service - Système d'XP par action et ranks
// Gère la progression des armes et éléments magiques

import type { MagicElement, Rank, WeaponCode } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

// Prix en XP de chaque rank, à payer auprès du maître (le rank E est acquis d'office)
const RANK_COSTS: Record<Rank, number> = {
  E: 0,       // Débutant
  D: 500,     // Apprenti
  C: 2000,    // Confirmé
  B: 5000,    // Expert
  A: 15000,   // Maître
};

// Ordre des ranks pour comparaison
const RANK_ORDER: Rank[] = ['E', 'D', 'C', 'B', 'A'];

// Libellés des compteurs d'XP affichés aux joueurs
export const WEAPON_XP_LABELS: Record<WeaponCode, string> = {
  SWORD: 'Épée',
  DUAL_DAGGERS: 'Dagues',
  BOW: 'Arc',
  TWO_HANDED_AXE: 'Hache',
  WAND: 'Baguette',
  SCEPTER: 'Sceptre',
};

export const ELEMENT_XP_LABELS: Record<MagicElement, string> = {
  NONE: 'Neutre',
  FIRE: 'Feu',
  WATER: 'Eau',
  EARTH: 'Terre',
  AIR: 'Air',
  LIGHTNING: 'Foudre',
  ICE: 'Glace',
  DARKNESS: 'Ténèbres',
  LIGHT: 'Lumière',
};

export interface ExperienceGain {
  weaponXp?: { weaponCode: WeaponCode; amount: number };
  elementXp?: { element: MagicElement; amount: number };
  gold?: number;
}

export interface ProgressionResult {
  weaponProgress?: {
    weaponCode: WeaponCode;
    previousXp: number;
    newXp: number;
    currentRank: Rank;
  };
  elementProgress?: {
    element: MagicElement;
    previousXp: number;
    newXp: number;
    currentRank: Rank;
  };
  goldGained?: number;
}

export interface RankPurchaseResult {
  rank: Rank;
  xpSpent: number;
}

export const progressionService = {
  /**
   * Vérifie si un rank est supérieur ou égal à un autre
   */
  isRankSufficient(current: Rank, required: Rank): boolean {
    return RANK_ORDER.indexOf(current) >= RANK_ORDER.indexOf(required);
  },

  /**
   * Obtient le rank suivant (null si déjà au rank max)
   */
  getNextRank(currentRank: Rank): Rank | null {
    return RANK_ORDER[RANK_ORDER.indexOf(currentRank) + 1] ?? null;
  },

  /**
   * Obtient le prix en XP du prochain rank
   */
  getXpForNextRank(currentRank: Rank): number | null {
    const nextRank = this.getNextRank(currentRank);
    return nextRank ? RANK_COSTS[nextRank] : null;
  },

  /**
   * Achète le rank suivant d'une arme avec le solde d'XP de cette arme
   */
  async purchaseWeaponRank(characterId: number, weaponCode: WeaponCode): Promise<RankPurchaseResult> {
    const weaponType = await prisma.weaponType.findUnique({
      where: { code: weaponCode },
    });

    if (!weaponType) {
      throw new HttpError('Weapon type not found', 404);
    }

    const progress = await prisma.characterWeaponProgress.findUnique({
      where: {
        characterId_weaponTypeId: {
          characterId,
          weaponTypeId: weaponType.id,
        },
      },
    });

    const currentRank = progress?.currentRank ?? 'E';
    const { rank, xpSpent } = this.getRankPurchase(currentRank);

    // Le solde et le rank sont vérifiés dans la même requête : pas de double achat possible
    const { count } = await prisma.characterWeaponProgress.updateMany({
      where: {
        characterId,
        weaponTypeId: weaponType.id,
        currentRank,
        experience: { gte: xpSpent },
      },
      data: {
        currentRank: rank,
        experience: { decrement: xpSpent },
      },
    });

    if (count === 0) {
      throw new HttpError(`XP insuffisante : ${xpSpent} XP requis`, 400);
    }

    return { rank, xpSpent };
  },

  /**
   * Achète le rank suivant d'un élément avec le solde d'XP de cet élément
   */
  async purchaseElementRank(characterId: number, element: MagicElement): Promise<RankPurchaseResult> {
    const progress = await prisma.characterElementProgress.findUnique({
      where: {
        characterId_element: {
          characterId,
          element,
        },
      },
    });

    const currentRank = progress?.currentRank ?? 'E';
    const { rank, xpSpent } = this.getRankPurchase(currentRank);

    // Le solde et le rank sont vérifiés dans la même requête : pas de double achat possible
    const { count } = await prisma.characterElementProgress.updateMany({
      where: {
        characterId,
        element,
        currentRank,
        experience: { gte: xpSpent },
      },
      data: {
        currentRank: rank,
        experience: { decrement: xpSpent },
      },
    });

    if (count === 0) {
      throw new HttpError(`XP insuffisante : ${xpSpent} XP requis`, 400);
    }

    return { rank, xpSpent };
  },

  /**
   * Détermine le rank à acheter et son prix
   */
  getRankPurchase(currentRank: Rank): RankPurchaseResult {
    const rank = this.getNextRank(currentRank);

    if (!rank) {
      throw new HttpError('Rang maximum atteint', 400);
    }

    return { rank, xpSpent: RANK_COSTS[rank] };
  },

  /**
   * Accorde de l'XP d'arme à un personnage
   */
  async grantWeaponExperience(
    characterId: number,
    weaponCode: WeaponCode,
    amount: number
  ): Promise<{ previousXp: number; newXp: number; currentRank: Rank }> {
    const weaponType = await prisma.weaponType.findUnique({
      where: { code: weaponCode },
    });

    if (!weaponType) {
      throw new HttpError('Weapon type not found', 404);
    }

    // Créer ou incrémenter la progression (upsert : plusieurs coups peuvent arriver en même temps)
    const progress = await prisma.characterWeaponProgress.upsert({
      where: {
        characterId_weaponTypeId: {
          characterId,
          weaponTypeId: weaponType.id,
        },
      },
      create: {
        characterId,
        weaponTypeId: weaponType.id,
        experience: amount,
        currentRank: 'E',
      },
      update: {
        experience: { increment: amount },
      },
    });

    return {
      previousXp: progress.experience - amount,
      newXp: progress.experience,
      currentRank: progress.currentRank,
    };
  },

  /**
   * Accorde de l'XP d'élément magique à un personnage
   */
  async grantElementExperience(
    characterId: number,
    element: MagicElement,
    amount: number
  ): Promise<{ previousXp: number; newXp: number; currentRank: Rank }> {
    if (element === 'NONE') {
      throw new HttpError('Cannot grant XP for NONE element', 400);
    }

    // Créer ou incrémenter la progression (upsert : plusieurs coups peuvent arriver en même temps)
    const progress = await prisma.characterElementProgress.upsert({
      where: {
        characterId_element: {
          characterId,
          element,
        },
      },
      create: {
        characterId,
        element,
        experience: amount,
        currentRank: 'E',
      },
      update: {
        experience: { increment: amount },
      },
    });

    return {
      previousXp: progress.experience - amount,
      newXp: progress.experience,
      currentRank: progress.currentRank,
    };
  },

  /**
   * Accorde de l'or à un personnage
   */
  async grantGold(characterId: number, amount: number): Promise<{ previousGold: number; newGold: number }> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { gold: true },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    const previousGold = character.gold;

    await prisma.character.update({
      where: { id: characterId },
      data: { gold: { increment: amount } },
    });

    return {
      previousGold,
      newGold: previousGold + amount,
    };
  },

  /**
   * Dépense de l'or
   */
  async spendGold(characterId: number, amount: number): Promise<{ success: boolean; newGold: number }> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { gold: true },
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    if (character.gold < amount) {
      return { success: false, newGold: character.gold };
    }

    await prisma.character.update({
      where: { id: characterId },
      data: { gold: { decrement: amount } },
    });

    return {
      success: true,
      newGold: character.gold - amount,
    };
  },

  /**
   * Traite le gain d'XP après une action de combat
   * Retourne les résultats de progression
   */
  async processActionExperience(
    characterId: number,
    gains: ExperienceGain
  ): Promise<ProgressionResult> {
    const result: ProgressionResult = {};

    // XP d'arme
    if (gains.weaponXp && gains.weaponXp.amount > 0) {
      const weaponResult = await this.grantWeaponExperience(
        characterId,
        gains.weaponXp.weaponCode,
        gains.weaponXp.amount
      );
      result.weaponProgress = {
        ...weaponResult,
        weaponCode: gains.weaponXp.weaponCode,
      };
    }

    // XP d'élément
    if (gains.elementXp && gains.elementXp.amount > 0 && gains.elementXp.element !== 'NONE') {
      const elementResult = await this.grantElementExperience(
        characterId,
        gains.elementXp.element,
        gains.elementXp.amount
      );
      result.elementProgress = {
        ...elementResult,
        element: gains.elementXp.element,
      };
    }

    // Or
    if (gains.gold && gains.gold > 0) {
      const goldResult = await this.grantGold(characterId, gains.gold);
      result.goldGained = gains.gold;
    }

    return result;
  },

  /**
   * Récupère la progression d'arme d'un personnage
   */
  async getWeaponProgress(characterId: number, weaponCode: WeaponCode) {
    const weaponType = await prisma.weaponType.findUnique({
      where: { code: weaponCode },
    });

    if (!weaponType) {
      throw new HttpError('Weapon type not found', 404);
    }

    const progress = await prisma.characterWeaponProgress.findUnique({
      where: {
        characterId_weaponTypeId: {
          characterId,
          weaponTypeId: weaponType.id,
        },
      },
    });

    if (!progress) {
      return {
        experience: 0,
        currentRank: 'E' as Rank,
        nextRankXp: RANK_COSTS.D,
      };
    }

    return {
      experience: progress.experience,
      currentRank: progress.currentRank,
      nextRankXp: this.getXpForNextRank(progress.currentRank),
    };
  },

  /**
   * Récupère la progression d'élément d'un personnage
   */
  async getElementProgress(characterId: number, element: MagicElement) {
    if (element === 'NONE') {
      return null;
    }

    const progress = await prisma.characterElementProgress.findUnique({
      where: {
        characterId_element: {
          characterId,
          element,
        },
      },
    });

    if (!progress) {
      return {
        experience: 0,
        currentRank: 'E' as Rank,
        nextRankXp: RANK_COSTS.D,
      };
    }

    return {
      experience: progress.experience,
      currentRank: progress.currentRank,
      nextRankXp: this.getXpForNextRank(progress.currentRank),
    };
  },

  /**
   * Récupère toutes les progressions d'un personnage
   */
  async getAllProgress(characterId: number) {
    const [weaponProgress, elementProgress] = await Promise.all([
      prisma.characterWeaponProgress.findMany({
        where: { characterId },
        include: { weaponType: true },
      }),
      prisma.characterElementProgress.findMany({
        where: { characterId },
      }),
    ]);

    return {
      weapons: weaponProgress.map((p) => ({
        weaponCode: p.weaponType.code,
        weaponName: p.weaponType.name,
        experience: p.experience,
        currentRank: p.currentRank,
        nextRankXp: this.getXpForNextRank(p.currentRank),
      })),
      elements: elementProgress.map((p) => ({
        element: p.element,
        experience: p.experience,
        currentRank: p.currentRank,
        nextRankXp: this.getXpForNextRank(p.currentRank),
      })),
    };
  },
};
