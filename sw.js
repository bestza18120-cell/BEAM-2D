/* ================================================================
   Beam 2D — Service Worker
   ----------------------------------------------------------------
   ออก patch ใหม่: แก้ไฟล์แอปตามต้องการ แล้ว "เปลี่ยนเลข VERSION ด้านล่าง"
   ทุกครั้ง (ถ้าไม่เปลี่ยน เบราว์เซอร์ผู้ใช้จะไม่รู้ว่ามีเวอร์ชันใหม่)
   ================================================================ */
const VERSION = '1.6.0';
const CACHE = `beam2d-${VERSION}`;
const FONT_CACHE = 'beam2d-fonts';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  // โหลดไฟล์เวอร์ชันใหม่เก็บไว้ก่อน แต่ยังไม่สลับจนกว่าผู้ใช้กด "อัปเดต"
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('beam2d-') && k !== CACHE && k !== FONT_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'getVersion' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: stale-while-revalidate (ใช้ออฟไลน์ได้หลังเปิดครั้งแรก)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (c) => {
        const cached = await c.match(req);
        const network = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }).catch(() => cached || Response.error());
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ไฟล์ของแอป: cache-first จาก cache ของเวอร์ชันปัจจุบัน
  // (เวอร์ชันใหม่จะมาเมื่อ sw.js เปลี่ยน → ผู้ใช้เห็นแถบ "มีเวอร์ชันใหม่")
  event.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await c.match('./index.html');
        if (shell) return shell;
      }
      return fetch(req);
    })
  );
});
