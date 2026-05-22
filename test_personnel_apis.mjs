/**
 * Personnel API Test Script
 * Tests all 10 personnel endpoints with real data
 *
 * Run: node test_personnel_apis.mjs
 */

const BASE = "http://localhost:3001";
let pass = 0;
let fail = 0;
const errors = [];

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
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
const log     = (label, val) => console.log(`  ℹ  ${label}:`, JSON.stringify(val, null, 2));

// ─── State ────────────────────────────────────────────────────────────────────
let u1, u2, u3;                             // primary organizer, referee, outsider
let tournamentId, matchId, locationId;
let manualMatchId;                          // a standalone match (no tournamentId)

// ═════════════════════════════════════════════════════════════════════════════
// 0. SETUP — Auth + seed data
// ═════════════════════════════════════════════════════════════════════════════
section("0. SETUP — Create 3 test users");

const phones = ["+919111111101", "+919111111102", "+919111111103"];
const names  = ["Organizer Test", "Referee Test",  "Outsider Test"];
const users  = [];

for (let i = 0; i < 3; i++) {
    const otpRes = await r("POST", "/api/auth/request-otp", { phone: phones[i] });
    ok(`Request OTP [${names[i]}]`, otpRes.data.success);

    const otp = otpRes.data.otp;
    ok(`OTP in dev mode [${names[i]}]`, !!otp, JSON.stringify(otpRes.data));

    const verifyRes = await r("POST", "/api/auth/verify-otp", { phone: phones[i], otp });
    ok(`Verify OTP [${names[i]}]`, verifyRes.data.success, JSON.stringify(verifyRes.data));

    users.push({
        phone: phones[i],
        name:  names[i],
        sessionId: verifyRes.data.sessionId,
        userId:    verifyRes.data.user?.id,
    });
}

[u1, u2, u3] = users;
console.log(`\n  u1 (organizer)  userId=${u1.userId}`);
console.log(`  u2 (referee)    userId=${u2.userId}`);
console.log(`  u3 (outsider)   userId=${u3.userId}`);

// ─── Create Location ──────────────────────────────────────────────────────────
section("0b. SETUP — Location");
{
    const res = await r("POST", "/api/locations", {
        name: `Personnel Test Hall ${Date.now()}`,
        city: "Mumbai",
        address: "123 Test Complex",
        latitude: 19.1197,
        longitude: 72.8471,
    }, u1.sessionId);
    ok("Create location", res.data.success || res.status === 201);
    locationId = res.data.data?.id;
    ok("locationId returned", !!locationId, JSON.stringify(res.data).slice(0, 200));
}

// ─── Create Tournament (u1 auto-added as primary organizer) ───────────────────
section("0c. SETUP — Tournament");
{
    const res = await r("POST", "/api/tournaments", {
        name: `Personnel Test Tournament ${Date.now()}`,
        sportCode: "BADMINTON",
        tournamentType: "KNOCKOUT",
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate:   new Date(Date.now() + 3 * 86400000).toISOString(),
        isPublic: true,
        entryFee: 0,
        city: "Mumbai",
        locations: [{ id: locationId }],
        rules: {
            playAreas: 2,
            partsPerMatch: 3,
            gameType: "SINGLES",
            maxParticipants: 8,
        },
    }, u1.sessionId);
    ok("Create tournament", res.data.success || res.status === 201, JSON.stringify(res.data).slice(0, 300));
    tournamentId = res.data.data?.id || res.data.id;
    ok("tournamentId returned", !!tournamentId, JSON.stringify(res.data).slice(0, 200));
}

