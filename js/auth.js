/* ═══════════════════════════════════════════
   Auth Module — BulletFarm Shop
   Login/Logout + Role-based access
   ═══════════════════════════════════════════ */

let currentUser = null;
let currentRole = null; // 'admin' | 'status_only' | null

async function signIn(email, password) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not initialized');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentUser = data.user;
    await fetchRole();
    return { user: currentUser, role: currentRole };
}

async function signOut() {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    currentUser = null;
    currentRole = null;
}

async function fetchRole() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
        currentUser = null;
        currentRole = null;
        return null;
    }

    currentUser = user;
    const { data, error } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (error) {
        console.warn('Role fetch failed:', error);
        currentRole = null;
        return null;
    }

    currentRole = data?.role || null;
    return currentRole;
}

async function getSession() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session || null;
}

function isAdmin() {
    return currentRole === 'admin';
}

function isStatusOnly() {
    return currentRole === 'status_only';
}

function isAuthenticated() {
    return currentUser !== null && currentRole !== null;
}
