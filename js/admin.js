/* ═══════════════════════════════════════════
   Admin Module — BulletFarm Shop
   Product/Category CRUD, Orders, Theme, Discord
   ═══════════════════════════════════════════ */

/* ═══ State ═══ */
let adminCategories = [];
let adminProducts = [];
let adminOrders = [];
let editingProductId = null;
let activeSection = 'orders';

/* ═══ Sections config ═══ */
const ADMIN_SECTIONS = [
    { id: 'products', label: '📦 Produkte', icon: '📦', adminOnly: true },
    { id: 'categories', label: '📂 Kategorien', icon: '📂', adminOnly: true },
    { id: 'orders', label: '📋 Bestellungen', icon: '📋', adminOnly: false },
    { id: 'theme', label: '🎨 Theme', icon: '🎨', adminOnly: true },
    { id: 'discord', label: '💬 Discord', icon: '💬', adminOnly: true },
];

/* ═══ Init ═══ */
document.addEventListener('DOMContentLoaded', async () => {
    initSupabase();

    // Check existing session
    const session = await getSession();
    if (session) {
        await fetchRole();
        if (isAuthenticated()) {
            showAdminPanel();
            return;
        }
    }
    showLoginForm();
});

/* ═══ Login ═══ */
function showLoginForm() {
    const app = document.getElementById('adminApp');
    app.innerHTML = `
    <div class="login-container">
      <div class="login-card fade-in">
        <div class="login-title">
          <h2>⚙️ Admin Panel</h2>
          <p>Anmelden um fortzufahren</p>
        </div>
        <form id="loginForm" class="flex flex-col gap-md">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="input" type="email" id="loginEmail" placeholder="admin@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Passwort</label>
            <input class="input" type="password" id="loginPassword" placeholder="••••••••" required>
          </div>
          <button class="btn btn-primary btn-lg btn-full" type="submit">Einloggen</button>
          <div id="loginError" class="text-muted text-sm" style="text-align:center"></div>
        </form>
        <div class="mt-lg" style="text-align:center">
          <a href="index.html" class="text-muted text-sm">← Zurück zum Shop</a>
        </div>
      </div>
    </div>
  `;

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');

        try {
            errorEl.textContent = 'Wird eingeloggt…';
            await signIn(email, password);
            showAdminPanel();
        } catch (err) {
            errorEl.textContent = '❌ ' + (err.message || 'Login fehlgeschlagen');
            errorEl.style.color = 'var(--danger)';
        }
    };
}

/* ═══ Admin Panel Layout ═══ */
async function showAdminPanel() {
    const app = document.getElementById('adminApp');
    const role = currentRole;
    const sections = ADMIN_SECTIONS.filter(s => !s.adminOnly || role === 'admin');

    // If status_only, default to orders
    if (role === 'status_only') activeSection = 'orders';
    if (!sections.find(s => s.id === activeSection)) activeSection = sections[0]?.id || 'orders';

    app.innerHTML = `
    <div class="admin-layout">
      <nav class="admin-sidebar" id="adminSidebar">
        ${sections.map(s => `
          <button class="admin-sidebar-item ${s.id === activeSection ? 'active' : ''}" data-section="${s.id}">
            <span>${s.icon}</span>
            <span>${s.label.replace(s.icon + ' ', '')}</span>
          </button>
        `).join('')}
        <div style="flex:1"></div>
        <button class="admin-sidebar-item" id="logoutBtn" style="color:var(--danger)">
          <span>🚪</span>
          <span>Abmelden</span>
        </button>
      </nav>
      <main class="admin-content" id="adminContent"></main>
    </div>
  `;

    // Sidebar navigation
    document.querySelectorAll('[data-section]').forEach(btn => {
        btn.onclick = () => {
            activeSection = btn.dataset.section;
            document.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === activeSection));
            renderSection(activeSection);
        };
    });

    document.getElementById('logoutBtn').onclick = async () => {
        await signOut();
        showLoginForm();
    };

    // Load data
    await loadAdminData();
    renderSection(activeSection);
}

