import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { healthRoutes } from './routes/health.js';
import { restaurantRoutes } from './routes/restaurants.js';
import { reservationRoutes } from './routes/reservations.js';
import { AppError, toErrorPayload } from './lib/errors.js';

export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
    credentials: true
  });

  app.register(healthRoutes);

  app.register(async (v1) => {
    v1.register(restaurantRoutes);
    v1.register(reservationRoutes);
  }, { prefix: '/v1' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const appError = new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', {
        issues: error.issues
      });
      return reply.code(400).send(toErrorPayload(appError, request.id));
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(toErrorPayload(error, request.id));
    }

    request.log.error(error);
    const fallback = new AppError(500, 'INTERNAL_ERROR', 'Unexpected server error');
    return reply.code(500).send(toErrorPayload(fallback, request.id));
  });

  return app;
};
