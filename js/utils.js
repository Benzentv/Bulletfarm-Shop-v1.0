/* ═══════════════════════════════════════════
   Shared Utilities — BulletFarm Shop
   Used by both shop.js and admin.js
   ═══════════════════════════════════════════ */

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function formatNum(n) {
    return Math.round(Number(n) || 0).toLocaleString('de-DE');
}

/* ═══ Toast System ═══ */
function showToast(title, msg, opts = {}) {
    const host = document.getElementById('toastHost');
    if (!host) return;

    const duration = opts.duration || 2500;
    const type = opts.type || '';

    const el = document.createElement('div');
    el.className = `toast ${type ? 'toast-' + type : ''}`;
    el.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${msg ? `<div class="toast-msg">${escapeHtml(msg)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;

    host.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = 'all 0.2s ease';
        setTimeout(() => el.remove(), 200);
    }, duration);
}
