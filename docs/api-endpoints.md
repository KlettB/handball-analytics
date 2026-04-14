# REST API Spezifikation

Server: Express auf Port 3001 (konfigurierbar via `PORT` in `.env`).

## Endpoints

### `GET /api/matches`

Alle Spiele, sortiert nach Datum absteigend.

**Response** `200`:
```json
[
  {
    "id": "handball4all.baden-wuerttemberg.8615446",
    "home_team_id": "handball4all.baden-wuerttemberg.1331231",
    "home_team_name": "TSV Wolfschlugen",
    "away_team_id": "handball4all.baden-wuerttemberg.1331186",
    "away_team_name": "SG Hegensberg-Liebersbronn",
    "home_goals": 27,
    "away_goals": 26,
    "home_goals_half": null,
    "away_goals_half": null,
    "starts_at": 1758391200000,
    "state": "Post",
    "venue_name": "Sporthalle beim Sportzentrum",
    "venue_city": "Wolfschlugen",
    "league": "Baden-Württembergischer Handball-Verband - Männer-Oberliga Staffel 2",
    "referee_info": "Konstantin Geis, Jörg Hanselmann",
    "attendance": 400,
    "game_number": "900423",
    "is_home_game": 1,
    "fetched_at": "2026-04-14T17:20:00.000Z"
  }
]
```

---

### `GET /api/matches/:id`

Einzelnes Spiel mit allen Events.

**Parameter**: `id` — die handball.net Game-ID

**Response** `200`: Match-Objekt + `events`-Array:
```json
{
  "id": "...",
  "home_team_name": "TSV Wolfschlugen",
  "away_team_name": "SG Hegensberg-Liebersbronn",
  "home_goals": 27,
  "away_goals": 26,
  "events": [
    {
      "id": 1,
      "match_id": "...",
      "event_id": 6,
      "type": "Goal",
      "time": "01:22",
      "elapsed_seconds": 82,
      "score_home": 0,
      "score_away": 1,
      "team": "Away",
      "player_name": "Alexander Stammhammer",
      "player_number": 9,
      "message": "Tor durch Alexander Stammhammer (9.) (SG Hegensberg-Liebersbronn)"
    }
  ]
}
```

Events sind sortiert nach `elapsed_seconds ASC, event_id ASC`.

**Response** `404`:
```json
{ "error": "Match not found" }
```

---

### `POST /api/fetch-data`

Manueller Trigger für Daten-Fetch. Nur für Entwicklung/Debugging.

**Body**: keiner nötig

**Response** `200`:
```json
{
  "total": 26,
  "fetched": 23,
  "errors": 0,
  "upcoming": 3
}
```

**Response** `409` (bereits laufend):
```json
{ "error": "Fetch already in progress" }
```

---

### `GET /api/health`

Health-Check.

**Response** `200`:
```json
{ "status": "ok", "time": "2026-04-14T17:20:00.000Z" }
```
