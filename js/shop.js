/* ═══════════════════════════════════════════
   Shop Module — BulletFarm Shop
   Product display, cart, checkout
   ═══════════════════════════════════════════ */

/* ═══ State ═══ */
let categories = [];
let products = [];
let cart = JSON.parse(localStorage.getItem('bf_cart') || '[]');

window.__shopSettings = {};

/* ═══ Cart ═══ */
function saveCart() {
    localStorage.setItem('bf_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const el = document.getElementById('cartCount');
    if (el) {
        const count = cart.reduce((s, x) => s + (x.qty || 0), 0);
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
    }
}

function addToCart(productId, variantName = 'Standard', variantMultiplier = 1) {
    const key = productId + '||' + variantName + '||' + variantMultiplier;

    // Check stock
    const remaining = getRemainingStock(productId);
    if (remaining !== null && remaining <= 0) {
        showToast('Ausverkauft', 'Nicht mehr verfügbar', { type: 'error' });
        return;
    }

    const existing = cart.find(x => x.key === key);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ key, productId, variantName, variantMultiplier, qty: 1 });
    }

    saveCart();

    const p = products.find(x => x.id === productId);
    const label = p ? p.name : 'Produkt';
    const v = variantName !== 'Standard' ? ` • ${variantName}` : '';
    showToast('✅ Hinzugefügt', `${label}${v}`, { type: 'success', duration: 1800 });
}

function removeFromCart(key) {
    cart = cart.filter(x => x.key !== key);
    saveCart();
    renderCart();
}

function changeQty(key, delta) {
    const item = cart.find(x => x.key === key);
    if (!item) return;

    if (delta > 0) {
        const remaining = getRemainingStock(item.productId);
        if (remaining !== null && remaining <= 0) {
            showToast('Bestand', 'Nicht mehr verfügbar', { type: 'error' });
            return;
        }
    }

    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) {
        cart = cart.filter(x => x.key !== key);
    }
    saveCart();
    renderCart();
}

function clearCart() {
    cart = [];
    saveCart();
    renderCart();
}

function getRemainingStock(productId) {
    const p = products.find(x => String(x.id) === String(productId));
    if (!p) return null;
    if (p.stock === null || p.stock === undefined) return null;
    const inCart = cart.filter(it => String(it.productId) === String(productId)).reduce((s, it) => s + it.qty, 0);
    return Math.max(0, p.stock - inCart);
}

/* ═══ Data Loading ═══ */
async function loadShopData() {
    const sb = getSupabase();
    if (!sb) return;

    try {
        // Load settings
        const settingsRes = await sb.from('shop_settings').select('data').eq('id', 1).maybeSingle();
        window.__shopSettings = settingsRes.data?.data || {};

        // Apply theme
        applyTheme(window.__shopSettings);

        // Load categories
        const catRes = await sb.from('categories').select('*').order('created_at', { ascending: true });
        categories = catRes.data || [];

        // Load products
        const prodRes = await sb.from('products').select('*').order('sort_order', { ascending: true });
        products = prodRes.data || [];

        // Render
        renderFilters();
        renderProducts();
        updateCartCount();
    } catch (err) {
        console.error('Data load failed:', err);
        showToast('Fehler', 'Daten konnten nicht geladen werden', { type: 'error' });
    }
}

function applyTheme(settings) {
    const root = document.documentElement.style;
    const c = settings.colors || {};

    if (settings.title) {
        const el = document.getElementById('brandName');
        if (el) el.textContent = settings.title;
    }
    if (settings.subtitle) {
        const el = document.getElementById('brandSub');
        if (el) el.textContent = settings.subtitle;
    }

    if (c.bg) root.setProperty('--bg', c.bg);
    if (c.surface) root.setProperty('--surface', c.surface);
    if (c.text) root.setProperty('--text', c.text);
    if (c.primary) root.setProperty('--primary', c.primary);
    if (c.success) root.setProperty('--success', c.success);
    if (c.danger) root.setProperty('--danger', c.danger);
}

/* ═══ Filters ═══ */
function renderFilters() {
    const catFilter = document.getElementById('catFilter');
    const searchInput = document.getElementById('searchInput');

    if (catFilter) {
        catFilter.innerHTML = `<option value="all">Alle Kategorien</option>`;
        categories.forEach(c => {
            catFilter.innerHTML += `<option value="${c.id}">${escapeHtml(c.icon || '📦')} ${escapeHtml(c.name)}</option>`;
        });
        catFilter.onchange = renderProducts;
    }

    if (searchInput) {
        searchInput.oninput = renderProducts;
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.onchange = renderProducts;
    }
}

