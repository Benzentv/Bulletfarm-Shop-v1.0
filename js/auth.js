/* ═══════════════════════════════════════════
   Auth Module — BulletFarm Shop
   Login, logout, role management
   ═══════════════════════════════════════════ */

let currentUser = null;
let currentRole = null;

const ROLE_ADMIN = 'admin';
const ROLE_SHOP_MANAGER = 'shop_manager';
const ROLE_STATUS_ONLY = 'status_only';

async function signIn(email, password) {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    await fetchRole();
    return { user: currentUser, role: currentRole };
}

async function signOut() {
    const sb = getSupabase();
    await sb.auth.signOut();
    currentUser = null;
    currentRole = null;
}

async function getSession() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    if (data?.session?.user) {
        currentUser = data.session.user;
        return data.session;
    }
    return null;
}

async function fetchRole() {
    if (!currentUser) return;
    const sb = getSupabase();
    const { data, error } = await sb
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('Role fetch error:', error);
        currentRole = null;
        return;
    }
    currentRole = data?.role || ROLE_STATUS_ONLY;
}

function hasRole(...roles) {
    return roles.includes(currentRole);
}

function isAdmin() {
    return hasRole(ROLE_ADMIN);
}

function canManageShop() {
    return hasRole(ROLE_ADMIN, ROLE_SHOP_MANAGER);
}

function canManageOrders() {
    return hasRole(ROLE_ADMIN, ROLE_SHOP_MANAGER, ROLE_STATUS_ONLY);
}

function canDeleteOrders() {
    return hasRole(ROLE_ADMIN, ROLE_SHOP_MANAGER);
}

function isAuthenticated() {
    return currentUser !== null && currentRole !== null;
}
