import express from "express";
import { sendNotification } from "../../utils/notification.utils.js";

const router = express.Router();

/**
 * @route   POST /api/test/notification
 * @desc    Test Firebase Notification sending
 * @access  Public (for testing purposes)
 */
router.post("/notification", async (req, res) => {
    try {
        const { token, title, body, payload } = req.body;

        if (!token || !title || !body) {
            return res.status(400).json({
                error: "MISSING_FIELDS",
                message: "token, title, and body are required",
            });
        }

        console.log(`🔔 Sending test notification to: ${token}`);
        
        const response = await sendNotification(token, title, body, payload || {});

        res.status(200).json({
            success: true,
            messageId: response,
            details: "Notification sent successfully"
        });
    } catch (error) {
        console.error("❌ Test Notification Error:", error);
        res.status(500).json({
            error: "NOTIFICATION_FAILED",
            message: error.message,
        });
    }
});

export default router;
