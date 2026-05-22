import prisma from "../../lib/prisma.js";
import { EngineFactory, MatchProgressionFactory } from "../../domains/EngineFactory.js";
import { calculateMatchPoints, updatePlayerStatsAfterMatch } from "../stats/badmintonStats/stats.service.js";
import { addPersonnel } from "../personnel/personnel.service.js";
import { aggregateMatchStats } from "../stats/matchStatsAggregator.service.js";
import { checkTournamentMatchAchievements } from "../achievement/achievement.service.js";

export const startMatch = async ({ matchId, userId }) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            tournament: { include: { rules: true } },
            participants: true,
            parts: true,
        },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");

    // Verify caller is authorized:
    // - Direct match official (manual or tournament match), OR
    // - Tournament official (tournament matches only — can start any match in their tournament)
    const [matchOfficial, tournamentOfficial] = await Promise.all([
        prisma.personnel.findFirst({
            where: { entityType: "MATCH", entityId: matchId, userId },
        }),
        match.tournamentId
            ? prisma.personnel.findFirst({
                where: { entityType: "TOURNAMENT", entityId: match.tournamentId, userId },
            })
            : Promise.resolve(null),
    ]);

    if (!matchOfficial && !tournamentOfficial) {
        throw new Error("UNAUTHORIZED_NOT_MATCH_OFFICIAL");
    }

    if (match.status === "LIVE") {
        console.log(`⚠️ Match ${matchId} is already LIVE`);
        return {
            success: true,
            message: "MATCH_ALREADY_LIVE",
            data: match
        };
    }

    if (match.status === "COMPLETED") {
        console.log(`⚠️ Match ${matchId} is already COMPLETED`);
        return {
            success: true,
            message: "MATCH_ALREADY_COMPLETED",
            data: match
        };
    }

    // 1️⃣ Create MatchPart entries if not exist
    if (match.parts.length === 0) {
        const partsData = Array.from({ length: match.partsCount }, (_, i) => ({
            matchId,
            partNumber: i + 1,
            p1Score: 0,
            p2Score: 0,
        }));

        await prisma.matchPart.createMany({
            data: partsData,
        });
    }

    // 2️⃣ Update match status
    const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: {
            status: "LIVE",
            startedAt: new Date(),
        },
    });

    console.log(`✅ Match ${matchId} started successfully`);

    return {
        success: true,
        message: "MATCH_STARTED",
        data: updatedMatch
    };
};

export const recordEvent = async ({ matchId, type, payload }) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: {
                include: {
                    user: true,
                    team: {
                        include: {
                            members: {
                                include: { user: true }
                            }
                        }
                    }
                }
            },
        },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");

    // Extract common fields + sport-specific data from payload
    const { scoringParticipantId, userId, ...sportSpecificData } = payload;

    console.log("\n========== SCORE EVENT DEBUG ==========");
    console.log("📥 Match type:", match.gameType);
    console.log("📥 Common data:", { scoringParticipantId, userId });
    console.log("📥 Sport-specific data:", sportSpecificData);

    // Find participant by either ID
    let participant;
    if (scoringParticipantId) {
        participant = match.participants.find(p => p.id === scoringParticipantId);
    } else if (userId) {
        participant = match.participants.find(p => p.userId === userId);
    }

    if (!participant) {
        console.error("❌ Participant not found!");
        throw new Error("PARTICIPANT_NOT_IN_MATCH");
    }

    // For team sports, log team context
    const isTeamSport = match.gameType === "DOUBLES"; // Will expand for cricket/football
    if (isTeamSport && participant.teamId) {
        const teamMembers = match.participants.filter(p => p.teamId === participant.teamId);
        console.log("👥 Team context:", {
            teamId: participant.teamId,
            side: participant.side,
            members: teamMembers.map(m => ({
                userId: m.userId,
                position: m.position
            }))
        });
    }

    // Log current part before scoring
    const currentPart = match.parts.find(p => !p.winnerParticipantId);
    console.log("📊 Current part before scoring:", {
        partNumber: currentPart?.partNumber,
        p1Score: currentPart?.p1Score,
        p2Score: currentPart?.p2Score
    });

    /* 1️⃣ APPLY SCORING */
    const scoringEngine = EngineFactory.getScoringEngine(match.sportCode);

    const scoringState = scoringEngine.applyEvent({
        match,
        eventType: type,
        payload: {
            participantId: participant.id,
            position: participant.position,
            side: participant.side,
            userId: participant.userId,
            teamId: participant.teamId,
        },
    });

    // Create enhanced event record with sport-specific JSON payload
    const eventPayload = {
        // Common fields for all sports
        participantId: participant.id,
        userId: participant.userId,
        teamId: participant.teamId,
        side: participant.side,
        position: participant.position,
        partNumber: scoringState.currentPart.partNumber,
        timestamp: new Date().toISOString(),

        // Sport-specific data (pass through untouched)
        ...sportSpecificData,
    };

    // Add team context for team sports
    if (isTeamSport && participant.teamId) {
        eventPayload.teamContext = {
            teamId: participant.teamId,
            side: participant.side,
            teammateIds: match.participants
                .filter(p => p.teamId === participant.teamId && p.id !== participant.id)
                .map(p => p.userId)
        };
    }

    await prisma.matchEvent.create({
        data: {
            matchId,
            type,
            payload: eventPayload
        },
    });

    // Persist scoring changes
    await scoringEngine.persist(prisma, scoringState);

    /* 2️⃣ CHECK MATCH PROGRESSION */
    const updatedMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profileImage: true
                        }
                    },
                    team: {
                        include: {
                            members: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            username: true,
                                            profileImage: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
    });

    const progressionEngine = MatchProgressionFactory.getEngine(match.sportCode);
    const progression = progressionEngine.advance(updatedMatch);

    /* 3️⃣ COMPLETE MATCH IF NEEDED */
    let matchCompleted = false;
    let winnerInfo = null;

    if (progression.matchCompleted) {
        // Get winner details before updating
        const winnerParticipant = updatedMatch.participants.find(
            p => p.id === progression.winnerParticipantId
        );

        // 🔥 OPTIMIZED: For team sports, winnerUserId is not needed
        const isTeamSport = match.gameType === "DOUBLES";

        winnerInfo = {
            participantId: progression.winnerParticipantId,
            ...(isTeamSport ? {
                teamId: winnerParticipant?.teamId,
                name: winnerParticipant?.team?.name
            } : {
                userId: winnerParticipant?.userId,
                name: winnerParticipant?.user?.name
            }),
            side: winnerParticipant?.side
        };

        // Log team win for team sports
        if (isTeamSport && winnerParticipant?.teamId) {
            const teamMembers = updatedMatch.participants.filter(p => p.teamId === winnerParticipant.teamId);
            winnerInfo.teamMembers = teamMembers.map(m => ({
                userId: m.userId,
                name: m.user?.name
            }));
        }

        // 🔥 OPTIMIZED: Update match with appropriate fields
        const updateData = {
            status: "COMPLETED",
            completedAt: new Date(),
            winnerParticipantId: progression.winnerParticipantId,
        };

        if (isTeamSport) {
            updateData.winnerTeamId = winnerParticipant?.teamId;
            updateData.winnerUserId = null; // Explicitly null for team sports
        } else {
            updateData.winnerUserId = winnerParticipant?.userId;
            updateData.winnerTeamId = null; // Explicitly null for singles
        }

        await prisma.match.update({
            where: { id: matchId },
            data: updateData,
        });

        matchCompleted = true;

        // 🆕 AGGREGATE MATCH STATS FROM ALL EVENTS
        try {
            console.log(`📊 Aggregating match stats for ${matchId} from all events`);
            await aggregateMatchStats(matchId);
            console.log(`✅ Match stats aggregated successfully`);
        } catch (statsError) {
            console.error(`❌ Failed to aggregate match stats:`, statsError);
            // Don't throw - match is still completed
        }

        // 🆕 UPDATE PLAYER STATS
        try {
            console.log(`📊 Updating player stats for match ${matchId}`);

            if (match.gameType === "SINGLES") {
                // Update winner stats
                await updatePlayerStatsAfterMatch({
                    userId: winnerParticipant?.userId,
                    sportCode: match.sportCode,
                    gameType: match.gameType,
                    result: "WIN",
                    matchId,
                    points: await calculateMatchPoints(matchId, winnerParticipant?.userId)
                });

                // Update loser stats
                const loserParticipant = updatedMatch.participants.find(
                    p => p.id !== progression.winnerParticipantId
                );
                if (loserParticipant) {
                    await updatePlayerStatsAfterMatch({
                        userId: loserParticipant.userId,
                        sportCode: match.sportCode,
                        gameType: match.gameType,
                        result: "LOSS",
                        matchId,
                        points: await calculateMatchPoints(matchId, loserParticipant.userId)
                    });
                }
            } else {
                // DOUBLES - update all team members
                const winnerTeamId = winnerParticipant?.teamId;
                const loserTeamId = updatedMatch.participants.find(
                    p => p.teamId !== winnerTeamId
                )?.teamId;

                // Update winning team members
                if (winnerTeamId) {
                    const winnerTeamMembers = await prisma.teamMember.findMany({
                        where: { teamId: winnerTeamId }
                    });

                    for (const member of winnerTeamMembers) {
                        await updatePlayerStatsAfterMatch({
                            userId: member.userId,
                            sportCode: match.sportCode,
                            gameType: match.gameType,
                            result: "WIN",
                            matchId,
                            teamId: winnerTeamId,
                            points: await calculateMatchPoints(matchId, member.userId)
                        });
                    }
                }

                // Update losing team members
                if (loserTeamId) {
                    const loserTeamMembers = await prisma.teamMember.findMany({
                        where: { teamId: loserTeamId }
                    });

                    for (const member of loserTeamMembers) {
                        await updatePlayerStatsAfterMatch({
                            userId: member.userId,
                            sportCode: match.sportCode,
                            gameType: match.gameType,
                            result: "LOSS",
                            matchId,
                            teamId: loserTeamId,
                            points: await calculateMatchPoints(matchId, member.userId)
                        });
                    }
                }
            }

            console.log(`✅ Player stats updated for match ${matchId}`);
        } catch (statsError) {
            console.error(`❌ Failed to update player stats:`, statsError);
            // Don't throw - match is still completed
        }

        // Advance winner to next match - pass null for winnerUserId in team sports
        console.log(`🔄 Attempting to advance winner to next match...`);
        try {
            const advancement = await advanceWinnerToNextMatch(
                matchId,
                progression.winnerParticipantId,
                isTeamSport ? null : winnerParticipant?.userId,  // ✅ Only pass userId for singles
                winnerParticipant?.teamId
            );
            console.log(`✅ Winner advancement result:`, advancement);
            winnerInfo.advancement = advancement;
        } catch (advanceError) {
            console.error(`❌ Failed to advance winner:`, advanceError);
        }
    }

    /* 4️⃣ GET COMPLETE MATCH STATE FOR BROADCAST */
    const matchState = await getMatchState(matchId);

    return {
        scoringState,
        matchCompleted,
        winnerInfo,
        matchState,
        progression
    };
};


