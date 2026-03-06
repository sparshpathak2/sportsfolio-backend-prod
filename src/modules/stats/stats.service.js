// import prisma from "../../lib/prisma.js";

// // Helper to calculate points for a player in a match
// export const calculateMatchPoints = async (matchId, userId) => {
//     const match = await prisma.match.findUnique({
//         where: { id: matchId },
//         include: {
//             parts: true,
//             participants: true
//         }
//     });

//     if (!match) return { scored: 0, conceded: 0 };

//     const userParticipant = match.participants.find(p => p.userId === userId);
//     if (!userParticipant) return { scored: 0, conceded: 0 };

//     const userSide = userParticipant.side || userParticipant.position;
//     let scored = 0;
//     let conceded = 0;

//     for (const part of match.parts) {
//         if (userSide === 1) {
//             scored += part.p1Score;
//             conceded += part.p2Score;
//         } else {
//             scored += part.p2Score;
//             conceded += part.p1Score;
//         }
//     }

//     return { scored, conceded };
// };

// // Update player stats after match completion
// export const updatePlayerStatsAfterMatch = async ({
//     userId,
//     matchId,
//     sportCode,
//     gameType,
//     result,
//     teamId = null,
//     points = null
// }) => {
//     // Calculate points if not provided
//     const matchPoints = points || await calculateMatchPoints(matchId, userId);

//     // Create match stats record
//     await prisma.matchStats.create({
//         data: {
//             userId,
//             matchId,
//             sportCode,
//             gameType,
//             teamId,
//             result,
//             pointsScored: matchPoints.scored,
//             pointsConceded: matchPoints.conceded
//         }
//     });

//     // Update or create sport profile
//     const profile = await prisma.sportProfile.upsert({
//         where: {
//             userId_sportCode: { userId, sportCode }
//         },
//         create: {
//             userId,
//             sportCode,
//             matchesPlayed: 1,
//             wins: result === "WIN" ? 1 : 0,
//             losses: result === "LOSS" ? 1 : 0,
//             draws: result === "DRAW" ? 1 : 0
//         },
//         update: {
//             matchesPlayed: { increment: 1 },
//             ...(result === "WIN" && { wins: { increment: 1 } }),
//             ...(result === "LOSS" && { losses: { increment: 1 } }),
//             ...(result === "DRAW" && { draws: { increment: 1 } })
//         }
//     });

//     return profile;
// };

// // Helper to calculate stats for a specific game type
// const calculateSportStats = async (userId, sportCode, gameType = null) => {
//     const whereClause = {
//         userId,
//         match: {
//             sportCode,
//             status: "COMPLETED"
//         }
//     };

//     if (gameType) {
//         whereClause.match.gameType = gameType;
//     }

//     const matchParticipants = await prisma.matchParticipant.findMany({
//         where: whereClause,
//         include: {
//             match: {
//                 include: {
//                     parts: true
//                 }
//             }
//         }
//     });

//     const matchesPlayed = matchParticipants.length;
//     const wins = await prisma.match.count({
//         where: {
//             sportCode,
//             status: "COMPLETED",
//             ...(gameType && { gameType }),
//             OR: [
//                 { winnerUserId: userId },
//                 { winnerTeam: { members: { some: { userId } } } }
//             ]
//         }
//     });

//     const losses = matchesPlayed - wins;

//     let pointsScored = 0;
//     let pointsConceded = 0;

//     for (const mp of matchParticipants) {
//         const match = mp.match;
//         const userParticipant = match.participants.find(p => p.userId === userId);

//         if (userParticipant) {
//             const userSide = userParticipant.side || userParticipant.position;
//             for (const part of match.parts) {
//                 if (userSide === 1) {
//                     pointsScored += part.p1Score;
//                     pointsConceded += part.p2Score;
//                 } else {
//                     pointsScored += part.p2Score;
//                     pointsConceded += part.p1Score;
//                 }
//             }
//         }
//     }

//     return {
//         matchesPlayed,
//         wins,
//         losses,
//         winRate: matchesPlayed > 0 ? Number(((wins / matchesPlayed) * 100).toFixed(1)) : 0,
//         pointsScored,
//         pointsConceded,
//         pointDifference: pointsScored - pointsConceded
//     };
// };

// // Get stats for a specific sport with categories
// export const getSportStats = async (userId, sportCode) => {
//     const [overall, singles, doubles] = await Promise.all([
//         calculateSportStats(userId, sportCode),
//         calculateSportStats(userId, sportCode, "SINGLES"),
//         calculateSportStats(userId, sportCode, "DOUBLES")
//     ]);

//     return {
//         overall,
//         singles,
//         doubles
//     };
// };

// // Get player stats summary (for profile)
// export const getPlayerStatsSummary = async (userId) => {
//     const sportProfiles = await prisma.sportProfile.findMany({
//         where: { userId },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     profileImage: true
//                 }
//             }
//         }
//     });

//     const tournamentWins = await prisma.tournament.count({
//         where: {
//             OR: [
//                 { winnerUserId: userId },
//                 { winnerTeam: { members: { some: { userId } } } }
//             ]
//         }
//     });

