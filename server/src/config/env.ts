import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173')
});

export const env = envSchema.parse(process.env);

export const appConfig = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  clientOrigin: env.CLIENT_ORIGIN
};
