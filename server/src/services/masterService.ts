// Master Service - Achats auprès des maîtres d'arme et d'élément
// Rangs et compétences se paient avec le solde d'XP de la discipline du maître

import type { NPC, Prisma, Rank } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';
import {
  ELEMENT_XP_LABELS,
  WEAPON_XP_LABELS,
  progressionService,
  type RankPurchaseResult,
} from './progressionService';
import { getSkillXpCost, skillService, type LearnSkillResult } from './skillService';

export interface MasterOffer {
  npcId: number;
  name: string;
  title: string | null;
  discipline: string;
  experience: number;
  rank: Rank;
  nextRank: Rank | null;
  nextRankCost: number | null;
  skills: {
    id: number;
    name: string;
    description: string | null;
    category: string;
    requiredRank: Rank;
    xpCost: number;
    baseDamage: number;
    attackScaling: number;
    magicScaling: number;
    manaCost: number;
    cooldown: number;
    range: number;
    isUnlocked: boolean;
    canLearn: boolean;
    missingRequirements: string[];
  }[];
}

/**
 * Compétences enseignées : l'élément du maître, ou les skills sans élément de son arme
 */
function getMasterSkillFilter(npc: NPC): Prisma.SkillWhereInput {
  if (npc.weaponMasterFor) {
    return { element: 'NONE', weaponType: { code: npc.weaponMasterFor } };
  }
  if (npc.elementMasterFor) {
    return { element: npc.elementMasterFor };
  }
  throw new HttpError("Ce personnage n'est pas un maître", 400);
}

export const masterService = {
  /**
   * Construit l'offre d'un maître pour un personnage
   */
  async getOffer(characterId: number, npc: NPC): Promise<MasterOffer> {
    const where = getMasterSkillFilter(npc);

    const [progress, skills] = await Promise.all([
      npc.weaponMasterFor
        ? progressionService.getWeaponProgress(characterId, npc.weaponMasterFor)
        : progressionService.getElementProgress(characterId, npc.elementMasterFor!),
      prisma.skill.findMany({
        where,
        include: { characterLinks: { where: { characterId } } },
        orderBy: [{ requiredRank: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const rank = progress?.currentRank ?? 'E';

    return {
      npcId: npc.id,
      name: npc.name,
      title: npc.title,
      discipline: npc.weaponMasterFor
        ? WEAPON_XP_LABELS[npc.weaponMasterFor]
        : ELEMENT_XP_LABELS[npc.elementMasterFor!],
      experience: progress?.experience ?? 0,
      rank,
      nextRank: progressionService.getNextRank(rank),
      nextRankCost: progressionService.getXpForNextRank(rank),
      skills: await Promise.all(
        skills.map(async (skill) => {
          const requirements = await skillService.checkSkillRequirements(characterId, skill.id);

          return {
            id: skill.id,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            requiredRank: skill.requiredRank,
            xpCost: getSkillXpCost(skill),
            baseDamage: skill.baseDamage,
            attackScaling: skill.attackScaling,
            magicScaling: skill.magicScaling,
            manaCost: skill.manaCost,
            cooldown: skill.cooldown,
            range: skill.range,
            isUnlocked: skill.characterLinks[0]?.isUnlocked ?? false,
            canLearn: requirements.canLearn,
            missingRequirements: requirements.missingRequirements,
          };
        })
      ),
    };
  },

  /**
   * Achète le rang suivant de la discipline du maître
   */
  async buyRank(characterId: number, npc: NPC): Promise<RankPurchaseResult> {
    if (npc.weaponMasterFor) {
      return progressionService.purchaseWeaponRank(characterId, npc.weaponMasterFor);
    }
    if (npc.elementMasterFor) {
      return progressionService.purchaseElementRank(characterId, npc.elementMasterFor);
    }
    throw new HttpError("Ce personnage n'est pas un maître", 400);
  },

  /**
   * Achète une compétence enseignée par le maître
   */
  async buySkill(characterId: number, npc: NPC, skillId: number): Promise<LearnSkillResult> {
    const taught = await prisma.skill.findFirst({
      where: { id: skillId, ...getMasterSkillFilter(npc) },
      select: { id: true },
    });

    if (!taught) {
      throw new HttpError("Ce maître n'enseigne pas cette compétence", 400);
    }

    const result = await skillService.learnSkill(characterId, skillId);

    if (!result.success) {
      throw new HttpError(result.message ?? 'Achat impossible', 400);
    }

    return result;
  },
};
