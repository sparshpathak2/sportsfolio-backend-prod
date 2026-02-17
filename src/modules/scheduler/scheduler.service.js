import cron from "node-cron";
import prisma from "../../lib/prisma.js";
import { runMatchmaking } from "../tournament/tournament.service.js";

let isInitialized = false;
let cronJob = null;

/**
 * Initialize the matchmaking scheduler
 * Run every minute to check for tournaments that need matchmaking
 */
export const initializeMatchmakingScheduler = () => {
    if (isInitialized) {
        console.log("⚠️ Matchmaking scheduler already initialized");
        return;
    }

    cronJob = cron.schedule("* * * * *", async () => {
        await processPendingMatchmaking();
    });

    isInitialized = true;
    console.log("✅ Matchmaking scheduler initialized");

    // Run once immediately on startup
    processPendingMatchmaking();
};

/**
 * Stop the scheduler (useful for graceful shutdown)
 */
export const stopMatchmakingScheduler = () => {
    if (cronJob) {
        cronJob.stop();
        isInitialized = false;
        console.log("🛑 Matchmaking scheduler stopped");
    }
};

/**
 * Process all tournaments that are ready for matchmaking
 */
export const processPendingMatchmaking = async () => {
    try {
        const now = new Date();

        const tournaments = await prisma.tournament.findMany({
            where: {
                status: "PUBLISHED",
                matchMakingAt: {
                    lte: now, // Less than or equal to current time
                    not: null
                },
                // Only process if matchmaking hasn't been triggered yet
                // You can add a status field if you want, but this works without schema changes
                matches: {
                    none: {} // No matches created yet
                }
            },
            select: {
                id: true,
                name: true,
                matchMakingAt: true
            }
        });

        if (tournaments.length === 0) {
            return;
        }

        console.log(`🔍 Found ${tournaments.length} tournament(s) pending matchmaking`);

        for (const tournament of tournaments) {
            await triggerTournamentMatchmaking(tournament);
        }
    } catch (error) {
        console.error("❌ Error processing pending matchmaking:", error);
    }
};

/**
 * Trigger matchmaking for a single tournament
 */
export const triggerTournamentMatchmaking = async (tournament) => {
    try {
        console.log(`🎯 Auto-triggering matchmaking for: ${tournament.name} (${tournament.id})`);
        console.log(`   Scheduled time: ${tournament.matchMakingAt}`);

        await runMatchmaking(tournament.id);

        console.log(`✅ Matchmaking completed for tournament: ${tournament.id}`);
    } catch (error) {
        console.error(`❌ Matchmaking failed for tournament ${tournament.id}:`, error.message);

        // Optional: Update tournament with error info if you add status fields
        // await prisma.tournament.update({
        //     where: { id: tournament.id },
        //     data: { 
        //         matchMakingError: error.message,
        //         matchMakingStatus: "FAILED" 
        //     }
        // });
    }
};