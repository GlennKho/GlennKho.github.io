(() => {
  const themeToggle = document.getElementById('dark-mode');
  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeToggle.checked = dark;
  }
  try { setTheme(localStorage.getItem('theme') === 'dark'); }
  catch { setTheme(false); }
  themeToggle.addEventListener('change', () => {
    setTheme(themeToggle.checked);
    try { localStorage.setItem('theme', themeToggle.checked ? 'dark' : 'light'); }
    catch { /* Storage can be unavailable in private or restricted browsing. */ }
  });

  const switcher = document.getElementById('site-switcher');
  document.addEventListener('click', (event) => {
    if (!switcher.contains(event.target)) switcher.open = false;
  });
  switcher.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && switcher.open) {
      switcher.open = false;
      switcher.querySelector('summary').focus();
    }
  });
  switcher.querySelector('.site-links').addEventListener('click', (event) => {
    if (event.target.closest('a')) switcher.open = false;
  });

  const canvas = document.getElementById('pixels');
  const context = canvas.getContext('2d');
  if (!context) return;

  const board = document.getElementById('pixel-board');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: -1000, y: -1000 };
  const glyph = ['1111100', '1000000', '1000000', '1011100', '1000100', '1000101', '1111101'];
  let points = [];
  let width = 0;
  let height = 0;
  let frame = 0;
  let scattered = false;
  let speedMultiplier = 1;
  let returning = false;
  let lastTime = null;

  function paint() {
    context.clearRect(0, 0, width, height);
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = point.color;
      context.fill();
    }
  }

  function animate(time) {
    frame = 0;
    const seconds = lastTime === null ? 1 / 60 : Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    speedMultiplier = 1 + (speedMultiplier - 1) * Math.exp(-seconds * 0.7);
    let moving = false;
    for (const point of points) {
      if (scattered) {
        point.x += point.vx * seconds * speedMultiplier;
        point.y += point.vy * seconds * speedMultiplier;
        continue;
      }
      const dx = point.homeX - pointer.x;
      const dy = point.homeY - pointer.y;
      const distance = Math.hypot(dx, dy);
      const force = Math.max(0, 1 - distance / 105) * 42;
      const targetX = point.homeX + (dx / (distance || 1)) * force;
      const targetY = point.homeY + (dy / (distance || 1)) * force;
      point.x += (targetX - point.x) * 0.12;
      point.y += (targetY - point.y) * 0.12;
      if (Math.abs(targetX - point.x) + Math.abs(targetY - point.y) <= 0.1) {
        point.x = targetX;
        point.y = targetY;
      } else moving = true;
    }
    if (scattered) {
      // shortcut: resolve overlaps per frame; use swept collisions if extreme boosts cause tunneling.
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const radii = a.radius + b.radius;
          if (dx * dx + dy * dy >= radii * radii) continue;
          const distance = Math.hypot(dx, dy);
          const nx = distance ? dx / distance : 1;
          const ny = distance ? dy / distance : 0;
          const overlap = (radii - distance) / 2;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (approach > 0) {
            a.vx -= approach * nx;
            a.vy -= approach * ny;
            b.vx += approach * nx;
            b.vy += approach * ny;
          }
        }
      }
      for (const point of points) {
        const right = width - point.radius;
        const bottom = height - point.radius;
        if (point.x < point.radius && point.vx < 0 || point.x > right && point.vx > 0) point.vx *= -1;
        if (point.y < point.radius && point.vy < 0 || point.y > bottom && point.vy > 0) point.vy *= -1;
        point.x = Math.max(point.radius, Math.min(right, point.x));
        point.y = Math.max(point.radius, Math.min(bottom, point.y));
      }
    }
    paint();
    if (scattered || moving) frame = requestAnimationFrame(animate);
    else returning = false;
  }

  function start() {
    if (!frame) {
      lastTime = null;
      frame = requestAnimationFrame(animate);
    }
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    scattered = false;
    speedMultiplier = 1;
    pointer.x = pointer.y = -1000;
    returning = !motion.matches && points.some(point => point.x !== point.homeX || point.y !== point.homeY);
    if (returning) {
      start();
      return;
    }
    for (const point of points) {
      point.x = point.homeX;
      point.y = point.homeY;
    }
    paint();
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const spacing = Math.min(width / 24, height / 23);
    points = [];
    for (let row = 0; row < 21; row++) {
      for (let col = 0; col < 23; col++) {
        const glyphRow = Math.floor((row - 3) / 2);
        const glyphCol = Math.floor((col - 5) / 2);
        const active = glyph[glyphRow]?.[glyphCol] === '1';
        const homeX = width / 2 + (col - 11) * spacing;
        const homeY = height / 2 + (row - 10.5) * spacing;
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 35;
        points.push({
          homeX,
          homeY,
          x: homeX,
          y: homeY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: spacing * (active ? 0.34 : 0.065),
          color: active ? (glyphCol === 6 ? '#b8c5fa' : '#cff6e2') : '#8296fa',
        });
      }
    }
    if (scattered) {
      paint();
      if (!motion.matches) start();
    }
    else reset();
  }

  function scatter() {
    if (scattered) speedMultiplier += 1.5;
    scattered = true;
    returning = false;
    pointer.x = pointer.y = -1000;
    for (const point of points) {
      if (motion.matches) {
        point.x = point.radius + Math.random() * (width - point.radius * 2);
        point.y = point.radius + Math.random() * (height - point.radius * 2);
      }
    }
    paint();
    if (!motion.matches) start();
  }

  canvas.addEventListener('pointermove', (event) => {
    if (scattered || returning || motion.matches || event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    // The board is rotated; map the pointer back to the canvas axes.
    const radians = -(window.innerWidth <= 720 ? 1.5 : 2) * Math.PI / 180;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    pointer.x = width / 2 + dx * Math.cos(radians) - dy * Math.sin(radians);
    pointer.y = height / 2 + dx * Math.sin(radians) + dy * Math.cos(radians);
    start();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -1000;
    if (!motion.matches) start();
  });
  canvas.addEventListener('click', scatter);
  document.getElementById('scatter').addEventListener('click', scatter);
  document.getElementById('reset').addEventListener('click', reset);
  motion.addEventListener('change', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (scattered) {
      if (!motion.matches) start();
    } else reset();
  });
  window.addEventListener('resize', resize);
  resize();
  board.classList.add('canvas-ready');
  document.getElementById('play-controls').hidden = false;
  document.getElementById('play-hint').textContent = 'Tap to scatter. Keep tapping to speed up.';
})();
