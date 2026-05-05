import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { CartProvider } from '@/hooks/useCart';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { SiteBrandingProvider } from '@/contexts/SiteBrandingContext';
import { MarketingContentProvider } from '@/contexts/MarketingContentContext';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <SiteBrandingProvider>
            <MarketingContentProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </MarketingContentProvider>
          </SiteBrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);