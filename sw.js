/**
 * Service Worker for Quran App
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'quran-app-v2.0';
const RUNTIME_CACHE = 'quran-runtime-v2.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/app.js',
  '/manifest.json',
  '/logo.png',
  '/splash.png',
  '/favicon.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for allowed APIs)
  if (url.origin !== location.origin && !isAllowedAPI(url)) {
    return;
  }

  // Strategy: Network First for API calls, Cache First for static assets
  if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * Cache First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    console.log('[SW] Serving from cache:', request.url);
    return cached;
  }

  try {
    console.log('[SW] Fetching from network:', request.url);
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Network First Strategy
 * Try network first, fall back to cache
 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    console.log('[SW] Fetching API from network:', request.url);
    const response = await fetch(request);

    // Cache successful API responses
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

/**
 * Check if URL is an API request
 */
function isAPIRequest(url) {
  const apiDomains = [
    'api.quran.com',
    'api.aladhan.com',
    'cdn.jsdelivr.net',
    'api.bigdatacloud.net'
  ];

  return apiDomains.some(domain => url.hostname.includes(domain));
}

/**
 * Check if API is allowed
 */
function isAllowedAPI(url) {
  const allowedDomains = [
    'api.quran.com',
    'api.aladhan.com',
    'cdn.jsdelivr.net',
    'api.bigdatacloud.net',
    'server',
    '.mp3quran.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'raw.githubusercontent.com'
  ];

  return allowedDomains.some(domain => url.hostname.includes(domain));
}

/**
 * Background Sync for failed requests
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

async function syncFavorites() {
  try {
    // Sync logic here
    console.log('[SW] Syncing favorites...');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

/**
 * Push Notification handler
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const data = event.data ? event.data.json() : {};
  const title = data.title || 'حان وقت الصلاة';
  const options = {
    body: data.body || 'لا تفوت الصلاة',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

/**
 * Message handler from clients
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
