(() => {
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

  function paint() {
    context.clearRect(0, 0, width, height);
    for (const point of points) {
      context.beginPath();
      context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      context.fillStyle = point.color;
      context.fill();
    }
  }

  function animate() {
    frame = 0;
    let moving = false;
    for (const point of points) {
      const dx = point.homeX - pointer.x;
      const dy = point.homeY - pointer.y;
      const distance = Math.hypot(dx, dy);
      const force = Math.max(0, 1 - distance / 105) * 42;
      const targetX = point.homeX + (dx / (distance || 1)) * force;
      const targetY = point.homeY + (dy / (distance || 1)) * force;
      point.x += (targetX - point.x) * 0.12;
      point.y += (targetY - point.y) * 0.12;
      moving ||= Math.abs(targetX - point.x) + Math.abs(targetY - point.y) > 0.1;
    }
    paint();
    if (moving) frame = requestAnimationFrame(animate);
  }

  function start() {
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer.x = pointer.y = -1000;
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
        points.push({
          homeX: width / 2 + (col - 11) * spacing,
          homeY: height / 2 + (row - 10.5) * spacing,
          radius: spacing * (active ? 0.34 : 0.065),
          color: active ? (glyphCol === 6 ? '#b8c5fa' : '#cff6e2') : '#8296fa',
        });
      }
    }
    reset();
  }

  function scatter() {
    pointer.x = pointer.y = -1000;
    for (const point of points) {
      point.x = width * 0.08 + Math.random() * width * 0.84;
      point.y = height * 0.08 + Math.random() * height * 0.76;
    }
    if (motion.matches) paint();
    else start();
  }

  canvas.addEventListener('pointermove', (event) => {
    if (motion.matches || event.pointerType === 'touch') return;
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
  motion.addEventListener('change', reset);
  window.addEventListener('resize', resize);
  resize();
  board.classList.add('canvas-ready');
  document.getElementById('play-controls').hidden = false;
  document.getElementById('play-hint').textContent = 'Move the cursor. Tap to scatter.';
})();
