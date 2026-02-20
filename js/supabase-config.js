/* ═══════════════════════════════════════════
   Supabase Configuration — BulletFarm Shop
   ═══════════════════════════════════════════ */

const SUPABASE_URL = 'https://obhfixukbaxtvdhriyyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaGZpeHVrYmF4dHZkaHJpeXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTk0MTYsImV4cCI6MjA4NzE3NTQxNn0.OsFvWkW9OhYZmaqslycVYXIlelw1S5nNICJbqcn2FIU';

let sbClient = null;

function initSupabase() {
    if (sbClient) return sbClient;
    if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        console.error('Supabase JS library not loaded');
        return null;
    }
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return sbClient;
}

function getSupabase() {
    return sbClient || initSupabase();
}