export const undoLastScore = async ({ matchId, requestedByUserId }) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Get match with current state
        const match = await tx.match.findUnique({
            where: { id: matchId },
            include: {
                parts: {
                    orderBy: { partNumber: 'asc' }
                },
                participants: true,
                events: {
                    where: { type: "SCORE" },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!match) throw new Error("MATCH_NOT_FOUND");

        console.log("\n========== UNDO DEBUG ==========");
        console.log("Match status:", match.status);
        console.log("Match gameType:", match.gameType);
        console.log("All parts:", match.parts.map(p => ({
            partNumber: p.partNumber,
            p1Score: p.p1Score,
            p2Score: p.p2Score,
            winner: p.winnerParticipantId
        })));
        console.log("Participants:", match.participants.map(p => ({
            id: p.id,
            userId: p.userId,
            teamId: p.teamId,
            side: p.side,
            position: p.position
        })));

        const lastScoreEvent = match.events[0];
        if (!lastScoreEvent) throw new Error("NO_SCORE_TO_UNDO");

        console.log("Last score event:", {
            id: lastScoreEvent.id,
            payload: lastScoreEvent.payload
        });

        const { userId, side, position } = lastScoreEvent.payload;

        if (!userId) throw new Error("No userId in score event");

        // Find participant to verify
        const participant = match.participants.find(p => p.userId === userId);
        if (!participant) throw new Error("Participant not found");

        // 🔥 FIX: Determine which side to undo
        let teamSide;

        if (match.gameType === "SINGLES") {
            // For singles, use position from the event (1 or 2)
            teamSide = position;
            console.log(`🎯 Singles match: using position ${position} as side`);
        } else {
            // For doubles, use side from event or participant
            teamSide = side || participant.side;
        }

        if (teamSide !== 1 && teamSide !== 2) {
            console.error(`❌ Invalid side: ${teamSide}`, {
                gameType: match.gameType,
                position,
                side,
                participantSide: participant.side
            });
            throw new Error(`Invalid side: ${teamSide} - Could not determine which team scored`);
        }

        console.log(`🎯 Undo for user ${userId} on side ${teamSide}`);

        // Find the part that has scores for this team's side
        const sortedParts = [...match.parts].sort((a, b) => b.partNumber - a.partNumber);

        let targetPart = null;
        for (const part of sortedParts) {
            if (teamSide === 1 && part.p1Score > 0) {
                targetPart = part;
                break;
            } else if (teamSide === 2 && part.p2Score > 0) {
                targetPart = part;
                break;
            }
        }

        if (!targetPart) {
            // If no part has scores, check parts with winners
            for (const part of sortedParts) {
                // For team sports, check if winner is from this team
                if (part.winnerTeamId === participant.teamId) {
                    targetPart = part;
                    break;
                } else if (!participant.teamId && part.winnerParticipantId === participant.id) {
                    // For singles, check individual winner
                    targetPart = part;
                    break;
                }
            }
        }

        if (!targetPart) {
            console.error("❌ Could not find part with scores for side", teamSide);
            throw new Error("NO_SCORED_PART_FOUND");
        }

        console.log(`🎯 Found target part ${targetPart.partNumber}:`, {
            p1Score: targetPart.p1Score,
            p2Score: targetPart.p2Score,
            winnerParticipantId: targetPart.winnerParticipantId,
            winnerTeamId: targetPart.winnerTeamId
        });

        // Validate and undo based on team side
        if (teamSide === 1) {
            if (targetPart.p1Score <= 0) throw new Error("INVALID_UNDO");
            targetPart.p1Score--;
            console.log(`➖ Decremented p1Score to ${targetPart.p1Score}`);
        } else if (teamSide === 2) {
            if (targetPart.p2Score <= 0) throw new Error("INVALID_UNDO");
            targetPart.p2Score--;
            console.log(`➖ Decremented p2Score to ${targetPart.p2Score}`);
        }

        // Reset winner status if this part was won
        const wasPartWon = targetPart.winnerParticipantId || targetPart.winnerTeamId;
        if (wasPartWon) {
            targetPart.winnerParticipantId = null;
            targetPart.winnerUserId = null;
            targetPart.winnerTeamId = null;
            console.log(`🏆 Reset winner status on part ${targetPart.partNumber}`);
        }

        // Update the part
        await tx.matchPart.update({
            where: { id: targetPart.id },
            data: {
                p1Score: targetPart.p1Score,
                p2Score: targetPart.p2Score,
                winnerParticipantId: targetPart.winnerParticipantId,
                winnerUserId: targetPart.winnerUserId,
                winnerTeamId: targetPart.winnerTeamId
            }
        });

        // Handle match completion status
        const wasCompleted = match.status === "COMPLETED";
        if (wasCompleted) {
            const anyWinner = match.parts.some(p => p.winnerParticipantId || p.winnerTeamId);
            if (!anyWinner) {
                await tx.match.update({
                    where: { id: matchId },
                    data: {
                        status: "LIVE",
                        winnerParticipantId: null,
                        winnerUserId: null,
                        winnerTeamId: null,
                        completedAt: null
                    }
                });
                console.log(`🔄 Match ${matchId} reverted from COMPLETED to LIVE`);
            }
        }

        // Create UNDO event
        await tx.matchEvent.create({
            data: {
                matchId,
                type: "UNDO",
                payload: {
                    undoneEventId: lastScoreEvent.id,
                    partNumber: targetPart.partNumber,
                    side: teamSide,
                    userId: userId,
                    teamId: participant.teamId,
                    requestedBy: requestedByUserId,
                    matchWasCompleted: wasCompleted,
                    timestamp: new Date().toISOString()
                }
            }
        });

        return {
            success: true,
            wasCompleted,
            part: {
                number: targetPart.partNumber,
                p1Score: targetPart.p1Score,
                p2Score: targetPart.p2Score
            }
        };
    });
};

/**
 * Advance winner to next match in bracket
 */
export const advanceWinnerToNextMatch = async (matchId, winnerParticipantId, winnerUserId, winnerTeamId = null) => {
    console.log(`\n========== ADVANCE WINNER DEBUG ==========`);
    console.log(`📌 Called with: matchId=${matchId}, winnerParticipantId=${winnerParticipantId}, winnerUserId=${winnerUserId}, winnerTeamId=${winnerTeamId}`);
    console.log(`📌 Timestamp: ${new Date().toISOString()}`);

    return await prisma.$transaction(async (tx) => {
        try {
            // 1. Get the current match details
            console.log(`🔍 Fetching current match: ${matchId}`);
            const currentMatch = await tx.match.findUnique({
                where: { id: matchId },
                include: {
                    tournament: {
                        include: {
                            rules: true,
                            participants: true
                        }
                    }
                }
            });

            if (!currentMatch) {
                console.error(`❌ Match ${matchId} not found in database`);
                throw new Error(`Match ${matchId} not found`);
            }

            console.log(`✅ Current match found:`, {
                id: currentMatch.id,
                round: currentMatch.round,
                bracketPosition: currentMatch.bracketPosition,
                tournamentId: currentMatch.tournamentId,
                status: currentMatch.status,
                gameType: currentMatch.gameType
            });

            // 2. Calculate total rounds and check if this is a special case
            const totalPlayers = currentMatch.tournament.participants.length;
            const bracketSize = Math.pow(2, Math.ceil(Math.log2(totalPlayers)));
            const totalRounds = Math.ceil(Math.log2(bracketSize));

            console.log(`📊 Tournament stats:`, {
                totalPlayers,
                bracketSize,
                totalRounds,
                currentRound: currentMatch.round
            });

            // 3. SPECIAL CASE: For first round with byes
            let nextRound = currentMatch.round + 1;
            let nextMatchBracketPosition;
            let nextMatchPosition;

            if (currentMatch.round === 1 && totalPlayers < bracketSize) {
                const firstRoundMatches = Math.floor(totalPlayers / 2);
                const byeCount = bracketSize - totalPlayers;
                nextMatchBracketPosition = Math.floor(currentMatch.bracketPosition + (byeCount / 2));
                nextMatchPosition = 2;
                console.log(`🎯 Special case (tournament with byes):`, {
                    firstRoundMatches,
                    byeCount,
                    calculatedNextBracketPosition: nextMatchBracketPosition,
                    calculatedNextPosition: nextMatchPosition
                });
            } else {
                // Normal case - standard bracket math
                nextMatchBracketPosition = Math.floor(currentMatch.bracketPosition / 2);
                nextMatchPosition = (currentMatch.bracketPosition % 2) + 1;
            }

            console.log(`🧮 Final Bracket Math Calculation:`, {
                currentRound: currentMatch.round,
                currentBracketPosition: currentMatch.bracketPosition,
                nextRound,
                nextMatchBracketPosition,
                nextMatchPosition,
                isSpecialCase: currentMatch.round === 1 && totalPlayers < bracketSize
            });

            // 4. Find the next match
            console.log(`🔍 Searching for next match:`, {
                tournamentId: currentMatch.tournamentId,
                round: nextRound,
                bracketPosition: nextMatchBracketPosition
            });

            const nextMatch = await tx.match.findFirst({
                where: {
                    tournamentId: currentMatch.tournamentId,
                    round: nextRound,
                    bracketPosition: nextMatchBracketPosition
                },
                include: {
                    participants: true
                }
            });

            if (!nextMatch) {
                console.log(`🎉 Match ${matchId} was the final! Tournament complete.`);

                await declareTournamentWinner(
                    tx,
                    currentMatch.tournamentId,
                    winnerParticipantId,
                    winnerUserId,
                    winnerTeamId,
                    currentMatch.gameType
                );

                return {
                    advanced: false,
                    reason: "tournament_completed",
                    isFinal: true
                };
            }

            console.log(`✅ Next match found:`, {
                id: nextMatch.id,
                round: nextMatch.round,
                bracketPosition: nextMatch.bracketPosition,
                status: nextMatch.status,
                gameType: nextMatch.gameType,
                currentParticipantCount: nextMatch.participants.length
            });

            // 5. Add winner to next match - SCALABLE APPROACH for all sports
            const isTeamSport = nextMatch.gameType === "DOUBLES"; // Will be expanded for other team sports
            console.log(`➕ Adding winner to next match:`, {
                matchId: nextMatch.id,
                isTeamSport,
                winnerTeamId: winnerTeamId || 'N/A'
            });

            if (isTeamSport) {
                if (!winnerTeamId) throw new Error("Winner has no team for team match");

                // Get all team members
                const teamMembers = await tx.teamMember.findMany({
                    where: { teamId: winnerTeamId },
                    include: { user: true }
                });

                console.log(`👥 Team ${winnerTeamId} has ${teamMembers.length} members`);

                // 🔥 SCALABLE: Find which side is empty
                const side1Participants = await tx.matchParticipant.count({
                    where: {
                        matchId: nextMatch.id,
                        side: 1
                    }
                });

                const side2Participants = await tx.matchParticipant.count({
                    where: {
                        matchId: nextMatch.id,
                        side: 2
                    }
                });

                console.log(`📊 Current match occupancy:`, {
                    side1: side1Participants,
                    side2: side2Participants
                });

                // Determine target side and base position
                let targetSide;
                let basePosition;

                if (side1Participants === 0) {
                    targetSide = 1;
                    basePosition = 1;
                    console.log(`🎯 Placing team on side 1 (positions 1-${teamMembers.length})`);
                } else if (side2Participants === 0) {
                    // Calculate max position from side 1 to determine where side 2 starts
                    const maxPositionSide1 = await tx.matchParticipant.aggregate({
                        where: {
                            matchId: nextMatch.id,
                            side: 1
                        },
                        _max: { position: true }
                    });

                    basePosition = (maxPositionSide1._max.position || 0) + 1;
                    targetSide = 2;
                    console.log(`🎯 Placing team on side 2 (positions ${basePosition}-${basePosition + teamMembers.length - 1})`);
                } else {
                    throw new Error("No empty side available in next match");
                }

                // Check if positions are available
                for (let i = 0; i < teamMembers.length; i++) {
                    const targetPosition = basePosition + i;
                    const existingAtPosition = await tx.matchParticipant.findFirst({
                        where: {
                            matchId: nextMatch.id,
                            position: targetPosition
                        }
                    });

                    if (existingAtPosition) {
                        throw new Error(`Position ${targetPosition} already filled by different player`);
                    }
                }

                // Add all team members
                for (let i = 0; i < teamMembers.length; i++) {
                    const targetPosition = basePosition + i;

                    await tx.matchParticipant.create({
                        data: {
                            matchId: nextMatch.id,
                            userId: teamMembers[i].userId,
                            teamId: winnerTeamId,
                            side: targetSide,
                            position: targetPosition
                        }
                    });

                    console.log(`   ✅ Added ${teamMembers[i].user?.name || 'player'} at position ${targetPosition}`);
                }
            } else {
                // Singles - simple position-based placement
                console.log(`👤 Adding single player to next match at position ${nextMatchPosition}`);

                // Check if position is available
                const existingAtPosition = await tx.matchParticipant.findFirst({
                    where: {
                        matchId: nextMatch.id,
                        position: nextMatchPosition
                    }
                });

                if (existingAtPosition) {
                    if (existingAtPosition.userId === winnerUserId) {
                        console.log(`✅ Winner already in next match at correct position`);
                        return { advanced: true, message: "Winner already in next match" };
                    } else {
                        throw new Error(`Position ${nextMatchPosition} already filled by different player`);
                    }
                }

                await tx.matchParticipant.create({
                    data: {
                        matchId: nextMatch.id,
                        userId: winnerUserId,
                        position: nextMatchPosition
                    }
                });
            }

            // 6. Check if next match is ready
            const participantCount = await tx.matchParticipant.count({
                where: { matchId: nextMatch.id }
            });

            // Calculate required participants based on sport type
            let requiredParticipants;
            if (nextMatch.gameType === "DOUBLES") {
                requiredParticipants = 4; // 2 teams × 2 players
            } else if (nextMatch.gameType === "SINGLES") {
                requiredParticipants = 2; // 2 players
            } else {
                // For future team sports, calculate based on team size
                // This would need team size from tournament rules
                requiredParticipants = 22; // Example for cricket/football
            }

            console.log(`📊 Match readiness check:`, {
                participantCount,
                requiredParticipants,
                gameType: nextMatch.gameType
            });

            let statusUpdated = false;
            if (participantCount === requiredParticipants) {
                await tx.match.update({
                    where: { id: nextMatch.id },
                    data: { status: "SCHEDULED" }
                });
                statusUpdated = true;
                console.log(`✅ Match ${nextMatch.id} is now SCHEDULED with ${participantCount} participants`);
            } else {
                console.log(`⏳ Match ${nextMatch.id} needs ${requiredParticipants - participantCount} more participants`);
            }

            return {
                advanced: true,
                nextMatchId: nextMatch.id,
                nextMatchPosition: nextMatchPosition,
                participantCount,
                requiredParticipants,
                statusUpdated,
                isTeamSport
            };

        } catch (error) {
            console.error(`❌ Error in advanceWinner:`, error);
            throw error;
        }
    });
};



