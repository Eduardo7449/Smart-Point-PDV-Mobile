// Define o nome do cache
const CACHE_NAME = 'smartpoint-pdv-cache-v1';

// Lista de arquivos para serem cacheados na instalação
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/pdv.html',
  '/login.html',
  '/dashboard.css',
  '/pdv.css',
  '/dashboard.js',
  '/pdv.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Evento de Instalação: Salva os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Responde com os arquivos do cache se estiverem disponíveis
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se o arquivo for encontrado no cache, retorna ele
        if (response) {
          return response;
        }
        // Senão, busca na rede
        return fetch(event.request);
      }
    )
  );
});