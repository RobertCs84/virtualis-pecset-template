/*********************************************************
 * virtual-tour.js
 * - login cache + SHA-256 hashing
 * - két auth mód: "post" (ajánlott) vagy "get" (visszamaradó)
 * - offline-friendly: ha már be van jelentkezve, pecsételés működik net nélkül
 *********************************************************/

/* ======= CONFIG: ide állítsd be az URL-ed és módot ======= */
const AUTH_MODE = "post"; // "post" ajánlott, "get" visszahagyott opció
const AUTH_URL = "https://script.google.com/macros/s/AKfycbz6vWvhkJpWFxlkYI6699cX6WVI6jSunVn7xYD87QWJRiZNYtwCdoWW9AuXIXa9lNxMvQ/exec";
/* ======================================================= */

/* A cache kulcs a localStorage-ben */
const CACHE_KEY = "vt_auth_cache_v1"; // struktúra: { name: { hash: "...", ts: 168... } }

/* --- checkpontok (példa a már korábban megadott listával) --- */
const checkpoints = [
  { id: 1, name: "Városlőd", lat: 47.1594727, lon: 17.6710794, route: "Bakony" },
  { id: 2, name: "Szénpajtai-pihenő", lat: 47.1946432, lon: 17.6685077, route: "Bakony" },
  { id: 3, name: "Királykapu (fűtőház)", lat: 47.2561136, lon: 17.6626225, route: "Bakony" },
  { id: 4, name: "Természetvédelmi tábla", lat: 47.2836890, lon: 17.7061015, route: "Bakony" },
  { id: 5, name: "Huszárokelőpuszta (esőbeálló)", lat: 47.3146886, lon: 17.6886906, route: "Bakony" },
  { id: 6, name: "Veszprém vasútállomás", lat: 47.1189646, lon: 17.9114044, route: "Balaton" },
  { id: 7, name: "Haszkovó – Őrház utca", lat: 47.1036732, lon: 17.9201985, route: "Balaton" },
  { id: 8, name: "Veszprém régi vasútállomás", lat: 47.0950814, lon: 17.9175577, route: "Balaton" },
  { id: 9, name: "Meggyespuszta", lat: 47.0517992, lon: 17.9374564, route: "Balaton" },
  { id: 10, name: "Vödörvölgy – Zöld étterem", lat: 47.0362092, lon: 17.9799228, route: "Balaton" },
  { id: 11, name: "Töltés utca – 375-ös gőzmozdony", lat: 47.0300097, lon: 18.0080322, route: "Balaton" },
  { id: 12, name: "Káptalanfüred állomás", lat: 47.0103427, lon: 18.0041360, route: "Balaton" },
  { id: 13, name: "Alsóörs vasútállomás", lat: 46.9852998, lon: 17.9751434, route: "Balaton" }
];

/* ---------- utility: SHA-256 hashing using Web Crypto ---------- */
async function sha256Hex(message) {
  const enc = new TextEncoder();
  const data = enc.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- local cache helpers ---------- */
function readAuthCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function writeAuthCache(obj) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}

/* ---------- UI helpers ---------- */
function setLoginMsg(text, isLoading = false) {
  const el = document.getElementById('loginMsg');
  if (!el) return;
  el.textContent = text || '';
  if (isLoading) el.classList.add('loading'); else el.classList.remove('loading');
}
function setStatus(text) {
  const s = document.getElementById('status');
  if (s) s.textContent = text || '';
}

