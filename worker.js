/**
 * 🛡️ OCTA-MGMT — وسيط آمن لتقرير الزوار
 * ─────────────────────────────────────────────
 * 🎯 الهدف: يوصّل الداتا الحية للمتصفح من غير ما يسرّب توكن الأدمن.
 *
 * ⛔ ليه Worker أصلاً؟  ←  CORS في الباك مقفول على أي أصل غريب،
 *    فالمتصفح مش هيقدر ينادي /api/admin/* مباشرة من دومين تاني.
 *    ⇒ السيرفر (الـWorker) هو اللي بينادي Railway ويضيف التوكن.
 *
 * 🔐 طبقتان:
 *   ١) تسجيل دخول بكلمة مرور ⇒ كوكي موقّع (HttpOnly + Secure + SameSite=Strict)
 *   ٢) التوكن نفسه ما بيوصلش المتصفح أبداً — بيفضل جوه الـWorker.
 *
 * 📡 المسارات:
 *   POST /api/login      {password}      ⇒ كوكي جلسة
 *   POST /api/logout                     ⇒ مسح الكوكي
 *   GET  /api/session                    ⇒ {ok:true} أو 401
 *   GET  /api/proxy?path=/api/admin/x   ⇒ تمرير للـRailway مع التوكن
 *   GET  /api/health                     ⇒ حالة الوسيط
 *   *                                    ⇒ الملفات الثابتة (PWA)
 */

const ORIGIN = "https://octa-prices-production-4ccb.up.railway.app";
const COOKIE = "octa_mgmt_sess";
const SESSION_TTL = 60 * 60 * 24 * 30; // ٣٠ يوم

/* ── أدوات ── */
const enc = new TextEncoder();

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

async function sign(payload, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseCookies(req) {
  const out = {};
  (req.headers.get("Cookie") || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

/* ── كوكي الجلسة ── */
async function makeSession(secret) {
  const exp = String(Date.now() + SESSION_TTL * 1000);
  const sig = await sign(exp, secret);
  return `${exp}.${sig}`;
}

async function validSession(req, secret) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (Number(exp) < Date.now()) return false;
  const expect = await sign(exp, secret);
  return timingSafeEqual(sig, expect);
}

/* ── محدّد محاولات الدخول (حماية من التخمين) ── */
const attempts = new Map();
function tooMany(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.t > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return rec.n >= 8;
}
function noteFail(ip) {
  const rec = attempts.get(ip) || { n: 0, t: Date.now() };
  rec.n += 1; rec.t = Date.now();
  attempts.set(ip, rec);
}

/* ── تمرير الطلب للـRailway ── */
async function proxyToRailway(path, token) {
  const url = ORIGIN + path;
  const res = await fetch(url, {
    headers: { "X-OCTA-Admin": token, "Accept": "application/json" },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    /* ═══ API ═══ */
    if (path.startsWith("/api/")) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";

      /* ── تسجيل الدخول ── */
      if (path === "/api/login" && request.method === "POST") {
        if (tooMany(ip)) {
          return json({ ok: false, error: "محاولات كتير. استنى ١٥ دقيقة." }, 429);
        }
        let body = {};
        try { body = await request.json(); } catch (e) { /* body فاضي */ }
        const pass = String(body.password || "");
        const want = String(env.APP_PASSWORD || "");
        if (!want) return json({ ok: false, error: "التطبيق مش مهيّأ" }, 500);
        const ok = timingSafeEqual(await sha256(pass), await sha256(want));
        if (!ok) {
          noteFail(ip);
          return json({ ok: false, error: "كلمة المرور غلط" }, 401);
        }
        attempts.delete(ip);
        const sess = await makeSession(env.SESSION_SECRET);
        return json({ ok: true }, 200, {
          "Set-Cookie": `${COOKIE}=${encodeURIComponent(sess)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`,
        });
      }

      /* ── خروج ── */
      if (path === "/api/logout" && request.method === "POST") {
        return json({ ok: true }, 200, {
          "Set-Cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
        });
      }

      /* ── حالة الجلسة ── */
      if (path === "/api/session") {
        const ok = await validSession(request, env.SESSION_SECRET);
        return json(ok ? { ok: true, ts: Date.now() } : { ok: false }, ok ? 200 : 401);
      }

      /* ── حالة الوسيط ── */
      if (path === "/api/health") {
        return json({
          ok: true, service: "octa-mgmt",
          upstream: ORIGIN,
          has_admin: !!env.OCTA_ADMIN_TOKEN,
          has_password: !!env.APP_PASSWORD,
        });
      }

      /* ── التمرير ── */
      if (path === "/api/proxy") {
        const authed = await validSession(request, env.SESSION_SECRET);
        if (!authed) return json({ ok: false, error: "لازم تسجيل دخول" }, 401);
        const target = url.searchParams.get("path") || "";
        // ⛔ منع الـSSRF — المسارات المسموحة بس
        if (!/^\/api\/admin\/[a-zA-Z0-9_\/<>-]*$/.test(target)) {
          return json({ ok: false, error: "مسار غير مسموح" }, 400);
        }
        if (!env.OCTA_ADMIN_TOKEN) return json({ ok: false, error: "التوكن غير مهيّأ" }, 500);
        try {
          const up = await proxyToRailway(target, env.OCTA_ADMIN_TOKEN);
          /* ⛔ المسار لسه مش موجود على السيرفر ⇒ 204 (مش خطأ — ميزة مستقبلية) */
          if (up.status === 404 || up.status === 405) {
            return new Response("", { status: 204, headers: { "X-OCTA-Missing": "1" } });
          }
          return up;
        } catch (e) {
          return json({ ok: false, error: "تعذّر الوصول للسيرفر: " + String(e && e.message || e) }, 502);
        }
      }

      return json({ ok: false, error: "مسار غير معروف" }, 404);
    }

    /* ═══ الملفات الثابتة (PWA) ═══ */
    /* ⛔ لازم يبقى index.html للروابط الداخلية (SPA) */
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404 && request.method === "GET" &&
        !url.pathname.includes(".") && !url.pathname.startsWith("/api/")) {
      const shell = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
      if (shell && shell.status < 400) return shell;
    }
    return res;
  },
};
