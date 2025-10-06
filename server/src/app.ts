import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { appConfig } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/authRoutes';
import { characterRouter } from './routes/characterRoutes';
import { gameRouter } from './routes/gameRoutes';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: appConfig.clientOrigin,
      credentials: true
    })
  );
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRouter);
  app.use('/characters', characterRouter);
  app.use('/game', gameRouter);

  app.use(errorHandler);

  return app;
};
