import * as achievementService from "./achievement.service.js";

export const getAchievements = async (req, res) => {
    try {
        const { userId } = req.params;

        const data = await achievementService.getBadmintonAchievements(userId);

        res.json({ success: true, data });
    } catch (error) {
        console.error("Get Achievements Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getShareCard = async (req, res) => {
    try {
        const { userId, achievementId } = req.params;

        const data = await achievementService.getShareCard(userId, achievementId);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Achievement not found or does not belong to this user",
            });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error("Get Share Card Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const evaluateAchievements = async (req, res) => {
    try {
        const { userId } = req.params;

        const data = await achievementService.evaluateAllAchievements(userId);

        res.json({ success: true, data });
    } catch (error) {
        console.error("Evaluate Achievements Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