//     const recentMatches = await prisma.matchStats.findMany({
//         where: { userId },
//         orderBy: { createdAt: 'desc' },
//         take: 10,
//         include: {
//             match: {
//                 select: {
//                     id: true,
//                     name: true,
//                     startedAt: true,
//                     completedAt: true,
//                     tournament: {
//                         select: { name: true }
//                     }
//                 }
//             }
//         }
//     });

//     const totalMatches = sportProfiles.reduce((sum, p) => sum + p.matchesPlayed, 0);
//     const totalWins = sportProfiles.reduce((sum, p) => sum + p.wins, 0);
//     const totalLosses = sportProfiles.reduce((sum, p) => sum + p.losses, 0);

//     return {
//         overall: {
//             matchesPlayed: totalMatches,
//             wins: totalWins,
//             losses: totalLosses,
//             winRate: totalMatches > 0 ? Number(((totalWins / totalMatches) * 100).toFixed(1)) : 0,
//             tournamentsWon: tournamentWins
//         },
//         bySport: sportProfiles,
//         recentMatches
//     };
// };

import prisma from "../../lib/prisma.js";

// Helper to calculate points for a player in a match
export const calculateMatchPoints = async (matchId, userId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: true
        }
    });

    if (!match) return { scored: 0, conceded: 0 };

    const userParticipant = match.participants.find(p => p.userId === userId);
    if (!userParticipant) return { scored: 0, conceded: 0 };

    const userSide = userParticipant.side || userParticipant.position;
    let scored = 0;
    let conceded = 0;

    for (const part of match.parts) {
        if (userSide === 1) {
            scored += part.p1Score;
            conceded += part.p2Score;
        } else {
            scored += part.p2Score;
            conceded += part.p1Score;
        }
    }

    return { scored, conceded };
};

// 🔥 FIXED: Update player stats after match completion
export const updatePlayerStatsAfterMatch = async ({
    userId,
    matchId,
    sportCode,
    gameType,
    result,
    teamId = null,
    points = null
}) => {
    // Calculate points if not provided
    const matchPoints = points || await calculateMatchPoints(matchId, userId);

    // Create match stats record
    await prisma.matchStats.create({
        data: {
            userId,
            matchId,
            sportCode,
            gameType,
            teamId,
            result,
            pointsScored: matchPoints.scored,
            pointsConceded: matchPoints.conceded
        }
    });

    // 🔥 FIXED: Update or create sport profile - MATCHING YOUR SCHEMA
    const profile = await prisma.sportProfile.upsert({
        where: {
            userId_sportCode: {
                userId,
                sportCode
            }
        },
        create: {
            // ✅ CORRECT: Use 'user' relation with connect
            user: {
                connect: { id: userId }
            },
            sportCode,
            matchesPlayed: 1,
            wins: result === "WIN" ? 1 : 0,
            losses: result === "LOSS" ? 1 : 0,
            // ✅ id will be auto-generated by Prisma (cuid)
        },
        update: {
            matchesPlayed: { increment: 1 },
            ...(result === "WIN" && { wins: { increment: 1 } }),
            ...(result === "LOSS" && { losses: { increment: 1 } }),
        }
    });

    return profile;
};

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

    let pointsScored = 0;
    let pointsConceded = 0;

    for (const mp of matchParticipants) {
        const match = mp.match;
        const userParticipant = match.participants.find(p => p.userId === userId);

        if (userParticipant) {
            const userSide = userParticipant.side || userParticipant.position;
            for (const part of match.parts) {
                if (userSide === 1) {
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

// Get stats for a specific sport with categories
export const getSportStats = async (userId, sportCode) => {
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

// Get player stats summary (for profile)
export const getPlayerStatsSummary = async (userId) => {
    const sportProfiles = await prisma.sportProfile.findMany({
        where: { userId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    profileImage: true
                }
            }
        }
    });

    const tournamentWins = await prisma.tournament.count({
        where: {
            OR: [
                { winnerUserId: userId },
                { winnerTeam: { members: { some: { userId } } } }
            ]
        }
    });

    const recentMatches = await prisma.matchStats.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            match: {
                select: {
                    id: true,
                    name: true,
                    startedAt: true,
                    completedAt: true,
                    tournament: {
                        select: { name: true }
                    }
                }
            }
        }
    });

    const totalMatches = sportProfiles.reduce((sum, p) => sum + p.matchesPlayed, 0);
    const totalWins = sportProfiles.reduce((sum, p) => sum + p.wins, 0);
    const totalLosses = sportProfiles.reduce((sum, p) => sum + p.losses, 0);

    return {
        overall: {
            matchesPlayed: totalMatches,
            wins: totalWins,
            losses: totalLosses,
            winRate: totalMatches > 0 ? Number(((totalWins / totalMatches) * 100).toFixed(1)) : 0,
            tournamentsWon: tournamentWins
        },
        bySport: sportProfiles,
        recentMatches
    };
};