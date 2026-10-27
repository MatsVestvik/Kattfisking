/**
 * Spillhjørnet – Dynamic Multilayered Parallax Engine
 * Drives smooth 3D parallax depth, ambient idle breathing, and drifting autumn leaves
 */

(() => {
  "use strict";

  // Check if reduced motion is requested
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isSeabed = Boolean(document.querySelector(".dynamic-parallax-bg.theme-seabed"));

  const layers = [
    { el: document.getElementById("plSky") || document.getElementById("plSeabed1"), depthX: 12, depthY: 8, scrollRatio: 0.03 },
    { el: document.getElementById("plFjord") || document.getElementById("plSeabed2"), depthX: 28, depthY: 16, scrollRatio: 0.08 },
    { el: document.getElementById("plCampus") || document.getElementById("plSeabed3"), depthX: 52, depthY: 28, scrollRatio: 0.16 },
    { el: document.getElementById("plLawn") || document.getElementById("plSeabed4"), depthX: 84, depthY: 42, scrollRatio: 0.28 },
  ].filter(l => l.el !== null);

  if (layers.length === 0) return;

  // Normalized mouse state (-0.5 to 0.5)
  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;

  // Scroll tracking
  let currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

  // Event Listeners for Mouse and Touch
  window.addEventListener("mousemove", (e) => {
    const width = window.innerWidth || 1;
    const height = window.innerHeight || 1;
    targetMouseX = (e.clientX / width) - 0.5;
    targetMouseY = (e.clientY / height) - 0.5;
  }, { passive: true });

  window.addEventListener("scroll", () => {
    currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  }, { passive: true });

  // Optional subtle device tilt on mobile
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma !== null && e.beta !== null) {
        // gamma is left/right (-90 to 90), beta is front/back (-180 to 180)
        targetMouseX = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
        targetMouseY = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60));
      }
    }, { passive: true });
  }

  // --- Ambient Canvas Particles (Autumn Leaves, Fireflies or Underwater Bubbles) ---
  const canvas = document.getElementById("ambientSparklesCanvas");
  let ctx = null;
  let particles = [];
  const PARTICLE_COUNT = isSeabed ? 28 : 24;

  const PARTICLE_PALETTE = isSeabed
    ? [
      "rgba(0, 180, 216, 0.75)",   // cyan bubble
      "rgba(144, 224, 239, 0.85)",  // light aqua
      "rgba(72, 202, 228, 0.70)",  // bright water shimmer
      "rgba(255, 209, 102, 0.60)",  // glowing catfish ember
    ]
    : [
      "rgba(255, 209, 102, 0.75)", // gold
      "rgba(247, 127, 0, 0.65)",   // amber
      "rgba(231, 111, 81, 0.60)",  // rust/autumn
      "rgba(252, 191, 73, 0.70)",  // warm yellow
    ];

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  if (canvas && !prefersReducedMotion) {
    ctx = canvas.getContext("2d");
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (canvas.width || 800),
        y: Math.random() * (canvas.height || 600),
        size: Math.random() < 0.6 ? 3 : (Math.random() < 0.8 ? 2 : 4),
        vx: (Math.random() - 0.45) * 0.35,
        vy: isSeabed ? -(0.25 + Math.random() * 0.45) : (0.25 + Math.random() * 0.5),
        color: PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)],
        oscillationSpeed: 0.0015 + Math.random() * 0.002,
        oscillationAmplitude: 15 + Math.random() * 25,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function updateAndDrawParticles(now) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update position
      p.y += p.vy;
      p.x += p.vx + Math.sin(now * p.oscillationSpeed + p.phase) * 0.25;

      // Wrap around bounds
      if (isSeabed) {
        if (p.y < -15) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
      } else {
        if (p.y > canvas.height + 10) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      }
      if (p.x < -20) p.x = canvas.width + 10;
      if (p.x > canvas.width + 20) p.x = -10;

      // Draw crisp pixel particle
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
  }

  // --- Main Animation Loop ---
  let isPageVisible = true;
  document.addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
  });

  function render(time) {
    if (!isPageVisible) {
      requestAnimationFrame(render);
      return;
    }

    if (!prefersReducedMotion) {
      // Smooth interpolation for mouse movement (lerp)
      const lerpFactor = 0.07;
      currentMouseX += (targetMouseX - currentMouseX) * lerpFactor;
      currentMouseY += (targetMouseY - currentMouseY) * lerpFactor;

      // Ambient idle breathing (sine waves so it breathes continuously even without mouse input)
      const ambientX = Math.sin(time * 0.0006) * 0.12;
      const ambientY = Math.cos(time * 0.0008) * 0.08;

      const combinedNormX = currentMouseX + ambientX;
      const combinedNormY = currentMouseY + ambientY;

      // Apply transformations to each layer based on depth
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        // Invert X slightly so looking right shifts background left (realistic 3D parallax)
        const transX = -combinedNormX * layer.depthX;
        const transY = -combinedNormY * layer.depthY - (currentScrollY * layer.scrollRatio);

        layer.el.style.transform = `translate3d(${transX.toFixed(2)}px, ${transY.toFixed(2)}px, 0)`;
      }

      // Update and draw floating particles
      updateAndDrawParticles(time);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
