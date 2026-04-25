import os
import statistics
import warnings
from dotenv import load_dotenv

load_dotenv()


def calculate_hitting_percentage(kills, attempts, errors):
    kills = int(kills or 0)
    attempts = int(attempts or 0)
    errors = int(errors or 0)

    if attempts <= 0:
        return 0.0

    return round((kills - errors) / attempts, 3)


def calculate_performance_score(payload):
    kills = float(payload.get("kills", 0) or 0)
    aces = float(payload.get("aces", 0) or 0)
    blocks = float(payload.get("blocks", 0) or 0)
    digs = float(payload.get("digs", 0) or 0)
    assists = float(payload.get("assists", 0) or 0)
    errors = float(payload.get("attack_errors", 0) or 0)
    receive = float(payload.get("receive_rating") or 0)

    raw_score = (
        kills * 4
        + aces * 3
        + blocks * 3
        + digs * 1.5
        + assists * 1.2
        + receive * 2
        - errors * 2
    )

    return round(max(raw_score, 0), 2)


def calculate_metric_delta(player_value, team_value):
    player_value = float(player_value or 0)
    team_value = float(team_value or 0)
    return round(player_value - team_value, 2)


def calculate_season_averages(stats):
    if not stats:
        return {
            "matchesPlayed": 0,
            "kills": 0,
            "attackAttempts": 0,
            "attackErrors": 0,
            "aces": 0,
            "blocks": 0,
            "digs": 0,
            "assists": 0,
            "receiveRating": 0,
            "hittingPercentage": 0,
            "performanceScore": 0,
        }

    count = len(stats)

    def avg(attr):
        return round(sum(float(getattr(stat, attr) or 0) for stat in stats) / count, 2)

    return {
        "matchesPlayed": count,
        "kills": avg("kills"),
        "attackAttempts": avg("attack_attempts"),
        "attackErrors": avg("attack_errors"),
        "aces": avg("aces"),
        "blocks": avg("blocks"),
        "digs": avg("digs"),
        "assists": avg("assists"),
        "receiveRating": avg("receive_rating"),
        "hittingPercentage": round(sum(float(stat.hitting_percentage or 0) for stat in stats) / count, 3),
        "performanceScore": avg("performance_score"),
    }


def calculate_team_match_aggregate(stats):
    if not stats:
        return {
            "averagePerformanceScore": 0,
            "averageHittingPercentage": 0,
            "totalKills": 0,
            "totalAttackAttempts": 0,
            "totalAttackErrors": 0,
            "totalAces": 0,
            "totalBlocks": 0,
            "totalDigs": 0,
            "totalAssists": 0,
            "strongestMetric": "No data",
            "weakestMetric": "No data",
        }

    total_kills = sum(stat.kills or 0 for stat in stats)
    total_attempts = sum(stat.attack_attempts or 0 for stat in stats)
    total_errors = sum(stat.attack_errors or 0 for stat in stats)
    total_aces = sum(stat.aces or 0 for stat in stats)
    total_blocks = sum(stat.blocks or 0 for stat in stats)
    total_digs = sum(stat.digs or 0 for stat in stats)
    total_assists = sum(stat.assists or 0 for stat in stats)

    avg_score = round(statistics.mean([stat.performance_score or 0 for stat in stats]), 2)
    avg_hit = round(statistics.mean([stat.hitting_percentage or 0 for stat in stats]), 3)

    positive_metric_map = {
        "Attack production": total_kills,
        "Serving pressure": total_aces,
        "Blocking": total_blocks,
        "Floor defense": total_digs,
        "Playmaking": total_assists,
    }

    strongest_metric = max(positive_metric_map, key=positive_metric_map.get)
    weakest_metric = min(positive_metric_map, key=positive_metric_map.get)

    if total_attempts > 0 and total_errors / total_attempts > 0.25:
        weakest_metric = "Attack efficiency"

    return {
        "averagePerformanceScore": avg_score,
        "averageHittingPercentage": avg_hit,
        "totalKills": total_kills,
        "totalAttackAttempts": total_attempts,
        "totalAttackErrors": total_errors,
        "totalAces": total_aces,
        "totalBlocks": total_blocks,
        "totalDigs": total_digs,
        "totalAssists": total_assists,
        "strongestMetric": strongest_metric,
        "weakestMetric": weakest_metric,
    }


