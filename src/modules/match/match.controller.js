import * as matchService from "./match.service.js";
import prisma from "../../lib/prisma.js";

export const parseIfString = (input) => {
    if (!input) return null;
    if (typeof input === "string") {
        try {
            return JSON.parse(input);
        } catch (err) {
            throw new Error("INVALID_JSON_STRING");
        }
    }
    return input;
};


export const startMatch = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await matchService.startMatch(id);

        // 🔥 FIX: Return the service response directly without double-wrapping
        return res.json({
            success: result.success,
            message: result.message,
            data: result.data
        });

    } catch (error) {
        console.error("Start Match Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message
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

// export const createQuickMatch = async (req, res) => {
//     try {
//         const {
//             name,
//             sportCode,
//             tournamentId,
//             locations,         // array of location objects
//             playArea,
//             gameType,
//             partsCount,
//             startTime,
//             officialUserPhone,
//             participantIds,    // array of User IDs
//             servingParticipantId,
//         } = req.body;

//         if (!sportCode || !gameType) {
//             return res.status(400).json({
//                 success: false,
//                 message: "sportCode and gameType are required",
//             });
//         }

//         if (!Array.isArray(participantIds) || participantIds.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "participantIds are required",
//             });
//         }

//         const parsedLocations = parseIfString(locations);
//         if (!parsedLocations?.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "At least one location is required",
//             });
//         }

//         const match = await matchService.createQuickMatch({
//             name,
//             sportCode,
//             tournamentId,
//             locations: parsedLocations,
//             playArea,
//             gameType,
//             partsCount,
//             startTime: startTime ? new Date(startTime) : null,
//             officialUserPhone,
//             participantIds,
//             servingParticipantId,
//         });

//         return res.status(201).json({
//             success: true,
//             message: "MATCH_CREATED",
//             data: match,
//         });
//     } catch (error) {
//         console.error("Create Quick Match Error:", error);
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

export const createQuickMatch = async (req, res) => {
    try {
        const {
            name,
            sportCode,
            tournamentId,
            locations,
            playArea,
            gameType,
            partsCount,
            startTime,
            officialUserPhone,
            participantIds,  // ← API always uses this
            servingUserId,
        } = req.body;

        if (!sportCode || !gameType) {
            return res.status(400).json({
                success: false,
                message: "sportCode and gameType are required",
            });
        }

        const parsedLocations = parseIfString(locations);
        if (!parsedLocations?.length) {
            return res.status(400).json({
                success: false,
                message: "At least one location is required",
            });
        }

        const match = await matchService.createQuickMatch({
            name,
            sportCode,
            tournamentId,
            locations: parsedLocations,
            playArea,
            gameType,
            partsCount,
            startTime: startTime ? new Date(startTime) : null,
            officialUserPhone,
            participantIds,  // ← Pass through as-is
            servingUserId,
        });

        return res.status(201).json({
            success: true,
            message: "MATCH_CREATED",
            data: match,
        });
    } catch (error) {
        console.error("Create Quick Match Error:", error);
        return res.status(400).json({
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
//                     team: true,
//                 },
//             },
//             parts: true,      // ✅ include match parts
//             location: true,
//         },
//     });

//     if (!match) {
//         return res.status(404).json({
//             success: false,
//             message: "MATCH_NOT_FOUND",
//         });
//     }

//     // Format participants
//     const formattedParticipants = match.participants.map((p) => ({
//         id: p.id,
//         user: {
//             id: p.user.id,
//             name: p.user.name,
//             username: p.user.username,
//             phone: p.user.phone,
//         },
//         team: match.gameType === "DOUBLES" ? p.team : null,
//         position: p.position,
//     }));

//     // Format parts
//     const formattedParts = match.parts.map((part) => ({
//         id: part.id,
//         partNumber: part.partNumber,
//         p1Score: part.p1Score,
//         p2Score: part.p2Score,
//         winnerParticipantId: part.winnerParticipantId,
//     }));

//     const formattedMatch = {
//         ...match,
//         participants: formattedParticipants,
//         parts: formattedParts,
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
                    team: true,
                },
            },
            parts: true,      // ✅ include match parts
            location: true,
            events: {          // ✅ NEW: include events
                orderBy: {
                    createdAt: 'desc'  // Most recent first
                }
            },
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

    // Format events (they're already in good shape, but we can ensure consistent format)
    const formattedEvents = match.events.map((event) => ({
        id: event.id,
        type: event.type,
        payload: event.payload,
        createdAt: event.createdAt
    }));

    const formattedMatch = {
        ...match,
        participants: formattedParticipants,
        parts: formattedParts,
        events: formattedEvents,  // ✅ NEW: add events to response
    };

    res.json({
        success: true,
        data: formattedMatch,
    });
};

export const listMatches = async (req, res) => {
    try {
        const {
            tournamentId,
            status,        // upcoming | ongoing | completed | SCHEDULED | LIVE | COMPLETED | CANCELLED
            scope = "all", // all | my
            page = 1,
            limit = 10,
        } = req.query;

        const requesterId = req.user?.id;

        // Call the service function
        const matchesData = await matchService.listMatches({
            requesterId,
            tournamentId,
            status,
            scope,
            page: Number(page),
            limit: Number(limit),
        });

        res.json({
            success: true,
            ...matchesData,
        });
    } catch (error) {
        console.error("List Matches Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Something went wrong",
        });
    }
};
