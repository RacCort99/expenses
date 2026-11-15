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
const APP_VERSION = 8; // aumentala insieme a VERSION in sw.js
const KEY = 'expenses-v1', OLD_KEY = 'gruzzolo-v1', DATA_VERSION = 5;
// deleted: id → quando è stato cancellato; stamps: quando sono cambiati budget/entrate; local: impostazioni di questo dispositivo (non sincronizzate)
const blank = () => ({ version: DATA_VERSION, transactions: [], budgets: {}, recurring: [], loans: [], funds: [], settings: {}, deleted: {}, stamps: {}, local: {} });
let db = load();
const ui = { view: 'home', month: ym(new Date()), q: '', cat: '', listMonth: '', limit: 200 };

function load() {
  for (const k of [KEY, OLD_KEY]) {
    try { const d = JSON.parse(localStorage.getItem(k)); if (d && d.transactions) return migrate({ ...blank(), ...d, version: d.version || 1 }); } catch {}
  }
  return blank();
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { toast('Errore nel salvataggio: ' + e.message); return false; } }
function save() { persist(); scheduleSync(); }

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
  if (d.version < 2) migrateV2(d);
  if (d.version < 3) {
    const s = d.settings || {}; delete s.driveClientId; delete s.lastDriveBackup;
    d.settings = s; d.deleted ||= {}; d.stamps ||= {}; d.local ||= {}; d.version = 3;
  }
  if (d.version < 4) { d.loans ||= []; d.version = 4; }
  if (d.version < 5) { d.funds ||= []; d.version = 5; }
  return d;
}
function migrateV2(d) {
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
  d.budgets = b; d.version = 2;
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
function runRecurring(silent) {
  const now = today(), cur = now.slice(0, 7); let added = 0;
  for (const r of db.recurring) {
    if (!r.active) continue;
    let m = r.lastGenerated ? addMonths(r.lastGenerated, 1) : cur;
    while (m <= cur) {
      const date = m + '-' + String(Math.min(r.day || 1, 28)).padStart(2, '0');
      if (date > now) break;
      const id = `rec-${r.id}-${m}`; // stesso id su ogni dispositivo: niente doppioni dopo la sincronizzazione
      if (!db.deleted[id] && !db.transactions.some(t => t.recurringId === r.id && t.date.startsWith(m))) {
        db.transactions.push({ id, date, category: r.category, name: r.name, amount: r.amount, recurringId: r.id });
        added++;
      }
      r.lastGenerated = m; m = addMonths(m, 1);
    }
  }
  if (added) { save(); if (!silent) toast(added === 1 ? '1 spesa ricorrente registrata' : added + ' spese ricorrenti registrate'); }
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
  if (el.clientWidth < 120) return 0; // contenitore non visibile
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
  if (el.clientWidth < 120) return;
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
  hideTip(); pendingRender = false;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === (ui.view === 'loan' ? 'loans' : ui.view)));
  $('#fab').style.display = ['home', 'list', 'budget'].includes(ui.view) ? '' : 'none';
  updateLoanBadge();
  ({ home: viewHome, list: viewList, budget: viewBudget, loans: viewLoans, loan: viewLoan, savings: viewSavings, settings: viewSettings })[ui.view]();
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
  const recRows = db.recurring.slice().sort((a, b) => a.amount - b.amount).map(r => `<div class="rec2 ${r.active ? '' : 'off'}">
      <span class="emo" style="background:${gcolor(r.category)}1f">${cat(r.category).emo}</span>
      <span class="mid"><b>${esc(r.name)}</b><span class="s">${cat(r.category).label} · giorno ${r.day || 1}${r.active ? '' : ' · sospesa'}</span></span>
      <span class="amt num">${money(-r.amount)}</span>
      <button class="x" data-rtoggle="${r.id}" title="${r.active ? 'Sospendi' : 'Riattiva'}" aria-label="${r.active ? 'Sospendi' : 'Riattiva'} ${esc(r.name)}">${r.active ? '⏸' : '▶'}</button>
      <button class="x" data-redit="${r.id}" title="Modifica" aria-label="Modifica ${esc(r.name)}">✏️</button>
    </div>`).join('');
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
        <div class="recs">${recRows || '<p class="muted">Nessuna spesa ricorrente.</p>'}</div>
        <button class="btn" id="recAdd" style="margin-top:12px">+ Aggiungi spesa fissa</button>
        <p class="note">✏️ per modificare o eliminare, ⏸ per sospendere senza cancellare.</p>
      </div>
    </div>`;
  document.querySelectorAll('[data-bud]').forEach(i => i.onchange = () => {
    const v = parseNum(i.value); if (v === null || v <= 0) delete db.budgets[i.dataset.bud]; else db.budgets[i.dataset.bud] = v;
    db.stamps.budgets = Date.now(); save(); viewBudget(); toast('Budget aggiornato');
  });
  $('#incTarget').onchange = e => { const v = parseNum(e.target.value); if (v) db.settings.incomeTarget = v; else delete db.settings.incomeTarget; db.stamps.incomeTarget = Date.now(); save(); viewBudget(); };
  $('#recAdd').onclick = () => openRec(null);
  document.querySelectorAll('[data-redit]').forEach(b => b.onclick = () => openRec(b.dataset.redit));
  document.querySelectorAll('[data-rtoggle]').forEach(b => b.onclick = () => {
    const r = db.recurring.find(x => x.id === b.dataset.rtoggle); if (!r) return viewBudget();
    r.active = !r.active; r.updated = Date.now(); if (r.active) r.lastGenerated = ym(new Date());
    save(); viewBudget(); toast(r.active ? `${r.name} riattivata` : `${r.name} sospesa`);
  });
}

function viewSettings() {
  const L = db.local, on = !!L.syncUrl;
  if (!on) L.pendingKey ||= randomKey();
  const syncCard = on ? `
      <div class="card"><div class="card-head"><h2>Sincronizzazione</h2><span class="sub" id="syncStatus">${syncText()}</span></div>
        <div class="totals"><span class="pill">Su Google Drive <b class="num">${L.remoteCount ?? '—'}</b> movimenti</span><span class="pill">Su questo dispositivo <b class="num">${db.transactions.length}</b></span></div>
        ${syncState.s === 'error' ? `<p class="note bad"><b>Problema:</b> ${esc(syncState.msg)}</p>` : ''}
        <p class="note">Ogni modifica viene salvata da sola su Google Drive e arriva sugli altri dispositivi collegati quando li apri. Ogni giorno resta anche una copia nella cartella <b>Expenses backup</b> del tuo Drive.</p>
        <div class="stack"><button class="primary" id="syncNow">Sincronizza ora</button><button class="btn" id="copyLink">Copia link per un altro dispositivo</button></div>
        <p class="note">Apri quel link sul telefono (o su un altro PC) e si collega da solo. Mandalo solo a te stesso, per esempio nei "Messaggi salvati" di Telegram: chi ha il link può leggere i tuoi dati.</p>
        <button class="danger" id="unlink">Scollega questo dispositivo</button>
      </div>` : `
      <div class="card"><div class="card-head"><h2>Sincronizzazione automatica</h2></div>
        <p class="note" style="margin-top:-6px"><b>Hai già collegato un altro dispositivo?</b> Lì vai su Impostazioni → <i>Copia link per un altro dispositivo</i>, poi apri il link qui oppure incollalo sotto.</p>
        <label class="field">Link di collegamento <input id="linkIn" placeholder="https://…/expenses/#sync=…" autocomplete="off"></label>
        <button class="primary" id="linkGo">Collega</button>
        <details class="setup"><summary>Prima configurazione (una volta sola, 5 minuti)</summary>
          <ol>
            <li><button class="btn" id="copyScript">Copia il codice</button></li>
            <li>Apri <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> (crea un nuovo progetto), cancella quello che c'è e incolla.</li>
            <li>In alto a destra: <b>Esegui il deployment → Nuovo deployment</b>. Come tipo (icona ⚙) scegli <b>App web</b>, poi <b>Esegui come: Me</b> e <b>Chi ha accesso: Chiunque</b>. Premi <b>Esegui il deployment</b>.</li>
            <li>Autorizza con il tuo account Google. Se compare "App non verificata": <i>Avanzate → Vai a … (non sicuro)</i>. È il tuo script, nessun altro lo usa.</li>
            <li>Copia l'<b>URL dell'app web</b> e incollalo qui:</li>
          </ol>
          <label class="field">URL dell'app web <input id="urlIn" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
          <button class="primary" id="urlGo">Collega</button>
        </details>
      </div>`;
  $('#main').innerHTML = `
    <div class="head"><h1>Impostazioni</h1></div>
    <div class="grid two">
      ${syncCard}
      <div class="card"><div class="card-head"><h2>Backup su file</h2></div>
        <p class="note">Scarica tutti i dati in un file, oppure ripristinali da un file (anche quello importato dal tuo Excel).</p>
        <div class="stack"><button class="btn" id="exp">Scarica backup</button><label class="btn" style="cursor:pointer">Ripristina da file<input type="file" id="imp" accept=".json,application/json" hidden></label></div>
        <p class="note">${db.transactions.length} movimenti su questo dispositivo.</p>
        <p class="note">Versione app: <b>${APP_VERSION}</b></p>
      </div>
      <div class="card"><div class="card-head"><h2>Cancella dati</h2></div>
        <p class="note">Elimina tutti i dati da questo dispositivo e lo scollega dalla sincronizzazione. I dati su Google Drive e i file scaricati restano.</p>
        <button class="danger" id="wipe" style="border:1px solid var(--bad)">Cancella tutti i dati</button>
      </div>
    </div>`;
  persist();
  if (on) {
    $('#syncNow').onclick = () => sync();
    $('#copyLink').onclick = () => copyText(location.origin + location.pathname + '#sync=' + b64enc(JSON.stringify({ u: L.syncUrl, k: L.syncKey })));
    $('#unlink').onclick = () => { if (confirm('Scollegare questo dispositivo? I dati restano qui e su Drive, ma non verranno più sincronizzati.')) { delete L.syncUrl; delete L.syncKey; delete L.lastSync; persist(); setSync('off'); viewSettings(); } };
  } else {
    $('#copyScript').onclick = () => copyText(syncScript(L.pendingKey));
    $('#urlGo').onclick = () => connect($('#urlIn').value, L.pendingKey);
    $('#linkGo').onclick = () => {
      const m = $('#linkIn').value.match(/sync=([\w-]+)/);
      try { const { u, k } = JSON.parse(b64dec(m[1])); connect(u, k); } catch { toast('Link non valido: copialo di nuovo dall\'altro dispositivo'); }
    };
  }
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `expenses-backup-${today()}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#imp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importData(JSON.parse(await f.text())); } catch (err) { toast('File non valido: ' + err.message); } };
  $('#wipe').onclick = () => { if (confirm('Cancellare davvero tutti i dati da questo dispositivo? Non si può annullare.')) { db = blank(); persist(); setSync('off'); toast('Dati cancellati'); render(); } };
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiato ✓'); } catch { prompt('Copia questo testo:', t); }
}

