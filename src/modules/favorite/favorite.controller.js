import * as favoriteService from "./favorite.service.js";

// ==================== TEAM FAVORITES ==================== //

/**
 * Add a team to favorites
 * POST /api/favorites/teams
 */
export const addFavoriteTeam = async (req, res) => {
    try {
        const userId = req.user.id; // From auth middleware
        const { teamId } = req.body;

        if (!teamId) {
            return res.status(400).json({
                success: false,
                message: "teamId is required"
            });
        }

        const favorite = await favoriteService.addFavoriteTeam(userId, teamId);

        res.json({
            success: true,
            message: "Team added to favorites",
            data: favorite
        });
    } catch (error) {
        console.error("Add Favorite Team Error:", error);

        const statusMap = {
            "TEAM_NOT_FOUND": 404,
            "TEAM_ALREADY_FAVORITED": 409
        };

        const status = statusMap[error.message] || 400;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Remove a team from favorites
 * DELETE /api/favorites/teams/:teamId
 */
export const removeFavoriteTeam = async (req, res) => {
    try {
        const userId = req.user.id;
        const { teamId } = req.params;

        await favoriteService.removeFavoriteTeam(userId, teamId);

        res.json({
            success: true,
            message: "Team removed from favorites"
        });
    } catch (error) {
        console.error("Remove Favorite Team Error:", error);

        const status = error.message === "TEAM_NOT_FAVORITED" ? 404 : 400;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all favorite teams for the current user
 * GET /api/favorites/teams
 */
export const getFavoriteTeams = async (req, res) => {
    try {
        const userId = req.user.id;
        const favorites = await favoriteService.getUserFavoriteTeams(userId);

        res.json({
            success: true,
            data: favorites
        });
    } catch (error) {
        console.error("Get Favorite Teams Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ==================== USER FAVORITES ==================== //

/**
 * Add a user to favorites
 * POST /api/favorites/users
 */
export const addFavoriteUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteUserId } = req.body;

        if (!favoriteUserId) {
            return res.status(400).json({
                success: false,
                message: "favoriteUserId is required"
            });
        }

        const favorite = await favoriteService.addFavoriteUser(userId, favoriteUserId);

        res.json({
            success: true,
            message: "User added to favorites",
            data: favorite
        });
    } catch (error) {
        console.error("Add Favorite User Error:", error);

        const statusMap = {
            "USER_NOT_FOUND": 404,
            "CANNOT_FAVORITE_SELF": 400,
            "USER_ALREADY_FAVORITED": 409
        };

        const status = statusMap[error.message] || 400;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Remove a user from favorites
 * DELETE /api/favorites/users/:favoriteUserId
 */
export const removeFavoriteUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteUserId } = req.params;

        await favoriteService.removeFavoriteUser(userId, favoriteUserId);

        res.json({
            success: true,
            message: "User removed from favorites"
        });
    } catch (error) {
        console.error("Remove Favorite User Error:", error);

        const status = error.message === "USER_NOT_FAVORITED" ? 404 : 400;

        res.status(status).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all favorite users for the current user
 * GET /api/favorites/users
 */
export const getFavoriteUsers = async (req, res) => {
    try {
        const userId = req.user.id;
        const favorites = await favoriteService.getUserFavoriteUsers(userId);

        res.json({
            success: true,
            data: favorites
        });
    } catch (error) {
        console.error("Get Favorite Users Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};