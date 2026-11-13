// Service worker: rende l'app utilizzabile offline. Cambia VERSION quando aggiorni i file.
const VERSION = 'expenses-v7';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
// all'installazione scarica sempre i file freschi, ignorando la cache del browser
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Google/Drive passano diretti
  // rete prima, chiedendo sempre al server se c'è una versione nuova (GitHub Pages altrimenti
  // lascia usare per 10 minuti la copia vecchia); se sei offline usa la copia salvata
  const fresh = new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(fetch(fresh).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
