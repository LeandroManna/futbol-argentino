from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_FILE = ROOT / "data" / "app-data.json"

STANDINGS_URL_ENV = "LIGA_STANDINGS_URL"
FIXTURE_URL_ENV = "LIGA_FIXTURE_URL"
EVENTS_URL_ENV = "LIGA_EVENTS_URL"

TEAM_LOGOS = {
    "ALD": "assets/icons/escudos/aldosivi.svg",
    "ARG": "assets/icons/escudos/argentinos.svg",
    "TUC": "assets/icons/escudos/atletico-tucuman.svg",
    "BAN": "assets/icons/escudos/banfield.svg",
    "BAC": "assets/icons/escudos/barracas-central.svg",
    "BEL": "assets/icons/escudos/belgrano.svg",
    "BOC": "assets/icons/escudos/boca.svg",
    "CCS": "assets/icons/escudos/central-cordoba.svg",
    "DYJ": "assets/icons/escudos/defensa-y-justicia.svg",
    "RIE": "assets/icons/escudos/deportivo-riestra.svg",
    "EST": "assets/icons/escudos/estudiantes.svg",
    "ERC": "assets/icons/escudos/estudiantes-rio-cuarto.svg",
    "GMD": "assets/icons/escudos/gimnasia-mendoza.svg",
    "GLP": "assets/icons/escudos/gimnasia-la-plata.svg",
    "HUR": "assets/icons/escudos/huracan.svg",
    "CAI": "assets/icons/escudos/independiente.svg",
    "IND": "assets/icons/escudos/independiente-rivadavia.svg",
    "INS": "assets/icons/escudos/instituto.svg",
    "LAN": "assets/icons/escudos/lanus.svg",
    "NOB": "assets/icons/escudos/newells.svg",
    "PLA": "assets/icons/escudos/platense.svg",
    "RAC": "assets/icons/escudos/racing.svg",
    "RIV": "assets/icons/escudos/river.svg",
    "ROS": "assets/icons/escudos/rosario-central.svg",
    "SLO": "assets/icons/escudos/san-lorenzo.svg",
    "SAR": "assets/icons/escudos/sarmiento.svg",
    "TAL": "assets/icons/escudos/talleres.svg",
    "TIG": "assets/icons/escudos/tigre.svg",
    "UNI": "assets/icons/escudos/union.svg",
    "VEL": "assets/icons/escudos/velez.svg",
}


def required_env(name: str):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Falta configurar la variable de entorno {name}")
    return value


def fetch_json(url: str):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8-sig"))


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def pick_score(match_details: dict):
    scores = match_details.get("scores") or {}
    total = scores.get("total") or {}
    ft = scores.get("ft") or {}
    ht = scores.get("ht") or {}
    source = total if total else ft
    return {
        "home": source.get("home"),
        "away": source.get("away"),
        "htHome": ht.get("home"),
        "htAway": ht.get("away"),
    }


def normalize_team(raw: dict):
    code = raw.get("code") or raw.get("contestantCode") or raw.get("contestantOptaSymId")
    return {
        "id": raw.get("id") or raw.get("contestantId"),
        "name": raw.get("name") or raw.get("contestantName"),
        "clubName": raw.get("clubName") or raw.get("contestantClubName") or raw.get("name") or raw.get("contestantName"),
        "shortName": raw.get("shortName") or raw.get("contestantShortName") or raw.get("name") or raw.get("contestantName"),
        "officialName": raw.get("officialName") or raw.get("contestantOptaOfficialName") or raw.get("contestantName"),
        "code": code,
        "nickname": raw.get("nickname") or raw.get("contestantNickname"),
        "logo": TEAM_LOGOS.get(code),
    }


def normalize_match(match: dict):
    info = match.get("matchInfo") or {}
    live = match.get("liveData") or {}
    details = live.get("matchDetails") or {}
    contestants = {c.get("position"): c for c in as_list(info.get("contestant"))}
    home = normalize_team(contestants.get("home") or {})
    away = normalize_team(contestants.get("away") or {})
    venue = info.get("venue") or {}
    stage = info.get("stage") or {}
    score = pick_score(details)
    cards = as_list(live.get("card"))
    subs = as_list(live.get("substitute"))

    return {
        "id": info.get("id"),
        "date": info.get("localDate") or info.get("date"),
        "time": (info.get("localTime") or info.get("time") or "")[:5],
        "week": info.get("week") or "Eliminatoria",
        "stage": stage.get("name"),
        "stageId": stage.get("id"),
        "status": details.get("matchStatus"),
        "winner": details.get("winner"),
        "home": home,
        "away": away,
        "score": score,
        "venue": {
            "id": venue.get("id"),
            "name": venue.get("longName") or venue.get("shortName"),
            "shortName": venue.get("shortName"),
            "lat": venue.get("latitude"),
            "lng": venue.get("longitude"),
        },
        "cardsCount": len(cards),
        "substitutionsCount": len(subs),
    }