// ---------- Prestiti ----------
// loan: { id, name, kind: 'debt' (paghi tu) | 'credit' (ti devono), total, linkExpense, note, updated,
//         installments: [{ n, date, amount, paid, doc }] }
const fmtDate = (d, opt = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', opt);
function loanStats(l) {
  const inst = [...l.installments].sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n);
  const paid = inst.filter(i => i.paid).reduce((a, i) => a + i.amount, 0);
  const now = today();
  const overdue = inst.filter(i => !i.paid && i.date < now);
  return {
    inst, paid, overdue, remaining: Math.max(l.total - paid, 0),
    pct: l.total ? Math.min(paid / l.total, 1) : 0,
    next: inst.find(i => !i.paid), last: inst.at(-1),
    unscheduled: Math.max(l.total - inst.reduce((a, i) => a + i.amount, 0), 0),
  };
}
function updateLoanBadge() {
  const n = db.loans.filter(l => l.kind === 'debt').reduce((a, l) => a + loanStats(l).overdue.length, 0);
  const b = $('#loanBadge'); b.textContent = n > 99 ? '99+' : n; b.hidden = !n;
}
/** Segna una rata pagata o da pagare; se il prestito è collegato alle spese registra (o toglie) il movimento */
function setPaid(l, inst, paid) {
  inst.paid = paid; l.updated = Date.now();
  const id = `loan-${l.id}-${inst.n}`;
  if (paid && l.linkExpense) {
    if (!db.transactions.some(t => t.id === id))
      db.transactions.push({ id, date: today(), category: l.kind === 'debt' ? 'loans' : 'income', name: l.name, amount: l.kind === 'debt' ? -inst.amount : inst.amount, loanId: l.id, updated: Date.now() });
  } else if (!paid && db.transactions.some(t => t.id === id)) {
    db.transactions = db.transactions.filter(t => t.id !== id); db.deleted[id] = Date.now();
  }
}
function makeSchedule(startN, count, amount, firstDate, total) {
  const out = []; const [y, m, d] = firstDate.split('-').map(Number); let left = total ?? Infinity;
  for (let i = 0; i < count && left > 0.004; i++) {
    const dt = new Date(y, m - 1 + i, 1); const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    const date = ym(dt) + '-' + String(Math.min(d, last)).padStart(2, '0');
    const amt = Math.round(Math.min(amount, left) * 100) / 100; left -= amt;
    out.push({ n: startN + i, date, amount: amt, paid: false, doc: false });
  }
  return out;
}

