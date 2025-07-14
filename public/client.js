// Setup
const socket = io();
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const rollBtn = document.getElementById("rollBtn");
const diceResult = document.getElementById("diceResult");
const pieceTypeSelect = document.getElementById("pieceTypeSelect");
const deleteModeBtn = document.getElementById("deleteModeBtn");
let deleteMode = false;

deleteModeBtn.addEventListener("click", () => {
  deleteMode = !deleteMode;
  deleteModeBtn.textContent = deleteMode ? "Exit Delete Mode" : "Toggle Delete Mode";
});

// Board config
const HEX_SIZE = 30;
const labelMap = { skeleton: "S", ghoul: "G", wraith: "W", construct: "C", player: "P" };
const defaultHealth = { skeleton: 8, ghoul: 10, wraith: 6, construct: 20, player: 20 };

const pieces = [
  { x: 0, y: 0, color: "blue", type: "skeleton", rotation: 0, health: 8 },
  { x: 2, y: 2, color: "blue", type: "skeleton", rotation: 0, health: 8 },
  { x: -2, y: 1, color: "blue", type: "skeleton", rotation: 0, health: 8 },
  { x: 0, y: -3, color: "red", type: "player", rotation: 0, health: 20 },
  { x: 2, y: -3, color: "red", type: "player", rotation: 0, health: 20 },
  { x: -2, y: -3, color: "red", type: "player", rotation: 0, health: 20 }
];

function hexToPixel(q, r) {
  const x = HEX_SIZE * 3/2 * q;
  const y = HEX_SIZE * Math.sqrt(3) * (r + q / 2);
  return { x, y };
}

function pixelToHex(x, y) {
  const q = (2/3 * x) / HEX_SIZE;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / HEX_SIZE;
  return hexRound(q, r);
}

function hexRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const x_diff = Math.abs(rx - x), y_diff = Math.abs(ry - y), z_diff = Math.abs(rz - z);
  if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
  else if (y_diff > z_diff) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: rz };
}

function drawHex(q, r, size = HEX_SIZE, fillStyle = null, strokeStyle = "#000", rotation = 0, highlightEdges = []) {
  const { x, y } = hexToPixel(q, r);
  ctx.save();
  ctx.translate(canvas.width / 2 + x, canvas.height / 2 + y);

  if (fillStyle) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      const xi = size * Math.cos(angle);
      const yi = size * Math.sin(angle);
      if (i === 0) ctx.moveTo(xi, yi);
      else ctx.lineTo(xi, yi);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  for (let i = 0; i < 6; i++) {
    const angle1 = Math.PI / 180 * (60 * i - 30);
    const angle2 = Math.PI / 180 * (60 * (i + 1) - 30);
    const x1 = size * Math.cos(angle1);
    const y1 = size * Math.sin(angle1);
    const x2 = size * Math.cos(angle2);
    const y2 = size * Math.sin(angle2);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = highlightEdges.includes(i) ? "green" : strokeStyle;
    ctx.lineWidth = highlightEdges.includes(i) ? 3 : 1;
    ctx.stroke();
  }

  ctx.restore();
}

function inHexRadius(q, r, radius) {
  const x = q, z = r, y = -x - z;
  return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= radius;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const radius = 6;
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (inHexRadius(q, r, radius)) drawHex(q, r, HEX_SIZE, null, "#999");
    }
  }

  for (const piece of pieces) {
    if (piece.type === "player") piece.color = "red";
    const baseEdges = [0, 1, 2];
    const steps = Math.floor((piece.rotation % 360) / 60);
    const highlightEdges = baseEdges.map(e => (e + steps) % 6);
    drawHex(piece.x, piece.y, HEX_SIZE * 0.6, piece.color, "#333", piece.rotation, highlightEdges);

    const { x, y } = hexToPixel(piece.x, piece.y);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelMap[piece.type] || "?", canvas.width / 2 + x, canvas.height / 2 + y);
    ctx.fillText(piece.health.toString(), canvas.width / 2 + x, canvas.height / 2 + y + 18);
  }
}

let dragging = null;
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2;
  const my = e.clientY - rect.top - canvas.height / 2;
  const hex = pixelToHex(mx, my);
  const clickedPieceIndex = pieces.findIndex(p => p.x === hex.x && p.y === hex.y);

  if (deleteMode) {
    if (clickedPieceIndex !== -1) {
      pieces.splice(clickedPieceIndex, 1);
      socket.emit("move", pieces);
      drawBoard();
    }
  } else {
    if (clickedPieceIndex !== -1) {
      dragging = pieces[clickedPieceIndex];
    } else {
      const selectedType = pieceTypeSelect.value;
      pieces.push({
        x: hex.x,
        y: hex.y,
        color: selectedType === "player" ? "red" : "blue",
        type: selectedType,
        rotation: 0,
        health: defaultHealth[selectedType] || 10
      });
      socket.emit("move", pieces);
      drawBoard();
    }
  }
});

canvas.addEventListener("mouseup", e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2;
  const my = e.clientY - rect.top - canvas.height / 2;
  const { x, y } = pixelToHex(mx, my);
  dragging.x = x;
  dragging.y = y;
  socket.emit("move", pieces);
  dragging = null;
  drawBoard();
});

canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2;
  const my = e.clientY - rect.top - canvas.height / 2;

  for (const piece of pieces) {
    const { x, y } = hexToPixel(piece.x, piece.y);
    if (Math.hypot(mx - x, my - y) < HEX_SIZE * 0.6) {
      piece.rotation = (piece.rotation + 60) % 360;
      socket.emit("move", pieces);
      drawBoard();
      break;
    }
  }
});

canvas.addEventListener("dblclick", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2;
  const my = e.clientY - rect.top - canvas.height / 2;
  const hex = pixelToHex(mx, my);
  const clicked = pieces.find(p => p.x === hex.x && p.y === hex.y);
  if (!clicked) return;
  const adjustment = e.shiftKey ? -1 : 1;
  clicked.health = Math.max(0, clicked.health + adjustment);
  socket.emit("move", pieces);
  drawBoard();
});

rollBtn.addEventListener("click", () => {
  const result = Math.floor(Math.random() * 6) + 1;
  diceResult.textContent = `Result: ${result}`;
  socket.emit("roll", result);
});

socket.on("move", newPieces => {
  for (let i = 0; i < newPieces.length; i++) {
    pieces[i].x = newPieces[i].x;
    pieces[i].y = newPieces[i].y;
    pieces[i].rotation = newPieces[i].rotation;
    pieces[i].health = newPieces[i].health;
  }
  drawBoard();
});

socket.on("roll", result => {
  diceResult.textContent = `Result: ${result}`;
});

drawBoard();