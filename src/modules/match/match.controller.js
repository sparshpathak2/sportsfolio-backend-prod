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

export const createQuickMatch = async (req, res) => {
    try {
        const {
            name,
            sportCode,
            tournamentId,
            locations,         // array of location objects
            playArea,
            gameType,
            partsCount,
            startTime,
            officialUserPhone,
            participantIds,    // array of User IDs
            servingParticipantId,
        } = req.body;

        if (!sportCode || !gameType) {
            return res.status(400).json({
                success: false,
                message: "sportCode and gameType are required",
            });
        }

        if (!Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "participantIds are required",
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
            participantIds,
            servingParticipantId,
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
                    team: true,
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

// export const getMatchById = async (req, res) => {
//     const { id, tournamentId } = req.params;

//     const match = await prisma.match.findFirst({
//         where: {
//             id,
//             ...(tournamentId ? { tournamentId } : {}),
//         },
//         include: {
//             participants: {
//                 include: {
//                     user: true,
//                 },
//             },
//             parts: true,
//             location: true,
//             tournament: {
//                 include: {
//                     rules: true,
//                 },
//             },
//         },
//     });

//     if (!match) {
//         return res.status(404).json({
//             success: false,
//             message: "MATCH_NOT_FOUND",
//         });
//     }

//     // For doubles matches, get team details
//     let teamMap = {};
//     if (match.gameType === "DOUBLES") {
//         // Get unique team IDs
//         const teamIds = [...new Set(match.participants
//             .filter(p => p.team !== null)
//             .map(p => p.team))];

//         // Fetch teams with members
//         const teams = await prisma.team.findMany({
//             where: {
//                 id: { in: teamIds }
//             },
//             include: {
//                 members: {
//                     include: {
//                         user: true,
//                     },
//                 },
//             },
//         });

//         // Create lookup map
//         teamMap = teams.reduce((acc, team) => {
//             acc[team.id] = {
//                 id: team.id,
//                 name: team.name,
//                 logo: team.logo,
//                 city: team.city,
//                 isTemporary: team.isTemporary,
//                 members: team.members.map(m => ({
//                     id: m.id,
//                     user: {
//                         id: m.user.id,
//                         name: m.user.name,
//                         username: m.user.username,
//                     },
//                     role: m.role,
//                 })),
//             };
//             return acc;
//         }, {});
//     }

//     // Format participants - simple and clean
//     const formattedParticipants = match.participants.map((p) => {
//         const participant = {
//             id: p.id,
//             user: {
//                 id: p.user.id,
//                 name: p.user.name,
//                 username: p.user.username,
//                 phone: p.user.phone,
//             },
//             teamNumber: p.team, // Renamed from 'team' to 'teamNumber' for clarity
//             position: p.position,
//         };

//         // Add full team object for doubles matches
//         if (match.gameType === "DOUBLES" && p.team && teamMap[p.team]) {
//             participant.team = teamMap[p.team];
//         }

//         return participant;
//     });

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
//         // Remove the old 'participants' from the spread if it causes duplication
//         // The spread (...) already includes participants, but we're overriding it
//     };

//     // If you want to avoid potential duplication, do this instead:
//     // const { participants: _, ...matchWithoutParticipants } = match;
//     // const formattedMatch = {
//     //     ...matchWithoutParticipants,
//     //     participants: formattedParticipants,
//     //     parts: formattedParts,
//     // };

//     res.json({
//         success: true,
//         data: formattedMatch,
//     });
// };



// export const listMatches = async (req, res) => {
//     const { tournamentId } = req.params;

//     const where = tournamentId ? { tournamentId } : {};

//     const matches = await prisma.match.findMany({
//         where,
//         orderBy: { startTime: "desc" },
//         include: {
//             participants: {
//                 include: {
//                     user: true,
//                 },
//             },
//         },
//     });

//     const formattedMatches = matches.map((match) => ({
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
//     }));

//     res.json({
//         success: true,
//         data: formattedMatches,
//     });
// };


// export const listMatches = async (req, res) => {
//     try {
//         const {
//             tournamentId,
//             status,
//             scope = "all",       // all | my
//             page = 1,
//             limit = 10,
//         } = req.query;

//         const matches = await matchService.listMatches({
//             requesterId: req.user?.id,
//             tournamentId,
//             status,
//             scope,
//             page: Number(page),
//             limit: Number(limit),
//         });

//         res.json({ success: true, ...matches });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
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

//     // Filter by tournament
//     if (tournamentId) where.tournamentId = tournamentId;

//     // Status filter
//     if (status === "upcoming") where.startTime = { gt: now };
//     else if (status === "ongoing") {
//         where.startTime = { lte: now };
//         where.OR = [{ endTime: null }, { endTime: { gte: now } }];
//     } else if (status === "completed") {
//         where.OR = [{ endTime: { lt: now } }, { status: "COMPLETED" }];
//     }

//     // Scope: only matches where user is involved
//     if (scope === "my" && requesterId) {
//         // 1️⃣ Direct participation (quick matches + tournament matches)
//         const directParticipant = {
//             participants: { some: { userId: requesterId } },
//         };

//         // 2️⃣ Tournament team participation
//         const teamIds = (
//             await prisma.teamMember.findMany({
//                 where: { userId: requesterId },
//                 select: { teamId: true },
//             })
//         ).map((tm) => tm.teamId);

//         const teamParticipation = teamIds.length
//             ? {
//                 participants: {
//                     some: {
//                         team: { in: teamIds }, // Note: this only works if team matches teamId
//                     },
//                 },
//             }
//             : null;

//         // 3️⃣ Invitations accepted
//         const invitations = {
//             Invitation: {
//                 some: { playerId: requesterId, status: "ACCEPTED" },
//             },
//         };

//         // Combine OR filters
//         where.OR = [directParticipant];
//         if (teamParticipation) where.OR.push(teamParticipation);
//         where.OR.push(invitations);
//     }

//     const skip = (page - 1) * limit;

//     const [matches, total] = await Promise.all([
//         prisma.match.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { startTime: "desc" },
//             include: {
//                 participants: { include: { user: true } },
//                 tournament: true,
//                 location: true,
//             },
//         }),
//         prisma.match.count({ where }),
//     ]);

//     return {
//         data: matches,
//         meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
//     };
// };


// src/modules/match/match.controller.js
// export const listMatches = async (req, res) => {
//     try {
//         const {
//             tournamentId,
//             status,        // SCHEDULED | LIVE | COMPLETED | CANCELLED
//             scope = "all", // all | my
//             page = 1,
//             limit = 10,
//         } = req.query;

//         const requesterId = req.user?.id;

//         const where = {};

//         // Filter by tournament if provided
//         if (tournamentId) {
//             where.tournamentId = tournamentId;
//         }

//         // Filter by match status
//         if (status) {
//             where.status = status;
//         }

//         // Scope: only matches relevant to current user
//         if (scope === "my" && requesterId) {
//             where.OR = [
//                 {
//                     // Participating as a player
//                     participants: { some: { userId: requesterId } },
//                 },
//                 {
//                     // Accepted invitations
//                     Invitation: { some: { playerId: requesterId, status: "ACCEPTED" } },
//                 },
//             ];
//         }

//         // Pagination
//         const skip = (Number(page) - 1) * Number(limit);
//         const take = Number(limit);

//         // Query matches
//         const matches = await prisma.match.findMany({
//             where,
//             skip,
//             take,
//             orderBy: { startTime: "desc" },
//             include: {
//                 participants: { include: { user: true } },
//                 tournament: true,
//                 location: true,
//                 parts: true,
//             },
//         });

//         // Total count for pagination
//         const total = await prisma.match.count({ where });

//         res.json({
//             success: true,
//             data: matches,
//             meta: {
//                 total,
//                 page: Number(page),
//                 limit: Number(limit),
//                 totalPages: Math.ceil(total / limit),
//             },
//         });
//     } catch (error) {
//         console.error("List Matches Error:", error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };



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