function viewLoans() {
  updateLoanBadge();
  const st = db.loans.map(l => ({ l, s: loanStats(l) })).sort((a, b) => (a.s.next?.date || '9999').localeCompare(b.s.next?.date || '9999')); // le più urgenti prima
  const debt = st.filter(x => x.l.kind === 'debt'), credit = st.filter(x => x.l.kind === 'credit');
  const endMonth = ym(new Date()) + '-31';
  const dueNow = debt.flatMap(x => x.s.inst.filter(i => !i.paid && i.date <= endMonth)).reduce((a, i) => a + i.amount, 0);
  const card = ({ l, s }) => {
    const od = s.overdue.length, isDebt = l.kind === 'debt';
    return `<div class="card loan" data-loan="${l.id}">
      <div class="lh"><span class="lname">${esc(l.name)}</span><span class="badge ${isDebt ? 'debt' : 'credit'}">${isDebt ? 'Debito' : 'Credito'}</span></div>
      <div class="lrem num"><b>${money(s.remaining, true)}</b> <small>${isDebt ? 'da restituire' : 'da ricevere'} su ${money(l.total, true)}</small></div>
      <div class="lbar"><i style="width:${s.pct * 100}%"></i></div>
      <div class="lmeta"><span>${Math.round(s.pct * 100)}% ${isDebt ? 'pagato' : 'ricevuto'}</span><span>${s.last ? 'ultima rata ' + fmtDate(s.last.date, { month: 'short', year: 'numeric' }) : 'nessuna rata pianificata'}</span></div>
      ${s.next ? `<div class="lnext">
          <span>${od ? `<b class="bad">${od} ${od === 1 ? 'rata scaduta' : 'rate scadute'}</b> · ` : ''}Prossima: <b class="num">${money(s.next.amount)}</b> · ${fmtDate(s.next.date)}</span>
          <button class="btn sm" data-pay="${l.id}">✓ ${isDebt ? 'Pagata' : 'Ricevuta'}</button></div>` : s.remaining > 0 ? '' : '<div class="lnext"><b class="pos">Chiuso 🎉</b></div>'}
    </div>`;
  };
  $('#main').innerHTML = `
    <div class="head"><h1>Prestiti</h1></div>
    ${db.loans.length ? `<div class="kpis">
      <div class="card"><span>Debiti residui</span><b class="num">${money(debt.reduce((a, x) => a + x.s.remaining, 0), true)}</b></div>
      <div class="card"><span>Da pagare entro fine mese</span><b class="num ${dueNow ? '' : 'pos'}">${money(dueNow, true)}</b></div>
      <div class="card"><span>Ti devono ancora</span><b class="num">${money(credit.reduce((a, x) => a + x.s.remaining, 0), true)}</b></div>
    </div>` : `<div class="card empty"><p>Nessun prestito ancora.</p><p>Aggiungine uno qui sotto oppure importa quelli del tuo Excel.</p></div>`}
    ${debt.length ? `<h2 class="sec">I tuoi debiti</h2><div class="grid two">${debt.map(card).join('')}</div>` : ''}
    ${credit.length ? `<h2 class="sec">Ti devono</h2><div class="grid two">${credit.map(card).join('')}</div>` : ''}
    <div class="grid two section">
      <div class="card"><div class="card-head"><h2>Nuovo prestito</h2></div>
        <div class="seg" id="nlKind"><button type="button" data-k="debt" class="on">Devo pagare</button><button type="button" data-k="credit">Mi devono</button></div>
        <div class="form2">
          <label class="field">Nome <input id="nlName" placeholder="es. Finanziamento auto"></label>
          <label class="field">Importo totale € <input id="nlTotal" class="num" inputmode="decimal"></label>
          <label class="field">Rata mensile € <input id="nlRate" class="num" inputmode="decimal"></label>
          <label class="field">Prima rata <input id="nlDate" type="date" value="${today()}"></label>
        </div>
        <label class="check-row"><input type="checkbox" id="nlLink" checked> Quando segno una rata, registrala anche tra le spese</label>
        <button class="primary" id="nlAdd">Crea prestito</button>
      </div>
      <div class="card"><div class="card-head"><h2>Importa</h2></div>
        <p class="note">Carica il file <b>prestiti.json</b> (nella cartella <i>import</i>) con i prestiti del tuo Excel. Quelli già presenti non vengono duplicati.</p>
        <label class="btn" style="cursor:pointer;display:inline-block">Importa prestiti da file<input type="file" id="lImp" accept=".json,application/json" hidden></label>
      </div>
    </div>`;
  let kind = 'debt';
  document.querySelectorAll('#nlKind button').forEach(b => b.onclick = () => { kind = b.dataset.k; document.querySelectorAll('#nlKind button').forEach(x => x.classList.toggle('on', x === b)); });
  $('#nlAdd').onclick = () => {
    const name = $('#nlName').value.trim(), total = parseNum($('#nlTotal').value), rate = parseNum($('#nlRate').value), first = $('#nlDate').value;
    if (!name || !total || !rate || !first) return toast('Compila nome, totale, rata e data');
    const l = { id: 'l-' + uid(), name, kind, total, linkExpense: $('#nlLink').checked, updated: Date.now(), installments: makeSchedule(1, Math.ceil(total / rate), rate, first, total) };
    db.loans.push(l); save(); toast(`Creato: ${l.installments.length} rate`); ui.view = 'loan'; ui.loanId = l.id; render(); scrollTo(0, 0);
  };
  $('#lImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { importLoans(JSON.parse(await f.text())); } catch (err) { toast('File non valido: ' + err.message); } };
}
function importLoans(d) {
  const list = Array.isArray(d) ? d : d.loans;
  if (!Array.isArray(list)) throw new Error('nessun prestito nel file');
  let added = 0;
  for (const l of list) if (!db.loans.some(x => x.id === l.id)) { db.loans.push({ ...l, updated: Date.now() }); delete db.deleted[l.id]; added++; }
  save(); toast(added ? `Importati ${added} prestiti` : 'Erano già tutti presenti'); ui.view = 'loans'; render();
}

function viewLoan() {
  updateLoanBadge();
  const l = db.loans.find(x => x.id === ui.loanId);
  if (!l) { ui.view = 'loans'; return viewLoans(); }
  const s = loanStats(l), isDebt = l.kind === 'debt', paidWord = isDebt ? 'pagata' : 'ricevuta';
  const showAll = ui.showPaid;
  let remaining = l.total;
  const rows = s.inst.map(i => {
    remaining -= i.paid ? i.amount : 0;
    if (i.paid && !showAll) return '';
    const late = !i.paid && i.date < today();
    return `<div class="inst ${i.paid ? 'paid' : ''} ${late ? 'late' : ''}" data-n="${i.n}">
      <label class="tick"><input type="checkbox" data-f="paid" ${i.paid ? 'checked' : ''} aria-label="Rata ${i.n} ${paidWord}"></label>
      <span class="nr">#${i.n}</span>
      <input type="date" data-f="date" value="${i.date}" aria-label="Data rata ${i.n}">
      <input class="num" data-f="amount" inputmode="decimal" value="${String(i.amount).replace('.', ',')}" aria-label="Importo rata ${i.n}">
      <button class="doc ${i.doc ? 'on' : ''}" data-f="doc" title="Ricevuta salvata">📄</button>
    </div>`;
  }).join('');
  const nPaid = s.inst.filter(i => i.paid).length;
  $('#main').innerHTML = `
    <div class="head"><button class="btn sm" id="back">‹ Prestiti</button><h1>${esc(l.name)}</h1></div>
    <div class="grid wide-left two">
      <div class="card hero">
        <div class="lbl">${isDebt ? 'Ancora da restituire' : 'Ancora da ricevere'}</div>
        <div class="big num">${money(s.remaining)} <small>di ${money(l.total, true)}</small></div>
        <div class="meter"><i style="width:${s.pct * 100}%"></i></div>
        <div class="meta"><span>${Math.round(s.pct * 100)}% · ${nPaid} rate su ${s.inst.length}</span><span>${s.last ? 'fine ' + fmtDate(s.last.date, { month: 'long', year: 'numeric' }) : ''}</span></div>
        ${s.unscheduled > 0.01 ? `<div class="meta"><span>⚠️ ${money(s.unscheduled)} non coperti da rate pianificate</span></div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>Dettagli</h2></div>
        <div class="form2">
          <label class="field">Nome <input id="lName" value="${esc(l.name)}"></label>
          <label class="field">Importo totale € <input id="lTotal" class="num" inputmode="decimal" value="${String(l.total).replace('.', ',')}"></label>
        </div>
        <label class="check-row"><input type="checkbox" id="lLink" ${l.linkExpense ? 'checked' : ''}> Quando segno una rata, registrala tra le ${isDebt ? 'spese (Prestiti & Rate)' : 'entrate'}</label>
        <label class="check-row"><input type="checkbox" id="lKind" ${isDebt ? '' : 'checked'}> Sono soldi che mi devono (credito)</label>
      </div>
    </div>
    <div class="card section">
      <div class="card-head"><h2>Rate</h2>
        <span class="sub">${s.overdue.length ? `<button class="btn sm" id="payLate">✓ Segna le ${s.overdue.length} scadute come ${isDebt ? 'pagate' : 'ricevute'}</button>` : ''}</span></div>
      ${nPaid ? `<button class="linkbtn" id="togglePaid">${showAll ? 'Nascondi' : 'Mostra'} le ${nPaid} rate già ${isDebt ? 'pagate' : 'ricevute'}</button>` : ''}
      <div class="insts">${rows || `<p class="muted">${s.inst.length ? 'Tutte le rate sono ' + (isDebt ? 'pagate' : 'ricevute') + ' 🎉' : 'Nessuna rata pianificata.'}</p>`}</div>
      <div class="addinst">
        <span class="note">Aggiungi rate mensili:</span>
        <input id="aiCount" class="num" inputmode="numeric" placeholder="n°" aria-label="Numero di rate">
        <span class="note">da €</span><input id="aiAmount" class="num" inputmode="decimal" placeholder="${s.inst.at(-1)?.amount ?? ''}" aria-label="Importo">
        <span class="note">dal</span><input id="aiDate" type="date" value="${s.last ? ym(new Date(new Date(s.last.date).getFullYear(), new Date(s.last.date).getMonth() + 1, 1)) + s.last.date.slice(7) : today()}" aria-label="Prima data">
        <button class="btn sm" id="aiAdd">Aggiungi</button>
      </div>
    </div>
    <button class="danger section" id="lDel" style="display:block">Elimina questo prestito</button>`;
  const touch = () => { l.updated = Date.now(); save(); };
  $('#back').onclick = () => { ui.view = 'loans'; render(); };
  $('#lName').onchange = e => { if (e.target.value.trim()) { l.name = e.target.value.trim(); touch(); viewLoan(); } };
  $('#lTotal').onchange = e => { const v = parseNum(e.target.value); if (v) { l.total = v; touch(); viewLoan(); } };
  $('#lLink').onchange = e => { l.linkExpense = e.target.checked; touch(); toast(l.linkExpense ? 'Le prossime rate segnate andranno anche tra le spese' : 'Le rate non verranno più registrate tra le spese'); };
  $('#lKind').onchange = e => { l.kind = e.target.checked ? 'credit' : 'debt'; touch(); viewLoan(); };
  if ($('#togglePaid')) $('#togglePaid').onclick = () => { ui.showPaid = !ui.showPaid; viewLoan(); };
  if ($('#payLate')) $('#payLate').onclick = () => {
    if (!confirm(`Segnare ${s.overdue.length} rate scadute come ${isDebt ? 'pagate' : 'ricevute'}?` + (l.linkExpense ? '\nVerranno registrate anche tra i movimenti con la data di oggi.' : ''))) return;
    for (const i of s.overdue) setPaid(l, i, true);
    touch(); toast('Fatto ✓'); viewLoan();
  };
  document.querySelectorAll('.inst').forEach(row => {
    const i = l.installments.find(x => x.n === +row.dataset.n);
    row.querySelectorAll('[data-f]').forEach(el => {
      const f = el.dataset.f;
      if (f === 'paid') el.onchange = () => { setPaid(l, i, el.checked); touch(); viewLoan(); };
      else if (f === 'doc') el.onclick = () => { i.doc = !i.doc; touch(); el.classList.toggle('on', i.doc); };
      else el.onchange = () => { if (f === 'date' && el.value) i.date = el.value; if (f === 'amount') { const v = parseNum(el.value); if (v > 0) i.amount = v; } touch(); viewLoan(); };
    });
  });
  $('#aiAdd').onclick = () => {
    const n = parseInt($('#aiCount').value, 10), amt = parseNum($('#aiAmount').value || $('#aiAmount').placeholder), d = $('#aiDate').value;
    if (!n || !amt || !d) return toast('Indica numero di rate, importo e data');
    const start = Math.max(0, ...l.installments.map(x => x.n)) + 1;
    l.installments.push(...makeSchedule(start, n, amt, d)); touch(); toast(`Aggiunte ${n} rate`); viewLoan();
  };
  $('#lDel').onclick = () => {
    if (!confirm(`Eliminare il prestito "${l.name}" con tutte le sue rate? I movimenti già registrati tra le spese restano.`)) return;
    db.loans = db.loans.filter(x => x !== l); db.deleted[l.id] = Date.now(); save(); ui.view = 'loans'; render();
  };
}
// pulsante "✓ Pagata" sulle schede della lista
document.addEventListener('click', e => {
  const pay = e.target.closest('[data-pay]');
  if (pay) {
    const l = db.loans.find(x => x.id === pay.dataset.pay), s = loanStats(l);
    if (s.next) { setPaid(l, s.next, true); l.updated = Date.now(); save(); toast(`Rata #${s.next.n} di ${l.name}: ${l.kind === 'debt' ? 'pagata' : 'ricevuta'} ✓`); render(); }
    return;
  }
  const card = e.target.closest('[data-loan]');
  if (card) { ui.view = 'loan'; ui.loanId = card.dataset.loan; ui.showPaid = false; render(); scrollTo(0, 0); }
});

