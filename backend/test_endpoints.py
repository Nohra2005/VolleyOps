"""
Comprehensive endpoint test for VolleyOps API.
Run from the backend directory with the server running on port 5000.
"""
import sys
from datetime import date, datetime, timedelta

import requests

BASE = "http://localhost:5000/api"
PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"

results = []


def check(label, response, expected_status, *, key=None, absent_key=None):
    ok = response.status_code == expected_status
    body = {}
    try:
        body = response.json()
    except Exception:
        pass

    if ok and key is not None:
        if isinstance(body, dict):
            ok = key in body
        elif isinstance(body, list):
            ok = any(isinstance(item, dict) and key in item for item in body)
        else:
            ok = False
    if ok and absent_key is not None and isinstance(body, dict):
        ok = absent_key not in body

    status = PASS if ok else FAIL
    results.append(ok)
    snippet = str(body)[:140]
    print(f"  [{status}] {label} -> {response.status_code}  {snippet}")
    return body


def check_any(label, response, expected_statuses, *, key=None):
    ok = response.status_code in expected_statuses
    body = {}
    try:
        body = response.json()
    except Exception:
        pass

    if ok and key is not None and isinstance(body, dict):
        ok = key in body

    status = PASS if ok else FAIL
    results.append(ok)
    snippet = str(body)[:140]
    expected = "/".join(str(s) for s in expected_statuses)
    print(f"  [{status}] {label} -> {response.status_code} (expected {expected})  {snippet}")
    return body


def header(section):
    print(f"\n{'=' * 60}")
    print(f"  {section}")
    print(f"{'=' * 60}")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 0. Health & public endpoints
# ---------------------------------------------------------------------------
header("0. Health / Public")
r = requests.get(f"{BASE}/health")
check("GET /health", r, 200)

r = requests.get(f"{BASE}/demo/logins")
demo_users = check("GET /demo/logins", r, 200)
if not isinstance(demo_users, list) or not demo_users:
    print("No demo users available; cannot continue endpoint tests.")
    sys.exit(1)

manager_demo = next((u for u in demo_users if u.get("role") == "MANAGER"), demo_users[0])
coach_demo = next((u for u in demo_users if u.get("role") == "COACH"), manager_demo)
player_demo = next((u for u in demo_users if u.get("role") == "PLAYER"), demo_users[-1])

# ---------------------------------------------------------------------------
# 1. Auth
# ---------------------------------------------------------------------------
header("1. Authentication")

r = requests.post(
    f"{BASE}/auth/login",
    json={"email": manager_demo["email"], "password": manager_demo["password"]},
)
body = check("POST /auth/login (manager)", r, 200, key="token")
MANAGER_TOKEN = body.get("token", "")

r = requests.post(
    f"{BASE}/auth/login",
    json={"email": coach_demo["email"], "password": coach_demo["password"]},
)
body = check("POST /auth/login (coach)", r, 200, key="token")
COACH_TOKEN = body.get("token", "")

r = requests.post(
    f"{BASE}/auth/login",
    json={"email": player_demo["email"], "password": player_demo["password"]},
)
body = check("POST /auth/login (player)", r, 200, key="token")
PLAYER_TOKEN = body.get("token", "")

