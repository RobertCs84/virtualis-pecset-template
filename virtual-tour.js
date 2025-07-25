const users = [
  { name: "Don Joe", password: "30Vse12" }
];

const checkpoints = [
  { id: 1, name: "Városlőd", lat: 47.1594727, lon: 17.6710794 },
  { id: 2, name: "Odvaskő", lat: 47.283689, lon: 17.7061015 },
  { id: 3, name: "Huszárokelőpuszta", lat: 47.3146701, lon: 17.6887561 },
  { id: 4, name: "Veszprém", lat: 47.1189646, lon: 17.9114044 },
  { id: 5, name: "Meggyespuszta", lat: 47.0517992, lon: 17.9374564 },
  { id: 6, name: "Alsóőrs", lat: 46.9854293, lon: 17.9743677 }
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
  const container = document.getElementById('checkpoints');
  checkpoints.forEach(cp => {
    const div = document.createElement('div');
    div.className = 'checkpoint';
    div.innerHTML = `
      <strong>${cp.name}</strong><br>
      <button onclick="stamp(${cp.lat}, ${cp.lon}, this)">Pecsételés</button>
      <p class="status"></p>
    `;
    container.appendChild(div);
  });
}

function stamp(targetLat, targetLon, button) {
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
    } else {
      statusP.innerHTML = `<span class="error">❌ Túl messze vagy a ponthoz (${Math.round(distance)} m)</span>`;
    }
  }, err => {
    statusP.innerText = "Nem sikerült lekérni a pozíciót.";
  });
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
