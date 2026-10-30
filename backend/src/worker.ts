import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

process.env.GRADING_WORKER_ENABLED = 'true';
const app = await NestFactory.createApplicationContext(AppModule);
// A dedicated worker must remain alive even while its poller is idle.
const keepAlive = setInterval(() => {}, 60000);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, async () => {
    clearInterval(keepAlive);
    await app.close();
  });
