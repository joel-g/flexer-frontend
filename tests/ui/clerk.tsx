import { useSyncExternalStore, type ReactNode } from 'react';
let user: string | null = 'synthetic-A';
let session = 1;
const listeners = new Set<() => void>();
let tokenGetter = async (subject: string) => `synthetic-token-${subject}` as string | null;
export function configureFixtureTokens(getter: (subject: string) => Promise<string | null>, firstSubject: string) { tokenGetter = getter; setFixtureIdentity(firstSubject); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setFixtureIdentity(value: string | null) { user = value; session++; listeners.forEach(listener => listener()); }
export const getFixtureIdentity = () => user;
export function useAuth() { useSyncExternalStore(subscribe, () => `${user}:${session}`); return { isLoaded: true, isSignedIn: !!user, userId: user, sessionId: user ? `fixture-${session}` : null, getToken: async () => user ? tokenGetter(user) : null }; }
export function useUser() { const { userId } = useAuth(); return { user: userId ? { firstName: userId, emailAddresses: [] } : null }; }
export function useClerk() { return { signOut: async () => setFixtureIdentity(null) }; }
export function SignedIn({ children }: { children: ReactNode }) { return useAuth().isSignedIn ? children : null; }
export function SignedOut({ children }: { children: ReactNode }) { return useAuth().isSignedIn ? null : children; }
