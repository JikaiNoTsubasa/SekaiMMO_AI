// Combat Service - Gestion des calculs de combat
// Dégâts physiques/magiques, critiques, pénétration

import type { AttackSpeed, DamageType, MagicElement, WeaponCode } from '../generated/prisma';
import { prisma } from '../config/prisma';

// Types pour les stats de combat
export interface CombatStats {
  physicalAttack: number;
  magicalAttack: number;
  physicalDefense: number;
  magicalDefense: number;
  physicalPenetration: number;
  magicalPenetration: number;
  critChance: number;
  critDamage: number;
}

export interface DamageResult {
  rawDamage: number;
  finalDamage: number;
  isCritical: boolean;
  damageType: DamageType;
  element: MagicElement;
  blocked: number; // Dégâts bloqués par la défense
}

// Dégâts d'un skill (style LoL) : base + % de l'attaque + % de la magie
export interface SkillDamageParams {
  baseDamage: number;
  attackScaling: number; // Ratio de physicalAttack (0.6 = 60%)
  magicScaling: number; // Ratio de magicalAttack (0.6 = 60%)
  damageType: DamageType;
  element: MagicElement;
}

// Profil d'attaque automatique (style MOBA) : arme équipée + stats du perso + passif de maîtrise
export interface AutoAttackProfile {
  weaponItemId: number | null;
  weaponName: string | null;
  weaponCode: WeaponCode | null;
  damageType: DamageType;
  range: number;
  attacksPerSecond: number;
  // Bonus de stats apportés par l'arme équipée (Item.stats)
  weaponStats: Partial<CombatStats>;
  // Passifs de maîtrise d'arme débloqués
  masteryNames: string[];
  masteryFlatDamage: number;
  masteryAttackScaling: number;
  masteryMagicScaling: number;
}

// Constantes de combat
const CRIT_DAMAGE_MULTIPLIER = 1.5; // 150% de dégâts critiques
const MIN_DAMAGE = 1; // Dégâts minimum
const DEFENSE_SCALING = 0.05; // Facteur de réduction de la défense

// Auto-attaques
export const UNARMED_ATTACK_RANGE = 70;
const MELEE_ATTACK_RANGE = 80;
const WEAPON_ATTACK_RANGE: Partial<Record<WeaponCode, number>> = {
  BOW: 350,
  WAND: 300,
  SCEPTER: 300,
};
const ATTACK_SPEED_MODIFIERS: Record<AttackSpeed, number> = {
  SLOW: 0.75,
  NORMAL: 1.0,
  FAST: 1.35,
};
const COMBAT_STAT_KEYS: (keyof CombatStats)[] = [
  'physicalAttack',
  'magicalAttack',
  'physicalDefense',
  'magicalDefense',
  'physicalPenetration',
  'magicalPenetration',
  'critChance',
  'critDamage',
];

/**
 * Extrait les bonus de combat du JSON de stats d'un item (stocké en objet ou en string)
 */
