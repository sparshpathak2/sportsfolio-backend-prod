import * as profileService from "./profile.service.js";

export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const profile = await profileService.getUserProfile(userId);

        if (!profile) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json(profile);
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            message: "Failed to fetch user profile",
        });
    }
};


export const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const updatedProfile = await profileService.updateUserProfile(
            userId,
            req.body
        );

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedProfile,
        });
    } catch (error) {
        console.error("Update profile error:", error);

        if (error.message === "USERNAME_ALREADY_TAKEN") {
            return res.status(409).json({ message: "Username already taken" });
        }

        if (error.message === "NO_FIELDS_TO_UPDATE") {
            return res.status(400).json({ message: "No fields provided to update" });
        }

        return res.status(500).json({
            message: "Failed to update profile",
        });
    }
};




