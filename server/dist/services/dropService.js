"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropService = void 0;
const prisma_1 = require("../config/prisma");
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
exports.dropService = {
    async rollDrops(monsterId) {
        const monster = await prisma_1.prisma.monster.findUnique({
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
            return [];
        }
        const drops = [];
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
