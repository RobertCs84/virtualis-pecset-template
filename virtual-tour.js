// Ide illessze be a Google Apps Script webalkalmazás URL-jét, miután telepítette.
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby7DMe3yx4S1mfRvUGTTeBJYoTODgB6_QYchTKh_25gwrk1vdDjp1CrX7JWNvUvSkCb/exec";

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoad();
    // Eseményfigyelő hozzáadása a jelszó mutatása/elrejtése funkcióhoz
    document.getElementById('togglePw').addEventListener('click', function (e) {
        const passwordField = document.getElementById('password');
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        this.textContent = type === 'password' ? '👁️' : '🔒';
    });
});

async function login() {
    const nameField = document.getElementById("name");
    const passwordField = document.getElementById("password");

    if (!nameField || !passwordField) {
        console.error("Hiányzik a beviteli mező (name vagy password)");
        return;
    }

    const name = nameField.value.trim();
    const password = passwordField.value.trim();

    document.getElementById("loginMsg").textContent = "Ellenőrzés folyamatban...";

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login',
                username: name,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById("loginMsg").textContent = "";
            localStorage.setItem("loggedInToken", result.token);
            document.getElementById("login").classList.add("hidden");
            document.getElementById("mainContent").classList.remove("hidden");
            document.getElementById("usernameDisplay").textContent = result.username;
            loadCheckpoints();
        } else {
            document.getElementById("loginMsg").textContent = result.message;
        }
    } catch (error) {
        console.error("Hiba történt a bejelentkezés során:", error);
        document.getElementById("loginMsg").textContent = "Hiba történt a bejelentkezés során.";
    }
}

async function checkAuthAndLoad() {
    const token = localStorage.getItem("loggedInToken");
    if (!token) {
        document.getElementById("login").classList.remove("hidden");
        document.getElementById("mainContent").classList.add("hidden");
        return;
    }

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'checkAuth',
                token: token
            })
        });
        const result = await response.json();

        if (result.success) {
            document.getElementById("login").classList.add("hidden");
            document.getElementById("mainContent").classList.remove("hidden");
            document.getElementById("usernameDisplay").textContent = result.username;
            loadCheckpoints();
        } else {
            localStorage.removeItem("loggedInToken");
            document.getElementById("login").classList.remove("hidden");
            document.getElementById("mainContent").classList.add("hidden");
        }
    } catch (error) {
        console.error("Hiba történt a token ellenőrzése során:", error);
        localStorage.removeItem("loggedInToken");
        document.getElementById("login").classList.remove("hidden");
        document.getElementById("mainContent").classList.add("hidden");
    }
}

function logout() {
    localStorage.removeItem("loggedInToken");
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("mainContent").classList.add("hidden");
    document.getElementById("name").value = "";
    document.getElementById("password").value = "";
    document.getElementById("bakonyPoints").innerHTML = "";
    document.getElementById("balatonPoints").innerHTML = "";
}

// A többi funkció (loadCheckpoints, stamp, export, etc.)
// továbbra is használja a tokent az ellenőrzéshez.
// Ezt a loadCheckpoints függvényen keresztül mutatjuk be.
async function loadCheckpoints() {
    const token = localStorage.getItem("loggedInToken");
    if (!token) return;

    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'getCheckpoints', // új akció az ellenőrzőpontok lekérdezéséhez
                token: token
            })
        });

        const result = await response.json();

        if (result.success) {
            const username = result.username;
            const checkpoints = result.checkpoints || {}; // Feltételezve, hogy a szerver adja vissza a pecséteket
            
            // Jelenlegi pecsétek betöltése
            renderCheckpoints(username, checkpoints);
        } else {
            console.error("Hiba a pecsétek lekérdezésekor:", result.message);
            // Kezeljük a hibát (pl. kijelentkezés)
            logout();
        }
    } catch (error) {
        console.error("Hiba a pecsétek lekérdezésekor:", error);
        logout();
    }

    // --- A megmaradó `virtual-tour.js` kód ide jön, de a GPX fájlok URL-jei megmaradnak ---
    // A renderCheckpoints, stamp, exportJSON és exportCSV függvények változatlanok
    // a lokális tárolást használó eredeti logikával.

    // Megjegyzés: A "stamp" és a "getCheckpoints" funkciókat is módosítani
    // kellene, hogy kommunikáljanak a Google Apps Script-tel a lokális
    // tárolás helyett, ha a pecséteket is a szerveren szeretné tárolni.
    // Ezt a jelenlegi verzió nem tartalmazza, csak a bejelentkezési logikát.
}

// A lenti kódrészletek megegyeznek az eredeti kóddal.
// Ide másolja be az eredeti 'virtual-tour.js' fájl fennmaradó tartalmát,
// a 'login' függvény kivételével.

function renderCheckpoints(username, savedStamps) {
    const checkpoints = {
        'bakony': ['Fenyőfő', 'Pénzesgyőr', 'Porva-Csesznek', 'Borzavár', 'Zirc'],
        'balaton': ['Alsóörs', 'Felsőörs', 'Lovas', 'Paloznak', 'Csopak']
    };

    function renderSection(sectionId, sectionName) {
        const container = document.getElementById(sectionId);
        container.innerHTML = '';
        checkpoints[sectionName].forEach(p => {
            const hasStamp = savedStamps && savedStamps.includes(p);
            const stampButton = `<button onclick="stamp('${p}')" ${hasStamp ? 'disabled' : ''}>Pecsételés</button>`;
            const statusClass = hasStamp ? 'success' : 'error';
            const statusText = hasStamp ? 'Pecsételve' : 'Nincs pecsét';

            container.innerHTML += `
                <div class="checkpoint">
                    <strong>${p}</strong>: <span class="${statusClass}">${statusText}</span> ${stampButton}
                </div>
            `;
        });
    }

    renderSection('bakonyPoints', 'bakony');
    renderSection('balatonPoints', 'balaton');
}

function stamp(pointName) {
    const username = localStorage.getItem("loggedInToken"); // Token használata a felhasználó azonosítására
    if (!username) {
        alert("Nincs bejelentkezett felhasználó!");
        return;
    }

    let stamps = JSON.parse(localStorage.getItem('stamps') || '{}');
    if (!stamps[username]) {
        stamps[username] = [];
    }
    
    // Pecsételés hozzáadása
    if (!stamps[username].some(p => p.name === pointName)) {
        stamps[username].push({
            name: pointName,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('stamps', JSON.stringify(stamps));
        
        loadCheckpoints(); // Frissíti a felületet
        alert('Sikeresen pecsételt!');
    } else {
        alert('Ezt a pecsétet már megszerezte!');
    }
}

function exportJSON() {
    const user = localStorage.getItem("loggedInToken");
    const stamps = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];
    const data = {
        user: user,
        checkpoints: stamps
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${user.replace(' ', '_')}_pecsetek.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportCSV() {
    const user = localStorage.getItem("loggedInToken");
    const stamps = JSON.parse(localStorage.getItem('stamps') || '{}')[user] || [];
    let csvContent = "data:text/csv;charset=utf-8,Ellenőrzőpont,Dátum\n";
    stamps.forEach(p => {
        csvContent += `${p.name},${new Date(p.timestamp).toLocaleString()}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${user.replace(' ', '_')}_pecsetek.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
