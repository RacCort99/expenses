'use strict';
/* Expenses — spese e budget personali. Dati in localStorage, backup su file o Google Drive. */

// ---------- Gruppi e categorie ----------
const GROUPS = {
  food: { label: 'Cibo',          color: '#f2a900' },
  home: { label: 'Casa & Rate',   color: '#c2410c' },
  move: { label: 'Trasporti',     color: '#2563eb' },
  me:   { label: 'Persona',       color: '#db2777' },
  fun:  { label: 'Tempo libero',  color: '#0d9488' },
  misc: { label: 'Altro',         color: '#78716c' },
  inc:  { label: 'Entrate',       color: '#16a34a' },
};
const CATS = {
  groceries:     { label: 'Spesa',           emo: '🛒', g: 'food' },
  restaurants:   { label: 'Ristoranti',      emo: '🍽️', g: 'food' },
  fastfood:      { label: 'Fast food',       emo: '🍔', g: 'food' },
  bar:           { label: 'Bar & Caffè',     emo: '☕', g: 'food' },
  housing:       { label: 'Mutuo & Affitto', emo: '🏠', g: 'home' },
  utilities:     { label: 'Bollette & Telefono', emo: '💡', g: 'home' },
  loans:         { label: 'Prestiti & Rate', emo: '💳', g: 'home' },
  fuel:          { label: 'Carburante',      emo: '⛽', g: 'move' },
  car:           { label: 'Auto',            emo: '🚗', g: 'move' },
  transit:       { label: 'Mezzi & Taxi',    emo: '🚇', g: 'move' },
  health:        { label: 'Salute',          emo: '💊', g: 'me' },
  wellness:      { label: 'Sport & Cura',    emo: '💪', g: 'me' },
  shopping:      { label: 'Shopping',        emo: '🛍️', g: 'me' },
  subscriptions: { label: 'Abbonamenti',     emo: '🔁', g: 'me' },
  travel:        { label: 'Viaggi',          emo: '✈️', g: 'fun' },
  leisure:       { label: 'Svago & Eventi',  emo: '🎟️', g: 'fun' },
  gifts:         { label: 'Regali',          emo: '🎁', g: 'fun' },
  other:         { label: 'Altro',           emo: '📦', g: 'misc' },
  salary:        { label: 'Stipendio',       emo: '💼', g: 'inc', income: true },
  income:        { label: 'Altre entrate',   emo: '💰', g: 'inc', income: true },
};
const EXPENSE_CATS = Object.keys(CATS).filter(k => !CATS[k].income);
const INCOME_CATS = Object.keys(CATS).filter(k => CATS[k].income);
const EXPENSE_GROUPS = Object.keys(GROUPS).filter(g => g !== 'inc');
const cat = k => CATS[k] || CATS.other;
const gcolor = k => GROUPS[cat(k).g].color;

// ---------- Stato ----------
const KEY = 'expenses-v1', OLD_KEY = 'gruzzolo-v1', DATA_VERSION = 2;
const blank = () => ({ version: DATA_VERSION, transactions: [], budgets: {}, recurring: [], settings: {} });
let db = load();
const ui = { view: 'home', month: ym(new Date()), q: '', cat: '', listMonth: '', limit: 200 };

