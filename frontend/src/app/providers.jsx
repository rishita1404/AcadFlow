import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthContext.jsx';
import { ToastContainer } from '../components/ui/Toast.jsx';
import { ConfirmDialogHost } from '../components/ui/ConfirmDialog.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
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
