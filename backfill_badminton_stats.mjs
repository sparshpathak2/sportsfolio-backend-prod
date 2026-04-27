/**
 * Backfill script — re-aggregates BadmintonMatchStats for all completed BADMINTON matches
 * Targets matches where BadmintonMatchStats is missing OR all shot stats are 0.
 * Run with: node backfill_badminton_stats.mjs
 */
import prisma from './src/lib/prisma.js';
import { aggregateMatchStats } from './src/modules/stats/matchStatsAggregator.service.js';

console.log('🔄 Starting BadmintonMatchStats backfill...\n');

// Find all completed BADMINTON matches
const completedMatches = await prisma.match.findMany({
    where: { status: 'COMPLETED', sportCode: 'BADMINTON' },
    select: { id: true, status: true, completedAt: true }
});

console.log(`Found ${completedMatches.length} completed BADMINTON matches.`);

// Find which already have BadmintonMatchStats with non-zero shot data
const matchStatsWithShots = await prisma.matchStats.findMany({
    where: {
        matchId: { in: completedMatches.map(m => m.id) },
        badmintonStats: {
            OR: [
                { smashes: { gt: 0 } },
                { drops: { gt: 0 } },
                { clears: { gt: 0 } },
                { winners: { gt: 0 } },
                { unforcedErrors: { gt: 0 } },
                { forcedErrors: { gt: 0 } },
            ]
        }
    },
    select: { matchId: true }
});

const alreadyOkMatchIds = new Set(matchStatsWithShots.map(ms => ms.matchId));
const toBackfill = completedMatches.filter(m => !alreadyOkMatchIds.has(m.id));

console.log(`${alreadyOkMatchIds.size} matches already have shot stats.`);
console.log(`${toBackfill.length} matches need re-aggregation.\n`);

let success = 0;
let failed = 0;

for (const match of toBackfill) {
    try {
        // Delete existing BadmintonMatchStats for this match so upsert creates fresh
        const existingMs = await prisma.matchStats.findMany({
            where: { matchId: match.id },
            select: { id: true }
        });
        for (const ms of existingMs) {
            await prisma.badmintonMatchStats.deleteMany({ where: { matchStatsId: ms.id } });
        }

        await aggregateMatchStats(match.id);
        console.log(`  ✅ Re-aggregated: ${match.id}`);
        success++;
    } catch (err) {
        console.log(`  ❌ Failed: ${match.id} — ${err.message}`);
        failed++;
    }
}

console.log(`\n✅ Backfill complete: ${success} succeeded, ${failed} failed.`);

// Verify results
const now = await prisma.badmintonMatchStats.count();
console.log(`\nTotal BadmintonMatchStats records in DB: ${now}`);

// Show stats for the Flutter user if present
const flutterUserId = 'cmly069tp0003g4qg5qqtjwno';
const userStats = await prisma.matchStats.findMany({
    where: { userId: flutterUserId },
    include: { badmintonStats: { select: { smashes: true, drops: true, clears: true, winners: true, unforcedErrors: true } } }
});
if (userStats.length > 0) {
    console.log(`\nStats for Flutter user (${flutterUserId}):`);
    for (const ms of userStats) {
        console.log(`  Match ${ms.matchId}: ${JSON.stringify(ms.badmintonStats)}`);
    }
}

await prisma.$disconnect();
