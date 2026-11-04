#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🔧 تحوّل داشبورد الزوار إلى تطبيق PWA كامل"""
import re, os

SRC = "/workspace/output/octa-visitors-dashboard.html"
DST = "/workspace/mgmt/public/index.html"

s = open(SRC, encoding="utf-8").read()

# ═══ ١) head: manifest + metas ═══
s = s.replace(
'<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">',
'''<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#081521">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="OCTA">
<link rel="icon" href="/icons/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/icons/icon-192.png">''')

# ═══ ٢) CSS جديد ═══
NEW_CSS = """
/* ═══ طبقة التطبيق (PWA) ═══ */
#login{position:fixed;inset:0;z-index:200;display:none;place-items:center;
  background:radial-gradient(900px 600px at 50% -10%,#123049 0%,transparent 60%),rgba(4,10,17,.96);
  backdrop-filter:blur(8px);padding:22px}
#login.on{display:grid}
.login-card{width:100%;max-width:400px;background:linear-gradient(160deg,var(--card2),var(--card));
  border:1px solid var(--line2);border-radius:20px;padding:32px 28px;text-align:center;
  box-shadow:0 24px 70px rgba(0,0,0,.55)}
.login-card .lg{width:62px;height:62px;border-radius:17px;margin:0 auto 16px;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--gold),#8a6d12);color:#081521;font-weight:900;font-size:23px;
  box-shadow:0 8px 26px rgba(212,175,55,.3)}
.login-card h3{font-size:19px;font-weight:900;margin-bottom:6px}
.login-card .sb{color:var(--dim);font-size:12.5px;margin-bottom:20px;font-weight:600}
.login-card input{width:100%;background:var(--bg);border:1px solid var(--line2);color:var(--txt);
  border-radius:12px;padding:13px 15px;font-family:inherit;font-size:15px;outline:none;text-align:center;
  letter-spacing:2px;margin-bottom:12px}
.login-card input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(212,175,55,.12)}
.login-card button{width:100%;padding:13px;font-size:15px}
.login-card .msg{color:#f87171;font-size:12.5px;font-weight:700;min-height:20px;margin-top:8px}
.login-card .tip{color:var(--dim2);font-size:11.5px;margin-top:14px;line-height:1.7}

#toasts{position:fixed;bottom:78px;right:18px;z-index:300;display:flex;flex-direction:column;gap:8px;max-width:380px}
.toast{background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:11px 15px;
  font-size:13px;font-weight:700;color:var(--txt);box-shadow:0 12px 34px rgba(0,0,0,.45);
  animation:tin .25s ease-out}
.toast.ok{border-color:rgba(22,199,154,.5)} .toast.warn{border-color:rgba(245,158,11,.5)}
.toast.err{border-color:rgba(239,68,68,.5)}
.toast.out{opacity:0;transform:translateX(30px);transition:.35s}
@keyframes tin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.modal{position:fixed;inset:0;background:rgba(3,10,18,.84);backdrop-filter:blur(6px);display:none;
  z-index:150;padding:22px;overflow-y:auto}
.modal.on{display:grid;place-items:center}
.modal-in{max-width:640px;width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:18px;padding:24px}
.set-row{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 0;
  border-bottom:1px solid rgba(29,58,88,.6)}
.set-row:last-of-type{border-bottom:0}
.set-row .lb{font-size:13.5px;font-weight:800}
.set-row .ds{color:var(--dim2);font-size:11.5px;font-weight:600;margin-top:2px}
.set-row select,.set-row input{background:var(--card);border:1px solid var(--line);color:var(--txt);
  border-radius:9px;padding:8px 11px;font-family:inherit;font-size:13px;outline:none;max-width:210px}
.set-row input[type=text]{text-align:center;direction:ltr}

#nav{position:fixed;bottom:0;right:0;left:0;z-index:120;background:rgba(10,25,41,.96);
  backdrop-filter:blur(14px);border-top:1px solid var(--line);display:none}
#nav .inner{display:flex;max-width:1500px;margin:0 auto;padding:8px 12px;gap:6px;overflow-x:auto}
#nav button{flex:1;min-width:78px;background:transparent;color:var(--dim);border:1px solid transparent;
  border-radius:12px;padding:9px 6px;font-size:11.5px;font-weight:800;flex-direction:column;gap:3px}
#nav button:hover,#nav button.on{color:var(--gold2);border-color:var(--line2);background:rgba(212,175,55,.07)}
#nav button .ic{font-size:17px;line-height:1}
@media(max-width:820px){#nav{display:block}body{padding-bottom:72px}#toasts{bottom:88px}}

.steps{counter-reset:s;margin:10px 0 0;padding:0;list-style:none}
.steps li{counter-increment:s;position:relative;padding:11px 40px 11px 0;margin-bottom:8px;
  background:var(--card);border:1px solid var(--line);border-radius:12px;font-size:13px}
.steps li::before{content:counter(s);position:absolute;right:12px;top:11px;width:21px;height:21px;
  border-radius:50%;display:grid;place-items:center;background:var(--gold);color:#081521;
  font-weight:900;font-size:11.5px}
.steps b{color:var(--gold2)}
"""
s = s.replace("</style>", NEW_CSS + "</style>")

