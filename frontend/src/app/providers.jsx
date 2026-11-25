import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthContext.jsx';
import { ToastContainer } from '../components/ui/Toast.jsx';
import { ConfirmDialogHost } from '../components/ui/ConfirmDialog.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 3 * 60 * 1000, // Keep data fresh for 3 minutes for instant page navigation
      gcTime: 10 * 60 * 1000,    // Cache data for 10 minutes
    },
    mutations: {
      // Surface mutation errors as toasts via onError if not handled locally
    },
  },
});

export { queryClient };

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <ToastContainer />
        <ConfirmDialogHost />
      </AuthProvider>
    </QueryClientProvider>
  );
}