async function loadAdminData() {
    const sb = getSupabase();
    if (!sb) return;

    try {
        // Settings
        const settingsRes = await sb.from('shop_settings').select('data').eq('id', 1).maybeSingle();
        window.__shopSettings = settingsRes.data?.data || {};

        // Categories
        const catRes = await sb.from('categories').select('*').order('created_at', { ascending: true });
        adminCategories = catRes.data || [];

        // Products
        const prodRes = await sb.from('products').select('*').order('sort_order', { ascending: true });
        adminProducts = prodRes.data || [];

        // Orders
        const orderRes = await sb.from('orders').select('*').order('created_at', { ascending: false });
        adminOrders = orderRes.data || [];
    } catch (err) {
        console.error('Admin data load failed:', err);
    }
}

function renderSection(section) {
    const content = document.getElementById('adminContent');
    if (!content) return;

    switch (section) {
        case 'products': renderAdminProducts(content); break;
        case 'categories': renderAdminCategories(content); break;
        case 'orders': renderAdminOrders(content); break;
        case 'theme': renderAdminTheme(content); break;
        case 'discord': renderAdminDiscord(content); break;
        default: content.innerHTML = '<div class="text-muted">Unbekannter Bereich</div>';
    }
}

/* ═══════════════════════════════════
   PRODUCTS SECTION
   ═══════════════════════════════════ */
