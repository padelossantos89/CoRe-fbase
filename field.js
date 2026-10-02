/* ===== CONFIG — Firebase (same project as login.html / log.html) ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBJOfUc76neQC6e9KkiVkSxGvXLmo5J74Q",
  authDomain: "ileco-iii-core.firebaseapp.com",
  projectId: "ileco-iii-core",
  storageBucket: "ileco-iii-core.firebasestorage.app",
  messagingSenderId: "319768694684",
  appId: "1:319768694684:web:ba0f169facd757af44c259"
};
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const fdb = firebase.firestore();
const authReady_ = new Promise(resolve => { const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); }); });
const BRANCHES = {
  "pani-an":   { name:"Pani-an Branch Office",   email:"ileco3.pao@gmail.com" },
  "sara":      { name:"Sara Branch Office",      email:"ileco3.sao@gmail.com" },
  "natividad": { name:"Natividad Branch Office", email:"ileco3.nao@gmail.com" },
  "main":      { name:"ILECO-III Main Office",   email:"ileco3@gmail.com" }
};

/* ===== auth guard: Field users only ===== */
let session = JSON.parse(localStorage.getItem('ileco3_session') || 'null');
// Sessions expire after 8 hours of being issued — after that, treat it as
// logged out. Protects a PC left signed in overnight or over a weekend.
const SESSION_MAX_MS_ = 8 * 60 * 60 * 1000;
if(session && (Date.now() - new Date(session.loginAt).getTime()) > SESSION_MAX_MS_){
  localStorage.removeItem('ileco3_session');
  session = null;
}
if(!session){ location.replace('login.html'); }
else if(session.role !== 'field'){ location.replace(session.role === 'admin' ? 'admin.html' : 'index.html'); }
document.getElementById('username').textContent = session ? session.username : '';

