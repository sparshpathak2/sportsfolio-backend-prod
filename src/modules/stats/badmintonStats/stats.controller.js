import * as statsService from "./stats.service.js";

export const getBadmintonOverview = async (req, res) => {
    try {
        const { userId } = req.params;
        const { timeRange } = req.query; // 'ALL_TIME', 'THIS_MONTH', 'THIS_WEEK'

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

        const stats = await statsService.getBadmintonSinglesStats(userId);

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

        const stats = await statsService.getBadmintonDoublesStats(userId);

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
        const { page = 1, limit = 10 } = req.query;

        const history = await statsService.getMatchHistory(userId, parseInt(page), parseInt(limit));

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