# BulletFarm Shop

Ein moderner Online-Shop mit Dark-Theme und Glassmorphism-Design.

## Features

- **Shop**: Produkte anzeigen, filtern, suchen, in den Warenkorb legen und bestellen
- **Discord Webhooks**: Bestellungen werden automatisch an Discord gesendet, Statusänderungen aktualisieren die Discord-Nachricht live
- **Admin Panel**: Produkte, Kategorien, Theme und Discord-Webhook verwalten
- **Status-Only Login**: Separater Login nur für Bestellstatus-Änderungen (Offen / Bearbeitet / Archiviert / Storniert)
- **Supabase Backend**: Alle Daten werden in Supabase gespeichert (PostgreSQL + Auth + RLS)

## Setup

### 1. Supabase

1. Erstelle ein Supabase-Projekt oder verwende das bestehende
2. Führe die SQL-Befehle aus `supabase-setup.md` im SQL-Editor aus
3. Erstelle Admin- und Status-Only-Benutzer (siehe `supabase-setup.md`)

### 2. Discord Webhook

1. Discord Server → Kanal → Integrationen → Webhooks → Neuer Webhook
2. URL kopieren
3. Im Admin Panel unter "Discord" einfügen

### 3. GitHub Pages

1. Repository auf GitHub pushen
2. Settings → Pages → Source: `main` Branch, `/` (root)
3. Fertig! Die Seite ist unter `https://dein-username.github.io/Bulletfarm-Shop/` erreichbar

## Dateien

```
├── index.html              → Shop-Seite
├── admin.html              → Admin Panel
├── css/style.css           → Design System
├── js/
│   ├── supabase-config.js  → Supabase Client
│   ├── auth.js             → Login/Logout + Rollen
│   ├── discord.js          → Discord Webhooks
│   ├── shop.js             → Produktanzeige + Warenkorb
│   └── admin.js            → Admin-Verwaltung
├── supabase-setup.md       → Datenbank-Setup Anleitung
└── README.md               → Diese Datei
```

## Rollen

| Rolle | Kann |
|-------|------|
| **Admin** | Alles: Produkte, Kategorien, Bestellungen, Theme, Discord |
| **Status-Only** | Nur Bestellstatus ändern (Offen → Bearbeitet → Archiviert / Storniert) |
| **Besucher** | Shop sehen, bestellen |
