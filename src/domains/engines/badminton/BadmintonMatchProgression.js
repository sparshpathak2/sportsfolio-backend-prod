import { MatchProgressionEngine } from "../interfaces/MatchProgressionEngine.js";

export class BadmintonMatchProgression extends MatchProgressionEngine {
    advance(match) {
        const partsWon = {};

        match.parts.forEach(part => {
            if (part.winnerParticipantId) {
                partsWon[part.winnerParticipantId] =
                    (partsWon[part.winnerParticipantId] || 0) + 1;
            }
        });

        const majority = Math.ceil(match.partsCount / 2);

        for (const [participantId, wins] of Object.entries(partsWon)) {
            if (wins >= majority) {
                return {
                    matchCompleted: true,
                    winnerParticipantId: participantId,
                };
            }
        }

        return { matchCompleted: false };
    }
}
