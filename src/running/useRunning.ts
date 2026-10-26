import { createContext, useContext } from 'react';
import type { RunningClient } from './client.ts';
import type { AccountState, StateData } from './contract.ts';
import type { RunningController } from './controller.ts';
export type RunningLoad = { phase: 'loading' | 'ready' | 'disabled' | 'error'; data: StateData | null; message: string };
export type RunningContextValue = { client: RunningClient | null; load: RunningLoad; online: boolean; controller: RunningController | null; refresh: () => Promise<void>; recover: () => Promise<void>; prepareSignout: (confirmedDeletion?: boolean) => Promise<boolean>; updateAccount: (account: AccountState) => void };
export const RunningContext = createContext<RunningContextValue | null>(null);
export function useRunning() {
  const context = useContext(RunningContext);
  if (!context) throw new Error('Running must be inside the authenticated running boundary.');
  return context;
}