/* ═══ Product Rendering ═══ */
function getProductVariants(p) {
    const v = p?.variants;
    if (Array.isArray(v) && v.length) {
        return v.map(x => ({
            name: String(x.name || 'Standard').trim(),
            multiplier: Number(x.multiplier || 1) || 1
        }));
    }
    return [{ name: 'Standard', multiplier: 1 }];
}

function getCategoryName(catId) {
    const c = categories.find(x => String(x.id) === String(catId));
    return c ? c.name : null;
}

function getCategoryColor(catId) {
    const c = categories.find(x => String(x.id) === String(catId));
    return c?.color || '#94a3b8';
}

function getCategoryIcon(catId) {
    const c = categories.find(x => String(x.id) === String(catId));
    return c?.icon || '📦';
}

function renderBadges(badges) {
    if (!Array.isArray(badges) || !badges.length) return '';
    const badgeMap = {
        popular: { label: '🔥 Beliebt', cls: 'b-popular' },
        premium: { label: '💎 Premium', cls: 'b-premium' },
        sale: { label: '💸 Sale', cls: 'b-sale' },
        new: { label: '✨ Neu', cls: 'b-new' },
        bundle: { label: '🧩 Bundle', cls: 'b-bundle' }
    };

    return badges.map(key => {
        const b = badgeMap[key];
        if (!b) return '';
        return `<span class="product-badge ${b.cls}">${b.label}</span>`;
    }).join('');
}

function renderResourceChips(resources) {
    if (!Array.isArray(resources) || !resources.length) return '';
    return resources.map(r => `
    <span class="resource-chip">
      <span class="resource-dot" style="background:${r.color || '#60a5fa'}"></span>
      ${escapeHtml(r.name)}: <strong>${formatNum(r.amount)}</strong>
    </span>
  `).join('');
}

