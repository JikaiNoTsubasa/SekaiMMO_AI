"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.characterService = void 0;
const prisma_1 = require("../generated/prisma");
const prisma_2 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const skillSlots = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
const skillSlotSet = new Set(skillSlots);
const parseSkillBindings = (bindings) => {
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
        return {};
    }
    return Object.entries(bindings).reduce((acc, [key, value]) => {
        if (skillSlotSet.has(key) && typeof value === 'number') {
            acc[key] = value;
        }
        return acc;
    }, {});
};
const serializeSkillBindings = (bindings) => bindings;
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
};
const assertCharacterExists = async (characterId) => {
    const character = await prisma_2.prisma.character.findUnique({
        where: { id: characterId },
        include: includeCharacterRelations
    });
    if (!character) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    return character;
};
exports.characterService = {
    async createCharacter(userId, name) {
        const existingName = await prisma_2.prisma.character.findUnique({ where: { name } });
        if (existingName) {
            throw new errorHandler_1.HttpError('Character name already in use', 409);
        }
        const existing = await prisma_2.prisma.character.findUnique({ where: { userId } });
        if (existing) {
            throw new errorHandler_1.HttpError('Character already exists for this account', 400);
        }
        const weaponTypes = await prisma_2.prisma.weaponType.findMany();
        if (!weaponTypes.length) {
            throw new errorHandler_1.HttpError('Weapon types are not seeded', 500);
        }
        const defaultWeapon = weaponTypes.find((weapon) => weapon.code === prisma_1.WeaponCode.SWORD) ?? weaponTypes[0];
        const character = await prisma_2.prisma.$transaction(async (tx) => {
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
    async getCharacterForUser(userId) {
        const character = await prisma_2.prisma.character.findUnique({
            where: { userId },
            include: includeCharacterRelations
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        return character;
    },
    async assignSkillToSlot(characterId, skillId, slot) {
        if (!skillSlotSet.has(slot)) {
            throw new errorHandler_1.HttpError('Invalid skill slot', 400);
        }
        const charSkill = await prisma_2.prisma.characterSkill.findUnique({
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
            throw new errorHandler_1.HttpError('Skill not unlocked', 400);
        }
        if (charSkill.skill.category !== 'ACTIVE') {
            throw new errorHandler_1.HttpError('Only active skills can be assigned', 400);
        }
        const bindings = parseSkillBindings((await prisma_2.prisma.character.findUnique({
            where: { id: characterId },
            select: { skillBindings: true }
        }))?.skillBindings ?? {});
        const updatedBindings = { ...bindings };
        for (const [key, value] of Object.entries(bindings)) {
            if (value === skillId) {
                delete updatedBindings[key];
            }
        }
        for (const [key, value] of Object.entries(bindings)) {
            if (key === slot) {
                const existingSkillId = value;
                await prisma_2.prisma.characterSkill.updateMany({
                    where: {
                        characterId,
                        assignedKey: key
                    },
                    data: {
                        assignedKey: null
                    }
                });
                if (typeof existingSkillId === 'number') {
                    delete updatedBindings[key];
                }
            }
        }
        updatedBindings[slot] = skillId;
        await prisma_2.prisma.$transaction([
            prisma_2.prisma.character.update({
                where: { id: characterId },
                data: {
                    skillBindings: serializeSkillBindings(updatedBindings)
                }
            }),
            prisma_2.prisma.characterSkill.update({
                where: { id: charSkill.id },
                data: {
                    assignedKey: slot
                }
            })
        ]);
        return assertCharacterExists(characterId);
    },
    async unlockSkill(characterId, skillId) {
        const skill = await prisma_2.prisma.skill.findUnique({ where: { id: skillId } });
        if (!skill) {
            throw new errorHandler_1.HttpError('Skill not found', 404);
        }
        const existing = await prisma_2.prisma.characterSkill.findUnique({
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
        const progress = await prisma_2.prisma.characterWeaponProgress.findFirst({
            where: {
                characterId,
                weaponTypeId: skill.weaponTypeId ?? undefined
            }
        });
        if (skill.weaponTypeId && !progress) {
            throw new errorHandler_1.HttpError('Weapon proficiency missing for this skill', 400);
        }
        return prisma_2.prisma.characterSkill.upsert({
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
    async listSkills(characterId) {
        const character = await prisma_2.prisma.character.findUnique({
            where: { id: characterId },
            select: {
                equippedWeaponTypeId: true
            }
        });
        const weaponTypeId = character?.equippedWeaponTypeId;
        const skills = await prisma_2.prisma.skill.findMany({
            where: weaponTypeId
                ? {
                    OR: [
                        { weaponTypeId: null },
                        { weaponTypeId }
                    ]
                }
                : {},
            include: {
                characterLinks: {
                    where: { characterId }
                }
            }
        });
        return skills.map((skill) => ({
            skill,
            characterSkill: skill.characterLinks[0] ?? null
        }));
    },
    async getCharacterById(characterId) {
        return assertCharacterExists(characterId);
    },
    async updatePosition(characterId, position) {
        await prisma_2.prisma.character.update({
            where: { id: characterId },
            data: {
                positionX: position.x,
                positionY: position.y
            }
        });
    },
    async grantWeaponExperience(characterId, weaponCode, experience) {
        const weaponType = await prisma_2.prisma.weaponType.findUnique({ where: { code: weaponCode } });
        if (!weaponType) {
            throw new errorHandler_1.HttpError('Weapon type not found', 404);
        }
        const progress = await prisma_2.prisma.characterWeaponProgress.upsert({
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
