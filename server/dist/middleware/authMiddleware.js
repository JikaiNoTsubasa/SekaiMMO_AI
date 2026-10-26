"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("./errorHandler");
const authenticate = async (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new errorHandler_1.HttpError('Authentication required', 401);
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.appConfig.jwtSecret);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { character: true }
        });
        if (!user) {
            throw new errorHandler_1.HttpError('Invalid credentials', 401);
        }
        req.user = {
            userId: user.id,
            email: user.email,
            characterId: user.character?.id
        };
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.HttpError) {
            throw error;
        }
        throw new errorHandler_1.HttpError('Authentication failed', 401);
    }
};
exports.authenticate = authenticate;
