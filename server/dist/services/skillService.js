"use strict";
// Skill Service - Gestion des compétences
// Apprentissage, prérequis, assignation
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const progressionService_1 = require("./progressionService");
const SKILL_SLOTS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F'];
const SKILL_SLOT_SET = new Set(SKILL_SLOTS);
exports.skillService = {
    /**
     * Vérifie si un personnage remplit les prérequis pour apprendre un skill
     */
    async checkSkillRequirements(characterId, skillId) {
        const skill = await prisma_1.prisma.skill.findUnique({
            where: { id: skillId },
            include: { weaponType: true },
        });
        if (!skill) {
            throw new errorHandler_1.HttpError('Skill not found', 404);
        }
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { gold: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        const missingRequirements = [];
        // Vérifier le rank d'arme
        let meetsRankRequirement = true;
        let meetsWeaponXpRequirement = true;
        if (skill.weaponTypeId && skill.weaponType) {
            const weaponProgress = await prisma_1.prisma.characterWeaponProgress.findUnique({
                where: {
                    characterId_weaponTypeId: {
                        characterId,
                        weaponTypeId: skill.weaponTypeId,
                    },
                },
            });
            const currentRank = weaponProgress?.currentRank ?? 'E';
            const currentXp = weaponProgress?.experience ?? 0;
            meetsRankRequirement = progressionService_1.progressionService.isRankSufficient(currentRank, skill.requiredRank);
            meetsWeaponXpRequirement = currentXp >= skill.requiredWeaponXp;
            if (!meetsRankRequirement) {
                missingRequirements.push(`Rank ${skill.requiredRank} en ${skill.weaponType.name} requis (actuel: ${currentRank})`);
            }
            if (!meetsWeaponXpRequirement) {
                missingRequirements.push(`${skill.requiredWeaponXp} XP en ${skill.weaponType.name} requis (actuel: ${currentXp})`);
            }
        }
        // Vérifier l'XP d'élément
        let meetsElementXpRequirement = true;
        if (skill.element !== 'NONE' && skill.requiredElementXp > 0) {
            const elementProgress = await prisma_1.prisma.characterElementProgress.findUnique({
                where: {
                    characterId_element: {
                        characterId,
                        element: skill.element,
                    },
                },
            });
            const currentXp = elementProgress?.experience ?? 0;
            meetsElementXpRequirement = currentXp >= skill.requiredElementXp;
            if (!meetsElementXpRequirement) {
                missingRequirements.push(`${skill.requiredElementXp} XP en ${skill.element} requis (actuel: ${currentXp})`);
            }
        }
        // Vérifier l'or
        const hasEnoughGold = character.gold >= skill.goldCost;
        if (!hasEnoughGold && skill.goldCost > 0) {
            missingRequirements.push(`${skill.goldCost} or requis (actuel: ${character.gold})`);
        }
        const canLearn = meetsRankRequirement && meetsWeaponXpRequirement && meetsElementXpRequirement && hasEnoughGold;
        return {
            meetsRankRequirement,
            meetsWeaponXpRequirement,
            meetsElementXpRequirement,
            hasEnoughGold,
            canLearn,
            missingRequirements,
        };
    },
    /**
     * Apprend un skill à un personnage (après vérification des prérequis)
     */
    async learnSkill(characterId, skillId) {
        const skill = await prisma_1.prisma.skill.findUnique({
            where: { id: skillId },
        });
        if (!skill) {
            throw new errorHandler_1.HttpError('Skill not found', 404);
        }
        // Vérifier si déjà appris
        const existingSkill = await prisma_1.prisma.characterSkill.findUnique({
            where: {
                characterId_skillId: {
                    characterId,
                    skillId,
                },
            },
        });
        if (existingSkill?.isUnlocked) {
            return {
                success: false,
                skill: { id: skill.id, name: skill.name },
                goldSpent: 0,
                message: 'Skill already learned',
            };
        }
        // Vérifier les prérequis
        const requirements = await this.checkSkillRequirements(characterId, skillId);
        if (!requirements.canLearn) {
            throw new errorHandler_1.HttpError(`Cannot learn skill: ${requirements.missingRequirements.join(', ')}`, 400);
        }
        // Transaction: débiter l'or et débloquer le skill
        await prisma_1.prisma.$transaction(async (tx) => {
            // Débiter l'or
            if (skill.goldCost > 0) {
                await tx.character.update({
                    where: { id: characterId },
                    data: { gold: { decrement: skill.goldCost } },
                });
            }
            // Créer ou mettre à jour le skill
            await tx.characterSkill.upsert({
                where: {
                    characterId_skillId: {
                        characterId,
                        skillId,
                    },
                },
                update: { isUnlocked: true },
                create: {
                    characterId,
                    skillId,
                    isUnlocked: true,
                },
            });
        });
        return {
            success: true,
            skill: { id: skill.id, name: skill.name },
            goldSpent: skill.goldCost,
        };
    },
    /**
     * Assigne un skill à un slot de la barre de compétences
     */
    async assignSkillToSlot(characterId, skillId, slot) {
        if (!SKILL_SLOT_SET.has(slot)) {
            throw new errorHandler_1.HttpError('Invalid skill slot. Valid slots: Q, W, E, R, T, A, S, D, F', 400);
        }
        // Vérifier que le skill est débloqué
        const charSkill = await prisma_1.prisma.characterSkill.findUnique({
            where: {
                characterId_skillId: { characterId, skillId },
            },
            include: { skill: true },
        });
        if (!charSkill || !charSkill.isUnlocked) {
            throw new errorHandler_1.HttpError('Skill not unlocked', 400);
        }
        if (charSkill.skill.category !== 'ACTIVE') {
            throw new errorHandler_1.HttpError('Only active skills can be assigned to slots', 400);
        }
        // Récupérer les bindings actuels
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { skillBindings: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        const bindings = this.parseSkillBindings(character.skillBindings);
        // Retirer le skill de son ancien slot s'il en avait un
        for (const [key, value] of Object.entries(bindings)) {
            if (value === skillId) {
                delete bindings[key];
            }
        }
        // Retirer l'ancien skill du nouveau slot
        const oldSkillId = bindings[slot];
        if (oldSkillId) {
            await prisma_1.prisma.characterSkill.updateMany({
                where: { characterId, skillId: oldSkillId },
                data: { assignedKey: null },
            });
        }
        // Assigner le nouveau skill
        bindings[slot] = skillId;
        // Mettre à jour la base de données
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.character.update({
                where: { id: characterId },
                data: { skillBindings: bindings },
            }),
            prisma_1.prisma.characterSkill.update({
                where: { id: charSkill.id },
                data: { assignedKey: slot },
            }),
        ]);
    },
    /**
     * Retire un skill d'un slot
     */
    async unassignSkillFromSlot(characterId, slot) {
        if (!SKILL_SLOT_SET.has(slot)) {
            throw new errorHandler_1.HttpError('Invalid skill slot', 400);
        }
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { skillBindings: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        const bindings = this.parseSkillBindings(character.skillBindings);
        const skillId = bindings[slot];
        if (!skillId) {
            return; // Pas de skill dans ce slot
        }
        delete bindings[slot];
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.character.update({
                where: { id: characterId },
                data: { skillBindings: bindings },
            }),
            prisma_1.prisma.characterSkill.updateMany({
                where: { characterId, skillId },
                data: { assignedKey: null },
            }),
        ]);
    },
    /**
     * Liste les skills disponibles pour un personnage (par type d'arme)
     */
    async listAvailableSkills(characterId, weaponCode) {
        let weaponTypeId;
        if (weaponCode) {
            const weaponType = await prisma_1.prisma.weaponType.findUnique({
                where: { code: weaponCode },
            });
            weaponTypeId = weaponType?.id;
        }
        const skills = await prisma_1.prisma.skill.findMany({
            where: weaponTypeId
                ? {
                    OR: [{ weaponTypeId: null }, { weaponTypeId }],
                }
                : {},
            include: {
                weaponType: true,
                characterLinks: {
                    where: { characterId },
                },
            },
            orderBy: [{ weaponTypeId: 'asc' }, { requiredRank: 'asc' }],
        });
        // Vérifier les prérequis pour chaque skill
        const skillsWithRequirements = await Promise.all(skills.map(async (skill) => {
            const requirements = await this.checkSkillRequirements(characterId, skill.id);
            const isUnlocked = skill.characterLinks[0]?.isUnlocked ?? false;
            const assignedKey = skill.characterLinks[0]?.assignedKey ?? null;
            return {
                ...skill,
                characterLinks: undefined,
                isUnlocked,
                assignedKey,
                canLearn: requirements.canLearn,
                missingRequirements: requirements.missingRequirements,
            };
        }));
        return skillsWithRequirements;
    },
    /**
     * Liste les skills par catégorie (arme ou élément)
     */
    async listSkillsByCategory(characterId) {
        const allSkills = await this.listAvailableSkills(characterId);
        // Grouper par type d'arme
        const byWeapon = {};
        const byElement = {};
        const general = [];
        for (const skill of allSkills) {
            if (skill.weaponType) {
                const weaponName = skill.weaponType.name;
                if (!byWeapon[weaponName]) {
                    byWeapon[weaponName] = [];
                }
                byWeapon[weaponName].push(skill);
            }
            else if (skill.element !== 'NONE') {
                const elementName = skill.element;
                if (!byElement[elementName]) {
                    byElement[elementName] = [];
                }
                byElement[elementName].push(skill);
            }
            else {
                general.push(skill);
            }
        }
        return { byWeapon, byElement, general };
    },
    /**
     * Récupère la barre de skills d'un personnage
     */
    async getSkillBar(characterId) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { skillBindings: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        const bindings = this.parseSkillBindings(character.skillBindings);
        const skillIds = Object.values(bindings).filter((id) => typeof id === 'number');
        const skills = await prisma_1.prisma.skill.findMany({
            where: { id: { in: skillIds } },
        });
        const skillMap = new Map(skills.map((s) => [s.id, s]));
        const skillBar = {};
        for (const slot of SKILL_SLOTS) {
            const skillId = bindings[slot];
            if (skillId && skillMap.has(skillId)) {
                skillBar[slot] = { skillId, skill: skillMap.get(skillId) };
            }
            else {
                skillBar[slot] = null;
            }
        }
        return skillBar;
    },
    /**
     * Récupère les informations d'un skill pour le lancer
     */
    async getSkillForCast(skillId) {
        const skill = await prisma_1.prisma.skill.findUnique({
            where: { id: skillId },
        });
        if (!skill) {
            throw new errorHandler_1.HttpError('Skill not found', 404);
        }
        return {
            id: skill.id,
            name: skill.name,
            damageType: skill.damageType,
            element: skill.element,
            baseDamage: skill.baseDamage,
            damageScaling: skill.damageScaling,
            manaCost: skill.manaCost,
            cooldown: skill.cooldown,
            range: skill.range,
            areaOfEffect: skill.areaOfEffect,
            telegraphShape: skill.telegraphShape,
            telegraphWidth: skill.telegraphWidth,
            telegraphLength: skill.telegraphLength,
        };
    },
    // Helpers
    parseSkillBindings(bindings) {
        if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
            return {};
        }
        return Object.entries(bindings).reduce((acc, [key, value]) => {
            if (SKILL_SLOT_SET.has(key) && typeof value === 'number') {
                acc[key] = value;
            }
            return acc;
        }, {});
    },
};
