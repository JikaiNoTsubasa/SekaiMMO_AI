"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSkills = exports.unlockSkill = exports.assignSkill = exports.getInventory = exports.getCharacter = exports.createCharacter = void 0;
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const characterService_1 = require("../services/characterService");
const inventoryService_1 = require("../services/inventoryService");
const nameSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(24)
});
const assignSchema = zod_1.z.object({
    skillId: zod_1.z.number().int().positive(),
    slot: zod_1.z.string().length(1)
});
const unlockSchema = zod_1.z.object({
    skillId: zod_1.z.number().int().positive()
});
const createCharacter = async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.HttpError('Authentication required', 401);
    }
    const { name } = nameSchema.parse(req.body);
    const character = await characterService_1.characterService.createCharacter(req.user.userId, name);
    res.status(201).json(character);
};
exports.createCharacter = createCharacter;
const getCharacter = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const character = await characterService_1.characterService.getCharacterById(req.user.characterId);
    res.json(character);
};
exports.getCharacter = getCharacter;
const getInventory = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const inventory = await inventoryService_1.inventoryService.getInventory(req.user.characterId);
    res.json(inventory);
};
exports.getInventory = getInventory;
const assignSkill = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const { skillId, slot } = assignSchema.parse(req.body);
    const character = await characterService_1.characterService.assignSkillToSlot(req.user.characterId, skillId, slot.toUpperCase());
    res.json(character);
};
exports.assignSkill = assignSkill;
const unlockSkill = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const { skillId } = unlockSchema.parse(req.body);
    const skill = await characterService_1.characterService.unlockSkill(req.user.characterId, skillId);
    res.json(skill);
};
exports.unlockSkill = unlockSkill;
const listSkills = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const skills = await characterService_1.characterService.listSkills(req.user.characterId);
    res.json(skills);
};
exports.listSkills = listSkills;
