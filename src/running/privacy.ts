import type { QueueLock } from './queue.ts';
export function ownedRunningKeys(storage: Storage, userId: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i); if (!key?.startsWith('flexer:running:v1:')) continue;
    try { const owner = JSON.parse(key.slice('flexer:running:v1:'.length)); if (Array.isArray(owner) && owner[0] === userId) keys.push(key); } catch { /* Never touch an unidentifiable owner. */ }
  }
  return keys;
}
export async function clearRunningAccount(storage: Storage, locks: QueueLock, userId: string) {
  for (const key of ownedRunningKeys(storage, userId)) await locks.exclusive(key, async () => {
    const previous = JSON.parse(storage.getItem(key) ?? '{}');
    if (!Number.isSafeInteger(previous.clearGeneration) || previous.clearGeneration < 0) throw new Error('Private running storage is unreadable and was not reported cleared.');
    const generation = Math.max(previous.clearGeneration + 1, Date.now());
    if (!Number.isSafeInteger(generation)) throw new Error('Private running storage could not be cleared safely.');
    storage.setItem(key, JSON.stringify({ version: 1, clearGeneration: generation, entries: [] }));
  });
}
export async function clearRunningPlan(storage: Storage, locks: QueueLock, userId: string, planId: string) {
  for (const key of ownedRunningKeys(storage, userId)) await locks.exclusive(key, async () => {
    const previous = JSON.parse(storage.getItem(key) ?? '{}');
    if (!Number.isSafeInteger(previous.clearGeneration) || previous.clearGeneration < 0 || !Array.isArray(previous.entries)) throw new Error('Plan device storage is unreadable and was not reported cleared.');
    if (!previous.entries.some((entry: { planId?: unknown }) => entry?.planId === planId)) return;
    const generation = previous.clearGeneration + 1;
    if (!Number.isSafeInteger(generation)) throw new Error('Plan device storage could not be cleared safely.');
    storage.setItem(key, JSON.stringify({ ...previous, clearGeneration: generation, entries: previous.entries.filter((entry: { planId?: unknown }) => entry?.planId !== planId) }));
  });
}