def relegation_totals(relegation: dict):
    seasons = as_list((relegation or {}).get("season"))
    goals_for = sum(int(season.get("goalsPro") or 0) for season in seasons)
    goals_against = sum(int(season.get("goalsAgainst") or 0) for season in seasons)
    return {
        "played": (relegation or {}).get("matchesPlayedTotal"),
        "points": (relegation or {}).get("pointsTotal"),
        "average": (relegation or {}).get("relegationAverage"),
        "goalsFor": goals_for,
        "goalsAgainst": goals_against,
        "goalDifference": goals_for - goals_against,
        "seasons": seasons,
    }


def normalize_standings(standings: dict):
    data = standings.get("data") or {}
    stages = []
    teams_meta = {}

    for stage in as_list(data.get("stage")):
        divisions_by_type = {}
        for division in as_list(stage.get("division")):
            table_type = division.get("type") or "total"
            group_name = division.get("groupName") or "General"
            rows = []
            for row in as_list(division.get("ranking")):
                team = normalize_team(row)
                if team.get("id"):
                    teams_meta[team["id"]] = {**teams_meta.get(team["id"], {}), **team}
                rel = relegation_totals(row.get("relegation")) if row.get("relegation") else None
                rows.append({
                    "rank": row.get("rank"),
                    "rankStatus": row.get("rankStatus"),
                    "teamId": row.get("contestantId"),
                    "team": row.get("contestantName"),
                    "clubName": row.get("contestantClubName") or row.get("contestantName"),
                    "shortName": row.get("contestantShortName") or row.get("contestantName"),
                    "code": row.get("contestantCode"),
                    "logo": TEAM_LOGOS.get(row.get("contestantCode")),
                    "points": row.get("points"),
                    "played": row.get("matchesPlayed") or (rel or {}).get("played"),
                    "won": row.get("matchesWon"),
                    "drawn": row.get("matchesDrawn"),
                    "lost": row.get("matchesLost"),
                    "goalsFor": row.get("goalsFor") if row.get("goalsFor") is not None else (rel or {}).get("goalsFor"),
                    "goalsAgainst": row.get("goalsAgainst") if row.get("goalsAgainst") is not None else (rel or {}).get("goalsAgainst"),
                    "goalDifference": row.get("goaldifference") if row.get("goaldifference") is not None else (rel or {}).get("goalDifference"),
                    "lastSix": row.get("lastSix"),
                    "relegationAverage": (rel or {}).get("average"),
                    "relegation": rel,
                })
            divisions_by_type.setdefault(table_type, []).append({
                "groupId": division.get("groupId"),
                "groupName": group_name,
                "rows": rows,
            })

        stages.append({
            "id": stage.get("id"),
            "name": stage.get("name"),
            "phase": stage.get("phase"),
            "startDate": stage.get("startDate"),
            "endDate": stage.get("endDate"),
            "divisions": divisions_by_type,
        })

    return {
        "competition": data.get("competition") or {},
        "season": data.get("tournamentCalendar") or {},
        "lastUpdated": data.get("lastUpdated"),
        "stages": stages,
        "teamsMeta": teams_meta,
    }


def normalize_events(events: dict):
    data = events.get("data") or {}
    output = []
    for fecha in as_list(data.get("fechas")):
        for torneo in as_list(fecha.get("torneos")):
            for event in as_list(torneo.get("events")):
                if (torneo.get("nombre") or "").lower().find("liga profesional") == -1:
                    continue
                teams = event.get("teams") or {}
                output.append({
                    "mamId": event.get("mamId"),
                    "date": fecha.get("fecha") or event.get("fecha"),
                    "time": event.get("horaDia"),
                    "name": event.get("nombre"),
                    "home": (teams.get("home") or {}).get("name"),
                    "away": (teams.get("away") or {}).get("name"),
                    "channels": [c.get("name") for c in as_list(event.get("canales")) if c.get("name")],
                    "url": event.get("url"),
                })
    return output


