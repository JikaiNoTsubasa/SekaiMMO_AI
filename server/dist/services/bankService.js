"use strict";
// Bank Service - Gestion de la banque personnelle
// Dépôt, retrait, stockage d'items
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankService = void 0;
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const MAX_BANK_SLOTS = 100; // Nombre max d'items différents dans la banque
const MAX_STACK_SIZE = 9999;
exports.bankService = {
    /**
     * Récupère le contenu de la banque d'un personnage
     */
    async getBankContents(characterId) {
        const bankItems = await prisma_1.prisma.bankItem.findMany({
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
    async depositItem(characterId, itemId, quantity) {
        if (quantity <= 0) {
            throw new errorHandler_1.HttpError('Quantity must be positive', 400);
        }
        // Vérifier que l'item est dans l'inventaire
        const inventoryItem = await prisma_1.prisma.inventoryItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
            include: { item: true },
        });
        if (!inventoryItem || inventoryItem.quantity < quantity) {
            throw new errorHandler_1.HttpError('Not enough items in inventory', 400);
        }
        // Vérifier le nombre de slots dans la banque
        const bankCount = await prisma_1.prisma.bankItem.count({
            where: { characterId },
        });
        const existingBankItem = await prisma_1.prisma.bankItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
        });
        if (!existingBankItem && bankCount >= MAX_BANK_SLOTS) {
            throw new errorHandler_1.HttpError('Bank is full', 400);
        }
        // Vérifier le stack max
        const currentBankQuantity = existingBankItem?.quantity ?? 0;
        const newBankQuantity = currentBankQuantity + quantity;
        if (newBankQuantity > MAX_STACK_SIZE) {
            throw new errorHandler_1.HttpError(`Cannot exceed stack size of ${MAX_STACK_SIZE}`, 400);
        }
        // Transaction: retirer de l'inventaire et ajouter à la banque
        await prisma_1.prisma.$transaction(async (tx) => {
            // Retirer de l'inventaire
            if (inventoryItem.quantity === quantity) {
                await tx.inventoryItem.delete({
                    where: { id: inventoryItem.id },
                });
            }
            else {
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
    async withdrawItem(characterId, itemId, quantity) {
        if (quantity <= 0) {
            throw new errorHandler_1.HttpError('Quantity must be positive', 400);
        }
        // Vérifier que l'item est dans la banque
        const bankItem = await prisma_1.prisma.bankItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
            include: { item: true },
        });
        if (!bankItem || bankItem.quantity < quantity) {
            throw new errorHandler_1.HttpError('Not enough items in bank', 400);
        }
        // Vérifier le stack max dans l'inventaire
        const inventoryItem = await prisma_1.prisma.inventoryItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
        });
        const currentInventoryQuantity = inventoryItem?.quantity ?? 0;
        const newInventoryQuantity = currentInventoryQuantity + quantity;
        const maxStack = bankItem.item.maxStack;
        if (newInventoryQuantity > maxStack) {
            throw new errorHandler_1.HttpError(`Cannot exceed stack size of ${maxStack}`, 400);
        }
        // Transaction: retirer de la banque et ajouter à l'inventaire
        await prisma_1.prisma.$transaction(async (tx) => {
            // Retirer de la banque
            if (bankItem.quantity === quantity) {
                await tx.bankItem.delete({
                    where: { id: bankItem.id },
                });
            }
            else {
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
    async depositAllOfItem(characterId, itemId) {
        const inventoryItem = await prisma_1.prisma.inventoryItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
        });
        if (!inventoryItem || inventoryItem.quantity === 0) {
            throw new errorHandler_1.HttpError('Item not in inventory', 400);
        }
        return this.depositItem(characterId, itemId, inventoryItem.quantity);
    },
    /**
     * Retire tout un type d'item
     */
    async withdrawAllOfItem(characterId, itemId) {
        const bankItem = await prisma_1.prisma.bankItem.findUnique({
            where: {
                characterId_itemId: { characterId, itemId },
            },
        });
        if (!bankItem || bankItem.quantity === 0) {
            throw new errorHandler_1.HttpError('Item not in bank', 400);
        }
        return this.withdrawItem(characterId, itemId, bankItem.quantity);
    },
    /**
     * Récupère les statistiques de la banque
     */
    async getBankStats(characterId) {
        const [itemCount, totalItems] = await Promise.all([
            prisma_1.prisma.bankItem.count({ where: { characterId } }),
            prisma_1.prisma.bankItem.aggregate({
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
    async searchBankItem(characterId, itemName) {
        const bankItems = await prisma_1.prisma.bankItem.findMany({
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
    async getSortedBankContents(characterId, sortBy = 'type') {
        const orderBy = {
            type: { item: { type: 'asc' } },
            rarity: { item: { rarity: 'desc' } },
            name: { item: { name: 'asc' } },
        }[sortBy];
        const bankItems = await prisma_1.prisma.bankItem.findMany({
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
