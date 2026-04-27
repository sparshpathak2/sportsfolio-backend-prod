import prisma from "../../lib/prisma.js";
import { getBadmintonAchievements } from "../achievement/achievement.service.js";

// Helper to calculate stats for a specific game type
const calculateSportStats = async (userId, sportCode, gameType = null) => {
    const whereClause = {
        userId,
        match: {
            sportCode,
            status: "COMPLETED"
        }
    };

    if (gameType) {
        whereClause.match.gameType = gameType;
    }

    // Get all completed matches for this user/sport/gameType
    const matchParticipants = await prisma.matchParticipant.findMany({
        where: whereClause,
        include: {
            match: {
                include: {
                    parts: true,
                    participants: true
                }
            }
        }
    });

    const matchesPlayed = matchParticipants.length;

    // Calculate wins (where user is the winner)
    const wins = await prisma.match.count({
        where: {
            sportCode,
            status: "COMPLETED",
            ...(gameType && { gameType }),
            OR: [
                { winnerUserId: userId },
                { winnerTeam: { members: { some: { userId } } } }
            ]
        }
    });

    const losses = matchesPlayed - wins;

    // Calculate points scored/conceded
    let pointsScored = 0;
    let pointsConceded = 0;

    for (const mp of matchParticipants) {
        const match = mp.match;

        // Find which side the user was on
        const userParticipant = match.participants.find(p => p.userId === userId);
        if (userParticipant) {
            const userSide = userParticipant.side || userParticipant.position;

            // Sum up points from all parts
            for (const part of match.parts) {
                if (userSide === 1 || userSide === 1) {
                    pointsScored += part.p1Score;
                    pointsConceded += part.p2Score;
                } else {
                    pointsScored += part.p2Score;
                    pointsConceded += part.p1Score;
                }
            }
        }
    }

    return {
        matchesPlayed,
        wins,
        losses,
        winRate: matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0,
        pointsScored,
        pointsConceded,
        pointDifference: pointsScored - pointsConceded
    };
};

// Get stats for a specific sport with categories (Overall, Singles, Doubles)
const getSportStats = async (userId, sportCode) => {
    const [overall, singles, doubles] = await Promise.all([
        calculateSportStats(userId, sportCode),
        calculateSportStats(userId, sportCode, "SINGLES"),
        calculateSportStats(userId, sportCode, "DOUBLES")
    ]);

    return {
        overall,
        singles,
        doubles
    };
};

// export const getUserProfile = async (userId) => {
//     const user = await prisma.user.findUnique({
//         where: { id: userId },
//         select: {
//             id: true,
//             name: true,
//             username: true,
//             phone: true,
//             city: true,
//             profileImage: true,

//             // Include sport profiles for stats
//             sportProfiles: {
//                 select: {
//                     sportCode: true,
//                     avatarUrl: true,
//                     bio: true,
//                     matchesPlayed: true,
//                     wins: true,
//                     losses: true,
//                     createdAt: true,
//                     updatedAt: true
//                 }
//             },

//             favoriteTeams: {
//                 select: {
//                     team: {
//                         select: {
//                             id: true,
//                             name: true,
//                             sportCode: true,
//                             logo: true,
//                             city: true
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
//                             profileImage: true
//                         },
//                     },
//                 },
//             },

//             // Tournament wins
//             wonTournaments: {
//                 where: { status: "COMPLETED" },
//                 select: {
//                     id: true,
//                     name: true,
//                     sportCode: true,
//                     tournamentType: true,
//                     startDate: true,
//                     endDate: true
//                 },
//                 take: 5,
//                 orderBy: { endDate: 'desc' }
//             },

//             // Recent matches
//             matchParticipations: {
//                 where: {
//                     match: {
//                         status: "COMPLETED"
//                     }
//                 },
//                 select: {
//                     match: {
//                         select: {
//                             id: true,
//                             sportCode: true,
//                             gameType: true,
//                             status: true,
//                             startedAt: true,
//                             completedAt: true,
//                             winnerUserId: true,
//                             participants: {
//                                 select: {
//                                     userId: true,
//                                     user: {
//                                         select: {
//                                             name: true,
//                                             username: true,
//                                             profileImage: true
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                 },
//                 take: 10,
//                 orderBy: {
//                     match: {
//                         completedAt: 'desc'
//                     }
//                 }
//             }
//         },
//     });

//     if (!user) return null;

//     // Calculate stats for each sport
//     const stats = {};
//     const sportCodes = [...new Set(user.sportProfiles.map(p => p.sportCode))];

//     await Promise.all(sportCodes.map(async (sportCode) => {
//         stats[sportCode] = await getSportStats(userId, sportCode);
//     }));

//     // Format sport profiles with stats
//     const sportProfilesWithStats = user.sportProfiles.map(profile => ({
//         ...profile,
//         stats: stats[profile.sportCode] || {
//             overall: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 },
//             singles: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 },
//             doubles: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 }
//         }
//     }));

