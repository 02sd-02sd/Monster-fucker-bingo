const firebaseConfig = {
    apiKey: "AIzaSyBrpJo93YOmGXVNKocRzbZzeS2b2qImHXM",
    authDomain: "bingo-249c6.firebaseapp.com",
    databaseURL: "https://bingo-249c6-default-rtdb.firebaseio.com",
    projectId: "bingo-249c6",
    storageBucket: "bingo-249c6.firebasestorage.app",
    messagingSenderId: "696241347036",
    appId: "1:696241347036:web:33c4dd6aea36a5adb5d719"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerId = localStorage.getItem("playerId");
if (!playerId) {
    playerId = "web_" + Math.floor(Math.random() * 1000000);
    localStorage.setItem("playerId", playerId);
}

let playerName = "";
let generatedBoard = null;
let marks = Array(25).fill(false);
let sharedItems = null;

function showDialog(html) {
    const overlay = document.getElementById("dialogOverlay");
    const box = document.getElementById("dialogBox");
    box.innerHTML = html;
    overlay.classList.remove("hidden");
}

function closeDialog() {
    document.getElementById("dialogOverlay").classList.add("hidden");
}

window.savePlayerName = function () {
    const input = document.getElementById("playerNameInput");
    playerName = input.value.trim();
    if (!playerName) return;

    document.getElementById("playerNameDisplay").innerText = "You: " + playerName;

    db.ref("players/" + playerId + "/name").set(playerName);
    db.ref("players/" + playerId + "/marks").set(marks);
};

function renderBoard() {
    if (!generatedBoard) return;

    const boardDiv = document.getElementById("board");
    boardDiv.innerHTML = "";

    generatedBoard.forEach((item, i) => {
        const div = document.createElement("div");
        div.className = "square";
        if (marks[i]) div.classList.add("marked");
        div.innerText = item;

        div.onclick = () => {
            marks[i] = !marks[i];
            db.ref("players/" + playerId + "/marks").set(marks);
            renderBoard();
        };

        boardDiv.appendChild(div);
    });
}

function normalizeList(val) {
    if (!val) return null;
    if (Array.isArray(val)) return val;
    const keys = Object.keys(val).sort((a, b) => Number(a) - Number(b));
    return keys.map(k => val[k]);
}

db.ref("board/items").on("value", snap => {
    const val = snap.val();
    const list = normalizeList(val);
    if (list && list.length > 0) {
        sharedItems = list;
    }
});

db.ref("board/generated").on("value", snap => {
    const val = snap.val();
    const list = normalizeList(val);
    if (list && list.length === 25) {
        generatedBoard = list;
        renderBoard();
    }
});

db.ref("players/" + playerId + "/marks").on("value", snap => {
    const val = snap.val();
    const list = normalizeList(val);
    if (list && list.length === 25) {
        marks = list;
        renderBoard();
    }
});

window.showAddItem = function () {
    showDialog(`
        <div id="dialogHeader">
            <span id="dialogTitle">Add Item</span>
            <span id="dialogClose">✖</span>
        </div>
        <div id="dialogContent">
            <input id="newItemInput" placeholder="New item">
            <button class="btn" onclick="addItem()">Add</button>
        </div>
    `);

    document.getElementById("dialogClose").onclick = closeDialog;
};

window.addItem = function () {
    const item = document.getElementById("newItemInput").value.trim();
    if (!item) return;
    if (!sharedItems) sharedItems = [];

    sharedItems.push(item);
    db.ref("board/items").set(sharedItems);

    closeDialog();
};

window.showList = function () {
    if (!sharedItems || sharedItems.length === 0) {
        showDialog(`
            <div id="dialogHeader">
                <span id="dialogTitle">Shared List</span>
                <span id="dialogClose">✖</span>
            </div>
            <div id="dialogContent">List is empty.</div>
        `);
        document.getElementById("dialogClose").onclick = closeDialog;
        return;
    }

    let html = `
        <div id="dialogHeader">
            <span id="dialogTitle">Shared List</span>
            <span id="dialogClose">✖</span>
        </div>
        <div id="dialogContent">
    `;

    sharedItems.forEach((item, i) => {
        html += `<div>${i + 1}. ${item}</div>`;
    });

    html += `</div>`;

    showDialog(html);

    document.getElementById("dialogClose").onclick = closeDialog;
};

window.voteRefresh = function () {
    db.ref("votes/" + playerId).set(true);
};

db.ref("votes").on("value", snap => {
    let total = 0;
    let yes = 0;

    snap.forEach(child => {
        total++;
        if (child.val()) yes++;
    });

    document.getElementById("voteInfo").innerText =
        `Vote to Refresh Board (${yes} / ${total})`;

    if (total > 0 && yes * 2 >= total) {
        refreshBoard();
        db.ref("votes").remove();
    }
});

function refreshBoard() {
    if (!sharedItems || sharedItems.length < 24) return;

    const shuffled = sharedItems.slice().sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 24);

    const newBoard = Array(25).fill("");
    newBoard[12] = "FREE";

    let idx = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) continue;
        newBoard[i] = selected[idx++];
    }

    db.ref("board/generated").set(newBoard);

    db.ref("players").once("value").then(snap => {
        snap.forEach(child => {
            const id = child.key;
            db.ref("players/" + id + "/marks").set(Array(25).fill(false));
        });
    });
}

window.showPlayers = function () {
    db.ref("players").once("value").then(snap => {
        const players = [];
        snap.forEach(child => {
            const id = child.key;
            if (id === playerId) return;

            const name = child.child("name").val() || "Unknown";
            const marksVal = child.child("marks").val();
            const marksList = normalizeList(marksVal) || Array(25).fill(false);

            players.push({ id, name, marks: marksList });
        });

        if (players.length === 0) {
            showDialog(`
                <div id="dialogHeader">
                    <span id="dialogTitle">Players</span>
                    <span id="dialogClose">✖</span>
                </div>
                <div id="dialogContent">No other players yet.</div>
            `);
            document.getElementById("dialogClose").onclick = closeDialog;
            return;
        }

        let html = `
            <div id="dialogHeader">
                <span id="dialogTitle">Players</span>
                <span id="dialogClose">✖</span>
            </div>
            <div id="dialogContent">
        `;

        players.forEach(p => {
            html += `<button class="btn" onclick="showPlayerBoard('${p.id}')">${p.name}</button>`;
        });

        html += `</div>`;

        showDialog(html);
        document.getElementById("dialogClose").onclick = closeDialog;
    });
};

window.showPlayerBoard = function (id) {
    db.ref("players/" + id).once("value").then(snap => {
        const name = snap.child("name").val() || "Unknown";
        const marksVal = snap.child("marks").val();
        const marksList = normalizeList(marksVal) || Array(25).fill(false);

        let html = `
            <div id="dialogHeader">
                <span id="dialogTitle">Board for ${name}</span>
                <span id="dialogClose">✖</span>
            </div>
            <div id="dialogContent" class="grid">
        `;

        for (let i = 0; i < 25; i++) {
            const marked = marksList[i];
            html += `
                <div class="square ${marked ? "marked" : ""}">
                    ${generatedBoard ? generatedBoard[i] : ""}
                </div>
            `;
        }

        html += `</div>`;

        showDialog(html);
        document.getElementById("dialogClose").onclick = closeDialog;
    });
};
