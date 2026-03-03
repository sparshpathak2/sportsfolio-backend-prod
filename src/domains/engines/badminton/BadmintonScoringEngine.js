import { ScoringEngine } from "../interfaces/ScoringEngine.js";

export class BadmintonScoringEngine extends ScoringEngine {
    applyEvent({ match, eventType, payload }) {
        const { participantId, position, userId, teamId, side } = payload;

        console.log("🎯 BadmintonScoringEngine received:", {
            participantId,
            position,
            side,
            userId,
            teamId,
            gameType: match.gameType,
            matchId: match.id
        });

        // Get current active part
        const sortedParts = [...match.parts].sort((a, b) => a.partNumber - b.partNumber);
        const currentPart = sortedParts.find(p => !p.winnerParticipantId);

        if (!currentPart) {
            throw new Error("NO_ACTIVE_PART - All parts are completed");
        }

        console.log(`🏸 Current part ${currentPart.partNumber} before:`, {
            p1Score: currentPart.p1Score,
            p2Score: currentPart.p2Score
        });

        // 🔥 DETERMINE EFFECTIVE SIDE
        let effectiveSide = side;

        // Case 1: For singles matches, if side is null, use position
        if (match.gameType === "SINGLES") {
            if (effectiveSide === null) {
                effectiveSide = position;
                console.log(`🎯 Singles match: using position ${position} as side`);
            }
        }

        // Case 2: For doubles, side must be provided (1 or 2)
        // If it's null, try to determine from teamId
        if (match.gameType === "DOUBLES" && effectiveSide === null && teamId) {
            // Find any participant with this teamId to get their side
            const teamParticipant = match.participants.find(p => p.teamId === teamId);
            if (teamParticipant) {
                effectiveSide = teamParticipant.side;
                console.log(`🎯 Doubles match: derived side ${effectiveSide} from teamId ${teamId}`);
            }
        }

        // Validate we have a valid side (1 or 2)
        if (effectiveSide !== 1 && effectiveSide !== 2) {
            console.error(`❌ Invalid effective side: ${effectiveSide}`, {
                originalSide: side,
                position,
                gameType: match.gameType,
                teamId,
                availableSides: [...new Set(match.participants.map(p => p.side))]
            });
            throw new Error(`Invalid side: ${effectiveSide} - Could not determine which team scored`);
        }

        // Increment the correct score based on effective side
        if (effectiveSide === 1) {
            currentPart.p1Score++;
            console.log(`➕ Team 1 (side 1) scored! New score: ${currentPart.p1Score}-${currentPart.p2Score}`);
        } else if (effectiveSide === 2) {
            currentPart.p2Score++;
            console.log(`➕ Team 2 (side 2) scored! New score: ${currentPart.p1Score}-${currentPart.p2Score}`);
        }

        console.log(`🏸 Current part ${currentPart.partNumber} after:`, {
            p1Score: currentPart.p1Score,
            p2Score: currentPart.p2Score
        });

        // Check if part is won
        const p1Score = currentPart.p1Score;
        const p2Score = currentPart.p2Score;
        const scoreDiff = Math.abs(p1Score - p2Score);
        const maxScore = Math.max(p1Score, p2Score);

        // Using 3 for testing - change to 21 for production
        if (maxScore >= 21 && scoreDiff >= 2) {
            const isTeamSport = match.gameType === "DOUBLES";
            const winnerSide = p1Score > p2Score ? 1 : 2;

            // 🔥 FIX: Find winner participant based on sport type
            let winnerParticipant;

            if (isTeamSport) {
                // For doubles: find by side (which should be set)
                winnerParticipant = match.participants.find(p => p.side === winnerSide);
                console.log(`🎯 Looking for doubles winner on side ${winnerSide}:`, winnerParticipant?.id);
            } else {
                // For singles: find by position OR side
                // Try finding by side first (if set)
                winnerParticipant = match.participants.find(p => p.side === winnerSide);

                // If not found by side, try finding by position
                if (!winnerParticipant) {
                    winnerParticipant = match.participants.find(p => p.position === winnerSide);
                    console.log(`🎯 Singles match: found winner by position ${winnerSide}:`, winnerParticipant?.id);
                }

                // If still not found, try finding by userId from the scoring payload
                if (!winnerParticipant && userId) {
                    winnerParticipant = match.participants.find(p => p.userId === userId);
                    console.log(`🎯 Singles match: found winner by userId ${userId}:`, winnerParticipant?.id);
                }
            }

            if (!winnerParticipant) {
                console.error(`❌ Could not find winner participant for side/position ${winnerSide}`, {
                    participants: match.participants.map(p => ({
                        id: p.id,
                        userId: p.userId,
                        position: p.position,
                        side: p.side
                    }))
                });
                throw new Error(`WINNER_PARTICIPANT_NOT_FOUND`);
            }

            currentPart.winnerParticipantId = winnerParticipant.id;

            if (isTeamSport) {
                currentPart.winnerTeamId = winnerParticipant.teamId;
                currentPart.winnerUserId = null;
                console.log(`✅ Part ${currentPart.partNumber} won by team ${winnerParticipant.teamId} on side ${winnerSide}`);
            } else {
                currentPart.winnerUserId = winnerParticipant.userId;
                currentPart.winnerTeamId = null;
                console.log(`✅ Part ${currentPart.partNumber} won by player ${winnerParticipant.userId} on side/position ${winnerSide}`);
            }
        }

        return { currentPart };
    }

    async persist(prisma, state) {
        await prisma.matchPart.update({
            where: { id: state.currentPart.id },
            data: {
                p1Score: state.currentPart.p1Score,
                p2Score: state.currentPart.p2Score,
                winnerParticipantId: state.currentPart.winnerParticipantId,
                winnerUserId: state.currentPart.winnerUserId,
                winnerTeamId: state.currentPart.winnerTeamId
            },
        });
    }
}