document.getElementById('logout').addEventListener('click', async ()=>{
  try{
    await fdb.collection('activityLog').add({ username:session.username, role:session.role, action:'Logged out', details:'', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }catch(e){}
  try{ await auth.signOut(); }catch(e){}
  try{ Object.keys(localStorage).filter(k=>k.indexOf('ileco_rows_v1:')===0).forEach(k=>localStorage.removeItem(k)); }catch(e){}
      localStorage.removeItem('ileco3_session');
  location.href = 'login.html';
});

/* ===== helpers ===== */
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isDone = r => !!String(r['Time Finished'] ?? '').trim();

function fmtDate(v){
  if(!v) return '';
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d = new Date(s);
    if(isNaN(d) || d.getUTCFullYear() < 1950) return '';
    return d.toLocaleDateString('en-PH', { timeZone:'Asia/Manila', year:'numeric', month:'short', day:'numeric' });
  }
  return s;
}
function fmtTime(v){
  if(!v) return '';
  const s = String(v).trim();
  return /^\d{1,2}:\d{2}\s*[AP]M$/i.test(s) ? s : '';
}

/* ---------- Duration (min) = (Date & Time Finished) - (Date & Time Received), in minutes ----------
   Date Finished = Date Acted. Applied to every record (all 4 offices + Overall). */

/* ---------- Normalise Sheet values so every office reads the same ----------
   Google Sheets may hand back a time as "6:20 AM", "06:20:00", a fraction of a day,
   or an ISO stamp (1899-12-30T…Z) depending on how that Sheet's cells are formatted. */
function normTime_(v){
  if(v===null || v===undefined || v==='') return '';
  const to12 = (h,mi)=>{ h=((h%24)+24)%24; return `${((h+11)%12)+1}:${String(mi).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
  if(typeof v==='number' || /^0?\.\d+$/.test(String(v).trim())){
    const x = Number(v);
    if(x>=0 && x<1){ const t=Math.round(x*1440)%1440; return to12(Math.floor(t/60), t%60); }
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?$/i);
  if(m){
    let h = +m[1]; const p = m[3] && m[3].toUpperCase();
    if(p==='PM' && h!==12) h+=12;
    if(p==='AM' && h===12) h=0;
    return to12(h, +m[2]);
  }
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d = new Date(s);
    if(isNaN(d)) return s;
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
    const h = +parts.find(p=>p.type==='hour').value, mi = +parts.find(p=>p.type==='minute').value;
    return to12(h, mi);
  }
  return s;
}
function normDate_(v){
  if(v===null || v===undefined || v==='') return '';
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){
    const d = new Date(s);
    if(isNaN(d) || d.getUTCFullYear()<1950) return s;
    const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
    const g = t => parts.find(p=>p.type===t).value;
    return `${g('month')}/${g('day')}/${g('year')}`;
  }
  return s;
}

/* ---------- Instant-load cache: show the last saved records at once, refresh in the background ---------- */
const ROWS_CACHE_PREFIX_ = 'ileco_rows_v1:';
function rowsCacheSet_(key, rows){
  try{
    const headers = [], seen = {};
    rows.forEach(r=>Object.keys(r).forEach(k=>{ if(!seen[k]){ seen[k]=1; headers.push(k); } }));
    const data = rows.map(r=>headers.map(h=> r[h]===undefined ? '' : r[h]));
    localStorage.setItem(ROWS_CACHE_PREFIX_+key, JSON.stringify({ t:Date.now(), h:headers, d:data }));
  }catch(e){ /* storage full or blocked - the cache is optional */ }
}
function rowsCacheGet_(key){
  try{
    const s = localStorage.getItem(ROWS_CACHE_PREFIX_+key);
    if(!s) return null;
    const o = JSON.parse(s);
    return o.d.map(a=>{ const r = {}; o.h.forEach((h,i)=>{ r[h] = a[i]; }); return r; });
  }catch(e){ return null; }
}

function _dtMs(dateStr, timeStr){
  if(!dateStr || !timeStr) return null;
  const s = String(dateStr).trim(), t = String(timeStr).trim();
  let y,mo,d;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m){ y=+m[1]; mo=+m[2]; d=+m[3]; }
  else { m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(!m) return null; mo=+m[1]; d=+m[2]; y=+m[3]; }
  let h, mi;
  m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(m){ h=+m[1]; mi=+m[2]; const p=m[3].toUpperCase(); if(p==='PM' && h!==12) h+=12; if(p==='AM' && h===12) h=0; }
  else { m = t.match(/^(\d{1,2}):(\d{2})$/); if(!m) return null; h=+m[1]; mi=+m[2]; }
  return Date.UTC(y, mo-1, d, h, mi);
}
function calcDurationMin(dateRec, timeRec, dateFin, timeFin){
  const a = _dtMs(dateRec, timeRec), b = _dtMs(dateFin, timeFin);
  if(a===null || b===null || b < a) return null;
  return Math.round((b - a) / 60000);
}
function applyDurations(rows){
  (rows || []).forEach(r=>{
    ['Time Received','Departure Time','Arrival Time','Time Finished'].forEach(k=>{ if(k in r) r[k] = normTime_(r[k]); });
    ['Date Received','Date Acted'].forEach(k=>{ if(k in r) r[k] = normDate_(r[k]); });
    const d = calcDurationMin(r['Date Received'], r['Time Received'], r['Date Acted'], r['Time Finished']);
    if(d === null) return;
    r['Duration (min)'] = d;
    const tr = r['Travel Time (min)'];
    if(tr !== '' && tr != null && !isNaN(Number(tr))) r['Duration Less Travel Time (min)'] = d - Number(tr);
  });
  return rows;
}


async function fetchRows(key){
  await authReady_;
  const snap = await fdb.collection('complaints')
    .where('office', '==', BRANCHES[key].name)
    .orderBy('createdAt', 'asc')
    .get();
  const rows = snap.docs.map((doc, idx) => Object.assign({ "No": idx+1 }, doc.data()));
  const fresh = applyDurations(rows);
  rowsCacheSet_(key, fresh);
  return fresh;
}

const params = new URLSearchParams(location.search);
const branchKey = params.get('branch');
const app = $('app');

/* ===== Screen A: choose an office ===== */
function showOffices(){
  document.title = 'ILECO III · Choose an office';
  app.innerHTML = `
    <div class="intro">
      <h1>Which office are you reporting to?</h1>
      <p>Pick an office to see its pending complaints and requests.</p>
    </div>
    <div class="offices">
      ${Object.entries(BRANCHES).map(([k,b])=>`
        <a class="office" href="field.html?branch=${k}">
          <div class="body"><div class="name">${esc(b.name)}</div><div class="sub">${esc(b.email)}</div></div>
          <span class="badge none" id="badge-${k}">…</span>
          <span class="chev">›</span>
        </a>`).join('')}
    </div>`;
  Object.keys(BRANCHES).forEach(async k=>{
    const el = $('badge-'+k);
    const c0 = rowsCacheGet_(k);   // instant count from the last visit
    if(c0){ const n0 = c0.filter(r=>!isDone(r)).length; el.textContent = n0 + ' pending'; el.className = 'badge' + (n0 ? '' : ' none'); }
    try{
      const rows = await fetchRows(k);
      const n = rows.filter(r=>!isDone(r)).length;
      el.textContent = n + ' pending';
      el.className = 'badge' + (n ? '' : ' none');
    }catch(e){ el.textContent = ''; el.style.display = 'none'; }
  });
}

/* ===== Screen B: status list for one office ===== */
let rows = [];

function showBranch(key){
  const b = BRANCHES[key];
  document.title = 'ILECO III · ' + b.name;
  app.innerHTML = `
    <div class="bar">
      <a class="back" href="field.html" aria-label="Change office">‹ Offices</a>
      <h2>${esc(b.name)}</h2>
      <button class="icon-btn" id="refresh" type="button" aria-label="Refresh">↻</button>
    </div>
    <div class="pend-head"><span>Pending complaints &amp; requests</span><span class="n" id="n-pending">–</span></div>
    <input class="search" id="q" type="search" placeholder="Search name, control no., barangay…" autocomplete="off">
    <div id="list"></div>
    <a class="fab" href="log.html?branch=${encodeURIComponent(key)}"><span class="plus">+</span> Log a complaint</a>`;
  $('q').addEventListener('input', renderList);
  $('refresh').addEventListener('click', ()=>load(key));
  load(key);
}

async function load(key){
  const c = rows.length===0 ? rowsCacheGet_(key) : null;
  const shownCached = !!(c && c.length);
  if(shownCached){ rows = c; renderList(); }
  else $('list').innerHTML = '<div class="state"><div class="spinner"></div>Loading records…</div>';
  try{
    rows = await fetchRows(key);
    renderList();
  }catch(err){
    if(shownCached) return;   // keep showing the saved list if the refresh fails
    $('n-pending').textContent = '–';
    $('list').innerHTML = `<div class="state">Couldn't load this office's records.<br>${esc(err.message)}<br><button type="button" id="retry">Try again</button></div>`;
    $('retry').addEventListener('click', ()=>load(key));
  }
}

function renderList(){
  const pending = rows.filter(r=>!isDone(r));
  $('n-pending').textContent = pending.length;
  const q = $('q').value.trim().toLowerCase();
  let list = pending.slice().reverse();
  if(q){
    list = list.filter(r => [r['Control Number'],r['Name of Complainant'],r['Sitio/Barangay'],r['Town'],r['Type of Complaint'],r['Description of Complaint']]
      .join(' ').toLowerCase().includes(q));
  }
  const box = $('list');
  if(!list.length){
    box.innerHTML = `<div class="state">${q ? 'No records match your search.' : 'No pending complaints or requests.'}</div>`;
    return;
  }
  box.className = 'list';
  box.innerHTML = list.map(r=>{
    const done = isDone(r), st = done ? 'completed' : 'pending';
    const addr = [r['Sitio/Barangay'], r['Town']].filter(Boolean).join(', ');
    const dt = [fmtDate(r['Date Received']), fmtTime(r['Time Received'])].filter(Boolean).join(' · ');
    const billRows = [['Account name','Account Name'],['Account no.','Account Number'],['Meter no.','Meter Number'],['Serial no.','Serial Number'],['Pole no.','Pole Number']]
      .filter(([,k]) => String(r[k] ?? '').trim())
      .map(([lbl,k]) => `<div class="row"><span>${lbl}</span><b>${esc(r[k])}</b></div>`).join('');
    const contact = String(r['Contact Number'] ?? '').trim();
    return `
      <button class="rec ${done?'done':''}" type="button" data-idx="${rows.indexOf(r)}">
        <div class="top"><span class="cn mono">${esc(r['Control Number'])}</span><span class="pill ${st}">${done?'Completed':'Pending'}</span></div>
        <div class="who2">${esc(r['Name of Complainant'] || '—')}</div>
        ${addr ? `<div class="addr">${esc(addr)}</div>` : ''}
        ${contact ? `<div class="contact">📞 ${esc(contact)}</div>` : ''}
        <div class="meta">${r['Type of Complaint'] ? `<span><b>${esc(r['Type of Complaint'])}</b></span>` : ''}${dt ? `<span>${esc(dt)}</span>` : ''}</div>
        ${r['Description of Complaint'] ? `<div class="desc">${esc(r['Description of Complaint'])}</div>` : ''}
        ${billRows ? `<div class="bill"><div class="bt">Bill details</div>${billRows}</div>` : ''}
        ${done ? '' : '<div class="go">Fill in field response ›</div>'}
      </button>`;
  }).join('');
  box.querySelectorAll('.rec').forEach(el=>el.addEventListener('click', ()=>openRecord(Number(el.dataset.idx))));
}

function openRecord(idx){
  const r = rows[idx];
  if(!r) return;
  const cn = String(r['Control Number'] ?? '');
  if(true){
    // Pending → go straight to Log a complaint/request with this Control Number loaded
    location.href = `log.html?branch=${encodeURIComponent(branchKey)}&cn=${encodeURIComponent(cn)}`;
    return;
  }
  const f = (label, val) => val ? `<div><dt>${label}</dt><dd>${esc(val)}</dd></div>` : '';
  const addr = [r['Sitio/Barangay'], r['Town']].filter(Boolean).join(', ');
  $('sheet').innerHTML = `
    <div class="grab"></div>
    <span class="pill completed">Completed</span>
    <h3>${esc(r['Name of Complainant'] || '—')}</h3>
    <div class="mono" style="font-size:12.5px; color:var(--navy); font-weight:600;">${esc(cn)}</div>
    <dl>
      ${f('Address', addr)}
      ${f('Contact number', r['Contact Number'])}
      <div class="two">${f('Type of complaint', r['Type of Complaint'])}${f('Date received', fmtDate(r['Date Received']))}</div>
      ${f('Description', r['Description of Complaint'])}
      <div class="two">${f('Account name', r['Account Name'])}${f('Account no.', r['Account Number'])}</div>
      <div class="two">${f('Meter no.', r['Meter Number'])}${f('Serial no.', r['Serial Number'])}</div>
      ${f('Pole no.', r['Pole Number'])}
      ${f('Acted by', r['Acted By'])}
      ${f('Action taken', r['Action Taken'])}
      <div class="two">${f('Date acted', fmtDate(r['Date Acted']))}${f('Place of origin', r['Place of Origin'])}</div>
      ${f('Place of arrival', r['Place of Arrival'])}
      <div class="two">${f('Travel (min)', r['Travel Time (min)'])}${f('Duration (min)', r['Duration (min)'])}</div>
    </dl>
    <button class="close" type="button" id="sheet-close">Close</button>`;
  $('sheet-bg').classList.add('open');
  $('sheet-close').addEventListener('click', closeSheet);
}
function closeSheet(){ $('sheet-bg').classList.remove('open'); }
$('sheet-bg').addEventListener('click', e=>{ if(e.target.id==='sheet-bg') closeSheet(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeSheet(); });

/* ===== init ===== */
if(session && session.role === 'field'){
  if(branchKey && BRANCHES[branchKey]) showBranch(branchKey); else showOffices();
}
