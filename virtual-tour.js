// A Google Apps Script URL-je, amit közzétett a "Web app" módban.
// Cserélje le erre a saját URL-jére!
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwiso5Qg5qy8JQj7PvkblLLDFfuM_XzZVtKPkNZBSWQJr_BBx7l7W5s_YEZ_etfZoN4zQ/exec";

async function login() {
  const nameField = document.getElementById("name");
  const passwordField = document.getElementById("password");
  const loginMsg = document.getElementById("loginMsg");

  if (!nameField || !passwordField || !loginMsg) {
    console.error("Hiányzik a beviteli mező (name, password) vagy a loginMsg elem.");
    return;
  }

  const name = nameField.value.trim();
  const password = passwordField.value.trim();
  
  loginMsg.textContent = "Ellenőrzés folyamatban...";

  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'login',
        username: name,
        password: password
      })
    });

    const result = await response.json();

    if (result.success) {
      loginMsg.textContent = "";
      localStorage.setItem("loggedInUser", name);
      localStorage.setItem("authToken", result.token); // Token tárolása
      document.getElementById("login").style.display = "none";
      document.getElementById("mainContent").style.display = "block";
      document.getElementById("usernameDisplay").textContent = name;
      loadCheckpoints();
    } else {
      loginMsg.textContent = result.message || "Hibás felhasználónév vagy jelszó!";
    }
  } catch (error) {
    loginMsg.textContent = "Hiba történt a bejelentkezés során.";
    console.error("Login error:", error);
  }
}

const checkpoints = [
  { id: 1, name: "Városlőd", lat: 47.1594727, lon: 17.6710794, route: "Bakony" },
  { id: 2, name: "Szénpajtai-pihenő", lat:  47.1946432, lon: 17.6685077, route: "Bakony" },
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
  { id: 13, name: "Alsóörs vasútállomás", lat: 46.9852998, lon: 17.9751434, route: "Balaton" },
];

document.addEventListener("DOMContentLoaded", () => {
  // A DOM betöltése után ellenőrizzük a hitelesítést
  checkAuthAndLoad();

  const pwField = document.getElementById("password");
  const togglePw = document.getElementById("togglePw");
  if (togglePw && pwField) {
    togglePw.addEventListener("click", () => {
      if (pwField.type === "password") {
        pwField.type = "text";
        togglePw.innerText = "🙈"; // szem becsukva
      } else {
        pwField.type = "password";
        togglePw.innerText = "👁️"; // szem nyitva
      }
    });
  }
});

async function checkAuthAndLoad() {
  const loginEl = document.getElementById('login');
  const tourEl = document.getElementById('mainContent');
  const userSpan = document.getElementById('usernameDisplay');
  const authToken = localStorage.getItem('authToken');
  const loggedUser = localStorage.getItem('loggedInUser');

  if (authToken && loggedUser) {
    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'checkAuth',
          token: authToken
        })
      });
      const result = await response.json();

      if (result.success && result.username === loggedUser) {
        // A token érvényes, és a felhasználónév megegyezik
        if (loginEl) loginEl.classList.add('hidden');
        if (tourEl) tourEl.classList.remove('hidden');
        if (userSpan) userSpan.innerText = loggedUser;
        loadCheckpoints();
      } else {
        // Token érvénytelen vagy nem egyezik a felhasználónévvel
        logout(); // Kijelentkeztetés
      }
    } catch (error) {
      console.error("Token ellenőrzési hiba:", error);
      logout(); // Hiba esetén kijelentkeztetés
    }
  } else {
    // Nincs token vagy felhasználó, marad a bejelentkezési oldalon
    if (loginEl) loginEl.classList.remove('hidden');
    if (tourEl) tourEl.classList.add('hidden');
  }
}

function logout() {
  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('authToken'); // Token törlése
  location.reload();
}

function loadCheckpoints() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}');
  const stampedPoints = stamps[user] || [];

  const bakonyDiv = document.getElementById('bakonyPoints');
  const balatonDiv = document.getElementById('balatonPoints');

  bakonyDiv.innerHTML = '';
  balatonDiv.innerHTML = '';

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
      <button onclick="stamp(${cp.lat}, ${cp.lon}, this, ${cp.id}, '${cp.name}')">Pecsételés</button>
      <p class="status"></p>
      ${stampStatus}
    `;

    if (cp.route === "Bakony") {
      bakonyDiv.appendChild(div);
    } else {
      balatonDiv.appendChild(div);
    }
  });

  const allIds = checkpoints.map(p => p.id);
  const stampedIds = stampedPoints.map(p => p.id);
  const allStamped = allIds.every(id => stampedIds.includes(id));

  document.getElementById("pdfBtn").disabled = !allStamped;
}

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

    if (distance <= 100) { // 100 méteres sugarú körben
      statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(distance)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 1000); // Újratöltés a mentés után
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy a ponthoz (${Math.round(distance)} m)</span>`;
    }
  }, err => {
    statusP.innerText = "Nem sikerült lekérni a pozíciót.";
    console.error("Geolocation error:", err);
  });
}

function saveStamp(id, name) {
  const user = localStorage.getItem('loggedInUser');
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
  const R = 6371000; // Föld sugara méterben
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

function exportJSON() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}');
  const data = {
    user,
    checkpoints: stamps[user] || []
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${user.replace(' ', '_')}_pecsetek.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV() {
  const user = localStorage.getItem('loggedInUser');
  const stamps = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];

  let csv = `Felhasználó,Név,Időbélyeg\n`;
  stamps.forEach(p => {
    csv += `${user},"${p.name}","${new Date(p.timestamp).toLocaleString()}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${user.replace(' ', '_')}_pecsetek.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  // Helyettesítsük az alert-et egy egyszerű üzenetdobozzal
  const showMessage = (msg) => {
    const loginMsg = document.getElementById("loginMsg");
    if (loginMsg) {
      loginMsg.textContent = msg;
      setTimeout(() => loginMsg.textContent = "", 3000); // Üzenet elrejtése 3 másodperc után
    }
  };

  if (!fileInput.files.length) {
    showMessage("Kérlek válassz ki egy JSON fájlt!");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const imported = JSON.parse(event.target.result);
      const user = imported.user;
      const checkpoints = imported.checkpoints;

      if (!user || !Array.isArray(checkpoints)) {
        showMessage("Érvénytelen formátum!");
        return;
      }

      let currentData = JSON.parse(localStorage.getItem('stamps') || '{}');
      currentData[user] = checkpoints;
      localStorage.setItem('stamps', JSON.stringify(currentData));

      const logged = localStorage.getItem('loggedInUser');
      if (logged === user) {
        loadCheckpoints();
      }

      showMessage("Sikeres visszatöltés!");
    } catch (e) {
      showMessage("Nem sikerült beolvasni a fájlt.");
      console.error("Import JSON error:", e);
    }
  };

  reader.readAsText(fileInput.files[0]);
}
