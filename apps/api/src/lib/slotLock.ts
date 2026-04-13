import { randomUUID } from 'node:crypto';
import { redis } from './redis.js';

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

export interface SlotLock {
  key: string;
  owner: string;
}

export const lockKeyForSlot = (slotId: string): string => `lock:slot:${slotId}`;

export const acquireSlotLock = async (slotId: string, ttlSeconds = 8): Promise<SlotLock | null> => {
  const key = lockKeyForSlot(slotId);
  const owner = randomUUID();
  const result = await redis.set(key, owner, 'EX', ttlSeconds, 'NX');
  if (result !== 'OK') {
    return null;
  }
  return { key, owner };
};

export const releaseSlotLock = async (lock: SlotLock): Promise<void> => {
  await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.owner);
};