/* ---------- login flow ---------- */
async function login() {
  const nameField = document.getElementById('name');
  const pwField = document.getElementById('password');
  if (!nameField || !pwField) return;

  const name = nameField.value.trim();
  const plainPw = pwField.value;
  if (!name || !plainPw) {
    setLoginMsg('Add meg a nevet és jelszót!');
    return;
  }

  // számoljuk a jelszó hash-ét (frontend)
  setLoginMsg('Ellenőrzés folyamatban…', true);
  const pwHash = await sha256Hex(plainPw);

  // 1) ellenőrizzük a helyi cache-t
  const cache = readAuthCache();
  const cached = cache[name];
  if (cached && cached.hash && cached.hash === pwHash) {
    // azonnali belépés (offline-oké)
    onLoginSuccess(name);
    setLoginMsg('');
    return;
  }

  // 2) ha nincs cache-ünk, vagy nem egyezik: hívjuk a szervert (preferált: POST)
  try {
    if (AUTH_MODE === "post") {
      // POST mód: küldjük a plain (vagy a hash) - itt plain-et küldünk HTTPS-en: a GAS szerver ellenőrzi a hash-t szerveroldalon
      const resp = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password: plainPw })
      });
      const data = await resp.json();
      if (data && data.ok) {
        // mentjük a cache-be: tároljuk a hash-t, hogy offline is gyors legyen a következőkben
        cache[name] = { hash: pwHash, ts: Date.now() };
        writeAuthCache(cache);
        if (data.token) localStorage.setItem('sessionToken', data.token);
        onLoginSuccess(name);
        setLoginMsg('');
        return;
      } else {
        // hibás: lehet no_user, not_paid, bad_password
        const reason = (data && data.error) ? data.error : 'bad_credentials';
        let msg = 'Hibás felhasználónév vagy jelszó!';
        if (reason === 'not_paid') msg = 'A fizetés még nincs rögzítve.';
        if (reason === 'no_user') msg = 'Nincs ilyen felhasználó.';
        setLoginMsg(msg);
        return;
      }
    } else {
      // GET mód: lekérjük a teljes listát (ideiglenes, kevésbé biztonságos)
      const resp = await fetch(AUTH_URL);
      const users = await resp.json();
      // feltételezzük, hogy a users tömb objektumokat ad vissza: {name, password} és hogy password immár HASH (ha migráltál)
      const found = users.find(u => (u.name === name));
      if (!found) { setLoginMsg('Nincs ilyen felhasználó.'); return; }
      // összehasonlítjuk a hasheket (feltételezve hogy a sheet már hash-t tartalmaz)
      const serverHash = String(found.password || '').trim();
      if (serverHash && serverHash === pwHash) {
        cache[name] = { hash: pwHash, ts: Date.now() };
        writeAuthCache(cache);
        onLoginSuccess(name);
        setLoginMsg('');
        return;
      } else {
        setLoginMsg('Hibás jelszó!');
        return;
      }
    }
  } catch (err) {
    console.error('Auth error', err);
    // ha hálózati hiba van, és a felhasználó korábban már bejelentkezett (localStorage.loggedInUser), engedjük offline folytatni
    const logged = localStorage.getItem('loggedInUser');
    if (logged === name) {
      onLoginSuccess(name);
      setLoginMsg('');
    } else {
      setLoginMsg('Hálózati hiba. Ha korábban bejelentkeztél ezen az eszközön, folytathatod offline.', false);
    }
  }
}

function onLoginSuccess(name) {
  localStorage.setItem('loggedInUser', name);
  const loginEl = document.getElementById('login');
  const main = document.getElementById('mainContent');
  if (loginEl) loginEl.classList.add('hidden');
  if (main) main.classList.remove('hidden');
  const span = document.getElementById('usernameDisplay');
  if (span) span.textContent = name;
  loadCheckpoints();
}

function logout() {
  localStorage.removeItem('loggedInUser');
  // nem töröljük a cache-bejegyzést teljesen — ha újra bejelentkezik ugyanazzal az eszközzel, gyors lesz
  location.reload();
}

/* ---------- loadCheckpoints / stamp / saveStamp stb. ---------- (ugyanaz, mint korábban) */

function loadCheckpoints() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}');
  const stampedPoints = stamps[user] || [];

  const bakonyDiv = document.getElementById('bakonyPoints');
  const balatonDiv = document.getElementById('balatonPoints');
  if (bakonyDiv) bakonyDiv.innerHTML = '';
  if (balatonDiv) balatonDiv.innerHTML = '';

  checkpoints.forEach(cp => {
    const div = document.createElement('div');
    div.className = 'checkpoint';

    const match = stampedPoints.find(p => p.id === cp.id);
    let stampStatus = '';
    if (match) {
      stampStatus = `<p class="success">✔️ Már lepecsételted: ${new Date(match.timestamp).toLocaleString()}</p>`;
    }

    div.innerHTML = `
      <strong>${cp.name}</strong><br>
      <button onclick="stamp(${cp.lat}, ${cp.lon}, this, ${cp.id}, '${cp.name.replace("'", "\\'")}')">Pecsételés</button>
      <p class="status"></p>
      ${stampStatus}
    `;

    if (cp.route === "Bakony") {
      if (bakonyDiv) bakonyDiv.appendChild(div);
    } else {
      if (balatonDiv) balatonDiv.appendChild(div);
    }
  });

  const allIds = checkpoints.map(p => p.id);
  const user = localStorage.getItem('loggedInUser');
  const stampedPointsNow = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];
  const stampedIds = stampedPointsNow.map(p => p.id);
  const allStamped = allIds.every(id => stampedIds.includes(id));
  const pdfBtn = document.getElementById('pdfBtn');
  if (pdfBtn) pdfBtn.disabled = !allStamped;
}

