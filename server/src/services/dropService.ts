import { prisma } from '../config/prisma';

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const dropService = {
  async rollDrops(monsterId: number) {
    const monster = await prisma.monster.findUnique({
      where: { id: monsterId },
      include: {
        dropTable: {
          include: {
            items: {
              include: {
                item: true
              }
            }
          }
        }
      }
    });

    if (!monster?.dropTable) {
      return [] as { itemId: number; quantity: number }[];
    }

    const drops: { itemId: number; quantity: number }[] = [];

    for (const drop of monster.dropTable.items) {
      if (Math.random() <= drop.probability) {
        drops.push({
          itemId: drop.itemId,
          quantity: randomInt(drop.minQuantity, drop.maxQuantity)
        });
      }
    }

    return drops;
  }
};
