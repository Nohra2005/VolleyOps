"""
Comprehensive endpoint test for VolleyOps API.
Run from the backend directory with the server running on port 5000.
"""
import json
import sys
from datetime import date, timedelta
import requests

BASE = "http://localhost:5000/api"
PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
WARN = "\033[93mWARN\033[0m"

results = []


def check(label, response, expected_status, *, key=None, absent_key=None):
    ok = response.status_code == expected_status
    body = {}
    try:
        body = response.json()
    except Exception:
        pass

    if ok and key is not None:
        ok = key in body if isinstance(body, dict) else any(key in (item if isinstance(item, dict) else {}) for item in body)
    if ok and absent_key is not None:
        ok = absent_key not in body

    status = PASS if ok else FAIL
    results.append(ok)
    snippet = str(body)[:120]
    print(f"  [{status}] {label} → {response.status_code}  {snippet}")
    return body


def header(section):
    print(f"\n{'='*60}")
    print(f"  {section}")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# 0. Health & public endpoints
# ---------------------------------------------------------------------------
header("0. Health / Public")
r = requests.get(f"{BASE}/health")
check("GET /health", r, 200)

r = requests.get(f"{BASE}/demo/logins")
check("GET /demo/logins", r, 200)

# ---------------------------------------------------------------------------
# 1. Auth
# ---------------------------------------------------------------------------
header("1. Authentication")

r = requests.post(f"{BASE}/auth/login", json={"email": "manager@volleyops.test", "password": "manager123"})
body = check("POST /auth/login (manager)", r, 200, key="token")
MANAGER_TOKEN = body.get("token", "")

r = requests.post(f"{BASE}/auth/login", json={"email": "christophe@volleyops.test", "password": "demo123"})
body = check("POST /auth/login (coach)", r, 200, key="token")
COACH_TOKEN = body.get("token", "")

r = requests.post(f"{BASE}/auth/login", json={"email": "joey@volleyops.test", "password": "demo123"})
body = check("POST /auth/login (player)", r, 200, key="token")
PLAYER_TOKEN = body.get("token", "")

r = requests.post(f"{BASE}/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
check("POST /auth/login (bad credentials)", r, 401)

r = requests.post(f"{BASE}/auth/login", json={"email": "manager@volleyops.test"})
check("POST /auth/login (missing password)", r, 400)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


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
check("GET /auth/users (coach — forbidden)", r, 403)

r = requests.get(f"{BASE}/auth/users", headers=auth(PLAYER_TOKEN))
check("GET /auth/users (player — forbidden)", r, 403)

# ---------------------------------------------------------------------------
# 2. Members
# ---------------------------------------------------------------------------
header("2. Members")

r = requests.get(f"{BASE}/members", headers=auth(MANAGER_TOKEN))
check("GET /members (manager)", r, 200)

r = requests.get(f"{BASE}/members?role=PLAYER", headers=auth(MANAGER_TOKEN))
check("GET /members?role=PLAYER", r, 200)

r = requests.get(f"{BASE}/members?role=INVALID", headers=auth(MANAGER_TOKEN))
check("GET /members?role=INVALID (400)", r, 400)

r = requests.get(f"{BASE}/members?search=joey", headers=auth(MANAGER_TOKEN))
check("GET /members?search=joey", r, 200)

r = requests.get(f"{BASE}/members", headers=auth(COACH_TOKEN))
check("GET /members (coach)", r, 200)

r = requests.get(f"{BASE}/members", headers=auth(PLAYER_TOKEN))
check("GET /members (player — forbidden)", r, 403)

r = requests.get(f"{BASE}/members/{PLAYER_ID}", headers=auth(MANAGER_TOKEN))
check(f"GET /members/{PLAYER_ID}", r, 200, key="id")

r = requests.get(f"{BASE}/members/999999", headers=auth(MANAGER_TOKEN))
check("GET /members/999999 (not found)", r, 404)

# Create a test member (to later delete)
r = requests.post(
    f"{BASE}/members",
    headers=auth(MANAGER_TOKEN),
    json={"name": "Test Delete Player", "email": "testdelete@volleyops.test", "role": "PLAYER"},
)
body = check("POST /members (create player)", r, 201, key="id")
NEW_MEMBER_ID = body.get("id")

r = requests.post(
    f"{BASE}/members",
    headers=auth(MANAGER_TOKEN),
    json={"name": "Test Delete Player", "email": "testdelete@volleyops.test"},
)
check("POST /members (duplicate email → 409)", r, 409)

r = requests.post(f"{BASE}/members", headers=auth(MANAGER_TOKEN), json={"name": "No Email"})
check("POST /members (missing email → 400)", r, 400)

r = requests.post(f"{BASE}/members", headers=auth(MANAGER_TOKEN), json={"name": "Bad", "email": "notanemail"})
check("POST /members (invalid email → 400)", r, 400)

r = requests.post(f"{BASE}/members", headers=auth(PLAYER_TOKEN), json={"name": "X", "email": "x@y.com"})
check("POST /members (player — forbidden)", r, 403)

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
        json={"email": "manager@volleyops.test"},
    )
    check("PUT /members — duplicate email → 409", r, 409)

    # --- THE BUG FIX: delete player as manager ---
    r = requests.delete(f"{BASE}/members/{NEW_MEMBER_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /members/{NEW_MEMBER_ID} (was the 500 bug)", r, 200, key="deletedId")

