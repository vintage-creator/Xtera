const CACHE_NAME = "Xtera-cache-v4";
const urlsToCache = [
  "./",
  "./index.html",
  "./assets/css/style.css",
  "./assets/images/logo.svg",
  "./assets/images/about-banner.png",
  "./assets/images/appstore.png",
  "./assets/images/chart-1.svg",
  "./assets/images/chart-2.svg",
  "./assets/images/coin-1.svg",
  "./assets/images/coin-2.svg",
  "./assets/images/coin-3.svg",
  "./assets/images/coin-4.svg",
  "./assets/images/coin-5.svg",
  "./assets/images/coin-6.svg",
  "./assets/images/coin-7.svg",
  "./assets/images/coin-8.svg",
  "./assets/images/connect-line.png",
  "./assets/images/eth.png",
  "./assets/images/googleplay.png",  
  "./assets/images/hero-banner.png",  
  "./assets/images/instruction-1.png",
  "./assets/images/instruction-2.png",  
  "./assets/images/instruction-3.png",  
  "./assets/images/instruction-4.png",
  "./assets/images/logo-192.png",  
  "./assets/images/logo-512.png",                                                                               
  "./assets/images/metamask.webp",
  "./assets/images/phantom.png",
  "./assets/images/sol.jpg",
  "./assets/js/script.js",
  "./assets/js/buyCrypto.js",
  "./assets/js/sellCrypto.js",
  "./assets/js/swapCrypto.js", 
  "./assets/js/util.js", 
  "./assets/js/wallet.js", 
  "./server.js",
  "./favicon.svg"
];

// Install and cache
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate and delete old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); 
          }
        })
      );
    })
  );
  self.clients.claim(); 
});

// Intercept fetches
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Send a message to the page when an update is available
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});