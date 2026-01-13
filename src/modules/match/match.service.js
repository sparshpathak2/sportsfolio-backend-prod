import prisma from "../../lib/prisma.js";
import { EngineFactory, MatchProgressionFactory } from "../../domains/EngineFactory.js";

// export const startMatch = async (matchId) => {
//     const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         include: {
//             tournament: { include: { rules: true } },
//             participants: true,
//         },
//     });

//     if (!match) throw new Error("Match not found");

//     return prisma.match.update({
//         where: { id: matchId },
//         data: { status: "LIVE", startTime: new Date() },
//     });
// };

export const startMatch = async (matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            tournament: { include: { rules: true } },
            participants: true,
            parts: true,
        },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");

    if (match.status === "LIVE") {
        throw new Error("MATCH_ALREADY_LIVE");
    }

    if (match.status === "COMPLETED") {
        throw new Error("MATCH_ALREADY_COMPLETED");
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
    return prisma.match.update({
        where: { id: matchId },
        data: {
            status: "LIVE",
            startedAt: new Date(),
        },
    });
};


// export const recordEvent = async ({ matchId, type, payload }) => {
//     const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         include: {
//             parts: true,
//             participants: true, // MatchParticipant[]
//         },
//     });

//     if (!match) throw new Error("Match not found");
//     if (match.status !== "LIVE") throw new Error("Match is not live");

//     const { scoringParticipantId } = payload;
//     if (!scoringParticipantId) {
//         throw new Error("scoringParticipantId is required");
//     }

//     // 🔥 FIND POSITION
//     const participant = match.participants.find(
//         p => p.participantId === scoringParticipantId
//     );

//     if (!participant) {
//         throw new Error("Participant not part of this match");
//     }

//     const engine = EngineFactory.getScoringEngine(match.sportCode);

//     const updatedState = engine.applyEvent({
//         match,
//         eventType: type,
//         payload: {
//             participantId: scoringParticipantId,
//             position: participant.position, // ✅ derived
//         },
//     });

//     await prisma.matchEvent.create({
//         data: {
//             matchId,
//             type,
//             payload,
//         },
//     });

//     await engine.persist(prisma, updatedState);

//     return updatedState;
// };


export const recordEvent = async ({ matchId, type, payload }) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: true,
        },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");

    const { scoringParticipantId } = payload;
    if (!scoringParticipantId) {
        throw new Error("scoringParticipantId is required");
    }

    const participant = match.participants.find(
        p => p.id === scoringParticipantId
    );

    if (!participant) {
        throw new Error("PARTICIPANT_NOT_IN_MATCH");
    }

    /* 1️⃣ APPLY SCORING */
    const scoringEngine = EngineFactory.getScoringEngine(match.sportCode);

    const scoringState = scoringEngine.applyEvent({
        match,
        eventType: type,
        payload: {
            participantId: scoringParticipantId,
            position: participant.position,
        },
    });

    await prisma.matchEvent.create({
        data: { matchId, type, payload },
    });

    await scoringEngine.persist(prisma, scoringState);

    /* 2️⃣ CHECK MATCH PROGRESSION */
    const updatedMatch = await prisma.match.findUnique({
        where: { id: matchId },
        include: { parts: true },
    });

    const progressionEngine =
        MatchProgressionFactory.getEngine(match.sportCode);

    const progression = progressionEngine.advance(updatedMatch);

    /* 3️⃣ COMPLETE MATCH IF NEEDED */
    if (progression.matchCompleted) {
        await prisma.match.update({
            where: { id: matchId },
            data: {
                status: "COMPLETED",
                winnerParticipantId: progression.winnerParticipantId,
                completedAt: new Date(),
            },
        });
    }

    return {
        scoringState,
        matchCompleted: progression.matchCompleted,
    };
};

// export const undoLastScore = async ({ matchId }) => {
//     // 1️⃣ Fetch the last scoring event
//     const lastEvent = await prisma.matchEvent.findFirst({
//         where: { matchId, type: "SCORE" },
//         orderBy: { createdAt: "desc" },
//     });

//     if (!lastEvent) throw new Error("NO_SCORE_TO_UNDO");

//     // 2️⃣ Fetch the match with parts
//     const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         include: { parts: true, participants: true },
//     });

//     if (!match) throw new Error("MATCH_NOT_FOUND");

//     // 3️⃣ Identify current active part (the one that received the last score)
//     const currentPart = match.parts.find(
//         p => !p.winnerParticipantId
//     ) || match.parts[match.parts.length - 1]; // fallback last part if winner exists

//     const { participantId, position } = lastEvent.payload;

//     // 4️⃣ Reverse the score
//     if (position === 1 && currentPart.p1Score > 0) currentPart.p1Score--;
//     if (position === 2 && currentPart.p2Score > 0) currentPart.p2Score--;

//     // 5️⃣ Reset winner if it was set by this score
//     if (currentPart.winnerParticipantId === participantId) {
//         currentPart.winnerParticipantId = null;
//     }

//     // 6️⃣ Persist the updated part
//     await prisma.matchPart.update({
//         where: { id: currentPart.id },
//         data: {
//             p1Score: currentPart.p1Score,
//             p2Score: currentPart.p2Score,
//             winnerParticipantId: currentPart.winnerParticipantId,
//         },
//     });

//     // 7️⃣ Remove the last event
//     await prisma.matchEvent.delete({ where: { id: lastEvent.id } });

