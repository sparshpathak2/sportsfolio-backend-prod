export const getPlayerStats = async (req, res) => {
    try {
        const { userId, sportCode } = req.params;

        // First try to get from SportProfile
        let profile = await prisma.sportProfile.findUnique({
            where: {
                userId_sportCode: {
                    userId,
                    sportCode: sportCode.toUpperCase()
                }
            },
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

        // If no profile, calculate on-the-fly
        if (!profile) {
            const matchesPlayed = await prisma.matchParticipant.count({
                where: { userId }
            });

            const wins = await prisma.match.count({
                where: { winnerUserId: userId }
            });

            profile = {
                matchesPlayed,
                wins,
                losses: matchesPlayed - wins,
                sportCode
            };
        }

        // Get additional stats from relations
        const tournamentWins = await prisma.tournament.count({
            where: { winnerUserId: userId }
        });

        const recentMatches = await prisma.match.findMany({
            where: {
                participants: {
                    some: { userId }
                },
                status: "COMPLETED"
            },
            orderBy: { completedAt: 'desc' },
            take: 10,
            include: {
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            data: {
                profile,
                tournamentWins,
                recentMatches,
                winRate: profile.matchesPlayed > 0
                    ? (profile.wins / profile.matchesPlayed * 100).toFixed(1)
                    : 0
            }
        });
    } catch (error) {
        console.error("Get Stats Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Get stats for all sports for a user
export const getAllPlayerStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const profiles = await prisma.sportProfile.findMany({
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

        // Group by sport
        const statsBySport = {};
        for (const sport of Object.values(SportCode)) {
            const sportProfiles = profiles.filter(p => p.sportCode === sport);

            // Calculate aggregated stats
            const matchesPlayed = sportProfiles.reduce((sum, p) => sum + p.matchesPlayed, 0);
            const wins = sportProfiles.reduce((sum, p) => sum + p.wins, 0);

            statsBySport[sport] = {
                matchesPlayed,
                wins,
                losses: matchesPlayed - wins,
                profiles: sportProfiles,
                winRate: matchesPlayed > 0 ? (wins / matchesPlayed * 100).toFixed(1) : 0
            };
        }

        res.json({
            success: true,
            data: statsBySport
        });
    } catch (error) {
        console.error("Get All Stats Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};