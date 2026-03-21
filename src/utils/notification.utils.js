import admin from "firebase-admin";

/**
 * Sends a single Firebase Cloud Messaging (FCM) notification.
 * 
 * @param {string} token - The device token of the recipient.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body/message.
 * @param {Object} [payload={}] - Additional data payload to send with the notification.
 * @returns {Promise<string>} - The ID of the sent message.
 */
export const sendNotification = async (token, title, body, payload = {}) => {
    if (!token) {
        throw new Error("FCM device token is required");
    }

    const message = {
        notification: {
            title,
            body,
        },
        data: {
            ...payload,
            // FCM data payloads must be strings
            ...Object.keys(payload).reduce((acc, key) => {
                acc[key] = String(payload[key]);
                return acc;
            }, {}),
        },
        token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log("Successfully sent notification:", response);
        return response;
    } catch (error) {
        console.error("Error sending Firebase notification:", error);
        throw error;
    }
};

/**
 * Sends a notification to multiple FCM tokens.
 * 
 * @param {string[]} tokens - Array of device tokens.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body/message.
 * @param {Object} [payload={}] - Additional data payload.
 * @returns {Promise<admin.messaging.BatchResponse>} - Response object containing success/failure details.
 */
export const sendMulticastNotification = async (tokens, title, body, payload = {}) => {
    if (!tokens || tokens.length === 0) {
        return { successCount: 0, failureCount: 0, responses: [] };
    }

    const message = {
        notification: {
            title,
            body,
        },
        data: {
            ...Object.keys(payload).reduce((acc, key) => {
                acc[key] = String(payload[key]);
                return acc;
            }, {}),
        },
        tokens,
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`${response.successCount} notifications sent successfully`);
        
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.warn("Following tokens failed:", failedTokens);
        }

        return response;
    } catch (error) {
        console.error("Error sending multicast Firebase notification:", error);
        throw error;
    }
};