r = requests.post(f"{BASE}/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
check("POST /auth/login (bad credentials)", r, 401)

r = requests.post(f"{BASE}/auth/login", json={"email": manager_demo["email"]})
check("POST /auth/login (missing password)", r, 401)

r = requests.get(f"{BASE}/auth/me", headers=auth(MANAGER_TOKEN))
check("GET /auth/me (manager)", r, 200, key="email")

r = requests.get(f"{BASE}/auth/me", headers=auth(PLAYER_TOKEN))
check("GET /auth/me (player)", r, 200, key="email")

r = requests.get(f"{BASE}/auth/me")
check("GET /auth/me (no token)", r, 401)

r = requests.get(f"{BASE}/auth/users", headers=auth(MANAGER_TOKEN))
users_list = check("GET /auth/users (manager)", r, 200)
PLAYER_ID = next((u["id"] for u in (users_list if isinstance(users_list, list) else []) if u.get("role") == "PLAYER"), None)
MANAGER_ID = next((u["id"] for u in (users_list if isinstance(users_list, list) else []) if u.get("role") == "MANAGER"), None)

r = requests.get(f"{BASE}/auth/users", headers=auth(COACH_TOKEN))
check("GET /auth/users (coach forbidden)", r, 403)

r = requests.get(f"{BASE}/auth/users", headers=auth(PLAYER_TOKEN))
check("GET /auth/users (player forbidden)", r, 403)

# ---------------------------------------------------------------------------
# 2. Members
# ---------------------------------------------------------------------------
header("2. Members")

r = requests.get(f"{BASE}/members", headers=auth(MANAGER_TOKEN))
check("GET /members (manager)", r, 200)

r = requests.get(f"{BASE}/members?role=PLAYER", headers=auth(MANAGER_TOKEN))
check("GET /members?role=PLAYER", r, 200)

r = requests.get(f"{BASE}/members?role=INVALID", headers=auth(MANAGER_TOKEN))
check("GET /members?role=INVALID", r, 400)

r = requests.get(f"{BASE}/members?search={player_demo['email'].split('@')[0]}", headers=auth(MANAGER_TOKEN))
check("GET /members?search=...", r, 200)

r = requests.get(f"{BASE}/members", headers=auth(COACH_TOKEN))
check("GET /members (coach)", r, 200)

r = requests.get(f"{BASE}/members", headers=auth(PLAYER_TOKEN))
check("GET /members (player forbidden)", r, 403)

if PLAYER_ID:
    r = requests.get(f"{BASE}/members/{PLAYER_ID}", headers=auth(MANAGER_TOKEN))
    check(f"GET /members/{PLAYER_ID}", r, 200, key="id")

r = requests.get(f"{BASE}/members/999999", headers=auth(MANAGER_TOKEN))
check("GET /members/999999", r, 404)

unique_suffix = datetime.now().strftime("%Y%m%d%H%M%S")
new_member_email = f"testdelete_{unique_suffix}@volleyops.test"
r = requests.post(
    f"{BASE}/members",
    headers=auth(MANAGER_TOKEN),
    json={"name": "Test Delete Player", "email": new_member_email, "role": "PLAYER"},
)
body = check("POST /members (create player)", r, 201, key="id")
NEW_MEMBER_ID = body.get("id")

r = requests.post(
    f"{BASE}/members",
    headers=auth(MANAGER_TOKEN),
    json={"name": "Test Delete Player", "email": new_member_email},
)
check("POST /members (duplicate email)", r, 409)

r = requests.post(f"{BASE}/members", headers=auth(MANAGER_TOKEN), json={"name": "No Email"})
check("POST /members (missing email)", r, 400)

r = requests.post(f"{BASE}/members", headers=auth(MANAGER_TOKEN), json={"name": "Bad", "email": "notanemail"})
check("POST /members (invalid email)", r, 400)

r = requests.post(f"{BASE}/members", headers=auth(PLAYER_TOKEN), json={"name": "X", "email": "x@y.com"})
check("POST /members (player forbidden)", r, 403)

if NEW_MEMBER_ID:
    r = requests.put(
        f"{BASE}/members/{NEW_MEMBER_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"name": "Test Updated Player", "phone": "+961 00 000 000"},
    )
    check(f"PUT /members/{NEW_MEMBER_ID}", r, 200, key="name")

    r = requests.put(
        f"{BASE}/members/{NEW_MEMBER_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"email": manager_demo["email"]},
    )
    check("PUT /members duplicate email", r, 409)

    r = requests.delete(f"{BASE}/members/{NEW_MEMBER_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /members/{NEW_MEMBER_ID}", r, 200, key="deletedId")

r = requests.delete(f"{BASE}/members/999999", headers=auth(MANAGER_TOKEN))
check("DELETE /members/999999", r, 404)

if MANAGER_ID:
    r = requests.delete(f"{BASE}/members/{MANAGER_ID}", headers=auth(MANAGER_TOKEN))
    check("DELETE /members self-delete", r, 400)

if PLAYER_ID:
    r = requests.delete(f"{BASE}/members/{PLAYER_ID}", headers=auth(COACH_TOKEN))
    check("DELETE /members coach forbidden", r, 403)

# ---------------------------------------------------------------------------
# 3. Bookings
# ---------------------------------------------------------------------------
header("3. Bookings")
today_str = date.today().isoformat()
future_str = (date.today() + timedelta(days=5)).isoformat()

r = requests.get(f"{BASE}/bookings")
check("GET /bookings (no auth)", r, 401)

r = requests.get(f"{BASE}/bookings", headers=auth(MANAGER_TOKEN))
check("GET /bookings (manager)", r, 200)

r = requests.get(f"{BASE}/bookings?weekStart={today_str}", headers=auth(MANAGER_TOKEN))
check(f"GET /bookings?weekStart={today_str}", r, 200)

r = requests.post(
    f"{BASE}/bookings",
    headers=auth(MANAGER_TOKEN),
    json={
        "title": "Test Practice",
        "color": "blue",
        "is_recurring": False,
        "specific_date": future_str,
        "start_hour": 10,
        "end_hour": 12,
        "facility_id": 1,
    },
)
body = check("POST /bookings (one-off)", r, 201, key="id")
BOOKING_ID = body.get("id")

r = requests.post(
    f"{BASE}/bookings",
    headers=auth(MANAGER_TOKEN),
    json={"title": "No Facility", "is_recurring": False, "specific_date": future_str, "start_hour": 10, "end_hour": 12},
)
check("POST /bookings (missing facilityId)", r, 400)

r = requests.post(f"{BASE}/bookings", headers=auth(PLAYER_TOKEN), json={})
check("POST /bookings (player forbidden)", r, 403)

if BOOKING_ID:
    r = requests.put(
        f"{BASE}/bookings/{BOOKING_ID}",
        headers=auth(MANAGER_TOKEN),
        json={
            "title": "Test Practice Updated",
            "is_recurring": False,
            "specific_date": future_str,
            "facility_id": 1,
            "start_hour": 11,
            "end_hour": 13,
        },
    )
    check(f"PUT /bookings/{BOOKING_ID}", r, 200)

    r = requests.delete(f"{BASE}/bookings/{BOOKING_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /bookings/{BOOKING_ID}", r, 200)

r = requests.delete(f"{BASE}/bookings/999999", headers=auth(MANAGER_TOKEN))
check("DELETE /bookings/999999", r, 404)

# ---------------------------------------------------------------------------
# 4. Reference - Facilities & Teams
# ---------------------------------------------------------------------------
header("4. Reference - Facilities & Teams")

r = requests.get(f"{BASE}/facilities", headers=auth(MANAGER_TOKEN))
check("GET /facilities", r, 200)

r = requests.get(f"{BASE}/teams", headers=auth(MANAGER_TOKEN))
body = check("GET /teams", r, 200)
TEAM_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/bootstrap", headers=auth(MANAGER_TOKEN))
check("GET /bootstrap", r, 200)

facility_name = f"TestCourt_{unique_suffix}"
r = requests.post(
    f"{BASE}/facilities",
    headers=auth(MANAGER_TOKEN),
    json={"name": facility_name, "location": "Test Location", "operatingStartHour": 8, "operatingEndHour": 22},
)
body = check("POST /facilities", r, 201, key="id")
FACILITY_ID = body.get("id")

r = requests.post(f"{BASE}/facilities", headers=auth(MANAGER_TOKEN), json={"name": facility_name})
check("POST /facilities (duplicate name)", r, 409)

r = requests.post(f"{BASE}/facilities", headers=auth(PLAYER_TOKEN), json={"name": "X"})
check("POST /facilities (player forbidden)", r, 403)

if FACILITY_ID:
    r = requests.put(
        f"{BASE}/facilities/{FACILITY_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"name": f"{facility_name}_Updated", "location": "Uptown"},
    )
    check(f"PUT /facilities/{FACILITY_ID}", r, 200)

    r = requests.delete(f"{BASE}/facilities/{FACILITY_ID}", headers=auth(MANAGER_TOKEN))
    check_any(f"DELETE /facilities/{FACILITY_ID}", r, [200, 204])

team_name = f"TestTeam_{unique_suffix}"
r = requests.post(
    f"{BASE}/teams",
    headers=auth(MANAGER_TOKEN),
    json={"name": team_name, "division": "Test Division"},
)
body = check("POST /teams", r, 201, key="id")
NEW_TEAM_ID = body.get("id")

r = requests.post(f"{BASE}/teams", headers=auth(MANAGER_TOKEN), json={"name": team_name, "division": "Test Division"})
check("POST /teams (duplicate)", r, 409)

r = requests.post(f"{BASE}/teams", headers=auth(PLAYER_TOKEN), json={"name": "X", "division": "D"})
check("POST /teams (player forbidden)", r, 403)

# ---------------------------------------------------------------------------
# 5. Plays
# ---------------------------------------------------------------------------
header("5. Plays")

r = requests.get(f"{BASE}/plays", headers=auth(MANAGER_TOKEN))
check("GET /plays (manager)", r, 200)

r = requests.get(f"{BASE}/plays", headers=auth(COACH_TOKEN))
check("GET /plays (coach)", r, 200)

r = requests.get(f"{BASE}/plays", headers=auth(PLAYER_TOKEN))
check("GET /plays (player forbidden)", r, 403)

r = requests.post(
    f"{BASE}/plays",
    headers=auth(COACH_TOKEN),
    json={"name": "Test Play", "courtView": "FULL", "lineup": {}, "annotations": [], "highlights": []},
)
body = check("POST /plays", r, 201, key="id")
PLAY_ID = body.get("id")

if PLAY_ID:
    r = requests.put(
        f"{BASE}/plays/{PLAY_ID}",
        headers=auth(COACH_TOKEN),
        json={"name": "Test Play Updated"},
    )
    check(f"PUT /plays/{PLAY_ID}", r, 200)

    r = requests.post(f"{BASE}/plays/{PLAY_ID}/duplicate", headers=auth(COACH_TOKEN))
    body2 = check(f"POST /plays/{PLAY_ID}/duplicate", r, 201, key="id")
    DUPE_PLAY_ID = body2.get("id")

    if DUPE_PLAY_ID:
        r = requests.delete(f"{BASE}/plays/{DUPE_PLAY_ID}", headers=auth(MANAGER_TOKEN))
        check(f"DELETE /plays/{DUPE_PLAY_ID} (duplicate)", r, 200)

    r = requests.delete(f"{BASE}/plays/{PLAY_ID}", headers=auth(COACH_TOKEN))
    check(f"DELETE /plays/{PLAY_ID}", r, 200)

r = requests.delete(f"{BASE}/plays/999999", headers=auth(MANAGER_TOKEN))
check("DELETE /plays/999999", r, 404)

# ---------------------------------------------------------------------------
# 6. Stats
# ---------------------------------------------------------------------------
header("6. Stats - Matches & Player Stats")

r = requests.get(f"{BASE}/stats/matches", headers=auth(MANAGER_TOKEN))
body = check("GET /stats/matches (manager)", r, 200)
MATCH_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/stats/matches", headers=auth(PLAYER_TOKEN))
check("GET /stats/matches (player)", r, 200)

r = requests.get(f"{BASE}/stats/matches?teamId=abc", headers=auth(MANAGER_TOKEN))
check("GET /stats/matches?teamId=abc", r, 400)

if TEAM_ID:
    r = requests.get(f"{BASE}/stats/matches?teamId={TEAM_ID}", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/matches?teamId={TEAM_ID}", r, 200)

    r = requests.get(f"{BASE}/stats/teams/{TEAM_ID}/summary", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/teams/{TEAM_ID}/summary", r, 200)

if PLAYER_ID:
    r = requests.get(f"{BASE}/stats/players/{PLAYER_ID}", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/players/{PLAYER_ID} (manager)", r, 200)

    r = requests.get(f"{BASE}/stats/players/{PLAYER_ID}", headers=auth(PLAYER_TOKEN))
    check_any(f"GET /stats/players/{PLAYER_ID} (player own or forbidden)", r, [200, 403])

if MATCH_ID:
    r = requests.get(f"{BASE}/stats/matches/{MATCH_ID}/summary", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/matches/{MATCH_ID}/summary", r, 200)

if TEAM_ID and PLAYER_ID:
    r = requests.post(
        f"{BASE}/stats/matches",
        headers=auth(MANAGER_TOKEN),
        json={
            "teamId": TEAM_ID,
            "opponent": "Test Opponent",
            "playedOn": (date.today() - timedelta(days=1)).isoformat(),
            "venue": "Test Gym",
            "playerStats": [
                {
                    "playerId": PLAYER_ID,
                    "kills": 5,
                    "attackAttempts": 15,
                    "attackErrors": 2,
                    "aces": 1,
                    "blocks": 2,
                    "digs": 4,
                    "assists": 0,
                    "receiveRating": 2.1,
                }
            ],
        },
    )
    body = check("POST /stats/matches", r, 201, key="matchId")
    NEW_MATCH_ID = body.get("matchId")

    r = requests.post(f"{BASE}/stats/matches", headers=auth(PLAYER_TOKEN), json={})
    check("POST /stats/matches (player forbidden)", r, 403)

    r = requests.post(f"{BASE}/stats/matches", headers=auth(MANAGER_TOKEN), json={"teamId": TEAM_ID, "opponent": "X"})
    check("POST /stats/matches (missing fields)", r, 400)

# ---------------------------------------------------------------------------
# 7. Communications (including attendance workflow)
# ---------------------------------------------------------------------------
header("7. Communications")

r = requests.get(f"{BASE}/communications/overview", headers=auth(MANAGER_TOKEN))
check("GET /communications/overview (manager)", r, 200)

r = requests.get(f"{BASE}/communications/overview", headers=auth(PLAYER_TOKEN))
check("GET /communications/overview (player)", r, 200)

r = requests.get(f"{BASE}/communications/overview")
check("GET /communications/overview (no auth)", r, 401)

r = requests.get(f"{BASE}/communications/channels", headers=auth(MANAGER_TOKEN))
body = check("GET /communications/channels (manager)", r, 200)
CHANNEL_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/communications/channels", headers=auth(PLAYER_TOKEN))
check("GET /communications/channels (player)", r, 200)

new_channel_name = f"#test-channel-{unique_suffix}"
r = requests.post(
    f"{BASE}/communications/channels",
    headers=auth(MANAGER_TOKEN),
    json={"name": new_channel_name, "type": "PUBLIC"},
)
body = check("POST /communications/channels", r, 201, key="id")
NEW_CHANNEL_ID = body.get("id")

r = requests.post(f"{BASE}/communications/channels", headers=auth(PLAYER_TOKEN), json={"name": "#x", "type": "PUBLIC"})
check("POST /communications/channels (player forbidden)", r, 403)

if NEW_CHANNEL_ID:
    r = requests.get(f"{BASE}/communications/channels/{NEW_CHANNEL_ID}/messages", headers=auth(MANAGER_TOKEN))
    check(f"GET /channels/{NEW_CHANNEL_ID}/messages", r, 200)

    r = requests.post(
        f"{BASE}/communications/channels/{NEW_CHANNEL_ID}/messages",
        headers=auth(MANAGER_TOKEN),
        json={"content": "Hello from test!"},
    )
    check(f"POST /channels/{NEW_CHANNEL_ID}/messages", r, 201, key="id")

    r = requests.put(
        f"{BASE}/communications/channels/{NEW_CHANNEL_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"name": f"{new_channel_name}-updated"},
    )
    check(f"PUT /channels/{NEW_CHANNEL_ID}", r, 200)

if CHANNEL_ID:
    r = requests.post(
        f"{BASE}/communications/channels/{CHANNEL_ID}/messages",
        headers=auth(MANAGER_TOKEN),
        json={"content": "Attendance test poll", "attachmentType": "event_poll"},
    )
    body = check("POST event poll message", r, 201, key="id")
    POLL_MESSAGE_ID = body.get("id")

    if POLL_MESSAGE_ID:
        r = requests.post(
            f"{BASE}/communications/attendance",
            headers=auth(PLAYER_TOKEN),
            json={"messageId": POLL_MESSAGE_ID, "status": "ATTENDING"},
        )
        check("POST /communications/attendance", r, 200)

        r = requests.post(
            f"{BASE}/communications/attendance",
            headers=auth(PLAYER_TOKEN),
            json={"messageId": POLL_MESSAGE_ID, "status": "MAYBE"},
        )
        check("POST /communications/attendance (bad status)", r, 400)

r = requests.post(
    f"{BASE}/communications/notifications/dismiss",
    headers=auth(MANAGER_TOKEN),
    json={"notificationId": "test_key_123"},
)
check("POST /notifications/dismiss", r, 200)

# ---------------------------------------------------------------------------
# 8. Role Update
# ---------------------------------------------------------------------------
header("8. Role Update")
if PLAYER_ID:
    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(MANAGER_TOKEN),
        json={"role": "COACH"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role -> COACH (manager)", r, 200)

    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(MANAGER_TOKEN),
        json={"role": "PLAYER"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role -> PLAYER (restore)", r, 200)

    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(COACH_TOKEN),
        json={"role": "COACH"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role (coach forbidden)", r, 403)

if NEW_CHANNEL_ID:
    r = requests.delete(f"{BASE}/communications/channels/{NEW_CHANNEL_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /channels/{NEW_CHANNEL_ID}", r, 200)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
total = len(results)
passed = sum(results)
failed = total - passed

print(f"\n{'=' * 60}")
print(f"  RESULTS: {passed}/{total} passed  |  {failed} failed")
print(f"{'=' * 60}\n")

if failed:
    sys.exit(1)
