/**
 * IngáPet - catálogo dinâmico com carrossel de fotos
 * Os produtos vêm do painel de estoque. Se a API estiver dormindo,
 * o catálogo que já está no HTML continua aparecendo.
 */
const API_BASE = 'https://ingapet-estoque.onrender.com';
const API_URL = API_BASE + '/api/export/site-data';
const WHATSAPP = '5544998810928';
const CACHE_KEY = 'ingapet_catalogo_v2';
const API_TIMEOUT = 12000;

/* ---------------- utilidades ---------------- */

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fixUrl(u) {
  if (!u) return 'images/products/default.jpg';
  if (/^(https?:|data:)/i.test(u)) return u;
  if (u.charAt(0) === '/') return API_BASE + u;
  return u;
}

function waLink(name) {
  return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Tenho interesse no produto: ' + name);
}

/* ---------------- carregamento ---------------- */

async function fetchProducts() {
  const cached = readCache();
  if (cached) renderProducts(cached.products, cached.lastUpdated, true);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
  try {
    const res = await fetch(API_URL, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.products) && data.products.length) {
      renderProducts(data.products, data.lastUpdated, false);
      writeCache(data);
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('IngáPet: catálogo local em uso (API offline ou iniciando).');
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.products) || !obj.products.length) return null;
    if (Date.now() - (obj.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) return null;
    return obj;
  } catch (e) { return null; }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      products: data.products, lastUpdated: data.lastUpdated, savedAt: Date.now()
    }));
  } catch (e) { /* sem espaço, ignora */ }
}

/* ---------------- render ---------------- */

function renderProducts(products, lastUpdated, fromCache) {
  const grid = document.getElementById('products-grid') || document.querySelector('.products-grid');
  if (!grid) return;

  grid.innerHTML = products.map(function (p) {
    const imgs = (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).map(fixUrl);
    const out = p.available === false || (typeof p.stock === 'number' && p.stock <= 0);
    const badge = out
      ? '<span class="product-card__badge product-card__badge--out">Esgotado</span>'
      : (p.badge ? '<span class="product-card__badge">' + esc(p.badge) + '</span>' : '');

    const slides = imgs.map(function (src, i) {
      return '<img src="' + esc(src) + '" alt="' + esc(p.name) + (i ? ' - foto ' + (i + 1) : '') + '"' +
             (i ? ' loading="lazy"' : '') + ' onerror="this.src=\'images/products/default.jpg\'">';
    }).join('');

    const dots = imgs.length > 1
      ? '<div class="carousel__dots">' + imgs.map(function (_, i) {
          return '<button type="button" class="carousel__dot' + (i === 0 ? ' is-active' : '') +
                 '" data-go="' + i + '" aria-label="Foto ' + (i + 1) + '"></button>';
        }).join('') + '</div>'
      : '';

    const arrows = imgs.length > 1
      ? '<button type="button" class="carousel__nav carousel__nav--prev" data-dir="-1" aria-label="Foto anterior">&#8249;</button>' +
        '<button type="button" class="carousel__nav carousel__nav--next" data-dir="1" aria-label="Próxima foto">&#8250;</button>' +
        '<span class="carousel__count">1/' + imgs.length + '</span>'
      : '';

    return '<article class="product-card' + (out ? ' product-card--out' : '') + '">' +
             '<div class="product-card__media">' +
               '<div class="carousel' + (imgs.length > 1 ? '' : ' carousel--single') + '" data-index="0" data-total="' + imgs.length + '">' +
                 '<div class="carousel__track">' + slides + '</div>' + arrows + dots +
               '</div>' + badge +
             '</div>' +
             '<div class="product-card__body">' +
               (p.category ? '<div class="product-card__cat">' + esc(p.category) + '</div>' : '') +
               '<div class="product-card__name">' + esc(p.name) + '</div>' +
               (p.desc ? '<div class="product-card__desc">' + esc(p.desc) + '</div>' : '') +
               '<div class="product-card__price">' + esc(p.price) + '</div>' +
               (p.priceDelivery ? '<div class="product-card__price-alt">Entrega: ' + esc(p.priceDelivery) + '</div>' : '') +
               (out
                 ? '<span class="product-card__cta product-card__cta--off">Esgotado</span>'
                 : '<a class="product-card__cta" href="' + esc(waLink(p.name)) + '" target="_blank" rel="noopener">Pedir</a>') +
             '</div>' +
           '</article>';
  }).join('');

  stampUpdate(lastUpdated, fromCache);
}

