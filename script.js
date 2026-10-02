/* ==========================================================================
   ARKHÉ Diseño & Construcción  |  script.js
   --------------------------------------------------------------------------
   Orquestación de la experiencia:
   loader · scroll suave (Lenis) · GSAP + ScrollTrigger (pin, scrub, parallax)
   · canvas de partículas · interacciones (valores, estilos, planos, FAQ)
   · formulario que redirige a WhatsApp.

   Principios
   - Cada módulo corre dentro de safe(): si uno falla, el resto sigue vivo.
   - Si GSAP / Lenis no cargan (CDN bloqueado), la página funciona igual:
     los reveals usan IntersectionObserver + CSS y los bloques fijados
     degradan a su versión apilada.
   - prefers-reduced-motion se respeta en todo (sin pin, sin parallax, sin loops).
   - Se anima únicamente transform / opacity / clip-path.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const body = document.body;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reduceMQ.matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis !== 'undefined';

  const WA_NUMBER = '525577619591'; // +52 55 7761 9591

  let lenis = null;
  let menuOpen = false;

  const safe = (name, fn) => {
    try { fn(); } catch (err) { console.warn('[ARKHÉ] módulo "' + name + '" falló:', err); }
  };

  /* Bus de scroll: una sola suscripción para nav, progreso, marquee, sello, WhatsApp */
  const scrollSubs = [];
  const onScroll = (fn) => scrollSubs.push(fn);
  const emitScroll = (y, v, d) => scrollSubs.forEach((fn) => fn(y, v, d));

  /* ------------------------------------------------------------------ */
  /* Scroll suave                                                        */
  /* ------------------------------------------------------------------ */
  function initScroll() {
    if (hasGSAP) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
    }

    if (hasLenis && !reduced()) {
      lenis = new Lenis({
        duration: 1.3,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.3,
      });
      lenis.on('scroll', (e) => emitScroll(e.scroll, e.velocity, e.direction));
      if (hasGSAP) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((t) => lenis.raf(t * 1000));
        gsap.ticker.lagSmoothing(0);
      } else {
        const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
    } else {
      /* Respaldo nativo: un único listener pasivo agrupado con rAF */
      let last = window.scrollY, ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY, v = y - last;
          last = y;
          emitScroll(y, v, v > 0 ? 1 : v < 0 ? -1 : 0);
          ticking = false;
        });
      }, { passive: true });
    }

    /* Enlaces ancla */
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const target = $(id);
        if (!target) return;
        e.preventDefault();
        if (menuOpen) toggleMenu(false);
        const go = () => {
          if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.7 });
          else target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', id);
        };
        menuOpen ? setTimeout(go, 350) : go();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Loader con progreso real (fuentes + carga + imagen del hero)        */
  /* ------------------------------------------------------------------ */
  function initLoader() {
    const loader = $('#loader');
    const ring = $('#loaderRing');
    const count = $('#loaderCount');

    const start = () => { body.classList.add('is-ready'); };
    if (!loader) { start(); return; }

    body.style.overflow = 'hidden';
    if (lenis) lenis.stop();

    const MIN = reduced() ? 500 : 2600;
    const t0 = performance.now();
    let shown = 0, finished = false, tasksDone = 0;

    const heroImg = $('.hero__photo img');
    const tasks = [
      new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      heroImg && heroImg.decode ? heroImg.decode() : Promise.resolve(),
    ];
    tasks.forEach((p) => Promise.resolve(p).catch(() => {}).then(() => { tasksDone++; }));

    const finish = () => {
      if (finished) return;
      finished = true;
      ring.style.strokeDashoffset = 0;
      count.textContent = '100';
      loader.classList.add('is-done');
      setTimeout(() => { start(); }, 650);
      setTimeout(() => {
        loader.classList.add('is-gone');
        body.style.overflow = '';
        if (lenis) lenis.start();
        if (hasGSAP) ScrollTrigger.refresh();
        initWhatsAppFloat();
        startWarmup();
      }, 1900);
    };

    const tick = (now) => {
      if (finished) return;
      const timeP = clamp((now - t0) / MIN, 0, 1);
      const taskP = tasksDone / tasks.length;
      const target = taskP < 1 ? Math.min(timeP, 0.15 + 0.85 * taskP) : timeP;
      shown = lerp(shown, target, 0.12);
      ring.style.strokeDashoffset = String(100 - shown * 100);
      count.textContent = String(Math.round(shown * 100));
      if (taskP === 1 && timeP >= 1 && shown > 0.985) return finish();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(finish, 9000); // tope de seguridad
  }

  /* ------------------------------------------------------------------ */
  /* Navegación + menú principal                                         */
  /* ------------------------------------------------------------------ */
  const nav = $('#nav');
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');

  function toggleMenu(force) {
    menuOpen = typeof force === 'boolean' ? force : !menuOpen;
    menu.classList.toggle('is-open', menuOpen);
    menu.inert = !menuOpen;
    menuBtn.setAttribute('aria-expanded', String(menuOpen));
    menuBtn.querySelector('.menu-btn__label').textContent = menuOpen ? 'Cerrar' : 'Menú';
    nav.classList.remove('is-hidden');
    nav.classList.toggle('is-solid', menuOpen || window.scrollY > 40);
    if (lenis) menuOpen ? lenis.stop() : lenis.start();
    else body.style.overflow = menuOpen ? 'hidden' : '';
    if (menuOpen) setTimeout(() => { const f = $('a', menu); if (f) f.focus({ preventScroll: true }); }, 500);
    else menuBtn.focus({ preventScroll: true });
  }

  function initNav() {
    menu.inert = true;
    $$('.menu__grid li').forEach((li, i) => li.style.setProperty('--i', i));
    menuBtn.addEventListener('click', () => toggleMenu());

    document.addEventListener('keydown', (e) => {
      if (!menuOpen) return;
      if (e.key === 'Escape') toggleMenu(false);
      if (e.key === 'Tab') {
        const items = [menuBtn, ...$$('a', menu)];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    const progress = $('#navProgress');
    onScroll((y, v, dir) => {
      if (!menuOpen) {
        nav.classList.toggle('is-solid', y > 40);
        if (y > 420 && dir > 0) nav.classList.add('is-hidden');
        else if (dir < 0 || y <= 420) nav.classList.remove('is-hidden');
      }
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--sp', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');
    });

    /* Enlace activo según la sección en pantalla */
    const links = $$('.nav__links a');
    const map = new Map(links.map((a) => [a.getAttribute('href'), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const a = map.get('#' + en.target.id);
        if (a) a.classList.toggle('is-current', en.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, href) => { const s = $(href); if (s) io.observe(s); });
  }

  /* ------------------------------------------------------------------ */
  /* Reveals (IntersectionObserver + CSS), contadores, parallax          */
  /* ------------------------------------------------------------------ */
  /* Divide los H2 en palabras para animarlas con máscara (conserva <br> y estilos internos) */
  function splitHeadings() {
    if (reduced()) return;
    $$('h2.h2[data-reveal]').forEach((h) => {
      let i = 0;
      const walk = (node) => {
        Array.from(node.childNodes).forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const w = document.createElement('span'); w.className = 'wd';
              const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
              w.appendChild(inner); frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      };
      walk(h);
      h.classList.add('is-split');
    });
  }

  function initReveals() {
    splitHeadings();
    const els = $$('[data-reveal]');
    if (reduced() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const reveal = (entries, o) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      o.unobserve(en.target);
    });
    const io = new IntersectionObserver(reveal, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    /* Los bloques que llevan foto se revelan ANTES de entrar a pantalla: al llegar ya están visibles, sin retraso */
    const early = new IntersectionObserver(reveal, { threshold: 0, rootMargin: '0px 0px 45% 0px' });
    els.forEach((el) => (el.matches('img') || el.querySelector('img') ? early : io).observe(el));
  }

  /* Precarga en segundo plano: cuando termina el loader se descargan y decodifican todas las fotos
     (de la más cercana a la más lejana) para que al hacer scroll ya estén listas. */
  let warmStarted = false;
  function startWarmup() {
    if (warmStarted) return;
    warmStarted = true;
    const imgs = $$('img[loading="lazy"], img[data-src]');
    let i = 0, active = 0;
    const MAX = 3;
    const next = () => {
      while (active < MAX && i < imgs.length) {
        const im = imgs[i++];
        active++;
        if (im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); }
        im.loading = 'eager';
        (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { active--; next(); });
      }
      if (i >= imgs.length && active === 0) {
        $$('[data-bg]').forEach((el) => { el.style.setProperty('--bg-url', 'url("' + el.dataset.bg + '")'); el.removeAttribute('data-bg'); });
      }
    };
    next();
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const run = (el) => {
      const to = parseInt(el.dataset.count, 10);
      if (reduced()) { el.textContent = to; return; }
      const t0 = performance.now(), dur = 1700;
      const step = (now) => {
        const k = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!reduced()) els.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ */
  /* Hero: foco de rejilla, partículas, parallax, velocidad por scroll   */
  /* ------------------------------------------------------------------ */
  function initHero() {
    const hero = $('#inicio');
    const grid = $('#heroGrid');
    const canvas = $('#heroCanvas');
    if (!hero || !canvas) return;

    let heroVisible = true;
    new IntersectionObserver((e) => { heroVisible = e[0].isIntersecting; if (heroVisible) kick(); }, { threshold: 0 }).observe(hero);

    /* Foco de rejilla: sigue al puntero; en reposo deriva solo (también en táctil) */
    const pt = { x: 0, y: 0, tx: 0, ty: 0, last: -9999, t: 0 };
    const rect = () => hero.getBoundingClientRect();
    hero.addEventListener('pointermove', (e) => {
      const r = rect();
      pt.tx = e.clientX - r.left; pt.ty = e.clientY - r.top; pt.last = performance.now();
      mouse.x = pt.tx; mouse.y = pt.ty; mouse.on = true;
    });
    hero.addEventListener('pointerleave', () => { mouse.on = false; });

    /* Partículas: marcas de medición + nodos con líneas de conexión */
    const ctx = canvas.getContext('2d');
    const mouse = { x: -999, y: -999, on: false };
    let w = 0, h = 0, dpr = 1, parts = [], raf = 0, running = false;

    const make = (init) => ({
      x: Math.random() * w,
      y: init ? Math.random() * h : h + 12,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -(0.1 + Math.random() * 0.3),
      s: 1.3 + Math.random() * 2.1,
      cross: Math.random() < 0.38,
      ph: Math.random() * Math.PI * 2,
    });
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = hero.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((w * h) / 21000, 26, 84));
      parts = Array.from({ length: n }, () => make(true));
      if (reduced()) frame(true);
    };

    const frame = (once) => {
      ctx.clearRect(0, 0, w, h);
      const LINK = 124, PTR = 170;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!once) {
          p.ph += 0.01;
          p.x += p.vx + Math.sin(p.ph) * 0.12;
          p.y += p.vy;
          if (mouse.on) {
            const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < 120 * 120) { const d = Math.sqrt(d2) || 1, f = (1 - d / 120) * 1.6; p.x += (dx / d) * f; p.y += (dy / d) * f; }
          }
          if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, make(false), { x: Math.random() * w });
        }
        for (let j = i + 1; j < parts.length; j++) {
          const q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = 'rgba(42,80,138,' + ((1 - Math.sqrt(d2) / LINK) * 0.2).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < PTR * PTR) {
            ctx.strokeStyle = 'rgba(63,115,198,' + ((1 - Math.sqrt(d2) / PTR) * 0.5).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        if (p.cross) {
          const a = p.s + 2.5;
          ctx.strokeStyle = 'rgba(12,14,17,0.38)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x - a, p.y); ctx.lineTo(p.x + a, p.y); ctx.moveTo(p.x, p.y - a); ctx.lineTo(p.x, p.y + a); ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(42,80,138,0.55)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 0.75, 0, 6.2832); ctx.fill();
        }
      }
    };

    /* Un solo bucle: partículas + foco de rejilla */
    const loop = (now) => {
      if (!heroVisible || document.hidden) { running = false; return; }
      pt.t += 0.016;
      const idle = now - pt.last > 2600;
      if (idle) {
        const r = rect();
        pt.tx = r.width * (0.64 + 0.2 * Math.sin(pt.t * 0.55));
        pt.ty = r.height * (0.42 + 0.22 * Math.cos(pt.t * 0.38));
      }
      pt.x = lerp(pt.x, pt.tx, 0.07); pt.y = lerp(pt.y, pt.ty, 0.07);
      grid.style.setProperty('--mx', pt.x.toFixed(1) + 'px');
      grid.style.setProperty('--my', pt.y.toFixed(1) + 'px');
      frame(false);
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (running || reduced()) return; running = true; raf = requestAnimationFrame(loop); };

    new ResizeObserver(resize).observe(hero);
    resize();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    kick();

    /* Sello y franja: aceleran con la velocidad del scroll (Web Animations API) */
    const sealAnim = $('.seal__ring') && $('.seal__ring').getAnimations()[0];
    const stripAnim = $('#stripTrack') && $('#stripTrack').getAnimations()[0];
    let rate = 1;
    onScroll((y, v) => {
      const target = 1 + Math.min(Math.abs(v), 40) * 0.12;
      rate = lerp(rate, target, 0.15);
      if (sealAnim) sealAnim.playbackRate = rate;
      if (stripAnim) stripAnim.playbackRate = rate;
    });
    setInterval(() => { rate = lerp(rate, 1, 0.25); if (sealAnim) sealAnim.playbackRate = rate; if (stripAnim) stripAnim.playbackRate = rate; }, 120);

    /* Salida del hero al avanzar */
    if (hasGSAP && !reduced()) {
      gsap.to('.hero__copy', { yPercent: -10, opacity: 0.25, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__media', { yPercent: 7, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Secciones con GSAP: manifiesto, parallax, apilado, pin horizontal    */
  /* ------------------------------------------------------------------ */
  function initAboutWords() {
    const p = $('#aboutStatement');
    if (!p) return;
    const text = p.textContent.trim().replace(/\s+/g, ' ');
    p.setAttribute('aria-label', text);
    p.textContent = '';
    const words = text.split(' ').map((t) => {
      const s = document.createElement('span');
      s.className = 'w'; s.textContent = t + ' '; s.setAttribute('aria-hidden', 'true');
      p.appendChild(s); return s;
    });
    if (!hasGSAP || reduced()) { words.forEach((w) => w.classList.add('is-lit')); return; }
    ScrollTrigger.create({
      trigger: p, start: 'top 82%', end: 'bottom 48%',
      onUpdate: (self) => {
        const n = Math.round(self.progress * words.length);
        words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
      },
    });
  }

  function initScrollScenes() {
    if (!hasGSAP) return;
    const mm = gsap.matchMedia();

    mm.add({ desk: '(min-width: 900px)', motion: '(prefers-reduced-motion: no-preference)' }, (ctx) => {
      const { desk, motion } = ctx.conditions;
      if (!motion) return;

      /* Parallax suave en imágenes marcadas */
      $$('[data-parallax]').forEach((img) => {
        gsap.fromTo(img, { yPercent: 5 }, { yPercent: -5, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
      });

      if (desk) {
        /* Tarjetas de servicios: la anterior se reduce cuando llega la siguiente */
        const cards = $$('.svc');
        cards.forEach((c, i) => {
          if (i === cards.length - 1) return;
          gsap.to(c, { scale: 0.94, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top 88%', end: 'top 22%', scrub: true } });
        });

        /* Pan horizontal de "Diseño" */
        const track = $('#panTrack'), view = $('.pan__viewport');
        if (track && view) {
          root.classList.add('fx-pan');
          /* Las fotos del recorrido horizontal se piden poco antes de llegar a la sección (no al cargar la página) */
          const panImgs = $$('img', track);
          const wake = () => panImgs.forEach((im) => { im.loading = 'eager'; });
          if ('IntersectionObserver' in window) {
            const pio = new IntersectionObserver((e) => { if (e[0].isIntersecting) { wake(); pio.disconnect(); } }, { rootMargin: '1500px 0px' });
            pio.observe(view);
          } else wake();
          const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
          gsap.to(track, {
            x: () => -dist(), ease: 'none',
            scrollTrigger: {
              trigger: view, start: 'top top', end: () => '+=' + dist(),
              pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
              onUpdate: (self) => view.style.setProperty('--pp', self.progress.toFixed(4)),
            },
          });
        }

        /* Cronología: edificio que se levanta mientras avanzan las etapas */
        const stage = $('.tl__stage'), items = $$('.tl__item'), visual = $('.tl__visual');
        if (stage && items.length) {
          root.classList.add('fx-tl');
          let current = -1;
          const steps = $$('#tlSteps i');
          const setItem = (i) => {
            if (i === current) return;
            current = i;
            items.forEach((it, k) => it.classList.toggle('is-active', k === i));
            steps.forEach((st, k) => { st.classList.toggle('is-on', k < i); st.classList.toggle('is-now', k === i); });
          };
          setItem(0);
          ScrollTrigger.create({
            trigger: stage, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 4.4),
            pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true,
            onUpdate: (self) => {
              visual.style.setProperty('--tp', self.progress.toFixed(4));
              setItem(Math.min(items.length - 1, Math.floor(self.progress * items.length)));
            },
          });
        }
      }

      return () => { root.classList.remove('fx-pan', 'fx-tl'); };
    });

    /* Cronología apilada (móvil o movimiento reducido): línea de progreso + iconos activos */
    mm.add('(max-width: 899px), (prefers-reduced-motion: reduce)', () => {
      const list = $('#tlList');
      if (!list) return;
      const items = $$('.tl__item', list);
      ScrollTrigger.create({
        trigger: list, start: 'top 65%', end: 'bottom 60%',
        onUpdate: (self) => list.style.setProperty('--tp', self.progress.toFixed(4)),
      });
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { items.forEach((it) => it.classList.remove('is-active')); en.target.classList.add('is-active'); } });
      }, { rootMargin: '-45% 0px -50% 0px' });
      items.forEach((it) => io.observe(it));
      return () => io.disconnect();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Valores: paneles que se expanden (con auto-rotación hasta interactuar) */
  /* ------------------------------------------------------------------ */
  function initValues() {
    const wrap = $('#vals');
    if (!wrap) return;
    const vals = $$('.val', wrap);
    let idx = 0, timer = null, touched = false, inView = false;

    const set = (i) => {
      idx = i;
      vals.forEach((v, k) => {
        const on = k === i;
        v.classList.toggle('is-active', on);
        $('.val__btn', v).setAttribute('aria-expanded', String(on));
      });
    };
    const play = () => {
      clearInterval(timer);
      if (touched || reduced() || !inView) return;
      timer = setInterval(() => set((idx + 1) % vals.length), 5600);
    };
    vals.forEach((v, i) => {
      const act = () => { touched = true; clearInterval(timer); set(i); };
      $('.val__btn', v).addEventListener('click', act);
      if (window.matchMedia('(min-width: 900px)').matches) v.addEventListener('click', act);
    });
    new IntersectionObserver((e) => { inView = e[0].isIntersecting; play(); }, { threshold: 0.35 }).observe(wrap);
  }

  /* ------------------------------------------------------------------ */
  /* Objetivos: el texto avanza y el visual fijo cambia de icono         */
  /* ------------------------------------------------------------------ */
  function initGoals() {
    const goals = $$('.goal');
    const gv = $('.gv');
    if (!goals.length || !gv) return;
    const icons = $$('.gv__i', gv);
    const set = (i) => {
      goals.forEach((g, k) => g.classList.toggle('is-active', k === i));
      icons.forEach((ic, k) => ic.classList.toggle('is-on', k === i));
      gv.style.setProperty('--gp', ((i + 1) / goals.length * 100).toFixed(1));
    };
    set(0);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) set(parseInt(en.target.dataset.goal, 10)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    goals.forEach((g) => io.observe(g));
  }

  /* ------------------------------------------------------------------ */
  /* Tendencias: selector interactivo con autoavance                     */
  /* ------------------------------------------------------------------ */
  function initStyles() {
    const list = $('#slist');
    if (!list) return;
    const rows = $$('.srow', list);
    const imgs = $$('.spv');
    const DUR = 5200;
    list.style.setProperty('--dur', DUR + 'ms');
    let idx = 0, timer = null, held = false, inView = false;

    /* Carga bajo demanda: solo la foto activa (y la siguiente) se descargan, no las 6 a la vez */
    const load = (i) => {
      const im = imgs[i];
      if (im && im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); }
    };

    const set = (i, focus) => {
      idx = i;
      rows.forEach((r, k) => {
        const on = k === i;
        r.classList.toggle('is-active', on);
        r.setAttribute('aria-selected', String(on));
        r.tabIndex = on ? 0 : -1;
      });
      imgs.forEach((im, k) => im.classList.toggle('is-active', k === i));
      load(i);
      if (inView) load((i + 1) % imgs.length);
      if (focus) rows[i].focus();
    };
    const play = () => {
      clearInterval(timer);
      if (held || reduced() || !inView) return;
      timer = setInterval(() => set((idx + 1) % rows.length), DUR);
    };
    const hold = () => { held = true; list.classList.add('is-held'); clearInterval(timer); };

    rows.forEach((r, i) => {
      r.addEventListener('click', () => { hold(); set(i); });
      r.addEventListener('mouseenter', () => { if (window.matchMedia('(hover: hover)').matches) { hold(); set(i); } });
      r.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault(); hold();
        set((i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length, true);
      });
    });
    new IntersectionObserver((e) => { inView = e[0].isIntersecting; if (inView) load((idx + 1) % imgs.length); play(); }, { threshold: 0.3 }).observe(list);
    set(0);
  }

  /* ------------------------------------------------------------------ */
  /* Planos ejecutivos: visor de capas que se dibujan                    */
  /* ------------------------------------------------------------------ */
  function initBlueprint() {
    const sheet = $('#sheet');
    if (!sheet) return;
    const tabs = $$('.ptab');
    const texts = $$('.pdesc__t');
    const nameEl = $('#sheetName'), scaleEl = $('#sheetScale');
    const info = {
      a: ['Plano arquitectónico', 'Esc. 1:100'],
      s: ['Plano estructural', 'Esc. 1:100'],
      i: ['Plano de instalaciones', 'Esc. 1:100'],
    };
    const order = ['a', 's', 'i'];
    let cur = 'a', timer = null, held = false, inView = false;
    const drawn = new Set();

    const markDrawn = (l) => { drawn.add(l); sheet.dataset.drawn = Array.from(drawn).join(' '); };
    const set = (l, focus) => {
      cur = l;
      sheet.dataset.layer = l;
      tabs.forEach((t) => {
        const on = t.dataset.layer === l;
        t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      texts.forEach((t) => t.classList.toggle('is-active', t.dataset.layer === l));
      nameEl.textContent = info[l][0]; scaleEl.textContent = info[l][1];
      if (!drawn.has(l)) requestAnimationFrame(() => requestAnimationFrame(() => markDrawn(l)));
    };
    const play = () => {
      clearInterval(timer);
      if (held || reduced() || !inView) return;
      timer = setInterval(() => set(order[(order.indexOf(cur) + 1) % 3]), 6500);
    };

    tabs.forEach((t) => {
      t.addEventListener('click', () => { held = true; clearInterval(timer); set(t.dataset.layer); });
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault(); held = true; clearInterval(timer);
        set(order[(order.indexOf(cur) + (e.key === 'ArrowRight' ? 1 : 2)) % 3], true);
      });
    });

    new IntersectionObserver((e) => {
      inView = e[0].isIntersecting;
      if (inView && !drawn.size) set('a');
      play();
    }, { threshold: 0.35 }).observe(sheet);
    if (reduced()) { order.forEach(markDrawn); }
  }

  /* ------------------------------------------------------------------ */
  /* Beneficios: lista ↔ órbita sincronizadas                            */
  /* ------------------------------------------------------------------ */
  function initBenefits() {
    const list = $('#blist');
    if (!list) return;
    const items = $$('.bitem', list);
    const nodes = $$('.onode');
    let idx = 0, timer = null, held = false, inView = false;
    const set = (i) => {
      idx = i;
      items.forEach((it, k) => { it.classList.toggle('is-active', k === i); $('.bitem__btn', it).setAttribute('aria-expanded', String(k === i)); });
      nodes.forEach((n, k) => n.classList.toggle('is-active', k === i));
    };
    const play = () => {
      clearInterval(timer);
      if (held || reduced() || !inView) return;
      timer = setInterval(() => set((idx + 1) % items.length), 4600);
    };
    items.forEach((it, i) => $('.bitem__btn', it).addEventListener('click', () => { held = true; clearInterval(timer); set(i); }));
    new IntersectionObserver((e) => { inView = e[0].isIntersecting; play(); }, { threshold: 0.3 }).observe(list);
  }

  /* ------------------------------------------------------------------ */
  /* FAQ                                                                 */
  /* ------------------------------------------------------------------ */
  function initFaq() {
    const qas = $$('.qa');
    qas.forEach((qa) => {
      const btn = $('.qa__q', qa);
      btn.addEventListener('click', () => {
        const open = !qa.classList.contains('is-open');
        qas.forEach((o) => { o.classList.remove('is-open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); });
        if (open) { qa.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Botones: relleno direccional + efecto magnético                     */
  /* ------------------------------------------------------------------ */
  function initButtons() {
    $$('.btn').forEach((b) => {
      const set = (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--x', (e.clientX - r.left) + 'px');
        b.style.setProperty('--y', (e.clientY - r.top) + 'px');
      };
      b.addEventListener('pointerenter', set);
      b.addEventListener('pointerleave', set);
    });
    if (!hasGSAP || coarse || reduced()) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.2);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Formulario → WhatsApp                                               */
  /* ------------------------------------------------------------------ */
  function initForm() {
    const form = $('#quoteForm');
    if (!form) return;
    const ok = $('#formOk'), okLink = $('#formOkLink');
    const err = (id, msg) => {
      const el = $('#' + id); if (!el) return;
      el.textContent = msg;
      const field = el.closest('.field'); if (field) field.classList.toggle('has-error', !!msg);
    };
    const val = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');

    ['nombre', 'mensaje'].forEach((n) => {
      form.elements[n].addEventListener('input', () => err(n === 'nombre' ? 'e-nombre' : 'e-msg', ''));
    });
    $$('input[name="tipo"]', form).forEach((r) => r.addEventListener('change', () => err('e-tipo', '')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = val('nombre');
      const tipoEl = form.querySelector('input[name="tipo"]:checked');
      const mensaje = val('mensaje');
      const ubic = val('ubicacion');
      let first = null;

      if (nombre.length < 2) { err('e-nombre', 'Escribe tu nombre para saber con quién platicamos.'); first = first || form.elements.nombre; } else err('e-nombre', '');
      if (!tipoEl) { err('e-tipo', 'Elige qué quieres hacer.'); first = first || form.querySelector('input[name="tipo"]'); } else err('e-tipo', '');
      if (mensaje.length < 10) { err('e-msg', 'Cuéntanos un poco más de tu idea (mínimo una frase).'); first = first || form.elements.mensaje; } else err('e-msg', '');
      if (first) { first.focus(); return; }

      const text =
        'Hola Arq. Carlos Ruiz, vengo del sitio web de ARKHÉ y me gustaría platicar mi proyecto.\n\n' +
        '*Nombre:* ' + nombre + '\n' +
        '*Proyecto:* ' + tipoEl.value + '\n' +
        '*Ubicación:* ' + (ubic || 'Por definir') + '\n' +
        '*Mi idea:* ' + mensaje;
      const url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
      okLink.href = url;
      ok.hidden = false;
      window.open(url, '_blank', 'noopener');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Botón flotante de WhatsApp                                          */
  /* ------------------------------------------------------------------ */
  let waStarted = false;
  function initWhatsAppFloat() {
    if (waStarted) return;
    waStarted = true;
    const wa = $('#wa');
    if (!wa) return;
    setTimeout(() => wa.classList.add('is-visible'), 400);
    setTimeout(() => wa.classList.add('show-label'), 4200);
    setTimeout(() => wa.classList.remove('show-label'), 9800);
  }

  /* ------------------------------------------------------------------ */
  /* Fondos con imagen diferidos (se piden poco antes de verse)          */
  /* ------------------------------------------------------------------ */
  function initLazyBg() {
    const els = $$('[data-bg]');
    const apply = (el) => {
      if (!el.dataset.bg) return; // ya aplicado por la precarga
      el.style.setProperty('--bg-url', 'url("' + el.dataset.bg + '")');
      el.removeAttribute('data-bg');
    };
    if (!('IntersectionObserver' in window)) { els.forEach(apply); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { apply(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '700px 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */
  function boot() {
    if (!hasGSAP) root.classList.add('no-gsap');
    safe('scroll', initScroll);
    safe('reveals', initReveals);
    safe('nav', initNav);
    safe('loader', initLoader);
    safe('counters', initCounters);
    safe('hero', initHero);
    safe('about', initAboutWords);
    safe('scenes', initScrollScenes);
    safe('values', initValues);
    safe('goals', initGoals);
    safe('styles', initStyles);
    safe('blueprint', initBlueprint);
    safe('benefits', initBenefits);
    safe('lazybg', initLazyBg);
    safe('faq', initFaq);
    safe('buttons', initButtons);
    safe('form', initForm);

    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

    /* Recalcula posiciones cuando todo cargó (imágenes, fuentes) */
    const refresh = () => { if (hasGSAP) ScrollTrigger.refresh(); };
    window.addEventListener('load', () => { setTimeout(refresh, 300); setTimeout(startWarmup, 6000); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
