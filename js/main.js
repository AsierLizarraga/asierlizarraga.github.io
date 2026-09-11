(() => {
  'use strict';

  const EMBED_PARAMS = [
    ':embed=y', ':showVizHome=no', ':display_count=n', ':tabs=n',
    ':toolbar=yes', ':device=desktop', ':language=es-ES'
  ].join('&');

  const embedUrl = (workbook, sheet) =>
    `https://public.tableau.com/views/${workbook}/${sheet}?${EMBED_PARAMS}`;
  const publicUrl = (profile, workbook, sheet) =>
    `https://public.tableau.com/app/profile/${profile}/viz/${workbook}/${sheet}`;

  /* ---------- Cabecera y navegación ---------- */
  const header = document.querySelector('[data-header]');
  const navToggle = document.querySelector('[data-nav-toggle]');

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };
  navToggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
  document.querySelectorAll('.site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Resalta en el menú la sección visible
  const navLinks = new Map(
    [...document.querySelectorAll('.site-nav a')].map((a) => [a.getAttribute('href').slice(1), a])
  );
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a, id) => {
        if (id === entry.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section[id]').forEach((section) => spy.observe(section));

  /* ---------- Cuadros de mando de Tableau ---------- */
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;

  document.querySelectorAll('.viz').forEach(initViz);

  function initViz(viz, index) {
    const tabs = [...viz.querySelectorAll('[role="tab"]')];
    const frame = viz.querySelector('iframe');
    const screen = viz.querySelector('.viz__screen');
    const stage = viz.querySelector('.viz__stage');
    const desc = viz.querySelector('.viz__desc');
    const openLink = viz.querySelector('[data-open]');
    const zoomButtons = [...viz.querySelectorAll('[data-zoom]')];
    const fsButton = viz.querySelector('[data-fullscreen]');
    const exitButton = viz.querySelector('[data-exit]');
    const width = Number(viz.dataset.w);
    const height = Number(viz.dataset.h);
    let fallbackTimer;

    viz.dataset.zoom = 'fit';

    // Relación accesible entre pestañas y el panel del cuadro de mando
    screen.id = `viz-panel-${index + 1}`;
    screen.setAttribute('role', 'tabpanel');
    tabs.forEach((tab, i) => {
      tab.id = `${screen.id}-tab-${i + 1}`;
      tab.setAttribute('aria-controls', screen.id);
    });
    const initialTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    screen.setAttribute('aria-labelledby', initialTab.id);

    // El iframe de Tableau tiene un tamaño fijo: se escala para que quepa en el ancho disponible.
    function fit() {
      const fullscreen = fsElement() === screen;
      let scale;
      if (fullscreen) scale = Math.min(screen.clientWidth / width, screen.clientHeight / height);
      else if (viz.dataset.zoom === 'real') scale = 1;
      else scale = Math.min(1, screen.clientWidth / width);

      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.style.transform = scale === 1 ? '' : `scale(${scale})`;
      stage.style.width = `${Math.floor(width * scale)}px`;
      stage.style.height = `${Math.floor(height * scale)}px`;
    }
    new ResizeObserver(fit).observe(screen);
    fit();

    // Capa de carga
    const loaded = () => { clearTimeout(fallbackTimer); viz.classList.add('is-loaded'); };
    const loading = () => {
      viz.classList.remove('is-loaded');
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(loaded, 15000);
    };
    frame.addEventListener('load', loaded);
    new IntersectionObserver((entries, obs) => {
      if (entries.some((e) => e.isIntersecting)) {
        if (!viz.classList.contains('is-loaded')) fallbackTimer = setTimeout(loaded, 15000);
        obs.disconnect();
      }
    }, { rootMargin: '200px' }).observe(viz);

    // Pestañas
    function select(tab, { focus = false } = {}) {
      tabs.forEach((t) => {
        const active = t === tab;
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
      });
      if (focus) tab.focus();
      screen.setAttribute('aria-labelledby', tab.id);

      const workbook = tab.dataset.workbook || viz.dataset.workbook;
      const sheet = tab.dataset.sheet;
      desc.textContent = tab.dataset.desc || '';
      openLink.href = publicUrl(viz.dataset.profile, workbook, sheet);
      frame.title = `Cuadro de mando de Tableau: ${tab.textContent.trim()} — ${viz.dataset.title}`;

      const src = embedUrl(workbook, sheet);
      if (frame.getAttribute('src') !== src) {
        loading();
        frame.src = src;
      }
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select(tabs[(keys[e.key] + tabs.length) % tabs.length], { focus: true });
      });
    });

    // Zoom: ajustar al ancho o tamaño real
    zoomButtons.forEach((btn) => btn.addEventListener('click', () => {
      viz.dataset.zoom = btn.dataset.zoom;
      zoomButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      fit();
    }));

    // Pantalla completa
    if (!fsEnabled) {
      fsButton.hidden = true;
    } else {
      fsButton.addEventListener('click', () => {
        const request = screen.requestFullscreen || screen.webkitRequestFullscreen;
        const result = request.call(screen);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      });
      exitButton.addEventListener('click', () => {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        exit.call(document);
      });
      const onFsChange = () => {
        exitButton.hidden = fsElement() !== screen;
        fit();
      };
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
    }
  }

  /* ---------- Vídeos (YouTube en ventana modal) ---------- */
  const modal = document.getElementById('video-modal');
  const modalFrame = modal.querySelector('iframe');
  const modalTitle = modal.querySelector('.modal__title');
  const modalYouTube = modal.querySelector('[data-modal-yt]');

  if (typeof modal.showModal === 'function') {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-video]');
      if (!trigger) return;
      e.preventDefault();
      const id = trigger.dataset.video;
      const start = Number(trigger.dataset.videoStart) || 0;
      const title = trigger.dataset.videoTitle || 'Vídeo';
      modalTitle.textContent = title;
      modalYouTube.href = trigger.href || `https://www.youtube.com/watch?v=${id}`;
      modalFrame.title = `Vídeo de YouTube: ${title}`;
      modalFrame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${start ? `&start=${start}` : ''}`;
      modal.showModal();
    });
    modal.querySelector('[data-modal-close]').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
    modal.addEventListener('close', () => { modalFrame.src = 'about:blank'; });
  }

  /* ---------- Botones de copiar (email, código de referido) ---------- */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Alternativa para navegadores o contextos sin acceso a la API del portapapeles
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.append(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]');
    const icon = btn.querySelector('use');
    const original = label.textContent;
    let resetTimer;
    btn.addEventListener('click', async () => {
      clearTimeout(resetTimer);
      if (await copyText(btn.dataset.copy)) {
        label.textContent = 'Copiado';
        icon.setAttribute('href', '#i-check');
        btn.classList.add('is-copied');
      } else {
        label.textContent = 'No se pudo copiar';
      }
      resetTimer = setTimeout(() => {
        label.textContent = original;
        icon.setAttribute('href', '#i-copy');
        btn.classList.remove('is-copied');
      }, 2000);
    });
  });

  /* ---------- Año del pie ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
