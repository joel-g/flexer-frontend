// Test-only adapter. Never import from the production application entry point.
const capturedFetch = globalThis.fetch.bind(globalThis);
const allowedSubjects = new Set(['synthetic-clerk-a', 'browser-synthetic-b']);

export async function createWorkerTransport(loopbackBase: string, fetcher: typeof fetch = capturedFetch) {
  const base = new URL(loopbackBase);
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname)
    || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Worker fixture requires an explicit loopback HTTP origin.');
  }
  const restrictedFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), base);
    if (url.origin !== base.origin || url.username || url.password) {
      throw new Error('Worker fixture forbids requests outside its configured API origin.');
    }
    // Redirect rejection prevents sending fixture tokens to a second destination.
    // Headers/method/body remain intact so the browser performs real CORS preflights.
    const request = new Request(input instanceof Request ? input : url, {
      ...init, credentials: 'omit', redirect: 'error', mode: 'cors',
    });
    return fetcher(request);
  };
  const response = await restrictedFetch(new URL('/__fixture/session', base));
  if (!response.ok) throw new Error('Synthetic Worker session is unavailable.');
  const session: unknown = await response.json();
  if (!session || typeof session !== 'object' || !('synthetic' in session) || session.synthetic !== true
    || !('accounts' in session) || !Array.isArray(session.accounts) || session.accounts.length !== 2) {
    throw new Error('Invalid synthetic Worker session.');
  }
  const tokens = new Map<string, string>();
  for (const account of session.accounts) {
    if (!account || typeof account !== 'object' || !allowedSubjects.has(account.subject)
      || tokens.has(account.subject) || typeof account.token !== 'string'
      || !account.token || account.token.length > 16384) {
      throw new Error('Invalid synthetic Worker account.');
    }
    tokens.set(account.subject, account.token);
  }
  return {
    subjects: [...tokens.keys()],
    getToken: async (subject: string): Promise<string | null> => tokens.get(subject) ?? null,
    fetch: restrictedFetch,
  };
}
