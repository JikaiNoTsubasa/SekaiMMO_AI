import { characterService } from './characterService';
import { inventoryService } from './inventoryService';

export const gameStateService = {
  async getState(characterId: number) {
    const [character, inventory, skills] = await Promise.all([
      characterService.getCharacterById(characterId),
      inventoryService.getInventory(characterId),
      characterService.listSkills(characterId)
    ]);

    const bindingsValue = character.skillBindings;
    const normalizedBindings: Record<string, number> = {};

    if (bindingsValue && typeof bindingsValue === 'object' && !Array.isArray(bindingsValue)) {
      Object.entries(bindingsValue as Record<string, unknown>).forEach(([key, value]) => {
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
