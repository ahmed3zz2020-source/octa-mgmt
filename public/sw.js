/* ══════════════════════════════════════════════════════════════
   🛡️ OCTA-MGMT — Service Worker
   ──────────────────────────────────────────────────────────────
   🎯 الهدف: التطبيق يبقى «زي الأپلكيشن» —
      يفتح فوراً حتى من غير نت، ويحدّث نفسه لوحده لما ينزل نسخة جديدة.
   ══════════════════════════════════════════════════════════════ */

const VERSION = 'octa-mgmt-v1.0.4';
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => c.add('/')))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ⛔ لما المستخدم يضغط «تحديث دلوقتي» */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ⛔ سلوك الشبكة:
   - ملفات التطبيق (shell): network-first مع fallback للـcache
     ⇒ نسخة جديدة بتتحدث، بس التطبيق بيفتح حتى من غير نت.
   - طلبات الـAPI: دايماً من الشبكة (البيانات لازم تبقى طازجة)
     والـcache بس احتياطي عند انقطاع النت. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* ⛔ الـAPI والـproxy: دايماً شبكة (مش بنخزّن بيانات حسّاسة) */
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ ok: false, error: 'مفيش اتصال — البيانات المعروضة محفوظة من قبل' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  /* ⛔ أي أصل تاني (Railway مثلاً) — من غير تدخل */
  if (!sameOrigin) return;

  /* ⛔ ملفات التطبيق: الشبكة الأول، فالـcache */
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && (req.mode === 'navigate' || SHELL.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => { });
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
