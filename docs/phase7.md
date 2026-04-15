# Phase 7: Liga-wide Data + Gegner-Insights

## Ziel
Alle Spiele aller Mannschaften der Liga fetchen und speichern. Darauf aufbauend: vollständige Gegner-Analysen und eine dedizierte Vorschau-Ansicht für bevorstehende Spiele.

## Hintergrund
Heute speichern wir nur Spiele von Wolfschlugen. Begegnet Wolfschlugen einem Gegner, haben wir dessen Daten nur aus 1–2 gemeinsamen Spielen — zu wenig für echtes Scouting. Mit Liga-wide Data sehen wir jeden Gegner über seine komplette Saison.

---

## 7.1 Schema-Erweiterung

### Neue Tabelle: `teams`
```sql
CREATE TABLE teams (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT
);
```

### Anpassung `matches`
- `is_home_game` bleibt **Wolfschlugen-relativ** (1 = Wolf ist Heim), aber bei nicht-Wolf-Spielen NULL
- Neue Spalte `is_wolf_match INTEGER DEFAULT 0` — 1 wenn Wolfschlugen beteiligt
- Alle bestehenden Daten: `is_wolf_match = 1`

### Neue match_events-Logik
Events werden unverändert gespeichert mit `team = 'Home'` / `team = 'Away'`. Bei der Auswertung im Frontend wird der "relevante" Team-Bezug über die View-Perspektive aufgelöst (welches Team gerade betrachtet wird).

---

## 7.2 Liga-wide Fetch

### Ablauf
1. Aus der Ligatabelle (Phase 5) alle Team-IDs extrahieren
2. Für jedes Team (außer Wolfschlugen, bereits vorhanden): Spielplan fetchen
3. Für jedes Spiel das noch nicht in der DB ist: Ticker fetchen
4. Bei Spielen zwischen zwei Nicht-Wolf-Teams: beide `is_wolf_match = 0`
5. Deduplication über `(match_id)` — Spiele zwischen zwei Liga-Teams tauchen in beiden Spielplänen auf

**Neue ENV-Variable:** `FETCH_LEAGUE_WIDE=true` — opt-in, da ca. 10× mehr Requests
**Rate Limiting:** 2s Pause zwischen Requests, ~200 Spiele × ~35s = ~20 Min Gesamtdauer

### Neuer Fetch-Endpunkt
`POST /api/fetch-league` — separater Admin-Endpunkt, löst Liga-wide Fetch aus (nicht im Nightly-Cron, da zu langsam — oder als separater wöchentlicher Cron)

---

## 7.3 Gegner-Analyse-Seite (`/teams/:id`)

Für jeden Gegner eine eigene Analyse-Seite — analog zur Team-Seite von Wolfschlugen, aber aus neutraler Perspektive.

### Tabs
- **Übersicht**: Saison-Bilanz, Heim/Auswärts, Tordurchschnitt
- **Phasenanalyse**: Schwächephasen, Über-/Unterzahl (aus Gegner-Sicht)
- **Spieler**: Top-Torschützen, meiste Strafen (wer sollte man im Auge behalten?)
- **Gegen Wolf**: Alle gemeinsamen Spiele, direkte Bilanz

### Navigation
- Von Spielliste: Klick auf Gegner-Teamnamen → Gegner-Seite
- Von Gegner-Vergleich (Team.jsx): Klick auf Teamnamen → Gegner-Seite

---

## 7.4 Gegner-Vorschau (`/matches/:id/preview`) für bevorstehende Spiele

Dedizierte Scouting-View für Spiele die noch bevorstehen (`state = 'Pre'`).

### Inhalt
- **Kopfzeile**: Datum, Uhrzeit, Heim/Auswärts für Wolf, aktueller Tabellenplatz des Gegners
- **Gegner-Saison-Bilanz**: Siege/Unentschieden/Niederlagen, Tordurchschnitt, Heimstärke vs. Auswärts
- **Formkurve des Gegners**: Letzte 5 Spiele (S/U/N-Badges)
- **Stärken**: In welcher Phase trifft der Gegner am häufigsten? (Power-Phase des Gegners)
- **Schwächen**: In welcher Phase kassiert der Gegner? (Death-Phase des Gegners)
- **Schlüsselspieler**: Top-3 Torschützen, meiste 2-Minuten-Strafen
- **Head-to-Head** (falls bereits gespielt): Ergebnis des Hinspiels

### Navigation
- Spielliste: "Pre"-Spiele bekommen einen "Vorschau"-Button zusätzlich zum normalen Klick
- Von der Spielliste direkt erreichbar

---

## Abhängigkeiten
- Phase 5 muss abgeschlossen sein (Ligatabelle → Team-IDs)
- Phase 6 ist unabhängig, sollte aber vorher fertig sein (Formkurve-Logik wird wiederverwendet)

## Datenmenge (Schätzung)
- Liga: ~12 Teams, ~22 Spieltage, ~120 Spiele total (inkl. Wolf-Spiele)
- Events: ~60 Events/Spiel × 120 Spiele = ~7.200 Events
- SQLite verkraftet das problemlos (aktuell ~1.500 Events für Wolf allein)

## Status: TODO
