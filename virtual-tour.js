let USERS = [];

async function loadUsers() {
  const response = await fetch("users.json");
  USERS = await response.json();
}

/* PBKDF2 hash-elés */
async function pbkdf2Hash(password, saltHex, iterations = 100000) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  return Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Bejelentkezés */
async function login() {
  const name = document.getElementById("name").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("loginMsg");
  msg.textContent = "Ellenőrzés folyamatban…";

  if (!USERS.length) await loadUsers();
  const user = USERS.find(u => u.name === name);
  if (!user) return msg.textContent = "Nincs ilyen felhasználó!";

  const computedHash = await pbkdf2Hash(password, user.salt, user.iterations);
  if (computedHash === user.hash) {
    msg.textContent = "";
    localStorage.setItem("loggedInUser", name);
    document.getElementById("login").classList.add("hidden");
    document.getElementById("mainContent").classList.remove("hidden");
    document.getElementById("usernameDisplay").textContent = name;
    loadCheckpoints();
  } else {
    msg.textContent = "Hibás jelszó!";
  }
}

function logout() {
  localStorage.removeItem("loggedInUser");
  location.reload();
}

/* Ellenőrzőpontok */
const checkpoints = [
  { id: 1, name: "Városlőd", lat: 47.1594727, lon: 17.6710794, route: "Bakony" },
  { id: 2, name: "OKT - Kisvasút nyomvonal találkozása", lat: 47.1742054, lon: 17.6677350, route: "Bakony" },
  { id: 3, name: "Szénpajtai-pihenő", lat: 47.1946432, lon: 17.6685077, route: "Bakony" },
  { id: 4, name: "Pápavár alja - Piros sáv és + elágazás", lat: 47.2341698, lon: 17.6751480, route: "Bakony" },
  { id: 5, name: "Királykapu (fűtőház)", lat: 47.2561136, lon: 17.6626225, route: "Bakony" },
  { id: 6, name: "Egykori Odvaskő megállóhely", lat: 47.2860120, lon: 17.7060150, route: "Bakony" },
  { id: 7, name: "Huszárokelőpuszta", lat: 47.3146886, lon: 17.6886906, route: "Bakony" },
  { id: 8, name: "Veszprém vasútállomás", lat: 47.1189646, lon: 17.9114044, route: "Balaton" },
  { id: 9, name: "Haszkovó – Őrház utca", lat: 47.1036732, lon: 17.9201985, route: "Balaton" },
  { id: 10, name: "Veszprém régi vasútállomás", lat: 47.0950814, lon: 17.9175577, route: "Balaton" },
  { id: 11, name: "Meggyespuszta", lat: 47.0517992, lon: 17.9374564, route: "Balaton" },
  { id: 12, name: "Vödörvölgy – Zöld étterem", lat: 47.0362092, lon: 17.9799228, route: "Balaton" },
  { id: 13, name: "Töltés utca – 375-ös gőzmozdony", lat: 47.0300097, lon: 18.0080322, route: "Balaton" },
  { id: 14, name: "Alsóörs vasútállomás", lat: 46.9852998, lon: 17.9751434, route: "Balaton" }
];

document.addEventListener("DOMContentLoaded", () => {
  const pwField = document.getElementById("password");
  const togglePw = document.getElementById("togglePw");

  if (togglePw && pwField) {
    togglePw.addEventListener("click", () => {
      const isHidden = pwField.type === "password";
      pwField.type = isHidden ? "text" : "password";
      togglePw.classList.toggle("fa-eye");
      togglePw.classList.toggle("fa-eye-slash");
    });
  }

  const logged = localStorage.getItem("loggedInUser");
  if (logged) {
    document.getElementById("login")?.classList.add("hidden");
    document.getElementById("mainContent")?.classList.remove("hidden");
    document.getElementById("usernameDisplay").textContent = logged;
    loadCheckpoints();
  }
});

/* Ellenőrzőpont-megjelenítés */
function loadCheckpoints() {
  const user = localStorage.getItem("loggedInUser");
  const stamps = JSON.parse(localStorage.getItem("stamps") || "{}");
  const stampedPoints = stamps[user] || [];

  const bakonyDiv = document.getElementById("bakonyPoints");
  const balatonDiv = document.getElementById("balatonPoints");
  bakonyDiv.innerHTML = "";
  balatonDiv.innerHTML = "";

  checkpoints.forEach(cp => {
    const div = document.createElement("div");
    div.className = "checkpoint";
    const match = stampedPoints.find(p => p.id === cp.id);
    const status = match ? `<p class="success">✔️ Már lepecsételted: ${new Date(match.timestamp).toLocaleString()}</p>` : "";
    div.innerHTML = `
      <strong>${cp.name}</strong><br>
      <button onclick="stamp(${cp.lat}, ${cp.lon}, this, ${cp.id}, '${cp.name}')">Pecsételés</button>
      <p class="status"></p>${status}`;
    (cp.route === "Bakony" ? bakonyDiv : balatonDiv).appendChild(div);
  });
}

/* Távolság / pecsét */
function stamp(targetLat, targetLon, button, cpId, cpName) {
  const statusP = button.nextElementSibling;
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const d = getDistance(latitude, longitude, targetLat, targetLon);
    if (d <= 100) {
      statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(d)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 600);
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy (${Math.round(d)} m)</span>`;
    }
  }, () => statusP.innerText = "Nem sikerült lekérni a pozíciót.");
}

/* Mentés */
function saveStamp(id, name) {
  const user = localStorage.getItem("loggedInUser");
  const now = new Date().toISOString();
  let data = JSON.parse(localStorage.getItem("stamps") || "{}");
  if (!data[user]) data[user] = [];
  if (!data[user].some(p => p.id === id)) {
    data[user].push({ id, name, timestamp: now });
    localStorage.setItem("stamps", JSON.stringify(data));
  }
}

/* Export / Import / PDF */
function exportJSON() {
  const user = localStorage.getItem("loggedInUser");
  const data = { user, checkpoints: JSON.parse(localStorage.getItem("stamps") || "{}")[user] || [] };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${user}_pecsetek.json`;
  a.click();
}

function exportCSV() {
  const user = localStorage.getItem("loggedInUser");
  const stamps = JSON.parse(localStorage.getItem("stamps") || "{}")[user] || [];
  let csv = `Felhasználó,Név,Időbélyeg\n`;
  stamps.forEach(p => csv += `${user},"${p.name}","${new Date(p.timestamp).toLocaleString()}"\n`);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${user}_pecsetek.csv`;
  a.click();
}

async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const user = localStorage.getItem("loggedInUser");
  const stamps = JSON.parse(localStorage.getItem("stamps") || "{}")[user] || [];
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Teljesítési igazolás", 20, 20);
  doc.setFontSize(12);
  doc.text(`Túrázó neve: ${user}`, 20, 30);
  let y = 45;
  stamps.forEach((p, i) => {
    doc.text(`${i + 1}. ${p.name} – ${new Date(p.timestamp).toLocaleString()}`, 20, y);
    y += 10;
  });
  doc.save(`${user}_teljesites.pdf`);
}

function importJSON() {
  const input = document.getElementById("importFile");
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const imported = JSON.parse(e.target.result);
      let all = JSON.parse(localStorage.getItem("stamps") || "{}");
      all[imported.user] = imported.checkpoints || [];
      localStorage.setItem("stamps", JSON.stringify(all));
      loadCheckpoints();
      alert("Sikeres visszatöltés!");
    } catch {
      alert("Hibás fájlformátum!");
    }
  };
  reader.readAsText(input.files[0]);
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}