/**
 * Declare tournament winner when final match completes
 */
export const declareTournamentWinner = async (tx, tournamentId, winnerParticipantId, winnerUserId, winnerTeamId, gameType) => {
    console.log(`🏆 Declaring tournament winner for ${tournamentId}`);
    console.log(`📌 Winner:`, {
        participantId: winnerParticipantId,
        userId: winnerUserId,
        teamId: winnerTeamId,
        gameType
    });

    // 🔥 FIX: Find the correct TournamentParticipant based on gameType
    let tournamentParticipant;

    if (gameType === "SINGLES") {
        // For singles, find by playerId
        tournamentParticipant = await tx.tournamentParticipant.findFirst({
            where: {
                tournamentId,
                playerId: winnerUserId
            }
        });
        console.log(`🔍 Found singles participant:`, tournamentParticipant?.id);
    } else {
        // For DOUBLES/TEAMS, find by teamId - THIS IS CORRECT!
        tournamentParticipant = await tx.tournamentParticipant.findFirst({
            where: {
                tournamentId,
                teamId: winnerTeamId
            }
        });
        console.log(`🔍 Found team participant:`, tournamentParticipant?.id);
    }

    if (!tournamentParticipant) {
        console.error(`❌ Could not find TournamentParticipant for winner`);
        throw new Error("WINNER_PARTICIPANT_NOT_FOUND");
    }

    const updateData = {
        status: "COMPLETED",
        winnerParticipantId: tournamentParticipant.id,  // ✅ Use the found ID
    };

    if (gameType === "SINGLES") {
        updateData.winnerUserId = winnerUserId;
        updateData.winnerTeamId = null;
        console.log(`👤 Singles tournament winner: user ${winnerUserId}`);
    } else {
        updateData.winnerTeamId = winnerTeamId;
        updateData.winnerUserId = null;
        console.log(`👥 Doubles tournament winner: team ${winnerTeamId}`);
    }

    await tx.tournament.update({
        where: { id: tournamentId },
        data: updateData
    });

    // Update all participants as eliminated except winner
    await tx.tournamentParticipant.updateMany({
        where: {
            tournamentId,
            NOT: { id: tournamentParticipant.id }
        },
        data: { eliminated: true }
    });

    console.log(`✅ Tournament ${tournamentId} completed!`);

    // 🏆 Evaluate tournament achievements for all final match participants
    try {
        const finalMatch = await tx.match.findFirst({
            where: { tournamentId },
            orderBy: { round: 'desc' },
            include: { participants: { select: { userId: true } } }
        });

        if (finalMatch) {
            for (const participant of finalMatch.participants) {
                if (!participant.userId) continue;
                const participantResult = participant.userId === winnerUserId ? 'WIN' : 'LOSS';
                checkTournamentMatchAchievements(participant.userId, finalMatch.id, participantResult)
                    .catch(err => console.error('Tournament achievement check failed (non-fatal):', err));
            }
        }
    } catch (achErr) {
        console.error('Tournament achievement hook failed (non-fatal):', achErr);
    }
};


/**
 * Get comprehensive match state with all details for broadcasting
 */
export const getMatchState = async (matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            profileImage: true
                        }
                    },
                    team: {
                        include: {
                            members: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            username: true,
                                            profileImage: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: [
                    { side: 'asc' },
                    { position: 'asc' }
                ]
            },
            parts: {
                orderBy: { partNumber: 'asc' }
            },
            tournament: {
                select: {
                    id: true,
                    name: true,
                    sportCode: true,
                    tournamentType: true,
                    rules: true
                }
            },
            location: true,
            events: {
                orderBy: { createdAt: 'desc' },
                take: 50 // Last 50 events
            }
        }
    });

    if (!match) return null;

    // Format the response for easier consumption
    const formattedMatch = {
        ...match,
        currentPart: match.parts.find(p => !p.winnerParticipantId) || match.parts[match.parts.length - 1],
        completedParts: match.parts.filter(p => p.winnerParticipantId),
        score: {
            team1: match.parts.reduce((total, part) => ({
                points: total.points + (part.p1Score || 0),
                parts: total.parts + (part.winnerParticipantId &&
                    match.participants.find(p => p.id === part.winnerParticipantId)?.side === 1 ? 1 : 0)
            }), { points: 0, parts: 0 }),
            team2: match.parts.reduce((total, part) => ({
                points: total.points + (part.p2Score || 0),
                parts: total.parts + (part.winnerParticipantId &&
                    match.participants.find(p => p.id === part.winnerParticipantId)?.side === 2 ? 1 : 0)
            }), { points: 0, parts: 0 })
        },
        participants: match.participants.map(p => ({
            id: p.id,
            userId: p.userId,
            userName: p.user?.name,
            side: p.side,
            position: p.position,
            team: p.team ? {
                id: p.team.id,
                name: p.team.name,
                logo: p.team.logo,
                members: p.team.members.map(m => ({
                    id: m.id,
                    userId: m.userId,
                    name: m.user?.name,
                    role: m.role
                }))
            } : null
        }))
    };

    return formattedMatch;
};

/**
 * Get match summary (lighter version for lists)
 */
export const getMatchSummary = async (matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: {
            id: true,
            sportCode: true,
            gameType: true,
            status: true,
            round: true,
            partsCount: true,
            startTime: true,
            completedAt: true,
            winnerParticipantId: true,
            participants: {
                select: {
                    id: true,
                    userId: true,
                    teamId: true,
                    side: true,
                    position: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            profileImage: true
                        }
                    },
                    team: {
                        select: {
                            id: true,
                            name: true,
                            logo: true
                        }
                    }
                }
            },
            parts: {
                select: {
                    partNumber: true,
                    p1Score: true,
                    p2Score: true,
                    winnerParticipantId: true
                },
                orderBy: { partNumber: 'asc' }
            },
            tournament: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    return match;
};

// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     officialUserPhone,
//     participantIds,
//     servingParticipantId,
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!officialUserPhone) throw new Error("OFFICIAL_PHONE_REQUIRED");

//     if (gameType === "SINGLES" && participantIds.length !== 2) {
//         throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//     }

//     if (gameType === "DOUBLES" && participantIds.length !== 4) {
//         throw new Error("DOUBLES_MATCH_REQUIRES_4_PARTICIPANTS");
//     }

//     if (servingParticipantId && !participantIds.includes(servingParticipantId)) {
//         throw new Error("INVALID_SERVING_PARTICIPANT");
//     }

//     return prisma.$transaction(async (tx) => {
//         // 1️⃣ Ensure official user exists
//         let officialUser = await tx.user.findUnique({ where: { phone: officialUserPhone } });
//         if (!officialUser) {
//             officialUser = await tx.user.create({ data: { phone: officialUserPhone } });
//         }

//         // 2️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 3️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 4️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 officialUserId: officialUser.id,
//                 name,
//             },
//         });

//         // 5️⃣ Add participants with side for doubles
//         const participantsData = participantIds.map((userId, index) => ({
//             matchId: match.id,
//             userId,
//             position: index + 1,
//             side: gameType === "DOUBLES" ? (index < 2 ? 1 : 2) : null,
//         }));

//         await tx.matchParticipant.createMany({ data: participantsData });

//         // 6️⃣ Set serving participant if exists
//         if (servingParticipantId) {
//             const serving = await tx.matchParticipant.findFirst({
//                 where: {
//                     matchId: match.id,
//                     userId: servingParticipantId
//                 },
//             });
//             if (!serving) throw new Error("SERVING_PARTICIPANT_NOT_FOUND");

//             await tx.match.update({
//                 where: { id: match.id },
//                 data: { servingParticipantId: serving.id }
//             });
//         }

//         // 7️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 8️⃣ Return the complete match with all relations
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 official: {
//                     select: {
//                         id: true,
//                         name: true,
//                         phone: true,
//                         username: true
//                     }
//                 },
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 }
//             }
//         });

//         return completeMatch;
//     });
// };

// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     officialUserPhone,
//     participantIds,     // API accepts this - can be userIds or teamIds
//     servingUserId,      // Optional: userId of serving player
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!officialUserPhone) throw new Error("OFFICIAL_PHONE_REQUIRED");
//     if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");

//     // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
//     // Check if the first ID looks like a team ID (you can customize this logic)
//     const firstId = participantIds[0];
//     let isTeamBased = false;

//     if (gameType === "DOUBLES") {
//         // For doubles, check if IDs are team IDs (you can adjust this logic)
//         // Option 1: Check if ID starts with 'team_' prefix
//         // Option 2: Check if the entity exists as a team in database
//         // For now, we'll check length or prefix as example
//         isTeamBased = firstId.startsWith('team_') || firstId.length > 25; // Team IDs are usually longer

//         if (isTeamBased && participantIds.length !== 2) {
//             throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
//         }
//         if (!isTeamBased && participantIds.length !== 4) {
//             throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
//         }
//     } else if (gameType === "SINGLES") {
//         if (participantIds.length !== 2) {
//             throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//         }
//         isTeamBased = false; // Singles are always player-based
//     }

//     return prisma.$transaction(async (tx) => {
//         // 1️⃣ Ensure official user exists
//         let officialUser = await tx.user.findUnique({ where: { phone: officialUserPhone } });
//         if (!officialUser) {
//             officialUser = await tx.user.create({ data: { phone: officialUserPhone } });
//         }

//         // 2️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 3️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 4️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 officialUserId: officialUser.id,
//                 name,
//             },
//         });

//         // 5️⃣ Add participants based on detected type
//         if (gameType === "SINGLES") {
//             // Singles: Always player-based
//             for (let i = 0; i < participantIds.length; i++) {
//                 const userId = participantIds[i];
//                 const participant = await tx.matchParticipant.create({
//                     data: {
//                         matchId: match.id,
//                         userId: userId,
//                         position: i + 1,
//                         side: i + 1, // For singles, side = position
//                     }
//                 });

//                 // Set serving participant if this is the serving user
//                 if (servingUserId && userId === servingUserId) {
//                     await tx.match.update({
//                         where: { id: match.id },
//                         data: { servingParticipantId: participant.id }
//                     });
//                 }
//             }
//         } else if (gameType === "DOUBLES") {
//             if (isTeamBased) {
//                 // TEAM-BASED: participantIds are team IDs
//                 const teamAId = participantIds[0];
//                 const teamBId = participantIds[1];

