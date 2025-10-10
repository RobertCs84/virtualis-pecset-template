/* CONFIG */
const USERS_JSON = 'users.json'; // ugyanaz a host (relative path) -> nincs CORS
const CHECKPOINT_RADIUS_METERS = 100; // elfogadott távolság pecsételéskor

/* Teszt / éles checkpoint lista (szerkeszthető) */
const checkpoints = [
  { id:1, name:"Városlőd", lat:47.1594727, lon:17.6710794, route:"Bakony" },
  { id:2, name:"Szénpajtai-pihenő", lat:47.1946432, lon:17.6685077, route:"Bakony" },
  { id:3, name:"Királykapu (fűtőház)", lat:47.2561136, lon:17.6626225, route:"Bakony" },
  { id:4, name:"Természetvédelmi tábla", lat:47.2836890, lon:17.7061015, route:"Bakony" },
  { id:5, name:"Huszárokelőpuszta (esőbeálló)", lat:47.3146886, lon:17.6886906, route:"Bakony" },
  { id:6, name:"Veszprém vasútállomás", lat:47.1189646, lon:17.9114044, route:"Balaton" },
  { id:7, name:"Haszkovó – Őrház utca", lat:47.1036732, lon:17.9201985, route:"Balaton" },
  { id:8, name:"Veszprém régi vasútállomás", lat:47.0950814, lon:17.9175577, route:"Balaton" },
  { id:9, name:"Meggyespuszta", lat:47.0517992, lon:17.9374564, route:"Balaton" },
  { id:10, name:"Vödörvölgy – Zöld étterem", lat:47.0362092, lon:17.9799228, route:"Balaton" },
  { id:11, name:"Töltés utca – 375-ös gőzmozdony", lat:47.0300097, lon:18.0080322, route:"Balaton" },
  { id:12, name:"Káptalanfüred állomás", lat:47.0103427, lon:18.0041360, route:"Balaton" },
  { id:13, name:"Alsóörs vasútállomás", lat:46.9852998, lon:17.9751434, route:"Balaton" }
];

/* LocalStorage kulcsok */
const LS_USER = 'vt_loggedInUser';
const LS_STAMPS = 'vt_stamps';
const LS_AUTH_CACHE = 'vt_auth_cache_v1'; // ha akarsz cache-elést (optional)

/* ---------- helper: SHA-256 (Web Crypto) ---------- */
async function sha256Hex(message) {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ---------- UI helpers ---------- */
function el(id){ return document.getElementById(id); }
function setLoginMsg(txt, isError=false){
  const e = el('loginMsg'); if(!e) return;
  e.textContent = txt || ''; e.classList.toggle('error', !!isError);
}

/* ---------- Login flow (users.json-based, salted SHA-256) ---------- */
async function login(){
  const name = el('name').value.trim();
  const plain = el('password').value;
  if(!name || !plain){ setLoginMsg('Add meg a nevet és jelszót!', true); return; }

  setLoginMsg('Ellenőrzés folyamatban…');

  try {
    const resp = await fetch(USERS_JSON, {cache:'no-store'});
    if(!resp.ok) throw new Error('users.json betöltési hiba: ' + resp.status);
    const users = await resp.json();

    const user = users.find(u => String(u.name || '').trim() === name);
    if(!user){ setLoginMsg('Nincs ilyen felhasználó', true); return; }
    if(!user.salt || !user.hash){ setLoginMsg('Felhasználó nincs rendesen beállítva (salt/hash hiányzik).', true); return; }

    const computed = await sha256Hex(plain + String(user.salt));
    if(computed === user.hash){
      // siker
      localStorage.setItem(LS_USER, name);
      // opcionálisan cache-elhetjük a hash a későbbi offline belépéshez:
      const cache = JSON.parse(localStorage.getItem(LS_AUTH_CACHE) || '{}');
      cache[name] = { hash: computed, ts: Date.now() };
      localStorage.setItem(LS_AUTH_CACHE, JSON.stringify(cache));

      onLoginSuccess(name);
      setLoginMsg('');
    } else {
      setLoginMsg('Hibás jelszó', true);
    }
  } catch(err){
    console.error('login error', err);
    // ha hálózati hiba, engedjük offline folytatni, ha van korábbi cache
    const cache = JSON.parse(localStorage.getItem(LS_AUTH_CACHE) || '{}');
    const c = cache[name];
    if(c){
      // összehasonlítjuk a kliens oldalon számolt hash-sel
      const computed = await sha256Hex(plain + (c.salt || '')); // c.salt ritkán van csak hash tárolva
      if(computed === c.hash){
        onLoginSuccess(name);
        setLoginMsg('');
        return;
      }
    }
    setLoginMsg('Hálózati hiba. Ha korábban bejelentkeztél ezen az eszközön, folytathatod offline.', true);
  }
}

function onLoginSuccess(name){
  el('login').classList.add('hidden');
  el('mainContent').classList.remove('hidden');
  el('usernameDisplay').textContent = name;
  loadCheckpoints();
  el('status').textContent = '';
}

function logout(){
  localStorage.removeItem(LS_USER);
  // nem törlünk pecséteket, csak kijelentkeztetünk
  location.reload();
}

/* ---------- Checkpoint UI / Stamp logic ---------- */
function loadCheckpoints(){
  const user = localStorage.getItem(LS_USER);
  const stamps = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}')[user] || [];

  const bakonyDiv = el('bakonyPoints'), balatonDiv = el('balatonPoints');
  if(bakonyDiv) bakonyDiv.innerHTML = '';
  if(balatonDiv) balatonDiv.innerHTML = '';

  checkpoints.forEach(cp=>{
    const div = document.createElement('div');
    div.className = 'checkpoint';
    const matched = stamps.find(s=>s.id===cp.id);
    const stampHtml = matched ? `<p class="success">✔️ Már lepecsételted: ${new Date(matched.timestamp).toLocaleString()}</p>` : '';
    div.innerHTML = `<strong>${cp.name}</strong><br/>
      <button ${matched ? 'disabled' : ''} onclick="stamp(${cp.lat},${cp.lon},this,${cp.id},'${cp.name.replace("'", "\\'")}')">Pecsételés</button>
      <p class="status"></p>
      ${stampHtml}`;
    if(cp.route === 'Bakony') bakonyDiv.appendChild(div); else balatonDiv.appendChild(div);
  });

  // PDF gomb aktiválás
  const allIds = checkpoints.map(p=>p.id);
  const stampedIds = stamps.map(s=>s.id);
  const allStamped = allIds.every(id => stampedIds.includes(id));
  el('pdfBtn').disabled = !allStamped;
}

