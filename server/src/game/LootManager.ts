// Loot Manager - Gestion du loot et des récompenses
// SekaiMMO v2.0

import { prisma } from '../config/prisma';
import type { SpawnedMonster } from './MonsterSpawnManager';

export interface LootDrop {
  itemId: number;
  itemName: string;
  quantity: number;
  rarity: string;
}

export interface KillReward {
  gold: number;
  drops: LootDrop[];
}

export class LootManager {
  /**
   * Calcule les récompenses pour avoir tué un monstre (l'XP est gagnée à chaque coup, pas à la mort)
   */
  async calculateRewards(monster: SpawnedMonster): Promise<KillReward> {
    // Calculer l'or avec variation
    const goldVariance = 0.8 + Math.random() * 0.4; // ±20%
    const gold = Math.round(monster.baseGold * goldVariance);

    // Tirer les drops
    const drops = await this.rollDrops(monster.monsterId);

    return {
      gold,
      drops,
    };
  }

  /**
   * Tire les drops d'un monstre
   */
  async rollDrops(monsterId: number): Promise<LootDrop[]> {
    const monster = await prisma.monster.findUnique({
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

    const drops: LootDrop[] = [];

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
  async applyRewards(characterId: number, rewards: KillReward): Promise<void> {
    // Transaction pour appliquer toutes les récompenses
    await prisma.$transaction(async (tx) => {
      // Ajouter l'or
      await tx.character.update({
        where: { id: characterId },
        data: {
          gold: { increment: rewards.gold },
        },
      });

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
        } else {
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
  calculateDropBonus(baseProbability: number, luckStat: number): number {
    // Luck augmente la chance de drop de 0.5% par point
    const bonus = luckStat * 0.005;
    return Math.min(1, baseProbability * (1 + bonus));
  }

  /**
   * Génère un nombre aléatoire entre min et max inclus
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
