import * as matchService from "./match.service.js";
import prisma from "../../lib/prisma.js";

export const startMatch = async (req, res) => {
    try {
        const { id } = req.params;

        const match = await matchService.startMatch(id);

        return res.json({
            success: true,
            message: "Match started",
            data: match,
        });
    } catch (error) {
        console.error("Start Match Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const recordMatchEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { type, payload } = req.body;

        const result = await matchService.recordEvent({
            matchId: id,
            type,
            payload,
        });

        return res.json({
            success: true,
            message: "Event recorded",
            data: result,
        });
    } catch (error) {
        console.error("Record Event Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const undoLastScore = async (req, res) => {
    try {
        const { id: matchId } = req.params;

        const result = await matchService.undoLastScore({ matchId });

        return res.json({
            success: true,
            message: "Last score undone",
            data: result,
        });
    } catch (error) {
        console.error("Undo Last Score Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};



export const getLiveMatchState = async (req, res) => {
    try {
        const { id } = req.params;

        const state = await matchService.getLiveState(id);

        return res.json({
            success: true,
            data: state,
        });
    } catch (error) {
        return res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};


export const endMatch = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await matchService.endMatch(id);

        return res.json({
            success: true,
            message: "Match completed",
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const createMatch = async (req, res) => {
    try {
        const { tournamentId } = req.params; // optional

        const {
            name,
            sportCode,
            locationId,
            playArea,
            gameType,
            partsCount,
            startTime,
            officialUserPhone,
            participantIds,            // array of User IDs
            servingParticipantId, // optional, User ID
        } = req.body;

        if (!sportCode) throw new Error("SPORT_CODE_REQUIRED");
        if (!gameType) throw new Error("GAME_TYPE_REQUIRED");
        if (!Array.isArray(participantIds) || participantIds.length === 0)
            throw new Error("PARTICIPANTS_REQUIRED");

        const match = await matchService.createMatch({
            name,
            tournamentId,
            sportCode,
            locationId,
            playArea,
            gameType,
            partsCount,
            startTime: startTime ? new Date(startTime) : null,
            officialUserPhone,
            participantIds,
            servingParticipantId,
        });

        res.status(201).json({
            success: true,
            message: "MATCH_CREATED",
            data: match,
        });
    } catch (error) {
        console.error("Create Match Error:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const createMatchesBulk = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { matches } = req.body;

        const result = await matchService.createMatchesBulk({
            tournamentId,
            matches,
        });

        res.status(201).json({
            success: true,
            message: "Matches created",
            data: result,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const listMatchesByTournament = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const matches = await matchService.listMatchesByTournament(tournamentId);

        res.json({
            success: true,
            data: matches,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// export const getMatchById = async (req, res) => {
//     const { id } = req.params;
//     const { tournamentId } = req.params;

//     const match = await prisma.match.findFirst({
//         where: {
//             id,
//             ...(tournamentId ? { tournamentId } : {})
//         },
//         include: {
//             participants: true,
//             location: true
//         }
//     });

//     if (!match) {
//         return res.status(404).json({ error: "MATCH_NOT_FOUND" });
//     }

//     res.json({
//         success: true,
//         data: match,
//     });
// };

// export const getMatchById = async (req, res) => {
//     const { id, tournamentId } = req.params;

//     const match = await prisma.match.findFirst({
//         where: {
//             id,
//             ...(tournamentId ? { tournamentId } : {}), // ✅ only applied if present
//         },
//         include: {
//             participants: {
//                 include: {
//                     user: true,
//                 },
//             },
//             location: true,
//         },
//     });

//     if (!match) {
//         return res.status(404).json({
//             success: false,
//             message: "MATCH_NOT_FOUND",
//         });
//     }

//     const formattedMatch = {
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
//     };

//     res.json({
//         success: true,
//         data: formattedMatch,
//     });
// };

export const getMatchById = async (req, res) => {
    const { id, tournamentId } = req.params;

    const match = await prisma.match.findFirst({
        where: {
            id,
            ...(tournamentId ? { tournamentId } : {}), // ✅ only applied if present
        },
        include: {
            participants: {
                include: {
                    user: true,
                },
            },
            parts: true,      // ✅ include match parts
            location: true,
        },
    });

    if (!match) {
        return res.status(404).json({
            success: false,
            message: "MATCH_NOT_FOUND",
        });
    }

    // Format participants
    const formattedParticipants = match.participants.map((p) => ({
        id: p.id,
        user: {
            id: p.user.id,
            name: p.user.name,
            username: p.user.username,
            phone: p.user.phone,
        },
        team: match.gameType === "DOUBLES" ? p.team : null,
        position: p.position,
    }));

    // Format parts
    const formattedParts = match.parts.map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        p1Score: part.p1Score,
        p2Score: part.p2Score,
        winnerParticipantId: part.winnerParticipantId,
    }));

    const formattedMatch = {
        ...match,
        participants: formattedParticipants,
        parts: formattedParts,
    };

    res.json({
        success: true,
        data: formattedMatch,
    });
};



export const listMatches = async (req, res) => {
    const { tournamentId } = req.params;

    const where = tournamentId ? { tournamentId } : {};

    const matches = await prisma.match.findMany({
        where,
        orderBy: { startTime: "desc" },
        include: {
            participants: {
                include: {
                    user: true,
                },
            },
        },
    });

    const formattedMatches = matches.map((match) => ({
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
    }));

    res.json({
        success: true,
        data: formattedMatches,
    });
};