function getProductPrice(p) {
    const res = Array.isArray(p.resources) ? p.resources : [];
    const dc = res.find(r => String(r.name || '').toLowerCase().includes('deadcoin'));
    return dc ? (Number(dc.amount) || 0) : 0;
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    const catFilter = document.getElementById('catFilter')?.value || 'all';
    const search = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const sort = document.getElementById('sortSelect')?.value || 'default';

    let filtered = products.filter(p => p.status !== 'disabled');

    if (catFilter !== 'all') {
        filtered = filtered.filter(p => String(p.category_id) === catFilter);
    }
    if (search) {
        filtered = filtered.filter(p => String(p.name || '').toLowerCase().includes(search));
    }

    // Sort
    if (sort === 'price_asc') filtered.sort((a, b) => getProductPrice(a) - getProductPrice(b));
    else if (sort === 'price_desc') filtered.sort((a, b) => getProductPrice(b) - getProductPrice(a));
    else if (sort === 'newest') filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    else if (sort === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));

    if (filtered.length === 0) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">Keine Produkte gefunden</div>
      </div>
    `;
        return;
    }

    grid.innerHTML = filtered.map((p, index) => {
        const badges = Array.isArray(p.badges) ? [...p.badges] : [];
        if (p.is_bundle) badges.unshift('bundle');

        const variants = getProductVariants(p);
        const catName = getCategoryName(p.category_id);
        const catColor = getCategoryColor(p.category_id);
        const catIcon = getCategoryIcon(p.category_id);
        const stock = p.stock;
        const isOutOfStock = stock !== null && stock !== undefined && stock <= 0;
        const isComing = p.status === 'coming_soon';

        const variantSelect = variants.length > 1 ? `
      <select class="select" style="font-size:0.78rem; padding:7px 12px; margin-top:4px" data-variant-for="${p.id}">
        ${variants.map((v, i) => `<option value="${i}" data-name="${escapeHtml(v.name)}" data-mult="${v.multiplier}">${escapeHtml(v.name)}${v.multiplier !== 1 ? ` (×${v.multiplier})` : ''}</option>`).join('')}
      </select>
    ` : '';

        const statusChip = isComing ? '<span class="status-chip s-coming-soon">🕒 Bald</span>' : '';

        const stockLabel = (stock !== null && stock !== undefined)
            ? (stock <= 0
                ? '<span class="stock-label out-of-stock">Ausverkauft</span>'
                : `<span class="stock-label">Bestand: ${stock}</span>`)
            : '';

        return `
      <div class="product-card fade-in" style="animation-delay:${index * 0.04}s" data-product-id="${p.id}">
        ${p.image_url ? `
          <div class="product-image-wrap">
            <div class="badge-stack">${renderBadges(badges)}</div>
            <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'product-no-image\\'>📦</div>'">
          </div>
        ` : `
          <div class="product-image-wrap">
            <div class="badge-stack">${renderBadges(badges)}</div>
            <div class="product-no-image">📦</div>
          </div>
        `}
        <div class="product-info">
          <div class="product-name">${escapeHtml(p.name)} ${statusChip}</div>
          ${catName ? `
            <span class="product-category" style="--cat-color:${catColor}">
              <span class="cat-dot"></span>
              ${catIcon} ${escapeHtml(catName)}
            </span>
          ` : ''}
          <div class="resource-chips">${renderResourceChips(p.resources)}</div>
          ${stockLabel}
          ${variantSelect}
        </div>
        <div class="product-actions">
          <button class="btn btn-primary btn-full" onclick="handleAddToCart('${p.id}', this)" ${isOutOfStock || isComing ? 'disabled' : ''}>
            ${isOutOfStock ? '❌ Ausverkauft' : isComing ? '🕒 Bald verfügbar' : '🛒 In den Warenkorb'}
          </button>
        </div>
      </div>
    `;
    }).join('');
}

function handleAddToCart(productId, btnEl) {
    if (btnEl && btnEl.disabled) return;

    const card = btnEl?.closest('.product-card');
    const variantSel = card?.querySelector(`[data-variant-for="${productId}"]`);

    let vName = 'Standard';
    let vMult = 1;

    if (variantSel && variantSel.selectedOptions[0]) {
        vName = variantSel.selectedOptions[0].dataset.name || 'Standard';
        vMult = Number(variantSel.selectedOptions[0].dataset.mult) || 1;
    }

    // Button feedback
    if (btnEl) {
        const oldText = btnEl.textContent;
        btnEl.disabled = true;
        btnEl.textContent = '✅ Hinzugefügt';
        setTimeout(() => {
            btnEl.disabled = false;
            btnEl.textContent = oldText;
        }, 600);
    }

    addToCart(productId, vName, vMult);
}

/* ═══ Cart Panel ═══ */
function openCart() {
    document.getElementById('cartPanel')?.classList.add('open');
    document.getElementById('cartOverlay')?.classList.add('open');
    renderCart();
}

function closeCart() {
    document.getElementById('cartPanel')?.classList.remove('open');
    document.getElementById('cartOverlay')?.classList.remove('open');
}

function renderCart() {
    const body = document.getElementById('cartBody');
    const footer = document.getElementById('cartFooter');
    if (!body || !footer) return;

    updateCartCount();

    if (cart.length === 0) {
        body.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <div class="empty-state-text">Dein Warenkorb ist leer</div>
      </div>
    `;
        footer.innerHTML = '';
        return;
    }

    // Render items
    const totals = new Map();
    body.innerHTML = cart.map(item => {
        const p = products.find(x => x.id === item.productId);
        const name = p ? p.name : 'Unbekanntes Produkt';
        const img = p?.image_url || '';
        const variant = item.variantName !== 'Standard' ? item.variantName : '';

        // Calculate totals
        if (p && p.resources) {
            for (const r of p.resources) {
                const rName = String(r.name || '').trim();
                if (!rName) continue;
                const amount = (Number(r.amount) || 0) * item.qty * (item.variantMultiplier || 1);
                const prev = totals.get(rName) || { amount: 0, color: r.color || '#60a5fa' };
                prev.amount += amount;
                totals.set(rName, prev);
            }
        }

        return `
      <div class="cart-item">
        ${img ? `<img class="cart-item-img" src="${escapeHtml(img)}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(name)}</div>
          ${variant ? `<div class="cart-item-variant">${escapeHtml(variant)} (×${item.variantMultiplier || 1})</div>` : ''}
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="changeQty('${escapeHtml(item.key)}',-1)">−</button>
            <span class="qty-display">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${escapeHtml(item.key)}',1)">+</button>
            <button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="removeFromCart('${escapeHtml(item.key)}')">✕</button>
          </div>
        </div>
      </div>
    `;
    }).join('');

    // Summary + Checkout
    const summaryChips = Array.from(totals.entries()).map(([name, v]) => `
    <span class="resource-chip">
      <span class="resource-dot" style="background:${v.color}"></span>
      ${escapeHtml(name)}: <strong>${formatNum(v.amount)}</strong>
    </span>
  `).join('');

    footer.innerHTML = `
    <div class="cart-summary">
      <div class="cart-summary-title">💰 Ressourcen Gesamt</div>
      <div class="resource-chips" style="gap:8px">${summaryChips || '<span class="text-muted">—</span>'}</div>
    </div>
    <div class="checkout-form">
      <input class="input" id="custName" placeholder="Dein Name" value="${escapeHtml(localStorage.getItem('bf_cust_name') || '')}">
      <input class="input" id="custContact" placeholder="Discord-Name oder Telefon" value="${escapeHtml(localStorage.getItem('bf_cust_contact') || '')}">
      <button class="btn btn-success btn-full btn-lg" onclick="handleCheckout()">
        ✅ Bestellung absenden
      </button>
      <button class="btn btn-danger btn-sm" onclick="clearCart()" style="width:100%">🗑️ Warenkorb leeren</button>
    </div>
  `;
}

/* ═══ Checkout ═══ */
async function handleCheckout() {
    if (cart.length === 0) {
        showToast('Fehler', 'Warenkorb ist leer', { type: 'error' });
        return;
    }

    const sb = getSupabase();
    if (!sb) {
        showToast('Fehler', 'Verbindung nicht bereit', { type: 'error' });
        return;
    }

    const name = (document.getElementById('custName')?.value || '').trim();
    const contact = (document.getElementById('custContact')?.value || '').trim();

    // Save customer info for next time
    localStorage.setItem('bf_cust_name', name);
    localStorage.setItem('bf_cust_contact', contact);

    const items = cart.map(ci => {
        const p = products.find(x => x.id === ci.productId);
        return {
            productId: ci.productId,
            name: p?.name || 'Unbekannt',
            qty: ci.qty,
            variantName: ci.variantName || 'Standard',
            variantMultiplier: Number(ci.variantMultiplier || 1),
            resources: p?.resources || []
        };
    });

    // Check stock for all items
    for (const item of items) {
        const p = products.find(x => x.id === item.productId);
        if (p && p.stock !== null && p.stock !== undefined) {
            const inCart = cart
                .filter(ci => ci.productId === item.productId)
                .reduce((s, ci) => s + ci.qty, 0);
            if (inCart > p.stock) {
                showToast('Bestand', `${item.name}: nur ${p.stock} verfügbar`, { type: 'error' });
                return;
            }
        }
    }

    try {
        // Create order
        const orderData = {
            status: 'Offen',
            customer: { name, phone: contact, discord: contact },
            items
        };

        const { data: order, error } = await sb
            .from('orders')
            .insert(orderData)
            .select('id')
            .maybeSingle();

        if (error) throw error;

        // Update stock
        for (const item of items) {
            const p = products.find(x => x.id === item.productId);
            if (p && p.stock !== null && p.stock !== undefined) {
                const newStock = Math.max(0, p.stock - item.qty);
                await sb.from('products').update({ stock: newStock }).eq('id', p.id);
                p.stock = newStock;
            }
        }

        // Send to Discord
        const fullOrder = { ...orderData, id: order?.id };
        const msgId = await sendOrderToDiscord(fullOrder);

        // Save Discord message ID for future edits
        if (msgId && order?.id) {
            await sb.from('orders').update({ discord_message_id: msgId }).eq('id', order.id);
        }

        // Clear cart + refresh
        cart = [];
        saveCart();
        renderCart();
        renderProducts();
        closeCart();

        showToast('🎉 Bestellung aufgegeben!', 'Deine Bestellung wurde gespeichert.', { type: 'success', duration: 4000 });
    } catch (err) {
        console.error('Checkout failed:', err);
        showToast('Fehler', 'Bestellung fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler'), { type: 'error' });
    }
}

/* ═══ Product Detail Modal ═══ */
function openProductDetail(productId) {
    const p = products.find(x => String(x.id) === String(productId));
    if (!p) return;

    const overlay = document.getElementById('productModal');
    const body = document.getElementById('productModalBody');
    if (!overlay || !body) return;

    const variants = getProductVariants(p);
    const badges = Array.isArray(p.badges) ? [...p.badges] : [];
    if (p.is_bundle) badges.unshift('bundle');
    const catName = getCategoryName(p.category_id);
    const catColor = getCategoryColor(p.category_id);
    const catIcon = getCategoryIcon(p.category_id);

    // Bundle items
    let bundleHtml = '';
    if (p.is_bundle && Array.isArray(p.bundle_items) && p.bundle_items.length) {
        const bundleProducts = p.bundle_items
            .map(id => products.find(x => String(x.id) === String(id)))
            .filter(Boolean);
        bundleHtml = `
      <div style="border:1px solid var(--glass-border); border-radius:var(--radius); padding:var(--space-md); margin-top:var(--space-md); background:rgba(167,139,250,0.04)">
        <div class="fw-800 mb-sm">🧩 Bundle enthält ${bundleProducts.length} Produkte</div>
        ${bundleProducts.map(bp => `
          <div class="flex items-center gap-sm" style="padding:6px 0; border-bottom:1px solid var(--glass-border)">
            <span>📦</span>
            <span>${escapeHtml(bp.name)}</span>
          </div>
        `).join('')}
      </div>
    `;
    }

    body.innerHTML = `
    ${p.image_url ? `
      <div style="border-radius:var(--radius); overflow:hidden; margin-bottom:var(--space-md)">
        <img src="${escapeHtml(p.image_url)}" alt="" style="width:100%; max-height:300px; object-fit:cover">
      </div>
    ` : ''}
    <div class="badge-stack" style="position:relative; margin-bottom:var(--space-sm)">${renderBadges(badges)}</div>
    <h2 style="margin-bottom:var(--space-sm)">${escapeHtml(p.name)}</h2>
    ${catName ? `
      <span class="product-category mb-sm" style="--cat-color:${catColor}">
        <span class="cat-dot"></span>
        ${catIcon} ${escapeHtml(catName)}
      </span>
    ` : ''}
    ${p.description ? `<p class="text-muted mt-md" style="white-space:pre-wrap; line-height:1.6; font-size:0.88rem">${escapeHtml(p.description)}</p>` : ''}
    ${bundleHtml}
    <div class="resource-chips mt-md">${renderResourceChips(p.resources)}</div>
    ${variants.length > 1 ? `
      <select class="select mt-md" id="modalVariantSelect">
        ${variants.map((v, i) => `<option value="${i}" data-name="${escapeHtml(v.name)}" data-mult="${v.multiplier}">${escapeHtml(v.name)}${v.multiplier !== 1 ? ` (×${v.multiplier})` : ''}</option>`).join('')}
      </select>
    ` : ''}
    <button class="btn btn-primary btn-full btn-lg mt-md" id="modalAddBtn" ${p.status !== 'active' || (p.stock !== null && p.stock !== undefined && p.stock <= 0) ? 'disabled' : ''}>
      🛒 In den Warenkorb
    </button>
  `;

    // Add to cart from modal
    document.getElementById('modalAddBtn').onclick = () => {
        const sel = document.getElementById('modalVariantSelect');
        let vName = 'Standard', vMult = 1;
        if (sel && sel.selectedOptions[0]) {
            vName = sel.selectedOptions[0].dataset.name || 'Standard';
            vMult = Number(sel.selectedOptions[0].dataset.mult) || 1;
        } else if (variants[0]) {
            vName = variants[0].name;
            vMult = variants[0].multiplier;
        }
        addToCart(p.id, vName, vMult);
    };

    overlay.classList.add('visible');
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.remove('visible');
}

/* ═══ Init ═══ */
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    loadShopData();

    // Cart panel
    document.getElementById('cartBtn')?.addEventListener('click', openCart);
    document.getElementById('closeCart')?.addEventListener('click', closeCart);
    document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

    // Product click → detail modal
    document.getElementById('productGrid')?.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        if (e.target.closest('button, select')) return;
        openProductDetail(card.dataset.productId);
    });

    document.getElementById('productModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'productModal') closeProductModal();
    });

    document.getElementById('closeProductModal')?.addEventListener('click', closeProductModal);
});