def build_teams(matches, teams_meta):
    teams = {team_id: dict(team) for team_id, team in teams_meta.items()}
    stats = defaultdict(lambda: {
        "played": 0,
        "won": 0,
        "drawn": 0,
        "lost": 0,
        "goalsFor": 0,
        "goalsAgainst": 0,
        "upcoming": 0,
        "homeVenues": Counter(),
        "recentMatches": [],
    })

    for match in matches:
        for side in ("home", "away"):
            team = match[side]
            if team.get("id"):
                teams[team["id"]] = {**teams.get(team["id"], {}), **team}
        home_id = match["home"].get("id")
        away_id = match["away"].get("id")
        home_score = match["score"].get("home")
        away_score = match["score"].get("away")
        venue_name = match["venue"].get("name")
        if home_id and venue_name:
            stats[home_id]["homeVenues"][venue_name] += 1
        if match.get("status") == "Fixture":
            if home_id:
                stats[home_id]["upcoming"] += 1
            if away_id:
                stats[away_id]["upcoming"] += 1
        if match.get("status") != "Played" or home_score is None or away_score is None:
            continue
        for team_id, gf, ga in ((home_id, home_score, away_score), (away_id, away_score, home_score)):
            if not team_id:
                continue
            stats[team_id]["played"] += 1
            stats[team_id]["goalsFor"] += int(gf)
            stats[team_id]["goalsAgainst"] += int(ga)
            if gf > ga:
                stats[team_id]["won"] += 1
            elif gf == ga:
                stats[team_id]["drawn"] += 1
            else:
                stats[team_id]["lost"] += 1
            stats[team_id]["recentMatches"].append({
                "date": match["date"],
                "stage": match["stage"],
                "home": match["home"]["shortName"],
                "away": match["away"]["shortName"],
                "score": f"{home_score}-{away_score}",
            })

    output = []
    for team_id, team in teams.items():
        item_stats = stats[team_id]
        home_venue = item_stats["homeVenues"].most_common(1)
        output.append({
            **team,
            "homeVenue": home_venue[0][0] if home_venue else None,
            "stats": {
                "played": item_stats["played"],
                "won": item_stats["won"],
                "drawn": item_stats["drawn"],
                "lost": item_stats["lost"],
                "goalsFor": item_stats["goalsFor"],
                "goalsAgainst": item_stats["goalsAgainst"],
                "goalDifference": item_stats["goalsFor"] - item_stats["goalsAgainst"],
                "upcoming": item_stats["upcoming"],
            },
            "recentMatches": sorted(item_stats["recentMatches"], key=lambda row: row["date"], reverse=True)[:5],
        })
    return sorted(output, key=lambda item: item.get("clubName") or item.get("name") or "")


def main():
    standings_raw = fetch_json(required_env(STANDINGS_URL_ENV))
    fixture = fetch_json(required_env(FIXTURE_URL_ENV))
    events = fetch_json(required_env(EVENTS_URL_ENV))

    matches = [normalize_match(match) for match in as_list((fixture.get("data") or {}).get("match"))]
    matches.sort(key=lambda item: (item.get("date") or "", item.get("time") or ""))

    standings = normalize_standings(standings_raw)
    teams = build_teams(matches, standings.pop("teamsMeta"))

    status_counts = Counter(match.get("status") or "Sin dato" for match in matches)
    stage_counts = Counter(match.get("stage") or "Sin etapa" for match in matches)

    app_data = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "signature": {
            "name": "leandro manna",
            "portfolio": "https://leandromanna.com",
        },
        "summary": {
            "matches": len(matches),
            "teams": len(teams),
            "played": status_counts.get("Played", 0),
            "fixtures": status_counts.get("Fixture", 0),
            "playing": status_counts.get("Playing", 0),
            "stages": dict(stage_counts),
        },
        "standings": standings,
        "matches": matches,
        "teams": teams,
        "todayEvents": normalize_events(events),
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as fh:
        json.dump(app_data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"OK: {OUT_FILE} ({len(matches)} partidos, {len(teams)} equipos)")


if __name__ == "__main__":
    main()