//                 // Validate teams exist and have 2 members each
//                 const teamA = await tx.team.findUnique({
//                     where: { id: teamAId },
//                     include: { members: true }
//                 });
//                 if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
//                 if (teamA.members.length !== 2) {
//                     throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
//                 }

//                 const teamB = await tx.team.findUnique({
//                     where: { id: teamBId },
//                     include: { members: true }
//                 });
//                 if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
//                 if (teamB.members.length !== 2) {
//                     throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
//                 }

//                 // Add Team A members (side 1, positions 1-2)
//                 const teamAMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamAId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamAMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamAMembers[i].userId,
//                             teamId: teamAId,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     // Check if this is the serving user
//                     if (servingUserId && teamAMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members (side 2, positions 3-4)
//                 const teamBMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamBId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamBMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamBMembers[i].userId,
//                             teamId: teamBId,
//                             side: 2,
//                             position: i + 3
//                         }
//                     });

//                     // Check if this is the serving user
//                     if (servingUserId && teamBMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             } else {
//                 // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
//                 // Group first two players as Team A, last two as Team B

//                 // Create temporary team for first two players
//                 const teamA = await tx.team.create({
//                     data: {
//                         name: `Team A (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[0], role: "PLAYER" },
//                                 { userId: participantIds[1], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Create temporary team for last two players
//                 const teamB = await tx.team.create({
//                     data: {
//                         name: `Team B (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[2], role: "PLAYER" },
//                                 { userId: participantIds[3], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Add Team A members
//                 for (let i = 0; i < 2; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamA.id,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members
//                 for (let i = 2; i < 4; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamB.id,
//                             side: 2,
//                             position: i + 1 // i=2 → position 3, i=3 → position 4
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             }
//         }

//         // 6️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 7️⃣ Return the complete match with all relations
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         },
//                         team: {
//                             include: {
//                                 members: {
//                                     include: {
//                                         user: {
//                                             select: {
//                                                 id: true,
//                                                 name: true,
//                                                 username: true
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 official: {
//                     select: {
//                         id: true,
//                         name: true,
//                         phone: true,
//                         username: true
//                     }
//                 },
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 },
//                 events: {           // ✅ ADD THIS BACK!
//                     orderBy: {
//                         createdAt: 'desc'
//                     },
//                     take: 50        // Optional: limit to last 50 events
//                 }
//             }
//         });

//         return completeMatch;
//     });
// };

// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     officialUserPhone,
//     participantIds,     // API accepts this - can be userIds or teamIds
//     servingUserId,      // Optional: userId of serving player
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!officialUserPhone) throw new Error("OFFICIAL_PHONE_REQUIRED");
//     if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");

//     return prisma.$transaction(async (tx) => {
//         // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
//         let isTeamBased = false;

//         if (gameType === "DOUBLES") {
//             // Check if the first ID exists as a team in the database
//             const firstId = participantIds[0];

//             // Try to find it as a team
//             const teamCheck = await tx.team.findUnique({
//                 where: { id: firstId },
//                 select: { id: true }
//             }).catch(() => null);

//             isTeamBased = !!teamCheck;

//             console.log(`🔍 Team detection:`, {
//                 firstId,
//                 foundAsTeam: isTeamBased,
//                 participantCount: participantIds.length
//             });

//             if (isTeamBased && participantIds.length !== 2) {
//                 throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
//             }
//             if (!isTeamBased && participantIds.length !== 4) {
//                 throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
//             }
//         } else if (gameType === "SINGLES") {
//             if (participantIds.length !== 2) {
//                 throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//             }
//             isTeamBased = false; // Singles are always player-based
//         }

//         // 1️⃣ Ensure official user exists
//         let officialUser = await tx.user.findUnique({ where: { phone: officialUserPhone } });
//         if (!officialUser) {
//             officialUser = await tx.user.create({ data: { phone: officialUserPhone } });
//         }

//         // 2️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 3️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 4️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 officialUserId: officialUser.id,
//                 name,
//             },
//         });

//         // 5️⃣ Add participants based on detected type
//         if (gameType === "SINGLES") {
//             // Singles: Always player-based
//             for (let i = 0; i < participantIds.length; i++) {
//                 const userId = participantIds[i];
//                 const participant = await tx.matchParticipant.create({
//                     data: {
//                         matchId: match.id,
//                         userId: userId,
//                         position: i + 1,
//                         side: i + 1, // For singles, side = position
//                     }
//                 });

//                 // Set serving participant if this is the serving user
//                 if (servingUserId && userId === servingUserId) {
//                     await tx.match.update({
//                         where: { id: match.id },
//                         data: { servingParticipantId: participant.id }
//                     });
//                 }
//             }
//         } else if (gameType === "DOUBLES") {
//             if (isTeamBased) {
//                 // TEAM-BASED: participantIds are team IDs
//                 const teamAId = participantIds[0];
//                 const teamBId = participantIds[1];

//                 // Validate teams exist and have 2 members each
//                 const teamA = await tx.team.findUnique({
//                     where: { id: teamAId },
//                     include: { members: true }
//                 });
//                 if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
//                 if (teamA.members.length !== 2) {
//                     throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
//                 }

//                 const teamB = await tx.team.findUnique({
//                     where: { id: teamBId },
//                     include: { members: true }
//                 });
//                 if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
//                 if (teamB.members.length !== 2) {
//                     throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
//                 }

//                 // Add Team A members (side 1, positions 1-2)
//                 const teamAMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamAId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamAMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamAMembers[i].userId,
//                             teamId: teamAId,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     // Check if this is the serving user
//                     if (servingUserId && teamAMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members (side 2, positions 3-4)
//                 const teamBMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamBId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamBMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamBMembers[i].userId,
//                             teamId: teamBId,
//                             side: 2,
//                             position: i + 3
//                         }
//                     });

//                     // Check if this is the serving user
//                     if (servingUserId && teamBMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             } else {
//                 // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
//                 // Group first two players as Team A, last two as Team B

//                 // Create temporary team for first two players
//                 const teamA = await tx.team.create({
//                     data: {
//                         name: `Team A (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[0], role: "PLAYER" },
//                                 { userId: participantIds[1], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Create temporary team for last two players
//                 const teamB = await tx.team.create({
//                     data: {
//                         name: `Team B (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[2], role: "PLAYER" },
//                                 { userId: participantIds[3], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Add Team A members
//                 for (let i = 0; i < 2; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamA.id,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members
//                 for (let i = 2; i < 4; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamB.id,
//                             side: 2,
//                             position: i + 1 // i=2 → position 3, i=3 → position 4
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             }
//         }

//         // 6️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 7️⃣ Return the complete match with all relations
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         },
//                         team: {
//                             include: {
//                                 members: {
//                                     include: {
//                                         user: {
//                                             select: {
//                                                 id: true,
//                                                 name: true,
//                                                 username: true
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 official: {
//                     select: {
//                         id: true,
//                         name: true,
//                         phone: true,
//                         username: true
//                     }
//                 },
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 },
//                 events: {
//                     orderBy: {
//                         createdAt: 'desc'
//                     },
//                     take: 50
//                 }
//             }
//         });

//         return completeMatch;
//     });
// };


// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     officialUserPhone,
//     participantIds,     // API accepts this - can be userIds or teamIds
//     servingUserId,      // Optional: userId of serving player
//     personnel = [],     // 🆕 Personnel for match officials
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!officialUserPhone) throw new Error("OFFICIAL_PHONE_REQUIRED");
//     if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");

//     return prisma.$transaction(async (tx) => {
//         // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
//         let isTeamBased = false;

//         if (gameType === "DOUBLES") {
//             // Check if the first ID exists as a team in the database
//             const firstId = participantIds[0];

//             // Try to find it as a team
//             const teamCheck = await tx.team.findUnique({
//                 where: { id: firstId },
//                 select: { id: true }
//             }).catch(() => null);

//             isTeamBased = !!teamCheck;

//             console.log(`🔍 Team detection:`, {
//                 firstId,
//                 foundAsTeam: isTeamBased,
//                 participantCount: participantIds.length
//             });

//             if (isTeamBased && participantIds.length !== 2) {
//                 throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
//             }
//             if (!isTeamBased && participantIds.length !== 4) {
//                 throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
//             }
//         } else if (gameType === "SINGLES") {
//             if (participantIds.length !== 2) {
//                 throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//             }
//             isTeamBased = false; // Singles are always player-based
//         }

//         // 1️⃣ Ensure official user exists
//         let officialUser = await tx.user.findUnique({ where: { phone: officialUserPhone } });
//         if (!officialUser) {
//             officialUser = await tx.user.create({ data: { phone: officialUserPhone } });
//         }

//         // 2️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 3️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 4️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 officialUserId: officialUser.id,
//                 name,
//             },
//         });

//         // 5️⃣ Add participants based on detected type
//         if (gameType === "SINGLES") {
//             // Singles: Always player-based
//             for (let i = 0; i < participantIds.length; i++) {
//                 const userId = participantIds[i];
//                 const participant = await tx.matchParticipant.create({
//                     data: {
//                         matchId: match.id,
//                         userId: userId,
//                         position: i + 1,
//                         side: i + 1, // For singles, side = position
//                     }
//                 });

//                 // Set serving participant if this is the serving user
//                 if (servingUserId && userId === servingUserId) {
//                     await tx.match.update({
//                         where: { id: match.id },
//                         data: { servingParticipantId: participant.id }
//                     });
//                 }
//             }
//         } else if (gameType === "DOUBLES") {
//             if (isTeamBased) {
//                 // TEAM-BASED: participantIds are team IDs
//                 const teamAId = participantIds[0];
//                 const teamBId = participantIds[1];

//                 // Validate teams exist and have 2 members each
//                 const teamA = await tx.team.findUnique({
//                     where: { id: teamAId },
//                     include: { members: true }
//                 });
//                 if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
//                 if (teamA.members.length !== 2) {
//                     throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
//                 }

//                 const teamB = await tx.team.findUnique({
//                     where: { id: teamBId },
//                     include: { members: true }
//                 });
//                 if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
//                 if (teamB.members.length !== 2) {
//                     throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
//                 }

//                 // Add Team A members (side 1, positions 1-2)
//                 const teamAMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamAId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamAMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamAMembers[i].userId,
//                             teamId: teamAId,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && teamAMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members (side 2, positions 3-4)
//                 const teamBMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamBId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamBMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamBMembers[i].userId,
//                             teamId: teamBId,
//                             side: 2,
//                             position: i + 3
//                         }
//                     });

//                     if (servingUserId && teamBMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             } else {
//                 // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
//                 const teamA = await tx.team.create({
//                     data: {
//                         name: `Team A (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[0], role: "PLAYER" },
//                                 { userId: participantIds[1], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 const teamB = await tx.team.create({
//                     data: {
//                         name: `Team B (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[2], role: "PLAYER" },
//                                 { userId: participantIds[3], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Add Team A members
//                 for (let i = 0; i < 2; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamA.id,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members
//                 for (let i = 2; i < 4; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamB.id,
//                             side: 2,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             }
//         }

//         // 6️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 🆕 7️⃣ Add match personnel (officials, referees, etc.)
//         if (personnel && personnel.length) {
//             await addPersonnel({
//                 tx,
//                 entityType: "MATCH",
//                 entityId: match.id,
//                 personnel: personnel,
//                 skipValidation: true
//             });
//         }

//         // 8️⃣ Return the complete match with all relations
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         },
//                         team: {
//                             include: {
//                                 members: {
//                                     include: {
//                                         user: {
//                                             select: {
//                                                 id: true,
//                                                 name: true,
//                                                 username: true
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 official: {
//                     select: {
//                         id: true,
//                         name: true,
//                         phone: true,
//                         username: true
//                     }
//                 },
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 },
//                 events: {
//                     orderBy: {
//                         createdAt: 'desc'
//                     },
//                     take: 50
//                 },
//                 // 🆕 Include personnel
//                 personnel: {
//                     where: {
//                         entityType: "MATCH",
//                         entityId: match.id
//                     },
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 username: true,
//                                 phone: true,
//                                 profileImage: true
//                             }
//                         }
//                     },
//                     orderBy: [
//                         { isPrimary: 'desc' },
//                         { joinedAt: 'asc' }
//                     ]
//                 }
//             }
//         });

