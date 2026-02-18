/**
 * ============================================
 * ALLTECH - Service Worker
 * PWA Offline Support & Caching Strategy
 * ============================================
 */

const CACHE_NAME = 'alltech-support-v1';
const STATIC_CACHE = 'alltech-static-v1';
const DYNAMIC_CACHE = 'alltech-dynamic-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CSS
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/modal.css',
  '/css/forms.css',
  '/css/modules.css',
  '/css/modules-tabs.css',
  '/css/permissions.css',
  '/css/report-editor.css',
  '/css/responsive-optimization.css',
  '/css/welcome-animations.css',
  '/css/pwa.css',
  // JS Core
  '/js/device-detection.js',
  '/js/services/state.js',
  '/js/config/supabase.js',
  '/js/services/supabase-data-service.js',
  '/js/services/data-service.js',
  '/js/services/log-service.js',
  '/js/services/whatsapp-service.js',
  '/js/services/email-service.js',
  '/js/services/session-sync.js',
  '/js/icons.js',
  '/js/app.js',
  '/js/welcome-module.js',
  '/js/pwa-manager.js',
  // JS Modules
  '/js/modules/login-module.js',
  '/js/modules/clientes.js',
  '/js/modules/contratos.js',
  '/js/modules/contract-editor-module.js',
  '/js/modules/visitas.js',
  '/js/modules/equipos.js',
  '/js/modules/software.js',
  '/js/modules/calendario.js',
  '/js/modules/reportes.js',
  '/js/modules/config-module.js',
  '/js/modules/productos.js',
  '/js/modules/proformas.js',
  '/js/modules/report-editor.js',
  // Assets
  '/assets/logo.png'
];

// External resources to cache when available
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// ===== LIFECYCLE EVENTS =====

// Install: Cache essential assets
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Pre-caching assets...');
        return cache.addAll(PRECACHE_ASSETS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.warn('⚠️ Some assets failed to cache:', err);
          // Continue with available assets
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('✅ Service Worker: Pre-cache complete');
        return self.skipWaiting();
      })
  );
});

// Activate: Clean old caches and claim clients
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map(name => {
              console.log('🗑️ Service Worker: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activated and claiming clients');
        return self.clients.claim();
      })
  );
});

// ===== FETCH STRATEGY =====

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip WebSocket and Supabase API requests (always network)
  if (url.protocol === 'wss:' ||
    url.hostname.includes('supabase') ||
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/')) {
    return;
  }

  // Strategy: Stale-While-Revalidate for HTML and JS
  if (request.destination === 'document' ||
    request.destination === 'script' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Strategy: Cache-First for static assets (CSS, images, fonts)
  if (request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy: Network-First for everything else
  event.respondWith(networkFirst(request));
});

// ===== CACHING STRATEGIES =====

/**
 * Cache-First: Return cached version, or fetch and cache
 * Best for: Static assets that rarely change
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('📴 Cache-First fallback failed:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-First: Try network, fallback to cache
 * Best for: Dynamic content
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    console.warn('📴 Network-First: No cache available:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: Return cached immediately, update in background
 * Best for: Frequently updated assets where speed matters
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await caches.match(request);

  // Fetch in background
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('📴 Stale-While-Revalidate: Network failed:', error);
      return cachedResponse || new Response('Offline', { status: 503 });
    });

  // Return cached immediately if available, else wait for network
  return cachedResponse || fetchPromise;
}

// ===== BACKGROUND SYNC =====

self.addEventListener('sync', event => {
  console.log('🔄 Background Sync triggered:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // This would sync any pending offline changes when back online
  console.log('📤 Syncing pending data...');
  // Implementation depends on how offline data is stored
}

// ===== PUSH NOTIFICATIONS =====

// ===== PUSH NOTIFICATIONS =====

self.addEventListener('push', event => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nueva Notificación', body: event.data.text() };
    }
  } else {
    data = { title: 'ALLTECH', body: 'Tienes una nueva notificación' };
  }

  const options = {
    body: data.body || 'Nuevo mensaje del sistema',
    icon: data.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    tag: data.tag || 'generic-notification',
    renotify: data.tag ? true : false,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ALLTECH', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // If URL matches base origin, focus it and navigate
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            // Send message to app to navigate internally if possible
            if (urlToOpen !== '/') {
              client.postMessage({
                type: 'NAVIGATE_TO',
                module: urlToOpen.replace('/', '').replace('#', '')
              });
            }
            return;
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ===== MESSAGE HANDLING =====

self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_NAME });
      break;

    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;

    default:
      console.log('📨 Unknown message:', type);
  }
});

console.log('✅ Service Worker: Script loaded');
