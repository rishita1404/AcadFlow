import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './app/router.jsx';
import { AppProviders } from './app/providers.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>
);