function stamp(targetLat, targetLon, button, cpId, cpName){
  const statusP = button.nextElementSibling;
  if(!navigator.geolocation){ statusP.textContent = 'A böngésző nem támogatja a helymeghatározást.'; return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const dist = getDistance(pos.coords.latitude, pos.coords.longitude, targetLat, targetLon);
    if(dist <= CHECKPOINT_RADIUS_METERS){
      statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(dist)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 500);
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy (${Math.round(dist)} m)</span>`;
    }
  }, err=>{
    statusP.textContent = 'Nem sikerült lekérni a pozíciót.';
  }, {enableHighAccuracy:true, timeout:10000});
}

function saveStamp(id, name){
  const user = localStorage.getItem(LS_USER);
  if(!user) return;
  const now = new Date().toISOString();
  let all = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}');
  if(!all[user]) all[user]=[];
  if(!all[user].some(p=>p.id===id)) all[user].push({id,name,timestamp:now});
  localStorage.setItem(LS_STAMPS, JSON.stringify(all));
}

/* ---------- Utilities ---------- */
function getDistance(lat1,lon1,lat2,lon2){
  const R = 6371000;
  const φ1 = lat1*Math.PI/180, φ2 = lat2*Math.PI/180;
  const Δφ = (lat2-lat1)*Math.PI/180, Δλ = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/* ---------- Export / Import / PDF ---------- */
function exportJSON(){
  const user = localStorage.getItem(LS_USER);
  const stamps = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}')[user] || [];
  const data = { user, checkpoints: stamps };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `${user.replace(' ','_')}_pecsetek.json`; a.click();
}
function exportCSV(){
  const user = localStorage.getItem(LS_USER);
  const stamps = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}')[user] || [];
  let csv = 'Felhasználó,Név,Időbélyeg\n';
  stamps.forEach(s=>{ csv += `${user},"${s.name}","${new Date(s.timestamp).toLocaleString()}"\n`; });
  const blob = new Blob([csv], {type:'text/csv'}); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${user.replace(' ','_')}_pecsetek.csv`; a.click();
}
async function generatePDF(){
  const user = localStorage.getItem(LS_USER);
  const stamps = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}')[user] || [];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text('Teljesítési igazolás',20,20);
  doc.setFontSize(12); doc.text(`Túrázó: ${user}`,20,30);
  let y=40;
  stamps.forEach((p,i)=>{ doc.text(`${i+1}. ${p.name} – ${new Date(p.timestamp).toLocaleString()}`,20,y); y+=8; });
  doc.save(`${user.replace(' ','_')}_teljesites.pdf`);
}
function importJSON(){
  const fi = el('importFile'); if(!fi.files.length){ alert('Válassz JSON fájlt!'); return; }
  const r = new FileReader();
  r.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      if(!imported.user || !Array.isArray(imported.checkpoints)) { alert('Érvénytelen formátum'); return; }
      let all = JSON.parse(localStorage.getItem(LS_STAMPS) || '{}');
      all[imported.user] = imported.checkpoints;
      localStorage.setItem(LS_STAMPS, JSON.stringify(all));
      if(localStorage.getItem(LS_USER) === imported.user) loadCheckpoints();
      alert('Sikeres visszatöltés');
    } catch {
      alert('Hiba a fájl feldolgozásakor');
    }
  };
  r.readAsText(fi.files[0]);
}

/* ---------- Init (bind gombok) ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  el('togglePw').addEventListener('click', ()=>{
    const p = el('password');
    p.type = p.type === 'password' ? 'text' : 'password';
    el('togglePw').textContent = p.type === 'password' ? '👁️' : '🙈';
  });
  el('logoutBtn').addEventListener('click', logout);
  el('exportJsonBtn').addEventListener('click', exportJSON);
  el('exportCsvBtn').addEventListener('click', exportCSV);
  el('pdfBtn').addEventListener('click', generatePDF);
  el('importBtn').addEventListener('click', importJSON);

  // ha már be van jelentkezve
  const logged = localStorage.getItem(LS_USER);
  if(logged){
    el('login').classList.add('hidden');
    el('mainContent').classList.remove('hidden');
    el('usernameDisplay').textContent = logged;
    el('status').textContent = 'Offline módban: korábbi bejelentkezés alapján pecsételhetsz.';
    loadCheckpoints();
  }
});