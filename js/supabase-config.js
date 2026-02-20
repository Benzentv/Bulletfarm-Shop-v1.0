/* ═══════════════════════════════════════════
   Supabase Configuration — BulletFarm Shop
   ═══════════════════════════════════════════ */

const SUPABASE_URL = 'https://hmfyjgmgkqjcspjyqihm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZnlqZ21na3FqY3NwanlxaWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODc5MTYsImV4cCI6MjA4MzQ2MzkxNn0.j873-VozJFlYk1zBRvbirbH9eFW_wP_gtbFn0zTVqTo';

let supabase = null;

function initSupabase() {
    if (supabase) return supabase;
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase JS library not loaded');
        return null;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
}

function getSupabase() {
    return supabase || initSupabase();
}
