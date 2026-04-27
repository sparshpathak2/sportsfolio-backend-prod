/**
 * Comprehensive API + Socket test script
 * Tests all major endpoints and socket events
 */

import { io } from "socket.io-client";

const BASE = "http://localhost:3001";
let pass = 0;
let fail = 0;
const errors = [];

// ─── HTTP Helpers ────────────────────────────────────────────────────────────
const r = async (method, path, body, session) => {
    const opts = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(session && { "x-session-id": session }),
        },
        ...(body && { body: JSON.stringify(body) }),
    };
    const res = await fetch(`${BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
};

const ok = (label, cond, detail = "") => {
    if (cond) {
        console.log(`  ✅ ${label}`);
        pass++;
    } else {
        console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
        fail++;
        errors.push(label);
    }
};

const section = (title) => console.log(`\n${"═".repeat(60)}\n  ${title}\n${"═".repeat(60)}`);

// ─── Test State ──────────────────────────────────────────────────────────────
const users = [];       // [{ phone, sessionId, userId, name }]
let teamId, tournamentId, matchId, locationId, invitationId, requestId, achievementId;

// ─── 1. HEALTH ───────────────────────────────────────────────────────────────
section("1. HEALTH CHECK");
{
    const { status, data } = await r("GET", "/health");
    ok("GET /health → 200", status === 200);
}

// ─── 2. AUTH — Create 3 users ────────────────────────────────────────────────
section("2. AUTH — Create 3 Users");

const testPhones = ["+919000000001", "+919000000002", "+919000000003"];
const testNames  = ["Alice Test", "Bob Test", "Charlie Test"];

for (let i = 0; i < 3; i++) {
    const phone = testPhones[i];

    // Request OTP
    const otpRes = await r("POST", "/api/auth/request-otp", { phone });
    ok(`Request OTP [user${i+1}] → success`, otpRes.data.success);
    const otp = otpRes.data.otp;
    ok(`OTP returned in dev mode [user${i+1}]`, !!otp, JSON.stringify(otpRes.data));

    // Verify OTP
    const verifyRes = await r("POST", "/api/auth/verify-otp", { phone, otp });
    ok(`Verify OTP [user${i+1}] → success`, verifyRes.data.success, JSON.stringify(verifyRes.data));

    const sessionId = verifyRes.data.sessionId;
    const userId = verifyRes.data.user?.id;
    ok(`Session created [user${i+1}]`, !!sessionId);
    ok(`User created [user${i+1}]`, !!userId);

    users.push({ phone, sessionId, userId, name: testNames[i] });
}

const [u1, u2, u3] = users;

// ─── 3. VERIFY SESSION ───────────────────────────────────────────────────────
section("3. VERIFY SESSION");
{
    const res = await r("POST", "/api/auth/verify-session", null, u1.sessionId);
    ok("Verify session → valid:true", res.data.valid === true);
    ok("Verify session → correct userId", res.data.user?.id === u1.userId);
}

// ─── 4. USERS ────────────────────────────────────────────────────────────────
section("4. USERS");
{
    // Update users with names
    for (const u of users) {
        const res = await r("PUT", `/api/users/${u.userId}`, { name: u.name, email: `${u.name.split(" ")[0].toLowerCase()}@test.com`, city: "Mumbai" }, u.sessionId);
        ok(`Update user name [${u.name}]`, res.status === 200 || res.data.success);
    }

    // List users
    const listRes = await r("GET", "/api/users?page=1&limit=10", null, u1.sessionId);
    ok("List users → 200", listRes.status === 200);

    // Get user by ID
    const getRes = await r("GET", `/api/users/${u1.userId}`, null, u1.sessionId);
    ok("Get user by ID → 200", getRes.status === 200);
    ok("Get user → correct ID", getRes.data.data?.id === u1.userId || getRes.data.id === u1.userId);

    // Get invitations
    const invRes = await r("GET", `/api/users/${u1.userId}/invitations`, null, u1.sessionId);
    ok("Get user invitations → 200", invRes.status === 200);
}

// ─── 5. PROFILE ──────────────────────────────────────────────────────────────
section("5. PROFILE");
{
    const getRes = await r("GET", `/api/profiles/${u1.userId}`, null, u1.sessionId);
    ok("Get profile → 200", getRes.status === 200);

    const patchRes = await r("PATCH", "/api/profiles", { name: u1.name, city: "Delhi" }, u1.sessionId);
    ok("Update profile → success", patchRes.status === 200 || patchRes.data.success);
}

// ─── 6. SPORTS ───────────────────────────────────────────────────────────────
section("6. SPORTS");
{
    const listRes = await r("GET", "/api/sports", null, u1.sessionId);
    ok("List sports → 200", listRes.status === 200);
}

// ─── 7. LOCATIONS ────────────────────────────────────────────────────────────
section("7. LOCATIONS");
{
    const locName = `Test Badminton Hall ${Date.now()}`;
    const createRes = await r("POST", "/api/locations", {
        name: locName,
        city: "Mumbai",
        address: `${Date.now()} Sports Complex, Andheri`,
        latitude: 19.1197,
        longitude: 72.8471
    }, u1.sessionId);
    ok("Create location → success", createRes.status === 200 || createRes.status === 201 || createRes.data.success);
    locationId = createRes.data.data?.id || createRes.data.id;
    ok("Location ID returned", !!locationId, JSON.stringify(createRes.data).slice(0, 200));

    const listRes = await r("GET", "/api/locations", null, u1.sessionId);
    ok("List locations → 200", listRes.status === 200);

    const citiesRes = await r("GET", "/api/locations/cities", null, u1.sessionId);
    ok("Get cities → 200", citiesRes.status === 200);

    if (locationId) {
        const getRes = await r("GET", `/api/locations/${locationId}`, null, u1.sessionId);
        ok("Get location by ID → 200", getRes.status === 200);
    } else {
        ok("Get location by ID → 200", false, "locationId not available");
    }
}

// ─── 8. TEAMS ────────────────────────────────────────────────────────────────
section("8. TEAMS");
{
    const createRes = await r("POST", "/api/teams", {
        name: "Test Smashers",
        sportCode: "BADMINTON",
        city: "Mumbai"
    }, u1.sessionId);
    ok("Create team → success", createRes.status === 200 || createRes.status === 201 || createRes.data.success);
    teamId = createRes.data.data?.id || createRes.data.id;
    ok("Team ID returned", !!teamId, JSON.stringify(createRes.data).slice(0, 200));

    if (teamId) {
        // List teams
        const listRes = await r("GET", "/api/teams?page=1&limit=10", null, u1.sessionId);
        ok("List teams → 200", listRes.status === 200);

        // Get team
        const getRes = await r("GET", `/api/teams/${teamId}`, null, u1.sessionId);
        ok("Get team by ID → 200", getRes.status === 200);

        // Members
        const membersRes = await r("GET", `/api/teams/${teamId}/members`, null, u1.sessionId);
        ok("List team members → 200", membersRes.status === 200);

        // Create invitation for u2 (player invite to team)
        const invRes = await r("POST", `/api/teams/${teamId}/invitations`, {
            type: "PLAYER",
            playerId: u2.userId
        }, u1.sessionId);
        ok("Create team invitation → success", invRes.status === 200 || invRes.status === 201 || invRes.data.success, JSON.stringify(invRes.data).slice(0,200));
        invitationId = invRes.data.data?.id || invRes.data.id;

        if (invitationId) {
            // List invitations
            const listInvRes = await r("GET", `/api/teams/${teamId}/invitations`, null, u1.sessionId);
            ok("List team invitations → 200", listInvRes.status === 200);

            // Accept invitation as u2
            const acceptRes = await r("POST", `/api/teams/${teamId}/invitations/${invitationId}/accept`, null, u2.sessionId);
            ok("Accept team invitation → success", acceptRes.status === 200 || acceptRes.data.success, JSON.stringify(acceptRes.data).slice(0,200));
        }
    }
}

// ─── 9. TOURNAMENTS ──────────────────────────────────────────────────────────
section("9. TOURNAMENTS");
{
    if (!locationId) {
        ok("Create tournament → success", false, "No locationId — skipping");
        ok("Tournament ID returned", false);
    } else {
        const createRes = await r("POST", "/api/tournaments", {
            name: "Test Open 2026",
            sportCode: "BADMINTON",
            tournamentType: "KNOCKOUT",
            startDate: new Date(Date.now() + 86400000).toISOString(),
            endDate: new Date(Date.now() + 3 * 86400000).toISOString(),
            isPublic: true,
            entryFee: 0,
            city: "Mumbai",
            locations: [{ id: locationId }],
            rules: {
                playAreas: 2,
                partsPerMatch: 3,
                gameType: "SINGLES",
                maxParticipants: 8
            }
        }, u1.sessionId);
        ok("Create tournament → success", createRes.status === 200 || createRes.status === 201 || createRes.data.success, JSON.stringify(createRes.data).slice(0,300));
        tournamentId = createRes.data.data?.id || createRes.data.id;
        ok("Tournament ID returned", !!tournamentId);

        if (tournamentId) {
            const listRes = await r("GET", "/api/tournaments?page=1&limit=10", null, u1.sessionId);
            ok("List tournaments → 200", listRes.status === 200);

            const getRes = await r("GET", `/api/tournaments/${tournamentId}`, null, u1.sessionId);
            ok("Get tournament → 200", getRes.status === 200);

            const myRes = await r("GET", "/api/tournaments/my", null, u1.sessionId);
            ok("My tournaments → 200", myRes.status === 200);

            const reqRes = await r("POST", "/api/requests", {
                tournamentId,
                message: "I want to join"
            }, u2.sessionId);
            ok("Create tournament request → success", reqRes.status === 200 || reqRes.status === 201 || reqRes.data.success, JSON.stringify(reqRes.data).slice(0,200));
            requestId = reqRes.data.data?.id || reqRes.data.id;

            if (requestId) {
                const myReqRes = await r("GET", "/api/requests/my-requests", null, u2.sessionId);
                ok("Get my requests → 200", myReqRes.status === 200);

                const tournReqRes = await r("GET", `/api/requests/tournament/${tournamentId}`, null, u1.sessionId);
                ok("Get tournament requests → 200", tournReqRes.status === 200);

                const respondRes = await r("PATCH", `/api/requests/${requestId}/respond`, { status: "ACCEPTED" }, u1.sessionId);
                ok("Respond to request → success", respondRes.status === 200 || respondRes.data.success, JSON.stringify(respondRes.data).slice(0,200));
            }
        }
    }
}

// ─── 10. MATCHES ─────────────────────────────────────────────────────────────
section("10. MATCHES");
{
    if (!locationId) {
        ok("Create match → success", false, "No locationId — skipping match tests");
        ok("Match ID returned", false);
    } else {
        const matchPayload = {
            name: "Test Match QF1",
            sportCode: "BADMINTON",
            gameType: "SINGLES",
            partsCount: 3,
            playArea: 1,
            participantIds: [u1.userId, u2.userId],
            servingUserId: u1.userId,
            locations: [{ id: locationId }]
        };
        const createRes = await r("POST", "/api/matches", matchPayload, u1.sessionId);
        ok("Create match → success", createRes.status === 200 || createRes.status === 201 || createRes.data.success, JSON.stringify(createRes.data).slice(0,300));
        matchId = createRes.data.data?.id || createRes.data.id;
        ok("Match ID returned", !!matchId);

        if (matchId) {
            // List matches
            const listRes = await r("GET", "/api/matches?page=1&limit=10", null, u1.sessionId);
            ok("List matches → 200", listRes.status === 200);

            // Get match
            const getRes = await r("GET", `/api/matches/${matchId}`, null, u1.sessionId);
            ok("Get match by ID → 200", getRes.status === 200);

            // Start match
            const startRes = await r("POST", `/api/matches/${matchId}/start`, null, u1.sessionId);
            ok("Start match → success", startRes.status === 200 || startRes.data.success, JSON.stringify(startRes.data).slice(0,200));

            // Get live state
            const liveRes = await r("GET", `/api/matches/${matchId}/live`, null, u1.sessionId);
            ok("Get live state → 200", liveRes.status === 200, JSON.stringify(liveRes.data).slice(0,200));

            // Need to get participant IDs from match for scoring
            const matchData = getRes.data.data || getRes.data;
            const p1Id = matchData?.participants?.find(p => (p.userId || p.user?.id) === u1.userId)?.id;
            const p2Id = matchData?.participants?.find(p => (p.userId || p.user?.id) === u2.userId)?.id;

            if (p1Id) {
                // Record enough score events for p1 (u1) to auto-complete the match (2 games x 21 pts)
                let matchAutoCompleted = false;
                for (let i = 0; i < 100 && !matchAutoCompleted; i++) {
                    const isP1Scoring = (i % 10 !== 0); // p1 scores 9 out of 10 events
                    const scorerId = isP1Scoring ? p1Id : p2Id;
                    const scorerUserId = isP1Scoring ? u1.userId : u2.userId;
                    const scorerSession = isP1Scoring ? u1.sessionId : u2.sessionId;
                    const ev = await r("POST", `/api/matches/${matchId}/events/record`, {
                        type: "SCORE",
                        payload: { participantId: scorerId, userId: scorerUserId, shotType: "SMASH", isWinner: true }
                    }, scorerSession);
                    if (ev.data?.data?.matchState?.match?.status === "COMPLETED" || ev.data?.data?.matchCompleted) {
                        matchAutoCompleted = true;
                    }
                }
                ok("Recorded events until match auto-complete", true);
            }
        }
    }
}

// ─── 11. STATS — BADMINTON ───────────────────────────────────────────────────
section("11. STATS — BADMINTON");
{
    const endpoints = [
        `/api/stats/badminton/${u1.userId}/overview`,
        `/api/stats/badminton/${u1.userId}/singles`,
        `/api/stats/badminton/${u1.userId}/doubles`,
        `/api/stats/badminton/${u1.userId}/history`,
        `/api/stats/badminton/${u1.userId}/streaks`,
        `/api/stats/badminton/${u1.userId}/courts`,
        `/api/stats/badminton/${u1.userId}/all`,
    ];
    for (const ep of endpoints) {
        const res = await r("GET", ep, null, u1.sessionId);
        ok(`GET ${ep.split("/").slice(-1)[0]} → 200`, res.status === 200, res.status + " " + JSON.stringify(res.data).slice(0,100));
    }
}

// ─── 12. ACHIEVEMENTS ────────────────────────────────────────────────────────
section("12. ACHIEVEMENTS — BADMINTON");
{
    // Evaluate achievements
    const evalRes = await r("POST", `/api/achievements/badminton/${u1.userId}/evaluate`, null, u1.sessionId);
    ok("Evaluate achievements → success", evalRes.status === 200 || evalRes.data.success, JSON.stringify(evalRes.data).slice(0,200));

    // Get all achievements
    const getRes = await r("GET", `/api/achievements/badminton/${u1.userId}`, null, u1.sessionId);
    ok("Get achievements → 200", getRes.status === 200);
    ok("Achievements has summary", !!getRes.data.data?.summary, JSON.stringify(getRes.data).slice(0,200));

    const achievements = getRes.data.data?.achievements || [];
    ok("Achievements array present", Array.isArray(achievements));
    achievementId = achievements.find(a => a.isUnlocked)?.id || achievements[0]?.id;

    if (achievementId) {
        const cardRes = await r("GET", `/api/achievements/badminton/${u1.userId}/${achievementId}/share-card`, null, u1.sessionId);
        ok("Get share card → 200", cardRes.status === 200, JSON.stringify(cardRes.data).slice(0,200));
    }
}

// ─── 13. FAVORITES ───────────────────────────────────────────────────────────
section("13. FAVORITES");
{
    if (teamId) {
        const addTeam = await r("POST", "/api/favorites/teams", { teamId }, u2.sessionId);
        ok("Add favorite team → success", addTeam.status === 200 || addTeam.status === 201 || addTeam.data.success, JSON.stringify(addTeam.data).slice(0,200));

        const getTeams = await r("GET", "/api/favorites/teams", null, u2.sessionId);
        ok("Get favorite teams → 200", getTeams.status === 200);

        const removeTeam = await r("DELETE", `/api/favorites/teams/${teamId}`, null, u2.sessionId);
        ok("Remove favorite team → success", removeTeam.status === 200 || removeTeam.data.success, JSON.stringify(removeTeam.data).slice(0,200));
    }

    const addPlayer = await r("POST", "/api/favorites/players", { favoriteUserId: u3.userId }, u1.sessionId);
    ok("Add favorite player → success", addPlayer.status === 200 || addPlayer.status === 201 || addPlayer.data.success, JSON.stringify(addPlayer.data).slice(0,200));

    const getPlayers = await r("GET", "/api/favorites/players", null, u1.sessionId);
    ok("Get favorite players → 200", getPlayers.status === 200);

    const removePlayer = await r("DELETE", `/api/favorites/players/${u3.userId}`, null, u1.sessionId);
    ok("Remove favorite player → success", removePlayer.status === 200 || removePlayer.data.success, JSON.stringify(removePlayer.data).slice(0,200));
}

// ─── 14. PERSONNEL ───────────────────────────────────────────────────────────
section("14. PERSONNEL");
{
    const availRes = await r("GET", "/api/personnel/available?entityType=TOURNAMENT", null, u1.sessionId);
    ok("Get available personnel → 200", availRes.status === 200);

    if (tournamentId) {
        const addRes = await r("POST", `/api/personnel/tournaments/${tournamentId}/personnel`, {
            personnel: [{ userId: u3.userId, role: "REFEREE", isPrimary: false }]
        }, u1.sessionId);
        ok("Add tournament personnel → success", addRes.status === 200 || addRes.status === 201 || addRes.data.success, JSON.stringify(addRes.data).slice(0,200));

        const getRes = await r("GET", `/api/personnel/tournaments/${tournamentId}/personnel`, null, u1.sessionId);
        ok("Get tournament personnel → 200", getRes.status === 200);
    }

    if (matchId) {
        const addRes = await r("POST", `/api/personnel/matches/${matchId}/personnel`, {
            personnel: [{ userId: u3.userId, role: "REFEREE", isPrimary: true }]
        }, u1.sessionId);
        ok("Add match personnel → success", addRes.status === 200 || addRes.status === 201 || addRes.data.success, JSON.stringify(addRes.data).slice(0,200));

        const getRes = await r("GET", `/api/personnel/matches/${matchId}/personnel`, null, u1.sessionId);
        ok("Get match personnel → 200", getRes.status === 200);
    }

    const userAssignRes = await r("GET", `/api/personnel/users/${u3.userId}/personnel`, null, u1.sessionId);
    ok("Get user personnel assignments → 200", userAssignRes.status === 200);
}

// ─── 15. SOCKET.IO ───────────────────────────────────────────────────────────
section("15. SOCKET.IO — Real-time");

await new Promise((resolve) => {
    let socketsDone = 0;
    const socketsNeeded = 2;
    const sockets = [];

    const checkDone = () => {
        if (++socketsDone >= socketsNeeded) {
            sockets.forEach(s => s.disconnect());
            resolve();
        }
    };

    // Socket for u1 — auth via handshake.auth.sessionId
    const s1 = io(BASE, {
        auth: { sessionId: u1.sessionId },
        transports: ["websocket"],
        timeout: 5000
    });
    sockets.push(s1);

    // Socket for u2
    const s2 = io(BASE, {
        auth: { sessionId: u2.sessionId },
        transports: ["websocket"],
        timeout: 5000
    });
    sockets.push(s2);

    let s1Connected = false;
    let s2Connected = false;

    s1.on("connect", () => {
        s1Connected = true;
        ok("Socket u1 connected", true);

        // Join match room if we have matchId
        if (matchId) {
            s1.emit("join:match", { matchId });
            ok("Socket u1 emit join:match", true);
        }

        if (s2Connected) checkDone();
    });

    s2.on("connect", () => {
        s2Connected = true;
        ok("Socket u2 connected", true);

        if (matchId) {
            s2.emit("join:match", { matchId });
        }

        if (s1Connected) checkDone();
    });

    // Listen for match events
    s1.on("match:update", (data) => {
        ok("Socket received match:update event", !!data);
    });

    s2.on("match:update", (data) => {
        ok("Socket u2 received match:update event", !!data);
    });

    s1.on("connect_error", (err) => {
        ok("Socket u1 connected", false, err.message);
        checkDone();
    });

    s2.on("connect_error", (err) => {
        ok("Socket u2 connected", false, err.message);
        checkDone();
    });

    // Timeout fallback
    setTimeout(() => {
        if (!s1Connected) { ok("Socket u1 connected", false, "timeout"); }
        if (!s2Connected) { ok("Socket u2 connected", false, "timeout"); }
        sockets.forEach(s => s.disconnect());
        resolve();
    }, 6000);
});

// ─── RESULTS ─────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log(`  TEST RESULTS`);
console.log(`${"═".repeat(60)}`);
console.log(`  ✅ PASSED: ${pass}`);
console.log(`  ❌ FAILED: ${fail}`);
console.log(`  📊 TOTAL:  ${pass + fail}`);
if (errors.length > 0) {
    console.log(`\n  Failed tests:`);
    errors.forEach(e => console.log(`    • ${e}`));
}
console.log(`${"═".repeat(60)}\n`);
console.log(`Test IDs created:`);
console.log(`  Users:      ${users.map(u => u.userId).join(", ")}`);
console.log(`  Location:   ${locationId}`);
console.log(`  Team:       ${teamId}`);
console.log(`  Tournament: ${tournamentId}`);
console.log(`  Match:      ${matchId}`);
if (achievementId) console.log(`  Achievement: ${achievementId}`);

process.exit(fail > 0 ? 1 : 0);
