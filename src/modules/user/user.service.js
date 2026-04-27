import prisma from "../../lib/prisma.js";
import { getBadmintonAchievements } from "../achievement/achievement.service.js";

// export const createUser = async ({ phone, email, name }) => {
//     if (!phone) throw new Error("PHONE_REQUIRED");

//     const existing = await prisma.user.findFirst({
//         where: { OR: [{ phone }, { email }] },
//     });

//     if (existing) throw new Error("USER_ALREADY_EXISTS");

//     return prisma.user.create({
//         data: { phone, email, name },
//     });
// };

export const createUser = async ({ phone, name, email }) => {
    if (!phone) throw new Error("PHONE_REQUIRED");
    if (!name) throw new Error("NAME_REQUIRED");

    // Build where clause for checking existing user
    const whereClause = [{ phone }];

    // Only add email to check if it's provided
    if (email) {
        whereClause.push({ email });
    }

    const existing = await prisma.user.findFirst({
        where: { OR: whereClause },
    });

    if (existing) {
        // More specific error message
        if (existing.phone === phone) {
            throw new Error("PHONE_ALREADY_EXISTS");
        }
        if (email && existing.email === email) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }
        throw new Error("USER_ALREADY_EXISTS");
    }

    // Create user with only provided fields
    return prisma.user.create({
        data: {
            phone,
            name,
            ...(email && { email }), // Only include email if provided
        },
    });
};

// export const listUsers = async () => {
//     // 1️⃣ fetch all users with sportProfiles
//     const users = await prisma.user.findMany({
//         include: {
//             sportProfiles: true,
//         },
//     });

//     // 2️⃣ fetch all sports and create a map
//     const sportMap = await prisma.sport.findMany().then(arr => {
//         const map = {};
//         arr.forEach(s => (map[s.code] = s));
//         return map;
//     });

//     // 3️⃣ attach sport details to each user's sportProfiles
//     const usersWithSport = users.map(user => ({
//         ...user,
//         sportProfiles: user.sportProfiles.map(sp => ({
//             ...sp,
//             sport: sportMap[sp.sportCode] || null
//         }))
//     }));

//     // 4️⃣ return users + count
//     return {
//         count: users.length,
//         users: usersWithSport
//     };
// };


/**
 * List users with optional filters and pagination
 * @param {Object} params
 * @param {string} params.city - optional city filter
 * @param {string} params.query - optional search query
 * @param {number} params.page - page number (default 1)
 * @param {number} params.limit - items per page (default 20)
 */
// export const listUsers = async ({ city, query, page = 1, limit = 20 } = {}) => {
//     const where = {};

//     if (city) where.city = city;

//     // sanitize query
//     const searchQuery = query?.trim();

//     if (searchQuery) {
//         where.OR = [
//             { name: { contains: searchQuery, mode: "insensitive" } },
//             { username: { contains: searchQuery, mode: "insensitive" } },
//             { email: { contains: searchQuery, mode: "insensitive" } },
//         ];
//     }

//     const skip = (page - 1) * limit;

//     // 1️⃣ fetch users with sportProfiles
//     const users = await prisma.user.findMany({
//         where,
//         include: { sportProfiles: true },
//         skip,
//         take: limit,
//         orderBy: { name: "asc" },
//     });

//     // 2️⃣ fetch all sports and create a map
//     const sportMap = await prisma.sport.findMany().then(arr => {
//         const map = {};
//         arr.forEach(s => (map[s.code] = s));
//         return map;
//     });

//     // 3️⃣ attach sport details to each user's sportProfiles
//     const usersWithSport = users.map(user => ({
//         ...user,
//         sportProfiles: user.sportProfiles.map(sp => ({
//             ...sp,
//             sport: sportMap[sp.sportCode] || null,
//         })),
//     }));


//     // 4️⃣ fetch total count for pagination
//     const totalCount = await prisma.user.count({ where });

//     return { users: usersWithSport, totalCount };
// };

