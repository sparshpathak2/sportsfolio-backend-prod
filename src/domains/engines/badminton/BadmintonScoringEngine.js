import { ScoringEngine } from "../interfaces/ScoringEngine.js";

export class BadmintonScoringEngine extends ScoringEngine {
    applyEvent({ match, eventType, payload }) {
        // console.log("match at BadmintonScoringEngine:", match)
        const currentPart = match.parts.find(p => !p.winnerParticipantId);
        if (!currentPart) throw new Error("NO_ACTIVE_PART");

        const { participantId, position } = payload;

        if (position === 1) currentPart.p1Score++;
        if (position === 2) currentPart.p2Score++;

        const diff = Math.abs(currentPart.p1Score - currentPart.p2Score);
        const maxScore = Math.max(currentPart.p1Score, currentPart.p2Score);

        if (maxScore >= 21 && diff >= 2) {
            currentPart.winnerParticipantId = participantId;
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
            },
        });
    }
}

