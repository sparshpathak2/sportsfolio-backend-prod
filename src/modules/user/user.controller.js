import * as userService from "./user.service.js";
import prisma from "../../lib/prisma.js";

export const createUser = async (req, res) => {
    try {
        const user = await userService.createUser(req.body);
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// export const listUsers = async (req, res) => {
//     try {
//         const { count, users } = await userService.listUsers();
//         res.json({ success: true, count, data: users });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

// export const listUsers = async ({ city, query, page = 1, limit = 20 } = {}) => {
//     const where = {};

//     if (city) where.city = city;

//     if (query) {
//         where.OR = [
//             { name: { contains: query, mode: "insensitive" } },
//             { username: { contains: query, mode: "insensitive" } },
//             { email: { contains: query, mode: "insensitive" } },
//         ];
//     }

//     const skip = (page - 1) * limit;

//     const [users, totalCount] = await Promise.all([
//         prisma.user.findMany({
//             where,
//             select: {
//                 id: true,
//                 name: true,
//                 username: true,
//                 email: true,
//                 city: true,
//                 profileImage: true,
//             },
//             skip,
//             take: limit,
//             orderBy: { name: "asc" },
//         }),
//         prisma.user.count({ where }),
//     ]);

//     return { users, totalCount };
// };

export const listUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, query, city, tournamentId } = req.query;

        let cityFilter = city;

        // If tournamentId is provided, override city with tournament city
        if (tournamentId) {
            const tournament = await prisma.tournament.findUnique({
                where: { id: tournamentId },
                select: { city: true },
            });
            if (!tournament) {
                return res.status(404).json({ success: false, message: "TOURNAMENT_NOT_FOUND" });
            }
            cityFilter = tournament.city;
        }

        let searchQuery = query;
        if (!searchQuery || searchQuery.toLowerCase() === "null") {
            searchQuery = undefined;
        }


        const { users, totalCount } = await userService.listUsers({
            city: cityFilter,
            // query,
            // query: query && query !== "null" ? query : undefined,
            query: searchQuery,
            page: Number(page),
            limit: Number(limit),
        });

        res.json({
            success: true,
            count: totalCount,
            page: Number(page),
            limit: Number(limit),
            data: users,
        });
    } catch (error) {
        console.error("List Users Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


export const getUserById = async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};