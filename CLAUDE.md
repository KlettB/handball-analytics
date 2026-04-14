# Handball Analytics WebApp

## Was ist das?
WebApp die Spielverlaufsdaten von handball.net per RSC-API abruft, in SQLite speichert und als interaktives Analytics-Dashboard visualisiert. Zielmannschaft: **TSV Wolfschlugen** (Männer-Oberliga BW).

## Tech-Stack
- **Backend**: Node.js + Express (Port 3001)
- **Frontend**: React via Vite (Port 5173 dev) + Tailwind CSS
- **Charts**: Recharts
- **Datenbank**: SQLite via better-sqlite3 (`/server/data/handball.db`)
- **Daten-Fetch**: node-fetch via RSC-API (strukturierte JSON-Daten, kein HTML-Parsing nötig)

## Projektstruktur
```
/server          → Express API + Daten-Fetch-Engine
/server/data     → SQLite DB-Datei (gitignored, wird beim Start erstellt)
/server/fetcher  → Daten-Fetch-Logik (RSC-API-Anbindung)
/server/routes   → API-Endpoints
/client          → React App (Vite)
/docs            → Detailspezifikationen (siehe unten)
```

## Konfiguration (Environment)
```
TEAM_ID=handball4all.baden-wuerttemberg.1331231
SEASON_START=2025-07-01
SEASON_END=2026-06-30
```

## Kern-Prinzip
Die Datenbank ist die Source of Truth. Daten-Fetch ersetzt Daten nur bei erfolgreichem Parse. Bestehende Daten bleiben bei Fehlern oder Saison-Wechsel erhalten.

## Phasen-Übersicht

| Phase | Thema | Status | Details |
|-------|-------|--------|---------|
| 1 | Foundation + MVP | DONE | [docs/phase1.md](docs/phase1.md) |
| 2 | Einzelspiel-Tiefe | TODO | [docs/phase2.md](docs/phase2.md) |
| 3 | Saison-Aggregation | TODO | [docs/phase3.md](docs/phase3.md) |
| 4 | Advanced Analytics + Deploy | TODO | [docs/phase4.md](docs/phase4.md) |

**Phasen strikt der Reihe nach abarbeiten. Jede Phase muss funktionieren bevor die nächste beginnt.**

## Referenz-Dokumente
- [docs/data-source.md](docs/data-source.md) — URL-Patterns, Event-Typen, RSC-Datenstruktur
- [docs/database-schema.md](docs/database-schema.md) — Vollständiges DB-Schema
- [docs/api-endpoints.md](docs/api-endpoints.md) — REST API Spezifikation

## Daten-Aktualisierung
- **Zeitgesteuert**: Daten-Fetch läuft automatisch einmal täglich (nachts, z.B. 03:00 Uhr) als Cron-Job im Backend
- **Kein On-Demand-Fetch durch User** — das Frontend löst nie direkt einen Daten-Fetch aus
- **Manueller Trigger** nur über Admin-Endpoint (`POST /api/fetch-data`) für Entwicklung/Debugging
- 1-2 Sekunden Pause zwischen Requests um handball.net nicht zu belasten
- Fehler bei einzelnen Spielen dürfen den Rest nicht blockieren (try/catch pro Spiel)
- DB-Writes pro Spiel als Transaction (alle Events oder keine)
- `fetched_at` wird erst NACH erfolgreichem Parse + Write gesetzt

## Konventionen
- Mobile-first Design, Dark Mode Support
