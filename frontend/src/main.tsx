import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global Fetch Interceptor to support dynamic backend server URLs
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  }
  
  // If request is directed to relative API or uploads paths, rewrite if configured
  if (url.startsWith('/api') || url.startsWith('/uploads')) {
    const customBase = localStorage.getItem('CYRIX_API_URL') || '';
    if (customBase) {
      const baseClean = customBase.endsWith('/') ? customBase.slice(0, -1) : customBase;
      const newUrl = `${baseClean}${url}`;
      
      if (input instanceof Request) {
        // Clone request with new URL
        input = new Request(newUrl, {
          method: input.method,
          headers: input.headers,
          body: input.body,
          mode: input.mode,
          credentials: input.credentials,
          cache: input.cache,
          redirect: input.redirect,
          referrer: input.referrer,
          integrity: input.integrity,
          keepalive: input.keepalive,
          signal: input.signal
        });
      } else {
        input = newUrl;
      }
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