//         return completeMatch;
//     });
// };

// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     participantIds,     // API accepts this - can be userIds or teamIds
//     servingUserId,      // Optional: userId of serving player
//     personnel = [],     // 🆕 Personnel for match officials
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");

//     return prisma.$transaction(async (tx) => {
//         // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
//         let isTeamBased = false;

//         if (gameType === "DOUBLES") {
//             // Check if the first ID exists as a team in the database
//             const firstId = participantIds[0];

//             // Try to find it as a team
//             const teamCheck = await tx.team.findUnique({
//                 where: { id: firstId },
//                 select: { id: true }
//             }).catch(() => null);

//             isTeamBased = !!teamCheck;

//             console.log(`🔍 Team detection:`, {
//                 firstId,
//                 foundAsTeam: isTeamBased,
//                 participantCount: participantIds.length
//             });

//             if (isTeamBased && participantIds.length !== 2) {
//                 throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
//             }
//             if (!isTeamBased && participantIds.length !== 4) {
//                 throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
//             }
//         } else if (gameType === "SINGLES") {
//             if (participantIds.length !== 2) {
//                 throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//             }
//             isTeamBased = false; // Singles are always player-based
//         }

//         // 1️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 2️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 3️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 name,
//             },
//         });

//         // 4️⃣ Add participants based on detected type
//         if (gameType === "SINGLES") {
//             // Singles: Always player-based
//             for (let i = 0; i < participantIds.length; i++) {
//                 const userId = participantIds[i];
//                 const participant = await tx.matchParticipant.create({
//                     data: {
//                         matchId: match.id,
//                         userId: userId,
//                         position: i + 1,
//                         side: i + 1, // For singles, side = position
//                     }
//                 });

//                 // Set serving participant if this is the serving user
//                 if (servingUserId && userId === servingUserId) {
//                     await tx.match.update({
//                         where: { id: match.id },
//                         data: { servingParticipantId: participant.id }
//                     });
//                 }
//             }
//         } else if (gameType === "DOUBLES") {
//             if (isTeamBased) {
//                 // TEAM-BASED: participantIds are team IDs
//                 const teamAId = participantIds[0];
//                 const teamBId = participantIds[1];

//                 // Validate teams exist and have 2 members each
//                 const teamA = await tx.team.findUnique({
//                     where: { id: teamAId },
//                     include: { members: true }
//                 });
//                 if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
//                 if (teamA.members.length !== 2) {
//                     throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
//                 }

//                 const teamB = await tx.team.findUnique({
//                     where: { id: teamBId },
//                     include: { members: true }
//                 });
//                 if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
//                 if (teamB.members.length !== 2) {
//                     throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
//                 }

//                 // Add Team A members (side 1, positions 1-2)
//                 const teamAMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamAId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamAMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamAMembers[i].userId,
//                             teamId: teamAId,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && teamAMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members (side 2, positions 3-4)
//                 const teamBMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamBId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamBMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamBMembers[i].userId,
//                             teamId: teamBId,
//                             side: 2,
//                             position: i + 3
//                         }
//                     });

//                     if (servingUserId && teamBMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             } else {
//                 // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
//                 const teamA = await tx.team.create({
//                     data: {
//                         name: `Team A (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[0], role: "PLAYER" },
//                                 { userId: participantIds[1], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 const teamB = await tx.team.create({
//                     data: {
//                         name: `Team B (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[2], role: "PLAYER" },
//                                 { userId: participantIds[3], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Add Team A members
//                 for (let i = 0; i < 2; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamA.id,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members
//                 for (let i = 2; i < 4; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamB.id,
//                             side: 2,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             }
//         }

//         // 5️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 6️⃣ Add match personnel (officials, referees, etc.)
//         if (personnel && personnel.length) {
//             await addPersonnel({
//                 tx,
//                 entityType: "MATCH",
//                 entityId: match.id,
//                 personnel: personnel,
//                 skipValidation: true
//             });
//         }

//         // 7️⃣ Return the complete match with all relations
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         },
//                         team: {
//                             include: {
//                                 members: {
//                                     include: {
//                                         user: {
//                                             select: {
//                                                 id: true,
//                                                 name: true,
//                                                 username: true
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 },
//                 events: {
//                     orderBy: {
//                         createdAt: 'desc'
//                     },
//                     take: 50
//                 },
//                 // 🆕 Include personnel
//                 personnel: {
//                     where: {
//                         entityType: "MATCH",
//                         entityId: match.id
//                     },
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 username: true,
//                                 phone: true,
//                                 profileImage: true
//                             }
//                         }
//                     },
//                     orderBy: [
//                         { isPrimary: 'desc' },
//                         { joinedAt: 'asc' }
//                     ]
//                 }
//             }
//         });

//         return completeMatch;
//     });
// };


// export const createQuickMatch = async ({
//     name,
//     sportCode,
//     tournamentId,
//     locations,
//     playArea,
//     gameType,
//     partsCount,
//     startTime,
//     participantIds,     // API accepts this - can be userIds or teamIds
//     servingUserId,      // Optional: userId of serving player
//     personnel = [],     // Personnel for match officials
// }) => {
//     if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
//     if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
//     if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");

//     return prisma.$transaction(async (tx) => {
//         // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
//         let isTeamBased = false;

//         if (gameType === "DOUBLES") {
//             // Check if the first ID exists as a team in the database
//             const firstId = participantIds[0];

//             // Try to find it as a team
//             const teamCheck = await tx.team.findUnique({
//                 where: { id: firstId },
//                 select: { id: true }
//             }).catch(() => null);

//             isTeamBased = !!teamCheck;

//             console.log(`🔍 Team detection:`, {
//                 firstId,
//                 foundAsTeam: isTeamBased,
//                 participantCount: participantIds.length
//             });

//             if (isTeamBased && participantIds.length !== 2) {
//                 throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
//             }
//             if (!isTeamBased && participantIds.length !== 4) {
//                 throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
//             }
//         } else if (gameType === "SINGLES") {
//             if (participantIds.length !== 2) {
//                 throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
//             }
//             isTeamBased = false; // Singles are always player-based
//         }

//         // 1️⃣ Handle location (connectOrCreate)
//         const locationId = locations[0]?.id ?? null;
//         if (!locationId) {
//             const loc = locations[0];
//             const createdLocation = await tx.location.upsert({
//                 where: {
//                     name_address: { name: loc.name, address: loc.address },
//                 },
//                 create: {
//                     name: loc.name,
//                     address: loc.address,
//                     city: loc.city ?? null,
//                     state: loc.state ?? null,
//                     country: loc.country ?? "India",
//                     zipCode: loc.zipCode ?? null,
//                 },
//                 update: {},
//             });
//             locations[0].id = createdLocation.id;
//         }

//         // 2️⃣ Optional: Validate tournament rules
//         if (tournamentId) {
//             const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
//             if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
//             if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
//             if (!partsCount) partsCount = rules.partsPerMatch;
//         }

//         if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

//         // 3️⃣ Create the match
//         const match = await tx.match.create({
//             data: {
//                 tournamentId: tournamentId ?? null,
//                 sportCode,
//                 locationId: locations[0].id,
//                 playArea,
//                 gameType,
//                 partsCount,
//                 startTime,
//                 status: startTime ? "SCHEDULED" : "LIVE",
//                 name,
//             },
//         });

//         // 4️⃣ Add participants based on detected type
//         if (gameType === "SINGLES") {
//             // Singles: Always player-based
//             for (let i = 0; i < participantIds.length; i++) {
//                 const userId = participantIds[i];
//                 const participant = await tx.matchParticipant.create({
//                     data: {
//                         matchId: match.id,
//                         userId: userId,
//                         position: i + 1,
//                         side: i + 1, // For singles, side = position
//                     }
//                 });

//                 // Set serving participant if this is the serving user
//                 if (servingUserId && userId === servingUserId) {
//                     await tx.match.update({
//                         where: { id: match.id },
//                         data: { servingParticipantId: participant.id }
//                     });
//                 }
//             }
//         } else if (gameType === "DOUBLES") {
//             if (isTeamBased) {
//                 // TEAM-BASED: participantIds are team IDs
//                 const teamAId = participantIds[0];
//                 const teamBId = participantIds[1];

//                 // Validate teams exist and have 2 members each
//                 const teamA = await tx.team.findUnique({
//                     where: { id: teamAId },
//                     include: { members: true }
//                 });
//                 if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
//                 if (teamA.members.length !== 2) {
//                     throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
//                 }

//                 const teamB = await tx.team.findUnique({
//                     where: { id: teamBId },
//                     include: { members: true }
//                 });
//                 if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
//                 if (teamB.members.length !== 2) {
//                     throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
//                 }

//                 // Add Team A members (side 1, positions 1-2)
//                 const teamAMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamAId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamAMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamAMembers[i].userId,
//                             teamId: teamAId,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && teamAMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members (side 2, positions 3-4)
//                 const teamBMembers = await tx.teamMember.findMany({
//                     where: { teamId: teamBId },
//                     include: { user: true }
//                 });

//                 for (let i = 0; i < teamBMembers.length; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: teamBMembers[i].userId,
//                             teamId: teamBId,
//                             side: 2,
//                             position: i + 3
//                         }
//                     });

//                     if (servingUserId && teamBMembers[i].userId === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             } else {
//                 // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
//                 // Group first two players as Team A, last two as Team B

//                 // Create temporary team for first two players
//                 const teamA = await tx.team.create({
//                     data: {
//                         name: `Team A (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[0], role: "PLAYER" },
//                                 { userId: participantIds[1], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Create temporary team for last two players
//                 const teamB = await tx.team.create({
//                     data: {
//                         name: `Team B (${new Date().getTime()})`,
//                         sportCode,
//                         isTemporary: true,
//                         members: {
//                             create: [
//                                 { userId: participantIds[2], role: "PLAYER" },
//                                 { userId: participantIds[3], role: "PLAYER" }
//                             ]
//                         }
//                     }
//                 });

//                 // Add Team A members
//                 for (let i = 0; i < 2; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamA.id,
//                             side: 1,
//                             position: i + 1
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }

//                 // Add Team B members
//                 for (let i = 2; i < 4; i++) {
//                     const participant = await tx.matchParticipant.create({
//                         data: {
//                             matchId: match.id,
//                             userId: participantIds[i],
//                             teamId: teamB.id,
//                             side: 2,
//                             position: i + 1 // i=2 → position 3, i=3 → position 4
//                         }
//                     });

//                     if (servingUserId && participantIds[i] === servingUserId) {
//                         await tx.match.update({
//                             where: { id: match.id },
//                             data: { servingParticipantId: participant.id }
//                         });
//                     }
//                 }
//             }
//         }

//         // 5️⃣ Create match parts
//         await tx.matchPart.createMany({
//             data: Array.from({ length: partsCount }).map((_, i) => ({
//                 matchId: match.id,
//                 partNumber: i + 1,
//             })),
//         });

//         // 6️⃣ Add match personnel (officials, referees, etc.)
//         if (personnel && personnel.length) {
//             await addPersonnel({
//                 tx,
//                 entityType: "MATCH",
//                 entityId: match.id,
//                 personnel: personnel,
//                 skipValidation: true
//             });
//         }

//         // 7️⃣ Fetch the complete match with all relations (personnel fetched separately)
//         const completeMatch = await tx.match.findUnique({
//             where: { id: match.id },
//             include: {
//                 participants: {
//                     include: {
//                         user: {
//                             select: {
//                                 id: true,
//                                 name: true,
//                                 phone: true,
//                                 username: true,
//                                 profileImage: true
//                             }
//                         },
//                         team: {
//                             include: {
//                                 members: {
//                                     include: {
//                                         user: {
//                                             select: {
//                                                 id: true,
//                                                 name: true,
//                                                 username: true
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     },
//                     orderBy: {
//                         position: 'asc'
//                     }
//                 },
//                 location: true,
//                 parts: {
//                     orderBy: {
//                         partNumber: 'asc'
//                     }
//                 },
//                 events: {
//                     orderBy: {
//                         createdAt: 'desc'
//                     },
//                     take: 50
//                 }
//             }
//         });

