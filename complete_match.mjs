// Script to complete a match and verify stats populate correctly
const BASE = "http://localhost:3001";

async function r(method, path, body, sessionId) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { "Content-Type": "application/json", "x-session-id": sessionId },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

// Use users from the test run
const U1_SESSION = "cmoessy3d0015g4rgqcavp5of"; // Alice
const U2_SESSION = "cmoessy4b0018g4rgmsz8n339"; // Bob
const U1_ID = "cmoeseths0000g4d8c9nicu6t";
const U2_ID = "cmoesetj60004g4d8m0tycpmg";
const LOCATION_ID = "cmoessya7001dg4rgg2bt4yf0";

console.log("\n🎯 Creating a new test match to generate stats...");

// 1. Create a fresh match
const matchRes = await r("POST", "/api/matches", {
    name: "Stats Test Match",
    sportCode: "BADMINTON",
    gameType: "SINGLES",
    partsCount: 3,
    playArea: 1,
    participantIds: [U1_ID, U2_ID],
    servingUserId: U1_ID,
    locations: [{ id: LOCATION_ID }]
}, U1_SESSION);

if (!matchRes.data.success) {
    console.error("❌ Failed to create match:", matchRes.data.message);
    process.exit(1);
}
const matchId = matchRes.data.data?.id;
console.log("✅ Match created:", matchId);

// 2. Start the match
const startRes = await r("POST", `/api/matches/${matchId}/start`, null, U1_SESSION);
console.log("✅ Match started:", startRes.data.success || startRes.data.message);

// 3. Get match details to find participant IDs
const matchData = await r("GET", `/api/matches/${matchId}`, null, U1_SESSION);
const participants = matchData.data.data?.participants || matchData.data.participants || [];
const p1 = participants.find(p => p.userId === U1_ID || p.user?.id === U1_ID);
const p2 = participants.find(p => p.userId === U2_ID || p.user?.id === U2_ID);

if (!p1 || !p2) {
    console.error("❌ Could not find participants:", JSON.stringify(participants, null, 2));
    process.exit(1);
}
console.log(`✅ Participants: p1=${p1.id} (Alice), p2=${p2.id} (Bob)`);

// 4. Record enough score events for p1 (Alice) to win 2 games
//    Strategy: Alice scores all events until game 1 done (21+ events),
//    then game 2 auto-starts and we score until 21 again
console.log("\n📊 Recording score events until Alice wins 2 games (21+ points each)...");

let gameOver = false;
let eventCount = 0;

// Record up to 100 events, all for Alice (fastest possible win)
for (let i = 0; i < 100 && !gameOver; i++) {
    // Every 10th event let Bob score to make it more realistic
    const isAliceScoring = (i % 10 !== 0);
    const scorer = isAliceScoring ? p1 : p2;
    const scorerUserId = isAliceScoring ? U1_ID : U2_ID;
    const scorerSession = isAliceScoring ? U1_SESSION : U2_SESSION;

    const ev = await r("POST", `/api/matches/${matchId}/events/record`, {
        type: "SCORE",
        payload: { participantId: scorer.id, userId: scorerUserId, shotType: "SMASH", isWinner: true }
    }, scorerSession);

    eventCount++;

    if (!ev.data?.success && ev.status !== 200) {
        console.log(`  ⚠️  Event ${i} error (${ev.status}): ${ev.data?.message}`);
        // If match completed, stop
        if (ev.data?.message?.includes("COMPLETED")) break;
        continue;
    }

    const matchState = ev.data?.data?.matchState;
    if (matchState?.match?.status === "COMPLETED" || ev.data?.data?.matchCompleted) {
        console.log(`✅ Match auto-completed at event ${eventCount}`);
        gameOver = true;
        break;
    }

    if (i % 10 === 9) {
        process.stdout.write(`  ${eventCount} events recorded...\r`);
    }
}

console.log(`\n  Total events recorded: ${eventCount}`);

// Final check
let finalMatchState = await r("GET", `/api/matches/${matchId}`, null, U1_SESSION);
let matchStatus = finalMatchState.data?.data?.status || finalMatchState.data?.status;
console.log(`  Match status: ${matchStatus}`);

// If still not completed, try ending manually
if (matchStatus === "LIVE") {
    console.log("\n⚠️  Match still LIVE after score events. Trying to end manually...");
    const endRes = await r("POST", `/api/matches/${matchId}/end`, null, U1_SESSION);
    console.log("End match response:", JSON.stringify(endRes.data).slice(0, 200));
}

// 5. Wait a moment then check stats
await new Promise(r => setTimeout(r, 500));

console.log("\n📈 Checking stats for Alice (U1)...");
const overviewRes = await r("GET", `/api/stats/badminton/${U1_ID}/overview`, null, U1_SESSION);
const singlesRes = await r("GET", `/api/stats/badminton/${U1_ID}/singles`, null, U1_SESSION);
const historyRes = await r("GET", `/api/stats/badminton/${U1_ID}/history`, null, U1_SESSION);

console.log("\n=== OVERVIEW ===");
console.log(JSON.stringify(overviewRes.data.data, null, 2));

console.log("\n=== SINGLES PERFORMANCE ===");
console.log(JSON.stringify(singlesRes.data.data?.performance, null, 2));

console.log("\n=== MATCH HISTORY (last 3) ===");
console.log(JSON.stringify(historyRes.data.data?.matches?.slice(0, 3), null, 2));

const wins = singlesRes.data.data?.performance?.wins;
const losses = singlesRes.data.data?.performance?.losses;
const total = singlesRes.data.data?.performance?.matchesPlayed;
console.log(`\n✅ Stats populated: ${total} matches, ${wins} wins, ${losses} losses, winRate=${singlesRes.data.data?.performance?.winRate}%`);

// Check the full stats for shot analysis  
console.log("\n📊 Checking /all endpoint for shot/rally/serve stats...");
const allRes = await r("GET", `/api/stats/badminton/${U1_ID}/all`, null, U1_SESSION);
const overall = allRes.data.data?.summary?.stats?.overall;
console.log("shotAnalysis:", JSON.stringify(overall?.shotAnalysis));
console.log("rallyStats:", JSON.stringify(overall?.rallyStats));
console.log("serveStats:", JSON.stringify(overall?.serveStats));
console.log("shotQuality:", JSON.stringify(overall?.shotQuality));
console.log("winnersAndErrors:", JSON.stringify(overall?.winnersAndErrors));