# ═══ ٣) شريط الأدوات الجديد ═══
old_tb = '''    <div class="toolbar no-print">
      <input type="password" id="tok" placeholder="توكن الأدمن (X-OCTA-Admin)" style="min-width:250px">
      <button onclick="pull()">تحديث من السيرفر</button>
      <button class="ghost" onclick="dlUsers()">تصدير CSV · مستخدمين</button>
      <button class="ghost" onclick="dlTime()">تصدير CSV · الخط الزمني</button>
      <button class="ghost" onclick="window.print()">طباعة</button>
      <span class="status" id="st"></span>
    </div>
    <div class="toolbar no-print" style="padding-top:8px">
      <input type="file" id="fjson" accept=".json" style="max-width:250px" onchange="pasteFile(this)">
      <span class="hint">أو الصق JSONAdmin هنا:</span>
      <textarea id="pasteBox" rows="1" placeholder='{"users":[…],"timeline":[…]}' style="flex:1;min-width:260px;height:38px;resize:vertical;font-family:ui-monospace,monospace;font-size:11px"></textarea>
      <button class="ghost sm" onclick="pasteGo()">تطبيق</button>
    </div>'''
new_tb = '''    <div class="toolbar no-print">
      <button id="refreshBtn">🔄 تحديث دلوقتي</button>
      <button class="ghost" id="installBtn" style="display:none">📲 تثبيت التطبيق</button>
      <button class="ghost" id="installHelpBtn">📖 إزاي تثبّته</button>
      <button class="ghost" id="settingsBtn">⚙️ الإعدادات</button>
      <button class="ghost" onclick="dlUsers()">CSV · مستخدمين</button>
      <button class="ghost" onclick="dlTime()">CSV · الخط الزمني</button>
      <button class="ghost" onclick="window.print()">طباعة</button>
      <span class="status" id="st"></span>
    </div>
    <div class="toolbar no-print" style="padding-top:8px">
      <span class="hint">⏱ <span id="countdown">—</span></span>
      <span class="hint">· آخر مزامنة: <span id="lastSync">—</span></span>
      <span class="hint">· 💡 الداتا بتتحدّث لوحدها — مش محتاج تطلب</span>
    </div>'''
assert old_tb in s, "toolbar"
s = s.replace(old_tb, new_tb)

# ═══ ٤) ل-let ⇒ var عشان app.js يوصل للبيانات ═══
s = s.replace("let D = DATA, sortKey = 'hits', sortDir = -1, sortUsers = null;",
              "var D = DATA, sortKey = 'hits', sortDir = -1, sortUsers = null;")