// ---------- Import / export ----------
function exportData() { const { local, ...rest } = db; return { app: 'expenses', exportedAt: new Date().toISOString(), ...rest }; }
function importData(d) {
  if (d && d.type === 'loans') return importLoans(d);
  if (!d || !Array.isArray(d.transactions)) throw new Error('mancano i movimenti');
  const n = d.transactions.length;
  if (db.transactions.length && !confirm(`Sostituire i ${db.transactions.length} movimenti di questo dispositivo con i ${n} del file?` + (db.local.syncUrl ? '\n\nCon la sincronizzazione attiva, i movimenti presenti su Drive verranno poi uniti a questi.' : ''))) return;
  const local = db.local;
  db = migrate({ ...blank(), transactions: d.transactions, budgets: d.budgets || {}, recurring: d.recurring || [], loans: d.loans || [], funds: d.funds || [], settings: { incomeTarget: d.settings?.incomeTarget, savings: d.settings?.savings }, deleted: d.deleted || {}, stamps: d.stamps || {}, version: d.version || 1 });
  db.local = local; db.stamps.budgets = db.stamps.incomeTarget = db.stamps.savings = Date.now(); // l'import esplicito vince sui budget remoti
  save(); runRecurring(); toast(`Importati ${n} movimenti`); ui.view = 'home'; render();
}