//         // 8️⃣ Fetch personnel separately (since it's not a direct relation)
//         const matchPersonnel = await tx.personnel.findMany({
//             where: {
//                 entityType: "MATCH",
//                 entityId: match.id
//             },
//             include: {
//                 user: {
//                     select: {
//                         id: true,
//                         name: true,
//                         username: true,
//                         phone: true,
//                         profileImage: true
//                     }
//                 }
//             },
//             orderBy: [
//                 { isPrimary: 'desc' },
//                 { joinedAt: 'asc' }
//             ]
//         });

//         // 9️⃣ Return combined data
//         return {
//             ...completeMatch,
//             personnel: matchPersonnel
//         };
//     });
// };

export const createQuickMatch = async ({
    name,
    sportCode,
    tournamentId,
    locations,
    playArea,
    gameType,
    partsCount,
    startTime,
    participantIds,     // API accepts this - can be userIds or teamIds
    servingUserId,      // Optional: userId of serving player
    personnel = [],     // Personnel for match officials
    creatorId,          // ✅ Add creatorId (the user creating the match)
}) => {
    if (!locations?.length) throw new Error("LOCATIONS_REQUIRED");
    if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
    if (!participantIds || !Array.isArray(participantIds)) throw new Error("participantIds is required");
    if (!creatorId) throw new Error("CREATOR_ID_REQUIRED");

    return prisma.$transaction(async (tx) => {
        // 🔥 SMART DETECTION: Determine if we're dealing with teams or users
        let isTeamBased = false;

        if (gameType === "DOUBLES") {
            // Check if the first ID exists as a team in the database
            const firstId = participantIds[0];

            // Try to find it as a team
            const teamCheck = await tx.team.findUnique({
                where: { id: firstId },
                select: { id: true }
            }).catch(() => null);

            isTeamBased = !!teamCheck;

            console.log(`🔍 Team detection:`, {
                firstId,
                foundAsTeam: isTeamBased,
                participantCount: participantIds.length
            });

            if (isTeamBased && participantIds.length !== 2) {
                throw new Error("DOUBLES_MATCH_WITH_TEAMS_REQUIRES_2_TEAM_IDS");
            }
            if (!isTeamBased && participantIds.length !== 4) {
                throw new Error("DOUBLES_MATCH_WITH_PLAYERS_REQUIRES_4_PARTICIPANTS");
            }
        } else if (gameType === "SINGLES") {
            if (participantIds.length !== 2) {
                throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
            }
            isTeamBased = false; // Singles are always player-based
        }

        // 1️⃣ Handle location (connectOrCreate)
        const locationId = locations[0]?.id ?? null;
        if (!locationId) {
            const loc = locations[0];
            const createdLocation = await tx.location.upsert({
                where: {
                    name_address: { name: loc.name, address: loc.address },
                },
                create: {
                    name: loc.name,
                    address: loc.address,
                    city: loc.city ?? null,
                    state: loc.state ?? null,
                    country: loc.country ?? "India",
                    zipCode: loc.zipCode ?? null,
                },
                update: {},
            });
            locations[0].id = createdLocation.id;
        }

        // 2️⃣ Optional: Validate tournament rules
        if (tournamentId) {
            const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
            if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
            if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
            if (!partsCount) partsCount = rules.partsPerMatch;
        }

        if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

        // 3️⃣ Create the match
        const match = await tx.match.create({
            data: {
                tournamentId: tournamentId ?? null,
                sportCode,
                locationId: locations[0].id,
                playArea,
                gameType,
                partsCount,
                startTime,
                status: startTime ? "SCHEDULED" : "LIVE",
                name,
            },
        });

        // 4️⃣ Add participants based on detected type
        if (gameType === "SINGLES") {
            // Singles: Always player-based
            for (let i = 0; i < participantIds.length; i++) {
                const userId = participantIds[i];
                const participant = await tx.matchParticipant.create({
                    data: {
                        matchId: match.id,
                        userId: userId,
                        position: i + 1,
                        side: i + 1, // For singles, side = position
                    }
                });

                // Set serving participant if this is the serving user
                if (servingUserId && userId === servingUserId) {
                    await tx.match.update({
                        where: { id: match.id },
                        data: { servingParticipantId: participant.id }
                    });
                }
            }
        } else if (gameType === "DOUBLES") {
            if (isTeamBased) {
                // TEAM-BASED: participantIds are team IDs
                const teamAId = participantIds[0];
                const teamBId = participantIds[1];

                // Validate teams exist and have 2 members each
                const teamA = await tx.team.findUnique({
                    where: { id: teamAId },
                    include: { members: true }
                });
                if (!teamA) throw new Error(`Team with ID ${teamAId} not found`);
                if (teamA.members.length !== 2) {
                    throw new Error(`Team ${teamA.name} must have exactly 2 players, but has ${teamA.members.length}`);
                }

                const teamB = await tx.team.findUnique({
                    where: { id: teamBId },
                    include: { members: true }
                });
                if (!teamB) throw new Error(`Team with ID ${teamBId} not found`);
                if (teamB.members.length !== 2) {
                    throw new Error(`Team ${teamB.name} must have exactly 2 players, but has ${teamB.members.length}`);
                }

                // Add Team A members (side 1, positions 1-2)
                const teamAMembers = await tx.teamMember.findMany({
                    where: { teamId: teamAId },
                    include: { user: true }
                });

                for (let i = 0; i < teamAMembers.length; i++) {
                    const participant = await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: teamAMembers[i].userId,
                            teamId: teamAId,
                            side: 1,
                            position: i + 1
                        }
                    });

                    if (servingUserId && teamAMembers[i].userId === servingUserId) {
                        await tx.match.update({
                            where: { id: match.id },
                            data: { servingParticipantId: participant.id }
                        });
                    }
                }

                // Add Team B members (side 2, positions 3-4)
                const teamBMembers = await tx.teamMember.findMany({
                    where: { teamId: teamBId },
                    include: { user: true }
                });

                for (let i = 0; i < teamBMembers.length; i++) {
                    const participant = await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: teamBMembers[i].userId,
                            teamId: teamBId,
                            side: 2,
                            position: i + 3
                        }
                    });

                    if (servingUserId && teamBMembers[i].userId === servingUserId) {
                        await tx.match.update({
                            where: { id: match.id },
                            data: { servingParticipantId: participant.id }
                        });
                    }
                }
            } else {
                // PLAYER-BASED: participantIds are user IDs - CREATE TEMPORARY TEAMS
                // Group first two players as Team A, last two as Team B

                // Create temporary team for first two players
                const teamA = await tx.team.create({
                    data: {
                        name: `Team A (${new Date().getTime()})`,
                        sportCode,
                        isTemporary: true,
                        members: {
                            create: [
                                { userId: participantIds[0], role: "PLAYER" },
                                { userId: participantIds[1], role: "PLAYER" }
                            ]
                        }
                    }
                });

                // Create temporary team for last two players
                const teamB = await tx.team.create({
                    data: {
                        name: `Team B (${new Date().getTime()})`,
                        sportCode,
                        isTemporary: true,
                        members: {
                            create: [
                                { userId: participantIds[2], role: "PLAYER" },
                                { userId: participantIds[3], role: "PLAYER" }
                            ]
                        }
                    }
                });

                // Add Team A members
                for (let i = 0; i < 2; i++) {
                    const participant = await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: participantIds[i],
                            teamId: teamA.id,
                            side: 1,
                            position: i + 1
                        }
                    });

                    if (servingUserId && participantIds[i] === servingUserId) {
                        await tx.match.update({
                            where: { id: match.id },
                            data: { servingParticipantId: participant.id }
                        });
                    }
                }

                // Add Team B members
                for (let i = 2; i < 4; i++) {
                    const participant = await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: participantIds[i],
                            teamId: teamB.id,
                            side: 2,
                            position: i + 1 // i=2 → position 3, i=3 → position 4
                        }
                    });

                    if (servingUserId && participantIds[i] === servingUserId) {
                        await tx.match.update({
                            where: { id: match.id },
                            data: { servingParticipantId: participant.id }
                        });
                    }
                }
            }
        }

        // 5️⃣ Create match parts
        await tx.matchPart.createMany({
            data: Array.from({ length: partsCount }).map((_, i) => ({
                matchId: match.id,
                partNumber: i + 1,
            })),
        });

        // 6️⃣ Add match personnel - ALWAYS ADD CREATOR AS PRIMARY OFFICIAL
        const creatorPersonnel = [{
            userId: creatorId,
            role: "REFEREE", // or "PRIMARY_OFFICIAL"
            isPrimary: true
        }];

        // Merge creator with provided personnel, ensuring no duplicate
        const allPersonnel = [creatorPersonnel[0], ...personnel.filter(p => p.userId !== creatorId)];

        if (allPersonnel.length) {
            await addPersonnel({
                tx,
                entityType: "MATCH",
                entityId: match.id,
                personnel: allPersonnel,
                skipValidation: true
            });
        }

        // 7️⃣ Fetch the complete match with all relations (personnel fetched separately)
        const completeMatch = await tx.match.findUnique({
            where: { id: match.id },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                username: true,
                                profileImage: true
                            }
                        },
                        team: {
                            include: {
                                members: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                username: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        position: 'asc'
                    }
                },
                location: true,
                parts: {
                    orderBy: {
                        partNumber: 'asc'
                    }
                },
                events: {
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 50
                }
            }
        });

        // 8️⃣ Fetch personnel separately (since it's not a direct relation)
        const matchPersonnel = await tx.personnel.findMany({
            where: {
                entityType: "MATCH",
                entityId: match.id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        phone: true,
                        profileImage: true
                    }
                }
            },
            orderBy: [
                { isPrimary: 'desc' },
                { joinedAt: 'asc' }
            ]
        });

        // 9️⃣ Return combined data
        return {
            ...completeMatch,
            personnel: matchPersonnel
        };
    });
};

export const createBracketMatch = async (
    tx,
    {
        tournament,
        playerAId = null,
        playerBId = null,
        teamAId = null,
        teamBId = null,
        round,
        bracketPosition,
        status = "PENDING"
    }
) => {
    const isDoubles = tournament.rules.gameType === "DOUBLES";

    // Create the match
    const match = await tx.match.create({
        data: {
            tournamentId: tournament.id,
            sportCode: tournament.sportCode,
            gameType: isDoubles ? "DOUBLES" : "SINGLES",
            partsCount: tournament.rules.partsPerMatch,
            round,
            bracketPosition,
            status,
            locationId: tournament.locations[0]?.id,
        }
    });

    // If this is round 1 with actual participants, add them
    if (status === "SCHEDULED") {
        if (isDoubles) {
            // Add doubles participants for Team A
            if (teamAId) {
                const teamAMembers = await tx.teamMember.findMany({
                    where: { teamId: teamAId }
                });

                for (let i = 0; i < teamAMembers.length; i++) {
                    await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: teamAMembers[i].userId,
                            teamId: teamAId, // ✅ Store team ID
                            side: 1, // ✅ Side 1
                            position: i + 1
                        }
                    });
                }
            }

            // Add doubles participants for Team B
            if (teamBId) {
                const teamBMembers = await tx.teamMember.findMany({
                    where: { teamId: teamBId }
                });

                for (let i = 0; i < teamBMembers.length; i++) {
                    await tx.matchParticipant.create({
                        data: {
                            matchId: match.id,
                            userId: teamBMembers[i].userId,
                            teamId: teamBId, // ✅ Store team ID
                            side: 2, // ✅ Side 2
                            position: i + 3
                        }
                    });
                }
            }
        } else {
            // Add singles participants
            if (playerAId) {
                await tx.matchParticipant.create({
                    data: {
                        matchId: match.id,
                        userId: playerAId,
                        position: 1
                    }
                });
            }
            if (playerBId) {
                await tx.matchParticipant.create({
                    data: {
                        matchId: match.id,
                        userId: playerBId,
                        position: 2
                    }
                });
            }
        }
    }

    return match;
};