# ═══ ٥) عناصر جديدة قبل </body> ═══
NEW_UI = '''
<!-- ═══ شاشة الدخول ═══ -->
<div id="login">
  <div class="login-card">
    <div class="lg">O</div>
    <h3>تقرير زوار OCTA</h3>
    <div class="sb">دخول عشان تشوف البيانات الحية</div>
    <form id="loginForm" autocomplete="off">
      <input type="password" id="pw" placeholder="كلمة المرور" autocomplete="current-password">
      <button type="submit" id="loginBtn">دخول</button>
    </form>
    <div class="msg" id="loginMsg"></div>
    <div class="tip">التطبيق بيفتح من غير نت برضه، وبيلفظ آخر نسخة من الداتا على جهازك.</div>
  </div>
</div>

<!-- ═══ الإعدادات ═══ -->
<div class="modal" id="settings" onclick="if(event.target===this)document.getElementById('settings').classList.remove('on')">
  <div class="modal-in">
    <div class="modal-hd">
      <h3>⚙️ الإعدادات</h3>
      <button class="x" id="closeSettings">×</button>
    </div>
    <div class="set-row">
      <div><div class="lb">التحديث التلقائي</div><div class="ds">كل قد إيه يعيد سحب الداتا من السيرفر</div></div>
      <select id="setInterval">
        <option value="0">مقفول (يدوي)</option>
        <option value="60000">كل دقيقة</option>
        <option value="300000">كل ٥ دقايق</option>
        <option value="900000">كل ١٥ دقيقة</option>
        <option value="3600000">كل ساعة</option>
      </select>
    </div>
    <div class="set-row">
      <div><div class="lb">آخر مزامنة</div><div class="ds">من آخر مرة اتجابت الداتا من السيرفر</div></div>
      <span class="hint" id="lastSync2">—</span>
    </div>
    <div class="set-row">
      <div><div class="lb">حالة التطبيق (PWA)</div><div class="ds">لو «مثبّت» يبقى بيشتغل أوفلاين ويحدّث نفسه</div></div>
      <span class="hint" id="swState">—</span>
    </div>
    <div class="set-row">
      <div><div class="lb">حجم اللقطة المحفوظة</div><div class="ds">البيانات الموجودة على جهازك (للاستخدام بدون نت)</div></div>
      <span class="hint" id="storeState">—</span>
    </div>
    <div class="set-row">
      <div><div class="lb">تثبيت نسخة جديدة</div><div class="ds">بيفحص لو فيه نسخة أحدث من الكاش</div></div>
      <button class="ghost sm" id="checkUpdBtn">فحص</button>
    </div>
    <div class="set-row">
      <div><div class="lb">تصدير كل الداتا</div><div class="ds">ملف JSON كامل (مستخدمين · خط زمني · أجهزة)</div></div>
      <button class="ghost sm" id="exportAllBtn">تصدير</button>
    </div>
    <div class="set-row">
      <div><div class="lb">مسح اللقطة المحلية</div><div class="ds">يمسح الكاش ويجيب داتا جديدة فوراً</div></div>
      <button class="ghost sm" id="clearCacheBtn">مسح</button>
    </div>
    <div class="set-row">
      <div><div class="lb">خروج</div><div class="ds">يسجّل خروجك من التطبيق</div></div>
      <button class="ghost sm" id="logoutBtn">خروج</button>
    </div>
    <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line)">
      <div class="lb" style="font-size:13.5px;font-weight:800;margin-bottom:8px">🔧 وضع يدوي (احتياطي)</div>
      <div class="hint" style="margin-bottom:8px">لو الـAPI واقع، الصق هنا ملف JSON محفوظ واستخدمه على طول.</div>
      <textarea id="pasteBox" rows="2" placeholder='{"users":[…],"timeline":[…]}' style="width:100%;background:var(--card);border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:9px 12px;font-family:ui-monospace,monospace;font-size:11px;resize:vertical"></textarea>
      <button class="ghost sm" style="margin-top:8px" onclick="pasteGo()">تطبيق</button>
    </div>
  </div>
</div>

<!-- ═══ مساعدة التثبيت ═══ -->
<div class="modal" id="installModal" onclick="if(event.target===this)document.getElementById('installModal').classList.remove('on')">
  <div class="modal-in">
    <div class="modal-hd">
      <h3>📲 تثبيت التطبيق على جهازك</h3>
      <button class="x" id="closeInstall">×</button>
    </div>
    <div style="font-size:13.5px;color:var(--dim);margin-bottom:14px;line-height:1.9">
      بعد التثبيت بيبقى زي أي أپلكيشن: أيقونة على الشاشة، يفتح بملء الشاشة، وبيشتغل من غير نت.
    </div>
    <div class="lb" style="font-size:13px;font-weight:800;margin-bottom:6px">🤖 على أندرويد / تاب (Chrome / Edge)</div>
    <ol class="steps">
      <li>افتح الرابط في المتصفح</li>
      <li>دوس على <b>⋮</b> أو <b>⋮⋮</b> فوق</li>
      <li>اختار <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></li>
      <li>أكّد التثبيت ✅</li>
    </ol>
    <div class="lb" style="font-size:13px;font-weight:800;margin:16px 0 6px">🍎 على آيفون / آيباد (Safari)</div>
    <ol class="steps">
      <li>افتح الرابط في <b>Safari</b></li>
      <li>دوس على زر <b>المشاركة</b> (⬆️)</li>
      <li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b></li>
      <li>أكّد ✅</li>
    </ol>
    <div class="lb" style="font-size:13px;font-weight:800;margin:16px 0 6px">💻 على كمبيوتر</div>
    <ol class="steps">
      <li>في Chrome: دوس على أيقونة <b>⊕</b> في شريط العنوان (يمين)</li>
      <li>أو من <b>⋮ → تثبيت</b></li>
    </ol>
    <div class="hint" style="margin-top:12px">💡 بعد التثبيت: افتحه من أيقونته، وسجّل دخول مرة واحدة، والباقي كله أوتوماتيك.</div>
  </div>
</div>

<div id="toasts"></div>

<!-- ═══ شريط التنقل السفلي (تاب/موبايل) ═══ -->
<nav id="nav">
  <div class="inner">
    <button onclick="document.querySelector('#kpis').scrollIntoView()"><span class="ic">📊</span>الملخص</button>
    <button onclick="document.querySelector('#tUsers').scrollIntoView()"><span class="ic">👥</span>مين دخل</button>
    <button onclick="document.querySelector('#tl').scrollIntoView()"><span class="ic">⏱</span>الخط الزمني</button>
    <button onclick="document.querySelector('#tDev').scrollIntoView()"><span class="ic">📱</span>الأجهزة</button>
    <button onclick="document.querySelector('#hchart').scrollIntoView()"><span class="ic">📈</span>السلوك</button>
    <button onclick="document.querySelector('#fun').scrollIntoView()"><span class="ic">🎯</span>القمع</button>
    <button onclick="document.querySelector('#gaps').scrollIntoView()"><span class="ic">🔧</span>الفجوات</button>
    <button id="navRefresh" onclick="pull(false)"><span class="ic">🔄</span>تحديث</button>
    <button id="navSettings" onclick="document.getElementById('settings').classList.add('on')"><span class="ic">⚙️</span>إعدادات</button>
  </div>
</nav>

<script src="/app.js"></script>
'''
s = s.replace("</body>", NEW_UI + "</body>")