function renderAdminProducts(el) {
    const catOptions = adminCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    el.innerHTML = `
    <div class="card mb-md fade-in">
      <div class="card-header">
        <h3>${editingProductId ? '✏️ Produkt bearbeiten' : '➕ Neues Produkt'}</h3>
        <div class="flex gap-sm">
          ${editingProductId ? `<button class="btn btn-sm" onclick="resetProductForm()">✚ Neues Produkt</button>` : ''}
        </div>
      </div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="input" id="pName" placeholder="Produktname">
          </div>
          <div class="form-group">
            <label class="form-label">Kategorie</label>
            <select class="select" id="pCat">
              <option value="">Keine Kategorie</option>
              ${catOptions}
            </select>
          </div>
        </div>
        <div class="form-row mt-md">
          <div class="form-group">
            <label class="form-label">Bild URL</label>
            <input class="input" id="pImg" placeholder="https://...">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="select" id="pStatus">
              <option value="active">✅ Aktiv</option>
              <option value="coming_soon">🕒 Bald verfügbar</option>
              <option value="disabled">⛔ Deaktiviert</option>
            </select>
          </div>
        </div>
        <div class="form-group mt-md">
          <label class="form-label">Beschreibung</label>
          <textarea class="textarea" id="pDesc" placeholder="Produktbeschreibung (optional)"></textarea>
        </div>
        <div class="form-row mt-md">
          <div class="form-group">
            <label class="form-label">Bestand (leer = unbegrenzt)</label>
            <input class="input" id="pStock" type="number" min="0" placeholder="∞">
          </div>
          <div class="form-group">
            <label class="form-label">Sortierung</label>
            <input class="input" id="pSort" type="number" value="0" placeholder="0">
          </div>
        </div>

        <!-- Resources -->
        <div class="mt-lg" style="border:1px solid var(--glass-border); border-radius:var(--radius); padding:var(--space-md)">
          <div class="form-label mb-sm">Ressourcen</div>
          <div class="flex gap-sm flex-wrap items-center">
            <input class="input" id="rName" placeholder="Name" style="width:150px">
            <input class="input" id="rAmount" type="text" placeholder="Menge" style="width:120px">
            <input type="color" id="rColor" value="#60a5fa" style="width:50px; height:38px; border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer">
            <button class="btn btn-sm btn-primary" onclick="addResourceToEditor()">+ Hinzufügen</button>
          </div>
          <div id="resourceList" class="resource-chips mt-sm"></div>
        </div>

        <!-- Variants -->
        <div class="mt-md" style="border:1px solid var(--glass-border); border-radius:var(--radius); padding:var(--space-md)">
          <div class="form-label mb-sm">Varianten</div>
          <div class="flex gap-sm flex-wrap items-center">
            <input class="input" id="vName" placeholder="Name (z.B. Small)" style="width:150px">
            <input class="input" id="vMult" type="number" step="0.1" value="1" placeholder="Multiplier" style="width:120px">
            <button class="btn btn-sm btn-primary" onclick="addVariantToEditor()">+ Hinzufügen</button>
          </div>
          <div id="variantList" class="resource-chips mt-sm"></div>
        </div>

        <!-- Badges -->
        <div class="mt-md" style="border:1px solid var(--glass-border); border-radius:var(--radius); padding:var(--space-md)">
          <div class="form-label mb-sm">Badges</div>
          <div class="flex gap-sm flex-wrap" id="badgeToggles">
            <label class="resource-chip" style="cursor:pointer"><input type="checkbox" value="popular" style="margin-right:6px"> 🔥 Beliebt</label>
            <label class="resource-chip" style="cursor:pointer"><input type="checkbox" value="premium" style="margin-right:6px"> 💎 Premium</label>
            <label class="resource-chip" style="cursor:pointer"><input type="checkbox" value="sale" style="margin-right:6px"> 💸 Sale</label>
            <label class="resource-chip" style="cursor:pointer"><input type="checkbox" value="new" style="margin-right:6px"> ✨ Neu</label>
          </div>
        </div>

        <div class="flex gap-sm mt-lg">
          <button class="btn btn-success btn-lg" onclick="saveProduct()">
            ${editingProductId ? '💾 Speichern' : '✅ Erstellen'}
          </button>
          ${editingProductId ? `<button class="btn btn-danger" onclick="deleteProduct('${editingProductId}')">🗑️ Löschen</button>` : ''}
        </div>
      </div>
    </div>

    <!-- Product List -->
    <div class="card fade-in">
      <div class="card-header">
        <h3>📦 Alle Produkte (${adminProducts.length})</h3>
        <button class="btn btn-sm" onclick="loadAdminData().then(()=>renderSection('products'))">🔄 Neu laden</button>
      </div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bild</th>
                <th>Name</th>
                <th>Kategorie</th>
                <th>Ressourcen</th>
                <th>Status</th>
                <th>Bestand</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="productTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

    // Init editor state
    window._editorResources = [];
    window._editorVariants = [{ name: 'Standard', multiplier: 1 }];
    renderEditorResources();
    renderEditorVariants();

    // Fill table
    renderProductTable();

    // If editing, fill form
    if (editingProductId) {
        const p = adminProducts.find(x => x.id === editingProductId);
        if (p) fillProductForm(p);
    }
}

function renderProductTable() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    if (adminProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align:center">Keine Produkte vorhanden</td></tr>';
        return;
    }

    tbody.innerHTML = adminProducts.map(p => {
        const cat = adminCategories.find(c => c.id === p.category_id);
        const statusMap = { active: '✅', coming_soon: '🕒', disabled: '⛔' };
        const resources = (p.resources || []).map(r => `<span class="resource-chip" style="font-size:0.7rem; padding:3px 8px"><span class="resource-dot" style="background:${r.color || '#60a5fa'}; width:6px; height:6px"></span>${escapeHtml(r.name)}: ${formatNum(r.amount)}</span>`).join('');
        return `
      <tr>
        <td>${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" style="width:48px; height:36px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--glass-border)" onerror="this.style.display='none'">` : '<span class="text-muted">—</span>'}</td>
        <td><strong>${escapeHtml(p.name)}</strong><div class="text-xs text-muted">${String(p.id).slice(0, 8)}</div></td>
        <td class="text-muted">${cat ? escapeHtml(cat.name) : '—'}</td>
        <td><div class="flex flex-wrap gap-sm">${resources || '<span class="text-muted">—</span>'}</div></td>
        <td>${statusMap[p.status] || '?'}</td>
        <td class="text-muted">${p.stock !== null && p.stock !== undefined ? p.stock : '∞'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-primary btn-sm" onclick="editProduct('${p.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
    }).join('');
}

