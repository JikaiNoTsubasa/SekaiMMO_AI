"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profile = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const authService_1 = require("../services/authService");
const credentialsSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
const register = async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const result = await authService_1.authService.register(email, password);
    res.status(201).json(result);
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const result = await authService_1.authService.login(email, password);
    res.json(result);
};
exports.login = login;
const profile = async (req, res) => {
    if (!req.user) {
        throw new errorHandler_1.HttpError('Authentication required', 401);
    }
    const result = await authService_1.authService.profile(req.user.userId);
    res.json(result);
};
exports.profile = profile;
