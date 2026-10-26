"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryService = void 0;
const prisma_1 = require("../config/prisma");
exports.inventoryService = {
    async getInventory(characterId) {
        return prisma_1.prisma.inventoryItem.findMany({
            where: { characterId },
            include: { item: true }
        });
    },
    async addItems(characterId, items) {
        const operations = items.map((loot) => prisma_1.prisma.inventoryItem.upsert({
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
        }));
        return prisma_1.prisma.$transaction(operations);
    }
};
