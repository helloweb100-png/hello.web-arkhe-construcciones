'use strict';

/* ═══════════════════════════════
   LOADER
   ═══════════════════════════════ */
window.addEventListener('load', function () {
  setTimeout(function () {
    var ldr = document.getElementById('loader');
    if (ldr) { ldr.classList.add('out'); document.body.style.overflow = ''; }
  }, 1900);
});

/* ═══════════════════════════════
   NAV — scroll state
   ═══════════════════════════════ */
var nav = document.getElementById('nav');
window.addEventListener('scroll', function () {
  nav.classList.toggle('stuck', window.scrollY > 72);
}, { passive: true });

/* ═══════════════════════════════
   MOBILE MENU
   ═══════════════════════════════ */
var ham = document.getElementById('ham');
var mob = document.getElementById('mob');

ham.addEventListener('click', function () {
  mob.classList.toggle('open');
  ham.setAttribute('aria-expanded', mob.classList.contains('open'));
});

mob.querySelectorAll('a').forEach(function (a) {
  a.addEventListener('click', function () {
    mob.classList.remove('open');
    ham.setAttribute('aria-expanded', 'false');
  });
});

/* ═══════════════════════════════
   PARTICLES — hero only
   ═══════════════════════════════ */
(function () {
  var canvas = document.getElementById('pcanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var pts = [];
  var raf = null;

  function resize () {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function Dot () { this.init(); }
  Dot.prototype.init = function () {
    this.x  = Math.random() * canvas.width;
    this.y  = Math.random() * canvas.height;
    this.r  = Math.random() * 2.2 + 0.8;
    this.vx = (Math.random() - .5) * .38;
    this.vy = (Math.random() - .5) * .38;
    this.a  = Math.random() * .40 + .18;
  };
  Dot.prototype.step = function () {
    this.x += this.vx;
    this.y += this.vy;
    var W = canvas.width, H = canvas.height, pad = 6;
    if (this.x < -pad) this.x = W + pad;
    if (this.x > W + pad) this.x = -pad;
    if (this.y < -pad) this.y = H + pad;
    if (this.y > H + pad) this.y = -pad;
  };
  Dot.prototype.draw = function () {
    /* glow halo on larger dots */
    if (this.r > 1.0) {
      var grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 5);
      grd.addColorStop(0, 'rgba(120,190,255,' + (this.a * .7) + ')');
      grd.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 5, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + this.a + ')';
    ctx.fill();
  };

  function build () {
    pts = [];
    var n = Math.min(Math.round(canvas.width * canvas.height / 5500), 110);
    for (var i = 0; i < n; i++) pts.push(new Dot());
  }

  function tick () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var maxDist = 185;
    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx   = pts[i].x - pts[j].x;
        var dy   = pts[i].y - pts[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          var alpha = 0.22 * (1 - dist / maxDist);
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = 'rgba(120,190,255,' + alpha + ')';
          ctx.lineWidth   = 1.1;
          ctx.stroke();
        }
      }
    }
    pts.forEach(function (d) { d.step(); d.draw(); });
    raf = requestAnimationFrame(tick);
  }

  var hero = document.getElementById('hero');
  var obs  = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }
  }, { threshold: 0.05 });
  obs.observe(hero);

  window.addEventListener('resize', function () { resize(); build(); }, { passive: true });
  resize();
  build();
}());

/* ═══════════════════════════════
   HERO BG — Ken Burns + Parallax
   ═══════════════════════════════ */
(function () {
  var heroBg  = document.querySelector('.hero-bg');
  var heroEl  = document.getElementById('hero');
  if (!heroBg || !heroEl) return;

  var startTime = null;
  var KB_DUR    = 24000; /* 24 s full cycle */

  function animBg(ts) {
    if (!startTime) startTime = ts;
    var elapsed  = ts - startTime;

    /* Ken Burns: oscillate scale 1.0 → 1.07 → 1.0 ... */
    var kbPhase  = (elapsed % (KB_DUR * 2)) / KB_DUR;
    if (kbPhase > 1) kbPhase = 2 - kbPhase;
    var scale    = 1.0 + kbPhase * 0.07;

    /* Parallax: slide bg up on scroll */
    var scrollY  = window.scrollY;
    var heroH    = heroEl.offsetHeight;
    var parallax = scrollY < heroH ? scrollY * 0.38 : 0;

    heroBg.style.transform = 'translateY(' + parallax + 'px) scale(' + scale + ')';
    requestAnimationFrame(animBg);
  }

  requestAnimationFrame(animBg);
}());

/* ═══════════════════════════════
   HERO WORD CYCLE
   ═══════════════════════════════ */
