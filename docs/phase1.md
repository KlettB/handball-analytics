# Phase 1: Foundation + MVP

## Ziel
Funktionierendes Grundgerüst: Daten von handball.net abrufen, in SQLite speichern, als interaktives Dashboard mit Spielverlaufs-Chart anzeigen.

## Ergebnis

### Backend
- [x] Express-Server (Port 3001) mit CORS
- [x] SQLite-Datenbank mit `matches` + `match_events` Tabellen
- [x] RSC-Fetcher: Spielplan + Ticker-Daten von handball.net als strukturiertes JSON
- [x] RSC-Parser: Extraktion von GameSummary-Objekten und Event-Arrays
- [x] Player/Score-Parsing aus Event-Messages
- [x] Transaktionale DB-Writes (alle Events oder keine pro Spiel)
- [x] REST API: `GET /api/matches`, `GET /api/matches/:id`, `POST /api/fetch-data`
- [x] Nightly Cron-Job (03:00) für automatischen Daten-Fetch
- [x] CLI: `npm run fetch-data`

### Frontend
- [x] React + Vite + Tailwind CSS
- [x] Dark Mode
- [x] Spielliste mit Ergebnis-Farbcodierung (Sieg/Niederlage/Unentschieden)
- [x] Spieldetail-Seite mit Score-Header
- [x] Lead Tracker Chart (Recharts, step-after Interpolation, Heim vs Gast)
- [x] Event-Timeline (Tore, Strafen, Auszeiten, Verwarnungen)
- [x] Vite-Proxy auf Express-Backend

### Dokumentation
- [x] `docs/data-source.md` — RSC-API, Event-Typen, Message-Patterns
- [x] `docs/database-schema.md` — DB-Schema
- [x] `docs/api-endpoints.md` — REST API Spezifikation
- [x] `docs/phase1.md` — diese Datei

## Technische Entscheidungen

### RSC statt HTML-Scraping
handball.net ist eine Next.js-App. Mit `RSC: 1` Header liefert der Server strukturiertes JSON statt HTML. Vorteile:
- Kein cheerio/HTML-Parsing nötig
- Stabile Datenstruktur (nicht von CSS-Klassen abhängig)
- Alle Daten in einem Request pro Seite

### Keine Aufstellungs-Daten in Phase 1
Die Aufstellungs-Seite (`/aufstellung`) liefert Spielerstatistiken pro Spiel. Wird erst in Phase 2/3 für Spieler-Aggregation relevant.
