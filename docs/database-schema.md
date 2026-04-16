# Datenbank-Schema

SQLite-Datenbank via `better-sqlite3`. Datei: `server/data/handball.db` (gitignored, wird beim Start automatisch erstellt).

Pragmas: `journal_mode = WAL`, `foreign_keys = ON`.

## Tabelle: `matches`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | TEXT PK | handball.net Game-ID (z.B. `handball4all.baden-wuerttemberg.8615446`) |
| `home_team_id` | TEXT NOT NULL | ID der Heimmannschaft |
| `home_team_name` | TEXT NOT NULL | Name der Heimmannschaft |
| `away_team_id` | TEXT NOT NULL | ID der Gastmannschaft |
| `away_team_name` | TEXT NOT NULL | Name der Gastmannschaft |
| `home_goals` | INTEGER | Endstand Heim (NULL wenn noch nicht gespielt) |
| `away_goals` | INTEGER | Endstand Gast |
| `home_goals_half` | INTEGER | Halbzeitstand Heim |
| `away_goals_half` | INTEGER | Halbzeitstand Gast |
| `starts_at` | INTEGER NOT NULL | Anpfiff als Unix-Timestamp (ms) |
| `state` | TEXT NOT NULL | `Pre`, `Post`, `Live` |
| `venue_name` | TEXT | Name der Halle |
| `venue_city` | TEXT | Stadt |
| `league` | TEXT | Liga-Name |
| `referee_info` | TEXT | Schiedsrichter |
| `attendance` | INTEGER | Zuschauer |
| `game_number` | TEXT | Spielnummer |
| `is_home_game` | INTEGER NOT NULL DEFAULT 0 | ⚠️ Deprecated — wird nicht mehr gelesen, immer 0. Heimspiel-Erkennung erfolgt zur Laufzeit über `home_team_id === teamId` |
| `fetched_at` | TEXT | ISO-Timestamp des letzten erfolgreichen Fetches |

## Tabelle: `teams`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | TEXT PK | handball.net Team-ID (z.B. `handball4all.baden-wuerttemberg.1331231`) |
| `name` | TEXT NOT NULL | Vereinsname |
| `league` | TEXT | Liga-Name |

Wird automatisch beim Ligatabellen-Fetch (`standings.js`) befüllt/aktualisiert via Upsert.

## Tabelle: `match_events`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | INTEGER PK | Auto-increment |
| `match_id` | TEXT NOT NULL FK | Referenz auf `matches.id` (CASCADE DELETE) |
| `event_id` | INTEGER NOT NULL | Event-ID von handball.net |
| `type` | TEXT NOT NULL | Event-Typ (s. data-source.md) |
| `time` | TEXT NOT NULL | Spielzeit als `"MM:SS"` |
| `elapsed_seconds` | INTEGER | Spielzeit in Sekunden (berechnet) |
| `score_home` | INTEGER | Spielstand Heim nach diesem Event |
| `score_away` | INTEGER | Spielstand Gast nach diesem Event |
| `team` | TEXT | `"Home"`, `"Away"`, oder NULL |
| `player_name` | TEXT | Spielername (geparst aus Message) |
| `player_number` | INTEGER | Trikotnummer (geparst aus Message) |
| `message` | TEXT | Original-Nachricht von handball.net |

**Unique Constraint**: `(match_id, event_id)` — verhindert Duplikate beim Re-Fetch.

## Indizes

- `idx_events_match` auf `match_events(match_id)` — schnelle Event-Abfrage pro Spiel
- `idx_matches_starts` auf `matches(starts_at)` — Sortierung nach Datum

## Tabelle: `standings`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `team_id` | TEXT PK | Referenz auf `teams.id` |
| `team_name` | TEXT NOT NULL | Vereinsname |
| `rank` | INTEGER NOT NULL | Tabellenplatz |
| `games` | INTEGER | Spiele |
| `wins` | INTEGER | Siege |
| `draws` | INTEGER | Unentschieden |
| `losses` | INTEGER | Niederlagen |
| `goals_for` | INTEGER | Tore erzielt |
| `goals_against` | INTEGER | Tore kassiert |
| `goal_diff` | INTEGER | Tordifferenz |
| `points_pos` | INTEGER | Pluspunkte |
| `points_neg` | INTEGER | Minuspunkte |
| `fetched_at` | TEXT | ISO-Timestamp des letzten Fetches |

## Write-Strategie

- Pro Spiel als Transaction: Match upsert + alle Events (delete + re-insert)
- `fetched_at` wird erst nach erfolgreichem Write gesetzt
- Bei Fehler: Transaction rollback, bestehende Daten bleiben erhalten

## Multi-Tenant-Design

Die App ist team-agnostisch: Das „eigene" Team wird über `TEAM_ID` / `TEAM_NAME` in der ENV konfiguriert und über `/api/config` ans Frontend geliefert. Alle teamspezifischen Berechnungen (Heim/Auswärts, Sieg/Niederlage, eigene Tore) werden zur Laufzeit über `home_team_id === teamId` aufgelöst. Es gibt keine Wolfschlugen-spezifischen Spalten oder Felder in der Datenbank.