// ─── Create Manual Match (no tournament — u1 is creator/primary official) ─────
section("0d. SETUP — Manual Match");
{
    const res = await r("POST", "/api/matches", {
        name: "Personnel Test Match",
        sportCode: "BADMINTON",
        gameType: "SINGLES",
        partsCount: 3,
        playArea: 1,
        locations: [{ id: locationId }],
        participantIds: [u1.userId, u2.userId],
        servingUserId: u1.userId,
    }, u1.sessionId);
    ok("Create manual match", res.data.success || res.status === 201, JSON.stringify(res.data).slice(0, 300));
    manualMatchId = res.data.data?.id || res.data.id;
    ok("manualMatchId returned", !!manualMatchId, JSON.stringify(res.data).slice(0, 200));

    // Also keep a reference for tournament match tests
    matchId = manualMatchId;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GET /api/personnel/available
// ═════════════════════════════════════════════════════════════════════════════
section("1. GET /api/personnel/available");

{
    // No filters
    const res = await r("GET", "/api/personnel/available", null, u1.sessionId);
    ok("available — no filters → 200", res.status === 200);
    ok("available — returns array", Array.isArray(res.data.data));

    // Filter by entityType
    const res2 = await r("GET", "/api/personnel/available?entityType=TOURNAMENT", null, u1.sessionId);
    ok("available?entityType=TOURNAMENT → 200", res2.status === 200);

    // Filter by role
    const res3 = await r("GET", "/api/personnel/available?entityType=MATCH&role=REFEREE", null, u1.sessionId);
    ok("available?role=REFEREE → 200", res3.status === 200);

    // Search by name
    const res4 = await r("GET", `/api/personnel/available?search=Referee`, null, u1.sessionId);
    ok("available?search=Referee → 200", res4.status === 200);

    console.log("\n  Sample response:");
    log("GET /available", { success: res.data.success, count: res.data.data?.length, sample: res.data.data?.[0] });
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. POST /api/personnel/tournaments/:tournamentId/personnel
// ═════════════════════════════════════════════════════════════════════════════
section("2. POST /api/personnel/tournaments/:tournamentId/personnel");

{
    // ✅ u1 (isPrimary) adds u2 as REFEREE
    const res = await r(
        "POST",
        `/api/personnel/tournaments/${tournamentId}/personnel`,
        { personnel: [{ userId: u2.userId, role: "REFEREE", isPrimary: false }] },
        u1.sessionId
    );
    ok("add tournament personnel — success (u1 adds u2 as REFEREE)", res.data.success, JSON.stringify(res.data));
    ok("returns data array", Array.isArray(res.data.data));

    log("POST /tournaments/:id/personnel — 200", res.data);

    // ✅ Add a SCOREKEEPER too
    const res2 = await r(
        "POST",
        `/api/personnel/tournaments/${tournamentId}/personnel`,
        { personnel: [{ userId: u3.userId, role: "SCOREKEEPER", isPrimary: false }] },
        u1.sessionId
    );
    ok("add tournament personnel — second user (SCOREKEEPER)", res2.data.success);

    // ❌ u3 (not primary) tries to add
    const res3 = await r(
        "POST",
        `/api/personnel/tournaments/${tournamentId}/personnel`,
        { personnel: [{ userId: u2.userId, role: "UMPIRE", isPrimary: false }] },
        u3.sessionId
    );
    ok("add tournament personnel — 403 when not primary", res3.status === 403);
    ok("403 error code = UNAUTHORIZED_NOT_TOURNAMENT_OWNER", res3.data.message === "UNAUTHORIZED_NOT_TOURNAMENT_OWNER");

    log("POST /tournaments/:id/personnel — 403", res3.data);

    // ❌ Missing body
    const res4 = await r(
        "POST",
        `/api/personnel/tournaments/${tournamentId}/personnel`,
        {},
        u1.sessionId
    );
    ok("add tournament personnel — 400 when body missing", res4.status === 400);

    log("POST /tournaments/:id/personnel — 400", res4.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. GET /api/personnel/tournaments/:tournamentId/personnel
// ═════════════════════════════════════════════════════════════════════════════
section("3. GET /api/personnel/tournaments/:tournamentId/personnel");

{
    // All personnel
    const res = await r("GET", `/api/personnel/tournaments/${tournamentId}/personnel`, null, u1.sessionId);
    ok("get tournament personnel → 200", res.status === 200);
    ok("returns array", Array.isArray(res.data.data));
    ok("has at least 2 records (organizer + referee)", res.data.data?.length >= 2, `count=${res.data.data?.length}`);

    log("GET /tournaments/:id/personnel", res.data);

    // Filter by role
    const res2 = await r("GET", `/api/personnel/tournaments/${tournamentId}/personnel?role=REFEREE`, null, u1.sessionId);
    ok("filter by role=REFEREE → 200", res2.status === 200);
    const allReferee = res2.data.data?.every(p => p.role === "REFEREE");
    ok("all returned records have role=REFEREE", allReferee ?? true);

    log("GET /tournaments/:id/personnel?role=REFEREE", res2.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. PUT /api/personnel/tournaments/:tournamentId/personnel/:userId
// ═════════════════════════════════════════════════════════════════════════════
section("4. PUT /api/personnel/tournaments/:tournamentId/personnel/:userId");

{
    // ✅ u1 updates u2's role to UMPIRE
    const res = await r(
        "PUT",
        `/api/personnel/tournaments/${tournamentId}/personnel/${u2.userId}`,
        { role: "UMPIRE", isPrimary: false },
        u1.sessionId
    );
    ok("update tournament personnel — success", res.data.success, JSON.stringify(res.data));
    ok("role changed to UMPIRE", res.data.data?.role === "UMPIRE");

    log("PUT /tournaments/:id/personnel/:userId — 200", res.data);

    // ❌ u3 (not primary) tries to update
    const res2 = await r(
        "PUT",
        `/api/personnel/tournaments/${tournamentId}/personnel/${u2.userId}`,
        { role: "REFEREE" },
        u3.sessionId
    );
    ok("update tournament personnel — 403 when not primary", res2.status === 403);
    ok("403 error code = UNAUTHORIZED_NOT_TOURNAMENT_OWNER", res2.data.message === "UNAUTHORIZED_NOT_TOURNAMENT_OWNER");

    log("PUT /tournaments/:id/personnel/:userId — 403", res2.data);

    // ✅ Restore u2 back to REFEREE for subsequent tests
    await r(
        "PUT",
        `/api/personnel/tournaments/${tournamentId}/personnel/${u2.userId}`,
        { role: "REFEREE", isPrimary: false },
        u1.sessionId
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. DELETE /api/personnel/tournaments/:tournamentId/personnel/:userId
// ═════════════════════════════════════════════════════════════════════════════
section("5. DELETE /api/personnel/tournaments/:tournamentId/personnel/:userId");

{
    // ❌ u3 (not primary) tries to remove u2
    const res2 = await r(
        "DELETE",
        `/api/personnel/tournaments/${tournamentId}/personnel/${u2.userId}`,
        null,
        u3.sessionId
    );
    ok("remove tournament personnel — 403 when not primary", res2.status === 403);
    ok("403 error code = UNAUTHORIZED_NOT_TOURNAMENT_OWNER", res2.data.message === "UNAUTHORIZED_NOT_TOURNAMENT_OWNER");

    log("DELETE /tournaments/:id/personnel/:userId — 403", res2.data);

    // ✅ u1 (isPrimary) removes u3 (SCOREKEEPER)
    const res = await r(
        "DELETE",
        `/api/personnel/tournaments/${tournamentId}/personnel/${u3.userId}`,
        null,
        u1.sessionId
    );
    ok("remove tournament personnel — success (u1 removes u3)", res.data.success, JSON.stringify(res.data));

    log("DELETE /tournaments/:id/personnel/:userId — 200", res.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. POST /api/personnel/matches/:matchId/personnel
// ═════════════════════════════════════════════════════════════════════════════
section("6. POST /api/personnel/matches/:matchId/personnel");

{
    // ✅ u1 (primary match official — auto-added at match creation) adds u2 as REFEREE
    const res = await r(
        "POST",
        `/api/personnel/matches/${manualMatchId}/personnel`,
        { personnel: [{ userId: u2.userId, role: "REFEREE", isPrimary: false }] },
        u1.sessionId
    );
    ok("add match personnel — success (u1 adds u2)", res.data.success, JSON.stringify(res.data));
    ok("returns data array", Array.isArray(res.data.data));

    log("POST /matches/:id/personnel — 200", res.data);

    // ❌ u3 (outsider) tries to add
    const res2 = await r(
        "POST",
        `/api/personnel/matches/${manualMatchId}/personnel`,
        { personnel: [{ userId: u3.userId, role: "SCOREKEEPER", isPrimary: false }] },
        u3.sessionId
    );
    ok("add match personnel — 403 when outsider", res2.status === 403);
    ok("403 error code = UNAUTHORIZED_NOT_MATCH_OWNER", res2.data.message === "UNAUTHORIZED_NOT_MATCH_OWNER");

    log("POST /matches/:id/personnel — 403", res2.data);

    // ❌ Missing body
    const res3 = await r(
        "POST",
        `/api/personnel/matches/${manualMatchId}/personnel`,
        {},
        u1.sessionId
    );
    ok("add match personnel — 400 when body missing", res3.status === 400);

    log("POST /matches/:id/personnel — 400", res3.data);

    // ❌ Invalid matchId
    const res4 = await r(
        "POST",
        `/api/personnel/matches/nonexistent_match_xyz/personnel`,
        { personnel: [{ userId: u2.userId, role: "REFEREE", isPrimary: false }] },
        u1.sessionId
    );
    ok("add match personnel — 404 for nonexistent match", res4.status === 404);
    ok("404 error code = MATCH_NOT_FOUND", res4.data.message === "MATCH_NOT_FOUND");

    log("POST /matches/:id/personnel — 404", res4.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. GET /api/personnel/matches/:matchId/personnel
// ═════════════════════════════════════════════════════════════════════════════
section("7. GET /api/personnel/matches/:matchId/personnel");

{
    const res = await r("GET", `/api/personnel/matches/${manualMatchId}/personnel`, null, u1.sessionId);
    ok("get match personnel → 200", res.status === 200);
    ok("returns array", Array.isArray(res.data.data));
    ok("has at least 1 record", res.data.data?.length >= 1, `count=${res.data.data?.length}`);

    log("GET /matches/:id/personnel", res.data);

    // Filter by role
    const res2 = await r("GET", `/api/personnel/matches/${manualMatchId}/personnel?role=REFEREE`, null, u1.sessionId);
    ok("filter by role=REFEREE → 200", res2.status === 200);

    log("GET /matches/:id/personnel?role=REFEREE", res2.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. PUT /api/personnel/matches/:matchId/personnel/:userId
// ═════════════════════════════════════════════════════════════════════════════
section("8. PUT /api/personnel/matches/:matchId/personnel/:userId");

{
    const res = await r(
        "PUT",
        `/api/personnel/matches/${manualMatchId}/personnel/${u2.userId}`,
        { role: "SCOREKEEPER", isPrimary: false },
        u1.sessionId
    );
    ok("update match personnel — success", res.data.success, JSON.stringify(res.data));
    ok("role changed to SCOREKEEPER", res.data.data?.role === "SCOREKEEPER");

    log("PUT /matches/:id/personnel/:userId — 200", res.data);

    // Restore role
    await r(
        "PUT",
        `/api/personnel/matches/${manualMatchId}/personnel/${u2.userId}`,
        { role: "REFEREE", isPrimary: false },
        u1.sessionId
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. DELETE /api/personnel/matches/:matchId/personnel/:userId
// ═════════════════════════════════════════════════════════════════════════════
section("9. DELETE /api/personnel/matches/:matchId/personnel/:userId");

{
    const res = await r(
        "DELETE",
        `/api/personnel/matches/${manualMatchId}/personnel/${u2.userId}`,
        null,
        u1.sessionId
    );
    ok("remove match personnel — success", res.data.success, JSON.stringify(res.data));

    log("DELETE /matches/:id/personnel/:userId — 200", res.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. GET /api/personnel/users/:userId/personnel
// ═════════════════════════════════════════════════════════════════════════════
section("10. GET /api/personnel/users/:userId/personnel");

{
    // u1 should have assignments: tournament organizer + match official
    // Response shape: { success, data: { tournaments: [...], matches: [...] } }
    const res = await r("GET", `/api/personnel/users/${u1.userId}/personnel`, null, u1.sessionId);
    ok("get user personnel assignments → 200", res.status === 200);
    ok("data has tournaments key", Array.isArray(res.data.data?.tournaments));
    ok("data has matches key", Array.isArray(res.data.data?.matches));
    ok("u1 has at least 1 tournament assignment", res.data.data?.tournaments?.length >= 1,
        `tournaments=${res.data.data?.tournaments?.length}`);
    ok("u1 has at least 1 match assignment", res.data.data?.matches?.length >= 1,
        `matches=${res.data.data?.matches?.length}`);

    log("GET /users/:id/personnel (u1)", res.data);

    // u2 — has assignments in TOURNAMENT still (added as referee)
    const res2 = await r("GET", `/api/personnel/users/${u2.userId}/personnel`, null, u2.sessionId);
    ok("get user personnel assignments → 200 (u2)", res2.status === 200);
    ok("u2 data has tournaments key", Array.isArray(res2.data.data?.tournaments));

    log("GET /users/:id/personnel (u2)", res2.data);
}

// ═════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
if (errors.length > 0) {
    console.log(`\n  Failed tests:`);
    errors.forEach(e => console.log(`    ✗ ${e}`));
}
console.log(`${"═".repeat(60)}\n`);