export const listUsers = async ({ city, query, page = 1, limit = 20, includeArchived = false, requestingUserId = null } = {}) => {
    const where = {};

    if (!includeArchived) {
        where.isArchived = false;
    }

    if (city) where.city = city;

    const searchQuery = query?.trim();

    if (searchQuery) {
        where.OR = [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { username: { contains: searchQuery, mode: "insensitive" } },
            { email: { contains: searchQuery, mode: "insensitive" } },
        ];
    }

    const skip = (page - 1) * limit;

    // Fetch favorite user IDs for the requesting user
    let favoriteUserIds = new Set();
    if (requestingUserId) {
        const favorites = await prisma.favoriteUser.findMany({
            where: { userId: requestingUserId },
            select: { favoriteUserId: true },
        });
        favoriteUserIds = new Set(favorites.map((f) => f.favoriteUserId));
    }

    const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                username: true,
                profileImage: true,
                city: true,
                isArchived: true,
                sportProfiles: {
                    select: {
                        matchesPlayed: true,
                        wins: true,
                        losses: true,
                    },
                },
            },
            skip,
            take: limit,
            orderBy: { name: "asc" },
        }),
        prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map((user) => {
        const totalMatches = user.sportProfiles.reduce((sum, sp) => sum + sp.matchesPlayed, 0);
        const totalWins = user.sportProfiles.reduce((sum, sp) => sum + sp.wins, 0);
        const totalLosses = user.sportProfiles.reduce((sum, sp) => sum + sp.losses, 0);

        return {
            id: user.id,
            name: user.name,
            username: user.username,
            profileImage: user.profileImage,
            city: user.city,
            status: user.isArchived ? "ARCHIVED" : "ACTIVE",
            isFavorite: favoriteUserIds.has(user.id),
            stats: {
                totalMatches,
                totalWins,
                totalLosses,
            },
        };
    });

    return { users: formattedUsers, totalCount };
};


// export const getUserById = async (id) => {
//     // 1️⃣ Fetch user + sportProfiles + sessions + favoriteTeams/favoriteUsers
//     const user = await prisma.user.findUnique({
//         where: { id },
//         select: {
//             id: true,
//             name: true,
//             username: true,
//             phone: true,
//             city: true,

//             // sportProfiles without any invalid include
//             sportProfiles: true,

//             sessions: true,

//             favoriteTeams: {
//                 select: {
//                     team: {
//                         select: {
//                             id: true,
//                             name: true,
//                             sportCode: true, // ✅ use sportCode, NOT sport
//                             isTemporary: true,
//                             createdAt: true,
//                         },
//                     },
//                 },
//             },

//             favoriteUsers: {
//                 select: {
//                     favoriteUser: {
//                         select: {
//                             id: true,
//                             name: true,
//                             username: true,
//                             city: true,
//                         },
//                     },
//                 },
//             },
//         },
//     });

//     if (!user) throw new Error("USER_NOT_FOUND");

//     // 2️⃣ Optionally: attach full Sport info to sportProfiles
//     const sportCodes = user.sportProfiles.map((sp) => sp.sportCode);
//     const sports = await prisma.sport.findMany({
//         where: { code: { in: sportCodes } },
//     });
//     const sportMap = {};
//     sports.forEach((s) => (sportMap[s.code] = s));

//     const sportProfilesWithSport = user.sportProfiles.map((sp) => ({
//         ...sp,
//         sport: sportMap[sp.sportCode] || null,
//     }));

//     return {
//         ...user,
//         sportProfiles: sportProfilesWithSport,
//     };
// };

