"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameState = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const gameStateService_1 = require("../services/gameStateService");
const getGameState = async (req, res) => {
    if (!req.user?.characterId) {
        throw new errorHandler_1.HttpError('Character not found', 404);
    }
    const state = await gameStateService_1.gameStateService.getState(req.user.characterId);
    res.json(state);
};
exports.getGameState = getGameState;
