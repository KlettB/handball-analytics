# Handball Analytics

Spielverlaufs-Analyse für Handball-Mannschaften basierend auf Daten von [handball.net](https://www.handball.net).

## Features

- **Lead Tracker**: Torverlauf beider Mannschaften als interaktives Chart
- **Key Moments**: Run-Erkennung, Momentum-Analyse, Auszeit-Effektivität
- **Saison-Statistiken**: Spieler-Stats, Schwächephasen, Heim/Auswärts-Vergleich
- **Advanced Analytics**: Comeback-Index, Hin-/Rückrunden-Vergleich, Saison-Momentum

## Tech-Stack

- Node.js + Express (Backend + Daten-Fetch)
- React + Vite (Frontend)
- SQLite (Datenbank)
- Recharts (Visualisierung)
- Tailwind CSS (Styling)

## Setup

```bash
# Repository klonen
cd Repos
git clone <repo-url> handball-analytics
cd handball-analytics

# Dependencies installieren
npm install

# Environment konfigurieren
cp .env.example .env

# Entwicklungsserver starten
npm run dev

# Daten abrufen
npm run fetch-data
```

## Dokumentation

Siehe `/docs` für Detailspezifikationen:
- [Daten-Referenz](docs/scraping-reference.md)
- [Datenbank-Schema](docs/database-schema.md)
- [API-Endpoints](docs/api-endpoints.md)
- [Phase 1 — Foundation](docs/phase1.md)
- [Phase 2 — Einzelspiel-Tiefe](docs/phase2.md)
- [Phase 3 — Saison-Aggregation](docs/phase3.md)
- [Phase 4 — Advanced Analytics](docs/phase4.md)
