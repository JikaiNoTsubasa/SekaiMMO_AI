import type { Prisma } from '../generated/prisma';
import { WeaponCode } from '../generated/prisma';

import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const skillSlots = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'] as const;
const skillSlotSet = new Set(skillSlots);

type SkillSlot = (typeof skillSlots)[number];

const parseSkillBindings = (bindings: Prisma.JsonValue | null) => {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {} as Record<SkillSlot, number>;
  }

  return Object.entries(bindings).reduce<Record<SkillSlot, number>>((acc, [key, value]) => {
    if (skillSlotSet.has(key as SkillSlot) && typeof value === 'number') {
      acc[key as SkillSlot] = value;
    }

    return acc;
  }, {} as Record<SkillSlot, number>);
};

const serializeSkillBindings = (bindings: Record<SkillSlot, number>) => bindings as unknown as Prisma.JsonObject;

const includeCharacterRelations = {
  equippedWeaponType: true,
  weaponProgress: {
    include: {
      weaponType: true
    }
  },
  skills: {
    include: {
      skill: true
    }
  },
  inventory: {
    include: {
      item: true
    }
  }
} satisfies Prisma.CharacterInclude;

const assertCharacterExists = async (characterId: number) => {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: includeCharacterRelations
  });

  if (!character) {
    throw new HttpError('Character not found', 404);
  }

  return character;
};

export const characterService = {
  async createCharacter(userId: number, name: string) {
    const existingName = await prisma.character.findUnique({ where: { name } });
    if (existingName) {
      throw new HttpError('Character name already in use', 409);
    }

    const existing = await prisma.character.findUnique({ where: { userId } });
    if (existing) {
      throw new HttpError('Character already exists for this account', 400);
    }

    const weaponTypes = await prisma.weaponType.findMany();
    if (!weaponTypes.length) {
      throw new HttpError('Weapon types are not seeded', 500);
    }

    const defaultWeapon = weaponTypes.find((weapon) => weapon.code === WeaponCode.SWORD_SHIELD) ?? weaponTypes[0];

    const character = await prisma.$transaction(async (tx) => {
      const created = await tx.character.create({
        data: {
          userId,
          name,
          equippedWeaponTypeId: defaultWeapon.id,
          skillBindings: {}
        }
      });

      await tx.characterWeaponProgress.createMany({
        data: weaponTypes.map((weapon) => ({
          characterId: created.id,
          weaponTypeId: weapon.id
        }))
      });

      return created;
    });

    return assertCharacterExists(character.id);
  },

  async getCharacterForUser(userId: number) {
    const character = await prisma.character.findUnique({
      where: { userId },
      include: includeCharacterRelations
    });

    if (!character) {
      throw new HttpError('Character not found', 404);
    }

    return character;
  },

  async assignSkillToSlot(characterId: number, skillId: number, slot: string) {
    if (!skillSlotSet.has(slot as SkillSlot)) {
      throw new HttpError('Invalid skill slot', 400);
    }

    const charSkill = await prisma.characterSkill.findUnique({
      where: {
        characterId_skillId: {
          characterId,
          skillId
        }
      },
      include: {
        skill: true
      }
    });

    if (!charSkill || !charSkill.isUnlocked) {
      throw new HttpError('Skill not unlocked', 400);
    }

    if (charSkill.skill.category !== 'ACTIVE') {
      throw new HttpError('Only active skills can be assigned', 400);
    }

    const bindings = parseSkillBindings(
      (await prisma.character.findUnique({
        where: { id: characterId },
        select: { skillBindings: true }
      }))?.skillBindings ?? {}
    );

    const updatedBindings: Record<SkillSlot, number> = { ...bindings };

    for (const [key, value] of Object.entries(bindings)) {
      if (value === skillId) {
        delete updatedBindings[key as SkillSlot];
      }
    }

    for (const [key, value] of Object.entries(bindings)) {
      if (key === slot) {
        const existingSkillId = value;
        await prisma.characterSkill.updateMany({
          where: {
            characterId,
            assignedKey: key
          },
          data: {
            assignedKey: null
          }
        });

        if (typeof existingSkillId === 'number') {
          delete updatedBindings[key as SkillSlot];
        }
      }
    }

    updatedBindings[slot as SkillSlot] = skillId;

    await prisma.$transaction([
      prisma.character.update({
        where: { id: characterId },
        data: {
          skillBindings: serializeSkillBindings(updatedBindings)
        }
      }),
      prisma.characterSkill.update({
        where: { id: charSkill.id },
        data: {
          assignedKey: slot
        }
      })
    ]);

    return assertCharacterExists(characterId);
  },

  async unlockSkill(characterId: number, skillId: number) {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });

    if (!skill) {
      throw new HttpError('Skill not found', 404);
    }

    const existing = await prisma.characterSkill.findUnique({
      where: {
        characterId_skillId: {
          characterId,
          skillId
        }
      }
    });

    if (existing?.isUnlocked) {
      return existing;
    }

    const progress = await prisma.characterWeaponProgress.findFirst({
      where: {
        characterId,
        weaponTypeId: skill.weaponTypeId ?? undefined
      }
    });

    if (skill.weaponTypeId && !progress) {
      throw new HttpError('Weapon proficiency missing for this skill', 400);
    }

    return prisma.characterSkill.upsert({
      where: {
        characterId_skillId: {
          characterId,
          skillId
        }
      },
      update: {
        isUnlocked: true
      },
      create: {
        characterId,
        skillId,
        isUnlocked: true
      }
    });
  },

  async listSkills(characterId: number) {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: {
        equippedWeaponTypeId: true
      }
    });

    const weaponTypeId = character?.equippedWeaponTypeId;

    const skills = await prisma.skill.findMany({
      where: weaponTypeId
        ? {
            OR: [
              { weaponTypeId: null },
              { weaponTypeId }
            ]
          }
        : {},
      include: {
        characterLink: {
          where: { characterId }
        }
      }
    });

    return skills.map((skill) => ({
      skill,
      characterSkill: skill.characterLink[0] ?? null
    }));
  },

  async getCharacterById(characterId: number) {
    return assertCharacterExists(characterId);
  },

  async updatePosition(characterId: number, position: { x: number; y: number }) {
    await prisma.character.update({
      where: { id: characterId },
      data: {
        positionX: position.x,
        positionY: position.y
      }
    });
  },

  async grantWeaponExperience(characterId: number, weaponCode: WeaponCode, experience: number) {
    const weaponType = await prisma.weaponType.findUnique({ where: { code: weaponCode } });

    if (!weaponType) {
      throw new HttpError('Weapon type not found', 404);
    }

    const progress = await prisma.characterWeaponProgress.upsert({
      where: {
        characterId_weaponTypeId: {
          characterId,
          weaponTypeId: weaponType.id
        }
      },
      update: {
        experience: {
          increment: experience
        }
      },
      create: {
        characterId,
        weaponTypeId: weaponType.id,
        experience
      }
    });

    return progress;
  }
};