// ---------- Sincronizzazione (Google Drive tramite un Google Apps Script personale) ----------
let syncQueued = false, syncTimer = null, syncState = { s: 'off', msg: '' }, pendingRender = false;
function randomKey() { const a = new Uint8Array(24); crypto.getRandomValues(a); return b64enc(String.fromCharCode(...a)); }
function b64enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64dec(s) { return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))); }
function ago(ts) { const s = (Date.now() - ts) / 1000; if (s < 60) return 'adesso'; if (s < 3600) return Math.round(s / 60) + ' min fa'; return new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function syncText() {
  if (syncState.s === 'busy') return 'Sincronizzazione…';
  if (syncState.s === 'error') return '⚠️ ' + esc(syncState.msg);
  return db.local.lastSync ? '✓ Sincronizzato ' + ago(db.local.lastSync) : 'In attesa…';
}
function setSync(s, msg = '') {
  syncState = { s, msg };
  $('#syncDot').dataset.s = db.local.syncUrl ? s : 'off';
  const el = $('#syncStatus'); if (el) el.innerHTML = syncText();
}
function scheduleSync(ms = 1500) { if (!db.local.syncUrl) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms); }
async function call(body) {
  let r;
  try { r = await fetch(db.local.syncUrl, { method: 'POST', body: JSON.stringify({ ...body, key: db.local.syncKey }) }); }
  catch { throw new Error(navigator.onLine ? 'Google Drive non raggiungibile' : 'sei offline, riprovo dopo'); }
  let j; try { j = await r.json(); } catch { throw new Error('Google ha risposto con un errore. Controlla che il deployment sia "App web" con accesso "Chiunque" e di aver autorizzato lo script.'); }
  if (j.error) throw new Error(j.error === 'unauthorized' ? 'chiave di sincronizzazione non valida' : j.error);
  return j;
}
/** I dati che viaggiano su Drive (senza le impostazioni locali), in ordine stabile per poterli confrontare */
function payload(d) {
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { version: DATA_VERSION, transactions: [...(d.transactions || [])].sort(byId), recurring: [...(d.recurring || [])].sort(byId), loans: [...(d.loans || [])].sort(byId), funds: [...(d.funds || [])].sort(byId), budgets: d.budgets || {}, settings: { incomeTarget: d.settings?.incomeTarget, savings: d.settings?.savings }, deleted: d.deleted || {}, stamps: d.stamps || {} };
}
/** Unisce i dati di due dispositivi: per ogni movimento vince la modifica più recente, le cancellazioni valgono per tutti */
function mergeData(a, b) {
  const del = { ...(b.deleted || {}) };
  for (const [k, v] of Object.entries(a.deleted || {})) del[k] = Math.max(del[k] || 0, v);
  const pick = (la, lb) => {
    const m = new Map();
    for (const x of [...(lb || []), ...(la || [])]) { const o = m.get(x.id); if (!o || (x.updated || 0) >= (o.updated || 0)) m.set(x.id, x); }
    return [...m.values()].filter(x => !(del[x.id] && del[x.id] >= (x.updated || 0)));
  };
  // una sola registrazione per spesa ricorrente e mese, anche se generata su due dispositivi
  const seen = new Set();
  const transactions = pick(a.transactions, b.transactions)
    .sort((x, y) => (y.id.startsWith('rec-') ? 1 : 0) - (x.id.startsWith('rec-') ? 1 : 0))
    .filter(t => { if (!t.recurringId) return true; const k = t.recurringId + '|' + t.date.slice(0, 7); if (seen.has(k)) return false; seen.add(k); return true; });
  const lastGen = id => [...(a.recurring || []), ...(b.recurring || [])].filter(x => x.id === id).map(x => x.lastGenerated).filter(Boolean).sort().pop();
  const recurring = pick(a.recurring, b.recurring).map(r => ({ ...r, lastGenerated: lastGen(r.id) }));
  const sa = a.stamps || {}, sb = b.stamps || {};
  const newer = (k, va, vb, empty) => (sa[k] || 0) > (sb[k] || 0) ? va : (sb[k] || 0) > (sa[k] || 0) ? vb : (empty(va) ? vb : va);
  const budgets = newer('budgets', a.budgets, b.budgets, v => !v || !Object.keys(v).length);
  const incomeTarget = newer('incomeTarget', a.settings?.incomeTarget, b.settings?.incomeTarget, v => v == null);
  const savings = newer('savings', a.settings?.savings, b.settings?.savings, v => v == null);
  return {
    transactions, recurring, loans: pick(a.loans, b.loans), funds: pick(a.funds, b.funds), budgets: { ...budgets }, settings: { ...a.settings, incomeTarget, savings }, deleted: del,
    stamps: { budgets: Math.max(sa.budgets || 0, sb.budgets || 0), incomeTarget: Math.max(sa.incomeTarget || 0, sb.incomeTarget || 0), savings: Math.max(sa.savings || 0, sb.savings || 0) },
  };
}
let syncRun = null;
/** Avvia una sincronizzazione (o restituisce quella già in corso). Risolve con { ok, error } */
function sync() {
  if (!db.local.syncUrl) return Promise.resolve({ ok: false, error: 'non collegato' });
  if (syncRun) { syncQueued = true; return syncRun; }
  syncRun = doSync().finally(() => { syncRun = null; if (syncQueued) { syncQueued = false; scheduleSync(300); } });
  return syncRun;
}
/** Riusa gli oggetti già in memoria (aggiornandone i campi), così le schermate aperte continuano a modificare quelli giusti */
function keepIdentity(localArr, mergedArr) {
  const byId = new Map(localArr.map(o => [o.id, o]));
  return mergedArr.map(m => {
    const o = byId.get(m.id);
    if (!o || o === m) return m;
    for (const k of Object.keys(o)) if (!(k in m)) delete o[k];
    return Object.assign(o, m);
  });
}
/** Ridisegna, ma non mentre stai scrivendo in un campo o hai aperto il modulo di un movimento */
const typing = () => { const a = document.activeElement; return !!a && a.matches('#main input, #main select, #main textarea'); };
function renderWhenIdle() { if (document.querySelector('dialog[open]') || typing()) pendingRender = true; else render(); }
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !document.querySelector('dialog[open]') && !typing()) { pendingRender = false; render(); } }, 0));
async function doSync() {
  clearTimeout(syncTimer); setSync('busy');
  try {
    let changed = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = await call({ action: 'get' });
      const before = JSON.stringify(payload(db));
      if (r.data) {
        const m = mergeData(db, r.data);
        for (const k of ['transactions', 'recurring', 'loans', 'funds']) m[k] = keepIdentity(db[k] || [], m[k]);
        Object.assign(db, m);
      }
      if (JSON.stringify(payload(db)) !== before) { changed = true; runRecurring(true); }
      persist();
      const out = payload(db);
      if (r.data && JSON.stringify(out) === JSON.stringify(payload(r.data))) { db.local.remoteCount = out.transactions.length; break; } // Drive è già aggiornato
      const p = await call({ action: 'put', base: r.updated || 0, data: out });
      if (!p.conflict) { db.local.remoteCount = out.transactions.length; break; } // altrimenti un altro dispositivo ha salvato nel frattempo: riunisco e riprovo
    }
    db.local.lastSync = Date.now(); persist(); setSync('ok');
    if (changed || ui.view === 'settings') renderWhenIdle();
    return { ok: true };
  } catch (e) {
    setSync('error', e.message);
    if (ui.view === 'settings') renderWhenIdle();
    return { ok: false, error: e.message };
  }
}
async function connect(url, key) {
  url = (url || '').trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) return toast("L'indirizzo deve iniziare con https://script.google.com/");
  const prev = { ...db.local };
  Object.assign(db.local, { syncUrl: url, syncKey: key }); delete db.local.lastSync;
  try { setSync('busy'); await call({ action: 'get' }); toast('Collegamento in corso…'); }
  catch (e) { db.local = prev; persist(); setSync('off'); toast('Collegamento non riuscito: ' + e.message); return; }
  delete db.local.pendingKey; persist();
  const res = await sync();
  if (res.ok) toast(`Collegato ✓ ${db.transactions.length} movimenti su questo dispositivo`);
  else toast('Collegato, ma la sincronizzazione non è riuscita: ' + res.error);
  if (ui.view === 'settings') viewSettings();
}
function readSyncLink() {
  const m = location.hash.match(/sync=([\w-]+)/); if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try { const { u, k } = JSON.parse(b64dec(m[1])); ui.view = 'settings'; connect(u, k); } catch { toast('Link di collegamento non valido'); }
}
function syncScript(key) {
  return `// Expenses: sincronizzazione su Google Drive. Incolla tutto in un nuovo progetto su script.google.com
// e pubblicalo come App web (Esegui come: Me, Chi ha accesso: Chiunque).
const KEY = '${key}'; // chiave segreta: non condividerla
const FILE = 'expenses-sync.json';
const BACKUP_FOLDER = 'Expenses backup';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return handle_(e);
  } catch (err) {
    return out_({ error: 'errore nello script Google: ' + err });
  } finally {
    lock.releaseLock();
  }
}

function handle_(e) {
  {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== KEY) return out_({ error: 'unauthorized' });
    const props = PropertiesService.getScriptProperties();
    const updated = Number(props.getProperty('updated') || 0);
    const file = file_();
    if (body.action === 'get') {
      return out_({ data: file ? JSON.parse(file.getBlob().getDataAsString()) : null, updated: updated });
    }
    if (body.action === 'put') {
      if ((body.base || 0) !== updated) return out_({ conflict: true, updated: updated });
      const text = JSON.stringify(body.data);
      if (file) file.setContent(text); else DriveApp.createFile(FILE, text, MimeType.PLAIN_TEXT);
      const now = Date.now();
      props.setProperty('updated', String(now));
      dailyBackup_(text);
      return out_({ ok: true, updated: now });
    }
    return out_({ error: 'azione sconosciuta' });
  }
}

function doGet() { return out_({ ok: true, app: 'expenses-sync' }); }

function file_() {
  const it = DriveApp.getFilesByName(FILE);
  return it.hasNext() ? it.next() : null;
}

// una copia al giorno nella cartella "Expenses backup", tiene gli ultimi 60 giorni
function dailyBackup_(text) {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
  const name = 'expenses-' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd') + '.json';
  const same = folder.getFilesByName(name);
  if (same.hasNext()) same.next().setContent(text); else folder.createFile(name, text, MimeType.PLAIN_TEXT);
  const files = [];
  const all = folder.getFiles();
  while (all.hasNext()) files.push(all.next());
  files.sort(function (a, b) { return b.getName().localeCompare(a.getName()); });
  files.slice(60).forEach(function (f) { f.setTrashed(true); });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
}


// ---------- Risparmi ----------
// settings.savings = { balance, at }  (saldo del conto risparmi, inserito a mano)
// funds: [{ id, name, emo, target, due: 'YYYY-MM' | '', allocated, category, updated }]
const FUND_COLORS = ['#f59e0b', '#0d9488', '#2563eb', '#db2777', '#7c3aed', '#16a34a', '#ea580c', '#0891b2', '#b45309', '#64748b'];
const fundColor = f => FUND_COLORS[Math.abs([...f.id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % FUND_COLORS.length];
const monthsUntil = due => { if (!due) return null; const [y, m] = due.split('-').map(Number), n = new Date(); return (y * 12 + m) - (n.getFullYear() * 12 + n.getMonth() + 1); };
const dueLabel = due => due ? new Date(+due.slice(0, 4), +due.slice(5, 7) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) : '';
function fundNeed(f) { // quanto mettere da parte al mese per arrivare all'obiettivo in tempo
  if (!f.target || f.allocated >= f.target) return 0;
  const n = monthsUntil(f.due);
  return n == null ? 0 : (f.target - f.allocated) / Math.max(n, 1);
}
/** Risparmio mensile stimato = entrate medie − spese variabili medie − spese fisse attuali.
 *  Le spese fisse si prendono dalle ricorrenti attive (non dai mesi passati, dove spesso mancano). */
const FIXED_CATS = ['housing', 'utilities', 'loans', 'subscriptions'];
function avgSaving() {
  const ms = refMonths(ym(new Date()), 6).filter(m => summary(m).income > 0);
  if (!ms.length) return null;
  const s = ms.map(summary), n = ms.length;
  const income = s.reduce((a, x) => a + x.income, 0) / n;
  const variable = s.reduce((a, x) => a + EXPENSE_CATS.filter(k => !FIXED_CATS.includes(k)).reduce((b, k) => b + (x.byCat[k] || 0), 0), 0) / n;
  const recFixed = -db.recurring.filter(r => r.active).reduce((a, r) => a + r.amount, 0);
  const pastFixed = s.reduce((a, x) => a + FIXED_CATS.reduce((b, k) => b + (x.byCat[k] || 0), 0), 0) / n;
  const fixed = Math.max(recFixed, pastFixed); // la più alta delle due: meglio una stima prudente
  return { months: n, income, variable, fixed, expense: variable + fixed, saved: income - variable - fixed };
}
/** Spese irregolari degli ultimi 12 mesi → fondi suggeriti */
function fundSuggestions() {
  const cur = ym(new Date()), months = Array.from({ length: 12 }, (_, i) => addMonths(cur, -i - 1));
  const year = {}; for (const m of months) for (const [k, v] of Object.entries(summary(m).byCat)) year[k] = (year[k] || 0) + v;
  const linked = new Set(db.funds.map(f => f.category).filter(Boolean));
  const names = { travel: 'Viaggi', gifts: 'Regali', car: 'Auto (assicurazione, bollo, manutenzione)', health: 'Salute', shopping: 'Acquisti importanti' };
  const out = Object.keys(names).filter(k => !linked.has(k) && (year[k] || 0) >= 150)
    .map(k => ({ key: k, name: names[k], emo: cat(k).emo, category: k, yearly: year[k], monthly: year[k] / 12 }));
  const avg = avgSaving();
  if (avg && !db.funds.some(f => /emergen/i.test(f.name))) out.unshift({ key: 'emergency', name: 'Fondo emergenza', emo: '🛟', category: '', target: Math.round(avg.expense * 3 / 100) * 100, monthly: 0 });
  return out;
}
function savingsState() {
  const sv = db.settings.savings || {}, balance = +sv.balance || 0;
  const allocated = db.funds.reduce((a, f) => a + (+f.allocated || 0), 0);
  return { has: sv.balance != null, balance, at: sv.at, allocated, free: balance - allocated };
}
function setBalance(v) { db.settings.savings = { balance: Math.round(v * 100) / 100, at: Date.now() }; db.stamps.savings = Date.now(); }

function viewSavings() {
  const st = savingsState(), avg = avgSaving(), funds = [...db.funds].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.name.localeCompare(b.name));
  const need = funds.reduce((a, f) => a + fundNeed(f), 0);
  const seg = funds.filter(f => f.allocated > 0).map(f => `<span style="flex:${f.allocated};background:${fundColor(f)}" data-tip="${esc(`<b>${esc(f.name)}</b><br>${money(f.allocated, true)}`)}"></span>`).join('')
    + (st.free > 0 ? `<span class="free" style="flex:${st.free}" data-tip="${esc(`<b>Liberi</b><br>${money(st.free, true)}`)}"></span>` : '');
  const card = f => {
    const c = fundColor(f), pct = f.target ? Math.min(f.allocated / f.target, 1) : null, n = fundNeed(f), mLeft = monthsUntil(f.due);
    const done = f.target && f.allocated >= f.target;
    const meta = done ? '<b class="pos">Obiettivo raggiunto 🎉</b>'
      : f.target && f.due ? (mLeft < 0 ? `<b class="bad">Scaduto a ${dueLabel(f.due)}</b>` : `<b>${money(n, true)}/mese</b> fino a ${dueLabel(f.due)}`)
      : f.target ? `mancano ${money(f.target - f.allocated, true)}` : 'senza obiettivo';
    return `<div class="card fund" style="--fc:${c}">
      <div class="fh"><span class="emo" style="background:${c}22">${esc(f.emo || '💰')}</span>
        <div class="fn"><b>${esc(f.name)}</b><span>${f.category ? cat(f.category).label : 'Fondo'}${f.due ? ' · entro ' + dueLabel(f.due) : ''}</span></div>
        <button class="x" data-fedit="${f.id}" aria-label="Modifica ${esc(f.name)}">✏️</button></div>
      <div class="famt num"><b>${money(f.allocated, true)}</b>${f.target ? ` <small>di ${money(f.target, true)}</small>` : ''}</div>
      ${pct != null ? `<div class="lbar"><i style="width:${pct * 100}%;background:${c}"></i></div>` : ''}
      <div class="lmeta"><span>${pct != null ? Math.round(pct * 100) + '%' : ''}</span><span>${meta}</span></div>
      <div class="factions"><button class="btn sm" data-fadd="${f.id}">+ Metti da parte</button><button class="btn sm" data-fuse="${f.id}" ${f.allocated > 0 ? '' : 'disabled'}>− Usa</button></div>
    </div>`;
  };
  const sugg = fundSuggestions();
  let est = '';
  if (avg) {
    const diff = avg.saved - need;
    est = `<div class="est">
      <div><span>Puoi mettere da parte circa</span><b class="num ${avg.saved >= 0 ? 'pos' : 'bad'}">${money(avg.saved, true)}/mese</b><small>entrate ${money(avg.income, true)} − variabili ${money(avg.variable, true)} − fisse ${money(avg.fixed, true)}</small></div>
      <div><span>I tuoi obiettivi richiedono</span><b class="num">${money(need, true)}/mese</b><small>${funds.filter(f => fundNeed(f) > 0).length} fondi con scadenza</small></div>
      <div><span>Tra 6 mesi</span><b class="num">~${money(st.balance + avg.saved * 6, true)}</b><small>tra 12 mesi ~${money(st.balance + avg.saved * 12, true)}</small></div>
    </div>
    <p class="note ${diff >= 0 ? '' : 'bad'}">${need === 0 ? 'Aggiungi un obiettivo con una scadenza a un fondo per sapere quanto mettere da parte ogni mese.'
      : diff >= 0 ? `✓ Ci stai dentro: dopo gli obiettivi ti avanzano circa <b>${money(diff, true)}/mese</b>.`
      : `⚠️ Ti mancano circa <b>${money(-diff, true)}/mese</b>: allunga qualche scadenza, riduci un obiettivo o taglia una categoria di spesa.`}</p>
    <p class="note">Entrate e spese variabili sono la media degli ultimi ${avg.months} mesi; le spese fisse sono quelle ricorrenti attive in Budget. Se hai rate o spese fisse che non sono lì, aggiungile per una stima più giusta.</p>`;
  } else est = `<p class="note">Registra le entrate (lo stipendio) per qualche mese e qui vedrai quanto risparmi in media e quanto avrai tra 6 e 12 mesi.</p>`;

  $('#main').innerHTML = `
    <div class="head"><h1>Risparmi</h1></div>
    <div class="grid wide-left two">
      <div class="card hero">
        <div class="lbl">Sul conto risparmi</div>
        <div class="big num">${st.has ? money(st.balance) : '—'}</div>
        <div class="meta"><span>${st.has ? 'aggiornato ' + ago(st.at) : 'inserisci il saldo per iniziare'}</span><button class="btn sm hero-btn" id="svBal">${st.has ? '✏️ Aggiorna saldo' : 'Inserisci saldo'}</button></div>
        ${st.has ? `<div class="share hero-share">${seg}</div>
        <div class="hero-stats"><div><span>Assegnati ai fondi</span><b class="num">${money(st.allocated, true)}</b></div><div><span>${st.free >= 0 ? 'Liberi' : 'Assegnati in più'}</span><b class="num">${money(Math.abs(st.free), true)}</b></div></div>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>Stima</h2></div>
        ${est}
      </div>
    </div>
    ${st.has && st.free < -0.005 ? `<p class="note bad section">Hai assegnato ai fondi ${money(-st.free)} in più di quello che c'è sul conto: aggiorna il saldo o togli soldi da qualche fondo.</p>` : ''}
    <div class="sec-row"><h2 class="sec">I tuoi fondi</h2><span class="grow"></span>
      ${st.free > 0.5 && funds.some(f => f.target && f.allocated < f.target) ? `<button class="btn sm" id="svDist">⚡ Distribuisci i ${money(st.free, true)} liberi</button>` : ''}
      <button class="btn sm" id="svNew">+ Nuovo fondo</button></div>
    ${funds.length ? `<div class="grid two">${funds.map(card).join('')}</div>` : `<div class="card empty"><p>Nessun fondo ancora.</p><p>Crea un fondo per ogni cosa per cui metti da parte (viaggi, regali, auto, emergenze…) oppure parti dai suggerimenti qui sotto.</p></div>`}
    ${sugg.length ? `<h2 class="sec">Suggerimenti dai tuoi dati</h2><div class="card">${sugg.map(s => `<div class="sugg">
        <span class="emo">${s.emo}</span>
        <span class="mid"><b>${esc(s.name)}</b><span class="s">${s.key === 'emergency' ? `3 mesi delle tue spese medie: ${money(s.target, true)}` : `negli ultimi 12 mesi ${money(s.yearly, true)} → ${money(s.monthly, true)}/mese`}</span></span>
        <button class="btn sm" data-sugg="${s.key}">Crea fondo</button></div>`).join('')}</div>` : ''}`;

  $('#svBal').onclick = async () => {
    const r = await askAmount({ title: 'Saldo del conto risparmi', hint: 'Quanto c\'è adesso sul conto risparmi.', value: st.has ? st.balance : '' });
    if (r) { setBalance(r.amount); save(); viewSavings(); toast('Saldo aggiornato'); }
  };
  $('#svNew').onclick = () => openFund(null);
  if ($('#svDist')) $('#svDist').onclick = () => {
    let free = st.free; const plan = [];
    for (const f of funds.filter(f => f.target && f.allocated < f.target)) { // prima le scadenze più vicine
      if (free < 0.5) break; const give = Math.min(f.target - f.allocated, free); plan.push([f, give]); free -= give;
    }
    if (!plan.length) return;
    if (!confirm('Distribuire così?\n\n' + plan.map(([f, g]) => `${f.name}: +${money(g)}`).join('\n') + (free > 0.5 ? `\n\nResteranno liberi ${money(free)}.` : ''))) return;
    for (const [f, g] of plan) { f.allocated = Math.round((f.allocated + g) * 100) / 100; f.updated = Date.now(); }
    save(); viewSavings(); toast('Soldi distribuiti ✓');
  };
  document.querySelectorAll('[data-fedit]').forEach(b => b.onclick = () => openFund(b.dataset.fedit));
  document.querySelectorAll('[data-fadd]').forEach(b => b.onclick = async () => {
    const f = db.funds.find(x => x.id === b.dataset.fadd); if (!f) return viewSavings();
    const fr = savingsState().free;
    const r = await askAmount({ title: `Metti da parte per ${f.name}`, hint: fr > 0 ? `Liberi sul conto: ${money(fr)}` : 'Non hai soldi liberi sul conto: spunta la casella se li stai versando adesso.', value: fundNeed(f) ? Math.ceil(fundNeed(f)) : '', check: 'Sono soldi nuovi che verso sul conto risparmi (aumenta anche il saldo)', checked: fr <= 0 });
    if (!r) return;
    const g = db.funds.find(x => x.id === f.id); if (!g) return viewSavings(); // cercato di nuovo: nel frattempo può essere arrivata una sincronizzazione
    g.allocated = Math.round((g.allocated + r.amount) * 100) / 100; g.updated = Date.now();
    if (r.checked) setBalance(savingsState().balance + r.amount);
    save(); viewSavings(); toast(`+${money(r.amount)} su ${g.name}`);
  });
  document.querySelectorAll('[data-fuse]').forEach(b => b.onclick = async () => {
    const f = db.funds.find(x => x.id === b.dataset.fuse); if (!f) return viewSavings();
    const r = await askAmount({ title: `Usa da ${f.name}`, hint: `Nel fondo ci sono ${money(f.allocated)}. L'importo esce dal fondo e dal saldo del conto risparmi.`, value: '', check: f.category ? `Registrala anche come spesa (${cat(f.category).label})` : 'Registrala anche come spesa (Altro)', checked: false });
    if (!r) return;
    const g = db.funds.find(x => x.id === f.id); if (!g) return viewSavings();
    const amt = Math.min(r.amount, g.allocated);
    g.allocated = Math.round((g.allocated - amt) * 100) / 100; g.updated = Date.now();
    setBalance(Math.max(savingsState().balance - amt, 0));
    if (r.checked) db.transactions.push({ id: uid(), created: Date.now(), date: today(), category: g.category || 'other', name: g.name, amount: -amt, updated: Date.now() });
    save(); viewSavings(); toast(`Usati ${money(amt)} da ${g.name}`);
  });
  document.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => {
    const s = sugg.find(x => x.key === b.dataset.sugg); if (!s) return;
    const due = s.key === 'emergency' ? '' : addMonths(ym(new Date()), 12);
    openFund(null, { name: s.name, emo: s.emo, category: s.category, target: s.target || Math.round(s.yearly / 50) * 50, due });
  });
}

