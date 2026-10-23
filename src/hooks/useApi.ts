import { api } from '../services/api';

// Authenticated routes mount only after ApiAuthBoundary initializes the client.
export function useApi() { return api; }