export const createDoublesBracketMatch = async (
    tx,
    {
        tournament,
        teamAId,
        teamBId,
        round,
    }
) => {
    console.log("tournament at createDoublesBracketMatch:", tournament);

    if (!tournament.locations || tournament.locations.length === 0) {
        throw new Error("TOURNAMENT_LOCATION_NOT_SET");
    }

    const locationId = tournament.locations[0].id; // pick first for now

    // Create the match
    const match = await tx.match.create({
        data: {
            sportCode: tournament.sportCode,
            gameType: "DOUBLES", // Explicitly set to DOUBLES
            round,
            partsCount: tournament.rules.partsPerMatch,
            status: "SCHEDULED",

            // RELATION CONNECTS
            tournament: {
                connect: { id: tournament.id },
            },
            location: {
                connect: { id: locationId },
            },
        },
    });

    // Get all team members for both teams
    const teamAMembers = await tx.teamMember.findMany({
        where: { teamId: teamAId },
        select: { userId: true }
    });

    const teamBMembers = await tx.teamMember.findMany({
        where: { teamId: teamBId },
        select: { userId: true }
    });

    // Create match participants (4 players total - 2 per team)
    // Position 1-2 for Team A, Position 3-4 for Team B
    await tx.matchParticipant.createMany({
        data: [
            // Team A players (positions 1 and 2)
            ...teamAMembers.map((member, index) => ({
                matchId: match.id,
                userId: member.userId,
                team: 1, // Team 1
                position: index + 1, // 1 or 2
            })),
            // Team B players (positions 3 and 4)
            ...teamBMembers.map((member, index) => ({
                matchId: match.id,
                userId: member.userId,
                team: 2, // Team 2
                position: index + 3, // 3 or 4
            })),
        ],
    });

    return match;
};


// Create dependencies between matches
export const createMatchDependency = async (
    tx,
    {
        futureMatchId,
        previousMatchId,
        position // 1 or 2 (which slot in future match gets filled)
    }
) => {
    return tx.matchDependency.create({
        data: {
            matchId: futureMatchId,
            dependsOnMatchId: previousMatchId,
            position
        }
    });
};


export const createMatchesBulk = async ({ tournamentId, matches }) => {
    return prisma.$transaction(async (tx) => {
        const created = [];

        for (const match of matches) {
            const m = await tx.match.create({
                data: {
                    tournamentId,
                    round: match.round,
                    matchNumber: match.matchNumber,
                },
            });

            await tx.matchParticipant.createMany({
                data: match.participantIds.map((id, idx) => ({
                    matchId: m.id,
                    participantId: id,
                    position: idx + 1,
                })),
            });

            created.push(m);
        }

        return created;
    });
};

export const listMatchesByTournament = async (tournamentId) => {
    return prisma.match.findMany({
        where: { tournamentId },
        include: {
            participants: {
                include: {
                    participant: true,
                },
            },
        },
        orderBy: [
            { round: "asc" },
            { matchNumber: "asc" },
        ],
    });
};


// export const listMatches = async ({
//     requesterId,
//     tournamentId,
//     status,
//     scope = "all",
//     page = 1,
//     limit = 10,
// }) => {
//     const now = new Date();
//     const where = {};

//     // ----------------- TOURNAMENT FILTER -----------------
//     if (tournamentId) where.tournamentId = tournamentId;

//     // ----------------- STATUS FILTER -----------------
//     if (status === "upcoming") {
//         where.startTime = { gt: now };
//     } else if (status === "ongoing") {
//         where.startTime = { lte: now };
//         where.OR = [{ endTime: null }, { endTime: { gte: now } }];
//     } else if (status === "completed") {
//         where.OR = [{ endTime: { lt: now } }, { status: "COMPLETED" }];
//     } else if (["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"].includes(status)) {
//         where.status = status;
//     }

//     // ----------------- MY MATCHES -----------------
//     if (scope === "my" && requesterId) {
//         where.OR = [
//             { participants: { some: { userId: requesterId } } },
//             { invitations: { some: { playerId: requesterId, status: "ACCEPTED" } } },
//         ];
//     }

//     // ----------------- PAGINATION -----------------
//     const skip = (page - 1) * limit;

//     const [items, total] = await Promise.all([
//         prisma.match.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { createdAt: "desc" },
//             include: {
//                 participants: { include: { user: true } },
//                 tournament: true,
//                 location: true,
//                 parts: true,
//                 invitations: true,
//             },
//         }),
//         prisma.match.count({ where }),
//     ]);

//     const formattedMatches = items.map((match) => ({
//         ...match,
//         participants: match.participants.map((p) => ({
//             id: p.id,
//             user: {
//                 id: p.user.id,
//                 name: p.user.name,
//                 username: p.user.username,
//                 phone: p.user.phone,
//             },
//             team: match.gameType === "DOUBLES" ? p.team : null,
//             position: p.position,
//         })),
//         isParticipant: requesterId
//             ? match.participants.some((p) => p.userId === requesterId)
//             : false,
//     }));

//     return {
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//         data: formattedMatches,
//     };
// };

// export const listMatches = async ({
//     requesterId,
//     tournamentId,
//     status,
//     scope = "all",
//     page = 1,
//     limit = 10,
// }) => {
//     const now = new Date();
//     const where = {};

//     // ----------------- TOURNAMENT FILTER -----------------
//     if (tournamentId) where.tournamentId = tournamentId;

//     // ----------------- STATUS FILTER -----------------
//     if (status === "upcoming") {
//         where.startTime = { gt: now };
//     } else if (status === "ongoing") {
//         where.startTime = { lte: now };
//         where.OR = [{ endTime: null }, { endTime: { gte: now } }];
//     } else if (status === "completed") {
//         where.OR = [{ endTime: { lt: now } }, { status: "COMPLETED" }];
//     } else if (["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"].includes(status)) {
//         where.status = status;
//     }

//     // ----------------- MY MATCHES -----------------
//     if (scope === "my" && requesterId) {
//         where.OR = [
//             { participants: { some: { userId: requesterId } } },
//             { invitations: { some: { playerId: requesterId, status: "ACCEPTED" } } },
//         ];
//     }

//     // ----------------- PAGINATION -----------------
//     const skip = (page - 1) * limit;

//     // First, get matches
//     const [items, total] = await Promise.all([
//         prisma.match.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { createdAt: "desc" },
//             include: {
//                 participants: { include: { user: true } },
//                 tournament: true,
//                 location: true,
//                 parts: true,
//                 invitations: true,
//             },
//         }),
//         prisma.match.count({ where }),
//     ]);

//     // Get match IDs from fetched items
//     const matchIds = items.map(m => m.id);

//     // Fetch personnel for all these matches in a single query
//     const allPersonnel = await prisma.personnel.findMany({
//         where: {
//             entityType: "MATCH",
//             entityId: { in: matchIds }
//         },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     phone: true,
//                     profileImage: true
//                 }
//             }
//         },
//         orderBy: [
//             { isPrimary: 'desc' },
//             { joinedAt: 'asc' }
//         ]
//     });

//     // Group personnel by match ID
//     const personnelByMatch = {};
//     for (const p of allPersonnel) {
//         if (!personnelByMatch[p.entityId]) {
//             personnelByMatch[p.entityId] = [];
//         }
//         personnelByMatch[p.entityId].push(p);
//     }

//     // Format matches with personnel
//     const formattedMatches = items.map((match) => {
//         const matchPersonnel = personnelByMatch[match.id] || [];

//         return {
//             ...match,
//             participants: match.participants.map((p) => ({
//                 id: p.id,
//                 user: {
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                 },
//                 team: match.gameType === "DOUBLES" ? p.team : null,
//                 position: p.position,
//             })),
//             // Add personnel in the same format as create tournament
//             personnel: matchPersonnel.map(p => ({
//                 id: p.id,
//                 entityType: p.entityType,
//                 entityId: p.entityId,
//                 userId: p.userId,
//                 role: p.role,
//                 isPrimary: p.isPrimary,
//                 joinedAt: p.joinedAt,
//                 user: {
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                     profileImage: p.user.profileImage
//                 }
//             })),
//             // Quick access to different roles
//             // officials: {
//             //     referees: matchPersonnel.filter(p => p.role === "REFEREE"),
//             //     umpires: matchPersonnel.filter(p => p.role === "UMPIRE"),
//             //     scorers: matchPersonnel.filter(p => p.role === "SCORER"),
//             //     lineJudges: matchPersonnel.filter(p => p.role === "LINE_JUDGE"),
//             //     other: matchPersonnel.filter(p => !["REFEREE", "UMPIRE", "SCORER", "LINE_JUDGE"].includes(p.role))
//             // },
//             primaryOfficial: matchPersonnel.find(p => p.isPrimary)?.user || null,
//             isParticipant: requesterId
//                 ? match.participants.some((p) => p.userId === requesterId)
//                 : false,
//         };
//     });

//     return {
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//         data: formattedMatches,
//     };
// };


// export const listMatches = async ({
//     requesterId,
//     tournamentId,
//     status,
//     scope = "all",
//     page = 1,
//     limit = 10,
// }) => {
//     const now = new Date();
//     const where = {};

//     // ----------------- TOURNAMENT FILTER -----------------
//     if (tournamentId) where.tournamentId = tournamentId;

//     // ----------------- STATUS FILTER -----------------
//     if (status === "upcoming") {
//         where.startTime = { gt: now };
//     } else if (status === "ongoing") {
//         where.startTime = { lte: now };
//         where.OR = [{ endTime: null }, { endTime: { gte: now } }];
//     } else if (status === "completed") {
//         where.OR = [{ endTime: { lt: now } }, { status: "COMPLETED" }];
//     } else if (["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"].includes(status)) {
//         where.status = status;
//     }

//     // ----------------- MY MATCHES (Enhanced - 4 categories) -----------------
//     if (scope === "my" && requesterId) {
//         // 1️⃣ Get match IDs where user is a participant
//         const participantMatchIds = await prisma.matchParticipant.findMany({
//             where: { userId: requesterId },
//             select: { matchId: true }
//         }).then(results => results.map(r => r.matchId));

//         // 2️⃣ Get match IDs where user is an official (from Personnel)
//         const officialMatchIds = await prisma.personnel.findMany({
//             where: {
//                 entityType: "MATCH",
//                 userId: requesterId
//             },
//             select: { entityId: true }
//         }).then(results => results.map(r => r.entityId));

//         // 3️⃣ Get match IDs where user has accepted invitations
//         const invitationMatchIds = await prisma.invitation.findMany({
//             where: {
//                 playerId: requesterId,
//                 status: "ACCEPTED"
//             },
//             select: { matchId: true }
//         }).then(results => results.map(r => r.matchId));

//         // Combine all IDs
//         const allRelatedMatchIds = [
//             ...new Set([
//                 ...participantMatchIds,
//                 ...officialMatchIds,
//                 ...invitationMatchIds
//             ])
//         ];

//         console.log(`🔍 User ${requesterId} is related to ${allRelatedMatchIds.length} matches:`, {
//             participant: participantMatchIds.length,
//             official: officialMatchIds.length,
//             invitation: invitationMatchIds.length
//         });

//         where.id = { in: allRelatedMatchIds };
//     }

//     // ----------------- PAGINATION -----------------
//     const skip = (page - 1) * limit;

//     // First, get matches
//     const [items, total] = await Promise.all([
//         prisma.match.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { createdAt: "desc" },
//             include: {
//                 participants: { include: { user: true } },
//                 tournament: true,
//                 location: true,
//                 parts: true,
//                 invitations: true,
//             },
//         }),
//         prisma.match.count({ where }),
//     ]);

//     // Get match IDs from fetched items
//     const matchIds = items.map(m => m.id);

//     // Fetch personnel for all these matches in a single query
//     const allPersonnel = await prisma.personnel.findMany({
//         where: {
//             entityType: "MATCH",
//             entityId: { in: matchIds }
//         },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     phone: true,
//                     profileImage: true
//                 }
//             }
//         },
//         orderBy: [
//             { isPrimary: 'desc' },
//             { joinedAt: 'asc' }
//         ]
//     });

