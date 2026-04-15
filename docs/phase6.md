# Phase 6: Power-/Death-Phasen + Formkurve

## Ziel
Zwei analytische Features die aus vorhandenen Daten echte Insights destillieren — ohne neuen Fetch.

---

## 6.1 Power-Phase / Death-Phase

### Idee
Nicht alle 12 Blöcke gleichberechtigt anzeigen, sondern die **stärkste** und **schwächste** Phase automatisch hervorheben. "In Minute 20–30 schießt Wolfschlugen saison-übergreifend die meisten Tore. In Minute 50–55 kassieren wir am meisten."

### Technischer Ansatz
Rollierendes 5-Minuten-Fenster statt fixer Blöcke: alle möglichen Startpunkte (0, 1, 2, ... 55) durchrechnen, bestes und schlechtestes Fenster für Wolf-Tore bzw. Gegentore finden. Das ist analytisch präziser als feste 5-Minuten-Raster.

**Neuer API-Endpoint:** `GET /api/stats/phases/extremes`
```json
{
  "powerPhase": { "start": 22, "end": 27, "wolfGoals": 18, "oppGoals": 4, "net": 14 },
  "deathPhase": { "start": 51, "end": 56, "wolfGoals": 3, "oppGoals": 17, "net": -14 }
}
```

### UI
- Oben in der Phasenanalyse: zwei große Cards nebeneinander
  - "Power-Phase ⚡ 22'–27'" — grüner Accent
  - "Schwächephase ⚠ 51'–56'" — roter Accent
  - Darunter: Wolf-Tore, Gegentore, Netto
- Filterbar (Heim/Auswärts, Halbzeit) — nutzt bestehende Filter-Logik
- Darunter weiterhin die bekannte Balken-Übersicht für alle Blöcke

---

## 6.2 Saison-Formkurve

### Idee
Ein Chart über alle gespielten Spiele (chronologisch): Wie entwickelt sich das Team? Zeigt Aufwärts-/Abwärtstrends, Hot-Streaks und schlechte Phasen.

### Darstellung
Zwei überlagerte Linien im selben Chart (Recharts):
1. **Tordifferenz pro Spiel** (Balken oder Linie, Achse links) — schnelles Signal ob Sieg/Niederlage und wie deutlich
2. **Laufende Punkte** (Linie, Achse rechts) — kumulativ, zeigt Gesamtentwicklung

Tooltip: Gegner, Ergebnis, Datum, Spielnummer

**Neuer API-Endpoint:** `GET /api/stats/form`
```json
[
  { "matchId": "...", "date": 1758391200000, "opponent": "SG Hegensberg", "own": 27, "opp": 26, "diff": 1, "result": "win", "points": 2, "cumulativePoints": 2, "gameIndex": 1 },
  ...
]
```

### UI
- Neue Card in Team-Übersicht oben (vor den Gesamt-Stats) — die wichtigste Frage: *Wie läuft's gerade?*
- Letzte-5-Spiele Indikator: "Aktuelle Form: S S N S S" als Badge-Reihe
- Klick auf Datenpunkt öffnet Spieldetail

---

---

## 6.3 Tore/Gegentore-Entwicklung über Spiele

### Idee
Chart der geschossenen Tore und Gegentore über alle Spiele hinweg (chronologisch) — zeigt wie sich Angriff und Abwehr über die Saison entwickeln. Trending up oder down?

### Darstellung
Zwei Linien (Recharts):
- **Tore erzielt** (grün) — pro Spiel
- **Tore kassiert** (rot) — pro Spiel

Optional: gleitender Durchschnitt über 3 Spiele als gestrichelte Linie drüber.

Tooltip: Gegner, Ergebnis, genaue Tore.

### Filter
- Heim / Auswärts / Alle
- 1. Halbzeit / 2. Halbzeit / Gesamt

Bei Halbzeit-Filter: Halbzeittore aus `home_goals_half` / `away_goals_half` (matches-Tabelle) bzw. aus Events berechnen.

### UI
- Eigene Card in Team-Analyse Übersicht (nach Formkurve)
- Oder als separater Tab in der Phasenanalyse

### Datenbasis
Alles vorhanden — keine neuen Fetches nötig.

---

## Abhängigkeiten
Keine — alle Daten bereits vorhanden.

## Status: DONE
