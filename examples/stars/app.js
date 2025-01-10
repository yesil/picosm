import { makeObservable, observe, track } from '../../dist/picosm.js';

let starIdCounter = 1;

function getRandomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

class Connection {
  constructor(fromStar, toStar) {
    this.from = fromStar;
    this.to = toStar;
    this.hovered = false;
  }

  // Check if point (px, py) is near the line segment from->to
  containsPoint(px, py) {
    const x1 = this.from.x;
    const y1 = this.from.y;
    const x2 = this.to.x;
    const y2 = this.to.y;

    const dist = pointLineDistance(px, py, x1, y1, x2, y2);
    return dist < 10; // within 10px threshold
  }

  draw(ctx) {
    const x1 = this.from.x;
    const y1 = this.from.y;
    const x2 = this.to.x;
    const y2 = this.to.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const offset = this.to.radius + 2;
    const nx2 = x2 - (dx / dist) * offset;
    const ny2 = y2 - (dy / dist) * offset;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = this.hovered ? '#ff0000' : '#ffa000';
    ctx.lineWidth = 3;
    ctx.moveTo(x1, y1);
    ctx.lineTo(nx2, ny2);
    ctx.stroke();

    const headLength = 15;
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
    ctx.fillStyle = this.hovered ? '#ff0000' : '#ffa000';
    ctx.fill();
    ctx.restore();
  }
}

// Utility function for line distance
function pointLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) param = dot / len_sq;

  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

class Star {
  static observableActions = ['connect', 'disconnect'];

  constructor(x, y, radius, color, velocity = { x: 0, y: 0 }) {
    this.id = starIdCounter++;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.velocity = velocity;
    this.disposers = new Map();
    this.dragging = false;
    this.hover = false;
    this.connections = []; // store Connection objects
  }

  canConnect(star) {
    return (
      this !== star && this.connections.every((c) => c.to.canConnect(star))
    );
  }

  connect(star) {
    if (!star.canConnect(this)) return;
    const connection = new Connection(this, star);
    this.connections.push(connection);
  }

  disconnect(star) {
    this.connections = this.connections.filter((c) => c.to !== star);
  }

  get count() {
    const visited = new Set();
    const visitConnections = (star) => {
      visited.add(star);
      for (let c of star.connections) {
        visitConnections(c.to);
      }
    };
    visitConnections(this);
    return visited.size - 1;
  }

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
      let sx = Math.cos(angle) * outerRadius;
      let sy = Math.sin(angle) * outerRadius;
      ctx.lineTo(sx, sy);
      angle += step;

      sx = Math.cos(angle) * innerRadius;
      sy = Math.sin(angle) * innerRadius;
      ctx.lineTo(sx, sy);
      angle += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.hover ? '#ffee58' : '#ffffff';
    ctx.fillStyle = this.hover ? '#ffca28' : this.color;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.count.toString(), 0, 0);

    ctx.restore();
  }

  containsPoint(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy <= this.radius * this.radius;
  }

  update() {
    this.x += this.velocity.x;
    this.y += this.velocity.y;
  }
}

makeObservable(Star);

// Ranking class to manage stars and their ranking display
class Ranking {
  static computedProperties = ['sortedStars'];

  constructor(rankingDiv) {
    this.rankingDiv = rankingDiv;
    this.stars = [];
  }

  addStar(star) {
    this.stars.push(star);
    // Observe changes in the star's properties to update the ranking
    track(this, star);
  }

  get sortedStars() {
    return [...this.stars].sort((a, b) => b.count - a.count);
  }

  update() {
    console.log('Updating ranking');
    let html =
      '<h4>Star Ranking</h4><ul style="list-style:none; padding:0; margin:0;">';
    for (let star of this.sortedStars) {
      html += `<li><span style="color:${star.color};">&#9733;</span> Star #${star.id}: ${star.count} connection(s)</li>`;
    }
    html += '</ul>';
    this.rankingDiv.innerHTML = html;
  }
}
makeObservable(Ranking);

const container = document.getElementById('canvasContainer');
const starCanvas = document.getElementById('starCanvas');
const connectionCanvas = document.getElementById('connectionCanvas');
const addButton = document.getElementById('addButton');
const rankingDiv = document.getElementById('ranking');

function resizeCanvases() {
  starCanvas.width = container.clientWidth;
  starCanvas.height = container.clientHeight;
  connectionCanvas.width = container.clientWidth;
  connectionCanvas.height = container.clientHeight;
}

resizeCanvases();
window.addEventListener('resize', resizeCanvases);

