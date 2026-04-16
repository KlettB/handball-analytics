# Phase 7: Liga-wide Data + Gegner-Insights

## Ziel
Alle Spiele aller Mannschaften der Liga fetchen und speichern. Darauf aufbauend: vollständige Gegner-Analysen und eine dedizierte Vorschau-Ansicht für bevorstehende Spiele.

## Hintergrund
Heute speichern wir nur Spiele von Wolfschlugen. Begegnet Wolfschlugen einem Gegner, haben wir dessen Daten nur aus 1–2 gemeinsamen Spielen — zu wenig für echtes Scouting. Mit Liga-wide Data sehen wir jeden Gegner über seine komplette Saison.

---

## 7.1 Multi-Tenant-Umbau + Schema-Erweiterung ✅

### Neue Tabelle: `teams`
```sql
CREATE TABLE teams (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT
);
```
Wird automatisch beim Standings-Fetch befüllt (Upsert pro Team).

### Neutrales Design (kein `is_wolf_match`)
- `is_home_game` Spalte bleibt in DB (SQLite kann keine Spalten droppen), wird aber **nicht mehr gelesen** — immer `0`
- Kein `is_wolf_match` — stattdessen rein laufzeitbasiert: `home_team_id === teamId`
- `TEAM_ID` + `TEAM_NAME` aus ENV → `/api/config` Endpoint → `TeamContext` im Frontend
- Alle Stats-Routen, Dashboard, MatchDetail, Team-Seite etc. nutzen dynamische Perspektive
- Labels: "Eigene Tore" statt "Wolfschl. Tore", `{teamName}` statt hardcoded

### match_events-Logik
Events werden unverändert gespeichert mit `team = 'Home'` / `team = 'Away'`. Bei der Auswertung wird der Team-Bezug über die View-Perspektive aufgelöst (`teamSide(match, teamId)`).

---

## 7.2 Liga-wide Fetch ✅

### Ablauf
1. Aus der `teams`-Tabelle (befüllt über Standings-Fetch) alle Team-IDs extrahieren
2. Für jedes Team (außer dem eigenen, bereits vorhanden): Spielplan fetchen
3. Für jedes beendete Spiel das noch keine Events hat: Ticker fetchen
4. Deduplication über `match_id` — Spiele zwischen zwei Liga-Teams tauchen in beiden Spielplänen auf, Upsert verhindert Duplikate

### Implementierung
- `fetchLeagueGames(dateFrom, dateTo)` in `server/fetcher/index.js`
- Lädt existierende Match-IDs + Matches-mit-Events vorab aus DB → skippt bereits vorhandene Ticker
- 2s Pause zwischen allen Requests

### Fetch-Endpunkt
`POST /api/fetch-data/league` — separater Admin-Endpunkt mit eigenem Locking

**Response:**
```json
{ "teams": 13, "newMatches": 34, "tickersFetched": 30, "errors": 0 }
```

### Cron (opt-in)
- `FETCH_LEAGUE_WIDE=true` in `.env` → wöchentlicher Cron Sonntags 04:00
- Ohne ENV-Variable: nur manuell über Admin-Endpoint

### Ergebnis (erster Fetch)
- 183 Spiele total (vorher 26), 161 mit Events, 13.165 Events (vorher ~1.500)
- Zweiter Fetch: 0 neue Spiele, 0 Ticker → idempotent

---

## 7.3 Gegner-Analyse-Seite (`/teams/:id`) ✅

Neue Seite `OpponentDetail.jsx` unter `/teams/:teamId`.

### Tabs
- **Übersicht**: Formkurve, Tore/Gegentore-Trend, Gesamt-Stats (Spiele, Tore/Spiel, Tordiff.), Heim vs. Auswärts
- **Spieler**: Sortierbare Tabelle mit Toren, 7m, 2'-Strafen, Gelbe/Rote Karten
- **Gegen uns**: Direkte Bilanz (Siege/U/N), Tore-Saldo, Liste aller gemeinsamen Spiele (klickbar)

### Backend
- Alle Stats-Endpoints (`/api/stats/*`) und `/api/matches` akzeptieren optionalen `?teamId=` Query-Param
- Fallback auf `TEAM_ID` aus ENV wenn kein Param übergeben

### Navigation
- Tabelle (Standings): Teamname als Link → Gegner-Seite (eigenes Team nicht klickbar)
- Team-Seite Gegner-Vergleich: Teamname als Link → Gegner-Seite
- Tabelle als eigene Route `/standings` mit Nav-Link

---

## 7.4 Gegner-Vorschau für bevorstehende Spiele ✅

Scouting-View direkt in `/matches/:id` für Spiele mit `state !== 'Post'`.

### Implementierung
- `MatchPreview`-Komponente in `MatchDetail.jsx` — wird statt der Tabs angezeigt wenn `state !== 'Post'`
- Match-Header zeigt "– : –" statt Ergebnis, keine Halbzeit-/Zuschauer-Zeile
- Pre-Spiele sind klickbar in MatchList und Dashboard (Nächste Spiele)

### Inhalt
- **Gegner-Profil**: Name, Tabellenplatz, Punkte, Saison-Bilanz (S/U/N), Tordurchschnitt
- **Formkurve**: Letzte 5 Spiele als S/U/N-Badges
- **Stärkste/Schwächste Phase**: Rolling 5-Min-Window Power/Death Phase des Gegners
- **Über-/Unterzahl**: Saisonweite Powerplay-/Shorthanded-Zusammenfassung
- **Top-Torschützen**: Die 5 besten Scorer des Gegners mit Spielanzahl
- **Direkter Vergleich**: H2H-Ergebnisse (falls bereits gespielt), klickbar
- **Link**: "Vollständige Gegner-Analyse →" verlinkt auf `/teams/:oppTeamId`

### Navigation
- MatchList: Alle Spiele (nicht nur Post) als Link umgestellt
- Dashboard Nächste Spiele: `<div>` → `<Link>` mit hover-Effekt

---

## Abhängigkeiten
- Phase 5 muss abgeschlossen sein (Ligatabelle → Team-IDs)
- Phase 6 ist unabhängig, sollte aber vorher fertig sein (Formkurve-Logik wird wiederverwendet)

## Datenmenge (gemessen)
- 14 Teams, ~183 Spiele total (inkl. eigene Spiele), 13.165 Events
- SQLite verkraftet das problemlos

## Status: 7.1–7.4 DONE
