
// export const recordMatchEvent = async (req, res) => {
//     const { matchId } = req.params;
//     const { eventType, payload } = req.body;

//     const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         include: {
//             tournament: true,
//             parts: true,
//         },
//     });

//     if (!match) {
//         return res.status(404).json({ message: "Match not found" });
//     }

//     const engine = EngineFactory.getScoringEngine(
//         match.tournament.sportCode
//     );

//     const state = engine.applyEvent({
//         match,
//         eventType,
//         payload,
//     });

//     await engine.persist(prisma, state);

//     return res.json({ success: true, state });
// };


import { EngineFactory } from "../../domains/EngineFactory.js";
import prisma from "../../lib/prisma.js";

export const recordMatchEvent = async (req, res) => {
    const { matchId } = req.params;
    const { eventType, payload } = req.body;

    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
        },
    });

    if (!match) {
        return res.status(404).json({ message: "Match not found" });
    }

    const engine = EngineFactory.getScoringEngine("BADMINTON");
    const validator = EngineFactory.getValidator("BADMINTON");
    const progression = EngineFactory.getProgressionEngine("BADMINTON");

    validator.validate(match, eventType, payload);

    const scoringState = engine.applyEvent({ match, eventType, payload });
    await engine.persist(prisma, scoringState);

    const progressionState = progression.advance(match);

    if (progressionState.matchCompleted) {
        await prisma.match.update({
            where: { id: matchId },
            data: {
                status: "COMPLETED",
                winnerParticipantId: progressionState.winnerParticipantId,
                endTime: new Date(),
            },
        });
    }

    return res.json({ success: true });
};
