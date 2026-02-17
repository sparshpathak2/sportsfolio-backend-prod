import { normalizeDoublesTeams } from "./helpers/teams.helpers.js";
import { nextPowerOfTwo, generateBracketStructure } from "./helpers/bracket.helpers.js";
import { shuffle } from "./helpers/shuffle.helpers.js";
import prisma from "../../../lib/prisma.js";
import { createBracketMatch, createMatchDependency } from "../../match/match.service.js";

export const runDoublesKnockout = async (tournament) => {
    const teams = await normalizeDoublesTeams(tournament);

    if (teams.length < 2) throw new Error("NOT_ENOUGH_TEAMS");

    const max = tournament.rules.maxParticipants;
    const selected = shuffle(teams).slice(0, max);

    // Calculate bracket size (next power of 2)
    const bracketSize = nextPowerOfTwo(selected.length);
    const byes = bracketSize - selected.length;

    // Sort teams - in production, sort by seed, for now just use as is
    // Byes go to highest seeded teams
    const byeTeams = selected.slice(0, byes);
    const firstRoundTeams = selected.slice(byes);

    // Validate first round has even number of teams
    if (firstRoundTeams.length % 2 !== 0) {
        throw new Error("INVALID_TEAM_COUNT: First round must have even number of teams");
    }

    // Calculate total rounds needed
    const totalRounds = Math.ceil(Math.log2(bracketSize));

    // Store all created matches
    const matchesByRound = {};

    await prisma.$transaction(async (tx) => {
        // ============================================
        // STEP 1: Create Round 1 matches
        // ============================================
        matchesByRound[1] = [];
        for (let i = 0; i < firstRoundTeams.length; i += 2) {
            const match = await createBracketMatch(tx, {
                tournament,
                teamAId: firstRoundTeams[i].id,
                teamBId: firstRoundTeams[i + 1].id,
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
                teamAId: null,
                teamBId: null,
                round: 2,
                bracketPosition: i,
                status: "PENDING"
            });
            matchesByRound[2].push(match);
        }

        // ============================================
        // STEP 3: Assign bye teams to Round 2 matches
        // ============================================
        // Distribute bye teams evenly across Round 2 matches
        for (let i = 0; i < byeTeams.length; i++) {
            const matchIndex = Math.floor(i / 2); // 0, 0, 1 for 3 byes
            const side = (i % 2) + 1; // 1, 2, 1 for 3 byes
            const round2Match = matchesByRound[2][matchIndex];
            const byeTeam = byeTeams[i];

            if (round2Match) {
                // Get all team members
                const teamMembers = await tx.teamMember.findMany({
                    where: { teamId: byeTeam.id }
                });

                // Calculate base position based on side
                const basePosition = side === 1 ? 1 : 3;

                // Add each team member as a match participant
                for (let j = 0; j < teamMembers.length; j++) {
                    await tx.matchParticipant.create({
                        data: {
                            matchId: round2Match.id,
                            userId: teamMembers[j].userId,
                            teamId: byeTeam.id,
                            side: side,
                            position: basePosition + j
                        }
                    });
                }
            }
        }

        // Check which Round 2 matches are now complete (have both teams = 4 participants)
        for (const match of matchesByRound[2]) {
            const participantCount = await tx.matchParticipant.count({
                where: { matchId: match.id }
            });

            if (participantCount === 4) {
                await tx.match.update({
                    where: { id: match.id },
                    data: { status: "SCHEDULED" }
                });
            }
        }

        // ============================================
        // STEP 4: Create dependencies from Round 1 to Round 2
        // ============================================
        for (let i = 0; i < matchesByRound[1].length; i++) {
            const round1Match = matchesByRound[1][i];
            // Each Round 1 match feeds into the corresponding Round 2 match's first slot
            const targetRound2Match = matchesByRound[2][i];

            if (targetRound2Match) {
                await createMatchDependency(tx, {
                    futureMatchId: targetRound2Match.id,
                    previousMatchId: round1Match.id,
                    position: 1 // First team slot
                });
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
                    teamAId: null,
                    teamBId: null,
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
    console.log(`✅ Doubles knockout created for tournament ${tournament.id}:`, {
        totalRounds,
        matchesCreated: Object.values(matchesByRound).flat().length,
        roundDistribution: Object.keys(matchesByRound).map(round => ({
            round: parseInt(round),
            matches: matchesByRound[round].length,
            scheduled: matchesByRound[round].filter(m => m?.status === "SCHEDULED").length,
            pending: matchesByRound[round].filter(m => m?.status === "PENDING").length
        })),
        byeTeams: byeTeams.length,
        firstRoundTeams: firstRoundTeams.length,
        bracketSize
    });

    return {
        totalRounds,
        matchesCreated: Object.values(matchesByRound).flat().length,
        roundDistribution: Object.keys(matchesByRound).map(round => ({
            round: parseInt(round),
            matches: matchesByRound[round].length
        })),
        byeTeams: byeTeams.map(t => ({ id: t.id, name: t.name })),
        firstRoundTeams: firstRoundTeams.map(t => ({ id: t.id, name: t.name })),
        bracketSize
    };
};