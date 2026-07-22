const API_URL = "https://ingapet-estoque.onrender.com/api/export/site-data";
const FALLBACK_TIMEOUT = 5000;

async function fetchProducts() {
    const footerBottom = document.querySelector('.footer-bottom');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT);

    try {
        const response = await fetch(API_URL, { signal: controller.signal });
        const data = await response.json();
        clearTimeout(timeoutId);

        if (data.success && data.products && data.products.length > 0) {
            renderProducts(data.products);
            if (footerBottom) {
                const date = new Date(data.lastUpdated).toLocaleString('pt-BR');
                const updateInfo = document.createElement('p');
                updateInfo.style.fontSize = '0.75rem';
                updateInfo.style.marginTop = '0.5rem';
                const updateInfo.style.opacity = '0.6';
                updateInfo.className = 'stock-update-info';
                updateInfo.innerText = `Estoque sincronizado em: ${date}`;
                
                const existingInfo = footerBottom.querySelector('.stock-update-info');
                if (existingInfo) existingInfo.remove();
                footerBottom.appendChild(updateInfo);
            }
        }
    } catch (err) {
        console.warn("IngaPet: Usando catálogo local (API offline ou em standby)");
    }
}

function renderProducts(products) {
    const grid = document.querySelector('.products-grid');
    if (!grid) return;

    grid.innerHTML = products.map(p => {
        const isOutOfStock = !p.available || p.stock <= 0;
        const badge = isOutOfStock 
            ? '<span class="product-card__badge" style="background:#666;">Esgotado</span>' 
            : (p.badge ? `<span class="product-card__badge">${p.badge}</span>` : '');
        
        const waLink = `https://wa.me/5544998810928?text=Olá! Tenho interesse no produto: ${p.name}`;
        
        return `
            <a href="${isOutOfStock ? '#' : waLink}" class="product-card ${isOutOfStock ? 'product-card--out' : ''}" style="${isOutOfStock ? 'opacity:0.7; grayscale:1;' : ''}">
                <div class="product-card__media">
                    <img src="${p.image.startsWith('data:') ? p.image : 'https://ingapet-estoque.onrender.com' + (p.image.startsWith('/') ? '' : '/') + p.image}" alt="${p.name}" loading="lazy" onerror="this.src='images/products/default.jpg'">
                    ${badge}
                </div>
                <div class="product-card__body">
                    <h3 class="product-card__title">${p.name}</h3>
                    <p class="product-card__desc">${p.desc || ''}</p>
                    <div class="product-card__price">${p.price}</div>
                    <span class="product-card__cta" style="${isOutOfStock ? 'background:#999; border-color:#999;' : ''}">${isOutOfStock ? 'Esgotado' : 'Pedir'}</span>
                </div>
            </a>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', fetchProducts);
