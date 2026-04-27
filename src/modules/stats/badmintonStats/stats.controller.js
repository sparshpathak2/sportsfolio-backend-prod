import * as statsService from "./stats.service.js";

export const getBadmintonOverview = async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange = 'ALL_TIME' } = req.query; // 'ALL_TIME', 'THIS_MONTH', 'THIS_WEEK'

        const stats = await statsService.getBadmintonOverview(userId, timeRange);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error("Get Badminton Overview Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getBadmintonSingles = async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange = 'ALL_TIME' } = req.query;

        const stats = await statsService.getBadmintonSinglesStats(userId, timeRange);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error("Get Badminton Singles Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getBadmintonDoubles = async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange = 'ALL_TIME' } = req.query;

        const stats = await statsService.getBadmintonDoublesStats(userId, timeRange);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error("Get Badminton Doubles Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getMatchHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, timeRange = 'ALL_TIME' } = req.query;

        const history = await statsService.getMatchHistory(userId, parseInt(page), parseInt(limit), timeRange);

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error("Get Match History Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getAchievements = async (req, res) => {
    try {
        const { userId } = req.params;

        const achievements = await statsService.getAchievements(userId);

        res.json({
            success: true,
            data: achievements
        });
    } catch (error) {
        console.error("Get Achievements Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getActiveStreaks = async (req, res) => {
    try {
        const { userId } = req.params;

        const streaks = await statsService.getActiveStreaks(userId);

        res.json({
            success: true,
            data: streaks
        });
    } catch (error) {
        console.error("Get Active Streaks Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const getCourtStats = async (req, res) => {
    try {
        const { userId } = req.params;

        const courtStats = await statsService.getCourtStats(userId);

        res.json({
            success: true,
            data: courtStats
        });
    } catch (error) {
        console.error("Get Court Stats Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// export const getAllBadmintonStats = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { timeRange, page = 1, limit = 10 } = req.query;

//         // Run all stats queries in parallel for better performance
//         const [overview, singles, doubles, achievements, streaks, courts, history] = await Promise.all([
//             statsService.getBadmintonOverview(userId, timeRange),
//             statsService.getBadmintonSinglesStats(userId),
//             statsService.getBadmintonDoublesStats(userId),
//             statsService.getAchievements(userId),
//             statsService.getActiveStreaks(userId),
//             statsService.getCourtStats(userId),
//             statsService.getMatchHistory(userId, parseInt(page), parseInt(limit))
//         ]);

//         res.json({
//             success: true,
//             data: {
//                 overview,
//                 singles,
//                 doubles,
//                 achievements,
//                 streaks,
//                 courts,
//                 history
//             }
//         });
//     } catch (error) {
//         console.error("Get All Badminton Stats Error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// export const getAllBadmintonStats = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { timeRange, page = 1, limit = 10 } = req.query;

//         // Run all stats queries in parallel
//         const [
//             overview,
//             singles,
//             doubles,
//             achievements,
//             streaks,
//             courts,
//             history,
//             highLevelStats,        // 🆕 From profile
//             tournamentAchievements  // 🆕 From profile
//         ] = await Promise.all([
//             statsService.getBadmintonOverview(userId, timeRange),
//             statsService.getBadmintonSinglesStats(userId),
//             statsService.getBadmintonDoublesStats(userId),
//             statsService.getAchievements(userId),
//             statsService.getActiveStreaks(userId),
//             statsService.getCourtStats(userId),
//             statsService.getMatchHistory(userId, parseInt(page), parseInt(limit)),
//             statsService.getHighLevelSportStats(userId, "BADMINTON"),
//             statsService.getSportTournamentAchievements(userId, "BADMINTON")
//         ]);

//         res.json({
//             success: true,
//             data: {
//                 // High-level stats (from profile)
//                 highLevel: {
//                     stats: highLevelStats,
//                     achievements: tournamentAchievements
//                 },
//                 // Deep stats (from stats module)
//                 overview,
//                 singles,
//                 doubles,
//                 achievements: {
//                     ...achievements,
//                     tournamentAchievements // Merge if needed
//                 },
//                 streaks,
//                 courts,
//                 history
//             }
//         });
//     } catch (error) {
//         console.error("Get All Badminton Stats Error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };


export const getAllBadmintonStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange = 'ALL_TIME', page = 1, limit = 10 } = req.query;

        // Run all stats queries in parallel
        const [
            summaryStats,        // High-level aggregated stats (from profile)
            summaryAchievements, // Tournament wins (from profile)
            overviewTab,
            singlesTab,
            doublesTab,
            achievementsTab,
            streaksTab,
            courtsTab,
            historyTab
        ] = await Promise.all([
            statsService.getHighLevelSportStats(userId, "BADMINTON"),
            statsService.getSportTournamentAchievements(userId, "BADMINTON"),
            statsService.getBadmintonOverview(userId, timeRange),
            statsService.getBadmintonSinglesStats(userId, timeRange),
            statsService.getBadmintonDoublesStats(userId, timeRange),
            statsService.getAchievements(userId),
            statsService.getActiveStreaks(userId),
            statsService.getCourtStats(userId),
            statsService.getMatchHistory(userId, parseInt(page), parseInt(limit), timeRange)
        ]);

        res.json({
            success: true,
            data: {
                // 🏆 SUMMARY - High-level, at-a-glance stats
                summary: {
                    stats: summaryStats,
                    achievements: summaryAchievements,
                    // Add key metrics from overview that make sense at summary level
                    quickStats: {
                        totalMatches: overviewTab?.playingStyle?.singles?.matches + overviewTab?.playingStyle?.doubles?.matches || 0,
                        winRate: overviewTab?.winRate || 0,
                        currentStreak: overviewTab?.streakText || "No Active Streak",
                        courtsPlayed: overviewTab?.timeAndConsistency?.courtsPlayed || 0
                    }
                },

                // 📊 DETAILED - Deep dive stats for each tab
                detailed: {
                    overview: overviewTab,
                    singles: singlesTab,
                    doubles: doublesTab,
                    achievements: {
                        ...achievementsTab,
                        tournamentAchievements: summaryAchievements
                    },
                    streaks: streaksTab,
                    courts: courtsTab,
                    history: historyTab
                }
            }
        });
    } catch (error) {
        console.error("Get All Badminton Stats Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};