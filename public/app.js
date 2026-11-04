/* ══════════════════════════════════════════════════════════════
   🛡️ OCTA-MGMT — طبقة التطبيق (PWA)
   ──────────────────────────────────────────────────────────────
   ⛔ كل الكلام ده شغّال في المتصفح بس.
   ⛔ توكن الأدمن ما بيوصلش هنا — كل طلب بيروح للـWorker وهو
      بيضيف التوكن في السيرفر. المتصفح بيسأل بس.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var API = '/api/proxy?path=';
  var LS_SNAP = 'octa_mgmt_snapshot';
  var LS_PREF = 'octa_mgmt_prefs';
  var SW_URL = '/sw.js';

  var state = {
    ready: false,
    timer: null,
    interval: 300000,   // ٥ دقايق
    countdown: 0,
    offline: !navigator.onLine,
    lastSync: 0,
    swReg: null,
    deferredPrompt: null,
    busy: false
  };

  /* ══ أدوات ══ */
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function toast(msg, kind, ms) {
    var box = $('#toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || 'ok');
    t.innerHTML = msg;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, ms || 3800);
    setTimeout(function () { t.remove(); }, (ms || 3800) + 400);
  }
  function setStatus(m, kind) {
    var s = $('#st'); if (!s) return;
    s.textContent = m; s.className = 'status ' + (kind || '');
  }
  function fmtAgo(ts) {
    if (!ts) return 'لم يتم';
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'الآن';
    if (s < 3600) return 'منذ ' + Math.floor(s / 60) + ' د';
    if (s < 86400) return 'منذ ' + Math.floor(s / 3600) + ' س';
    return 'منذ ' + Math.floor(s / 86400) + ' يوم';
  }

  /* ══ لقطة محلية (تشتغل أوفلاين) ══ */
  function saveSnap() {
    try { localStorage.setItem(LS_SNAP, JSON.stringify({ ts: Date.now(), data: window.D })); } catch (e) { }
  }
  function loadSnap() {
    try {
      var raw = localStorage.getItem(LS_SNAP);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  /* ══ الشبكة ══ */
  function pullRemote(path) {
    return fetch(API + encodeURIComponent(path), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { showLogin(); throw new Error('انتهت الجلسة'); }
        if (r.status === 204) return null;   /* ⛔ 204 = المسار لسه مش مفعّل */
        if (!r.ok) throw new Error(path + ' → HTTP ' + r.status);
        return r.json();
      });
  }

  /* ══ جلب الداتا ══ */
  function pull(silent) {
    if (state.busy) return Promise.resolve();
    state.busy = true;
    if (!silent) setStatus('جاري التحديث…', '');
    var jobs = [
      pullRemote('/api/admin/monthly'),
      pullRemote('/api/admin/users'),
      pullRemote('/api/admin/logins')
    ];
    /* ⛔ السجل الخام: مسار اختياري — لو مش موجود نتجاه ونمشي */
    if (!state.rawUnavailable) {
      jobs.push(pullRemote('/api/admin/events').then(function (v) { if (v === null) state.rawUnavailable = true; return v; }).catch(function () { state.rawUnavailable = true; return null; }));
    }
    return Promise.all(jobs).then(function (r) {
      if (typeof window.merge === 'function') {
        window.D = window.merge(r[0], r[1], r[2]);
      }
      if (r[3] && r[3].events) {
        window.D.raw_events = r[3].events;
        window.D.raw_n = r[3].n || r[3].events.length;
      }
      if (typeof window.renderAll === 'function') window.renderAll();
      state.lastSync = Date.now();
      saveSnap();
      paintLive();
      setStatus('آخر تحديث ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }), 'ok');
      if (!silent) toast('✅ تم التحديث', 'ok');
      return true;
    }).catch(function (e) {
      setStatus('تعذّر التحديث: ' + e.message, 'err');
      if (!silent) toast('⚠️ ' + e.message, 'err');
      return false;
    }).then(function (r) { state.busy = false; return r; });
  }

  /* ══ حالة الاتصال ══ */
  function paintLive() {
    var b = $('#bLive');
    if (!b) return;
    if (state.offline) {
      b.className = 'badge off';
      b.innerHTML = '<span class="dot"></span> أوفلاين — بيانات محفوظة';
    } else if (state.lastSync) {
      b.className = 'badge live';
      b.innerHTML = '<span class="dot"></span> متصل · ' + fmtAgo(state.lastSync);
    } else {
      b.className = 'badge off';
      b.innerHTML = '<span class="dot"></span> غير متصل';
    }
    var c = $('#countdown');
    if (c) {
      c.textContent = state.interval > 0 && state.lastSync
        ? 'تحديث بعد ' + Math.max(0, Math.round((state.interval - (Date.now() - state.lastSync)) / 1000)) + ' ث'
        : 'التحديث التلقائي متوقف';
    }
    var l = $('#lastSync');
    if (l) l.textContent = state.lastSync ? fmtAgo(state.lastSync) : 'لم يتم';
  }

  /* ══ التحديث التلقائي ══ */
  function startTimer() {
    if (state.timer) clearInterval(state.timer);
    if (!state.interval) { paintLive(); return; }
    state.timer = setInterval(function () {
      if (document.visibilityState === 'visible' && !state.offline) pull(true);
      else paintLive();
    }, 1000);
  }
  function tick() {
    var c = $('#countdown');
    if (c && state.interval && state.lastSync) {
      var left = Math.max(0, Math.round((state.interval - (Date.now() - state.lastSync)) / 1000));
      c.textContent = 'تحديث بعد ' + left + ' ث';
    }
  }
  setInterval(tick, 1000);

  /* ══ تسجيل الدخول ══ */
  function showLogin(msg) {
    var l = $('#login');
    if (!l) return;
    l.classList.add('on');
    $('#loginMsg').textContent = msg || '';
    var i = $('#pw'); if (i) setTimeout(function () { i.focus(); }, 120);
  }
  function hideLogin() {
    var l = $('#login'); if (l) l.classList.remove('on');
  }
  function doLogin(e) {
    e.preventDefault();
    var pw = $('#pw').value;
    var b = $('#loginBtn');
    b.disabled = true; b.textContent = 'جارٍ الدخول…';
    fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }), credentials: 'same-origin'
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          $('#loginMsg').textContent = res.j.error || 'كلمة المرور غلط';
          $('#pw').value = ''; $('#pw').focus();
          b.disabled = false; b.textContent = 'دخول';
          return;
        }
        hideLogin();
        closeSettings();
        b.disabled = false; b.textContent = 'دخول';
        toast('✅ تم تسجيل الدخول', 'ok');
        boot2();
      }).catch(function (e2) {
        $('#loginMsg').textContent = 'خطأ: ' + e2.message;
        b.disabled = false; b.textContent = 'دخول';
      });
  }
  function doLogout() {
    fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
      .then(function () { location.reload(); });
  }

  /* ══ الإعدادات ══ */
  function openSettings() {
    var p = $('#settings'); if (p) p.classList.add('on');
    var sel = $('#setInterval');
    if (sel) sel.value = String(state.interval);
    var ls = $('#lastSync2');
    if (ls) ls.textContent = state.lastSync ? fmtAgo(state.lastSync) : 'لم يتم';
    var sw = $('#swState');
    if (sw) {
      sw.textContent = state.swReg
        ? (state.swReg.active ? 'مثبّت · ' + (state.swReg.active.scriptURL || '') : 'قيد التثبيت')
        : 'غير مثبّت';
    }
    var st = $('#storeState');
    if (st) {
      try { st.textContent = Math.round((localStorage.getItem(LS_SNAP) || '').length / 1024) + ' كيلوبايت'; }
      catch (e) { st.textContent = '—'; }
    }
  }
  function closeSettings() {
    var p = $('#settings'); if (p) p.classList.remove('on');
  }
  function setIntervalMs(ms) {
    state.interval = ms;
    try { localStorage.setItem(LS_PREF, JSON.stringify({ interval: ms })); } catch (e) { }
    var sel = $('#setInterval'); if (sel) sel.value = String(ms);
    startTimer(); paintLive();
    toast(ms ? 'التحديث كل ' + (ms / 60000) + ' دقيقة' : 'التحديث التلقائي متوقف', 'ok');
  }

  /* ══ تصدير كل حاجة ══ */
  function exportAll() {
    var d = window.D; if (!d) return;
    var blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'octa-visitors-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    toast('📦 تم تصدير البيانات', 'ok');
  }

  /* ══ Service Worker ══ */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(SW_URL).then(function (reg) {
      state.swReg = reg;
      /* ⛔ لو فيه نسخة جديدة ⇒ اعرض تنبيه */
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('🔄 فيه تحديث جديد — <button id="doUpd" style="margin-inline-start:8px;background:#d4af37;color:#081521;border:0;border-radius:6px;padding:3px 9px;font-weight:800;cursor:pointer">تحديث دلوقتي</button>', 'warn', 12000);
            var b = document.getElementById('doUpd');
            if (b) b.onclick = function () {
              nw.postMessage({ type: 'SKIP_WAITING' });
              location.reload();
            };
          }
        });
      });
      /* ⛔ فحص دوري للتحديثات */
      setInterval(function () { reg.update().catch(function () { }); }, 30 * 60 * 1000);
    }).catch(function () { });
  }
  function checkUpdate() {
    if (!state.swReg) { toast('التطبيق مش مثبّت كـPWA بعد', 'warn'); return; }
    state.swReg.update().then(function () { toast('✅ اتفحص — التحديث بيظهر لو موجود', 'ok'); })
      .catch(function () { toast('⚠️ مقدرناش نفحص', 'err'); });
  }

  /* ══ التثبيت ══ */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    state.deferredPrompt = e;
    var b = $('#installBtn');
    if (b) { b.style.display = 'inline-flex'; b.disabled = false; }
  });
  function doInstall() {
    if (!state.deferredPrompt) {
      showInstallHelp();
      return;
    }
    state.deferredPrompt.prompt();
    state.deferredPrompt.userChoice.then(function (c) {
      if (c.outcome === 'accepted') toast('✅ تم تثبيت التطبيق', 'ok');
      state.deferredPrompt = null;
      var b = $('#installBtn'); if (b) b.style.display = 'none';
    });
  }
  function showInstallHelp() {
    var m = $('#installModal');
    if (m) m.classList.add('on');
  }

  /* ══ الإقلاع ══ */
  /* ⛔ أوفلاين: لو فيه لقطة محفوظة ⇒ اعرضها بدل ما تطلب دخول */
  function maybeOffline() {
    var snap = loadSnap();
    if (snap && snap.data) {
      state.offline = true;
      boot2(true);
      toast('📴 أوفلاين — بتعرض آخر نسخة محفوظة على جهازك', 'warn', 6000);
      setStatus('أوفلاين — آخر نسخة محفوظة', '');
    } else {
      showLogin('اكتب كلمة المرور');
    }
  }

  function boot2(offlineMode) {
    if (state.ready) return;
    state.ready = true;
    document.body.classList.add('ready');
    var snap = loadSnap();
    if (snap && snap.data) {
      window.D = snap.data;
      if (typeof window.renderAll === 'function') window.renderAll();
      state.lastSync = snap.ts || 0;
      if (!offlineMode) toast('📦 لقطة محفوظة (' + fmtAgo(state.lastSync) + ') — جاري التحديث', 'warn', 5000);
    }
    if (!offlineMode) {
      pull(true).then(function () { if (snap) toast('✅ اتحدّثت من السيرفر', 'ok'); });
    }
    startTimer();
    paintLive();
  }

  function boot() {
    /* التفضيلات */
    try {
      var p = JSON.parse(localStorage.getItem(LS_PREF) || '{}');
      if (p.interval !== undefined) state.interval = p.interval;
    } catch (e) { }

    /* الاتصال */
    window.addEventListener('online', function () { state.offline = false; paintLive(); pull(true); });
    window.addEventListener('offline', function () { state.offline = true; paintLive(); });

    /* التركيز ⇒ تحديث */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        paintLive();
        if (state.lastSync && Date.now() - state.lastSync > state.interval) pull(true);
      }
    });

    /* فحص الجلسة */
    fetch('/api/session', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? boot2() : maybeOffline(); })
      .catch(function () { maybeOffline(); });

    registerSW();

    /* ربط الأزرار — ⛔ كل زر ليه معالج واحد محدد (مفيش fallback عام) */
    var bind = [
      ['#loginForm', 'submit', doLogin],
      ['#loginBtn', 'click', function (e) { doLogin(e); }],
      ['#installBtn', 'click', doInstall],
      ['#installHelpBtn', 'click', showInstallHelp],
      ['#settingsBtn', 'click', openSettings],
      ['#navSettings', 'click', openSettings],
      ['#closeSettings', 'click', closeSettings],
      ['#closeInstall', 'click', function () { $('#installModal').classList.remove('on'); }],
      ['#refreshBtn', 'click', function () { pull(false); }],
      ['#navRefresh', 'click', function () { pull(false); }],
      ['#logoutBtn', 'click', doLogout],
      ['#exportAllBtn', 'click', exportAll],
      ['#checkUpdBtn', 'click', checkUpdate],
      ['#clearCacheBtn', 'click', function () {
        try { localStorage.removeItem(LS_SNAP); } catch (e) { }
        toast('🗑️ اتمسحت اللقطة المحلية', 'ok');
        pull(false);
      }],
      ['#setInterval', 'change', function () { setIntervalMs(Number(this.value)); }]
    ];
    bind.forEach(function (b) {
      var el = $(b[0]); if (!el) return;
      el.addEventListener(b[1], b[2]);
    });

    /* ⛔ Enter في خانة كلمة المرور */
    var pw = $('#pw');
    if (pw) pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(e); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.pull = pull;
    boot();
  });
})();
