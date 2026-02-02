import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../services/api';

export function useApi() {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setTokenGetter(getToken);
  }, [getToken]);

  return api;
}
