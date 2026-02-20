# BulletFarm Shop — Supabase Setup

## 1. Tabellen erstellen

Führe diese SQL-Befehle im Supabase SQL-Editor aus (Dashboard → SQL Editor → New query).

```sql
-- ============================================
-- KATEGORIEN
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  color TEXT DEFAULT '#94a3b8',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUKTE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC DEFAULT 0,
  resources JSONB DEFAULT '[]'::jsonb,
  variants JSONB DEFAULT '[]'::jsonb,
  badges TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','disabled','coming_soon')),
  is_bundle BOOLEAN DEFAULT false,
  bundle_items UUID[] DEFAULT '{}',
  stock INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BESTELLUNGEN
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'Offen' CHECK (status IN ('Offen','Bearbeitet','Archiviert','Storniert')),
  customer JSONB DEFAULT '{}'::jsonb,
  items JSONB DEFAULT '[]'::jsonb,
  discord_message_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BENUTZER-PROFILE (Rollen)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'status_only' CHECK (role IN ('admin','status_only')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SHOP SETTINGS (Single Row)
-- ============================================
CREATE TABLE IF NOT EXISTS shop_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB DEFAULT '{}'::jsonb
);

-- Initialwert anlegen
INSERT INTO shop_settings (id, data)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;
```

## 2. Auto-Profile bei Registrierung

```sql
-- Trigger: Erstellt automatisch ein Profil bei neuer Registrierung
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'status_only');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 3. RLS (Row Level Security)

```sql
-- RLS aktivieren
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CATEGORIES: Jeder kann lesen, nur Admin kann schreiben
-- ============================================
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_admin" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- PRODUCTS: Jeder kann lesen, nur Admin kann schreiben
-- ============================================
CREATE POLICY "products_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_admin" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- ORDERS: Jeder kann INSERT (Bestellung aufgeben),
--         Auth-User können lesen + updaten
-- ============================================
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_read" ON orders FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','status_only'))
);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (
  auth.uid() IS NOT NULL AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','status_only'))
);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- PROFILES: Nur eigenes Profil lesen
-- ============================================
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (id = auth.uid());

-- ============================================
-- SHOP_SETTINGS: Jeder kann lesen, nur Admin kann schreiben
-- ============================================
CREATE POLICY "settings_read" ON shop_settings FOR SELECT USING (true);
CREATE POLICY "settings_admin" ON shop_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

## 4. Admin-Benutzer erstellen

1. Gehe zu **Authentication → Users → Add User**
2. Erstelle einen User mit Email + Passwort
3. Dann im SQL-Editor:

```sql
-- Ersetze die EMAIL mit deiner Admin-Email
UPDATE profiles SET role = 'admin' WHERE email = 'deine-admin@email.de';
```

## 5. Status-Only Benutzer (für Bestellstatus)

1. Erstelle einen weiteren User in Authentication
2. Der Trigger erstellt automatisch ein Profil mit `role = 'status_only'`
3. Dieser User kann sich einloggen und nur Bestellstatus ändern

## 6. Discord Webhook erstellen

1. Discord Server → Kanal-Einstellungen → **Integrationen → Webhooks**
2. "Neuer Webhook" erstellen
3. **Webhook-URL kopieren**
4. Im Admin-Panel unter "Discord" die URL einfügen und speichern
