"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const env_1 = require("./config/env");
const prisma_1 = require("./config/prisma");
const gameServer_1 = require("./game/gameServer");
const bootstrap = async () => {
    console.log('Bootstrapping server...');
    const app = (0, app_1.createApp)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: env_1.appConfig.clientOrigin,
            credentials: true
        }
    });
    new gameServer_1.GameServer(io);
    httpServer.listen(env_1.appConfig.port, () => {
        console.log(`Server listening on port ${env_1.appConfig.port}`);
    });
    const shutdown = async () => {
        await io.close();
        await prisma_1.prisma.$disconnect();
        httpServer.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
};
bootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
});
