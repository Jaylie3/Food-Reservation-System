import { redis } from './redis.js';

const TTL_SECONDS = 60;

export const idempotencyKeyFor = (key: string): string => `idempotency:${key}`;

export const getCachedIdempotentResponse = async <T>(key: string): Promise<T | null> => {
  const raw = await redis.get(idempotencyKeyFor(key));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as T;
};

export const setCachedIdempotentResponse = async <T>(key: string, value: T): Promise<void> => {
  await redis.set(idempotencyKeyFor(key), JSON.stringify(value), 'EX', TTL_SECONDS);
};
