import { prisma } from '../config/prisma';

export interface Loot { itemId: number; quantity: number; }

export const inventoryService = {
  async getInventory(characterId: number) {
    return prisma.inventoryItem.findMany({
      where: { characterId },
      include: { item: true }
    });
  },

  async addItems(characterId: number, items: Loot[]) {
    const operations = items.map((loot) =>
      prisma.inventoryItem.upsert({
        where: {
          characterId_itemId: {
            characterId,
            itemId: loot.itemId
          }
        },
        update: {
          quantity: {
            increment: loot.quantity
          }
        },
        create: {
          characterId,
          itemId: loot.itemId,
          quantity: loot.quantity
        }
      })
    );

    return prisma.$transaction(operations);
  }
};
