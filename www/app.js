(() => {
  const APP_VERSION = { code: 8, name: "2.1" };
  const HOST = "https://azkar-hisn-almuslim.vercel.app";
  const UPDATE_URL = HOST + "/version.json";
  const CONTENT_URL = HOST + "/content.json";

  // The bundled adhkar ship inside the app; a newer set downloaded earlier wins.
  // ---------- language ----------
  const LANGS = window.I18N;
  let lang = (() => { try { return localStorage.getItem("lang") || "ar"; } catch { return "ar"; } })();
  if (!LANGS[lang]) lang = "ar";
  let T = LANGS[lang];
  function applyLang() {
    T = LANGS[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = T.dir;
    document.title = T.appName;
    document.querySelectorAll(".tabs a").forEach((el, i) => {
      const labels = [T.tabHome, T.tabQuran, T.tabAzkar, T.tabHadith, T.tabSettings];
      el.lastChild.textContent = labels[i];
    });
  }

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
  const arNum = (n) => (T.digits === "arabic" ? String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]) : String(n));
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
    currentTab = "home"; setHeader(T.appName);
    const h = new Date().getHours();
    const gi = Math.max(0, homeCfg.greetings.findIndex(([from, to]) => (from < to ? h >= from && h < to : h >= from || h < to)));
    const g = homeCfg.greetings[gi];
    const s = [g[2], g[3], g[4]];
    const c = byId[s[2]];
    view.innerHTML = `
      <section class="hero"><small>${(T.greet && T.greet[gi] && T.greet[gi][0]) || s[0]}</small><h2>${(T.greet && T.greet[gi] && T.greet[gi][1]) || s[1]}</h2>
        <a class="btn" href="#/c/${c.id}">${catDone(c) ? T.doneToday : T.startNow}</a></section>
      ${prayerStrip()}
      <input class="search" id="q" type="search" placeholder="${T.searchAll}">
      <div id="results"></div>
      <div id="homeBody">
        <div class="quick">
          ${homeCfg.quick.map(([icon, label, id]) => `<a href="#/c/${id}"><span>${icon}</span>${esc((T.quick && T.quick[id]) || label)}</a>`).join("")}
          <a href="#/tasbih"><span>📿</span>${T.tasbih}</a>
          <a href="#/h"><span>📜</span>${T.hadiths}</a>
          <a href="#/q"><span>❑</span>${T.mushaf}</a>
          <a href="#/fav"><span>♡</span>${T.favorites}</a>
          <a href="#/prayer"><span>🕌</span>${T.prayerTimes}</a>
          <a href="#/reminders"><span>🔔</span>${T.reminders}</a>
        </div>
        <h3 class="sec">${T.sections}</h3>
        <div class="list">${groups.map((g) => `<a href="#/g/${g.k}"><span>${g.i}</span>${(T.groups && T.groups[g.k]) || g.t}<span class="n">${arNum(g.ids.length)}</span></a>`).join("")}</div>
        <p class="credit"><a href="#/about">${T.credit}</a></p>
      </div>`;
    const q = $("#q");
    q.oninput = () => search(q.value.trim());
  }

  function prayerStrip() {
    const n = place() && window.adhan ? nextPrayer() : null;
    if (!n) return `<a class="pstrip" href="#/prayer">\u{1F54C} <b>${T.prayerStripTitle}</b><span>${T.prayerStripHint}</span></a>`;
    return `<a class="pstrip" href="#/prayer">\u{1F54C} <b>${n.name}</b><span>${fmtTime(n.at)} \u00b7 ${T.after} ${remain(n.at)}</span></a>`;
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
      if (at > -1) hits.push(`<a href="#/hd/${h.id}">📜 ${esc(h.t)}<span class="n">${T.hadithTag}</span></a>`);
    });
    const ayahHits = quran ? searchAyahs(pq) : [];
    res.innerHTML = hits.length || ayahHits.length
      ? `<div class="list">${hits.concat(ayahHits).join("")}</div>${quran ? "" : `<p class="note" id="qhint">${T.preparingSearch}</p>`}`
      : `<p class="empty">${T.noResults}</p>`;
    // The mushaf is a big file, so it is pulled in the first time someone searches.
    if (!quran) loadQuran().then((ok) => { if (ok && $("#q")?.value.trim() === q) search(q); });
  }

  function searchAyahs(pq) {
    const out = [];
    for (let g = 0; g < quran.ayahs.length && out.length < 40; g++) {
      if (plain(quran.ayahs[g]).includes(pq)) {
        const r = ayahRef(g);
        out.push(`<a href="#/q/${r.s}/${r.a}">۝ ${esc(quran.ayahs[g].slice(0, 70))}…<span class="n">${esc(r.t)} ${arNum(r.a)}</span></a>`);
      }
    }
    return out;
  }

  function allCats() {
    currentTab = "all"; setHeader(T.chaptersTitle);
    view.innerHTML = `<div class="list">${groups.map((g, gi) => `
      <details ${gi === 0 ? "open" : ""}><summary><span>${g.i}</span>${(T.groups && T.groups[g.k]) || g.t}<span class="n">${arNum(g.ids.length)}</span></summary>
      <div class="list">${g.ids.map((id) => catLink(byId[id])).join("")}</div></details>`).join("")}</div>`;
  }

  function group(k) {
    const g = groups.find((x) => x.k === k);
    if (!g) return home();
    currentTab = "all"; setHeader((T.groups && T.groups[g.k]) || g.t, true);
    view.innerHTML = `<div class="list">${g.ids.map((id) => catLink(byId[id])).join("")}</div>`;
  }

  function category(id, focus) {
    const c = byId[id];
    if (!c) return home();
    currentTab = currentTab === "fav" ? "fav" : "all";
    setHeader(c.t, true);
    const p = (progress.c[c.id] ||= {});
    view.innerHTML = `
      <div class="tools"><button class="btn ghost" id="reset">${T.resetCounter}</button></div>
      ${c.z.map((z, i) => zikrCard(c, i)).join("")}
      <div id="finish"></div>`;
    const bar = $("#progress");
    bar.hidden = false;
    const total = c.z.reduce((a, z) => a + z[1], 0);
    const update = () => {
      const done = c.z.reduce((a, z, i) => a + Math.min(p[i] || 0, z[1]), 0);
      bar.firstElementChild.style.width = (done / total) * 100 + "%";
      $("#finish").innerHTML = done >= total
        ? `<div class="finish"><div>🌿</div><h3>${T.completed} ${esc(c.t)}</h3><p>${T.accepted}</p><a class="btn" href="#/">${T.home}</a></div>` : "";
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
      if (act === "img") return shareImage(z[0], c.t);
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
      progress.c[c.id] = {}; saveProgress(); toast(T.counterReset); category(id);
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
        <button class="act" data-act="img" aria-label="مشاركة كصورة">🖼</button>
        <button class="count" aria-label="عدّ"><small>${z[1] > 1 ? T.repeat + " " + arNum(z[1]) : T.once}</small>
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
    buzz(); toast(on ? T.addedFav : T.removedFav);
    if (!on && currentTab === "fav") favorites();
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast(T.copied); } catch { toast(T.copyFailed); }
  }
  async function share(text, title) {
    if (navigator.share) { try { await navigator.share({ title, text }); } catch {} } else copy(text);
  }

  // --- render a verse/dhikr as a shareable square image ---
  function drawCard(text, caption) {
    const S = 1080, c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, "#0f5f4f"); g.addColorStop(1, "#17826b");
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = "rgba(201,162,77,.85)"; x.lineWidth = 4;
    x.strokeRect(46, 46, S - 92, S - 92);
    x.fillStyle = "#fff"; x.textAlign = "center"; x.direction = "rtl";

    // shrink until the text fits inside the frame
    let size = text.length < 80 ? 78 : text.length < 200 ? 62 : 52, lines = [];
    const wrap = (fs) => {
      x.font = `${fs}px "Noto Naskh Arabic", "Geeza Pro", serif`;
      const max = S - 200, out = [];
      let line = "";
      for (const w of text.split(/\s+/)) {
        const t = line ? line + " " + w : w;
        if (x.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
      }
      if (line) out.push(line);
      return out;
    };
    do { lines = wrap(size); size -= 3; } while (lines.length * (size * 1.9) > S - 320 && size > 20);

    const lh = size * 1.9, startY = S / 2 - ((lines.length - 1) * lh) / 2 - 20;
    lines.forEach((l, i) => x.fillText(l, S / 2, startY + i * lh));
    x.font = '30px "Noto Naskh Arabic", "Geeza Pro", serif';
    x.fillStyle = "rgba(255,255,255,.85)";
    x.fillText(caption, S / 2, S - 120);
    x.font = '24px system-ui, sans-serif';
    x.fillStyle = "rgba(255,255,255,.55)";
    x.fillText("azkar-hisn-almuslim.vercel.app", S / 2, S - 70);
    return c;
  }

  async function shareImage(text, caption) {
    try {
      const canvas = drawCard(text, caption);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const file = new File([blob], "ayah.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: caption });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "azkar.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T.imageSaved);
    } catch { toast(T.imageFailed); }
  }

  function favorites() {
    currentTab = "fav"; setHeader(T.favorites);
    const items = favs.map((f) => f.split(":").map(Number)).filter(([c, i]) => byId[c]?.z[i]);
    if (!items.length) { view.innerHTML = `<p class="empty">${T.favEmpty}</p>`; return; }
    view.innerHTML = items.map(([c, i]) => `<a class="sec" href="#/c/${c}/${i}" style="display:block;color:var(--muted);text-decoration:none;margin:8px 4px">${esc(byId[c].t)} ←</a>${zikrCard(byId[c], i)}`).join("");
    view.onclick = (e) => {
      const card = e.target.closest(".zk");
      if (!card) return;
      const c = +card.dataset.c, i = +card.dataset.i, z = byId[c].z[i];
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "fav") return toggleFav(c, i, e.target.closest("button"));
      if (act === "copy") return copy(z[0]);
      if (act === "share") return share(z[0], byId[c].t);
      if (act === "img") return shareImage(z[0], byId[c].t);
    };
  }

  const TASBIH = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ", "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
  function tasbih() {
    currentTab = "tasbih"; setHeader(T.tasbihTitle);
    const t = Object.assign({ i: 0, n: 0, target: 33, total: 0, day: today(), todayN: 0, log: {} }, store.get("tasbih", {}));
    if (t.day !== today()) { t.day = today(); t.todayN = 0; }
    if (!t.log) t.log = {};
    const save = () => {
      t.log[today()] = t.todayN;
      const keep = lastDays(30);
      Object.keys(t.log).forEach((d) => { if (!keep.includes(d)) delete t.log[d]; });
      store.set("tasbih", t);
    };
    const render = () => {
      view.innerHTML = `<div class="tasbih">
        <div class="chips">${TASBIH.map((x, i) => `<button class="chip ${i === t.i ? "on" : ""}" data-i="${i}">${x}</button>`).join("")}</div>
        <h2>${TASBIH[t.i]}</h2>
        <button class="bead" id="bead">${arNum(t.n)}<small>${t.target ? T.ofWord + " " + arNum(t.target) : T.noLimit}</small></button>
        <div class="stats"><div><b>${arNum(t.todayN)}</b><small>${T.todayWord}</small></div><div><b>${arNum(t.total)}</b><small>${T.totalWord}</small></div></div>
        <div class="seg" style="display:inline-flex">${[33, 100, 1000, 0].map((v) => `<button data-t="${v}" class="${t.target === v ? "on" : ""}">${v ? arNum(v) : "∞"}</button>`).join("")}</div>
        <p><button class="btn ghost" id="tReset">${T.resetWord}</button></p>
        ${weekChart(t)}</div>`;
      $("#bead").onclick = () => {
        t.n++; t.total++; t.todayN++;
        if (t.target && t.n >= t.target) { buzz([40, 50, 40]); toast(T.tasbihDone(arNum(t.target))); t.n = 0; } else buzz(12);
        save(); render();
      };
      view.querySelectorAll(".chip").forEach((b) => (b.onclick = () => { t.i = +b.dataset.i; t.n = 0; save(); render(); }));
      view.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { t.target = +b.dataset.t; t.n = 0; save(); render(); }));
      $("#tReset").onclick = () => { t.n = 0; save(); render(); };
    };
    view.onclick = null;
    render();
  }

  const lastDays = (n) => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-CA");
  });
  const DAY_NAMES = () => T.days;

  function weekChart(t) {
    const days = lastDays(7);
    const log = { ...(t.log || {}), [today()]: t.todayN };
    const max = Math.max(1, ...days.map((d) => log[d] || 0));
    const week = days.reduce((a, d) => a + (log[d] || 0), 0);
    return `<h3 class="sec">${T.last7(arNum(week))}</h3>
      <div class="chart">${days.map((d) => {
        const v = log[d] || 0;
        return `<div class="col"><b>${v ? arNum(v) : ""}</b><i style="height:${Math.round((v / max) * 86) + 4}px"></i>
          <small>${DAY_NAMES()[new Date(d + "T00:00").getDay()]}</small></div>`;
      }).join("")}</div>`;
  }

  function settingsView() {
    currentTab = "settings"; setHeader(T.settingsTitle);
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(settings[key]) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
    view.innerHTML = `<div class="list">
      <div class="row">${T.language} ${langSeg()}</div>
      <div class="row">${T.appearance} ${seg("theme", [["auto", T.auto], ["light", T.light], ["dark", T.dark]])}</div>
      <div class="row">${T.fontSize} ${seg("fs", [[18, T.small], [22, T.medium], [26, T.large], [32, T.xlarge]])}</div>
      <div class="preview">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
      <div class="row">${T.vibrate} ${seg("vibrate", [[true, T.on], [false, T.off]])}</div>
      <div class="row">${T.autoNext} ${seg("autoNext", [[true, T.on], [false, T.off]])}</div>
      </div>
      <h3 class="sec">${T.otherSections}</h3>
      <div class="list" style="margin-bottom:12px">
        <a href="#/reminders"><span>🔔</span>${T.reminders}<span class="n">${T.remindersHint}</span></a>
        <a href="#/prayer/setup"><span>📍</span>${T.cityAndMethod}</a>
        <a href="#/tasbih"><span>📿</span>${T.tasbih}</a>
        <a href="#/fav"><span>♡</span>${T.favorites}</a>
        <a href="#/khatma"><span>📖</span>${T.khatma}</a>
      </div>
      <h3 class="sec">${T.aboutApp}</h3>
      <div class="list" style="margin-bottom:12px"><a href="#/about"><span>👨‍💻</span>${T.aboutDev}<span class="n">${T.devName}</span></a></div>
      <div class="list"><div class="preview" style="font-size:15px;line-height:1.9">
        ${T.aboutText}</div></div>`;
    view.onclick = (e) => {
      const lb = e.target.closest("[data-lang]");
      if (lb) {
        lang = lb.dataset.lang;
        try { localStorage.setItem("lang", lang); } catch {}
        applyLang(); buzz(); scheduleAll(); settingsView();
        return;
      }
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const v = b.dataset.v;
      settings[b.dataset.k] = v === "true" ? true : v === "false" ? false : isNaN(v) ? v : +v;
      saveSettings(); buzz(); settingsView();
    };
  }


  const SOCIAL = [
    ["🌐", "website", "hawary.pro", "https://hawary.pro"],
    ["💬", "whatsapp", "+20 109 868 2610", "https://wa.me/201098682610"],
    ["in", "LinkedIn", "Mahmoud Hawary", "https://www.linkedin.com/in/mahmoud-hawary-32a700232"],
    ["📸", "Instagram", "@medohawary", "https://www.instagram.com/medohawary"],
    ["🎵", "TikTok", "@mmhawary", "https://www.tiktok.com/@mmhawary"],
    ["f", "Facebook", "Mahmoud Hawary", "https://www.facebook.com/share/1LtVTbvXUh/"],
  ];
  // ---------- mushaf ----------
  // The Quran and its tafsirs ship with the app but are loaded only when the section is opened.
  const TAFSIRS = [{ id: 1, file: "tafsir.json", t: "المختصر في التفسير" }, { id: 2, file: "tafsir2.json", t: "التفسير الميسر" }];
  let quran = null;
  const tafsirCache = {};
  const tafsirId = () => (store.get("tafsirId", 1) === 2 ? 2 : 1);
  const tafsirMeta = () => TAFSIRS.find((t) => t.id === tafsirId());

  async function loadQuran() {
    try {
      if (!quran) {
        const q = await fetch("quran.json").then((r) => r.json());
        if (!q.surahs || q.ayahs.length !== 6236) return false;
        quran = q;
      }
      const m = tafsirMeta();
      if (!tafsirCache[m.id]) {
        const t = await fetch(m.file).then((r) => r.json());
        if (!t.ayahs || t.ayahs.length !== 6236) return false;
        tafsirCache[m.id] = t;
      }
      return true;
    } catch { return false; }
  }
  const tafsirOf = (g) => (tafsirCache[tafsirId()]?.ayahs[g] || "");
  const ayahRef = (g) => { const s = quran.surahs.filter((x) => x.s <= g).pop(); return { s: s.n, t: s.t, a: g - s.s + 1 }; };
  const pageOf = (g) => { let p = 1; for (let i = 0; i < quran.pages.length; i++) if (quran.pages[i] <= g) p = i + 1; return p; };

  let bookmarks = store.get("bookmarks", []); // global ayah indexes
  const isMarked = (g) => bookmarks.includes(g);
  function toggleBookmark(g, btn) {
    const on = !isMarked(g);
    bookmarks = on ? [...bookmarks, g].sort((a, b) => a - b) : bookmarks.filter((x) => x !== g);
    store.set("bookmarks", bookmarks);
    if (btn) { btn.classList.toggle("on", on); btn.textContent = on ? "★" : "☆"; }
    buzz(); toast(on ? T.addedMark : T.removedMark);
  }

  async function quranIndex(mode) {
    currentTab = "quran"; setHeader(T.mushafTitle);
    view.innerHTML = `<p class="empty">${T.openingMushaf}</p>`;
    if (!(await loadQuran())) { view.innerHTML = `<p class="empty">${T.mushafFailed}</p>`; return; }
    mode = ["surah", "juz", "hizb", "marks"].includes(mode) ? mode : "surah";
    const last = store.get("lastRead", null);
    view.innerHTML = `
      ${last && quran.surahs[last.s - 1] ? `<a class="hero cont" href="#/q/${last.s}/${last.a}"><small>${T.continueReading}</small><h2>${esc(quran.surahs[last.s - 1].t)} — ${T.ayahWord} ${arNum(last.a)}</h2></a>` : ""}
      ${khatmaCard()}
      <div class="chips segchips">
        ${[["surah", T.bySurah], ["juz", T.byJuz], ["hizb", T.byHizb], ["marks", T.bookmarks]].map(([k, t]) =>
          `<a class="chip ${k === mode ? "on" : ""}" href="#/q${k === "surah" ? "" : "/m/" + k}">${t}</a>`).join("")}
      </div>
      ${mode === "surah" ? `<input class="search" id="qs" type="search" placeholder="${T.searchSurah}">` : ""}
      <div class="list" id="qlist">${indexRows(mode)}</div>`;
    const box = $("#qs");
    if (box) box.oninput = () => {
      const v = plain(box.value.trim());
      $("#qlist").innerHTML = quran.surahs.filter((s) => !v || plain(s.t).includes(v) || String(s.n) === v || arNum(s.n) === v).map(surahRow).join("");
    };
    view.onclick = (e) => {
      const b = e.target.closest("[data-unmark]");
      if (!b) return;
      e.preventDefault();
      toggleBookmark(+b.dataset.unmark);
      quranIndex("marks");
    };
  }

  function indexRows(mode) {
    if (mode === "surah") return quran.surahs.map(surahRow).join("");
    if (mode === "marks") {
      if (!bookmarks.length) return `<p class="empty">${T.marksEmpty}</p>`;
      return bookmarks.map((g) => {
        const r = ayahRef(g);
        return `<a href="#/q/${r.s}/${r.a}"><span class="mini">${esc(quran.ayahs[g].slice(0, 60))}…</span>
          <span class="n">${esc(r.t)} ${arNum(r.a)}</span><button class="act" data-unmark="${g}" aria-label="حذف">✕</button></a>`;
      }).join("");
    }
    const list = mode === "juz" ? quran.juz : quran.hizb;
    return list.map((x) => {
      const r = ayahRef(x.s);
      return `<a href="#/q/${r.s}/${r.a}"><span class="sn">${arNum(x.n)}</span>${mode === "juz" ? T.juz : T.hizb} ${arNum(x.n)}<span class="n">${esc(r.t)} ${arNum(r.a)}</span></a>`;
    }).join("");
  }
  const surahRow = (s) => `<a href="#/q/${s.n}"><span class="sn">${arNum(s.n)}</span>${esc(s.t)}<span class="n">${s.p === "مكية" ? T.makki : T.madani}${T.dir === "rtl" ? "،" : ","} ${arNum(s.c)} ${s.c === 1 ? T.ayah1 : s.c === 2 ? T.ayah2 : T.ayahs}</span></a>`;

  // --- khatma: a daily page target, tracked by how far the reader has reached ---
  function khatmaCard() {
    const k = store.get("khatma", null);
    if (!k) return `<a class="list khatma-start" href="#/khatma"><div class="row">📖 ${T.khatmaStart}<span class="n">${T.khatmaHint}</span></div></a>`;
    const last = store.get("lastRead", null);
    const page = last ? pageOf(quran.surahs[last.s - 1].s + last.a - 1) : 1;
    const days = Math.max(1, Math.ceil((604 - page) / k.pages));
    const pct = Math.round((page / 604) * 100);
    return `<a class="list khatma-start" href="#/khatma"><div class="row"><div style="flex:1">
      <b>${T.khatmaPage(arNum(page))}</b>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <small>${T.khatmaDaily(arNum(k.pages), arNum(days))}</small>
    </div></div></a>`;
  }

  async function khatmaView() {
    currentTab = "quran"; setHeader(T.khatma, true);
    if (!(await loadQuran())) { view.innerHTML = `<p class="empty">${T.mushafFailed}</p>`; return; }
    const k = store.get("khatma", null);
    const last = store.get("lastRead", null);
    const page = last ? pageOf(quran.surahs[last.s - 1].s + last.a - 1) : 1;
    view.innerHTML = `
      <p class="note">${T.khatmaNote}</p>
      <div class="list"><div class="row">${T.dailyPortion}
        <div class="seg">${[2, 4, 5, 10, 20].map((p) => `<button data-p="${p}" class="${k && k.pages === p ? "on" : ""}">${arNum(p)}</button>`).join("")}</div>
      </div>
      <div class="row">${T.yourPosition}<b>${T.pageOf(arNum(page))}</b></div></div>
      <div class="tools" style="margin-top:14px">
        ${k ? `<button class="btn ghost" id="endK">${T.endKhatma}</button>` : ""}
        <a class="btn" href="#/q">${T.toMushaf}</a></div>`;
    view.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => {
      store.set("khatma", { pages: +b.dataset.p, from: today() });
      toast(T.portionSet); khatmaView();
    }));
    const end = $("#endK");
    if (end) end.onclick = () => { store.set("khatma", null); toast(T.khatmaEnded); khatmaView(); };
  }

  async function surah(n, goto) {
    n = Math.min(114, Math.max(1, +n || 1));
    currentTab = "quran";
    if (!(await loadQuran())) { view.innerHTML = `<p class="empty">${T.mushafFailed}</p>`; return; }
    const s = quran.surahs[n - 1];
    setHeader(s.t, true);
    const showAll = store.get("showTafsir", false); // tafsir under every ayah, or only on tap
    const tm = tafsirMeta();
    view.innerHTML = `
      <div class="surah-head"><h2>${esc(s.t)}</h2><small>${s.p === "مكية" ? T.makki : T.madani}${T.dir === "rtl" ? "،" : ","} ${arNum(s.c)} ${s.c === 1 ? T.ayah1 : s.c === 2 ? T.ayah2 : T.ayahs} · ${T.juz} ${arNum(juzOf(s.s))}</small>
        ${n !== 9 ? `<p class="basmala">${esc(quran.ayahs[0])}</p>` : ""}</div>
      <div class="tools">
        <button class="btn ghost" id="tafBtn">${showAll ? T.tafsirEveryAyah : T.tafsirOnTap}</button>
        <button class="btn ghost" id="tafSwap">${esc(tafsirName())} ⇄</button>
      </div>
      <div class="mushaf ${showAll ? "show-all" : ""}" id="mushaf">
        ${Array.from({ length: s.c }, (_, i) => {
          const g = s.s + i;
          return `<section class="ayah" data-a="${i + 1}" data-g="${g}" id="a${i + 1}">
            <p class="aya">${esc(quran.ayahs[g])} <span class="mark">${arNum(i + 1)}</span></p>
            <div class="taf"><b>${esc(tafsirName())}</b>${esc(tafsirOf(g))}
              <div class="ayah-acts">
                <button class="act ${isMarked(g) ? "on" : ""}" data-mark="${g}" aria-label="حفظ">${isMarked(g) ? "★" : "☆"}</button>
                <button class="act" data-copyayah="${g}" aria-label="نسخ">⧉</button>
                <button class="act" data-img="${g}" aria-label="مشاركة كصورة">🖼</button>
              </div></div></section>`;
        }).join("")}
      </div>
      <div class="navs">
        ${n > 1 ? `<a class="btn ghost" href="#/q/${n - 1}">← ${esc(quran.surahs[n - 2].t)}</a>` : "<span></span>"}
        ${n < 114 ? `<a class="btn ghost" href="#/q/${n + 1}">${esc(quran.surahs[n].t)} →</a>` : "<span></span>"}
      </div>`;
    $("#tafBtn").onclick = () => {
      const on = !store.get("showTafsir", false);
      store.set("showTafsir", on);
      $("#mushaf").classList.toggle("show-all", on);
      $("#tafBtn").textContent = on ? T.tafsirEveryAyah : T.tafsirOnTap;
    };
    $("#tafSwap").onclick = async () => {
      store.set("tafsirId", tafsirId() === 1 ? 2 : 1);
      toast(T.tafsirNow + tafsirName());
      await surah(n, goto);
    };
    view.onclick = (e) => {
      const markBtn = e.target.closest("[data-mark]");
      if (markBtn) { e.stopPropagation(); return toggleBookmark(+markBtn.dataset.mark, markBtn); }
      const copyBtn = e.target.closest("[data-copyayah]");
      if (copyBtn) { e.stopPropagation(); const g = +copyBtn.dataset.copyayah; const r = ayahRef(g); return copy(`${quran.ayahs[g]}\n[${r.t}: ${r.a}]`); }
      const imgBtn = e.target.closest("[data-img]");
      if (imgBtn) { e.stopPropagation(); const g = +imgBtn.dataset.img; const r = ayahRef(g); return shareImage(quran.ayahs[g], `${r.t} — الآية ${arNum(r.a)}`); }
      const sec = e.target.closest(".ayah");
      if (!sec) return;
      sec.classList.toggle("open");
      store.set("lastRead", { s: n, a: +sec.dataset.a });
    };
    if (goto) view.querySelector("#a" + (+goto))?.scrollIntoView({ block: "center" });
    store.set("lastRead", { s: n, a: +goto || 1 });
  }
  const juzOf = (g) => { let j = 1; quran.juz.forEach((x) => { if (x.s <= g) j = x.n; }); return j; };

  // ---------- prayer times (computed on the device, works offline) ----------
  const CITIES = [
    ["القاهرة", 30.0444, 31.2357], ["الإسكندرية", 31.2001, 29.9187], ["الجيزة", 30.0131, 31.2089],
    ["المنصورة", 31.0409, 31.3785], ["طنطا", 30.7865, 31.0004], ["أسيوط", 27.1783, 31.1859],
    ["الأقصر", 25.6872, 32.6396], ["أسوان", 24.0889, 32.8998], ["بورسعيد", 31.2653, 32.3019],
    ["السويس", 29.9668, 32.5498], ["مكة المكرمة", 21.3891, 39.8579], ["المدينة المنورة", 24.5247, 39.5692],
    ["الرياض", 24.7136, 46.6753], ["جدة", 21.4858, 39.1925], ["دبي", 25.2048, 55.2708],
    ["الدوحة", 25.2854, 51.5310], ["الكويت", 29.3759, 47.9774], ["عمّان", 31.9454, 35.9284],
    ["بيروت", 33.8938, 35.5018], ["بغداد", 33.3152, 44.3661], ["الخرطوم", 15.5007, 32.5599],
    ["تونس", 36.8065, 10.1815], ["الجزائر", 36.7538, 3.0588], ["الرباط", 34.0209, -6.8416],
    ["إسطنبول", 41.0082, 28.9784], ["لندن", 51.5074, -0.1278], ["باريس", 48.8566, 2.3522],
    ["برلين", 52.52, 13.405], ["نيويورك", 40.7128, -74.006], ["تورونتو", 43.6532, -79.3832],
  ];
  const METHODS = [
    ["Egyptian", "الهيئة المصرية العامة للمساحة"],
    ["UmmAlQura", "أم القرى (السعودية)"],
    ["MuslimWorldLeague", "رابطة العالم الإسلامي"],
    ["Dubai", "دبي"], ["Kuwait", "الكويت"], ["Qatar", "قطر"],
    ["NorthAmerica", "أمريكا الشمالية (ISNA)"], ["Karachi", "كراتشي"],
    ["Turkey", "تركيا"], ["Tehran", "طهران"],
  ];
  const PRAYER_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  const prayerName = (k) => T.prayers[PRAYER_KEYS.indexOf(k)];

  const place = () => store.get("place", null); // {t, lat, lng}
  const method = () => { const m = store.get("prayerMethod", "Egyptian"); return window.adhan?.CalculationMethod?.[m] ? m : "Egyptian"; };
  const fmtTime = (d) => d.toLocaleTimeString(T.locale, { hour: "2-digit", minute: "2-digit", hour12: true });

  function prayerTimesFor(date) {
    const p = place();
    if (!p || !window.adhan) return null;
    const params = (window.adhan.CalculationMethod[method()] || window.adhan.CalculationMethod.Egyptian)();
    return new window.adhan.PrayerTimes(new window.adhan.Coordinates(p.lat, p.lng), date, params);
  }

  function nextPrayer() {
    const t = prayerTimesFor(new Date());
    if (!t) return null;
    const now = new Date();
    for (const k of PRAYER_KEYS) {
      if (k === "sunrise") continue;
      if (t[k] > now) return { k, name: prayerName(k), at: t[k] };
    }
    const tomorrow = prayerTimesFor(new Date(Date.now() + 864e5));
    return tomorrow ? { k: "fajr", name: prayerName("fajr"), at: tomorrow.fajr } : null;
  }

  let prayerTimer = null;
  function prayerView() {
    currentTab = "prayer"; setHeader(T.prayerTimes, true);
    clearInterval(prayerTimer);
    const p = place();
    if (!p) return prayerSetup();
    const t = prayerTimesFor(new Date());
    if (!t) { view.innerHTML = `<p class="empty">${T.calcFailed}</p>`; return; }
    const nx = nextPrayer();
    view.innerHTML = `
      <section class="hero"><small>${esc(placeName())}</small><h2 id="nextP">${nx ? nx.name + " " + T.after + " " + remain(nx.at) : ""}</h2>
        <small id="nextT">${nx ? fmtTime(nx.at) : ""}</small></section>
      <div class="list">${PRAYER_KEYS.map((k) => `<div class="row ${nx && nx.k === k ? "now" : ""}">
        <span>${prayerName(k)}</span><b>${fmtTime(t[k])}</b></div>`).join("")}</div>
      <div class="tools" style="margin-top:14px">
        <a class="btn ghost" href="#/prayer/setup">${T.changeCity}</a>
        <button class="btn ghost" id="notifP">${T.alertBefore}</button>
      </div>
      <p class="note">${esc(T.calcNote(methodName()))}</p>`;
    prayerTimer = setInterval(() => {
      const n = nextPrayer();
      const el = $("#nextP");
      if (n && el) el.textContent = n.name + " " + T.after + " " + remain(n.at);
    }, 30000);
    $("#notifP").onclick = () => (location.hash = "#/reminders");
  }
  const remain = (d) => {
    const m = Math.max(0, Math.round((d - Date.now()) / 60000));
    return m >= 60 ? `${arNum(Math.floor(m / 60))} ${T.hoursShort} ${arNum(m % 60)} ${T.minsShort}` : `${arNum(m)} ${T.minutes}`;
  };

  function prayerSetup() {
    currentTab = "prayer"; setHeader(T.prayerTimes, true);
    view.innerHTML = `
      <p class="note">${T.pickCity}</p>
      <div class="tools"><button class="btn" id="geo">${T.locateMe}</button></div>
      <h3 class="sec">${T.orPickCity}</h3>
      <div class="list">${CITIES.map(([t, lat, lng], i) => `<a href="#" data-city="${i}">${cityName(i)}${place()?.t === t ? '<span class="ok">✔</span>' : ""}</a>`).join("")}</div>
      <h3 class="sec">${T.calcMethod}</h3>
      <div class="list">${METHODS.map(([k, t], i) => `<a href="#" data-method="${k}">${T.methods[i]}${method() === k ? '<span class="ok">✔</span>' : ""}</a>`).join("")}</div>`;
    $("#geo").onclick = async () => {
      toast(T.locating);
      try {
        // the installed app asks through the Capacitor plugin; the browser uses its own API
        const Geo = window.Capacitor?.Plugins?.Geolocation;
        let pos;
        if (Geo) {
          const perm = await Geo.requestPermissions({ permissions: ["location"] });
          if (perm.location === "denied") { toast(T.locationDenied); return; }
          pos = await Geo.getCurrentPosition({ timeout: 15000, enableHighAccuracy: false });
        } else {
          pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 15000, enableHighAccuracy: false }));
        }
        store.set("place", { t: "@me", lat: pos.coords.latitude, lng: pos.coords.longitude });
        scheduleAll(); location.hash = "#/prayer";
      } catch { toast(T.locateFailed); }
    };
    view.onclick = (e) => {
      const c = e.target.closest("[data-city]"), m = e.target.closest("[data-method]");
      if (c) {
        e.preventDefault();
        const [, lat, lng] = CITIES[+c.dataset.city];
        store.set("place", { t: "@" + c.dataset.city, lat, lng });
        scheduleAll(); location.hash = "#/prayer";
      } else if (m) {
        e.preventDefault();
        store.set("prayerMethod", m.dataset.method);
        scheduleAll(); prayerSetup();
      }
    };
  }

  // ---------- reminders (local notifications on the installed app) ----------
  const LN = () => window.Capacitor?.Plugins?.LocalNotifications;
  const defaultReminders = () => ({
    morning: { on: false, h: 6, m: 30, key: "morningAzkar", link: "#/c/133" },
    evening: { on: false, h: 17, m: 30, key: "eveningAzkar", link: "#/c/134" },
    sleep: { on: false, h: 22, m: 30, key: "sleepAzkar", link: "#/c/2" },
    prayer: { on: false, before: 10 },
  });
  const reminders = () => Object.assign(defaultReminders(), store.get("reminders", {}));

  async function scheduleAll() {
    const ln = LN();
    if (!ln) return false;
    try {
      const r = reminders();
      const pending = await ln.getPending();
      if (pending.notifications?.length) await ln.cancel({ notifications: pending.notifications });
      const list = [];
      let id = 1;
      [["morning", "🌅"], ["evening", "🌇"], ["sleep", "🌙"]].forEach(([k, icon]) => {
        if (!r[k].on) return;
        list.push({
          id: id++, title: `${icon} ${T[r[k].key]}`, body: T.notifBody,
          schedule: { on: { hour: r[k].h, minute: r[k].m }, allowWhileIdle: true },
          extra: { link: r[k].link },
        });
      });
      if (r.prayer.on && place()) {
        // the next three days of prayers; rescheduled whenever the app opens
        for (let d = 0; d < 3; d++) {
          const t = prayerTimesFor(new Date(Date.now() + d * 864e5));
          if (!t) break;
          PRAYER_KEYS.forEach((k) => {
            if (k === "sunrise") return;
            const at = new Date(t[k].getTime() - r.prayer.before * 60000);
            if (at <= new Date()) return;
            list.push({ id: id++, title: `🕌 ${prayerName(k)}`, body: T.notifPrayerBody(prayerName(k), r.prayer.before), schedule: { at, allowWhileIdle: true } });
          });
        }
      }
      if (list.length) await ln.schedule({ notifications: list });
      return true;
    } catch { return false; }
  }

  async function remindersView() {
    currentTab = "settings"; setHeader(T.remindersTitle, true);
    const ln = LN();
    const r = reminders();
    const row = (k, label) => `<div class="row"><span>${label}<small class="sub">${arNum(String(r[k].h).padStart(2, "0"))}:${arNum(String(r[k].m).padStart(2, "0"))}</small></span>
      <span style="display:flex;gap:8px;align-items:center">
        <input type="time" class="tinput" data-time="${k}" value="${String(r[k].h).padStart(2, "0")}:${String(r[k].m).padStart(2, "0")}">
        <button class="sw ${r[k].on ? "on" : ""}" data-toggle="${k}" aria-label="تشغيل"></button></span></div>`;
    view.innerHTML = `
      ${ln ? "" : `<p class="note">${T.remindersWeb}</p>`}
      <div class="list">
        ${row("morning", T.morningAzkar)}
        ${row("evening", T.eveningAzkar)}
        ${row("sleep", T.sleepAzkar)}
      </div>
      <h3 class="sec">${T.prayerSection}</h3>
      <div class="list">
        <div class="row"><span>${T.beforeAdhan}<small class="sub">${place() ? esc(placeName()) : T.pickCityFirst}</small></span>
          <span style="display:flex;gap:8px;align-items:center">
            <div class="seg">${[5, 10, 15, 30].map((v) => `<button data-before="${v}" class="${r.prayer.before === v ? "on" : ""}">${arNum(v)}${T.minsShort}</button>`).join("")}</div>
            <button class="sw ${r.prayer.on ? "on" : ""}" data-toggle="prayer"></button></span></div>
        ${place() ? "" : `<div class="row"><a class="btn ghost" href="#/prayer/setup">${T.setCity}</a></div>`}
      </div>`;
    view.onclick = async (e) => {
      const tg = e.target.closest("[data-toggle]"), bf = e.target.closest("[data-before]");
      if (tg) {
        const k = tg.dataset.toggle, next = { ...r, [k]: { ...r[k], on: !r[k].on } };
        if (next[k].on && ln) {
          const perm = await ln.requestPermissions();
          if (perm.display !== "granted") { toast(T.notifDenied); return; }
        }
        store.set("reminders", next);
        buzz(); await scheduleAll(); remindersView();
      } else if (bf) {
        store.set("reminders", { ...r, prayer: { ...r.prayer, before: +bf.dataset.before } });
        await scheduleAll(); remindersView();
      }
    };
    view.querySelectorAll("[data-time]").forEach((inp) => (inp.onchange = async () => {
      const [h, m] = inp.value.split(":").map(Number);
      store.set("reminders", { ...r, [inp.dataset.time]: { ...r[inp.dataset.time], h, m } });
      await scheduleAll(); remindersView();
    }));
  }

  // ---------- hadiths ----------
  function hadithTopics() {
    currentTab = "hadith"; setHeader(T.hadithsTitle);
    view.innerHTML = `
      <p class="note">${T.hadithNote(arNum(hadiths.items.length))} <a href="https://hadeethenc.com/ar/home" target="_blank" rel="noopener">${T.encyclopedia}</a>.</p>
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
          <button class="act" data-act="img" aria-label="مشاركة كصورة">🖼</button>
          <span class="badges"><b class="grade">${esc(h.g)}</b><b>${esc(h.a)}</b></span>
        </div></article>
      <h3 class="sec">${T.explanation}</h3>
      <div class="list"><div class="body">${esc(h.e)}</div></div>
      ${h.f.length ? `<h3 class="sec">${T.benefits}</h3><div class="list"><ul class="body">${h.f.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <h3 class="sec">${T.source}</h3>
      <div class="list"><div class="body ref">${h.r.map(esc).join("<br>")}
        <a href="${esc(h.u)}" target="_blank" rel="noopener">${T.checkSource}</a></div></div>`;
    view.onclick = (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const text = `${h.h}\n[${h.a}]`;
      if (act === "copy") copy(text);
      if (act === "share") share(text, h.t);
      if (act === "img") shareImage(h.h, h.a);
    };
  }

  function about() {
    currentTab = "settings"; setHeader(T.aboutDev, true);
    view.innerHTML = `
      <section class="dev">
        <div class="avatar">MH</div>
        <h2>${T.devName}</h2>
        <p>Mahmoud Hawary</p>
        <small>${T.devRole}</small>
      </section>
      <div class="nonprofit"><b>${T.nonProfitTitle}</b>
        هذا التطبيق مجاني بالكامل وغير ربحي، بلا إعلانات ولا اشتراكات ولا جمع لأي بيانات، وصدقة جارية لوجه الله تعالى.
        نسألكم الدعاء لنا ولوالدينا.</div>
      <h3 class="sec">${T.contactMe}</h3>
      <div class="list">${SOCIAL.map(([i, n, h, u]) => `<a href="${u}" target="_blank" rel="noopener"><span class="si">${i}</span><span>${T[n] || n}<small class="sub">${h}</small></span><span class="n">↖</span></a>`).join("")}</div>
      <p class="empty" style="padding:24px 0">${T.version(arNum(APP_VERSION.name).replace(".", T.digits === "arabic" ? "٫" : "."))}</p>`;
  }

  // ---------- language helpers ----------
  const cityName = (i) => T.cities[i] || CITIES[i][0];
  const methodName = () => { const i = METHODS.findIndex((m) => m[0] === method()); return i > -1 ? T.methods[i] : ""; };
  const placeName = () => {
    const p = place();
    if (!p) return "";
    if (p.t === "@me") return T.myLocation;
    if (String(p.t).startsWith("@")) return cityName(+p.t.slice(1));
    const i = CITIES.findIndex((c) => c[0] === p.t);
    return i > -1 ? cityName(i) : p.t;
  };
  const tafsirName = () => T.tafsirNames[tafsirId() - 1] || tafsirMeta().t;
  const langSeg = () => `<div class="seg">${Object.keys(LANGS).map((k) => `<button data-lang="${k}" class="${k === lang ? "on" : ""}">${LANGS[k].name}</button>`).join("")}</div>`;

  // ---------- router ----------
  function route() {
    const [, a, b, c] = location.hash.split("/");
    view.onclick = null;
    clearInterval(prayerTimer);
    if (a === "c") category(+b, c);
    else if (a === "g") group(b);
    else if (a === "all") allCats();
    else if (a === "fav") favorites();
    else if (a === "tasbih") tasbih();
    else if (a === "settings") settingsView();
    else if (a === "about") about();
    else if (a === "q") (b === "m" ? quranIndex(c) : b ? surah(b, c) : quranIndex());
    else if (a === "khatma") khatmaView();
    else if (a === "prayer") (b === "setup" ? prayerSetup() : prayerView());
    else if (a === "reminders") remindersView();
    else if (a === "h") (b ? hadithList(b) : hadithTopics());
    else if (a === "hd") hadith(b);
    else home();
  }
  applyLang();
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
      bar.innerHTML = `<div><b>${esc(T.updateTitle(arNum(v.name)))}</b>${v.notes ? `<small>${esc(v.notes)}</small>` : ""}</div>
        <a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">${T.download}</a><button class="x" aria-label="${T.later}">✕</button>`;
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
      toast(T.contentUpdated);
    } catch {}
  }
  setTimeout(refreshContent, 1500);

  // Re-arm reminders on every launch (prayer alerts are only scheduled a few days ahead).
  const ln0 = LN();
  if (ln0) {
    scheduleAll();
    ln0.addListener("localNotificationActionPerformed", (e) => {
      const link = e?.notification?.extra?.link;
      if (link) location.hash = link;
    });
    document.addEventListener("resume", scheduleAll);
  }

  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