//     // Optional: recalc match winner if match was completed
//     if (match.status === "COMPLETED") {
//         await prisma.match.update({
//             where: { id: matchId },
//             data: { status: "LIVE", winnerParticipantId: null, completedAt: null },
//         });
//     }

//     return {
//         partId: currentPart.id,
//         p1Score: currentPart.p1Score,
//         p2Score: currentPart.p2Score,
//         winnerParticipantId: currentPart.winnerParticipantId,
//     };
// };



export const createMatch = async ({
    tournamentId,
    sportCode,
    locationId,
    playArea,
    gameType,
    partsCount,
    startTime,
    officialUserPhone,
    participantIds,           // array of User IDs
    servingParticipantId, // optional, User ID
}) => {
    if (!locationId) throw new Error("LOCATION_REQUIRED");
    if (playArea === undefined || playArea === null) throw new Error("PLAY_AREA_REQUIRED");
    if (!officialUserPhone) throw new Error("OFFICIAL_PHONE_REQUIRED");

    /* Validate game type */
    if (gameType === "SINGLES" && participantIds.length !== 2) {
        throw new Error("SINGLES_MATCH_REQUIRES_2_PARTICIPANTS");
    }

    if (gameType === "DOUBLES" && participantIds.length !== 4) {
        throw new Error("DOUBLES_MATCH_REQUIRES_4_PARTICIPANTS");
    }

    if (
        servingParticipantId &&
        !participantIds.includes(servingParticipantId)
    ) {
        throw new Error("INVALID_SERVING_PARTICIPANT");
    }

    return prisma.$transaction(async (tx) => {
        // 1️⃣ Handle official user
        let officialUser = await tx.user.findUnique({
            where: { phone: officialUserPhone },
        });
        if (!officialUser) {
            officialUser = await tx.user.create({ data: { phone: officialUserPhone } });
        }

        // 2️⃣ Optional: Tournament validation
        if (tournamentId) {
            const rules = await tx.tournamentRules.findUnique({ where: { tournamentId } });
            if (!rules) throw new Error("TOURNAMENT_RULES_NOT_FOUND");
            if (rules.gameType !== gameType) throw new Error("GAME_TYPE_MISMATCH_WITH_TOURNAMENT");
            if (!partsCount) partsCount = rules.partsPerMatch;
        }

        if (!partsCount) throw new Error("PARTS_COUNT_REQUIRED");

        // 3️⃣ Create match
        const match = await tx.match.create({
            data: {
                tournamentId: tournamentId ?? null,
                sportCode,
                locationId,
                playArea,
                gameType,
                partsCount,
                startTime,
                status: startTime ? "SCHEDULED" : "LIVE",
                officialUserId: officialUser.id,
            },
        });

        // 4️⃣ Create match participants
        const participantsData = participantIds.map((userId, index) => ({
            matchId: match.id,
            userId,
            position: index + 1,
            team: gameType === "DOUBLES" ? (index < 2 ? 1 : 2) : null,
        }));

        const createdParticipants = await tx.matchParticipant.createMany({
            data: participantsData,
        });

        // 5️⃣ Set servingParticipantId if provided
        if (servingParticipantId) {
            const serving = await tx.matchParticipant.findFirst({
                where: { matchId: match.id, userId: servingParticipantId },
            });
            if (!serving) throw new Error("SERVING_PARTICIPANT_NOT_FOUND");
            await tx.match.update({
                where: { id: match.id },
                data: { servingParticipantId: serving.id },
            });
        }

        // 6️⃣ Create match parts
        await tx.matchPart.createMany({
            data: Array.from({ length: partsCount }).map((_, index) => ({
                matchId: match.id,
                partNumber: index + 1,
            })),
        });

        return match;
    });
};


// export const createBracketMatch = async ({
//     tournament,
//     tournamentId,
//     sportCode,
//     gameType,
//     playerAId,
//     playerBId,
//     round,
// }) => {
//     console.log("tournament at createBracketMatch:", tournament)
//     return prisma.$transaction(async (tx) => {
//         const match = await tx.match.create({
//             data: {
//                 tournamentId,
//                 sportCode,
//                 gameType,
//                 round,
//                 status: "SCHEDULED", // not scheduled yet
//             },
//         });

//         await tx.matchParticipant.createMany({
//             data: [
//                 { matchId: match.id, userId: playerAId, position: 1 },
//                 { matchId: match.id, userId: playerBId, position: 2 },
//             ],
//         });

//         return match;
//     });
// };

export const createBracketMatch = async (
    tx,
    {
        tournament,
        playerAId,
        playerBId,
        round,
    }
) => {
    console.log("tournament at createBracketMatch:", tournament);

    const match = await tx.match.create({
        data: {
            tournamentId: tournament.id,
            sportCode: tournament.sportCode,
            gameType: tournament.rules.gameType,
            round,
            partsCount: tournament.rules.partsPerMatch,
            status: "SCHEDULED",

            // ✅ REQUIRED (you map values later)
            locationId: tournament.locationId,
            // officialUserId: officialUserId,
        },
    });


    await tx.matchParticipant.createMany({
        data: [
            { matchId: match.id, userId: playerAId, position: 1 },
            { matchId: match.id, userId: playerBId, position: 2 },
        ],
    });

    return match;
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


export const endMatch = async (matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { parts: true },
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");
    if (match.status !== "LIVE") throw new Error("MATCH_NOT_LIVE");

    // winner should already be set by engine
    return prisma.match.update({
        where: { id: matchId },
        data: {
            status: "COMPLETED",
            endTime: new Date(),
        },
    });
};
