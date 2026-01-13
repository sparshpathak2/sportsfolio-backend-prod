import { MatchValidator } from "../interfaces/MatchValidator.js";

export class BadmintonValidator extends MatchValidator {
    validate(match, eventType, payload) {
        if (match.status !== "LIVE") {
            throw new Error("MATCH_NOT_LIVE");
        }

        const currentPart = match.parts.find(p => !p.winnerParticipantId);
        if (!currentPart) {
            throw new Error("NO_ACTIVE_PART");
        }

        if (eventType !== "POINT") {
            throw new Error("INVALID_EVENT");
        }

        if (!payload?.participantId) {
            throw new Error("PARTICIPANT_REQUIRED");
        }
    }
}