// finestra "importo" riutilizzabile: restituisce { amount, checked } oppure null
function askAmount({ title, hint = '', value = '', check = '', checked = false }) {
  return new Promise(resolve => {
    const d = $('#amtDialog');
    $('#amtTitle').textContent = title; $('#amtHint').textContent = hint;
    $('#amtInput').value = value === '' ? '' : String(value).replace('.', ',');
    $('#amtCheckWrap').style.display = check ? '' : 'none'; $('#amtCheckLabel').textContent = check; $('#amtCheck').checked = checked;
    let done = false;
    const finish = v => { if (done) return; done = true; $('#amtForm').onsubmit = null; d.close(); resolve(v); };
    $('#amtForm').onsubmit = e => { e.preventDefault(); const v = parseNum($('#amtInput').value); if (!v || v <= 0) { $('#amtInput').focus(); return toast('Inserisci un importo'); } finish({ amount: v, checked: $('#amtCheck').checked }); };
    $('#amtClose').onclick = () => finish(null);
    d.onclose = () => finish(null);
    d.showModal(); setTimeout(() => { $('#amtInput').focus(); $('#amtInput').select(); }, 60);
  });
}

// finestra fondo
let fundEditing = null;
function openFund(id, preset = {}) {
  const f = id ? db.funds.find(x => x.id === id) : null;
  if (id && !f) return viewSavings();
  fundEditing = id; const v = f || preset;
  $('#fdTitle').textContent = f ? 'Modifica fondo' : 'Nuovo fondo';
  $('#fdName').value = v.name || ''; $('#fdEmo').value = v.emo || '💰';
  $('#fdTarget').value = v.target ? String(v.target).replace('.', ',') : '';
  $('#fdDue').value = v.due || ''; $('#fdAlloc').value = f ? String(f.allocated).replace('.', ',') : '';
  $('#fdCat').innerHTML = `<option value="">Nessuna</option>` + EXPENSE_CATS.map(k => `<option value="${k}" ${v.category === k ? 'selected' : ''}>${cat(k).emo} ${cat(k).label}</option>`).join('');
  $('#fdDelete').style.display = f ? '' : 'none';
  $('#fundDialog').showModal(); setTimeout(() => $('#fdName').focus(), 60);
}
$('#fundForm').onsubmit = e => {
  e.preventDefault();
  const name = $('#fdName').value.trim(); if (!name) { $('#fdName').focus(); return toast('Dai un nome al fondo'); }
  const data = { name, emo: $('#fdEmo').value.trim() || '💰', target: parseNum($('#fdTarget').value) || null, due: $('#fdDue').value || '', category: $('#fdCat').value, allocated: Math.max(parseNum($('#fdAlloc').value) || 0, 0), updated: Date.now() };
  if (fundEditing) {
    const f = db.funds.find(x => x.id === fundEditing);
    if (!f) { $('#fundDialog').close(); toast('Questo fondo è stato eliminato da un altro dispositivo'); return viewSavings(); }
    Object.assign(f, data);
  } else db.funds.push({ id: 'f-' + uid(), ...data });
  $('#fundDialog').close(); save(); viewSavings(); toast('Fondo salvato ✓');
};
$('#fdClose').onclick = () => $('#fundDialog').close();
$('#fdDelete').onclick = () => {
  const f = db.funds.find(x => x.id === fundEditing); if (!f) return $('#fundDialog').close();
  if (!confirm(`Eliminare il fondo "${f.name}"? I ${money(f.allocated)} assegnati tornano tra i soldi liberi.`)) return;
  db.funds = db.funds.filter(x => x !== f); db.deleted[f.id] = Date.now();
  $('#fundDialog').close(); save(); viewSavings(); toast('Fondo eliminato');
};
for (const id of ['#fundDialog', '#amtDialog']) {
  $(id).addEventListener('click', e => { if (e.target === $(id)) $(id).close(); });
  $(id).addEventListener('close', () => { if (pendingRender) render(); });
}

