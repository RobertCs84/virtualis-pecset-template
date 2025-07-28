async function login() {
  const name = document.getElementById("name").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("https://script.google.com/macros/library/d/1Xe1b25A7Ovw87OfaRUAjt_m8ouXv6BtED1syPo9ez4w1SsLI2oCjjdNb/1");
    const users = await response.json();

    const validUser = users.find(user => user.name === name && user.password === password);

    if (validUser) {
      localStorage.setItem("loggedInUser", name);
      document.getElementById("loginForm").style.display = "none";
      document.getElementById("mainContent").style.display = "block";
      document.getElementById("usernameDisplay").textContent = name;
      loadCheckpoints();
    } else {
      document.getElementById("loginMsg").textContent = "Hibás felhasználónév vagy jelszó!";
    }
  } catch (error) {
    document.getElementById("loginMsg").textContent = "Hiba történt a bejelentkezés során.";
    console.error("Login error:", error);
  }
}

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
{ id: 13, name: "Alsóörs vasútállomás", lat: 46.9852998, lon: 17.9751434, route: "Balaton" },
];

window.onload = function () {
  const logged = localStorage.getItem('loggedInUser');
  if (logged) {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('tour').classList.remove('hidden');
    document.getElementById('usernameDisplay').innerText = logged;
    loadCheckpoints();
  }
};

function login() {
  const name = document.getElementById('name').value.trim();
  const pass = document.getElementById('password').value;
  const user = users.find(u => u.name === name && u.password === pass);

  if (user) {
    localStorage.setItem('loggedInUser', user.name);
    location.reload();
  } else {
    document.getElementById('loginMsg').innerText = "Hibás név vagy jelszó!";
  }
}

function logout() {
  localStorage.removeItem('loggedInUser');
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
    } else if (cp.route === "Balaton") {
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

    if (distance <= 100) {
      statusP.innerHTML = `<span class="success">✔️ Pecsét sikeres (${Math.round(distance)} m)</span>`;
      saveStamp(cpId, cpName);
      setTimeout(loadCheckpoints, 1000); // újratöltjük a listát frissített állapottal
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy a ponthoz (${Math.round(distance)} m)</span>`;
    }
  }, err => {
    statusP.innerText = "Nem sikerült lekérni a pozíciót.";
  });
}

function saveStamp(id, name) {
  const user = localStorage.getItem('loggedInUser');
  const now = new Date().toISOString();
  let data = JSON.parse(localStorage.getItem('stamps') || '{}');

  if (!data[user]) data[user] = [];

  // Ne duplikáljunk
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

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

document.getElementById("togglePw").addEventListener("click", function () {
  const pwField = document.getElementById("password");
  const isHidden = pwField.type === "password";
  pwField.type = isHidden ? "text" : "password";
});

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
  if (!fileInput.files.length) {
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

      // Ha a bejelentkezett felhasználóra töltöttük vissza:
      const logged = localStorage.getItem('loggedInUser');
      if (logged === user) {
        loadCheckpoints();
      }

      alert("Sikeres visszatöltés!");
    } catch (e) {
      alert("Nem sikerült beolvasni a fájlt.");
    }
  };

  reader.readAsText(fileInput.files[0]);
}