(function () {
  var words = ['Infraestructura', 'Hidráulica', 'Construcción', 'Industrial'];
  var idx   = 0;
  var el    = document.getElementById('accentCycle');
  if (!el) return;

  function next() {
    idx = (idx + 1) % words.length;

    /* Exit */
    el.style.transition = 'transform .42s cubic-bezier(.4,0,.2,1), opacity .38s ease';
    el.style.transform  = 'translateY(-32px) scale(.93)';
    el.style.opacity    = '0';

    setTimeout(function () {
      el.textContent      = words[idx];
      el.style.transition = 'none';
      el.style.transform  = 'translateY(32px) scale(.93)';
      el.style.opacity    = '0';
      void el.offsetHeight; /* force reflow */

      /* Enter */
      el.style.transition = 'transform .68s cubic-bezier(.16,1,.3,1), opacity .52s ease';
      el.style.transform  = 'translateY(0) scale(1)';
      el.style.opacity    = '1';
    }, 410);
  }

  /* Wait for entrance animations to finish before cycling */
  setTimeout(function () { setInterval(next, 3400); }, 4400);
}());

/* ═══════════════════════════════
   HERO TEXT PARALLAX (scroll depth)
   ═══════════════════════════════ */
(function () {
  if (window.innerWidth < 768) return; /* skip on mobile */
  var heroBody = document.querySelector('.hero-body .wrap');
  var heroEl   = document.getElementById('hero');
  if (!heroBody || !heroEl) return;

  window.addEventListener('scroll', function () {
    var s = window.scrollY;
    var h = heroEl.offsetHeight;
    if (s < h) {
      heroBody.style.transform = 'translateY(' + (s * 0.14) + 'px)';
      heroBody.style.opacity   = '' + Math.max(0, 1 - s / h * 1.5);
    }
  }, { passive: true });
}());

/* ═══════════════════════════════
   SCROLL REVEAL
   ═══════════════════════════════ */
(function () {
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); }
    });
  }, { threshold: 0.10, rootMargin: '0px 0px -44px 0px' });
  document.querySelectorAll('.rev').forEach(function (el) { obs.observe(el); });
}());

/* ═══════════════════════════════
   COUNTER ANIMATION
   ═══════════════════════════════ */
(function () {
  var done = new WeakSet();
  var obs  = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !done.has(e.target)) {
        done.add(e.target);
        var el      = e.target;
        var target  = parseInt(el.dataset.count, 10);
        var suffix  = el.dataset.suffix  || '';
        var prefix  = el.dataset.prefix  || '';
        var dur     = 1700;
        var start   = null;
        requestAnimationFrame(function step (ts) {
          if (!start) start = ts;
          var p    = Math.min((ts - start) / dur, 1);
          var ease = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(ease * target) + suffix;
          if (p < 1) requestAnimationFrame(step);
        });
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(function (el) { obs.observe(el); });
}());

/* ═══════════════════════════════
   FORM → WHATSAPP
   ═══════════════════════════════ */
document.getElementById('cForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var nombre  = this.querySelector('#fn').value.trim();
  var tel     = this.querySelector('#ft').value.trim();
  var tipo    = this.querySelector('#fs').value;
  var mensaje = this.querySelector('#fm').value.trim();
  var empresa = this.querySelector('#fe').value.trim();
  var email   = this.querySelector('#fem').value.trim();

  if (!nombre || !tel || !tipo || !mensaje) {
    this.querySelector('#fn').focus();
    return;
  }

  var txt = '*Solicitud de Cotización — PAV Suministros*\n\n';
  txt += '• Nombre: '    + nombre  + '\n';
  if (empresa) txt += '• Empresa: ' + empresa + '\n';
  txt += '• Teléfono: '  + tel     + '\n';
  if (email)   txt += '• Correo: '  + email   + '\n';
  txt += '• Tipo de proyecto: ' + tipo    + '\n';
  txt += '• Descripción: '      + mensaje;

  window.open('https://wa.me/525561431877?text=' + encodeURIComponent(txt), '_blank');
});

/* ═══════════════════════════════
   HERO STATS COUNTER
   ═══════════════════════════════ */
(function () {
  var els = document.querySelectorAll('[data-hero-count]');
  if (!els.length) return;

  function animCount(el) {
    var target = parseInt(el.dataset.heroCount, 10);
    var prefix = el.dataset.prefix || '';
    var suffix = el.dataset.suffix || '';
    var dur    = 2200;
    var start  = null;
    requestAnimationFrame(function step(ts) {
      if (!start) start = ts;
      var p    = Math.min((ts - start) / dur, 1);
      var ease = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(ease * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    });
  }

  /* delay until after hero stats animate into view (~1.9s) */
  setTimeout(function () {
    els.forEach(function (el) { animCount(el); });
  }, 2100);
}());

/* ═══════════════════════════════
   SMOOTH SCROLL
   ═══════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 74;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - navH,
      behavior: 'smooth'
    });
  });
});
