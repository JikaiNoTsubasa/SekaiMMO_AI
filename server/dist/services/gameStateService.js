"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStateService = void 0;
const characterService_1 = require("./characterService");
const inventoryService_1 = require("./inventoryService");
exports.gameStateService = {
    async getState(characterId) {
        const [character, inventory, skills] = await Promise.all([
            characterService_1.characterService.getCharacterById(characterId),
            inventoryService_1.inventoryService.getInventory(characterId),
            characterService_1.characterService.listSkills(characterId)
        ]);
        const bindingsValue = character.skillBindings;
        const normalizedBindings = {};
        if (bindingsValue && typeof bindingsValue === 'object' && !Array.isArray(bindingsValue)) {
            Object.entries(bindingsValue).forEach(([key, value]) => {
                if (typeof value === 'number') {
                    normalizedBindings[key] = value;
                }
            });
        }
        return {
            character: {
                ...character,
                skillBindings: normalizedBindings
            },
            inventory,
            skills
        };
    }
};