r = requests.delete(f"{BASE}/members/999999", headers=auth(MANAGER_TOKEN))
check("DELETE /members/999999 (not found)", r, 404)

r = requests.delete(f"{BASE}/members/{MANAGER_ID}", headers=auth(MANAGER_TOKEN))
check("DELETE /members (self-delete → 400)", r, 400)

r = requests.delete(f"{BASE}/members/{PLAYER_ID}", headers=auth(COACH_TOKEN))
check("DELETE /members (coach — forbidden)", r, 403)

# ---------------------------------------------------------------------------
# 3. Bookings
# ---------------------------------------------------------------------------
header("3. Bookings")
today_str = date.today().isoformat()
future_str = (date.today() + timedelta(days=5)).isoformat()

r = requests.get(f"{BASE}/bookings")
check("GET /bookings (public)", r, 200)

r = requests.get(f"{BASE}/bookings?weekStart={today_str}")
check(f"GET /bookings?weekStart={today_str}", r, 200)

r = requests.post(
    f"{BASE}/bookings",
    headers=auth(MANAGER_TOKEN),
    json={
        "title": "Test Practice",
        "color": "blue",
        "isRecurring": False,
        "specificDate": future_str,
        "startHour": 10,
        "endHour": 12,
        "facilityId": 1,
    },
)
body = check("POST /bookings (one-off)", r, 201, key="id")
BOOKING_ID = body.get("id")

r = requests.post(
    f"{BASE}/bookings",
    headers=auth(MANAGER_TOKEN),
    json={"title": "No Facility", "isRecurring": False, "specificDate": future_str, "startHour": 10, "endHour": 12},
)
check("POST /bookings (missing facilityId → 400)", r, 400)

r = requests.post(f"{BASE}/bookings", headers=auth(PLAYER_TOKEN), json={})
check("POST /bookings (player — forbidden)", r, 403)

if BOOKING_ID:
    r = requests.put(
        f"{BASE}/bookings/{BOOKING_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"title": "Test Practice Updated", "startHour": 11, "endHour": 13},
    )
    check(f"PUT /bookings/{BOOKING_ID}", r, 200)

    r = requests.delete(f"{BASE}/bookings/{BOOKING_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /bookings/{BOOKING_ID}", r, 200)

r = requests.delete(f"{BASE}/bookings/999999", headers=auth(MANAGER_TOKEN))
check("DELETE /bookings/999999 (not found)", r, 404)

# ---------------------------------------------------------------------------
# 4. Facilities / Teams (Reference)
# ---------------------------------------------------------------------------
header("4. Reference — Facilities & Teams")

r = requests.get(f"{BASE}/facilities", headers=auth(MANAGER_TOKEN))
check("GET /facilities", r, 200)

r = requests.get(f"{BASE}/teams", headers=auth(MANAGER_TOKEN))
body = check("GET /teams", r, 200)
TEAM_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/bootstrap", headers=auth(MANAGER_TOKEN))
check("GET /bootstrap", r, 200)

