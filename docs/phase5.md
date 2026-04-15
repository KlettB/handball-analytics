# Phase 5: Ligatabelle + Spielkontext

## Ziel
Jedes Spiel bekommt Bedeutung durch Liga-Kontext: Tabellenstand, Platzierung des Gegners, Punktgewinn/-verlust.

## Hintergrund
Aktuell zeigt die App Ergebnisse ohne Kontext. Ein 27:26-Sieg bedeutet etwas anderes gegen den Tabellenführer als gegen den Letzten. Die Ligatabelle ist das Fundament für Phase 7 (Liga-wide Data), weil sie alle Team-IDs der Liga liefert.

## Features

### 5.1 Ligatabelle fetchen + speichern
- Neue RSC-URL erkunden: `/turniere/{TOURNAMENT_ID}/tabelle` oder aus dem Spielplan-Response extrahieren
- Neue DB-Tabelle `standings` anlegen:
  - `team_id`, `team_name`, `rank`, `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `points`, `fetched_at`
- Fetch im bestehenden Cron-Job mitlaufen lassen (nach Spielplan-Fetch)
- Neuer API-Endpoint: `GET /api/standings`

### 5.2 Spielliste — Kontext-Badge pro Spiel
- Tabellenplatz des Gegners zum Spielzeitpunkt (oder aktuell, wenn nur ein Snapshot)
- Badge: z.B. "Platz 1", "Platz 12" in der Spielliste und im Match-Header
- Farbkodierung: Top-4 = grün, Mittelfeld = grau, Abstiegszone = rot

### 5.3 Neue Seite: Ligatabelle (`/tabelle`)
- Vollständige Tabellendarstellung
- Wolfschlugen hervorgehoben
- Spalten: Pl. · Mannschaft · Sp · S · U · N · Tore · Diff · Punkte
- Navigation in der Navbar

### 5.4 Spielkontext im Match-Header
- Match-Detail-Seite: unter dem Ergebnis klein anzeigen
  - Tabellenplatz Wolf zu dem Zeitpunkt (aus Punktestand errechenbar wenn wir Spielreihenfolge kennen)
  - Alternativ: aktueller Tabellenplatz beider Teams als Kontext-Zeile

## Datenquelle
handball.net Turnier-Tabellen-Seite — muss zunächst erkundet werden (RSC-Response-Struktur noch unbekannt, analog zum Ticker-Fetch vorgehen).

## Abhängigkeiten
Keine — kann unabhängig von Phase 6/7 gebaut werden.

## Status: TODO
