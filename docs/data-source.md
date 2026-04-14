# Datenquelle: handball.net RSC-API

## Prinzip

handball.net ist eine Next.js-App. Wenn man Seiten mit dem HTTP-Header `RSC: 1` abruft, liefert der Server statt HTML eine **RSC Flight Response** — ein zeilenbasiertes Format mit eingebetteten JSON-Objekten. Daraus extrahieren wir strukturierte Spieldaten, ohne HTML parsen zu müssen.

## URL-Patterns

### Spielplan (alle Spiele eines Teams)
```
GET https://www.handball.net/mannschaften/{TEAM_ID}/spielplan?dateFrom={YYYY-MM-DD}&dateTo={YYYY-MM-DD}
Header: RSC: 1
```
Liefert ein Array von `GameSummary`-Objekten.

### Ticker (Spielverlauf eines einzelnen Spiels)
```
GET https://www.handball.net/spiele/{GAME_ID}/ticker
Header: RSC: 1
```
Liefert ein `GameSummary`-Objekt + ein `initialEvents`-Array.

### Weitere Seiten (aktuell nicht verwendet)
- `/spiele/{GAME_ID}/info` — Spielinfo (Ort, SR, Zuschauer)
- `/spiele/{GAME_ID}/aufstellung` — Aufstellung mit Spielerstatistiken
- `/spiele/{GAME_ID}/spielbericht` — Spielbericht

## RSC Flight Format

Zeilenbasiert, jede Zeile hat das Format `ID:PAYLOAD`. Payloads die mit `[` oder `{` beginnen sind JSON. Relevante Daten stecken verschachtelt in Arrays/Objekten.

## GameSummary-Objekt

```json
{
  "id": "handball4all.baden-wuerttemberg.8615446",
  "type": "GameSummary",
  "state": "Post",
  "startsAt": 1758391200000,
  "homeGoals": 27,
  "awayGoals": 30,
  "homeGoalsHalf": null,
  "awayGoalsHalf": null,
  "attendance": 400,
  "gameNumber": "900423",
  "refereeInfo": "Konstantin Geis, Jörg Hanselmann",
  "homeTeam": {
    "id": "handball4all.baden-wuerttemberg.1331231",
    "name": "TSV Wolfschlugen",
    "type": "TeamSummary"
  },
  "awayTeam": {
    "id": "handball4all.baden-wuerttemberg.1331186",
    "name": "SG Hegensberg-Liebersbronn",
    "type": "TeamSummary"
  },
  "field": {
    "id": "handball4all.baden-wuerttemberg.229",
    "name": "Sporthalle beim Sportzentrum",
    "city": "Wolfschlugen",
    "type": "FieldSummary"
  },
  "tournament": {
    "name": "Baden-Württembergischer Handball-Verband - Männer-Oberliga Staffel 2",
    "type": "TournamentSummary"
  }
}
```

### `state`-Werte
- `Pre` — Spiel steht noch aus
- `Post` — Spiel beendet
- `Live` — Spiel läuft (selten relevant für uns)

## Event-Objekt (aus initialEvents)

```json
{
  "id": 6,
  "type": "Goal",
  "time": "00:32",
  "score": "1:0",
  "timestamp": 1775928805539,
  "team": "Home",
  "message": "Tor durch Jan Knaus (14.) (Saase3 Leutershausen Handball 2)"
}
```

### Event-Typen

| Type | Beschreibung | Hat Score | Hat Spieler |
|------|-------------|-----------|-------------|
| `Goal` | Feldtor | Ja | Ja |
| `SevenMeterGoal` | 7-Meter Tor | Ja | Ja |
| `SevenMeterMissed` | 7-Meter daneben | Nein | Ja |
| `TwoMinutePenalty` | 2-Minuten-Strafe | Nein | Ja |
| `Warning` | Gelbe Karte | Nein | Ja |
| `Timeout` | Auszeit | Nein | Nein (nur Team) |
| `Disqualification` | Rote Karte / Disqualifikation | Nein | Ja |
| `StopPeriod` | Halbzeit / Spielende | Ja | Nein |

### `team`-Werte
- `"Home"` — Heimmannschaft
- `"Away"` — Gastmannschaft
- `null` — Kein Team (bei StopPeriod)

### Message-Patterns
```
"Tor durch {Name} ({Nr}.) ({Team})"
"7-Meter Tor durch {Name} ({Nr}.) ({Team})"
"7-Meter verworfen durch {Name} ({Nr}.) ({Team})"
"{Name} ({Nr}.) ({Team}) erhält eine 2-Minuten Strafe"
"{Name} ({Nr}.) ({Team}) wurde verwarnt"
"{Name} ({Nr}.) ({Team}) wurde disqualifiziert"
"Auszeit {Team}"
"Spielstand 1. Halbzeit" / "Spielstand 2. Halbzeit"
"Spielabschluss mit Pins Heim/Gast/SRA/SRB"
```

## Rate Limiting

- 1-2 Sekunden Pause zwischen Requests
- Ein Spielplan-Request + ein Ticker-Request pro Spiel
- Bei 26 Spielen pro Saison: ~35 Sekunden Gesamtdauer
