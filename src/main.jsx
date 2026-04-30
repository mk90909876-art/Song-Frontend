import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Aggressively unregister service workers in Vite dev mode to prevent
    // stale chunks from breaking React Fast Refresh (Invalid Hook Call)
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let r of registrations) r.unregister();
    });
  } else {
    // Register PWA service worker in production builds
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  }
}

createRoot(document.getElementById('root')).render(
  <App />
)