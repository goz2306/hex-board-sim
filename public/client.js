const socket = io();
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const rollBtn = document.getElementById("rollBtn");
const diceResult = document.getElementById("diceResult");

// Board config
const HEX_SIZE = 30;

// Piece label map for display
const labelMap = {
  skeleton: "S",
  ghoul: "G",
  wraith: "W",
  construct: "C",
};

// Initial pieces with rotation (degrees)
const pieces = [
  { x: 0, y: 0, color: "blue", type: "skeleton", rotation: 0 },
  { x: 2, y: 2, color: "blue", type: "skeleton", rotation: 0 },
  { x: -2, y: 1, color: "blue", type: "skeleton", rotation: 0 },
];

// HEX math for flat-top hexes
function hexToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r/2);
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
  ctx.translate(canvas.width/2 + x, canvas.height/2 + y);
  ctx.rotate(rotation * Math.PI / 180);

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i);
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
    ctx.beginPath();
    const angle1 = Math.PI / 180 * (60 * i);
    const angle2 = Math.PI / 180 * (60 * (i + 1));
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

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw hex grid as a big hex (radius 6)
  const radius = 6;
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      drawHex(q, r, HEX_SIZE, null, "#999");
    }
  }

  // Draw pieces
  for (const piece of pieces) {
    // Highlight edges 0,1,2 but rotated by piece.rotation
    const highlightEdges = [];
    for (let i = 0; i < 3; i++) {
      highlightEdges.push((i - piece.rotation / 60 + 6) % 6);
    }
    drawHex(piece.x, piece.y, HEX_SIZE * 0.6, piece.color, "#333", piece.rotation, highlightEdges);

    // Draw label (type letter)
    const { x, y } = hexToPixel(piece.x, piece.y);
    ctx.fillStyle = "#fff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(labelMap[piece.type] || "?", canvas.width/2 + x, canvas.height/2 + y);
  }
}

// Drag and drop handling
let dragging = null;
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width/2;
  const my = e.clientY - rect.top - canvas.height/2;

  for (const piece of pieces) {
    const { x, y } = hexToPixel(piece.x, piece.y);
    if (Math.hypot(mx - x, my - y) < HEX_SIZE * 0.6) {
      dragging = piece;
      break;
    }
  }
});

canvas.addEventListener("mouseup", e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left - canvas.width/2;
  const my = e.clientY - rect.top - canvas.height/2;
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
  const mx = e.clientX - rect.left - canvas.width/2;
  const my = e.clientY - rect.top - canvas.height/2;

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