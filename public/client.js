const socket = io();
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const rollBtn = document.getElementById("rollBtn");
const diceResult = document.getElementById("diceResult");

// Board config
const HEX_SIZE = 30;
const board = [];
const pieces = [
  { x: 0, y: 0, color: "red" },
  { x: 1, y: 0, color: "red" },
  { x: -1, y: 1, color: "red" },

  { x: 2, y: 2, color: "blue" },
  { x: 3, y: 2, color: "blue" },
  { x: 2, y: 3, color: "blue" },
  { x: 3, y: 3, color: "blue" },
  { x: 4, y: 2, color: "blue" },
];

// Hex math
function hexToPixel(q, r) {
  const x = HEX_SIZE * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
  const y = HEX_SIZE * (3/2 * r);
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

// Draw functions
function drawHex(q, r) {
  const { x, y } = hexToPixel(q, r);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i + 30);
    const xi = x + HEX_SIZE * Math.cos(angle);
    const yi = y + HEX_SIZE * Math.sin(angle);
    ctx.lineTo(xi, yi);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  const radius = 6; // Number of hexes from center to edge (big hex size)
  const HEX_SIZE = 30;

  // Helper: convert hex axial coords (q,r) to pixel (flat-top)
  function hexToPixel(q, r) {
    const x = HEX_SIZE * (3/2 * q);
    const y = HEX_SIZE * (Math.sqrt(3) * (r + q/2));
    return { x, y };
  }

  // Helper: draw flat-top hex at axial q,r
  function drawHex(q, r) {
    const { x, y } = hexToPixel(q, r);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i);
      const xi = x + HEX_SIZE * Math.cos(angle);
      const yi = y + HEX_SIZE * Math.sin(angle);
      if (i === 0) ctx.moveTo(xi, yi);
      else ctx.lineTo(xi, yi);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Draw hex grid shaped like a big hex
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) {
        drawHex(q, r);
      }
    }
  }

// Draw pieces on board
for (let i = 0; i < pieces.length; i++) {
  const piece = pieces[i];
  const { x, y } = hexToPixel(piece.x, piece.y);

  ctx.beginPath();
  ctx.arc(x, y, 15, 0, 2 * Math.PI);
  ctx.fillStyle = piece.color;
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const label = piece.color === "red" ? "P1" : piece.color === "blue" ? "P2" : `P${i + 1}`;
  ctx.fillText(label, x, y);
}

// Mouse handling
let dragging = null;
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (const piece of pieces) {
    const { x, y } = hexToPixel(piece.x, piece.y);
    if (Math.hypot(mx - x, my - y) < 10) {
      dragging = piece;
      break;
    }
  }
});

canvas.addEventListener("mouseup", e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const { x, y } = pixelToHex(mx, my);
  dragging.x = x;
  dragging.y = y;
  socket.emit("move", pieces);
  dragging = null;
  drawBoard();
});

rollBtn.addEventListener("click", () => {
  const result = Math.floor(Math.random() * 6) + 1;
  diceResult.textContent = `Result: ${result}`;
  socket.emit("roll", result);
});

// Sync updates from server
socket.on("move", newPieces => {
  for (let i = 0; i < newPieces.length; i++) {
    pieces[i].x = newPieces[i].x;
    pieces[i].y = newPieces[i].y;
  }
  drawBoard();
});

socket.on("roll", result => {
  diceResult.textContent = `Result: ${result}`;
});

drawBoard();
