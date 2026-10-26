"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../config/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const SALT_ROUNDS = 10;
const buildToken = (userId, email, characterId) => jsonwebtoken_1.default.sign({ userId, email, characterId }, env_1.appConfig.jwtSecret, {
    expiresIn: '12h'
});
exports.authService = {
    async register(email, password) {
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            throw new errorHandler_1.HttpError('Email already registered', 409);
        }
        const passwordHash = await bcryptjs_1.default.hash(password, SALT_ROUNDS);
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                passwordHash
            },
            include: {
                character: true
            }
        });
        const token = buildToken(user.id, user.email, user.character?.id);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                characterId: user.character?.id ?? null
            }
        };
    },
    async login(email, password) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
            include: {
                character: true
            }
        });
        if (!user) {
            throw new errorHandler_1.HttpError('Invalid credentials', 401);
        }
        const validPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!validPassword) {
            throw new errorHandler_1.HttpError('Invalid credentials', 401);
        }
        const token = buildToken(user.id, user.email, user.character?.id);
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                characterId: user.character?.id ?? null
            }
        };
    },
    async profile(userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                character: true
            }
        });
        if (!user) {
            throw new errorHandler_1.HttpError('User not found', 404);
        }
        return {
            id: user.id,
            email: user.email,
            characterId: user.character?.id ?? null
        };
    }
};
