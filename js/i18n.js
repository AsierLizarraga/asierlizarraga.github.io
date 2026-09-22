/* Selección de idioma (castellano, inglés y euskera).
   El castellano es el que está escrito en index.html: al cargar se guarda una
   copia del contenido original y las otras lenguas se aplican encima.
   Cada texto traducible lleva data-i18n="clave" (contenido) o
   data-i18n-attrs="atributo=clave|atributo=clave" (atributos). */
(() => {
  'use strict';

  const DICT = window.I18N;
  if (!DICT) return;

  const LANGS = DICT.langs;
  const STORE_KEY = 'idioma';

  /* ---------- Elementos traducibles ---------- */
  const nodes = [...document.querySelectorAll('[data-i18n]')];
  const attrNodes = [...document.querySelectorAll('[data-i18n-attrs]')].map((el) => [
    el,
    el.dataset.i18nAttrs.split('|').map((pair) => {
      const i = pair.indexOf('=');
      return [pair.slice(0, i), pair.slice(i + 1)];
    })
  ]);

  // Copia del castellano original
  const base = new Map();
  nodes.forEach((el) => {
    const key = el.dataset.i18n;
    if (!base.has(key)) base.set(key, el.innerHTML);
  });
  attrNodes.forEach(([el, pairs]) => pairs.forEach(([attr, key]) => {
    if (!base.has(key)) base.set(key, el.getAttribute(attr) || '');
  }));

  const meta = (selector) => document.querySelector(selector);
  const metaDesc = meta('meta[name="description"]');
  const metaTitles = [meta('meta[property="og:title"]'), meta('meta[name="twitter:title"]')];
  const metaDescs = [meta('meta[property="og:description"]'), meta('meta[name="twitter:description"]')];
  const metaLocale = meta('meta[property="og:locale"]');

  base.set('meta.title', document.title);
  if (metaDesc) base.set('meta.desc', metaDesc.content);
  if (metaDescs[0]) base.set('meta.social', metaDescs[0].content);

  /* ---------- Idioma activo ---------- */
  const supported = (code) => LANGS.includes(code);

  const stored = (value) => {
    try {
      if (value === undefined) return localStorage.getItem(STORE_KEY);
      localStorage.setItem(STORE_KEY, value);
    } catch { /* navegación privada o almacenamiento bloqueado */ }
    return null;
  };

  const detect = () => {
    const asked = new URLSearchParams(location.search).get('lang');
    if (asked && supported(asked)) {
      stored(asked);
      return asked;
    }
    const saved = stored();
    if (saved && supported(saved)) return saved;
    for (const tag of navigator.languages || [navigator.language || '']) {
      const code = String(tag).toLowerCase().slice(0, 2);
      if (supported(code)) return code;
    }
    return LANGS[0];
  };

  let lang = detect();

  const t = (key, vars) => {
    const dict = DICT[lang] || {};
    let text = key in dict ? dict[key] : base.get(key);
    if (text == null) return key;
    if (vars) text = text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
    return text;
  };

  /* ---------- Aplicar ---------- */
  function apply() {
    nodes.forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    attrNodes.forEach(([el, pairs]) => pairs.forEach(([attr, key]) => el.setAttribute(attr, t(key))));

    document.documentElement.lang = DICT.htmlLang[lang];
    document.title = t('meta.title');
    if (metaDesc) metaDesc.content = t('meta.desc');
    metaTitles.forEach((m) => { if (m) m.content = t('meta.title'); });
    metaDescs.forEach((m) => { if (m) m.content = t('meta.social'); });
    if (metaLocale) metaLocale.content = DICT.ogLocale[lang];

    code.textContent = DICT.codes[lang];
    options.forEach((btn) => btn.setAttribute('aria-checked', String(btn.dataset.setLang === lang)));

    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
  }

  function setLang(next) {
    if (!supported(next) || next === lang) return;
    lang = next;
    stored(next);
    // Si alguien llegó con ?lang=, se mantiene el enlace coherente
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', next);
      history.replaceState(null, '', url);
    }
    apply();
  }

  /* ---------- Botón de idioma ---------- */
  const wrap = document.querySelector('[data-lang]');
  const toggle = wrap.querySelector('[data-lang-toggle]');
  const menu = wrap.querySelector('.lang__menu');
  const code = wrap.querySelector('[data-lang-code]');
  const options = [...menu.querySelectorAll('[data-set-lang]')];

  const openMenu = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    wrap.classList.toggle('is-open', open);
    // En móvil los dos desplegables de la cabecera comparten sitio
    if (open) {
      const header = document.querySelector('[data-header]');
      const navToggle = document.querySelector('[data-nav-toggle]');
      if (header) header.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }
  };

  toggle.addEventListener('click', () => {
    const open = menu.hidden;
    openMenu(open);
    if (open) (options.find((b) => b.dataset.setLang === lang) || options[0]).focus();
  });

  options.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.setLang);
      openMenu(false);
      toggle.focus();
    });
    btn.addEventListener('keydown', (e) => {
      const moves = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: options.length - 1 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      options[(moves[e.key] + options.length) % options.length].focus();
    });
  });

  document.addEventListener('click', (e) => {
    if (!menu.hidden && !wrap.contains(e.target)) openMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      openMenu(false);
      toggle.focus();
    }
  });

  window.i18n = {
    get lang() { return lang; },
    set: setLang,
    closeMenu: () => openMenu(false),
    t
  };

  apply();
})();
