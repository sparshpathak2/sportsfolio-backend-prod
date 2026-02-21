import { ScoringEngine } from "../interfaces/ScoringEngine.js";

export class BadmintonScoringEngine extends ScoringEngine {
    applyEvent({ match, eventType, payload }) {
        const { participantId, position, userId, teamId, side } = payload;  // ← Add side

        console.log("🎯 Scoring engine received:", {
            participantId,
            position,
            side,  // ← Log side
            userId,
            teamId
        });

        const sortedParts = [...match.parts].sort((a, b) => a.partNumber - b.partNumber);
        const currentPart = sortedParts.find(p => !p.winnerParticipantId);

        if (!currentPart) {
            throw new Error("NO_ACTIVE_PART - All parts are completed");
        }

        console.log(`🏸 Current part ${currentPart.partNumber} before:`, {
            p1Score: currentPart.p1Score,
            p2Score: currentPart.p2Score
        });

        // 🔥 FIX: Use side to determine which team's score to increment
        if (side === 1) {
            currentPart.p1Score++;
            console.log(`➕ Team 1 scored! New score: ${currentPart.p1Score}-${currentPart.p2Score}`);
        } else if (side === 2) {
            currentPart.p2Score++;
            console.log(`➕ Team 2 scored! New score: ${currentPart.p1Score}-${currentPart.p2Score}`);
        } else {
            console.error(`❌ Invalid side: ${side}`);
            throw new Error(`Invalid side: ${side}`);
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

        if (maxScore >= 3 && scoreDiff >= 2) {
            const isTeamSport = match.gameType === "DOUBLES";
            const winnerSide = p1Score > p2Score ? 1 : 2;

            // Find winner participant (any player from winning side)
            const winnerParticipant = match.participants.find(p => p.side === winnerSide);

            currentPart.winnerParticipantId = winnerParticipant?.id;

            if (isTeamSport) {
                currentPart.winnerTeamId = winnerParticipant?.teamId;
            } else {
                currentPart.winnerUserId = winnerParticipant?.userId;
            }

            console.log(`✅ Part ${currentPart.partNumber} won by ${isTeamSport ? 'team' : 'player'} on side ${winnerSide}`);
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