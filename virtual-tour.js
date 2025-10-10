/*********************************************************
 * Virtuális Túra – Felhasználó hitelesítés users.json-ből
 * PBKDF2 + Salt alapú jelszóellenőrzés
 *********************************************************/

let USERS = [];

async function loadUsers() {
  const response = await fetch("users.json");
  USERS = await response.json();
}

/* PBKDF2 hash-elés Web Crypto API-val */
async function pbkdf2Hash(password, saltHex, iterations = 100000) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/* Bejelentkezés */
async function login() {
  const name = document.getElementById("name").value.trim();
  const password = document.getElementById("password").value;

  const msg = document.getElementById("loginMsg");
  msg.textContent = "Ellenőrzés folyamatban…";

  if (!USERS.length) await loadUsers();
  const user = USERS.find(u => u.name === name);
  if (!user) {
    msg.textContent = "Nincs ilyen felhasználó!";
    return;
  }

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

/* Kijelentkezés */
function logout() {
  localStorage.removeItem("loggedInUser");
  location.reload();
}

/* Ellenőrzőpontok */
const checkpoints = [
  { id: 1, name: "Városlőd", lat: 47.1594727, lon: 17.6710794, route: "Bakony" },
  { id: 2, name: "Szénpajtai-pihenő", lat: 47.1946432, lon: 17.6685077, route: "Bakony" },
  { id: 3, name: "Királykapu (fűtőház)", lat: 47.2561136, lon: 17.6626225, route: "Bakony" },
  { id: 4, name: "Természetvédelmi tábla", lat: 47.2836890, lon: 17.7061015, route: "Bakony" },
  { id: 5, name: "Huszárokelőpuszta", lat: 47.3146886, lon: 17.6886906, route: "Bakony" },
  { id: 6, name: "Alsóörs vasútállomás", lat: 46.9852998, lon: 17.9751434, route: "Balaton" }
];

/* Betöltés után ellenőrzi, hogy már be van-e lépve */
document.addEventListener("DOMContentLoaded", () => {
  const pwField = document.getElementById("password");
  const togglePw = document.getElementById("togglePw");

  if (togglePw && pwField) {
    togglePw.addEventListener("click", () => {
      if (pwField.type === "password") {
        pwField.type = "text";
        togglePw.classList.remove("fa-eye-slash");
        togglePw.classList.add("fa-eye");
      } else {
        pwField.type = "password";
        togglePw.classList.remove("fa-eye");
        togglePw.classList.add("fa-eye-slash");
      }
    });
  }

  // ha már be van jelentkezve a user
  const logged = localStorage.getItem("loggedInUser");
  if (logged) {
    document.getElementById("login")?.classList.add("hidden");
    document.getElementById("mainContent")?.classList.remove("hidden");
    document.getElementById("usernameDisplay").textContent = logged;
    loadCheckpoints();
    setStatus("Offline módban: a korábbi bejelentkezésed alapján pecsételhetsz.");
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
    let stampStatus = match
      ? `<p class="success">✔️ Már lepecsételted: ${new Date(match.timestamp).toLocaleString()}</p>`
      : "";

    div.innerHTML = `
      <strong>${cp.name}</strong><br>
      <button onclick="stamp(${cp.lat}, ${cp.lon}, this, ${cp.id}, '${cp.name}')">Pecsételés</button>
      <p class="status"></p>
      ${stampStatus}
    `;

    if (cp.route === "Bakony") bakonyDiv.appendChild(div);
    else balatonDiv.appendChild(div);
  });
}

/* Távolság és pecsételés */
function stamp(targetLat, targetLon, button, cpId, cpName) {
  const statusP = button.nextElementSibling;
  if (!navigator.geolocation) {
    statusP.innerText = "A böngésző nem támogatja a helymeghatározást.";
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {
    const userLat = pos.coords.latitude;
    const userLon = pos.coords.longitude;
    const distance = getDistance(userLat, userLon, targetLat, targetLon);

    if (distance <= 100) {
      statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(distance)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 500);
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy (${Math.round(distance)} m)</span>`;
    }
  }, () => {
    statusP.innerText = "Nem sikerült lekérni a pozíciót.";
  });
}

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

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}