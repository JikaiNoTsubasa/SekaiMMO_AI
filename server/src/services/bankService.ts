// Bank Service - Gestion de la banque personnelle
// Dépôt, retrait, stockage d'items

import { prisma } from '../config/prisma';
import { HttpError } from '../middleware/errorHandler';

const MAX_BANK_SLOTS = 100; // Nombre max d'items différents dans la banque
const MAX_STACK_SIZE = 9999;

export const bankService = {
  /**
   * Récupère le contenu de la banque d'un personnage
   */
  async getBankContents(characterId: number) {
    const bankItems = await prisma.bankItem.findMany({
      where: { characterId },
      include: {
        item: true,
      },
      orderBy: { id: 'asc' },
    });

    return bankItems.map((bi) => ({
      id: bi.id,
      item: bi.item,
      quantity: bi.quantity,
    }));
  },

  /**
   * Dépose un item de l'inventaire dans la banque
   */
  async depositItem(characterId: number, itemId: number, quantity: number) {
    if (quantity <= 0) {
      throw new HttpError('Quantity must be positive', 400);
    }

    // Vérifier que l'item est dans l'inventaire
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
      include: { item: true },
    });

    if (!inventoryItem || inventoryItem.quantity < quantity) {
      throw new HttpError('Not enough items in inventory', 400);
    }

    // Vérifier le nombre de slots dans la banque
    const bankCount = await prisma.bankItem.count({
      where: { characterId },
    });

    const existingBankItem = await prisma.bankItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
    });

    if (!existingBankItem && bankCount >= MAX_BANK_SLOTS) {
      throw new HttpError('Bank is full', 400);
    }

    // Vérifier le stack max
    const currentBankQuantity = existingBankItem?.quantity ?? 0;
    const newBankQuantity = currentBankQuantity + quantity;

    if (newBankQuantity > MAX_STACK_SIZE) {
      throw new HttpError(`Cannot exceed stack size of ${MAX_STACK_SIZE}`, 400);
    }

    // Transaction: retirer de l'inventaire et ajouter à la banque
    await prisma.$transaction(async (tx) => {
      // Retirer de l'inventaire
      if (inventoryItem.quantity === quantity) {
        await tx.inventoryItem.delete({
          where: { id: inventoryItem.id },
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantity: { decrement: quantity } },
        });
      }

      // Ajouter à la banque
      await tx.bankItem.upsert({
        where: {
          characterId_itemId: { characterId, itemId },
        },
        update: { quantity: { increment: quantity } },
        create: {
          characterId,
          itemId,
          quantity,
        },
      });
    });

    return { success: true, deposited: quantity };
  },

  /**
   * Retire un item de la banque vers l'inventaire
   */
  async withdrawItem(characterId: number, itemId: number, quantity: number) {
    if (quantity <= 0) {
      throw new HttpError('Quantity must be positive', 400);
    }

    // Vérifier que l'item est dans la banque
    const bankItem = await prisma.bankItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
      include: { item: true },
    });

    if (!bankItem || bankItem.quantity < quantity) {
      throw new HttpError('Not enough items in bank', 400);
    }

    // Vérifier le stack max dans l'inventaire
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
    });

    const currentInventoryQuantity = inventoryItem?.quantity ?? 0;
    const newInventoryQuantity = currentInventoryQuantity + quantity;
    const maxStack = bankItem.item.maxStack;

    if (newInventoryQuantity > maxStack) {
      throw new HttpError(`Cannot exceed stack size of ${maxStack}`, 400);
    }

    // Transaction: retirer de la banque et ajouter à l'inventaire
    await prisma.$transaction(async (tx) => {
      // Retirer de la banque
      if (bankItem.quantity === quantity) {
        await tx.bankItem.delete({
          where: { id: bankItem.id },
        });
      } else {
        await tx.bankItem.update({
          where: { id: bankItem.id },
          data: { quantity: { decrement: quantity } },
        });
      }

      // Ajouter à l'inventaire
      await tx.inventoryItem.upsert({
        where: {
          characterId_itemId: { characterId, itemId },
        },
        update: { quantity: { increment: quantity } },
        create: {
          characterId,
          itemId,
          quantity,
        },
      });
    });

    return { success: true, withdrawn: quantity };
  },

  /**
   * Dépose tout un type d'item
   */
  async depositAllOfItem(characterId: number, itemId: number) {
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
    });

    if (!inventoryItem || inventoryItem.quantity === 0) {
      throw new HttpError('Item not in inventory', 400);
    }

    return this.depositItem(characterId, itemId, inventoryItem.quantity);
  },

  /**
   * Retire tout un type d'item
   */
  async withdrawAllOfItem(characterId: number, itemId: number) {
    const bankItem = await prisma.bankItem.findUnique({
      where: {
        characterId_itemId: { characterId, itemId },
      },
    });

    if (!bankItem || bankItem.quantity === 0) {
      throw new HttpError('Item not in bank', 400);
    }

    return this.withdrawItem(characterId, itemId, bankItem.quantity);
  },

  /**
   * Récupère les statistiques de la banque
   */
  async getBankStats(characterId: number) {
    const [itemCount, totalItems] = await Promise.all([
      prisma.bankItem.count({ where: { characterId } }),
      prisma.bankItem.aggregate({
        where: { characterId },
        _sum: { quantity: true },
      }),
    ]);

    return {
      usedSlots: itemCount,
      maxSlots: MAX_BANK_SLOTS,
      totalItems: totalItems._sum.quantity ?? 0,
    };
  },

  /**
   * Recherche un item dans la banque
   */
  async searchBankItem(characterId: number, itemName: string) {
    const bankItems = await prisma.bankItem.findMany({
      where: {
        characterId,
        item: {
          name: { contains: itemName, mode: 'insensitive' },
        },
      },
      include: { item: true },
    });

    return bankItems.map((bi) => ({
      id: bi.id,
      item: bi.item,
      quantity: bi.quantity,
    }));
  },

  /**
   * Trie la banque (par type, rareté, nom)
   */
  async getSortedBankContents(
    characterId: number,
    sortBy: 'type' | 'rarity' | 'name' = 'type'
  ) {
    const orderBy = {
      type: { item: { type: 'asc' as const } },
      rarity: { item: { rarity: 'desc' as const } },
      name: { item: { name: 'asc' as const } },
    }[sortBy];

    const bankItems = await prisma.bankItem.findMany({
      where: { characterId },
      include: { item: true },
      orderBy,
    });

    return bankItems.map((bi) => ({
      id: bi.id,
      item: bi.item,
      quantity: bi.quantity,
    }));
  },
};
