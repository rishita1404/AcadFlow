import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/health/');
      return res.data;
    },
  });
}
