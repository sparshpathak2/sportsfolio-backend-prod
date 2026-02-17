import * as teamService from "./team.service.js";
import prisma from "../../lib/prisma.js"

export const createTeam = async (req, res) => {
    try {
        const { name, sportCode, logo, city } = req.body;
        const ownerUserId = req.user.id; // ✅ Always use authenticated user as owner

        const team = await teamService.createTeam({
            name,
            sportCode,
            ownerUserId,
            logo,
            city,
        });

        res.status(201).json({
            success: true,
            data: team,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

// export const listTeams = async (req, res) => {
//     try {
//         const { sportId } = req.query;

//         const teams = await teamService.listTeams({ sportId });

//         res.json({
//             success: true,
//             data: teams,
//         });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };


// export const listTeams = async (req, res) => {
//     try {
//         const { page = 1, limit = 20, query, city, sportCode, tournamentId } = req.query;

//         let cityFilter = city;

//         // If tournamentId is provided, override city with tournament city
//         if (tournamentId) {
//             const tournament = await prisma.tournament.findUnique({
//                 where: { id: tournamentId },
//                 select: { city: true },
//             });
//             if (!tournament) {
//                 return res.status(404).json({ success: false, message: "TOURNAMENT_NOT_FOUND" });
//             }
//             cityFilter = tournament.city;
//         }

//         let searchQuery = query;
//         if (!searchQuery || searchQuery.toLowerCase() === "null") {
//             searchQuery = undefined;
//         }

//         const { teams, totalCount } = await teamService.listTeams({
//             city: cityFilter,
//             query: searchQuery,
//             sportCode,
//             page: Number(page),
//             limit: Number(limit),
//         });

//         res.json({
//             success: true,
//             count: totalCount,
//             page: Number(page),
//             limit: Number(limit),
//             data: teams,
//         });
//     } catch (error) {
//         console.error("List Teams Error:", error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// export const listTeams = async (req, res) => {
//     try {
//         const { page = 1, limit = 20, query, city, sportCode, tournamentId } = req.query;

//         let cityFilter = city;

//         // If tournamentId is provided, override city with tournament city
//         if (tournamentId) {
//             const tournament = await prisma.tournament.findUnique({
//                 where: { id: tournamentId },
//                 select: { city: true },
//             });
//             if (!tournament) {
//                 return res.status(404).json({ success: false, message: "TOURNAMENT_NOT_FOUND" });
//             }
//             cityFilter = tournament.city;
//         }

//         let searchQuery = query;
//         if (!searchQuery || searchQuery.toLowerCase() === "null") {
//             searchQuery = undefined;
//         }

//         const { teams, totalCount } = await teamService.listTeams({
//             city: cityFilter,
//             query: searchQuery,
//             sportCode,
//             page: Number(page),
//             limit: Number(limit),
//         });

//         res.json({
//             success: true,
//             count: totalCount,
//             page: Number(page),
//             limit: Number(limit),
//             data: teams,
//         });
//     } catch (error) {
//         console.error("List Teams Error:", error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

export const listTeams = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            query,
            city,
            sportCode,
            tournamentId,
            scope = "all", // 👈 NEW
        } = req.query;

        let cityFilter = city;

        if (tournamentId) {
            const tournament = await prisma.tournament.findUnique({
                where: { id: tournamentId },
                select: { city: true },
            });

            if (!tournament) {
                return res
                    .status(404)
                    .json({ success: false, message: "TOURNAMENT_NOT_FOUND" });
            }

            cityFilter = tournament.city;
        }

        const searchQuery =
            query && query.toLowerCase() !== "null" ? query : undefined;

        const { teams, totalCount } = await teamService.listTeams({
            city: cityFilter,
            query: searchQuery,
            sportCode,
            page: Number(page),
            limit: Number(limit),
            scope,
            userId: req.user?.id, // 👈 needed for "my"
        });

        res.json({
            success: true,
            count: totalCount,
            page: Number(page),
            limit: Number(limit),
            data: teams,
        });
    } catch (error) {
        console.error("List Teams Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


export const getTeamById = async (req, res) => {
    try {
        const { id } = req.params;

        const team = await teamService.getTeamById(id);

        res.json({
            success: true,
            data: team,
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateTeam = async (req, res) => {
    try {
        const teamId = req.params.id;
        const userId = req.user.id;
        const { name, logo, city } = req.body;

        const team = await teamService.updateTeam({
            teamId,
            userId,
            name,
            logo,
            city,
        });

        res.status(200).json({
            success: true,
            data: team,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const deleteTeam = async (req, res) => {
    try {
        const teamId = req.params.id;
        const userId = req.user.id; // authenticated user

        const deletedTeam = await teamService.deleteTeam(teamId, userId);

        res.status(200).json({
            success: true,
            data: deletedTeam,
            message: "Team deleted successfully",
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const joinTeamController = async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;

        const member = await teamService.joinTeam({
            teamId,
            userId,
        });

        return res.status(201).json({
            success: true,
            message: "JOIN_REQUEST_SUCCESS",
            data: member,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
};


export const removeTeamMember = async (req, res) => {
    try {
        const { teamId, userId } = req.params;

        await teamService.removeTeamMember({
            teamId,
            userId,
            requestedByUserId: req.user.id, // pass authenticated user
        });

        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};


export const listTeamMembers = async (req, res) => {
    try {
        const { id } = req.params;

        const members = await teamService.listTeamMembers(id);

        res.json({
            success: true,
            data: members,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
