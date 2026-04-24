import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load the hidden .env variables
load_dotenv()

# Configure the LLM with your secure key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

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


# NEW: Added coach_notes="" to the parameters
def generate_feedback_text(player_name, position, stat, tone="standard", team_average_score=None, coach_notes=""):
    score_delta = None
    if team_average_score is not None:
        score_delta = round(stat.performance_score - team_average_score, 2)

    # 1. Construct the System Prompt
    prompt = f"""
    You are an elite, analytical volleyball coach. Generate a short, highly specific post-match feedback summary for a player based on the following data.

    Tone: {tone} (If encouraging, focus on growth. If analytical, focus strictly on efficiency).

    Player Data:
    - Name: {player_name}
    - Position: {position or 'Versatile Player'}
    - Kills: {stat.kills}
    - Errors: {stat.attack_errors}
    - Hitting Percentage: {stat.hitting_percentage}
    - Digs: {stat.digs}
    - Blocks: {stat.blocks}
    - Receive Rating: {stat.receive_rating or 'N/A'}
    - Overall Performance Score: {stat.performance_score} (Team Average: {team_average_score}, Delta: {score_delta})

    Coach's Tactical Notes (HIGH PRIORITY to include in analysis):
    "{coach_notes or 'No specific tactical notes provided by the coach.'}"

    Instructions:
    1. Keep the output to exactly 3 or 4 concise sentences.
    2. Synthesize the raw statistical data naturally with the coach's notes. Do not just list the numbers.
    3. End with one highly specific, actionable area for improvement for the next practice.
    4. Do NOT use markdown formatting (no bolding, no bullet points). Return only plain conversational text.
    """

    # 2. Call the AI
    try:
        # Using the fast 'flash' model which is perfect for text generation
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"LLM Error: {e}")
        # Fallback just in case the API is down or you hit a rate limit
        return f"Standard analysis for {player_name}: Scored {stat.performance_score} with {stat.kills} kills. Focus on improving hitting percentage ({stat.hitting_percentage})."
    score_delta = None
    if team_average_score is not None:
        score_delta = round(stat.performance_score - team_average_score, 2)

    summary = (
        f"{player_name} played as {position or 'a versatile contributor'} and finished with "
        f"{stat.kills} kills, {stat.digs} digs, {stat.blocks} blocks, and a performance score of "
        f"{stat.performance_score}."
    )
    
    ai_synthesis = ""
    if coach_notes:
        ai_synthesis = f" Coach's Tactical Assessment: '{coach_notes}'. Based on this and the metrics, "
    else:
        ai_synthesis = " The data suggests "

    improvement = (
        f"{ai_synthesis}focus next on reducing attack errors ({stat.attack_errors}) and improving efficiency, "
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