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
const HEX_SIZE = 30;  // radius of hex

// Piece label map for display
const labelMap = {
  skeleton: "S",
  ghoul: "G",
  wraith: "W",
  construct: "C",
  player: "P",
};

// Initial pieces with rotation (degrees)
const pieces = [
  { x: 0, y: 0, color: "blue", type: "skeleton", rotation: 0 },
  { x: 2, y: 2, color: "blue", type: "skeleton", rotation: 0 },
  { x: -2, y: 1, color: "blue", type: "skeleton", rotation: 0 },
  { x: 0, y: -3, color: "red", type: "player", rotation: 0 },
  { x: 2, y: -3, color: "red", type: "player", rotation: 0 },
  { x: -2, y: -3, color: "red", type: "player", rotation: 0 },

];

// HEX math for flat-top hexes
function hexToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const y = HEX_SIZE * 3/2 * r;
  return { x, y };
}

function pixelToHex(x, y) {
  const q = (Math.sqrt(3)/3 * x - 1/3 * y) / HEX_SIZE;
  const r = (2/3 * y) / HEX_SIZE;
  return hexRound(q, r);
}
function hexRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
  else if (y_diff > z_diff) ry = -rx - rz;
  else rz = -rx - ry;

  return { x: rx, y: rz };
}

// Draw a hex at q,r with optional rotation, size, fill, stroke, and highlighted edges
function drawHex(q, r, size = HEX_SIZE, fillStyle = null, strokeStyle = "#000", rotation = 0, highlightEdges = []) {
  const { x, y } = hexToPixel(q, r);
  ctx.save();
  ctx.translate(canvas.width / 2 + x, canvas.height / 2 + y);

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
for (let i = 0; i < 6; i++) {
  const angle = Math.PI / 180 * (60 * i - 30);
  const xi = size * Math.cos(angle);
  const yi = size * Math.sin(angle);
  if (i === 0) ctx.moveTo(xi, yi);
  else ctx.lineTo(xi, yi);
}
    ctx.closePath();
    ctx.fill();
  }

  // Draw edges, highlight selected edges in green
for (let i = 0; i < 6; i++) {
  const angle1 = Math.PI / 180 * (60 * i - 30);
  const angle2 = Math.PI / 180 * (60 * (i + 1) - 30);
  const x1 = size * Math.cos(angle1);
  const y1 = size * Math.sin(angle1);
  const x2 = size * Math.cos(angle2);
  const y2 = size * Math.sin(angle2);

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = highlightEdges.includes(i) ? "green" : strokeStyle;
  ctx.lineWidth = highlightEdges.includes(i) ? 3 : 1;
  ctx.stroke();
}

  ctx.restore();
}

function inHexRadius(q, r, radius) {
  // cube coordinates: x = q, y = -q - r, z = r
  const x = q;
  const z = r;
  const y = -x - z;
  return Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= radius;
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
 
  const radius = 5;
  // Loop over a bounding box larger than radius
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (inHexRadius(q, r, radius)) {
        drawHex(q, r, HEX_SIZE, null, "#999");
      }
    }
  }

  // Draw pieces as before...
for (const piece of pieces) {
  if (piece.type === "player") {
    piece.color = "red";
  }

  const baseEdges = [0, 1, 2];
const rotationSteps = Math.round((piece.rotation % 360) / 60); // force integer 0–5
const highlightEdges = baseEdges.map(e => (e + rotationSteps) % 6);

  drawHex(piece.x, piece.y, HEX_SIZE * 0.6, piece.color, "#333", piece.rotation, highlightEdges);

  const { x, y } = hexToPixel(piece.x, piece.y);
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(labelMap[piece.type] || "?", canvas.width / 2 + x, canvas.height / 2 + y);
}
}
// Drag and drop handling
let dragging = null;
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width / 2;
  const my = e.clientY - rect.top - canvas.height / 2;
  const hex = pixelToHex(mx, my);

  // Check if clicked on existing piece
  const clickedPieceIndex = pieces.findIndex(p => p.x === hex.x && p.y === hex.y);

  if (deleteMode) {
    // If in delete mode and clicked on a piece, remove it
    if (clickedPieceIndex !== -1) {
      pieces.splice(clickedPieceIndex, 1);
      socket.emit("move", pieces);
      drawBoard();
    }
  } else {
    if (clickedPieceIndex !== -1) {
      // Start dragging the existing piece
      dragging = pieces[clickedPieceIndex];
    } else {
      // Add new piece of selected type
     const selectedType = pieceTypeSelect.value;
pieces.push({
  x: hex.x,
  y: hex.y,
  color: selectedType === "player" ? "red" : "blue", // Ensure player is red
  type: selectedType,
  rotation: 0
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

// Rotate piece on right-click (contextmenu)
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

// Dice roller
rollBtn.addEventListener("click", () => {
  const result = Math.floor(Math.random() * 6) + 1;
  diceResult.textContent = `Result: ${result}`;
  socket.emit("roll", result);
});

// Socket sync
socket.on("move", newPieces => {
  for (let i = 0; i < newPieces.length; i++) {
    pieces[i].x = newPieces[i].x;
    pieces[i].y = newPieces[i].y;
    pieces[i].rotation = newPieces[i].rotation;
  }
  drawBoard();
});

socket.on("roll", result => {
  diceResult.textContent = `Result: ${result}`;
});

drawBoard();