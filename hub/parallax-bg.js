/**
 * Spillhjørnet – Dynamic Multilayered Parallax Engine (Prison Theme)
 * Continuous downward infinite scroll with 3D dynamic mouse parallax
 */

(() => {
  "use strict";

  // Check if reduced motion is requested
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isSeabed = Boolean(document.querySelector(".dynamic-parallax-bg.theme-seabed"));
  const isPrison = !isSeabed;

  const layers = [
    {
      id: "wall",
      el: document.getElementById("plSky") || document.getElementById("plSeabed1"),
      depthX: 14,
      depthY: 10,
      scrollRatio: 0.03,
      speedY: 18, // continuous downward speed (px/sec) for deep stone wall (0_layer.png)
      offsetY: 0,
    },
    {
      id: "torch",
      el: document.getElementById("plFjord") || document.getElementById("plSeabed2"),
      depthX: 24,
      depthY: 16,
      scrollRatio: 0.06,
      speedY: 28, // continuous downward speed for stone pillar with torch (1_layer.png)
      offsetY: 0,
    },
    {
      id: "chains",
      el: document.getElementById("plCampus") || document.getElementById("plSeabed3"),
      depthX: 42,
      depthY: 26,
      scrollRatio: 0.12,
      speedY: 42, // medium-fast speed for hanging chains (2_layer.png)
      offsetY: 0,
    },
    {
      id: "overlay",
      el: document.getElementById("plLawn") || document.getElementById("plSeabed4"),
      depthX: 84,
      depthY: 42,
      scrollRatio: 0.28,
      speedY: 0, // non-scrolling, non-tiling atmospheric light ray (3_layer.png)
      offsetY: 0,
    },
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

  // --- Ambient Canvas Particles (Dungeon Sparks, Embers or Underwater Bubbles) ---
  const canvas = document.getElementById("ambientSparklesCanvas");
  let ctx = null;
  let particles = [];
  const PARTICLE_COUNT = isSeabed ? 28 : 32;

  const PARTICLE_PALETTE = isSeabed
    ? [
      "rgba(0, 180, 216, 0.75)",   // cyan bubble
      "rgba(144, 224, 239, 0.85)",  // light aqua
      "rgba(72, 202, 228, 0.70)",  // bright water shimmer
      "rgba(255, 209, 102, 0.60)",  // glowing catfish ember
    ]
    : [
      "rgba(255, 140, 45, 0.80)",  // fiery orange torch spark
      "rgba(255, 195, 75, 0.88)",  // golden flame spark
      "rgba(230, 80, 30, 0.70)",   // deep ember
      "rgba(175, 190, 215, 0.45)", // subtle dungeon dust mote
      "rgba(255, 120, 40, 0.75)",  // floating hot ember
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
        size: Math.random() < 0.65 ? 2 : (Math.random() < 0.88 ? 3 : 4),
        vx: (Math.random() - 0.48) * 0.4,
        vy: isSeabed ? -(0.25 + Math.random() * 0.45) : (0.35 + Math.random() * 0.6),
        color: PARTICLE_PALETTE[Math.floor(Math.random() * PARTICLE_PALETTE.length)],
        oscillationSpeed: 0.0015 + Math.random() * 0.002,
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
      p.x += p.vx + Math.sin(now * p.oscillationSpeed + p.phase) * 0.28;

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

  let lastTime = performance.now();

  function render(time) {
    if (!isPageVisible) {
      lastTime = time;
      requestAnimationFrame(render);
      return;
    }

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

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

      // Apply transformations to each layer based on depth & downward continuous movement
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        // Invert X slightly so looking right shifts background left (realistic 3D parallax)
        const transX = -combinedNormX * layer.depthX;
        const transY = -combinedNormY * layer.depthY - (currentScrollY * layer.scrollRatio);

        layer.el.style.transform = `translate3d(${transX.toFixed(2)}px, ${transY.toFixed(2)}px, 0)`;

        if (isPrison) {
          if (layer.id === "overlay") {
            // 3_layer: diagonal atmospheric light beam
            // Non-scrolling and non-tiling; only 3D mouse parallax transform applies.
          } else {
            // Continuous infinite downward scroll for wall (0_layer), torch pillar (1_layer), and chains (2_layer)
            layer.offsetY += layer.speedY * delta;
            // 1536px is an exact common multiple of 128, 256, 384, 512px for seamless loop
            if (layer.offsetY >= 153600) {
              layer.offsetY %= 1536;
            }
            layer.el.style.backgroundPositionY = `${(layer.offsetY % 1536).toFixed(2)}px`;
          }
        }
      }

      // Update and draw floating particles
      updateAndDrawParticles(time);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