//     // Format recent matches
//     const recentMatches = user.matchParticipations.map(mp => ({
//         id: mp.match.id,
//         sportCode: mp.match.sportCode,
//         gameType: mp.match.gameType,
//         completedAt: mp.match.completedAt,
//         result: mp.match.winnerUserId === userId ? "WIN" : "LOSS",
//         opponents: mp.match.participants
//             .filter(p => p.userId !== userId)
//             .map(p => p.user)
//     }));

//     // ✅ KEEPING OLD STRUCTURE INTACT + ADDING NEW FIELDS
//     return {
//         // Old structure - exactly as before
//         user: {
//             id: user.id,
//             name: user.name,
//             username: user.username,
//             phone: user.phone,
//             city: user.city,
//             profileImage: user.profileImage,
//         },
//         favorites: {
//             teams: user.favoriteTeams.map((fav) => fav.team),
//             players: user.favoriteUsers.map((fav) => fav.favoriteUser),
//         },
//         // 🆕 New fields - added without breaking old structure
//         sportProfiles: sportProfilesWithStats,
//         achievements: {
//             tournamentsWon: user.wonTournaments,
//             totalTournaments: user.wonTournaments.length
//         },
//         recentMatches
//     };
// };

export const getUserProfile = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,
            profileImage: true,

            // Include sport profiles for stats
            sportProfiles: {
                select: {
                    sportCode: true,
                    avatarUrl: true,
                    bio: true,
                    matchesPlayed: true,
                    wins: true,
                    losses: true,
                    createdAt: true,
                    updatedAt: true
                }
            },

            favoriteTeams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            sportCode: true,
                            logo: true,
                            city: true
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
                            profileImage: true
                        },
                    },
                },
            },

            // Tournament wins - we'll filter by sport
            wonTournaments: {
                where: { status: "COMPLETED" },
                select: {
                    id: true,
                    name: true,
                    sportCode: true,
                    tournamentType: true,
                    startDate: true,
                    endDate: true
                }
            },

            // Recent matches
            matchParticipations: {
                where: {
                    match: {
                        status: "COMPLETED"
                    }
                },
                select: {
                    match: {
                        select: {
                            id: true,
                            sportCode: true,
                            gameType: true,
                            status: true,
                            startedAt: true,
                            completedAt: true,
                            winnerUserId: true,
                            participants: {
                                select: {
                                    userId: true,
                                    user: {
                                        select: {
                                            name: true,
                                            username: true,
                                            profileImage: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                take: 10,
                orderBy: {
                    match: {
                        completedAt: 'desc'
                    }
                }
            }
        },
    });

    if (!user) return null;

    // Calculate stats for each sport
    const stats = {};
    const sportCodes = [...new Set(user.sportProfiles.map(p => p.sportCode))];

    await Promise.all(sportCodes.map(async (sportCode) => {
        stats[sportCode] = await getSportStats(userId, sportCode);
    }));

    // 🆕 Calculate tournament achievements per sport
    const tournamentAchievements = {};
    for (const tournament of user.wonTournaments) {
        const sportCode = tournament.sportCode;
        if (!tournamentAchievements[sportCode]) {
            tournamentAchievements[sportCode] = {
                tournamentsWon: [],
                tournamentWins: 0
            };
        }
        tournamentAchievements[sportCode].tournamentsWon.push(tournament);
        tournamentAchievements[sportCode].tournamentWins++;
    }

    // Format sport profiles with stats AND achievements
    const sportProfilesWithStats = user.sportProfiles.map(profile => ({
        ...profile,
        stats: stats[profile.sportCode] || {
            overall: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 },
            singles: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 },
            doubles: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, pointsScored: 0, pointsConceded: 0, pointDifference: 0 }
        },
        // 🆕 Add achievements per sport
        achievements: tournamentAchievements[profile.sportCode] || {
            tournamentsWon: [],
            tournamentWins: 0
        }
    }));

    // Format recent matches
    const recentMatches = user.matchParticipations.map(mp => ({
        id: mp.match.id,
        sportCode: mp.match.sportCode,
        gameType: mp.match.gameType,
        completedAt: mp.match.completedAt,
        result: mp.match.winnerUserId === userId ? "WIN" : "LOSS",
        opponents: mp.match.participants
            .filter(p => p.userId !== userId)
            .map(p => p.user)
    }));

    // Aggregate overall stats across all sports
    const aggregatedStats = sportProfilesWithStats.reduce(
        (acc, profile) => {
            const s = profile.stats.overall;
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

    // Fetch sport-specific in-game achievements per sport profile
    const sportAchievements = {};
    if (sportCodes.includes("BADMINTON")) {
        sportAchievements.BADMINTON = await getBadmintonAchievements(userId);
    }

    // Attach in-game achievements to each sport profile
    const sportProfilesFinal = sportProfilesWithStats.map((profile) => ({
        sportCode: profile.sportCode,
        avatarUrl: profile.avatarUrl,
        bio: profile.bio,
        stats: profile.stats,
        achievements: sportAchievements[profile.sportCode] ?? null,
    }));

    return {
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            phone: user.phone,
            city: user.city,
            profileImage: user.profileImage,
        },
        stats: aggregatedStats,
        achievements: {
            totalTournamentsWon: user.wonTournaments.length,
            tournamentsWon: user.wonTournaments,
        },
        sportProfiles: sportProfilesFinal,
        favorites: {
            teams: user.favoriteTeams.map((fav) => fav.team),
            players: user.favoriteUsers.map((fav) => fav.favoriteUser),
        },
        recentMatches,
    };
};

const generateUniqueUsername = async (base) => {
    // Sanitize: lowercase, replace spaces/special chars with underscore, trim underscores
    const sanitized = (base || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_{2,}/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20) || "user";

    let username;
    let exists = true;
    while (exists) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        username = `${sanitized}_${suffix}`;
        exists = !!(await prisma.user.findFirst({ where: { username } }));
    }
    return username;
};