function stamp(targetLat, targetLon, button, cpId, cpName) {
  const statusP = button.nextElementSibling;
  if (!navigator.geolocation) {
    if (statusP) statusP.innerText = "A böngésző nem támogatja a helymeghatározást.";
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLon = pos.coords.longitude;
    const distance = getDistance(userLat, userLon, targetLat, targetLon);

    if (distance <= 100) {
      if (statusP) statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(distance)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 600);
    } else {
      if (statusP) statusP.innerHTML = `<span class="error">❌ Túl messze vagy a ponthoz (${Math.round(distance)} m)</span>`;
    }
  }, err => {
    if (statusP) statusP.innerText = "Nem sikerült lekérni a pozíciót.";
  }, {enableHighAccuracy: true, timeout: 10000});
}

function saveStamp(id, name) {
  const user = localStorage.getItem('loggedInUser');
  if (!user) return;
  const now = new Date().toISOString();
  let data = JSON.parse(localStorage.getItem('stamps') || '{}');

  if (!data[user]) data[user] = [];
  const alreadyStamped = data[user].some(p => p.id === id);
  if (!alreadyStamped) {
    data[user].push({ id, name, timestamp: now });
    localStorage.setItem('stamps', JSON.stringify(data));
  }
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ---------- export / csv / pdf / import (a korábbi kód) ---------- */

function exportJSON() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}');
  const data = { user, checkpoints: stamps[user] || [] };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${user.replace(' ', '_')}_pecsetek.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];
  let csv = `Felhasználó,Név,Időbélyeg\n`;
  stamps.forEach(p => {
    csv += `${user},"${p.name}","${new Date(p.timestamp).toLocaleString()}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${user.replace(' ', '_')}_pecsetek.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function generatePDF() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Teljesítési igazolás`, 20, 20);
  doc.setFontSize(12);
  doc.text(`Túrázó neve: ${user}`, 20, 30);
  let y = 40;
  stamps.forEach((p, index) => {
    const line = `${index + 1}. ${p.name} – ${new Date(p.timestamp).toLocaleString()}`;
    doc.text(line, 20, y);
    y += 10;
  });
  doc.save(`${user.replace(' ', '_')}_teljesites.pdf`);
}

function importJSON() {
  const fileInput = document.getElementById('importFile');
  if (!fileInput || !fileInput.files.length) {
    alert("Kérlek válassz ki egy JSON fájlt!");
    return;
  }
  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      const user = imported.user;
      const checkpoints = imported.checkpoints;
      if (!user || !Array.isArray(checkpoints)) {
        alert("Érvénytelen formátum!");
        return;
      }
      let currentData = JSON.parse(localStorage.getItem('stamps') || '{}');
      currentData[user] = checkpoints;
      localStorage.setItem('stamps', JSON.stringify(currentData));
      const logged = localStorage.getItem('loggedInUser');
      if (logged === user) loadCheckpoints();
      alert("Sikeres visszatöltés!");
    } catch (e) {
      alert("Nem sikerült beolvasni a fájlt.");
    }
  };
  reader.readAsText(fileInput.files[0]);
}

/* ---------- init: beállítások DOMContentLoaded ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // toggle szem
  const togglePw = document.getElementById("togglePw");
  const pwField = document.getElementById("password");
  if (togglePw && pwField) {
    togglePw.addEventListener("click", () => {
      if (pwField.type === "password") { pwField.type = "text"; togglePw.textContent = "🙈"; }
      else { pwField.type = "password"; togglePw.textContent = "👁️"; }
    });
  }

  // ha már be van jelentkezve a user a localStorage-ban -> mutatjuk a tartalmat (offline-friendly)
  const logged = localStorage.getItem('loggedInUser');
  if (logged) {
    document.getElementById('login')?.classList.add('hidden');
    document.getElementById('mainContent')?.classList.remove('hidden');
    document.getElementById('usernameDisplay').textContent = logged;
    loadCheckpoints();
    setStatus('Offline módban: a korábbi bejelentkezésed alapján pecsételhetsz.');
  }
});
