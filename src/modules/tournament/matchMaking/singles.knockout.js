import prisma from "../../../lib/prisma.js";
import { createBracketMatch, createMatchDependency } from "../../match/match.service.js";
import { nextPowerOfTwo, generateBracketStructure } from "./helpers/bracket.helpers.js";
import { shuffle } from "./helpers/shuffle.helpers.js";

export const runSinglesKnockout = async (tournament) => {
    // Get all players
    const players = tournament.participants
        .filter(p => p.playerId)
        .map(p => p.playerId);

    const min = tournament.rules.minParticipants ?? 2;

    if (players.length < min) {
        throw new Error(`MIN_PARTICIPANTS_NOT_MET: Have ${players.length}, need ${min}`);
    }

    const max = tournament.rules.maxParticipants ?? players.length;
    const selected = shuffle(players).slice(0, max);

    // Calculate bracket size (next power of 2)
    const bracketSize = nextPowerOfTwo(selected.length);
    const byes = bracketSize - selected.length;

    // Sort players - in production, sort by seed, for now just use as is
    // Byes go to highest seeded players
    const byePlayers = selected.slice(0, byes);
    const firstRoundPlayers = selected.slice(byes);

    // Validate first round has even number of players
    if (firstRoundPlayers.length % 2 !== 0) {
        throw new Error("INVALID_PLAYER_COUNT: First round must have even number of players");
    }

    // Calculate total rounds needed
    const totalRounds = Math.ceil(Math.log2(bracketSize));

    // Store all created matches for dependency linking
    const matchesByRound = {};

    await prisma.$transaction(async (tx) => {
        // ============================================
        // STEP 1: Create Round 1 matches
        // ============================================
        matchesByRound[1] = [];
        for (let i = 0; i < firstRoundPlayers.length; i += 2) {
            const match = await createBracketMatch(tx, {
                tournament,
                playerAId: firstRoundPlayers[i],
                playerBId: firstRoundPlayers[i + 1],
                round: 1,
                bracketPosition: i / 2,
                status: "SCHEDULED"
            });
            matchesByRound[1].push(match);
        }

        // ============================================
        // STEP 2: Create Round 2 matches
        // ============================================
        const round2MatchCount = bracketSize / 4; // 8/4 = 2 matches for round 2
        matchesByRound[2] = [];

        for (let i = 0; i < round2MatchCount; i++) {
            const match = await createBracketMatch(tx, {
                tournament,
                playerAId: null,
                playerBId: null,
                round: 2,
                bracketPosition: i,
                status: "PENDING"
            });
            matchesByRound[2].push(match);
        }

        // ============================================
        // STEP 3: Assign bye players to Round 2 matches
        // ============================================
        // Distribute bye players evenly across Round 2 matches
        for (let i = 0; i < byePlayers.length; i++) {
            const matchIndex = Math.floor(i / 2); // 0, 0, 1 for 3 byes
            const position = (i % 2) + 1; // 1, 2, 1 for 3 byes
            const round2Match = matchesByRound[2][matchIndex];

            if (round2Match) {
                await tx.matchParticipant.create({
                    data: {
                        matchId: round2Match.id,
                        userId: byePlayers[i],
                        position: position
                    }
                });
            }
        }

        // Check which Round 2 matches are now complete (have both players)
        for (const match of matchesByRound[2]) {
            const participantCount = await tx.matchParticipant.count({
                where: { matchId: match.id }
            });

            if (participantCount === 2) {
                await tx.match.update({
                    where: { id: match.id },
                    data: { status: "SCHEDULED" }
                });
            }
        }

        // ============================================
        // STEP 4: Create dependencies from Round 1 to Round 2
        // ============================================
        // for (let i = 0; i < matchesByRound[1].length; i++) {
        //     const round1Match = matchesByRound[1][i];
        //     // Each Round 1 match feeds into the corresponding Round 2 match's first slot
        //     const targetRound2Match = matchesByRound[2][i];

        //     if (targetRound2Match) {
        //         await createMatchDependency(tx, {
        //             futureMatchId: targetRound2Match.id,
        //             previousMatchId: round1Match.id,
        //             position: 1 // First slot (position 1)
        //         });
        //     }
        // }

        // ============================================
        // STEP 4: Create dependencies from Round 1 to Round 2
        // ============================================
        for (let i = 0; i < matchesByRound[1].length; i++) {
            const round1Match = matchesByRound[1][i];
            const targetRound2Match = matchesByRound[2][i];

            if (!targetRound2Match) continue;

            // Find which positions are already filled by bye players
            const existingParticipants = await tx.matchParticipant.findMany({
                where: { matchId: targetRound2Match.id },
                select: { position: true }
            });

            const filledPositions = new Set(existingParticipants.map(p => p.position));

            // Determine which position needs the winner
            if (!filledPositions.has(1)) {
                // Position 1 is empty
                await createMatchDependency(tx, {
                    futureMatchId: targetRound2Match.id,
                    previousMatchId: round1Match.id,
                    position: 1
                });
                console.log(`📌 Dependency: Match ${round1Match.id} → ${targetRound2Match.id} (pos 1)`);
            }
            else if (!filledPositions.has(2)) {
                // Position 1 is filled but position 2 is empty
                await createMatchDependency(tx, {
                    futureMatchId: targetRound2Match.id,
                    previousMatchId: round1Match.id,
                    position: 2
                });
                console.log(`📌 Dependency: Match ${round1Match.id} → ${targetRound2Match.id} (pos 2)`);
            }
            else {
                // Both positions are filled - no dependency needed
                console.log(`ℹ️ Match ${targetRound2Match.id} already full, no dependency needed`);
            }
        }

        // ============================================
        // STEP 5: Create subsequent rounds (3, 4, etc.)
        // ============================================
        let previousRoundMatches = matchesByRound[2];

        for (let round = 3; round <= totalRounds; round++) {
            const matchesInRound = bracketSize / Math.pow(2, round);
            matchesByRound[round] = [];

            for (let i = 0; i < matchesInRound; i++) {
                const match = await createBracketMatch(tx, {
                    tournament,
                    playerAId: null,
                    playerBId: null,
                    round,
                    bracketPosition: i,
                    status: "PENDING"
                });
                matchesByRound[round].push(match);

                // Create dependencies from previous round
                const prevMatch1 = previousRoundMatches[i * 2];
                const prevMatch2 = previousRoundMatches[i * 2 + 1];

                if (prevMatch1) {
                    await createMatchDependency(tx, {
                        futureMatchId: match.id,
                        previousMatchId: prevMatch1.id,
                        position: 1
                    });
                }

                if (prevMatch2) {
                    await createMatchDependency(tx, {
                        futureMatchId: match.id,
                        previousMatchId: prevMatch2.id,
                        position: 2
                    });
                }
            }

            previousRoundMatches = matchesByRound[round];
        }

        // ============================================
        // STEP 6: Update tournament status
        // ============================================
        await tx.tournament.update({
            where: { id: tournament.id },
            data: {
                status: "ONGOING",
                matchMakingAt: new Date(),
            },
        });

        // ============================================
        // STEP 7: Refresh match data for accurate logging
        // ============================================
        for (let round = 1; round <= totalRounds; round++) {
            if (matchesByRound[round] && matchesByRound[round].length > 0) {
                const updatedMatches = await Promise.all(
                    matchesByRound[round].map(async (match) => {
                        return await tx.match.findUnique({
                            where: { id: match.id },
                            select: {
                                id: true,
                                status: true,
                                round: true,
                                bracketPosition: true
                            }
                        });
                    })
                );
                matchesByRound[round] = updatedMatches;
            }
        }
    });

    // Log success for debugging with accurate statuses
    console.log(`✅ Singles knockout created for tournament ${tournament.id}:`, {
        totalRounds,
        matchesCreated: Object.values(matchesByRound).flat().length,
        roundDistribution: Object.keys(matchesByRound).map(round => ({
            round: parseInt(round),
            matches: matchesByRound[round].length,
            scheduled: matchesByRound[round].filter(m => m?.status === "SCHEDULED").length,
            pending: matchesByRound[round].filter(m => m?.status === "PENDING").length
        })),
        byePlayers: byePlayers.length,
        firstRoundPlayers: firstRoundPlayers.length,
        bracketSize
    });

    return {
        totalRounds,
        matchesCreated: Object.values(matchesByRound).flat().length,
        roundDistribution: Object.keys(matchesByRound).map(round => ({
            round: parseInt(round),
            matches: matchesByRound[round].length
        })),
        byePlayers,
        firstRoundPlayers,
        bracketSize
    };
};