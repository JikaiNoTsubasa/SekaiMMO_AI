import { createServer } from 'http';
import { Server } from 'socket.io';

import { createApp } from './app';
import { appConfig } from './config/env';
import { prisma } from './config/prisma';
import { GameServer } from './game/gameServer';

const bootstrap = async () => {
  console.log('Bootstrapping server...');

  const app = createApp();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: appConfig.clientOrigin,
      credentials: true
    }
  });

  new GameServer(io);

  httpServer.listen(appConfig.port, () => {
    console.log(`Server listening on port ${appConfig.port}`);
  });

  const shutdown = async () => {
    await io.close();
    await prisma.$disconnect();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