const starCtx = starCanvas.getContext('2d');
const connectionCtx = connectionCanvas.getContext('2d');

// Create a Ranking instance
const ranking = new Ranking(rankingDiv);
observe(ranking, () => ranking.update(), 100);

// Interaction state
let hoverStar = null;
let dragStar = null;
let connectingStar = null;
let isConnecting = false;
let connectionStartX, connectionStartY;
let hoverConnection = null;

addButton.addEventListener('click', () => {
  const x = Math.random() * starCanvas.width * 0.8 + starCanvas.width * 0.1;
  const y = Math.random() * starCanvas.height * 0.8 + starCanvas.height * 0.1;
  const color = getRandomColor();
  const newStar = new Star(x, y, 40, color, { x: 0, y: 0 });
  // Add the star to the ranking (which sets up observation)
  ranking.addStar(newStar);
});

starCanvas.addEventListener('mousemove', (e) => {
  const rect = starCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  hoverStar = null;
  hoverConnection = null;

  // Check star hover
  for (let s of ranking.stars) {
    s.hover = false;
    if (s.containsPoint(mx, my)) {
      hoverStar = s;
      s.hover = true;
      break;
    }
  }

  // If metaKey pressed and not hovering star, check for connection hover
  if (e.metaKey && !hoverStar) {
    outerLoop: for (let s of ranking.stars) {
      for (let c of s.connections) {
        c.hovered = false;
        if (c.containsPoint(mx, my)) {
          hoverConnection = c;
          c.hovered = true;
          break outerLoop;
        }
      }
    }
  }

  // Dragging star
  if (dragStar && dragStar.dragging) {
    dragStar.x = mx - dragStar.offsetX;
    dragStar.y = my - dragStar.offsetY;
  }

  // Update connection line end if connecting
  if (isConnecting && connectingStar) {
    connectionStartX = mx;
    connectionStartY = my;
  }
});

starCanvas.addEventListener('mousedown', (e) => {
  const rect = starCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (hoverStar) {
    if (e.metaKey) {
      isConnecting = true;
      connectingStar = hoverStar;
      connectionStartX = mx;
      connectionStartY = my;
    } else {
      dragStar = hoverStar;
      dragStar.dragging = true;
      dragStar.offsetX = mx - dragStar.x;
      dragStar.offsetY = my - dragStar.y;
    }
  }
});

starCanvas.addEventListener('mouseup', (e) => {
  if (dragStar) {
    dragStar.dragging = false;
    dragStar = null;
  }

  if (isConnecting && connectingStar) {
    if (hoverStar && hoverStar !== connectingStar) {
      connectingStar.connect(hoverStar);
    }
    isConnecting = false;
    connectingStar = null;
  } else if (hoverConnection && e.metaKey) {
    hoverConnection.from.disconnect(hoverConnection.to);
    hoverConnection = null;
  }
});

// Animation loop
function animate() {
  connectionCtx.clearRect(
    0,
    0,
    connectionCanvas.width,
    connectionCanvas.height,
  );
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);

  // Draw connections
  for (let s of ranking.stars) {
    for (let c of s.connections) {
      c.draw(connectionCtx);
    }
  }

  // If currently connecting, draw temporary line
  if (isConnecting && connectingStar) {
    connectionCtx.save();
    connectionCtx.beginPath();
    connectionCtx.moveTo(connectingStar.x, connectingStar.y);
    connectionCtx.lineTo(connectionStartX, connectionStartY);
    connectionCtx.strokeStyle = '#ffeb3b';
    connectionCtx.lineWidth = 2;
    connectionCtx.stroke();

    let angle = Math.atan2(
      connectionStartY - connectingStar.y,
      connectionStartX - connectingStar.x,
    );
    connectionCtx.beginPath();
    connectionCtx.moveTo(connectionStartX, connectionStartY);
    connectionCtx.lineTo(
      connectionStartX - 10 * Math.cos(angle - Math.PI / 6),
      connectionStartY - 10 * Math.sin(angle - Math.PI / 6),
    );
    connectionCtx.lineTo(
      connectionStartX - 10 * Math.cos(angle + Math.PI / 6),
      connectionStartY - 10 * Math.sin(angle + Math.PI / 6),
    );
    connectionCtx.lineTo(connectionStartX, connectionStartY);
    connectionCtx.stroke();
    connectionCtx.fillStyle = '#ffeb3b';
    connectionCtx.fill();
    connectionCtx.restore();
  }

  // Draw stars
  for (let s of ranking.stars) {
    s.update();
    s.draw(starCtx);
  }

  requestAnimationFrame(animate);
}
animate();
