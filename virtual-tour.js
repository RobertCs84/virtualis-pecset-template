// Ide illessze be a Google Apps Script webalkalmazás URL-jét, miután telepítette.
const GOOGLE_APPS_SCRIPT_URL = "IDE_ILLASSZA_BE_AZ_ON_URL-JÉT";

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
            localStorage.setItem("username", result.username); // A felhasználónevet is tároljuk a későbbi használathoz
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
    localStorage.removeItem("username");
    document.getElementById("login").classList.remove("hidden");
    document.getElementById("mainContent").classList.add("hidden");
    document.getElementById("name").value = "";
    document.getElementById("password").value = "";
    document.getElementById("bakonyPoints").innerHTML = "";
    document.getElementById("balatonPoints").innerHTML = "";
}

function loadCheckpoints() {
    const username = localStorage.getItem("username");
    const checkpoints = {
        'bakony': ['Fenyőfő', 'Pénzesgyőr', 'Porva-Csesznek', 'Borzavár', 'Zirc'],
        'balaton': ['Alsóörs', 'Felsőörs', 'Lovas', 'Paloznak', 'Csopak']
    };

    const savedStamps = JSON.parse(localStorage.getItem('stamps') || '{}')[username] || [];

    function renderSection(sectionId, sectionName) {
        const container = document.getElementById(sectionId);
        container.innerHTML = '';
        checkpoints[sectionName].forEach(p => {
            const hasStamp = savedStamps.some(s => s.name === p);
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
    const username = localStorage.getItem("username");
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
    const user = localStorage.getItem("username");
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
    const user = localStorage.getItem("username");
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

function exportPDF() {
  const user = localStorage.getItem("username");
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
