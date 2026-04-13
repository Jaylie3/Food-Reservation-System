import { buildApp } from './app.js';
import { env } from './lib/env.js';

const app = buildApp();

const start = async (): Promise<void> => {
  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0'
    });
    app.log.info({ port: env.PORT }, 'API listening');
  } catch (error) {
    app.log.error(error, 'Failed to start API');
    process.exit(1);
  }
};

void start();