function load() {
  for (const k of [KEY, OLD_KEY]) {
    try { const d = JSON.parse(localStorage.getItem(k)); if (d && d.transactions) return migrate({ ...blank(), ...d, version: d.version || 1 }); } catch {}
  }
  return blank();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Errore nel salvataggio: ' + e.message); } }

// ---------- Migrazione dalle vecchie categorie ----------
function newCat(old, name) {
  const n = (name || '').toLowerCase().trim();
  const has = (...w) => w.some(x => n.includes(x)), re = r => r.test(n);
  switch (old) {
    case 'food':
      if (has('esselunga', 'carrefour', 'conad', 'lidl', 'coop', 'dispensa', 'supermerc') || n === 'esse') return 'groceries';
      if (re(/\bbar\b/) || has('drink', 'caff', 'colazione', 'pasticceria', 'gelat', 'spritz', 'birr', 'cocktail', 'aperitiv', 'cornetto', 'brioche')) return 'bar';
      if (has('mcdonald', 'burger', 'kfc', 'popeyes', 'kebab', 'piad', 'panin', 'wrap', 'autogrill', 'tigell', 'nando', 'subway', 'hot dog')) return 'fastfood';
      return 'restaurants';
    case 'car':
      if (has('fuel', 'iperstar', 'q8', 'benzin', 'eni', 'carbur', 'diesel', 'tamoil', 'esso') || re(/\bip\b/)) return 'fuel';
      return 'car';
    case 'transport':
      if (has('volo', 'flight', 'iberia', 'ryanair', 'easyjet', 'airways') || re(/\bita\b/)) return 'travel';
      return 'transit';
    case 'health':
      if (has('fitinn', 'gym', 'fitexpress', 'parrucch', 'taglio', 'acconc', 'palestra', 'barbier')) return 'wellness';
      return 'health';
    case 'other':
      if (has('steam', 'tennis', 'volley', 'arrampic', 'ondaland', 'milan', 'kart', 'bowling', 'concert', 'game', 'playcity', 'sigurt', 'novegro', 'cinema', 'geoguessr', 'museo', 'teatro')) return 'leisure';
      return 'other';
    case 'vacation': return 'travel';
    case 'subscriptions':
      if (re(/\btim\b/) || has('iliad', 'vodafone', 'fastweb')) return 'utilities';
      if (has('fitinn', 'gym', 'palestra')) return 'wellness';
      return 'subscriptions';
    case 'bills':
      if (has('affitto', 'rent', 'mutuo', 'condomin')) return 'housing';
      if (has('bollett', 'luce', 'enel', 'acqua', 'a2a', 'iliad') || re(/\b(gas|tim)\b/)) return 'utilities';
      return 'loans';
  }
  return CATS[old] ? old : 'other';
}
function migrate(d) {
  if (d.version >= DATA_VERSION) return d;
  const old = d.budgets || {};
  for (const t of d.transactions) { t.category = newCat(t.category, t.name); delete t.account; }
  for (const r of d.recurring || []) { r.category = newCat(r.category, r.name); delete r.account; }
  const r10 = v => Math.round(v / 10) * 10, recSum = c => -(d.recurring || []).filter(r => r.category === c).reduce((a, r) => a + r.amount, 0);
  const b = {};
  if (old.groceries) b.groceries = old.groceries;
  if (old.food) { b.restaurants = r10(old.food * .5); b.fastfood = r10(old.food * .3); b.bar = r10(old.food * .2); }
  if (old.car) { b.fuel = r10(old.car * .6); b.car = r10(old.car * .4); }
  if (old.transport) b.transit = old.transport;
  if (old.bills) { b.housing = r10(recSum('housing')); b.loans = r10(recSum('loans')); const u = old.bills - b.housing - b.loans; if (u > 0) b.utilities = r10(u + recSum('utilities')); }
  if (old.health) { b.health = r10(old.health * .6); b.wellness = r10(old.health * .4); }
  if (old.other) { b.leisure = r10(old.other / 2); b.other = r10(old.other / 2); }
  for (const k of ['shopping', 'subscriptions', 'gifts']) if (old[k]) b[k] = old[k];
  if (old.vacation) b.travel = old.vacation;
  for (const k in b) if (!b[k]) delete b[k];
  d.budgets = b; d.version = DATA_VERSION;
  return d;
}

// ---------- Utility ----------
const $ = s => document.querySelector(s);
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const money = (n, round) => (round ? eur0 : eur).format(n);
function ym(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function addMonths(m, n) { const [y, mo] = m.split('-').map(Number); return ym(new Date(y, mo - 1 + n, 1)); }
function daysIn(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); }
function monthLabel(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }
function shortMonth(m) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''); }
function today() { const d = new Date(); return ym(d) + '-' + String(d.getDate()).padStart(2, '0'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function parseNum(v) { const n = parseFloat(String(v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
const totalBudget = () => EXPENSE_CATS.reduce((a, k) => a + (+db.budgets[k] || 0), 0);

// ---------- Calcoli ----------
function monthTx(m) { return db.transactions.filter(t => t.date.startsWith(m)); }
function summary(m) {
  const byCat = {}, byGroup = {}; let income = 0;
  for (const t of monthTx(m)) {
    if (cat(t.category).income) { income += t.amount; continue; }
    byCat[t.category] = (byCat[t.category] || 0) - t.amount; // spesa netta: i rimborsi la riducono
    byGroup[cat(t.category).g] = (byGroup[cat(t.category).g] || 0) - t.amount;
  }
  const expense = Object.values(byCat).reduce((a, b) => a + b, 0);
  return { income, expense, saved: income - expense, byCat, byGroup };
}
/** mesi precedenti "completi" (almeno 10 movimenti inseriti a mano) */
function refMonths(m, max = 3) {
  const out = [];
  for (let i = 1; i <= 12 && out.length < max; i++) { const pm = addMonths(m, -i); if (monthTx(pm).filter(t => !t.recurringId).length >= 10) out.push(pm); }
  return out;
}
function cumulative(m) {
  const n = daysIn(m), daily = new Array(n + 1).fill(0);
  for (const t of monthTx(m)) if (!cat(t.category).income) daily[+t.date.slice(8, 10)] -= t.amount;
  for (let d = 1; d <= n; d++) daily[d] += daily[d - 1];
  return daily;
}

// ---------- Ricorrenti ----------
function runRecurring() {
  const now = today(), cur = now.slice(0, 7); let added = 0;
  for (const r of db.recurring) {
    if (!r.active) continue;
    let m = r.lastGenerated ? addMonths(r.lastGenerated, 1) : cur;
    while (m <= cur) {
      const date = m + '-' + String(Math.min(r.day || 1, 28)).padStart(2, '0');
      if (date > now) break;
      db.transactions.push({ id: uid(), date, category: r.category, name: r.name, amount: r.amount, recurringId: r.id });
      r.lastGenerated = m; added++; m = addMonths(m, 1);
    }
  }
  if (added) { save(); toast(added === 1 ? '1 spesa ricorrente registrata' : added + ' spese ricorrenti registrate'); }
}

// ---------- Tooltip ----------
const tip = $('#tip');
function showTip(html, x, y) {
  tip.innerHTML = html; tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y - r.height - 12;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top < 8) top = y + 16;
  tip.style.left = Math.max(8, left) + 'px'; tip.style.top = top + 'px';
}
const hideTip = () => { tip.style.display = 'none'; };
for (const ev of ['pointermove', 'pointerdown']) document.addEventListener(ev, e => {
  const el = e.target.closest?.('[data-tip]');
  if (el) showTip(el.dataset.tip, e.clientX, e.clientY);
  else if (!e.target.closest?.('[data-pace]')) hideTip();
});
addEventListener('scroll', hideTip, { passive: true });

// ---------- Grafici ----------
/** Andamento cumulativo del mese vs media dei mesi precedenti e budget */
function drawPace(el, m) {
  const W = el.clientWidth, H = 220, pl = 44, pr = 10, pt = 12, pb = 24;
  const n = daysIn(m), isCur = m === ym(new Date()), upto = isCur ? new Date().getDate() : n;
  const cur = cumulative(m), refs = refMonths(m);
  const avg = new Array(n + 1).fill(0);
  if (refs.length) for (const rm of refs) { const c = cumulative(rm); for (let d = 1; d <= n; d++) avg[d] += c[Math.min(d, c.length - 1)] / refs.length; }
  const B = totalBudget();
  const max = Math.max(1, cur[upto], refs.length ? avg[n] : 0, B) * 1.08;
  const x = d => pl + (d - 1) / (n - 1) * (W - pl - pr), y = v => pt + (1 - Math.max(v, 0) / max) * (H - pt - pb);
  let s = `<defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f59e0b" stop-opacity=".35"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></linearGradient></defs>`;
  const step = niceStep(max / 3);
  for (let v = 0; v <= max; v += step) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  for (const d of [1, 8, 15, 22, n]) s += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
  if (B) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(B)}" y2="${y(B)}" stroke="var(--bad)" stroke-dasharray="2 4" stroke-width="1.5"/><text x="${W - pr}" y="${y(B) - 5}" text-anchor="end" style="fill:var(--bad)">budget ${short(B)}</text>`;
  if (refs.length) s += `<path d="${Array.from({ length: n }, (_, i) => (i ? 'L' : 'M') + x(i + 1) + ' ' + y(avg[i + 1])).join('')}" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-dasharray="5 4"/>`;
  const line = Array.from({ length: upto }, (_, i) => (i ? 'L' : 'M') + x(i + 1) + ' ' + y(cur[i + 1])).join('');
  s += `<path d="${line}L${x(upto)} ${y(0)}L${x(1)} ${y(0)}Z" fill="url(#pg)"/><path d="${line}" fill="none" stroke="#ea580c" stroke-width="2.6" stroke-linejoin="round"/>`;
  s += `<circle cx="${x(upto)}" cy="${y(cur[upto])}" r="4.5" fill="#ea580c" stroke="var(--card)" stroke-width="2"/>`;
  s += `<g class="guide" style="display:none"><line y1="${pt}" y2="${H - pb}" stroke="var(--muted)" stroke-width="1"/><circle r="4" fill="#ea580c"/></g>`;
  s += `<rect data-pace x="${pl}" y="0" width="${W - pl - pr}" height="${H}" fill="transparent"/>`;
  el.innerHTML = `<svg width="${W}" height="${H}">${s}</svg>`;
  const ov = el.querySelector('[data-pace]'), g = el.querySelector('.guide'), [gl, gc] = g.children;
  const [yy, mo] = m.split('-').map(Number);
  const move = e => {
    const r = ov.getBoundingClientRect(), d = Math.min(n, Math.max(1, Math.round((e.clientX - r.left) / r.width * (n - 1)) + 1));
    g.style.display = ''; gl.setAttribute('x1', x(d)); gl.setAttribute('x2', x(d));
    const has = d <= upto; gc.style.display = has ? '' : 'none'; if (has) { gc.setAttribute('cx', x(d)); gc.setAttribute('cy', y(cur[d])); }
    const date = new Date(yy, mo - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    showTip(`<b>${date}</b>${has ? `<div class="r"><span>Speso</span><b>${money(cur[d], true)}</b></div>` : ''}${refs.length ? `<div class="r"><span>Media</span><span>${money(avg[d], true)}</span></div>` : ''}`, e.clientX, e.clientY);
  };
  ov.addEventListener('pointermove', move); ov.addEventListener('pointerdown', move);
  ov.addEventListener('pointerleave', () => { g.style.display = 'none'; hideTip(); });
  return refs.length;
}
/** Ultimi 12 mesi: barre impilate per gruppo + entrate */
function drawYear(el, sel) {
  const W = el.clientWidth, H = 230, pl = 44, pr = 6, pt = 10, pb = 24;
  const months = Array.from({ length: 12 }, (_, i) => addMonths(sel, i - 11)).map(m => ({ m, ...summary(m) }));
  const max = Math.max(1, ...months.map(d => Math.max(d.income, d.expense))) * 1.05;
  const bw = (W - pl - pr) / 12, y = v => pt + (1 - Math.max(v, 0) / max) * (H - pt - pb);
  let s = '';
  const step = niceStep(max / 3);
  for (let v = 0; v <= max; v += step) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  const w = Math.min(26, bw * .58);
  months.forEach((d, i) => {
    const cx = pl + bw * i + bw / 2, isSel = d.m === sel; let base = 0;
    for (const g of EXPENSE_GROUPS) {
      const v = Math.max(d.byGroup[g] || 0, 0); if (!v) continue;
      s += `<rect x="${cx - w / 2}" y="${y(base + v)}" width="${w}" height="${Math.max(y(base) - y(base + v) - 1, 0)}" fill="${GROUPS[g].color}" opacity="${isSel ? 1 : .72}" rx="2"/>`;
      base += v;
    }
    s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" style="${isSel ? 'fill:var(--ink);font-weight:700' : ''}">${shortMonth(d.m)}</text>`;
  });
  const pts = months.map((d, i) => [pl + bw * i + bw / 2, y(d.income), d.income]).filter(p => p[2] > 0);
  if (pts.length > 1) s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join('')}" fill="none" stroke="var(--good)" stroke-width="2"/>`;
  for (const p of pts) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--good)" stroke="var(--card)" stroke-width="1.5"/>`;
  months.forEach((d, i) => {
    const rows = EXPENSE_GROUPS.filter(g => d.byGroup[g] > 0).sort((a, b) => d.byGroup[b] - d.byGroup[a])
      .map(g => `<div class="r"><span>${GROUPS[g].label}</span><span>${money(d.byGroup[g], true)}</span></div>`).join('');
    const html = `<b style="text-transform:capitalize">${monthLabel(d.m)}</b><div class="r"><span>Uscite</span><b>${money(d.expense, true)}</b></div>${d.income ? `<div class="r"><span>Entrate</span><b>${money(d.income, true)}</b></div>` : ''}${rows ? '<hr style="border:0;border-top:1px solid rgba(128,128,128,.4);margin:5px 0">' + rows : ''}`;
    s += `<rect data-month="${d.m}" data-tip="${esc(html)}" x="${pl + bw * i}" y="0" width="${bw}" height="${H - pb}" fill="transparent" style="cursor:pointer"/>`;
  });
  el.innerHTML = `<svg width="${W}" height="${H}">${s}</svg>`;
}
function niceStep(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); const f = v / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
function short(v) { return v >= 1000 ? (v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k' : Math.round(v) + ''; }

// ---------- Viste ----------
function render() {
  hideTip();
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
  $('#fab').style.display = ui.view === 'settings' ? 'none' : '';
  ({ home: viewHome, list: viewList, budget: viewBudget, settings: viewSettings })[ui.view]();
}
const monthNav = () => `<div class="month-nav"><button data-mnav="-1" aria-label="Mese precedente">‹</button><span>${monthLabel(ui.month)}</span><button data-mnav="1" aria-label="Mese successivo">›</button></div>`;

function viewHome() {
  if (!db.transactions.length) {
    $('#main').innerHTML = `<div class="head"><h1>Benvenuto</h1></div>
      <div class="card empty"><p>Non ci sono ancora movimenti.</p>
      <p>Aggiungine uno con il pulsante <b>+</b>, oppure importa lo storico da <b>Impostazioni → Ripristina da file</b>.</p>
      <button class="primary" data-go="settings">Vai a Impostazioni</button></div>`;
    return;
  }
  const m = ui.month, s = summary(m), B = totalBudget();
  const isCur = m === ym(new Date()), n = daysIn(m), dayNow = isCur ? new Date().getDate() : n;
  const pct = B ? s.expense / B : 0, pace = isCur ? dayNow / n : 1;
  const left = B - s.expense;
  // gruppi
  const groups = EXPENSE_GROUPS.map(g => ({ g, v: Math.max(s.byGroup[g] || 0, 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const gt = groups.reduce((a, x) => a + x.v, 0) || 1;
  // categorie
  const rows = EXPENSE_CATS.map(k => ({ k, v: s.byCat[k] || 0, b: +db.budgets[k] || 0 }))
    .filter(r => r.v > 0 || r.b > 0).sort((a, b) => b.v - a.v);
  const maxV = Math.max(1, ...rows.map(r => Math.max(r.v, r.b)));
  const catRows = rows.map(r => {
    const over = r.b && r.v > r.b, w = r.b ? Math.min(r.v / r.b, 1) : r.v / maxV;
    const c = gcolor(r.k);
    return `<button class="crow ${r.v <= 0 ? 'zero' : ''}" data-cat-open="${r.k}">
      <span class="emo" style="background:${c}1f">${cat(r.k).emo}</span>
      <span class="nm">${cat(r.k).label}</span>
      <span class="v num ${over ? 'bad' : ''}">${money(r.v, true)}${r.b ? ` <small>/ ${money(r.b, true)}</small>` : ''}</span>
      <span class="track"><i style="width:${Math.max(w, 0) * 100}%;background:${over ? 'var(--bad)' : c}"></i></span></button>`;
  }).join('');

  $('#main').innerHTML = `
    <div class="head"><h1>Riepilogo</h1><span class="grow"></span>${monthNav()}</div>
    <div class="grid wide-left two">
      <div class="card hero">
        <div class="lbl">Speso ${isCur ? 'finora' : 'nel mese'}</div>
        <div class="big num">${money(s.expense, true)}${B ? ` <small>di ${money(B, true)}</small>` : ''}</div>
        ${B ? `<div class="meter"><i class="${pct > 1 ? 'over' : ''}" style="width:${Math.min(pct, 1) * 100}%"></i>${isCur ? `<b style="left:${pace * 100}%" title="Oggi"></b>` : ''}</div>
        <div class="meta"><span>${Math.round(pct * 100)}% del budget</span><span>${left >= 0 ? `restano ${money(left, true)}` : `sforato di ${money(-left, true)}`}${isCur && left > 0 ? ` · ${money(left / (n - dayNow + 1), true)}/giorno` : ''}</span></div>` : ''}
        <div class="hero-stats"><div><span>Entrate</span><b class="num">${money(s.income, true)}</b></div><div><span>Risparmio</span><b class="num">${money(s.saved, true)}</b></div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Andamento del mese</h2></div>
        <div class="chart" id="paceChart"></div>
        <div class="keys"><span style="--k:#ea580c">Questo mese</span><span class="dash" id="avgKey" style="--k:var(--muted)">Media mesi precedenti</span>${B ? '<span class="dash" style="--k:var(--bad)">Budget</span>' : ''}</div>
      </div>
    </div>
    <div class="grid two section">
      <div class="card">
        <div class="card-head"><h2>Per categoria</h2><span class="sub">tocca per vedere i movimenti</span></div>
        ${groups.length ? `<div class="share">${groups.map(x => `<span style="flex:${x.v};background:${GROUPS[x.g].color}" data-tip="${esc(`<b>${GROUPS[x.g].label}</b><br>${money(x.v, true)} · ${Math.round(x.v / gt * 100)}%`)}"></span>`).join('')}</div>
        <div class="legend">${groups.map(x => `<span style="--c:${GROUPS[x.g].color}">${GROUPS[x.g].label}<b>${Math.round(x.v / gt * 100)}%</b></span>`).join('')}</div>` : ''}
        ${catRows || '<p class="muted">Nessuna spesa in questo mese.</p>'}
      </div>
      <div class="card">
        <div class="card-head"><h2>Ultimi 12 mesi</h2><span class="sub">tocca un mese per aprirlo</span></div>
        <div class="chart" id="yearChart"></div>
        <div class="keys">${EXPENSE_GROUPS.map(g => `<span class="sq" style="--k:${GROUPS[g].color}">${GROUPS[g].label}</span>`).join('')}<span style="--k:var(--good)">Entrate</span></div>
      </div>
    </div>`;
  drawCharts();
}
function drawCharts() {
  const p = $('#paceChart'), y = $('#yearChart');
  if (p) { const hasAvg = drawPace(p, ui.month); $('#avgKey').style.display = hasAvg ? '' : 'none'; }
  if (y) drawYear(y, ui.month);
}
let rsz; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => ui.view === 'home' && drawCharts(), 120); });

function viewList() {
  const q = ui.q.trim().toLowerCase();
  const tx = db.transactions.filter(t =>
    (!ui.cat || t.category === ui.cat) && (!ui.listMonth || t.date.startsWith(ui.listMonth)) &&
    (!q || (t.name || '').toLowerCase().includes(q) || cat(t.category).label.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
  const out = -tx.filter(t => !cat(t.category).income).reduce((a, t) => a + t.amount, 0);
  const inc = tx.filter(t => cat(t.category).income).reduce((a, t) => a + t.amount, 0);
  const shown = tx.slice(0, ui.limit), dayTot = {};
  for (const t of shown) if (!cat(t.category).income) dayTot[t.date] = (dayTot[t.date] || 0) + t.amount;
  let html = '', lastDay = '';
  for (const t of shown) {
    if (t.date !== lastDay) {
      if (lastDay) html += '</div>';
      lastDay = t.date;
      const d = new Date(t.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: t.date.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });
      html += `<div class="day">${d}${dayTot[t.date] ? `<span class="num">${money(dayTot[t.date])}</span>` : ''}</div><div class="txs">`;
    }
    const c = cat(t.category);
    const refund = t.amount > 0 && !c.income;
    html += `<button class="tx" data-edit="${t.id}"><span class="emo" style="background:${gcolor(t.category)}1f">${c.emo}</span>
      <span class="mid"><span class="t">${esc(t.name || c.label)}</span><span class="s">${c.label}${t.recurringId ? ' · ricorrente' : ''}${refund ? ' · rimborso' : ''}</span></span>
      <span class="a num ${t.amount > 0 ? 'pos' : ''}">${t.amount > 0 ? '+' : ''}${money(t.amount)}</span></button>`;
  }
  if (lastDay) html += '</div>';
  const months = [...new Set(db.transactions.map(t => t.date.slice(0, 7)))].sort().reverse();
  const groupedOpts = Object.keys(GROUPS).map(g => `<optgroup label="${GROUPS[g].label}">${Object.keys(CATS).filter(k => CATS[k].g === g).map(k => `<option value="${k}" ${ui.cat === k ? 'selected' : ''}>${CATS[k].emo} ${CATS[k].label}</option>`).join('')}</optgroup>`).join('');
  $('#main').innerHTML = `
    <div class="head"><h1>Movimenti</h1></div>
    <div class="filters">
      <input id="q" type="search" placeholder="Cerca per nome o categoria…" value="${esc(ui.q)}">
      <select id="fm"><option value="">Tutti i mesi</option>${months.map(m => `<option value="${m}" ${ui.listMonth === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      <select id="fc"><option value="">Tutte le categorie</option>${groupedOpts}</select>
    </div>
    <div class="totals"><span class="pill">${tx.length} movimenti</span><span class="pill">Uscite <b class="num">${money(out, true)}</b></span>${inc ? `<span class="pill">Entrate <b class="num pos">${money(inc, true)}</b></span>` : ''}</div>
    ${html || '<div class="empty">Nessun movimento trovato.</div>'}
    ${tx.length > ui.limit ? `<button class="btn more" id="more">Mostra altri (${tx.length - ui.limit})</button>` : ''}`;
  const q$ = $('#q');
  q$.oninput = () => { ui.q = q$.value; ui.limit = 200; const pos = q$.selectionStart; viewList(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#fm').onchange = e => { ui.listMonth = e.target.value; viewList(); };
  $('#fc').onchange = e => { ui.cat = e.target.value; viewList(); };
  if ($('#more')) $('#more').onclick = () => { ui.limit += 400; viewList(); };
}

function viewBudget() {
  const refs = refMonths(addMonths(ym(new Date()), 1), 6);
  const avg = {}; for (const rm of refs) { const s = summary(rm); for (const k in s.byCat) avg[k] = (avg[k] || 0) + s.byCat[k] / refs.length; }
  const groupsHtml = EXPENSE_GROUPS.map(g => {
    const ks = EXPENSE_CATS.filter(k => CATS[k].g === g), sub = ks.reduce((a, k) => a + (+db.budgets[k] || 0), 0);
    return `<div class="bgroup"><div class="bgroup-h" style="--c:${GROUPS[g].color}">${GROUPS[g].label}<span class="num">${sub ? money(sub, true) : '—'}</span></div>
      ${ks.map(k => `<div class="brow"><span>${cat(k).emo}</span><div>${cat(k).label}${refs.length ? `<div class="hint">media ${money(Math.max(avg[k] || 0, 0), true)}</div>` : ''}</div>
      <input class="num" inputmode="decimal" data-bud="${k}" value="${db.budgets[k] ?? ''}" placeholder="—" aria-label="Budget ${cat(k).label}"></div>`).join('')}</div>`;
  }).join('');
  const tot = totalBudget(), inc = db.settings.incomeTarget;
  const recTot = -db.recurring.filter(r => r.active).reduce((a, r) => a + r.amount, 0);
  const catOpts = sel => EXPENSE_CATS.map(k => `<option value="${k}" ${sel === k ? 'selected' : ''}>${cat(k).emo} ${cat(k).label}</option>`).join('');
  const recRows = db.recurring.slice().sort((a, b) => a.amount - b.amount).map(r => `<div class="rec ${r.active ? '' : 'off'}" data-rec="${r.id}">
      <input data-f="name" value="${esc(r.name)}" aria-label="Nome">
      <input data-f="amount" class="num" inputmode="decimal" value="${Math.abs(r.amount)}" aria-label="Importo">
      <select data-f="category" class="c-cat" aria-label="Categoria">${catOpts(r.category)}</select>
      <input data-f="day" class="num" inputmode="numeric" value="${r.day || 1}" aria-label="Giorno del mese">
      <button class="x" data-f="toggle" title="${r.active ? 'Sospendi' : 'Riattiva'}" aria-label="${r.active ? 'Sospendi' : 'Riattiva'}">${r.active ? '⏸' : '▶'}</button></div>`).join('');
  $('#main').innerHTML = `
    <div class="head"><h1>Budget</h1></div>
    <div class="grid two">
      <div class="card">
        <div class="card-head"><h2>Budget mensile</h2><span class="sub num">totale ${money(tot, true)}</span></div>
        ${groupsHtml}
        <label class="field" style="margin-top:16px">Entrate mensili previste <input class="num" inputmode="decimal" id="incTarget" value="${inc ?? ''}" placeholder="es. 4300"></label>
        ${inc ? `<p class="note">Con questo budget risparmi circa <b class="num">${money(inc - tot, true)}</b> al mese (${Math.round((inc - tot) / inc * 100)}%).</p>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>Spese fisse ricorrenti</h2><span class="sub num">${money(recTot, true)}/mese</span></div>
        <p class="note" style="margin-top:-6px">Vengono registrate da sole ogni mese, nel giorno indicato.</p>
        <div class="rec head"><span>Nome</span><span>€</span><span class="c-cat">Categoria</span><span>Giorno</span><span></span></div>
        ${recRows || '<p class="muted">Nessuna spesa ricorrente.</p>'}
        <div class="rec new" id="newRec">
          <input id="nrName" placeholder="Nuova… es. Netflix" aria-label="Nome nuova spesa ricorrente">
          <input id="nrAmount" class="num" inputmode="decimal" placeholder="0" aria-label="Importo">
          <select id="nrCat" class="c-cat" aria-label="Categoria">${catOpts('subscriptions')}</select>
          <input id="nrDay" class="num" inputmode="numeric" value="1" aria-label="Giorno">
          <button class="x" id="nrAdd" title="Aggiungi" aria-label="Aggiungi" style="color:var(--accent-2);font-size:1.4rem">＋</button>
        </div>
        <p class="note">⏸ sospende una voce. Per eliminarla svuota il nome.</p>
      </div>
    </div>`;
  document.querySelectorAll('[data-bud]').forEach(i => i.onchange = () => {
    const v = parseNum(i.value); if (v === null || v <= 0) delete db.budgets[i.dataset.bud]; else db.budgets[i.dataset.bud] = v;
    save(); viewBudget(); toast('Budget aggiornato');
  });
  $('#incTarget').onchange = e => { const v = parseNum(e.target.value); if (v) db.settings.incomeTarget = v; else delete db.settings.incomeTarget; save(); viewBudget(); };
  document.querySelectorAll('[data-rec]').forEach(row => {
    const r = db.recurring.find(x => x.id === row.dataset.rec);
    row.querySelectorAll('[data-f]').forEach(el => {
      const f = el.dataset.f;
      if (f === 'toggle') el.onclick = () => { r.active = !r.active; if (r.active) r.lastGenerated = ym(new Date()); save(); viewBudget(); };
      else el.onchange = () => {
        if (f === 'name' && !el.value.trim()) { if (confirm(`Eliminare la spesa ricorrente "${r.name}"? I movimenti già registrati restano.`)) db.recurring = db.recurring.filter(x => x !== r); }
        else if (f === 'amount') { const v = parseNum(el.value); if (v) r.amount = -Math.abs(v); }
        else if (f === 'day') r.day = Math.min(Math.max(parseInt(el.value, 10) || 1, 1), 28);
        else r[f] = el.value.trim();
        save(); viewBudget();
      };
    });
  });
  $('#nrAdd').onclick = () => {
    const name = $('#nrName').value.trim(), amount = parseNum($('#nrAmount').value), day = Math.min(Math.max(parseInt($('#nrDay').value, 10) || 1, 1), 28);
    if (!name || !amount) return toast('Inserisci nome e importo');
    const cur = ym(new Date());
    db.recurring.push({ id: uid(), name, amount: -Math.abs(amount), category: $('#nrCat').value, day, active: true, lastGenerated: new Date().getDate() >= day ? cur : addMonths(cur, -1) });
    save(); runRecurring(); viewBudget(); toast('Spesa ricorrente aggiunta');
  };
}

function viewSettings() {
  const s = db.settings;
  $('#main').innerHTML = `
    <div class="head"><h1>Impostazioni</h1></div>
    <div class="grid two">
      <div class="card"><div class="card-head"><h2>Backup su Google Drive</h2></div>
        ${s.driveClientId ? `
          <p class="note">${s.lastDriveBackup ? 'Ultimo backup: ' + new Date(s.lastDriveBackup).toLocaleString('it-IT') : 'Nessun backup ancora.'}</p>
          <div class="stack"><button class="primary" id="driveUp">Salva su Drive</button><button class="btn" id="driveDown">Ripristina da Drive</button></div>
          <p class="note">Il file si chiama <b>${DRIVE_FILE}</b>. L'app vede solo quel file, non il resto del tuo Drive.</p>` :
          `<p class="note">Serve un "Client ID" Google, gratuito: si configura una volta sola (vedi LEGGIMI.md).</p>`}
        <label class="field">Google Client ID <input id="cid" value="${esc(s.driveClientId || '')}" placeholder="xxxx.apps.googleusercontent.com"></label>
      </div>
      <div class="card"><div class="card-head"><h2>Backup su file</h2></div>
        <p class="note">Scarica tutti i dati in un file, oppure ripristinali da un file (anche quello importato dal tuo Excel).</p>
        <div class="stack"><button class="btn" id="exp">Scarica backup</button><label class="btn" style="cursor:pointer">Ripristina da file<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <p class="note">${db.transactions.length} movimenti salvati su questo dispositivo.</p>
      </div>
      <div class="card"><div class="card-head"><h2>Cancella dati</h2></div>
        <p class="note">Elimina tutti i dati da questo dispositivo. I backup su Drive e i file scaricati restano.</p>
        <button class="danger" id="wipe" style="border:1px solid var(--bad)">Cancella tutti i dati</button>
      </div>
    </div>`;
  $('#cid').onchange = e => { s.driveClientId = e.target.value.trim() || undefined; save(); viewSettings(); };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `expenses-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importData(JSON.parse(await f.text())); } catch (err) { toast('File non valido: ' + err.message); } };
  $('#wipe').onclick = () => { if (confirm('Cancellare davvero tutti i dati da questo dispositivo? Non si può annullare.')) { db = blank(); save(); toast('Dati cancellati'); render(); } };
  if ($('#driveUp')) { $('#driveUp').onclick = driveBackup; $('#driveDown').onclick = driveRestore; }
}

// ---------- Import / export ----------
function exportData() { return { app: 'expenses', exportedAt: new Date().toISOString(), ...db }; }
function importData(d) {
  if (!d || !Array.isArray(d.transactions)) throw new Error('mancano i movimenti');
  const n = d.transactions.length;
  if (db.transactions.length && !confirm(`Sostituire i ${db.transactions.length} movimenti attuali con i ${n} del backup?`)) return;
  const keepCid = db.settings.driveClientId;
  db = migrate({ ...blank(), transactions: d.transactions, budgets: d.budgets || {}, recurring: d.recurring || [], settings: { ...(d.settings || {}) }, version: d.version || 1 });
  if (keepCid) db.settings.driveClientId = keepCid;
  save(); runRecurring(); toast(`Importati ${n} movimenti`); ui.view = 'home'; render();
}

// ---------- Google Drive ----------
const DRIVE_FILE = 'expenses-backup.json';
let gisLoaded, driveToken = null;
function loadGis() {
  return gisLoaded ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res;
    s.onerror = () => { gisLoaded = null; rej(new Error('impossibile contattare Google (sei offline?)')); };
    document.head.appendChild(s);
  });
}
async function getToken() {
  if (driveToken && driveToken.exp > Date.now()) return driveToken.v;
  await loadGis();
  return new Promise((res, rej) => {
    google.accounts.oauth2.initTokenClient({
      client_id: db.settings.driveClientId, scope: 'https://www.googleapis.com/auth/drive.file',
      callback: r => { if (r.error) return rej(new Error(r.error)); driveToken = { v: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 }; res(r.access_token); },
      error_callback: e => rej(new Error(e.message || e.type)),
    }).requestAccessToken();
  });
}
async function gfetch(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + await getToken() } });
  if (!r.ok) throw new Error('Drive ' + r.status + ': ' + (await r.text()).slice(0, 140));
  return r;
}
async function findDriveFile() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  return (await (await gfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`)).json()).files?.[0];
}
async function driveBackup() {
  try {
    toast('Salvataggio su Drive…');
    const body = JSON.stringify(exportData()), f = await findDriveFile();
    if (f) await gfetch(`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    else {
      const fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE, mimeType: 'application/json' })], { type: 'application/json' }));
      fd.append('file', new Blob([body], { type: 'application/json' }));
      await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', body: fd });
    }
    db.settings.lastDriveBackup = new Date().toISOString(); save(); viewSettings(); toast('Backup salvato su Google Drive ✓');
  } catch (e) { toast('Backup non riuscito: ' + e.message); }
}
async function driveRestore() {
  try {
    const f = await findDriveFile(); if (!f) return toast('Nessun backup trovato su Drive');
    importData(await (await gfetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`)).json());
  } catch (e) { toast('Ripristino non riuscito: ' + e.message); }
}

// ---------- Modulo movimento ----------
let editing = null, kind = 'expense', selCat = 'groceries', lastExpenseCat = null;
function renderCats() {
  const list = kind === 'income' ? INCOME_CATS : EXPENSE_CATS;
  if (!list.includes(selCat)) selCat = list[0];
  const groups = [...new Set(list.map(k => CATS[k].g))];
  $('#fCats').innerHTML = groups.map(g => `${kind === 'income' ? '' : `<div class="g">${GROUPS[g].label}</div>`}<div class="chips">${list.filter(k => CATS[k].g === g).map(k => `<button type="button" class="chip ${k === selCat ? 'on' : ''}" data-cat="${k}">${cat(k).emo} ${cat(k).label}</button>`).join('')}</div>`).join('');
  $('#fRefundWrap').style.display = kind === 'income' ? 'none' : '';
}
function renderRecent() {
  if (editing) { $('#fRecent').innerHTML = ''; return; }
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10), cnt = {};
  for (const t of db.transactions) {
    if (t.date < since || !t.name || t.recurringId || (kind === 'income') !== !!cat(t.category).income) continue;
    const k = t.name.trim().toLowerCase(); (cnt[k] ||= { n: t.name.trim(), c: 0, cats: {} }).c++; cnt[k].cats[t.category] = (cnt[k].cats[t.category] || 0) + 1;
  }
  const top = Object.values(cnt).sort((a, b) => b.c - a.c).slice(0, 8);
  $('#fRecent').innerHTML = top.map(t => `<button type="button" data-recent="${esc(t.n)}" data-rcat="${Object.entries(t.cats).sort((a, b) => b[1] - a[1])[0][0]}">${cat(Object.entries(t.cats).sort((a, b) => b[1] - a[1])[0][0]).emo} ${esc(t.n)}</button>`).join('');
}
function setKind(k) {
  kind = k;
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
  renderCats(); renderRecent();
}
function openTx(t) {
  editing = t || null;
  const c = t ? cat(t.category) : null;
  selCat = t ? t.category : (lastExpenseCat || 'groceries');
  $('#fAmount').value = t ? String(Math.abs(t.amount)).replace('.', ',') : '';
  $('#fName').value = t ? t.name || '' : '';
  $('#fDate').value = t ? t.date : today();
  $('#fRefund').checked = !!(t && t.amount > 0 && !c.income);
  $('#fDelete').style.display = t ? '' : 'none';
  $('#nameList').innerHTML = [...new Set(db.transactions.slice(-500).map(x => x.name).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('');
  setKind(t && c.income ? 'income' : 'expense');
  $('#txDialog').showModal();
  if (!t) setTimeout(() => $('#fAmount').focus(), 60);
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setKind(b.dataset.kind));
$('#fCats').onclick = e => { const b = e.target.closest('[data-cat]'); if (b) { selCat = b.dataset.cat; renderCats(); } };
$('#fRecent').onclick = e => { const b = e.target.closest('[data-recent]'); if (b) { $('#fName').value = b.dataset.recent; selCat = b.dataset.rcat; renderCats(); if (!$('#fAmount').value) $('#fAmount').focus(); } };
$('#fName').onchange = () => { // suggerisce la categoria più usata con questo nome
  if (editing) return;
  const n = $('#fName').value.trim().toLowerCase(), c = {};
  for (const t of db.transactions) if ((t.name || '').trim().toLowerCase() === n && (kind === 'income') === !!cat(t.category).income) c[t.category] = (c[t.category] || 0) + 1;
  const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  if (best) { selCat = best[0]; renderCats(); }
};
$('#fCancel').onclick = () => $('#txDialog').close();
$('#txDialog').addEventListener('click', e => { if (e.target === $('#txDialog')) $('#txDialog').close(); });
$('#fDelete').onclick = () => {
  if (editing && confirm('Eliminare questo movimento?')) { db.transactions = db.transactions.filter(t => t !== editing); save(); $('#txDialog').close(); toast('Movimento eliminato'); render(); }
};
$('#txForm').onsubmit = e => {
  e.preventDefault();
  const v = parseNum($('#fAmount').value);
  if (!v) { $('#fAmount').focus(); return toast('Inserisci un importo'); }
  const positive = kind === 'income' || $('#fRefund').checked;
  const data = { date: $('#fDate').value, category: selCat, name: $('#fName').value.trim(), amount: Math.round((positive ? Math.abs(v) : -Math.abs(v)) * 100) / 100 };
  if (editing) Object.assign(editing, data); else db.transactions.push({ id: uid(), created: Date.now(), ...data });
  if (kind === 'expense') lastExpenseCat = selCat;
  save(); $('#txDialog').close(); toast(editing ? 'Movimento aggiornato' : 'Salvato ✓'); render();
};

// ---------- Eventi globali ----------
document.querySelector('.nav').onclick = e => { const b = e.target.closest('[data-view]'); if (b) { ui.view = b.dataset.view; render(); scrollTo(0, 0); } };
$('#fab').onclick = () => openTx();
$('#main').addEventListener('click', e => {
  const n = e.target.closest('[data-mnav]'); if (n) { ui.month = addMonths(ui.month, +n.dataset.mnav); render(); return; }
  const mo = e.target.closest('[data-month]'); if (mo) { ui.month = mo.dataset.month; render(); return; }
  const co = e.target.closest('[data-cat-open]'); if (co) { ui.cat = co.dataset.catOpen; ui.listMonth = ui.month; ui.q = ''; ui.view = 'list'; render(); scrollTo(0, 0); return; }
  const ed = e.target.closest('[data-edit]'); if (ed) { openTx(db.transactions.find(t => t.id === ed.dataset.edit)); return; }
  const go = e.target.closest('[data-go]'); if (go) { ui.view = go.dataset.go; render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.target.closest('input,select,textarea,dialog')) { e.preventDefault(); openTx(); } });

// Avvio
save(); // salva subito l'eventuale migrazione
try { localStorage.removeItem(OLD_KEY); } catch {}
runRecurring();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