/* Editor helpers */
function addResourceToEditor() {
    const name = (document.getElementById('rName')?.value || '').trim();
    const amount = Number(document.getElementById('rAmount')?.value) || 0;
    const color = document.getElementById('rColor')?.value || '#60a5fa';

    if (!name || amount <= 0) {
        showToast('Fehler', 'Name und positive Menge benötigt', { type: 'error' });
        return;
    }

    window._editorResources.push({ name, amount, color });
    document.getElementById('rName').value = '';
    document.getElementById('rAmount').value = '';
    renderEditorResources();
}

function removeEditorResource(idx) {
    window._editorResources.splice(idx, 1);
    renderEditorResources();
}

function renderEditorResources() {
    const el = document.getElementById('resourceList');
    if (!el) return;
    const res = window._editorResources || [];
    el.innerHTML = res.length === 0 ? '<span class="text-muted text-sm">Keine Ressourcen</span>' :
        res.map((r, i) => `
      <span class="resource-chip">
        <span class="resource-dot" style="background:${r.color}"></span>
        ${escapeHtml(r.name)}: <strong>${formatNum(r.amount)}</strong>
        <button class="btn btn-danger btn-sm" style="padding:2px 6px; margin-left:4px" onclick="removeEditorResource(${i})">✕</button>
      </span>
    `).join('');
}

function addVariantToEditor() {
    const name = (document.getElementById('vName')?.value || '').trim() || 'Variante';
    const mult = Number(document.getElementById('vMult')?.value) || 1;

    window._editorVariants.push({ name, multiplier: mult });
    document.getElementById('vName').value = '';
    document.getElementById('vMult').value = '1';
    renderEditorVariants();
}

function removeEditorVariant(idx) {
    window._editorVariants.splice(idx, 1);
    if (window._editorVariants.length === 0) {
        window._editorVariants.push({ name: 'Standard', multiplier: 1 });
    }
    renderEditorVariants();
}

function renderEditorVariants() {
    const el = document.getElementById('variantList');
    if (!el) return;
    el.innerHTML = (window._editorVariants || []).map((v, i) => `
    <span class="resource-chip">
      ${escapeHtml(v.name)} <span class="text-muted">(×${v.multiplier})</span>
      <button class="btn btn-danger btn-sm" style="padding:2px 6px; margin-left:4px" onclick="removeEditorVariant(${i})">✕</button>
    </span>
  `).join('');
}

function getSelectedBadges() {
    return Array.from(document.querySelectorAll('#badgeToggles input:checked')).map(el => el.value);
}

function fillProductForm(p) {
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pCat').value = p.category_id || '';
    document.getElementById('pImg').value = p.image_url || '';
    document.getElementById('pStatus').value = p.status || 'active';
    document.getElementById('pDesc').value = p.description || '';
    document.getElementById('pStock').value = p.stock !== null && p.stock !== undefined ? p.stock : '';
    document.getElementById('pSort').value = p.sort_order || 0;

    window._editorResources = Array.isArray(p.resources) ? [...p.resources] : [];
    window._editorVariants = Array.isArray(p.variants) && p.variants.length ? [...p.variants] : [{ name: 'Standard', multiplier: 1 }];
    renderEditorResources();
    renderEditorVariants();

    // Badges
    const badges = Array.isArray(p.badges) ? p.badges : [];
    document.querySelectorAll('#badgeToggles input').forEach(el => {
        el.checked = badges.includes(el.value);
    });
}

function resetProductForm() {
    editingProductId = null;
    renderSection('products');
}

