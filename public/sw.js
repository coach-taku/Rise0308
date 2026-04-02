// Service Worker - RISE NOTE PWA対応
const CACHE_NAME = 'rise-note-v1';

// キャッシュするリソースの一覧
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// インストール時：主要リソースをキャッシュに保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // 新しいService Workerをすぐに有効化
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // すべてのクライアントを即座に制御
  self.clients.claim();
});

// フェッチ時：ネットワーク優先、失敗時はキャッシュにフォールバック
self.addEventListener('fetch', (event) => {
  // GETリクエスト以外はスキップ
  if (event.request.method !== 'GET') return;

  // chrome-extension や Supabase API などの外部リクエストはスキップ
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 正常なレスポンスをキャッシュに保存（コピーして保存）
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // ネットワークエラー時はキャッシュを返す
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // キャッシュにもない場合はオフライン画面を返す
          if (event.request.destination === 'document') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});