export const updateUserProfile = async (userId, data) => {
    const { name, username, city, profileImage, sportProfiles } = data;

    // Optional: prevent empty update
    if (!name && !username && !city && !profileImage && !sportProfiles) {
        throw new Error("NO_FIELDS_TO_UPDATE");
    }

    // Auto-generate username on first update if user has none and didn't provide one
    let resolvedUsername = username;
    if (!resolvedUsername) {
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, name: true },
        });
        if (!currentUser?.username) {
            const base = name || currentUser?.name || "user";
            resolvedUsername = await generateUniqueUsername(base);
        }
    }

    // If a username was explicitly provided, silently skip it if already taken
    if (username) {
        const existingUser = await prisma.user.findFirst({
            where: { username, NOT: { id: userId } },
        });
        if (existingUser) {
            resolvedUsername = undefined;
        }
    }

    // Update in transaction if we have sport profiles to update
    const updatedUser = await prisma.$transaction(async (tx) => {
        // Update user basic info
        if (name || resolvedUsername || city || profileImage) {
            await tx.user.update({
                where: { id: userId },
                data: {
                    ...(name !== undefined && { name }),
                    ...(resolvedUsername !== undefined && { username: resolvedUsername }),
                    ...(city !== undefined && { city }),
                    ...(profileImage !== undefined && { profileImage }),
                }
            });
        }

        // Update sport profiles if provided
        if (sportProfiles && Array.isArray(sportProfiles)) {
            for (const profile of sportProfiles) {
                await tx.sportProfile.upsert({
                    where: {
                        userId_sportCode: {
                            userId,
                            sportCode: profile.sportCode
                        }
                    },
                    update: {
                        avatarUrl: profile.avatarUrl,
                        bio: profile.bio
                    },
                    create: {
                        userId,
                        sportCode: profile.sportCode,
                        avatarUrl: profile.avatarUrl,
                        bio: profile.bio,
                        matchesPlayed: 0,
                        wins: 0,
                        losses: 0
                    }
                });
            }
        }

        // Return updated user with same structure as before
        return tx.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                username: true,
                phone: true,
                city: true,
                profileImage: true,
            }
        });
    });

    return updatedUser;
};

// export const getUserProfile = async (userId) => {
//     const user = await prisma.user.findUnique({
//         where: { id: userId },
//         select: {
//             id: true,
//             name: true,
//             username: true,
//             phone: true,
//             city: true,
//             profileImage: true,

//             favoriteTeams: {
//                 select: {
//                     team: {
//                         select: {
//                             id: true,
//                             name: true,
//                             sportCode: true,
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

//     if (!user) return null;

//     return {
//         user: {
//             id: user.id,
//             name: user.name,
//             username: user.username,
//             phone: user.phone,
//             city: user.city,
//             profileImage: user.profileImage,
//         },
//         favorites: {
//             teams: user.favoriteTeams.map((fav) => fav.team),
//             players: user.favoriteUsers.map((fav) => fav.favoriteUser),
//         },
//     };
// };


// export const updateUserProfile = async (userId, data) => {
//     const { name, username, city, profileImage } = data;

//     // Optional: prevent empty update
//     if (!name && !username && !city && !profileImage) {
//         throw new Error("NO_FIELDS_TO_UPDATE");
//     }

//     // Username uniqueness check (important)
//     if (username) {
//         const existingUser = await prisma.user.findFirst({
//             where: {
//                 username,
//                 NOT: { id: userId },
//             },
//         });

//         if (existingUser) {
//             throw new Error("USERNAME_ALREADY_TAKEN");
//         }
//     }

//     const updatedUser = await prisma.user.update({
//         where: { id: userId },
//         data: {
//             ...(name !== undefined && { name }),
//             ...(username !== undefined && { username }),
//             ...(city !== undefined && { city }),
//             ...(profileImage !== undefined && { profileImage }),
//         },
//         select: {
//             id: true,
//             name: true,
//             username: true,
//             phone: true,
//             city: true,
//             profileImage: true,
//         },
//     });

//     return updatedUser;
// };