function editProduct(id) {
    editingProductId = id;
    renderSection('products');
    document.getElementById('adminContent')?.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveProduct() {
    const sb = getSupabase();
    if (!sb) return;

    const name = (document.getElementById('pName')?.value || '').trim();
    if (!name) { showToast('Fehler', 'Produktname fehlt', { type: 'error' }); return; }

    const cat = document.getElementById('pCat')?.value || null;
    const stockVal = document.getElementById('pStock')?.value;

    const payload = {
        name,
        category_id: cat || null,
        image_url: (document.getElementById('pImg')?.value || '').trim() || null,
        status: document.getElementById('pStatus')?.value || 'active',
        description: (document.getElementById('pDesc')?.value || '').trim() || null,
        stock: stockVal !== '' ? Number(stockVal) : null,
        sort_order: Number(document.getElementById('pSort')?.value) || 0,
        resources: window._editorResources || [],
        variants: (window._editorVariants || []).filter(v => v.name),
        badges: getSelectedBadges(),
    };

    try {
        if (editingProductId) {
            const { error } = await sb.from('products').update(payload).eq('id', editingProductId);
            if (error) throw error;
            showToast('✅ Gespeichert', name);
        } else {
            const { error } = await sb.from('products').insert(payload);
            if (error) throw error;
            showToast('✅ Erstellt', name);
        }

        editingProductId = null;
        await loadAdminData();
        renderSection('products');
    } catch (err) {
        console.error(err);
        showToast('Fehler', err.message || 'Speichern fehlgeschlagen', { type: 'error' });
    }
}

async function deleteProduct(id) {
    if (!confirm('Produkt wirklich löschen?')) return;
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { error } = await sb.from('products').delete().eq('id', id);
        if (error) throw error;
        showToast('🗑️ Gelöscht', 'Produkt entfernt');
        editingProductId = null;
        await loadAdminData();
        renderSection('products');
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

/* ═══════════════════════════════════
   CATEGORIES SECTION
   ═══════════════════════════════════ */
function renderAdminCategories(el) {
    el.innerHTML = `
    <div class="card mb-md fade-in">
      <div class="card-header">
        <h3>➕ Neue Kategorie</h3>
      </div>
      <div class="card-body">
        <div class="flex gap-sm flex-wrap items-center">
          <input class="input" id="newCatName" placeholder="Name" style="flex:1; min-width:180px">
          <input class="input" id="newCatIcon" placeholder="Icon (Emoji)" value="📦" style="width:80px">
          <input type="color" id="newCatColor" value="#94a3b8" style="width:50px; height:38px; border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer">
          <button class="btn btn-success" onclick="addCategory()">✅ Erstellen</button>
        </div>
      </div>
    </div>

    <div class="card fade-in">
      <div class="card-header">
        <h3>📂 Kategorien (${adminCategories.length})</h3>
      </div>
      <div class="card-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Icon</th><th>Name</th><th>Farbe</th><th>Aktionen</th></tr></thead>
            <tbody id="catTableBody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

    const tbody = document.getElementById('catTableBody');
    if (adminCategories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center">Keine Kategorien</td></tr>';
        return;
    }

    tbody.innerHTML = adminCategories.map(c => `
    <tr>
      <td><input class="input" data-cat-icon="${c.id}" value="${escapeHtml(c.icon || '📦')}" style="width:60px; text-align:center"></td>
      <td><input class="input" data-cat-name="${c.id}" value="${escapeHtml(c.name)}"></td>
      <td><input type="color" data-cat-color="${c.id}" value="${c.color || '#94a3b8'}" style="width:50px; height:34px; border:1px solid var(--glass-border); border-radius:var(--radius-sm); cursor:pointer"></td>
      <td style="white-space:nowrap">
        <button class="btn btn-success btn-sm" onclick="updateCategory('${c.id}')">💾</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function addCategory() {
    const sb = getSupabase();
    if (!sb) return;
    const name = (document.getElementById('newCatName')?.value || '').trim();
    const icon = (document.getElementById('newCatIcon')?.value || '📦').trim();
    const color = document.getElementById('newCatColor')?.value || '#94a3b8';
    if (!name) { showToast('Fehler', 'Name fehlt', { type: 'error' }); return; }

    try {
        const { error } = await sb.from('categories').insert({ name, icon, color });
        if (error) throw error;
        showToast('✅ Erstellt', name);
        await loadAdminData();
        renderSection('categories');
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

async function updateCategory(id) {
    const sb = getSupabase();
    if (!sb) return;
    const name = document.querySelector(`[data-cat-name="${id}"]`)?.value?.trim();
    const icon = document.querySelector(`[data-cat-icon="${id}"]`)?.value?.trim() || '📦';
    const color = document.querySelector(`[data-cat-color="${id}"]`)?.value || '#94a3b8';
    if (!name) return;

    try {
        const { error } = await sb.from('categories').update({ name, icon, color }).eq('id', id);
        if (error) throw error;
        showToast('💾 Gespeichert', name);
        await loadAdminData();
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

async function deleteCategory(id) {
    if (!confirm('Kategorie löschen?')) return;
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { error } = await sb.from('categories').delete().eq('id', id);
        if (error) throw error;
        showToast('🗑️ Gelöscht');
        await loadAdminData();
        renderSection('categories');
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

/* ═══════════════════════════════════
   ORDERS SECTION
   ═══════════════════════════════════ */
function renderAdminOrders(el) {
    const statuses = ['Offen', 'Bearbeitet', 'Archiviert', 'Storniert'];
    const statusCls = { Offen: 'os-offen', Bearbeitet: 'os-bearbeitet', Archiviert: 'os-archiviert', Storniert: 'os-storniert' };
    const statusEmoji = { Offen: '🔵', Bearbeitet: '🟡', Archiviert: '🟢', Storniert: '🔴' };

    el.innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <h3>📋 Bestellungen (${adminOrders.length})</h3>
        <div class="flex gap-sm">
          <select class="select" id="orderStatusFilter" style="width:auto;min-width:160px">
            <option value="all">Alle Status</option>
            ${statuses.map(s => `<option value="${s}">${statusEmoji[s]} ${s}</option>`).join('')}
          </select>
          <button class="btn btn-sm" onclick="loadAdminData().then(()=>renderSection('orders'))">🔄</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div id="ordersContainer"></div>
      </div>
    </div>
  `;

    // Filter handler
    document.getElementById('orderStatusFilter').onchange = () => renderOrdersList();
    renderOrdersList();
}

function renderOrdersList() {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    const filter = document.getElementById('orderStatusFilter')?.value || 'all';
    let orders = adminOrders;
    if (filter !== 'all') {
        orders = orders.filter(o => o.status === filter);
    }

    const statuses = ['Offen', 'Bearbeitet', 'Archiviert', 'Storniert'];
    const statusCls = { Offen: 'os-offen', Bearbeitet: 'os-bearbeitet', Archiviert: 'os-archiviert', Storniert: 'os-storniert' };
    const statusEmoji = { Offen: '🔵', Bearbeitet: '🟡', Archiviert: '🟢', Storniert: '🔴' };

    if (orders.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Keine Bestellungen</div>
      </div>
    `;
        return;
    }

    container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Datum</th>
            <th>Kunde</th>
            <th>Produkte</th>
            <th>Status</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => {
        const customer = o.customer || {};
        const items = o.items || [];
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
        const itemList = items.map(i => `${i.name || '?'} ×${i.qty}`).join(', ');
        const statusSelect = statuses.map(s =>
            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusEmoji[s]} ${s}</option>`
        ).join('');

        return `
              <tr>
                <td class="text-muted text-xs">${String(o.id).slice(0, 8)}</td>
                <td class="text-sm">${date}</td>
                <td>
                  <strong>${escapeHtml(customer.name || 'Unbekannt')}</strong>
                  <div class="text-xs text-muted">${escapeHtml(customer.phone || customer.discord || '—')}</div>
                </td>
                <td class="text-sm">${escapeHtml(itemList) || '—'}</td>
                <td><span class="order-status ${statusCls[o.status] || ''}">${statusEmoji[o.status] || '⚪'} ${o.status}</span></td>
                <td>
                  <div class="flex gap-sm items-center">
                    <select class="select" style="width:auto; min-width:140px; padding:6px 10px; font-size:0.78rem" data-order-status="${o.id}">
                      ${statusSelect}
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${o.id}')">💾</button>
                    ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}')">🗑️</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function updateOrderStatus(orderId) {
    const sb = getSupabase();
    if (!sb) return;

    const selectEl = document.querySelector(`[data-order-status="${orderId}"]`);
    if (!selectEl) return;
    const newStatus = selectEl.value;

    try {
        const { error } = await sb.from('orders')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);
        if (error) throw error;

        // Update local state
        const order = adminOrders.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;

            // Update Discord
            const msgId = await updateOrderStatusInDiscord(order, newStatus, order.discord_message_id);
            if (msgId && msgId !== order.discord_message_id) {
                // Save new message ID if it changed
                await sb.from('orders').update({ discord_message_id: msgId }).eq('id', orderId);
                order.discord_message_id = msgId;
            }
        }

        showToast('📋 Status geändert', `→ ${newStatus}`, { type: 'success' });
        renderOrdersList();
    } catch (err) {
        console.error(err);
        showToast('Fehler', err.message, { type: 'error' });
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Bestellung wirklich löschen?')) return;
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { error } = await sb.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        adminOrders = adminOrders.filter(o => o.id !== orderId);
        showToast('🗑️ Gelöscht');
        renderOrdersList();
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

/* ═══════════════════════════════════
   THEME SECTION
   ═══════════════════════════════════ */
function renderAdminTheme(el) {
    const s = window.__shopSettings || {};
    const c = s.colors || {};

    el.innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <h3>🎨 Theme & Branding</h3>
      </div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Shop Titel</label>
            <input class="input" id="tTitle" value="${escapeHtml(s.title || 'BulletFarm')}">
          </div>
          <div class="form-group">
            <label class="form-label">Untertitel</label>
            <input class="input" id="tSub" value="${escapeHtml(s.subtitle || 'By Benzen')}">
          </div>
        </div>
        <div class="form-row mt-md">
          <div class="form-group">
            <label class="form-label">Background</label>
            <input type="color" class="input" id="tBg" value="${c.bg || '#06080c'}" style="height:44px; padding:6px">
          </div>
          <div class="form-group">
            <label class="form-label">Surface</label>
            <input type="color" class="input" id="tSurface" value="${c.surface || '#0c1017'}" style="height:44px; padding:6px">
          </div>
          <div class="form-group">
            <label class="form-label">Text</label>
            <input type="color" class="input" id="tText" value="${c.text || '#eaf0f8'}" style="height:44px; padding:6px">
          </div>
          <div class="form-group">
            <label class="form-label">Primary</label>
            <input type="color" class="input" id="tPrimary" value="${c.primary || '#60a5fa'}" style="height:44px; padding:6px">
          </div>
          <div class="form-group">
            <label class="form-label">Success</label>
            <input type="color" class="input" id="tSuccess" value="${c.success || '#34d399'}" style="height:44px; padding:6px">
          </div>
          <div class="form-group">
            <label class="form-label">Danger</label>
            <input type="color" class="input" id="tDanger" value="${c.danger || '#f87171'}" style="height:44px; padding:6px">
          </div>
        </div>
        <button class="btn btn-success btn-lg mt-lg" onclick="saveTheme()">💾 Theme speichern</button>
      </div>
    </div>
  `;
}

async function saveTheme() {
    const sb = getSupabase();
    if (!sb) return;

    const patch = {
        title: document.getElementById('tTitle')?.value || 'BulletFarm',
        subtitle: document.getElementById('tSub')?.value || 'By Benzen',
        colors: {
            bg: document.getElementById('tBg')?.value,
            surface: document.getElementById('tSurface')?.value,
            text: document.getElementById('tText')?.value,
            primary: document.getElementById('tPrimary')?.value,
            success: document.getElementById('tSuccess')?.value,
            danger: document.getElementById('tDanger')?.value,
        }
    };

    const merged = Object.assign({}, window.__shopSettings, patch);
    try {
        const { error } = await sb.from('shop_settings').upsert({ id: 1, data: merged });
        if (error) throw error;
        window.__shopSettings = merged;
        showToast('💾 Theme gespeichert', 'Änderungen werden beim nächsten Laden sichtbar', { type: 'success' });
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

/* ═══════════════════════════════════
   DISCORD SECTION
   ═══════════════════════════════════ */
function renderAdminDiscord(el) {
    const s = window.__shopSettings || {};

    el.innerHTML = `
    <div class="card fade-in">
      <div class="card-header">
        <h3>💬 Discord Webhook</h3>
      </div>
      <div class="card-body">
        <p class="text-muted mb-md">
          Bestellungen und Statusänderungen werden automatisch an deinen Discord-Kanal gesendet.
          Die originale Nachricht wird bei Statusänderungen aktualisiert (Live-Update).
        </p>
        <div class="form-group">
          <label class="form-label">Webhook URL</label>
          <input class="input" id="webhookUrl" placeholder="https://discord.com/api/webhooks/..." value="${escapeHtml(s.discordWebhook || '')}">
        </div>
        <div class="flex gap-sm mt-md">
          <button class="btn btn-success" onclick="saveWebhook()">💾 Speichern</button>
          <button class="btn btn-primary" onclick="testWebhook()">🧪 Test senden</button>
        </div>
        <div id="webhookStatus" class="mt-md text-sm"></div>
      </div>
    </div>
  `;
}

async function saveWebhook() {
    const sb = getSupabase();
    if (!sb) return;

    const url = (document.getElementById('webhookUrl')?.value || '').trim();
    const merged = Object.assign({}, window.__shopSettings, { discordWebhook: url });

    try {
        const { error } = await sb.from('shop_settings').upsert({ id: 1, data: merged });
        if (error) throw error;
        window.__shopSettings = merged;
        showToast('💾 Gespeichert', 'Discord Webhook URL gespeichert', { type: 'success' });
    } catch (err) {
        showToast('Fehler', err.message, { type: 'error' });
    }
}

async function testWebhook() {
    const url = (document.getElementById('webhookUrl')?.value || '').trim();
    const statusEl = document.getElementById('webhookStatus');
    if (!url) {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Keine URL eingegeben</span>';
        return;
    }

    statusEl.innerHTML = '<span class="text-muted">⏳ Sende Test-Nachricht…</span>';

    try {
        const response = await fetch(url + '?wait=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: '🧪 Test — BulletFarm Shop',
                    description: 'Webhook funktioniert! Bestellungen werden hier erscheinen.',
                    color: 0x34D399,
                    footer: { text: 'BulletFarm Shop' },
                    timestamp: new Date().toISOString()
                }]
            })
        });

        if (response.ok) {
            statusEl.innerHTML = '<span style="color:var(--success)">✅ Test erfolgreich! Nachricht gesendet.</span>';
        } else {
            statusEl.innerHTML = `<span style="color:var(--danger)">❌ Fehler: HTTP ${response.status}</span>`;
        }
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--danger)">❌ Fehler: ${escapeHtml(err.message)}</span>`;
    }
}

/* ═══ Expose globals ═══ */
window.addResourceToEditor = addResourceToEditor;
window.removeEditorResource = removeEditorResource;
window.addVariantToEditor = addVariantToEditor;
window.removeEditorVariant = removeEditorVariant;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.resetProductForm = resetProductForm;
window.addCategory = addCategory;
window.updateCategory = updateCategory;
window.deleteCategory = deleteCategory;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.saveTheme = saveTheme;
window.saveWebhook = saveWebhook;
window.testWebhook = testWebhook;
window.loadAdminData = loadAdminData;
window.renderSection = renderSection;