r = requests.post(
    f"{BASE}/facilities",
    headers=auth(MANAGER_TOKEN),
    json={"name": "TestCourt99", "location": "Test Location", "operatingStartHour": 8, "operatingEndHour": 22},
)
body = check("POST /facilities", r, 201, key="id")
FACILITY_ID = body.get("id")

r = requests.post(f"{BASE}/facilities", headers=auth(MANAGER_TOKEN), json={"name": "TestCourt99"})
check("POST /facilities (duplicate name → 409)", r, 409)

r = requests.post(f"{BASE}/facilities", headers=auth(PLAYER_TOKEN), json={"name": "X"})
check("POST /facilities (player — forbidden)", r, 403)

if FACILITY_ID:
    r = requests.put(
        f"{BASE}/facilities/{FACILITY_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"name": "TestCourt99Updated", "location": "Uptown"},
    )
    check(f"PUT /facilities/{FACILITY_ID}", r, 200)

    r = requests.delete(f"{BASE}/facilities/{FACILITY_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /facilities/{FACILITY_ID}", r, 200)

r = requests.post(
    f"{BASE}/teams",
    headers=auth(MANAGER_TOKEN),
    json={"name": "TestTeam99", "division": "Test Division"},
)
body = check("POST /teams", r, 201, key="id")
NEW_TEAM_ID = body.get("id")

r = requests.post(f"{BASE}/teams", headers=auth(MANAGER_TOKEN), json={"name": "TestTeam99"})
check("POST /teams (duplicate → 409)", r, 409)

r = requests.post(f"{BASE}/teams", headers=auth(PLAYER_TOKEN), json={"name": "X", "division": "D"})
check("POST /teams (player — forbidden)", r, 403)

# ---------------------------------------------------------------------------
# 5. Plays (iBoard)
# ---------------------------------------------------------------------------
header("5. Plays (iBoard)")

r = requests.get(f"{BASE}/plays", headers=auth(MANAGER_TOKEN))
check("GET /plays (manager)", r, 200)

r = requests.get(f"{BASE}/plays", headers=auth(COACH_TOKEN))
check("GET /plays (coach)", r, 200)

r = requests.get(f"{BASE}/plays", headers=auth(PLAYER_TOKEN))
check("GET /plays (player — forbidden)", r, 403)

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
check("DELETE /plays/999999 (not found)", r, 404)

# ---------------------------------------------------------------------------
# 6. Stats
# ---------------------------------------------------------------------------
header("6. Stats — Matches & Player Stats")

r = requests.get(f"{BASE}/stats/matches", headers=auth(MANAGER_TOKEN))
body = check("GET /stats/matches (manager)", r, 200)
MATCH_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/stats/matches", headers=auth(PLAYER_TOKEN))
check("GET /stats/matches (player)", r, 200)

