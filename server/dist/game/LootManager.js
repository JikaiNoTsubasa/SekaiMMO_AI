"use strict";
// Loot Manager - Gestion du loot et des récompenses
// SekaiMMO v2.0
Object.defineProperty(exports, "__esModule", { value: true });
exports.LootManager = void 0;
const prisma_1 = require("../config/prisma");
class LootManager {
    /**
     * Calcule les récompenses pour avoir tué un monstre
     */
    async calculateRewards(monster, killerLevel, weaponCode) {
        // Calculer l'XP avec bonus/malus selon la différence de niveau
        const levelDiff = monster.level - killerLevel;
        const xpMultiplier = this.getXPMultiplier(levelDiff);
        const experience = Math.round(monster.baseExperience * xpMultiplier);
        // Calculer l'or avec variation
        const goldVariance = 0.8 + Math.random() * 0.4; // ±20%
        const gold = Math.round(monster.baseGold * goldVariance);
        // Tirer les drops
        const drops = await this.rollDrops(monster.monsterId);
        return {
            experience,
            gold,
            drops,
        };
    }
    /**
     * Calcule le multiplicateur d'XP basé sur la différence de niveau
     */
    getXPMultiplier(levelDiff) {
        if (levelDiff >= 5) {
            // Monstre beaucoup plus fort = bonus XP
            return 1.5;
        }
        else if (levelDiff >= 2) {
            return 1.2;
        }
        else if (levelDiff >= -2) {
            // Même niveau = XP normal
            return 1.0;
        }
        else if (levelDiff >= -5) {
            // Monstre plus faible = moins d'XP
            return 0.7;
        }
        else {
            // Monstre beaucoup plus faible = très peu d'XP
            return 0.3;
        }
    }
    /**
     * Tire les drops d'un monstre
     */
    async rollDrops(monsterId) {
        const monster = await prisma_1.prisma.monster.findUnique({
            where: { id: monsterId },
            include: {
                dropTable: {
                    include: {
                        items: {
                            include: {
                                item: true,
                            },
                        },
                    },
                },
            },
        });
        if (!monster?.dropTable) {
            return [];
        }
        const drops = [];
        for (const drop of monster.dropTable.items) {
            // Tirer le loot avec probabilité
            if (Math.random() <= drop.probability) {
                const quantity = this.randomInt(drop.minQuantity, drop.maxQuantity);
                drops.push({
                    itemId: drop.itemId,
                    itemName: drop.item.name,
                    quantity,
                    rarity: drop.item.rarity,
                });
            }
        }
        return drops;
    }
    /**
     * Applique les récompenses au personnage
     */
    async applyRewards(characterId, rewards, weaponCode) {
        // Transaction pour appliquer toutes les récompenses
        await prisma_1.prisma.$transaction(async (tx) => {
            // Ajouter l'or
            await tx.character.update({
                where: { id: characterId },
                data: {
                    gold: { increment: rewards.gold },
                },
            });
            // Ajouter l'XP à l'arme
            const weaponType = await tx.weaponType.findUnique({
                where: { code: weaponCode },
            });
            if (weaponType) {
                const existingProgress = await tx.characterWeaponProgress.findUnique({
                    where: {
                        characterId_weaponTypeId: {
                            characterId,
                            weaponTypeId: weaponType.id,
                        },
                    },
                });
                if (existingProgress) {
                    await tx.characterWeaponProgress.update({
                        where: {
                            characterId_weaponTypeId: {
                                characterId,
                                weaponTypeId: weaponType.id,
                            },
                        },
                        data: {
                            experience: { increment: rewards.experience },
                        },
                    });
                }
                else {
                    await tx.characterWeaponProgress.create({
                        data: {
                            characterId,
                            weaponTypeId: weaponType.id,
                            experience: rewards.experience,
                            currentRank: 'E',
                        },
                    });
                }
            }
            // Ajouter les items à l'inventaire
            for (const drop of rewards.drops) {
                const existingItem = await tx.inventoryItem.findFirst({
                    where: {
                        characterId,
                        itemId: drop.itemId,
                    },
                });
                if (existingItem) {
                    // Stack l'item existant (max 9999)
                    const newQuantity = Math.min(9999, existingItem.quantity + drop.quantity);
                    await tx.inventoryItem.update({
                        where: { id: existingItem.id },
                        data: { quantity: newQuantity },
                    });
                }
                else {
                    // Créer un nouveau slot d'inventaire
                    await tx.inventoryItem.create({
                        data: {
                            characterId,
                            itemId: drop.itemId,
                            quantity: drop.quantity,
                        },
                    });
                }
            }
        });
    }
    /**
     * Calcule la chance de drop bonus basée sur la chance du joueur
     */
    calculateDropBonus(baseProbability, luckStat) {
        // Luck augmente la chance de drop de 0.5% par point
        const bonus = luckStat * 0.005;
        return Math.min(1, baseProbability * (1 + bonus));
    }
    /**
     * Génère un nombre aléatoire entre min et max inclus
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
exports.LootManager = LootManager;
