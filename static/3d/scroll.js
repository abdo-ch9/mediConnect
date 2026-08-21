import { initMediConnect3D } from './main.js';

let lenis = null;
let sections = [];

function initScroll() {
  const container = document.getElementById('scroll-container');
  if (!container) return;

  sections = Array.from(document.querySelectorAll('.scroll-section'));

  const isMobile = window.innerWidth < 768;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile || prefersReducedMotion) {
    document.body.classList.add('mediconnect-fallback');
    return;
  }

  initMediConnect3D();

  try {
    if (typeof Lenis === 'undefined') {
      throw new Error('Lenis not loaded');
    }
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on('scroll', ({ progress }) => {
      const app3d = window.app3d;
      if (app3d && typeof app3d.setScrollProgress === 'function') {
        app3d.setScrollProgress(progress);
      }
      updateSections(progress);
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    window.addEventListener('resize', () => {
      if (lenis) lenis.resize();
    });

    window.addEventListener('beforeunload', () => {
      if (lenis) lenis.destroy();
      const app3d = window.app3d;
      if (app3d && typeof app3d.dispose === 'function') {
        app3d.dispose();
      }
    });
  } catch (e) {
    console.warn('Smooth scroll initialization failed:', e);
  }
}

function updateSections(progress) {
  const total = sections.length;
  sections.forEach((section, i) => {
    const start = i / total;
    const end = (i + 1) / total;
    const mid = (start + end) / 2;
    const dist = Math.abs(progress - mid);
    const maxDist = 0.15;
    const opacity = dist < maxDist ? 1 - (dist / maxDist) * 0.7 : 0.3;
    const scale = dist < maxDist ? 1 - (dist / maxDist) * 0.1 : 0.95;
    section.style.opacity = Math.max(0.2, opacity);
    section.style.transform = `scale(${Math.max(0.9, scale)})`;
  });
}

initScroll();
