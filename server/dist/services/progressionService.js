"use strict";
// Progression Service - Système d'XP par action et ranks
// Gère la progression des armes et éléments magiques
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressionService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
// Seuils d'XP pour chaque rank
const RANK_THRESHOLDS = {
    E: 0, // Débutant
    D: 500, // Apprenti
    C: 2000, // Confirmé
    B: 5000, // Expert
    A: 15000, // Maître
};
// Ordre des ranks pour comparaison
const RANK_ORDER = ['E', 'D', 'C', 'B', 'A'];
exports.progressionService = {
    /**
     * Calcule le rank basé sur l'XP
     */
    calculateRankFromXp(experience) {
        for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
            const rank = RANK_ORDER[i];
            if (experience >= RANK_THRESHOLDS[rank]) {
                return rank;
            }
        }
        return 'E';
    },
    /**
     * Vérifie si un rank est supérieur ou égal à un autre
     */
    isRankSufficient(current, required) {
        return RANK_ORDER.indexOf(current) >= RANK_ORDER.indexOf(required);
    },
    /**
     * Obtient l'XP nécessaire pour le prochain rank
     */
    getXpForNextRank(currentRank) {
        const currentIndex = RANK_ORDER.indexOf(currentRank);
        if (currentIndex >= RANK_ORDER.length - 1) {
            return null; // Déjà au rank max
        }
        return RANK_THRESHOLDS[RANK_ORDER[currentIndex + 1]];
    },
    /**
     * Accorde de l'XP d'arme à un personnage
     */
    async grantWeaponExperience(characterId, weaponCode, amount) {
        const weaponType = await prisma_1.prisma.weaponType.findUnique({
            where: { code: weaponCode },
        });
        if (!weaponType) {
            throw new errorHandler_1.HttpError('Weapon type not found', 404);
        }
        // Récupérer ou créer la progression
        let progress = await prisma_1.prisma.characterWeaponProgress.findUnique({
            where: {
                characterId_weaponTypeId: {
                    characterId,
                    weaponTypeId: weaponType.id,
                },
            },
        });
        const previousXp = progress?.experience ?? 0;
        const previousRank = progress?.currentRank ?? 'E';
        // Mettre à jour ou créer
        if (progress) {
            progress = await prisma_1.prisma.characterWeaponProgress.update({
                where: { id: progress.id },
                data: {
                    experience: { increment: amount },
                },
            });
        }
        else {
            progress = await prisma_1.prisma.characterWeaponProgress.create({
                data: {
                    characterId,
                    weaponTypeId: weaponType.id,
                    experience: amount,
                    currentRank: 'E',
                },
            });
        }
        // Calculer le nouveau rank
        const newRank = this.calculateRankFromXp(progress.experience);
        const rankUp = RANK_ORDER.indexOf(newRank) > RANK_ORDER.indexOf(previousRank);
        // Mettre à jour le rank si nécessaire
        if (rankUp) {
            await prisma_1.prisma.characterWeaponProgress.update({
                where: { id: progress.id },
                data: { currentRank: newRank },
            });
        }
        return {
            previousXp,
            newXp: progress.experience,
            previousRank,
            newRank,
            rankUp,
        };
    },
    /**
     * Accorde de l'XP d'élément magique à un personnage
     */
    async grantElementExperience(characterId, element, amount) {
        if (element === 'NONE') {
            throw new errorHandler_1.HttpError('Cannot grant XP for NONE element', 400);
        }
        // Récupérer ou créer la progression
        let progress = await prisma_1.prisma.characterElementProgress.findUnique({
            where: {
                characterId_element: {
                    characterId,
                    element,
                },
            },
        });
        const previousXp = progress?.experience ?? 0;
        const previousRank = progress?.currentRank ?? 'E';
        // Mettre à jour ou créer
        if (progress) {
            progress = await prisma_1.prisma.characterElementProgress.update({
                where: { id: progress.id },
                data: {
                    experience: { increment: amount },
                },
            });
        }
        else {
            progress = await prisma_1.prisma.characterElementProgress.create({
                data: {
                    characterId,
                    element,
                    experience: amount,
                    currentRank: 'E',
                },
            });
        }
        // Calculer le nouveau rank
        const newRank = this.calculateRankFromXp(progress.experience);
        const rankUp = RANK_ORDER.indexOf(newRank) > RANK_ORDER.indexOf(previousRank);
        // Mettre à jour le rank si nécessaire
        if (rankUp) {
            await prisma_1.prisma.characterElementProgress.update({
                where: { id: progress.id },
                data: { currentRank: newRank },
            });
        }
        return {
            previousXp,
            newXp: progress.experience,
            previousRank,
            newRank,
            rankUp,
        };
    },
    /**
     * Accorde de l'or à un personnage
     */
    async grantGold(characterId, amount) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { gold: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        const previousGold = character.gold;
        await prisma_1.prisma.character.update({
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
    async spendGold(characterId, amount) {
        const character = await prisma_1.prisma.character.findUnique({
            where: { id: characterId },
            select: { gold: true },
        });
        if (!character) {
            throw new errorHandler_1.HttpError('Character not found', 404);
        }
        if (character.gold < amount) {
            return { success: false, newGold: character.gold };
        }
        await prisma_1.prisma.character.update({
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
    async processActionExperience(characterId, gains) {
        const result = {};
        // XP d'arme
        if (gains.weaponXp && gains.weaponXp.amount > 0) {
            const weaponResult = await this.grantWeaponExperience(characterId, gains.weaponXp.weaponCode, gains.weaponXp.amount);
            result.weaponProgress = {
                ...weaponResult,
                weaponCode: gains.weaponXp.weaponCode,
            };
        }
        // XP d'élément
        if (gains.elementXp && gains.elementXp.amount > 0 && gains.elementXp.element !== 'NONE') {
            const elementResult = await this.grantElementExperience(characterId, gains.elementXp.element, gains.elementXp.amount);
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
    async getWeaponProgress(characterId, weaponCode) {
        const weaponType = await prisma_1.prisma.weaponType.findUnique({
            where: { code: weaponCode },
        });
        if (!weaponType) {
            throw new errorHandler_1.HttpError('Weapon type not found', 404);
        }
        const progress = await prisma_1.prisma.characterWeaponProgress.findUnique({
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
                currentRank: 'E',
                nextRankXp: RANK_THRESHOLDS.D,
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
    async getElementProgress(characterId, element) {
        if (element === 'NONE') {
            return null;
        }
        const progress = await prisma_1.prisma.characterElementProgress.findUnique({
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
                currentRank: 'E',
                nextRankXp: RANK_THRESHOLDS.D,
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
    async getAllProgress(characterId) {
        const [weaponProgress, elementProgress] = await Promise.all([
            prisma_1.prisma.characterWeaponProgress.findMany({
                where: { characterId },
                include: { weaponType: true },
            }),
            prisma_1.prisma.characterElementProgress.findMany({
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