function stampUpdate(lastUpdated, fromCache) {
  const footer = document.querySelector('.footer-bottom');
  if (!footer || !lastUpdated) return;
  const old = footer.querySelector('.stock-update-info');
  if (old) old.remove();
  const el = document.createElement('p');
  el.className = 'stock-update-info';
  el.style.fontSize = '0.75rem';
  el.style.marginTop = '0.5rem';
  el.style.opacity = '0.6';
  let txt = '';
  try { txt = new Date(lastUpdated).toLocaleString('pt-BR'); } catch (e) { txt = ''; }
  el.textContent = 'Estoque sincronizado em: ' + txt + (fromCache ? ' (offline)' : '');
  footer.appendChild(el);
}

/* ---------------- carrossel ---------------- */

function slideTo(carousel, index) {
  const track = carousel.querySelector('.carousel__track');
  if (!track) return;
  const total = track.children.length;
  if (!total) return;
  let i = index;
  if (i < 0) i = total - 1;
  if (i >= total) i = 0;
  carousel.dataset.index = String(i);
  track.style.transform = 'translateX(' + (-100 * i) + '%)';
  const dots = carousel.querySelectorAll('.carousel__dot');
  dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
  const count = carousel.querySelector('.carousel__count');
  if (count) count.textContent = (i + 1) + '/' + total;
}

function bindCarousels(root) {
  root.addEventListener('click', function (ev) {
    const nav = ev.target.closest('.carousel__nav');
    if (nav) {
      ev.preventDefault();
      const c = nav.closest('.carousel');
      slideTo(c, parseInt(c.dataset.index || '0', 10) + parseInt(nav.dataset.dir, 10));
      return;
    }
    const dot = ev.target.closest('.carousel__dot');
    if (dot) {
      ev.preventDefault();
      slideTo(dot.closest('.carousel'), parseInt(dot.dataset.go, 10));
      return;
    }
    const img = ev.target.closest('.carousel__track img');
    if (img) {
      ev.preventDefault();
      const c = img.closest('.carousel');
      const list = Array.prototype.map.call(c.querySelectorAll('.carousel__track img'), function (im) { return im.src; });
      openLightbox(list, parseInt(c.dataset.index || '0', 10));
    }
  });

  let startX = 0, startY = 0, active = null, moved = false;
  root.addEventListener('touchstart', function (ev) {
    const c = ev.target.closest('.carousel');
    if (!c || c.classList.contains('carousel--single')) return;
    active = c; moved = false;
    startX = ev.touches[0].clientX;
    startY = ev.touches[0].clientY;
  }, { passive: true });

  root.addEventListener('touchmove', function (ev) {
    if (!active) return;
    const dx = ev.touches[0].clientX - startX;
    const dy = ev.touches[0].clientY - startY;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) moved = true;
  }, { passive: true });

  root.addEventListener('touchend', function (ev) {
    if (!active) return;
    if (moved) {
      const dx = ev.changedTouches[0].clientX - startX;
      const cur = parseInt(active.dataset.index || '0', 10);
      slideTo(active, dx < 0 ? cur + 1 : cur - 1);
    }
    active = null;
  });
}

/* ---------------- lightbox ---------------- */

let lbList = [];
let lbIndex = 0;

function openLightbox(list, index) {
  const box = document.getElementById('lightbox');
  if (!box || !list.length) return;
  lbList = list;
  lbIndex = index || 0;
  box.hidden = false;
  document.body.style.overflow = 'hidden';
  paintLightbox();
}

function paintLightbox() {
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  if (img) img.src = lbList[lbIndex];
  if (counter) counter.textContent = (lbIndex + 1) + ' / ' + lbList.length;
  const show = lbList.length > 1 ? '' : 'none';
  const prev = document.getElementById('lightbox-prev');
  const next = document.getElementById('lightbox-next');
  if (prev) prev.style.display = show;
  if (next) next.style.display = show;
}

function moveLightbox(step) {
  if (!lbList.length) return;
  lbIndex = (lbIndex + step + lbList.length) % lbList.length;
  paintLightbox();
}

function closeLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  box.hidden = true;
  document.body.style.overflow = '';
}

function bindLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const close = document.getElementById('lightbox-close');
  const prev = document.getElementById('lightbox-prev');
  const next = document.getElementById('lightbox-next');
  if (close) close.addEventListener('click', closeLightbox);
  if (prev) prev.addEventListener('click', function () { moveLightbox(-1); });
  if (next) next.addEventListener('click', function () { moveLightbox(1); });
  box.addEventListener('click', function (ev) { if (ev.target === box) closeLightbox(); });
  document.addEventListener('keydown', function (ev) {
    if (box.hidden) return;
    if (ev.key === 'Escape') closeLightbox();
    if (ev.key === 'ArrowLeft') moveLightbox(-1);
    if (ev.key === 'ArrowRight') moveLightbox(1);
  });
}

/* ---------------- start ---------------- */

function start() {
  const grid = document.getElementById('products-grid') || document.querySelector('.products-grid');
  if (grid) bindCarousels(grid);
  bindLightbox();
  fetchProducts();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
