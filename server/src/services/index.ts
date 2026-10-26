// Services Index - Export centralisé de tous les services
// SekaiMMO v2.0

// Services existants
export { characterService } from './characterService';
export { authService } from './authService';
export { dropService } from './dropService';
export { gameStateService } from './gameStateService';
export { inventoryService } from './inventoryService';

// Nouveaux services v2.0
export { combatService } from './combatService';
export type { CombatStats, DamageResult, SkillDamageParams } from './combatService';

export { progressionService } from './progressionService';
export type { ExperienceGain, ProgressionResult } from './progressionService';

export { skillService } from './skillService';
export type { SkillRequirements, LearnSkillResult } from './skillService';

export { guildService } from './guildService';

export { chatService } from './chatService';
export type { ChatMessageData } from './chatService';

export { bankService } from './bankService';

export { duelService } from './duelService';
export type { DuelState } from './duelService';

export { mapService } from './mapService';
export type { Portal, MapInfo, SpawnPoint } from './mapService';
