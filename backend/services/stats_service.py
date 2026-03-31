def calculate_hitting_percentage(kills, attempts, errors):
    if attempts <= 0:
        return 0.0
    return round((kills - errors) / attempts, 3)


def calculate_performance_score(payload):
    kills = payload.get("kills", 0)
    aces = payload.get("aces", 0)
    blocks = payload.get("blocks", 0)
    digs = payload.get("digs", 0)
    assists = payload.get("assists", 0)
    errors = payload.get("attack_errors", 0)
    receive = payload.get("receive_rating") or 0
    score = (kills * 4) + (aces * 3) + (blocks * 3) + (digs * 1.5) + (assists * 1.2) + receive - (errors * 2)
    return round(score, 2)


def generate_feedback_text(player_name, position, stat, tone="standard", team_average_score=None):
    score_delta = None
    if team_average_score is not None:
        score_delta = round(stat.performance_score - team_average_score, 2)

    summary = (
        f"{player_name} played as {position or 'a versatile contributor'} and finished with "
        f"{stat.kills} kills, {stat.digs} digs, {stat.blocks} blocks, and a performance score of "
        f"{stat.performance_score}."
    )
    improvement = (
        f" Focus next on reducing attack errors ({stat.attack_errors}) and improving efficiency, "
        f"with a hitting percentage of {stat.hitting_percentage}."
    )
    comparison = ""
    if score_delta is not None:
        comparison = (
            f" That is {'above' if score_delta >= 0 else 'below'} the team average by {abs(score_delta)} points."
        )

    if tone == "encouraging":
        return (
            f"Strong effort from {player_name}. {summary}{comparison}"
            f" The foundation is there, and the next step is sharpening the small details."
            f"{improvement}"
        )

    return f"{summary}{comparison}{improvement}"
