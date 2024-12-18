import { makeObservable, observe, track } from '../dist/picosm.js';

// The Star class from the user's model, adapted slightly
class Star {
  stars = [];
  constructor() {
    this.disposers = new Map();
  }

  connect(star) {
    this.stars.push(star);
    const disposer = track(this, star);
    this.disposers.set(star, disposer);
  }

  disconnect(star) {
    this.stars = this.stars.filter((s) => s !== star);
    const disposer = this.disposers.get(star);
    if (disposer) disposer();
    this.disposers.delete(star);
  }

  get count() {
    console.log('count() called');
    return (
      this.stars.length + this.stars.reduce((acc, star) => acc + star.count, 0)
    );
  }
}

const StarObservable = makeObservable(
  Star,
  ['connect', 'disconnect'],
  ['count'],
);

// We will store stars visually as objects holding position, and an instance of Star
class VisualStar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 40;
    this.dragging = false;
    this.hover = false;
    this.starModel = new StarObservable();
    // Initialize displayCount
  }

  // Draw a 5-point star shape
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.beginPath();
    const spikes = 5;
    const outerRadius = this.radius;
    const innerRadius = this.radius / 2;
    let angle = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = Math.cos(angle) * outerRadius;
      let y = Math.sin(angle) * outerRadius;
      ctx.lineTo(x, y);
      angle += step;

      x = Math.cos(angle) * innerRadius;
      y = Math.sin(angle) * innerRadius;
      ctx.lineTo(x, y);
      angle += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.hover ? '#ffee58' : '#ffffff';
    ctx.fillStyle = this.hover ? '#ffca28' : '#fbc02d';
    ctx.fill();
    ctx.stroke();

    // Display the count in the middle
    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.starModel.count.toString(), 0, 0);

    ctx.restore();
  }

  containsPoint(px, py) {
    // Rough check using radius
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }
}

class Connection {
  constructor(fromStar, toStar) {
    this.from = fromStar;
    this.to = toStar;
  }

  draw(ctx) {
    const x1 = this.from.x;
    const y1 = this.from.y;
    const x2 = this.to.x;
    const y2 = this.to.y;

    // Calculate direction vector and distance
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Offset so the arrow head doesn't appear right at the target star center
    const offset = this.to.radius + 2;
    const nx2 = x2 - (dx / dist) * offset;
    const ny2 = y2 - (dy / dist) * offset;

    // Draw the main line
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#ffa000';
    ctx.lineWidth = 3;
    ctx.moveTo(x1, y1);
    ctx.lineTo(nx2, ny2);
    ctx.stroke();

    // Draw arrow head a bit away from the target star
    const headLength = 15; // length of the arrowhead
    const angle = Math.atan2(ny2 - y1, nx2 - x1);

    ctx.beginPath();
    ctx.moveTo(nx2, ny2);
    ctx.lineTo(
      nx2 - headLength * Math.cos(angle - Math.PI / 6),
      ny2 - headLength * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      nx2 - headLength * Math.cos(angle + Math.PI / 6),
      ny2 - headLength * Math.sin(angle + Math.PI / 6),
    );
    ctx.lineTo(nx2, ny2);
    ctx.fillStyle = '#ffa000';
    ctx.fill();
    ctx.restore();
  }
}

// Canvas and UI setup
const canvas = document.getElementById('myCanvas');
const container = document.getElementById('canvasContainer');
const addButton = document.getElementById('addButton');

canvas.width = container.clientWidth;
canvas.height = container.clientHeight;

window.addEventListener('resize', () => {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
});

const ctx = canvas.getContext('2d');

// Stars and connections
let stars = [];
let connections = [];

// Interaction state
let hoverStar = null;
let dragStar = null;
let connectingStar = null;
let isConnecting = false;
let connectionStartX, connectionStartY;

// Add button logic
addButton.addEventListener('click', () => {
  const x = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
  const y = Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
  stars.push(new VisualStar(x, y));
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Hover detection
  hoverStar = null;
  for (let s of stars) {
    s.hover = false;
    if (s.containsPoint(mx, my)) {
      hoverStar = s;
      s.hover = true;
      break;
    }
  }

  // Dragging star
  if (dragStar && dragStar.dragging) {
    dragStar.x = mx - dragStar.offsetX;
    dragStar.y = my - dragStar.offsetY;
  }

  // Update connection line end if we are connecting
  if (isConnecting && connectingStar) {
    connectionStartX = mx;
    connectionStartY = my;
  }
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // If click on a star
  if (hoverStar) {
    if (e.metaKey) {
      // Start connecting mode if META key is held down
      isConnecting = true;
      connectingStar = hoverStar;
      connectionStartX = mx;
      connectionStartY = my;
    } else {
      // Start dragging star
      dragStar = hoverStar;
      dragStar.dragging = true;
      dragStar.offsetX = mx - dragStar.x;
      dragStar.offsetY = my - dragStar.y;
    }
  }
});

canvas.addEventListener('mouseup', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (dragStar) {
    dragStar.dragging = false;
    dragStar = null;
  }

  if (isConnecting && connectingStar) {
    // If we released on another star, we connect
    if (hoverStar && hoverStar !== connectingStar) {
      connectingStar.starModel.connect(hoverStar.starModel);
      connections.push(new Connection(connectingStar, hoverStar));
    }
    isConnecting = false;
    connectingStar = null;
  }
});

// Animation loop
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw connections first
  for (let c of connections) {
    c.draw(ctx);
  }

  // If currently connecting, draw a temporary line
  if (isConnecting && connectingStar) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(connectingStar.x, connectingStar.y);
    ctx.lineTo(connectionStartX, connectionStartY);
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead at mouse position
    let angle = Math.atan2(
      connectionStartY - connectingStar.y,
      connectionStartX - connectingStar.x,
    );
    ctx.beginPath();
    ctx.moveTo(connectionStartX, connectionStartY);
    ctx.lineTo(
      connectionStartX - 10 * Math.cos(angle - Math.PI / 6),
      connectionStartY - 10 * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      connectionStartX - 10 * Math.cos(angle + Math.PI / 6),
      connectionStartY - 10 * Math.sin(angle + Math.PI / 6),
    );
    ctx.lineTo(connectionStartX, connectionStartY);
    ctx.stroke();
    ctx.fillStyle = '#ffeb3b';
    ctx.fill();
    ctx.restore();
  }

  // Draw stars
  for (let s of stars) {
    s.draw(ctx);
  }

  requestAnimationFrame(animate);
}
animate();