export const getUserById = async (id, includeArchived = false) => {
    // Build where clause with optional archive filtering
    const where = { id };
    if (!includeArchived) {
        where.isArchived = false;
    }

    // 1️⃣ Fetch user + sportProfiles + sessions + favoriteTeams/favoriteUsers
    const user = await prisma.user.findFirst({
        where,
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,
            isArchived: true,
            archivedAt: true,

            sportProfiles: true,

            // sessions: true,

            favoriteTeams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            sportCode: true,
                            isTemporary: true,
                            createdAt: true,
                        },
                    },
                },
            },

            favoriteUsers: {
                select: {
                    favoriteUser: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            city: true,
                        },
                    },
                },
            },

            wonTournaments: {
                where: { status: "COMPLETED" },
                select: {
                    id: true,
                    name: true,
                    sportCode: true,
                    tournamentType: true,
                    startDate: true,
                    endDate: true,
                },
            },

            matchParticipations: {
                where: { match: { status: "COMPLETED" } },
                select: {
                    match: {
                        select: {
                            id: true,
                            sportCode: true,
                            gameType: true,
                            status: true,
                            completedAt: true,
                            winnerUserId: true,
                            participants: {
                                select: {
                                    userId: true,
                                    side: true,
                                    position: true,
                                },
                            },
                            parts: {
                                select: { p1Score: true, p2Score: true },
                            },
                        },
                    },
                },
                orderBy: { match: { completedAt: "desc" } },
            },
        },
    });

    if (!user) throw new Error("USER_NOT_FOUND");

    // 2️⃣ Attach full Sport info to sportProfiles
    const sportCodes = user.sportProfiles.map((sp) => sp.sportCode);
    const sports = await prisma.sport.findMany({
        where: { code: { in: sportCodes } },
    });
    const sportMap = {};
    sports.forEach((s) => (sportMap[s.code] = s));

    // 3️⃣ Compute per-sport stats from match participations
    const matchesBySport = {};
    for (const mp of user.matchParticipations) {
        const m = mp.match;
        if (!matchesBySport[m.sportCode]) matchesBySport[m.sportCode] = [];
        matchesBySport[m.sportCode].push(m);
    }

    const computeStats = (matches) => {
        const matchesPlayed = matches.length;
        let wins = 0, pointsScored = 0, pointsConceded = 0;
        for (const m of matches) {
            if (m.winnerUserId === id) wins++;
            const up = m.participants.find((p) => p.userId === id);
            const side = up?.side ?? up?.position;
            for (const part of m.parts) {
                if (side === 1) {
                    pointsScored += part.p1Score;
                    pointsConceded += part.p2Score;
                } else {
                    pointsScored += part.p2Score;
                    pointsConceded += part.p1Score;
                }
            }
        }
        const losses = matchesPlayed - wins;
        return {
            matchesPlayed,
            wins,
            losses,
            winRate: matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0,
            pointsScored,
            pointsConceded,
            pointDifference: pointsScored - pointsConceded,
        };
    };

    const sportProfilesEnriched = user.sportProfiles.map((sp) => {
        const allMatches = matchesBySport[sp.sportCode] || [];
        const singles = allMatches.filter((m) => m.gameType === "SINGLES");
        const doubles = allMatches.filter((m) => m.gameType === "DOUBLES");
        return {
            ...sp,
            sport: sportMap[sp.sportCode] || null,
            stats: {
                overall: computeStats(allMatches),
                singles: computeStats(singles),
                doubles: computeStats(doubles),
            },
        };
    });

    // 4️⃣ Aggregate overall stats across all sports
    const aggregatedStats = sportProfilesEnriched.reduce(
        (acc, sp) => {
            const s = sp.stats.overall;
            acc.matchesPlayed += s.matchesPlayed;
            acc.wins += s.wins;
            acc.losses += s.losses;
            acc.pointsScored += s.pointsScored;
            acc.pointsConceded += s.pointsConceded;
            acc.pointDifference += s.pointDifference;
            return acc;
        },
        { matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 }
    );
    aggregatedStats.winRate = aggregatedStats.matchesPlayed > 0
        ? Number(((aggregatedStats.wins / aggregatedStats.matchesPlayed) * 100).toFixed(1))
        : 0;

    const { matchParticipations, wonTournaments, favoriteTeams, favoriteUsers, sessions, sportProfiles: _sp, ...userCore } = user;

    // Fetch sport-specific achievements
    const sportAchievements = {};
    const hasBadminton = sportProfilesEnriched.some((sp) => sp.sportCode === "BADMINTON");
    if (hasBadminton) {
        sportAchievements.BADMINTON = await getBadmintonAchievements(id);
    }

    return {
        profile: {
            id: userCore.id,
            name: userCore.name,
            username: userCore.username,
            phone: userCore.phone,
            city: userCore.city,
            isArchived: userCore.isArchived,
            archivedAt: userCore.archivedAt,
        },
        stats: aggregatedStats,
        achievements: {
            totalTournamentsWon: wonTournaments.length,
            tournamentsWon: wonTournaments,
        },
        sportProfiles: sportProfilesEnriched.map((sp) => ({
            sportCode: sp.sportCode,
            sport: sp.sport,
            avatarUrl: sp.avatarUrl,
            bio: sp.bio,
            stats: sp.stats,
            achievements: sportAchievements[sp.sportCode] ?? null,
        })),
        favorites: {
            teams: favoriteTeams.map((f) => f.team),
            players: favoriteUsers.map((f) => f.favoriteUser),
        },
        sessions,
    };
};


export const updateUser = async (id, data) => {
    return prisma.user.update({
        where: { id },
        data,
    });
};





// NEW: Archive user (soft delete)
export const archiveUser = async (id) => {
    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.isArchived) throw new Error("USER_ALREADY_ARCHIVED");

    return prisma.user.update({
        where: { id },
        data: {
            isArchived: true,
            archivedAt: new Date(),
        },
    });
};

// NEW: Restore archived user
export const restoreUser = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) throw new Error("USER_NOT_FOUND");
    if (!user.isArchived) throw new Error("USER_NOT_ARCHIVED");

    return prisma.user.update({
        where: { id },
        data: {
            isArchived: false,
            archivedAt: null,
        },
    });
};