if TEAM_ID:
    r = requests.get(f"{BASE}/stats/matches?teamId={TEAM_ID}", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/matches?teamId={TEAM_ID}", r, 200)

    r = requests.get(f"{BASE}/stats/teams/{TEAM_ID}/summary", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/teams/{TEAM_ID}/summary", r, 200)

if PLAYER_ID:
    r = requests.get(f"{BASE}/stats/players/{PLAYER_ID}", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/players/{PLAYER_ID} (manager)", r, 200)

    r = requests.get(f"{BASE}/stats/players/{PLAYER_ID}", headers=auth(PLAYER_TOKEN))
    check(f"GET /stats/players/{PLAYER_ID} (player — own stats)", r, 200)

if MATCH_ID:
    r = requests.get(f"{BASE}/stats/matches/{MATCH_ID}/summary", headers=auth(MANAGER_TOKEN))
    check(f"GET /stats/matches/{MATCH_ID}/summary", r, 200)

# Create a match with player stats
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
    body = check("POST /stats/matches", r, 201, key="id")
    NEW_MATCH_ID = body.get("id")

    r = requests.post(f"{BASE}/stats/matches", headers=auth(PLAYER_TOKEN), json={})
    check("POST /stats/matches (player — forbidden)", r, 403)

    r = requests.post(f"{BASE}/stats/matches", headers=auth(MANAGER_TOKEN), json={"teamId": TEAM_ID, "opponent": "X"})
    check("POST /stats/matches (missing fields → 400)", r, 400)

# ---------------------------------------------------------------------------
# 7. Communications
# ---------------------------------------------------------------------------
header("7. Communications")

r = requests.get(f"{BASE}/communications/overview", headers=auth(MANAGER_TOKEN))
check("GET /communications/overview (manager)", r, 200)

r = requests.get(f"{BASE}/communications/overview", headers=auth(PLAYER_TOKEN))
check("GET /communications/overview (player)", r, 200)

r = requests.get(f"{BASE}/communications/overview")
check("GET /communications/overview (no auth → 401)", r, 401)

r = requests.get(f"{BASE}/communications/channels", headers=auth(MANAGER_TOKEN))
body = check("GET /communications/channels (manager)", r, 200)
CHANNEL_ID = body[0]["id"] if isinstance(body, list) and body else None

r = requests.get(f"{BASE}/communications/channels", headers=auth(PLAYER_TOKEN))
check("GET /communications/channels (player)", r, 200)

r = requests.post(
    f"{BASE}/communications/channels",
    headers=auth(MANAGER_TOKEN),
    json={"name": "#test-channel-99", "type": "PUBLIC"},
)
body = check("POST /communications/channels", r, 201, key="id")
NEW_CHANNEL_ID = body.get("id")

r = requests.post(f"{BASE}/communications/channels", headers=auth(PLAYER_TOKEN), json={"name": "#x", "type": "PUBLIC"})
check("POST /communications/channels (player — forbidden)", r, 403)

if NEW_CHANNEL_ID:
    r = requests.get(f"{BASE}/communications/channels/{NEW_CHANNEL_ID}/messages", headers=auth(MANAGER_TOKEN))
    check(f"GET /channels/{NEW_CHANNEL_ID}/messages", r, 200)

    r = requests.post(
        f"{BASE}/communications/channels/{NEW_CHANNEL_ID}/messages",
        headers=auth(MANAGER_TOKEN),
        json={"content": "Hello from test!"},
    )
    body = check(f"POST /channels/{NEW_CHANNEL_ID}/messages", r, 201, key="id")
    MSG_ID = body.get("id")

    r = requests.put(
        f"{BASE}/communications/channels/{NEW_CHANNEL_ID}",
        headers=auth(MANAGER_TOKEN),
        json={"name": "#test-channel-99-updated"},
    )
    check(f"PUT /channels/{NEW_CHANNEL_ID}", r, 200)

    r = requests.delete(f"{BASE}/communications/channels/{NEW_CHANNEL_ID}", headers=auth(MANAGER_TOKEN))
    check(f"DELETE /channels/{NEW_CHANNEL_ID}", r, 200)

if CHANNEL_ID:
    r = requests.get(f"{BASE}/communications/channels/{CHANNEL_ID}/messages", headers=auth(MANAGER_TOKEN))
    check(f"GET /channels/{CHANNEL_ID}/messages (existing)", r, 200)

# Notifications dismiss
r = requests.post(
    f"{BASE}/communications/notifications/dismiss",
    headers=auth(MANAGER_TOKEN),
    json={"notificationKey": "test_key_123"},
)
check("POST /notifications/dismiss", r, 200)

# Role update (manager only)
header("8. Role Update")
if PLAYER_ID:
    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(MANAGER_TOKEN),
        json={"role": "COACH"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role → COACH (manager)", r, 200)

    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(MANAGER_TOKEN),
        json={"role": "PLAYER"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role → PLAYER (restore)", r, 200)

    r = requests.put(
        f"{BASE}/auth/users/{PLAYER_ID}/role",
        headers=auth(COACH_TOKEN),
        json={"role": "COACH"},
    )
    check(f"PUT /auth/users/{PLAYER_ID}/role (coach — forbidden)", r, 403)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
total = len(results)
passed = sum(results)
failed = total - passed

print(f"\n{'='*60}")
print(f"  RESULTS: {passed}/{total} passed  |  {failed} failed")
print(f"{'='*60}\n")

if failed:
    sys.exit(1)