// ---------- Finestra spesa fissa ----------
let recEditing = null; // id della spesa fissa in modifica (null = nuova)
function openRec(id) {
  const r = id ? db.recurring.find(x => x.id === id) : null;
  if (id && !r) return viewBudget();
  recEditing = id;
  $('#recTitle').textContent = r ? 'Modifica spesa fissa' : 'Nuova spesa fissa';
  $('#rName').value = r ? r.name : '';
  $('#rAmount').value = r ? String(Math.abs(r.amount)).replace('.', ',') : '';
  $('#rDay').value = r ? r.day || 1 : Math.min(new Date().getDate(), 28);
  $('#rCat').innerHTML = EXPENSE_CATS.map(k => `<option value="${k}" ${(r ? r.category : 'subscriptions') === k ? 'selected' : ''}>${cat(k).emo} ${cat(k).label}</option>`).join('');
  $('#rActive').checked = r ? r.active : true;
  $('#rDelete').style.display = r ? '' : 'none';
  $('#recDialog').showModal();
  setTimeout(() => $('#rName').focus(), 60);
}
$('#recForm').onsubmit = e => {
  e.preventDefault();
  const name = $('#rName').value.trim(), amount = parseNum($('#rAmount').value), day = Math.min(Math.max(parseInt($('#rDay').value, 10) || 1, 1), 28);
  if (!name) { $('#rName').focus(); return toast('Inserisci un nome'); }
  if (!amount) { $('#rAmount').focus(); return toast("Inserisci l'importo"); }
  const data = { name, amount: -Math.abs(amount), category: $('#rCat').value, day, updated: Date.now() };
  const active = $('#rActive').checked;
  if (recEditing) {
    const r = db.recurring.find(x => x.id === recEditing); // cercata adesso, non quando si è aperta la finestra
    if (!r) { $('#recDialog').close(); toast('Questa spesa fissa è stata eliminata da un altro dispositivo'); return viewBudget(); }
    if (active && !r.active) r.lastGenerated = ym(new Date());
    Object.assign(r, data, { active });
    toast('Salvato ✓');
  } else {
    const cur = ym(new Date());
    db.recurring.push({ id: uid(), ...data, active, lastGenerated: new Date().getDate() >= day ? cur : addMonths(cur, -1) });
    toast('Spesa fissa aggiunta ✓');
  }
  $('#recDialog').close(); save(); runRecurring(); viewBudget();
};
$('#recClose').onclick = () => $('#recDialog').close();
$('#recDialog').addEventListener('click', e => { if (e.target === $('#recDialog')) $('#recDialog').close(); });
$('#recDialog').addEventListener('close', () => { if (pendingRender) render(); });
$('#rDelete').onclick = () => {
  const r = db.recurring.find(x => x.id === recEditing); if (!r) return $('#recDialog').close();
  if (!confirm(`Eliminare la spesa fissa "${r.name}"? I movimenti già registrati restano.`)) return;
  db.recurring = db.recurring.filter(x => x !== r); db.deleted[r.id] = Date.now();
  $('#recDialog').close(); save(); viewBudget(); toast('Eliminata');
};

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
$('#txDialog').addEventListener('close', () => { if (pendingRender) { pendingRender = false; render(); } });
$('#txDialog').addEventListener('click', e => { if (e.target === $('#txDialog')) $('#txDialog').close(); });
$('#fDelete').onclick = () => {
  if (editing && confirm('Eliminare questo movimento?')) { db.transactions = db.transactions.filter(t => t !== editing); db.deleted[editing.id] = Date.now(); save(); $('#txDialog').close(); toast('Movimento eliminato'); render(); }
};
$('#txForm').onsubmit = e => {
  e.preventDefault();
  const v = parseNum($('#fAmount').value);
  if (!v) { $('#fAmount').focus(); return toast('Inserisci un importo'); }
  const positive = kind === 'income' || $('#fRefund').checked;
  const data = { date: $('#fDate').value, category: selCat, name: $('#fName').value.trim(), amount: Math.round((positive ? Math.abs(v) : -Math.abs(v)) * 100) / 100, updated: Date.now() };
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
if (persist()) try { localStorage.removeItem(OLD_KEY); } catch {} // salva subito l'eventuale migrazione
runRecurring();
readSyncLink();
addEventListener('hashchange', () => { if (/sync=/.test(location.hash)) { readSyncLink(); render(); } });
render();
setSync(db.local.syncUrl ? 'ok' : 'off');
if (db.local.syncUrl) sync();
// sincronizza quando torni sull'app, quando torna la rete e ogni 2 minuti mentre è aperta
addEventListener('online', () => scheduleSync(200));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - (db.local.lastSync || 0) > 10000) scheduleSync(200);
  if (document.visibilityState === 'hidden' && syncTimer) sync(); // salva subito le modifiche in sospeso
});
setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0); }, 120000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
