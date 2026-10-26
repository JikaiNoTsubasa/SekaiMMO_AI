"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const errorHandler_1 = require("./middleware/errorHandler");
const authRoutes_1 = require("./routes/authRoutes");
const characterRoutes_1 = require("./routes/characterRoutes");
const gameRoutes_1 = require("./routes/gameRoutes");
const createApp = () => {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.appConfig.clientOrigin,
        credentials: true
    }));
    app.use(express_1.default.json());
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));
    app.use('/auth', authRoutes_1.authRouter);
    app.use('/characters', characterRoutes_1.characterRouter);
    app.use('/game', gameRoutes_1.gameRouter);
    app.use(errorHandler_1.errorHandler);
    return app;
};
exports.createApp = createApp;
