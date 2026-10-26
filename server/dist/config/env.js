"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = exports.env = void 0;
const dotenv_1 = require("dotenv");
const zod_1 = require("zod");
(0, dotenv_1.config)();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(1),
    PORT: zod_1.z.coerce.number().default(4000),
    CLIENT_ORIGIN: zod_1.z.string().default('http://localhost:5173')
});
exports.env = envSchema.parse(process.env);
exports.appConfig = {
    port: exports.env.PORT,
    jwtSecret: exports.env.JWT_SECRET,
    clientOrigin: exports.env.CLIENT_ORIGIN
};