def build_fallback_player_feedback(player_name, position, stat, tone="standard", team_average_score=None, coach_notes=""):
    score_delta = None
    if team_average_score is not None:
        score_delta = round((stat.performance_score or 0) - team_average_score, 2)

    comparison = ""
    if score_delta is not None:
        comparison = (
            f" That is {'above' if score_delta >= 0 else 'below'} the team average "
            f"by {abs(score_delta)} points."
        )

    notes_sentence = (
        f" Coach note: {coach_notes.strip()}"
        if coach_notes
        else ""
    )

    if tone == "encouraging":
        return (
            f"{player_name} gave a strong effort as {position or 'a versatile player'}, finishing with "
            f"{stat.kills} kills, {stat.digs} digs, and a performance score of {stat.performance_score}."
            f"{comparison}{notes_sentence} Next practice should focus on reducing attack errors and improving first-contact consistency."
        )

    if tone == "direct":
        return (
            f"{player_name} recorded {stat.performance_score} performance points with {stat.kills} kills, "
            f"{stat.attack_errors} attack errors, and a {stat.hitting_percentage} hitting percentage."
            f"{comparison}{notes_sentence} Priority improvement: clean up attack decisions under pressure."
        )

    return (
        f"{player_name} played as {position or 'a versatile contributor'} and finished with {stat.kills} kills, "
        f"{stat.digs} digs, {stat.blocks} blocks, and a performance score of {stat.performance_score}."
        f"{comparison}{notes_sentence} The next development target is improving efficiency while keeping defensive effort high."
    )


def build_fallback_team_summary(team_name, match, aggregate, coach_notes=""):
    notes_sentence = f" Coach note: {coach_notes.strip()}" if coach_notes else ""

    return (
        f"{team_name} finished the match against {match.opponent} with an average performance score of "
        f"{aggregate['averagePerformanceScore']} and a team hitting percentage of {aggregate['averageHittingPercentage']}."
        f" The strongest area was {aggregate['strongestMetric']}, while the main improvement area was {aggregate['weakestMetric']}."
        f"{notes_sentence} In the next practice, prioritize one focused drill block around {aggregate['weakestMetric'].lower()}."
    )


def _generate_with_gemini(prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception:
            warnings.filterwarnings("ignore", category=FutureWarning)
            import google.generativeai as old_genai

            old_genai.configure(api_key=api_key)
            model = old_genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            return response.text.strip()
    except Exception as exc:
        print(f"LLM Error: {exc}")
        return None


def generate_feedback_text(player_name, position, stat, tone="standard", team_average_score=None, coach_notes=""):
    score_delta = None
    if team_average_score is not None:
        score_delta = round((stat.performance_score or 0) - team_average_score, 2)

    prompt = f"""
You are Volley-GPT, an elite volleyball performance analyst.

Write a concise post-match feedback summary for one player.

Tone: {tone}

Player:
- Name: {player_name}
- Position: {position or 'Versatile Player'}
- Kills: {stat.kills}
- Attack Attempts: {stat.attack_attempts}
- Attack Errors: {stat.attack_errors}
- Hitting Percentage: {stat.hitting_percentage}
- Aces: {stat.aces}
- Blocks: {stat.blocks}
- Digs: {stat.digs}
- Assists: {stat.assists}
- Receive Rating: {stat.receive_rating or 'N/A'}
- Performance Score: {stat.performance_score}
- Team Average Score: {team_average_score}
- Score Delta: {score_delta}
- Coach Notes: {coach_notes or 'No coach notes provided.'}

Rules:
1. Return exactly 3 or 4 sentences.
2. Mention the performance score naturally.
3. Compare the player to the team average when available.
4. Include one specific strength and one specific improvement target.
5. Do not use markdown, bullets, headings, emojis, or quotation marks.
"""

    ai_text = _generate_with_gemini(prompt)
    if ai_text:
        return ai_text

    return build_fallback_player_feedback(
        player_name=player_name,
        position=position,
        stat=stat,
        tone=tone,
        team_average_score=team_average_score,
        coach_notes=coach_notes,
    )


def generate_team_summary_text(team_name, match, aggregate, coach_notes=""):
    prompt = f"""
You are Volley-GPT, an assistant coach generating a team performance summary after a volleyball match.

Team: {team_name}
Opponent: {match.opponent}
Date: {match.played_on}
Venue: {match.venue or 'Not provided'}

Team totals:
- Total Kills: {aggregate['totalKills']}
- Total Attack Attempts: {aggregate['totalAttackAttempts']}
- Total Attack Errors: {aggregate['totalAttackErrors']}
- Total Aces: {aggregate['totalAces']}
- Total Blocks: {aggregate['totalBlocks']}
- Total Digs: {aggregate['totalDigs']}
- Total Assists: {aggregate['totalAssists']}
- Average Hitting Percentage: {aggregate['averageHittingPercentage']}
- Average Performance Score: {aggregate['averagePerformanceScore']}
- Strongest Metric: {aggregate['strongestMetric']}
- Weakest Metric: {aggregate['weakestMetric']}
- Coach Notes: {coach_notes or 'No coach notes provided.'}

Rules:
1. Return exactly 4 concise sentences.
2. Summarize team performance for the coach.
3. Mention the strongest area and the biggest improvement area.
4. End with a practical coaching action for next practice.
5. Do not use markdown, bullets, headings, emojis, or quotation marks.
"""

    ai_text = _generate_with_gemini(prompt)
    if ai_text:
        return ai_text

    return build_fallback_team_summary(team_name, match, aggregate, coach_notes)