export function parseItemCombatStats(raw: unknown): Partial<CombatStats> {
  let stats = raw;
  if (typeof stats === 'string') {
    try {
      stats = JSON.parse(stats);
    } catch {
      return {};
    }
  }
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return {};
  }

  const result: Partial<CombatStats> = {};
  for (const key of COMBAT_STAT_KEYS) {
    const value = (stats as Record<string, unknown>)[key];
    if (typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

export const combatService = {
  /**
   * Calcule les dégâts d'une attaque basique (auto-attack)
   */
  calculateBasicAttackDamage(
    attackerStats: CombatStats,
    defenderStats: CombatStats,
    damageType: DamageType
  ): DamageResult {
    const isPhysical = damageType === 'PHYSICAL';

    // Sélectionner les stats appropriées
    const attackPower = isPhysical ? attackerStats.physicalAttack : attackerStats.magicalAttack;
    const defenderDefense = isPhysical ? defenderStats.physicalDefense : defenderStats.magicalDefense;
    const penetration = isPhysical ? attackerStats.physicalPenetration : attackerStats.magicalPenetration;

    // Appliquer la pénétration (réduit la défense effective)
    const effectiveDefense = Math.max(0, defenderDefense - penetration);

    // Calcul de la réduction de dégâts par la défense
    // Formule: reduction = defense / (defense + 100)
    const damageReduction = effectiveDefense / (effectiveDefense + 100);

    // Dégâts bruts
    const rawDamage = attackPower;

    // Vérifier le critique
    const isCritical = Math.random() < attackerStats.critChance;
    const critMultiplier = isCritical ? attackerStats.critDamage : 1;

    // Dégâts après critique
    const damageAfterCrit = rawDamage * critMultiplier;

    // Dégâts bloqués
    const blocked = Math.floor(damageAfterCrit * damageReduction);

    // Dégâts finaux
    const finalDamage = Math.max(MIN_DAMAGE, Math.floor(damageAfterCrit - blocked));

    return {
      rawDamage,
      finalDamage,
      isCritical,
      damageType,
      element: 'NONE',
      blocked,
    };
  },

  /**
   * Stats totales = stats du personnage + bonus de l'arme équipée
   */
  applyWeaponStats(attackerStats: CombatStats, weaponStats: Partial<CombatStats>): CombatStats {
    const total = { ...attackerStats };
    for (const key of COMBAT_STAT_KEYS) {
      total[key] += weaponStats[key] ?? 0;
    }
    return total;
  },

  /**
   * Calcule les dégâts d'une auto-attaque
   * Dégâts = attaque totale (perso + arme) + maîtrise (bonus plat + % attaque + % magie)
   * L'attaque utilisée dépend du type de dégâts de l'arme ; sans arme : attaque physique du perso
   */
  calculateAutoAttackDamage(
    attackerStats: CombatStats,
    defenderStats: CombatStats,
    profile: AutoAttackProfile
  ): DamageResult {
    const totalStats = this.applyWeaponStats(attackerStats, profile.weaponStats);
    const isPhysical = profile.damageType === 'PHYSICAL';
    const basePower = isPhysical ? totalStats.physicalAttack : totalStats.magicalAttack;
    const masteryBonus =
      profile.masteryFlatDamage +
      totalStats.physicalAttack * profile.masteryAttackScaling +
      totalStats.magicalAttack * profile.masteryMagicScaling;
    const attackPower = Math.floor(basePower + masteryBonus);

    return this.calculateBasicAttackDamage(
      { ...totalStats, physicalAttack: attackPower, magicalAttack: attackPower },
      defenderStats,
      profile.damageType
    );
  },

  /**
   * Construit le profil d'auto-attaque d'un personnage à partir de son arme équipée
   * et de ses passifs de maîtrise débloqués
   */
  async getAutoAttackProfile(characterId: number): Promise<AutoAttackProfile> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: {
        attackSpeed: true,
        equippedWeapon: { include: { weaponType: true } },
      },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const weapon = character.equippedWeapon;
    const weaponType = weapon?.weaponType ?? null;

    if (!weapon || !weaponType) {
      return {
        weaponItemId: null,
        weaponName: null,
        weaponCode: null,
        damageType: 'PHYSICAL',
        range: UNARMED_ATTACK_RANGE,
        attacksPerSecond: character.attackSpeed,
        weaponStats: {},
        masteryNames: [],
        masteryFlatDamage: 0,
        masteryAttackScaling: 0,
        masteryMagicScaling: 0,
      };
    }

    const masteries = await prisma.characterSkill.findMany({
      where: {
        characterId,
        isUnlocked: true,
        skill: { category: 'PASSIVE', weaponTypeId: weaponType.id },
      },
      include: { skill: true },
    });

    return {
      weaponItemId: weapon.id,
      weaponName: weapon.name,
      weaponCode: weaponType.code,
      damageType: weaponType.damageType,
      range: WEAPON_ATTACK_RANGE[weaponType.code] ?? (weaponType.isRanged ? 300 : MELEE_ATTACK_RANGE),
      attacksPerSecond: character.attackSpeed * ATTACK_SPEED_MODIFIERS[weaponType.attackSpeed],
      weaponStats: parseItemCombatStats(weapon.stats),
      masteryNames: masteries.map((m) => m.skill.name),
      // Un passif de maîtrise ajoute ses dégâts (base + ratios) à chaque auto-attaque
      masteryFlatDamage: masteries.reduce((sum, m) => sum + m.skill.baseDamage, 0),
      masteryAttackScaling: masteries.reduce((sum, m) => sum + m.skill.attackScaling, 0),
      masteryMagicScaling: masteries.reduce((sum, m) => sum + m.skill.magicScaling, 0),
    };
  },

  /**
   * Calcule les dégâts d'un skill
   */
  calculateSkillDamage(
    attackerStats: CombatStats,
    defenderStats: CombatStats,
    skillParams: SkillDamageParams
  ): DamageResult {
    const { baseDamage, attackScaling, magicScaling, damageType, element } = skillParams;
    const isPhysical = damageType === 'PHYSICAL';
    const isPure = damageType === 'PURE';

    // Les dégâts purs ignorent les défenses
    let effectiveDefense = 0;
    if (!isPure) {
      const defenderDefense = isPhysical ? defenderStats.physicalDefense : defenderStats.magicalDefense;
      const penetration = isPhysical ? attackerStats.physicalPenetration : attackerStats.magicalPenetration;
      effectiveDefense = Math.max(0, defenderDefense - penetration);
    }

    // Calcul de la réduction
    const damageReduction = isPure ? 0 : effectiveDefense / (effectiveDefense + 100);

    // Dégâts bruts = base + % attaque + % magie (le type de dégâts ne choisit que la défense appliquée)
    const rawDamage =
      baseDamage +
      Math.floor(attackerStats.physicalAttack * attackScaling + attackerStats.magicalAttack * magicScaling);

    // Vérifier le critique
    const isCritical = Math.random() < attackerStats.critChance;
    const critMultiplier = isCritical ? attackerStats.critDamage : 1;

    // Dégâts après critique
    const damageAfterCrit = rawDamage * critMultiplier;

    // Dégâts bloqués
    const blocked = Math.floor(damageAfterCrit * damageReduction);

    // Dégâts finaux
    const finalDamage = Math.max(MIN_DAMAGE, Math.floor(damageAfterCrit - blocked));

    return {
      rawDamage,
      finalDamage,
      isCritical,
      damageType,
      element,
      blocked,
    };
  },

  /**
   * Récupère les stats de combat d'un personnage
   */
  async getCharacterCombatStats(characterId: number): Promise<CombatStats> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: {
        physicalAttack: true,
        magicalAttack: true,
        physicalDefense: true,
        magicalDefense: true,
        physicalPenetration: true,
        magicalPenetration: true,
        critChance: true,
        critDamage: true,
      },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    return character;
  },

  /**
   * Récupère les stats de combat d'un monstre
   */
  async getMonsterCombatStats(monsterId: number): Promise<CombatStats> {
    const monster = await prisma.monster.findUnique({
      where: { id: monsterId },
      select: {
        physicalAttack: true,
        magicalAttack: true,
        physicalDefense: true,
        magicalDefense: true,
      },
    });

    if (!monster) {
      throw new Error('Monster not found');
    }

    // Les monstres n'ont pas de pénétration ni de crit de base
    return {
      ...monster,
      physicalPenetration: 0,
      magicalPenetration: 0,
      critChance: 0.05,
      critDamage: CRIT_DAMAGE_MULTIPLIER,
    };
  },

  /**
   * Applique des dégâts à un personnage
   */
  async applyDamageToCharacter(characterId: number, damage: number): Promise<{ isDead: boolean }> {
    // Décrément en une requête : plusieurs monstres peuvent frapper au même instant
    const { count } = await prisma.character.updateMany({
      where: { id: characterId, health: { gt: damage } },
      data: { health: { decrement: damage } },
    });

    if (count > 0) {
      return { isDead: false };
    }

    await prisma.character.updateMany({
      where: { id: characterId },
      data: { health: 0 },
    });

    return { isDead: true };
  },

  /**
   * Soigne un personnage
   */
  async healCharacter(characterId: number, amount: number): Promise<{ health: number; healed: number }> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { health: true, maxHealth: true },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const actualHeal = Math.min(amount, character.maxHealth - character.health);
    const newHealth = character.health + actualHeal;

    await prisma.character.update({
      where: { id: characterId },
      data: { health: newHealth },
    });

    return {
      health: newHealth,
      healed: actualHeal,
    };
  },

  /**
   * Consomme du mana
   */
  async consumeMana(characterId: number, amount: number): Promise<{ mana: number; success: boolean }> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { mana: true },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if (character.mana < amount) {
      return { mana: character.mana, success: false };
    }

    const newMana = character.mana - amount;

    await prisma.character.update({
      where: { id: characterId },
      data: { mana: newMana },
    });

    return { mana: newMana, success: true };
  },

  /**
   * Restaure du mana
   */
  async restoreMana(characterId: number, amount: number): Promise<{ mana: number; restored: number }> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { mana: true, maxMana: true },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    const actualRestore = Math.min(amount, character.maxMana - character.mana);
    const newMana = character.mana + actualRestore;

    await prisma.character.update({
      where: { id: characterId },
      data: { mana: newMana },
    });

    return {
      mana: newMana,
      restored: actualRestore,
    };
  },

  /**
   * Vérifie si un personnage peut utiliser un skill (mana suffisant)
   */
  async canUseSkill(characterId: number, skillId: number): Promise<{ canUse: boolean; reason?: string }> {
    const [character, skill] = await Promise.all([
      prisma.character.findUnique({
        where: { id: characterId },
        select: { mana: true },
      }),
      prisma.skill.findUnique({
        where: { id: skillId },
        select: { manaCost: true, name: true },
      }),
    ]);

    if (!character) {
      return { canUse: false, reason: 'Character not found' };
    }

    if (!skill) {
      return { canUse: false, reason: 'Skill not found' };
    }

    if (character.mana < skill.manaCost) {
      return { canUse: false, reason: 'Not enough mana' };
    }

    return { canUse: true };
  },

  /**
   * Calcule les bonus d'élément (résistances/faiblesses futures)
   * Pour l'instant retourne 1.0 (neutre)
   */
  calculateElementalMultiplier(
    attackElement: MagicElement,
    defenderElement: MagicElement
  ): number {
    // TODO: Implémenter le système de résistances/faiblesses élémentaires
    // Par exemple: Feu > Glace, Eau > Feu, etc.

    // Pour l'instant, pas de bonus/malus élémentaire
    return 1.0;
  },

  /**
   * Calcule les dégâts d'un skill (version simplifiée pour le GameServer)
   * Retourne { damage, isCritical }
   */
  calculateDamage(
    attackerStats: CombatStats,
    defenderStats: CombatStats,
    skill: Omit<SkillDamageParams, 'element'>
  ): { damage: number; isCritical: boolean } {
    const result = this.calculateSkillDamage(attackerStats, defenderStats, {
      ...skill,
      element: 'NONE',
    });

    return {
      damage: result.finalDamage,
      isCritical: result.isCritical,
    };
  },
};