//     // Group personnel by match ID
//     const personnelByMatch = {};
//     for (const p of allPersonnel) {
//         if (!personnelByMatch[p.entityId]) {
//             personnelByMatch[p.entityId] = [];
//         }
//         personnelByMatch[p.entityId].push(p);
//     }

//     // Format matches with personnel
//     const formattedMatches = items.map((match) => {
//         const matchPersonnel = personnelByMatch[match.id] || [];

//         // Check if user is an official in this match
//         const isOfficial = requesterId ? matchPersonnel.some(p => p.userId === requesterId) : false;
//         const isParticipant = requesterId ? match.participants.some((p) => p.userId === requesterId) : false;

//         return {
//             ...match,
//             participants: match.participants.map((p) => ({
//                 id: p.id,
//                 user: {
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                 },
//                 team: match.gameType === "DOUBLES" ? p.team : null,
//                 position: p.position,
//             })),
//             personnel: matchPersonnel.map(p => ({
//                 id: p.id,
//                 entityType: p.entityType,
//                 entityId: p.entityId,
//                 userId: p.userId,
//                 role: p.role,
//                 isPrimary: p.isPrimary,
//                 joinedAt: p.joinedAt,
//                 user: {
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                     profileImage: p.user.profileImage
//                 }
//             })),
//             primaryOfficial: matchPersonnel.find(p => p.isPrimary)?.user || null,
//             isParticipant,
//             isOfficial,
//         };
//     });

//     return {
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//         data: formattedMatches,
//     };
// };

export const listMatches = async ({
    requesterId,
    tournamentId,
    status,
    scope = "all",
    page = 1,
    limit = 10,
}) => {
    const now = new Date();
    const where = {};

    // ----------------- TOURNAMENT FILTER -----------------
    if (tournamentId) where.tournamentId = tournamentId;

    // ----------------- STATUS FILTER -----------------
    if (status === "upcoming") {
        where.startTime = { gt: now };
    } else if (status === "ongoing") {
        where.startTime = { lte: now };
        where.OR = [{ endTime: null }, { endTime: { gte: now } }];
    } else if (status === "completed") {
        where.OR = [{ endTime: { lt: now } }, { status: "COMPLETED" }];
    } else if (["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"].includes(status)) {
        where.status = status;
    }

    // ----------------- MY MATCHES (Enhanced - 4 categories) -----------------
    if (scope === "my" && requesterId) {
        // 1️⃣ Get match IDs where user is a participant
        const participantMatchIds = await prisma.matchParticipant.findMany({
            where: { userId: requesterId },
            select: { matchId: true }
        }).then(results => results.map(r => r.matchId).filter(id => id !== null)); // ✅ Filter null

        // 2️⃣ Get match IDs where user is an official (from Personnel)
        const officialMatchIds = await prisma.personnel.findMany({
            where: {
                entityType: "MATCH",
                userId: requesterId
            },
            select: { entityId: true }
        }).then(results => results.map(r => r.entityId).filter(id => id !== null)); // ✅ Filter null

        // 3️⃣ Get match IDs where user has accepted invitations
        const invitationMatchIds = await prisma.invitation.findMany({
            where: {
                playerId: requesterId,
                status: "ACCEPTED"
            },
            select: { matchId: true }
        }).then(results => results.map(r => r.matchId).filter(id => id !== null)); // ✅ Filter null

        // Combine all IDs
        const allRelatedMatchIds = [
            ...new Set([
                ...participantMatchIds,
                ...officialMatchIds,
                ...invitationMatchIds
            ])
        ];

        console.log(`🔍 User ${requesterId} is related to ${allRelatedMatchIds.length} matches:`, {
            participant: participantMatchIds.length,
            official: officialMatchIds.length,
            invitation: invitationMatchIds.length
        });

        // Only apply filter if there are related matches
        if (allRelatedMatchIds.length > 0) {
            where.id = { in: allRelatedMatchIds };
        } else {
            // If no related matches, return empty result
            return {
                meta: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0,
                },
                data: [],
            };
        }
    }

    // ----------------- OFFICIAL MATCHES (matches across tournaments where user is official) -----------------
    if (scope === "official" && requesterId) {
        // Direct match personnel IDs
        const matchPersonnelIds = await prisma.personnel.findMany({
            where: { entityType: "MATCH", userId: requesterId },
            select: { entityId: true },
        }).then(results => results.map(r => r.entityId));

        // Tournament personnel → expand to all match IDs in those tournaments
        const tournamentPersonnelIds = await prisma.personnel.findMany({
            where: { entityType: "TOURNAMENT", userId: requesterId },
            select: { entityId: true },
        }).then(results => results.map(r => r.entityId));

        let tournamentMatchIds = [];
        if (tournamentPersonnelIds.length > 0) {
            tournamentMatchIds = await prisma.match.findMany({
                where: { tournamentId: { in: tournamentPersonnelIds } },
                select: { id: true },
            }).then(results => results.map(r => r.id));
        }

        const allOfficialMatchIds = [...new Set([...matchPersonnelIds, ...tournamentMatchIds])];

        console.log(`🎯 Official scope: user ${requesterId} has ${allOfficialMatchIds.length} official matches`, {
            directMatch: matchPersonnelIds.length,
            viaTournament: tournamentMatchIds.length,
        });

        if (allOfficialMatchIds.length === 0) {
            return {
                meta: { page, limit, total: 0, totalPages: 0 },
                data: [],
            };
        }
        where.id = { in: allOfficialMatchIds };
    }

    // ----------------- PAGINATION -----------------
    const skip = (page - 1) * limit;

    // First, get matches
    const [items, total] = await Promise.all([
        prisma.match.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                participants: { include: { user: true } },
                tournament: true,
                location: true,
                parts: true,
                invitations: true,
            },
        }),
        prisma.match.count({ where }),
    ]);

    // If no items, return early
    if (items.length === 0) {
        return {
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            data: [],
        };
    }

    // Get match IDs from fetched items
    const matchIds = items.map(m => m.id);

    // Fetch personnel for all these matches in a single query
    const allPersonnel = await prisma.personnel.findMany({
        where: {
            entityType: "MATCH",
            entityId: { in: matchIds }
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    profileImage: true
                }
            }
        },
        orderBy: [
            { isPrimary: 'desc' },
            { joinedAt: 'asc' }
        ]
    });

    // Group personnel by match ID
    const personnelByMatch = {};
    for (const p of allPersonnel) {
        if (!personnelByMatch[p.entityId]) {
            personnelByMatch[p.entityId] = [];
        }
        personnelByMatch[p.entityId].push(p);
    }

    // Format matches with personnel
    const formattedMatches = items.map((match) => {
        const matchPersonnel = personnelByMatch[match.id] || [];

        // Check if user is an official in this match
        const isOfficial = requesterId ? matchPersonnel.some(p => p.userId === requesterId) : false;
        const isParticipant = requesterId ? match.participants.some((p) => p.userId === requesterId) : false;

        return {
            ...match,
            participants: match.participants.map((p) => ({
                id: p.id,
                user: {
                    id: p.user.id,
                    name: p.user.name,
                    username: p.user.username,
                    phone: p.user.phone,
                },
                team: match.gameType === "DOUBLES" ? p.team : null,
                position: p.position,
            })),
            personnel: matchPersonnel.map(p => ({
                id: p.id,
                entityType: p.entityType,
                entityId: p.entityId,
                userId: p.userId,
                role: p.role,
                isPrimary: p.isPrimary,
                joinedAt: p.joinedAt,
                user: {
                    id: p.user.id,
                    name: p.user.name,
                    username: p.user.username,
                    phone: p.user.phone,
                    profileImage: p.user.profileImage
                }
            })),
            primaryOfficial: matchPersonnel.find(p => p.isPrimary)?.user || null,
            isParticipant,
            isOfficial,
        };
    });

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: formattedMatches,
    };
};

export const endMatch = async (matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: {
                include: {
                    user: { select: { id: true, name: true } },
                    team: true
                }
            }
        },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");

    // Determine winner from parts (who won majority of games)
    const partsWon = {};
    for (const part of match.parts) {
        if (part.winnerParticipantId) {
            partsWon[part.winnerParticipantId] = (partsWon[part.winnerParticipantId] || 0) + 1;
        }
    }

    let winnerParticipantId = null;
    const majority = Math.ceil(match.partsCount / 2);
    for (const [participantId, wins] of Object.entries(partsWon)) {
        if (wins >= majority) {
            winnerParticipantId = participantId;
            break;
        }
    }

    // If no clear winner from parts, use score totals
    if (!winnerParticipantId) {
        const scoreTotals = {};
        for (const part of match.parts) {
            const p1Part = match.participants.find(p => p.side === 1 || p.position === 1);
            const p2Part = match.participants.find(p => p.side === 2 || p.position === 2);
            if (p1Part) scoreTotals[p1Part.id] = (scoreTotals[p1Part.id] || 0) + part.p1Score;
            if (p2Part) scoreTotals[p2Part.id] = (scoreTotals[p2Part.id] || 0) + part.p2Score;
        }
        const sorted = Object.entries(scoreTotals).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) winnerParticipantId = sorted[0][0];
    }

    const winnerParticipant = match.participants.find(p => p.id === winnerParticipantId);
    const isTeamSport = match.gameType === "DOUBLES";

    const updateData = {
        status: "COMPLETED",
        endTime: new Date(),
        completedAt: new Date(),
    };

    if (winnerParticipantId) {
        updateData.winnerParticipantId = winnerParticipantId;
        if (isTeamSport) {
            updateData.winnerTeamId = winnerParticipant?.teamId;
            updateData.winnerUserId = null;
        } else {
            updateData.winnerUserId = winnerParticipant?.user?.id;
            updateData.winnerTeamId = null;
        }
    }

    const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: updateData,
    });

    // Aggregate match stats from all events
    try {
        console.log(`📊 Aggregating match stats for ${matchId}`);
        await aggregateMatchStats(matchId);
        console.log(`✅ Match stats aggregated`);
    } catch (statsError) {
        console.error(`❌ Failed to aggregate match stats:`, statsError);
    }

    // Update player sport profiles
    if (winnerParticipantId) {
        try {
            console.log(`📊 Updating player stats for match ${matchId}`);
            if (match.gameType === "SINGLES") {
                const loserParticipant = match.participants.find(p => p.id !== winnerParticipantId);

                await updatePlayerStatsAfterMatch({
                    userId: winnerParticipant?.user?.id,
                    sportCode: match.sportCode,
                    gameType: match.gameType,
                    result: "WIN",
                    matchId,
                    points: await calculateMatchPoints(matchId, winnerParticipant?.user?.id)
                });

                if (loserParticipant) {
                    await updatePlayerStatsAfterMatch({
                        userId: loserParticipant?.user?.id,
                        sportCode: match.sportCode,
                        gameType: match.gameType,
                        result: "LOSS",
                        matchId,
                        points: await calculateMatchPoints(matchId, loserParticipant?.user?.id)
                    });
                }
            } else {
                // DOUBLES - update all team members
                const winnerTeamId = winnerParticipant?.teamId;
                const loserTeamId = match.participants.find(p => p.id !== winnerParticipantId)?.teamId;

                if (winnerTeamId) {
                    const winners = await prisma.teamMember.findMany({ where: { teamId: winnerTeamId } });
                    for (const m of winners) {
                        await updatePlayerStatsAfterMatch({ userId: m.userId, sportCode: match.sportCode, gameType: match.gameType, result: "WIN", matchId, teamId: winnerTeamId, points: await calculateMatchPoints(matchId, m.userId) });
                    }
                }
                if (loserTeamId) {
                    const losers = await prisma.teamMember.findMany({ where: { teamId: loserTeamId } });
                    for (const m of losers) {
                        await updatePlayerStatsAfterMatch({ userId: m.userId, sportCode: match.sportCode, gameType: match.gameType, result: "LOSS", matchId, teamId: loserTeamId, points: await calculateMatchPoints(matchId, m.userId) });
                    }
                }
            }
            console.log(`✅ Player stats updated`);
        } catch (statsError) {
            console.error(`❌ Failed to update player stats:`, statsError);
        }
    }

    return updatedMatch;
};