# ═══ ٦) تنظيف: شيل live pull القديم من الـinline (يبقى app.js هو المسؤول) ═══
# pull() القديمة كانت بتنادي API مباشر — هنخليها تشتغل عن طريق app.js
s = s.replace("async function pull(){\n  const tok = $('#tok').value.trim();",
              "async function pull(){\n  if (window.__octaAppPull) return window.__octaAppPull();\n  const tok = $('#tok') ? $('#tok').value.trim() : '';")


# ═══ ٧) قسم السجل الخام ═══
SEC = """
<!-- ═══ ٨. السجل الخام ═══ -->
<section>
  <div class="sec-hd">
    <h2>٨. السجل الخام — كل حدث بالتوقيت</h2>
    <span class="note" id="rawHead">…</span>
  </div>
  <div class="card" id="rawBox"></div>
</section>

<!-- ═══ ٧. الفجوات ═══ -->"""
s = s.replace("<!-- ═══ ٧. الفجوات ═══ -->", SEC)

FN = """
/* ══ السجل الخام ══ */
function renderRaw(){
  const box = document.getElementById('rawBox');
  if (!box) return;
  const ev = (D.raw_events || []);
  const head = document.getElementById('rawHead');
  if (!ev.length){
    if (head) head.innerHTML = '<span class="pill y">لسه مش مفعّل</span>';
    box.innerHTML = '<p class="dim">المسار <code>/api/admin/events</code> لسه مش موجود على السيرفر. '
      + 'أول ما شات التطوير ينفّذه، التطبيق هيعرض السجل الخام هنا <b>تلقائياً</b> من غير أي تعديل — '
      + 'دلوقتي التقرير يقدر يقول «مين دخل إمتى»، وجي بتاع السجل الخام يقول «فتح أنهي صفحة قد إيه».</p>';
    return;
  }
  if (head) head.innerHTML = '<span class="pill g">' + (D.raw_n || ev.length) + ' حدث خام</span>';
  const rows = ev.slice().reverse().slice(0, 400).map(function (e) {
    const t = new Date((e.ts || 0) * 1000);
    const ts = t.toLocaleString('ar-EG', { hour12: false });
    const who = (D.users || []).filter(u => u.uid === e.u)[0];
    const evn = e.ev || e.event || '';
    const pg = e.p || e.page || '';
    const lb = e.l || e.label || '';
    return '<tr><td class="mono dim">' + esc(ts) + '</td>'
      + '<td>' + esc(who ? who.name : '—') + '</td>'
      + '<td><span class="pill n">' + esc(evn) + '</span></td>'
      + '<td class="mono">' + esc(pg) + '</td>'
      + '<td class="mono dim">' + esc(lb) + '</td></tr>';
  }).join('');
  box.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>الحدث</th>'
    + '<th>الصفحة</th><th>التفاصيل</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
"""
s = s.replace("/* ══ تشغيل ══ */", FN + "\n/* ══ تشغيل ══ */")
s = s.replace("renderFunnel(); renderGaps(); }", "renderFunnel(); renderGaps(); renderRaw(); }")

os.makedirs(os.path.dirname(DST), exist_ok=True)
open(DST, "w", encoding="utf-8").write(s)
print("✅ اتكتب:", DST, os.path.getsize(DST), "بايت")
