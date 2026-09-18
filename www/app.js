(() => {
  const APP_VERSION = { code: 5, name: "1.4" };
  const HOST = "https://azkar-hisn-almuslim.vercel.app";
  const UPDATE_URL = HOST + "/version.json";
  const CONTENT_URL = HOST + "/content.json";

  // The bundled adhkar ship inside the app; a newer set downloaded earlier wins.
  const bundled = window.AZKAR;
  // Downloaded content is only used when it is complete; otherwise the app falls back to what it shipped with.
  const usable = (c) => !!c && Array.isArray(c.cats) && c.cats.length > 100 && c.cats.every((x) => x.id && x.t && Array.isArray(x.z) && x.z.length)
    && Array.isArray(c.groups) && c.groups.length && c.home && Array.isArray(c.home.quick) && c.home.quick.length
    && Array.isArray(c.home.greetings) && c.home.greetings.length && typeof c.v === "number";
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("content") || "null"); } catch {}
  if (saved && !(saved.v > bundled.v && usable(saved))) { saved = null; try { localStorage.removeItem("content"); } catch {} }
  const DATA = saved || bundled;
  const { groups, cats, home: homeCfg } = DATA;
  const hadiths = DATA.hadiths || { topics: [], items: [] };
  const hadithById = Object.fromEntries(hadiths.items.map((h) => [h.id, h]));
  const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
  const $ = (s) => document.querySelector(s);
  const view = $("#view");

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const today = () => new Date().toLocaleDateString("en-CA");
  const settings = Object.assign({ theme: "auto", fs: 22, vibrate: true, autoNext: true }, store.get("settings", {}));
  const saveSettings = () => { store.set("settings", settings); applySettings(); };
  let favs = store.get("favs", []); // "catId:index"
  let progress = store.get("progress", {});
  if (progress.day !== today()) progress = { day: today(), c: {} };
  const saveProgress = () => store.set("progress", progress);

  function applySettings() {
    const dark = settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.setProperty("--fs", settings.fs + "px");
    document.querySelector('meta[name="theme-color"]').content = dark ? "#12332b" : "#0f5f4f";
  }
  applySettings();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);

  // ---------- helpers ----------
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const plain = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  const buzz = (ms = 15) => settings.vibrate && navigator.vibrate && navigator.vibrate(ms);
  let toastT;
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); };
  const catDone = (c) => { const p = progress.c[c.id] || {}; return c.z.every((z, i) => (p[i] || 0) >= z[1]); };
  const catLink = (c) => `<a href="#/c/${c.id}">${catDone(c) ? '<span class="ok">✔</span>' : ""}${esc(c.t)}<span class="n">${arNum(c.z.length)}</span></a>`;

  function setHeader(title, back) {
    $("#title").textContent = title;
    $("#back").hidden = !back;
    $("#progress").hidden = true;
    document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === currentTab));
    window.scrollTo(0, 0);
  }
  $("#back").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/"));
  $("#themeBtn").onclick = () => {
    settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    saveSettings();
  };

  // ---------- views ----------
  let currentTab = "home";

  function home() {
    currentTab = "home"; setHeader("أذكار المسلم");
    const h = new Date().getHours();
    const g = homeCfg.greetings.find(([from, to]) => (from < to ? h >= from && h < to : h >= from || h < to)) || homeCfg.greetings[0];
    const s = [g[2], g[3], g[4]];
    const c = byId[s[2]];
    view.innerHTML = `
      <section class="hero"><small>${s[0]}</small><h2>${s[1]}</h2>
        <a class="btn" href="#/c/${c.id}">${catDone(c) ? "✔ أتممتها اليوم — اقرأ مجددًا" : "ابدأ الآن ←"}</a></section>
      <input class="search" id="q" type="search" placeholder="ابحث في الأذكار والأدعية…">
      <div id="results"></div>
      <div id="homeBody">
        <div class="quick">
          ${homeCfg.quick.map(([icon, label, id]) => `<a href="#/c/${id}"><span>${icon}</span>${esc(label)}</a>`).join("")}
          <a href="#/tasbih"><span>📿</span>السبحة</a>
          <a href="#/h"><span>📜</span>الأحاديث</a>
        </div>
        <h3 class="sec">الأقسام</h3>
        <div class="list">${groups.map((g) => `<a href="#/g/${g.k}"><span>${g.i}</span>${g.t}<span class="n">${arNum(g.ids.length)}</span></a>`).join("")}</div>
        <p class="credit"><a href="#/about">تطبيق غير ربحي · تطوير محمود هواري</a></p>
      </div>`;
    const q = $("#q");
    q.oninput = () => search(q.value.trim());
  }

  function search(q) {
    const res = $("#results"), body = $("#homeBody");
    if (q.length < 2) { res.innerHTML = ""; body.hidden = false; return; }
    body.hidden = true;
    const pq = plain(q);
    const hits = [];
    cats.forEach((c) => {
      if (plain(c.t).includes(pq)) hits.push(`<a href="#/c/${c.id}">📖 ${esc(c.t)}</a>`);
      c.z.forEach((z, i) => {
        const p = plain(z[0]);
        const at = p.indexOf(pq);
        if (at > -1 && hits.length < 60) hits.push(`<a href="#/c/${c.id}/${i}">${esc(p.slice(Math.max(0, at - 30), at + 60))}…<span class="n">${esc(c.t.slice(0, 18))}</span></a>`);
      });
    });
    hadiths.items.forEach((h) => {
      if (hits.length >= 80) return;
      const p = plain(h.t + " " + h.h);
      const at = p.indexOf(pq);
      if (at > -1) hits.push(`<a href="#/hd/${h.id}">📜 ${esc(h.t)}<span class="n">حديث</span></a>`);
    });
    res.innerHTML = hits.length ? `<div class="list">${hits.join("")}</div>` : `<p class="empty">لا توجد نتائج</p>`;
  }

  function allCats() {
    currentTab = "all"; setHeader("أبواب حصن المسلم");
    view.innerHTML = `<div class="list">${groups.map((g, gi) => `
      <details ${gi === 0 ? "open" : ""}><summary><span>${g.i}</span>${g.t}<span class="n">${arNum(g.ids.length)}</span></summary>
      <div class="list">${g.ids.map((id) => catLink(byId[id])).join("")}</div></details>`).join("")}</div>`;
  }

  function group(k) {
    const g = groups.find((x) => x.k === k);
    if (!g) return home();
    currentTab = "all"; setHeader(g.t, true);
    view.innerHTML = `<div class="list">${g.ids.map((id) => catLink(byId[id])).join("")}</div>`;
  }

  function category(id, focus) {
    const c = byId[id];
    if (!c) return home();
    currentTab = currentTab === "fav" ? "fav" : "all";
    setHeader(c.t, true);
    const p = (progress.c[c.id] ||= {});
    view.innerHTML = `
      <div class="tools"><button class="btn ghost" id="reset">↺ إعادة العداد</button></div>
      ${c.z.map((z, i) => zikrCard(c, i)).join("")}
      <div id="finish"></div>`;
    const bar = $("#progress");
    bar.hidden = false;
    const total = c.z.reduce((a, z) => a + z[1], 0);
    const update = () => {
      const done = c.z.reduce((a, z, i) => a + Math.min(p[i] || 0, z[1]), 0);
      bar.firstElementChild.style.width = (done / total) * 100 + "%";
      $("#finish").innerHTML = done >= total
        ? `<div class="finish"><div>🌿</div><h3>أتممت ${esc(c.t)}</h3><p>تقبّل الله منك</p><a class="btn" href="#/">الرئيسية</a></div>` : "";
    };
    update();

    view.onclick = (e) => {
      const card = e.target.closest(".zk");
      if (!card) return;
      const i = +card.dataset.i, z = c.z[i];
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "fav") return toggleFav(c.id, i, e.target.closest("button"));
      if (act === "copy") return copy(z[0]);
      if (act === "share") return share(z[0], c.t);
      if (!e.target.closest(".txt, .count")) return;
      if ((p[i] || 0) >= z[1]) return;
      p[i] = (p[i] || 0) + 1;
      saveProgress();
      paint(card, z, p[i]);
      card.classList.add("pulse"); setTimeout(() => card.classList.remove("pulse"), 120);
      if (p[i] >= z[1]) {
        buzz(40);
        const next = card.nextElementSibling;
        if (settings.autoNext && next?.classList.contains("zk")) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
      } else buzz();
      update();
      if (p[i] >= z[1] && catDone(c)) { buzz([30, 60, 30]); $("#finish").scrollIntoView({ behavior: "smooth" }); }
    };
    $("#reset").onclick = () => {
      progress.c[c.id] = {}; saveProgress(); toast("تمت إعادة العداد"); category(id);
    };
    if (focus != null) view.querySelector(`.zk[data-i="${focus}"]`)?.scrollIntoView({ block: "center" });
  }

  function zikrCard(c, i) {
    const z = c.z[i], n = (progress.c[c.id] || {})[i] || 0, done = n >= z[1];
    const fav = favs.includes(`${c.id}:${i}`);
    return `<article class="zk ${done ? "done" : ""}" data-i="${i}" data-c="${c.id}">
      <div class="txt">${esc(z[0])}</div>
      <div class="foot">
        <button class="act ${fav ? "on" : ""}" data-act="fav" aria-label="مفضلة">${fav ? "♥" : "♡"}</button>
        <button class="act" data-act="copy" aria-label="نسخ">⧉</button>
        <button class="act" data-act="share" aria-label="مشاركة">↗</button>
        <button class="count" aria-label="عدّ"><small>${z[1] > 1 ? "التكرار " + arNum(z[1]) : "مرة واحدة"}</small>
          <span class="ring" style="--p:${(Math.min(n, z[1]) / z[1]) * 100}"><b>${done ? "✔" : arNum(z[1] - n)}</b></span></button>
      </div></article>`;
  }
  function paint(card, z, n) {
    const done = n >= z[1];
    card.classList.toggle("done", done);
    const ring = card.querySelector(".ring");
    ring.style.setProperty("--p", (Math.min(n, z[1]) / z[1]) * 100);
    ring.firstElementChild.textContent = done ? "✔" : arNum(z[1] - n);
  }

  function toggleFav(cid, i, btn) {
    const key = `${cid}:${i}`;
    const on = !favs.includes(key);
    favs = on ? [...favs, key] : favs.filter((f) => f !== key);
    store.set("favs", favs);
    btn.classList.toggle("on", on); btn.textContent = on ? "♥" : "♡";
    buzz(); toast(on ? "أضيف إلى المفضلة" : "حُذف من المفضلة");
    if (!on && currentTab === "fav") favorites();
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("تم النسخ"); } catch { toast("تعذّر النسخ"); }
  }
  async function share(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); } catch {} } else copy(text);
  }

  function favorites() {
    currentTab = "fav"; setHeader("المفضلة");
    const items = favs.map((f) => f.split(":").map(Number)).filter(([c, i]) => byId[c]?.z[i]);
    if (!items.length) { view.innerHTML = `<p class="empty">♡<br>اضغط على القلب أسفل أي ذكر لإضافته هنا</p>`; return; }
    view.innerHTML = items.map(([c, i]) => `<a class="sec" href="#/c/${c}/${i}" style="display:block;color:var(--muted);text-decoration:none;margin:8px 4px">${esc(byId[c].t)} ←</a>${zikrCard(byId[c], i)}`).join("");
    view.onclick = (e) => {
      const card = e.target.closest(".zk");
      if (!card) return;
      const c = +card.dataset.c, i = +card.dataset.i, z = byId[c].z[i];
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "fav") return toggleFav(c, i, e.target.closest("button"));
      if (act === "copy") return copy(z[0]);
      if (act === "share") return share(z[0], byId[c].t);
    };
  }

  const TASBIH = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ", "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
  function tasbih() {
    currentTab = "tasbih"; setHeader("السبحة الإلكترونية");
    const t = Object.assign({ i: 0, n: 0, target: 33, total: 0, day: today(), todayN: 0 }, store.get("tasbih", {}));
    if (t.day !== today()) { t.day = today(); t.todayN = 0; }
    const save = () => store.set("tasbih", t);
    const render = () => {
      view.innerHTML = `<div class="tasbih">
        <div class="chips">${TASBIH.map((x, i) => `<button class="chip ${i === t.i ? "on" : ""}" data-i="${i}">${x}</button>`).join("")}</div>
        <h2>${TASBIH[t.i]}</h2>
        <button class="bead" id="bead">${arNum(t.n)}<small>${t.target ? "من " + arNum(t.target) : "بلا حد"}</small></button>
        <div class="stats"><div><b>${arNum(t.todayN)}</b><small>اليوم</small></div><div><b>${arNum(t.total)}</b><small>الإجمالي</small></div></div>
        <div class="seg" style="display:inline-flex">${[33, 100, 1000, 0].map((v) => `<button data-t="${v}" class="${t.target === v ? "on" : ""}">${v ? arNum(v) : "∞"}</button>`).join("")}</div>
        <p><button class="btn ghost" id="tReset">↺ تصفير</button></p></div>`;
      $("#bead").onclick = () => {
        t.n++; t.total++; t.todayN++;
        if (t.target && t.n >= t.target) { buzz([40, 50, 40]); toast("أتممت " + arNum(t.target) + " — بارك الله فيك"); t.n = 0; } else buzz(12);
        save(); render();
      };
      view.querySelectorAll(".chip").forEach((b) => (b.onclick = () => { t.i = +b.dataset.i; t.n = 0; save(); render(); }));
      view.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { t.target = +b.dataset.t; t.n = 0; save(); render(); }));
      $("#tReset").onclick = () => { t.n = 0; save(); render(); };
    };
    view.onclick = null;
    render();
  }

  function settingsView() {
    currentTab = "settings"; setHeader("الإعدادات");
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(settings[key]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
    view.innerHTML = `<div class="list">
      <div class="row">المظهر ${seg("theme", [["auto", "تلقائي"], ["light", "فاتح"], ["dark", "داكن"]])}</div>
      <div class="row">حجم الخط ${seg("fs", [[18, "صغير"], [22, "متوسط"], [26, "كبير"], [32, "أكبر"]])}</div>
      <div class="preview">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
      <div class="row">الاهتزاز عند العد ${seg("vibrate", [[true, "تشغيل"], [false, "إيقاف"]])}</div>
      <div class="row">الانتقال التلقائي للذكر التالي ${seg("autoNext", [[true, "تشغيل"], [false, "إيقاف"]])}</div>
      </div>
      <h3 class="sec">عن التطبيق</h3>
      <div class="list" style="margin-bottom:12px"><a href="#/about"><span>👨‍💻</span>عن المطور<span class="n">محمود هواري</span></a></div>
      <div class="list"><div class="preview" style="font-size:15px;line-height:1.9">
        جميع الأذكار من كتاب <b>حصن المسلم</b> للشيخ سعيد بن علي بن وهف القحطاني — ${arNum(cats.length)} بابًا و${arNum(cats.reduce((a, c) => a + c.z.length, 0))} ذكرًا.<br>
        يعمل التطبيق بدون إنترنت. اضغط على نص الذكر أو العداد للعد.<br>🤍 تطبيق مجاني غير ربحي — صدقة جارية.</div></div>`;
    view.onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const v = b.dataset.v;
      settings[b.dataset.k] = v === "true" ? true : v === "false" ? false : isNaN(v) ? v : +v;
      saveSettings(); buzz(); settingsView();
    };
  }


  const SOCIAL = [
    ["🌐", "الموقع الشخصي", "hawary.pro", "https://hawary.pro"],
    ["💬", "واتساب", "+20 109 868 2610", "https://wa.me/201098682610"],
    ["in", "LinkedIn", "Mahmoud Hawary", "https://www.linkedin.com/in/mahmoud-hawary-32a700232"],
    ["📸", "Instagram", "@medohawary", "https://www.instagram.com/medohawary"],
    ["🎵", "TikTok", "@mmhawary", "https://www.tiktok.com/@mmhawary"],
    ["f", "Facebook", "Mahmoud Hawary", "https://www.facebook.com/share/1LtVTbvXUh/"],
  ];
  // ---------- hadiths ----------
  function hadithTopics() {
    currentTab = "hadith"; setHeader("الأحاديث النبوية");
    view.innerHTML = `
      <p class="note">${arNum(hadiths.items.length)} حديثًا، كلها <b>صحيحة</b> من صحيحَي البخاري ومسلم، ومعها شرحها وفوائدها من <a href="https://hadeethenc.com/ar/home" target="_blank" rel="noopener">الموسوعة الحديثية</a>.</p>
      <div class="list">${hadiths.topics.map((t) => `<a href="#/h/${t.k}"><span>${t.i}</span>${esc(t.t)}<span class="n">${arNum(t.ids.length)}</span></a>`).join("")}</div>`;
  }

  function hadithList(k) {
    const t = hadiths.topics.find((x) => x.k === k);
    if (!t) return hadithTopics();
    currentTab = "hadith"; setHeader(t.t, true);
    view.innerHTML = `<div class="list">${t.ids.map((id) => {
      const h = hadithById[id];
      return h ? `<a href="#/hd/${h.id}">${esc(h.t)}</a>` : "";
    }).join("")}</div>`;
  }

  function hadith(id) {
    const h = hadithById[+id];
    if (!h) return hadithTopics();
    currentTab = "hadith"; setHeader(h.t, true);
    view.innerHTML = `
      <article class="zk"><div class="txt" style="cursor:auto">${esc(h.h)}</div>
        <div class="foot">
          <button class="act" data-act="copy" aria-label="نسخ">⧉</button>
          <button class="act" data-act="share" aria-label="مشاركة">↗</button>
          <span class="badges"><b class="grade">${esc(h.g)}</b><b>${esc(h.a)}</b></span>
        </div></article>
      <h3 class="sec">الشرح</h3>
      <div class="list"><div class="body">${esc(h.e)}</div></div>
      ${h.f.length ? `<h3 class="sec">من فوائد الحديث</h3><div class="list"><ul class="body">${h.f.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <h3 class="sec">المصدر</h3>
      <div class="list"><div class="body ref">${h.r.map(esc).join("<br>")}
        <a href="${esc(h.u)}" target="_blank" rel="noopener">راجع الحديث في الموسوعة الحديثية ↖</a></div></div>`;
    view.onclick = (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const text = `${h.h}\n[${h.a}]`;
      if (act === "copy") copy(text);
      if (act === "share") share(text, h.t);
    };
  }

  function about() {
    currentTab = "settings"; setHeader("عن المطور", true);
    view.innerHTML = `
      <section class="dev">
        <div class="avatar">MH</div>
        <h2>محمود هواري</h2>
        <p>Mahmoud Hawary</p>
        <small>خبير تسويق إلكتروني ومتخصص ميديا باينج</small>
      </section>
      <div class="nonprofit"><b>🤍 تطبيق غير ربحي</b>
        هذا التطبيق مجاني بالكامل وغير ربحي، بلا إعلانات ولا اشتراكات ولا جمع لأي بيانات، وصدقة جارية لوجه الله تعالى.
        نسألكم الدعاء لنا ولوالدينا.</div>
      <h3 class="sec">تواصل معي</h3>
      <div class="list">${SOCIAL.map(([i, n, h, u]) => `<a href="${u}" target="_blank" rel="noopener"><span class="si">${i}</span><span>${n}<small class="sub">${h}</small></span><span class="n">↖</span></a>`).join("")}</div>
      <p class="empty" style="padding:24px 0">أذكار المسلم — الإصدار ${arNum(APP_VERSION.name).replace(".", "٫")}</p>`;
  }

  // ---------- router ----------
  function route() {
    const [, a, b, c] = location.hash.split("/");
    view.onclick = null;
    if (a === "c") category(+b, c);
    else if (a === "g") group(b);
    else if (a === "all") allCats();
    else if (a === "fav") favorites();
    else if (a === "tasbih") tasbih();
    else if (a === "settings") settingsView();
    else if (a === "about") about();
    else if (a === "h") (b ? hadithList(b) : hadithTopics());
    else if (a === "hd") hadith(b);
    else home();
  }
  addEventListener("hashchange", route);
  route();

  // ---------- update check (installed app / offline file only; the website is always current) ----------
  const isInstalled = !!window.Capacitor?.isNativePlatform?.() || location.protocol === "file:";
  async function checkUpdate() {
    if (!isInstalled || !navigator.onLine) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const v = await (await fetch(UPDATE_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl.signal })).json();
      if (!(v.code > APP_VERSION.code) || sessionStorage.getItem("skipUpdate") === String(v.code)) return;
      const bar = document.createElement("div");
      bar.className = "update";
      bar.innerHTML = `<div><b>🎉 يوجد تحديث جديد — الإصدار ${esc(arNum(v.name))}</b>${v.notes ? `<small>${esc(v.notes)}</small>` : ""}</div>
        <a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">تحميل</a><button class="x" aria-label="لاحقًا">✕</button>`;
      bar.querySelector(".x").onclick = () => { try { sessionStorage.setItem("skipUpdate", String(v.code)); } catch {} bar.remove(); };
      document.body.appendChild(bar);
    } catch {}
  }
  checkUpdate();

  // ---------- adhkar refresh: new/edited adhkar arrive on their own, no reinstall ----------
  async function refreshContent() {
    if (!navigator.onLine) return;
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 10000);
      const c = await (await fetch(CONTENT_URL + "?t=" + Date.now(), { cache: "no-store", signal: ctrl.signal })).json();
      if (!usable(c) || !(c.v > DATA.v)) return; // ignore anything older or malformed
      localStorage.setItem("content", JSON.stringify(c));
      toast("تم تحديث الأذكار — تظهر عند فتح التطبيق مرة أخرى");
    } catch {}
  }
  setTimeout(refreshContent, 1500);

  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
