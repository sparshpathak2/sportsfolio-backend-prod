import * as personnelService from "./personnel.service.js";

/**
 * Get available personnel for dropdown
 * GET /api/personnel/available?search=john&role=REFEREE
 */
export const getAvailablePersonnel = async (req, res) => {
    try {
        const { entityType, role, search } = req.query;

        const personnel = await personnelService.getAvailablePersonnel({
            entityType,
            role,
            search
        });

        res.json({
            success: true,
            data: personnel
        });
    } catch (error) {
        console.error("Get Available Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Add personnel to tournament
 */
export const addTournamentPersonnel = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { personnel } = req.body;

        if (!personnel || !Array.isArray(personnel) || personnel.length === 0) {
            return res.status(400).json({
                success: false,
                message: "personnel array is required"
            });
        }

        const result = await personnelService.addPersonnel({
            entityType: "TOURNAMENT",
            entityId: tournamentId,
            personnel
        });

        res.json({
            success: true,
            message: "Personnel added successfully",
            data: result
        });
    } catch (error) {
        console.error("Add Tournament Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Add personnel to match
 */
export const addMatchPersonnel = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { personnel } = req.body;

        if (!personnel || !Array.isArray(personnel) || personnel.length === 0) {
            return res.status(400).json({
                success: false,
                message: "personnel array is required"
            });
        }

        const result = await personnelService.addPersonnel({
            entityType: "MATCH",
            entityId: matchId,
            personnel
        });

        res.json({
            success: true,
            message: "Personnel added successfully",
            data: result
        });
    } catch (error) {
        console.error("Add Match Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get tournament personnel
 */
export const getTournamentPersonnel = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { role } = req.query;

        const personnel = await personnelService.getPersonnel({
            entityType: "TOURNAMENT",
            entityId: tournamentId,
            role
        });

        res.json({
            success: true,
            data: personnel
        });
    } catch (error) {
        console.error("Get Tournament Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get match personnel
 */
export const getMatchPersonnel = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { role } = req.query;

        const personnel = await personnelService.getPersonnel({
            entityType: "MATCH",
            entityId: matchId,
            role
        });

        res.json({
            success: true,
            data: personnel
        });
    } catch (error) {
        console.error("Get Match Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update tournament personnel
 */
export const updateTournamentPersonnel = async (req, res) => {
    try {
        const { tournamentId, userId } = req.params;
        const { role, isPrimary } = req.body;

        const result = await personnelService.updatePersonnelRole({
            entityType: "TOURNAMENT",
            entityId: tournamentId,
            userId,
            role,
            isPrimary
        });

        res.json({
            success: true,
            message: "Personnel updated successfully",
            data: result
        });
    } catch (error) {
        console.error("Update Tournament Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update match personnel
 */
export const updateMatchPersonnel = async (req, res) => {
    try {
        const { matchId, userId } = req.params;
        const { role, isPrimary } = req.body;

        const result = await personnelService.updatePersonnelRole({
            entityType: "MATCH",
            entityId: matchId,
            userId,
            role,
            isPrimary
        });

        res.json({
            success: true,
            message: "Personnel updated successfully",
            data: result
        });
    } catch (error) {
        console.error("Update Match Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Remove tournament personnel
 */
export const removeTournamentPersonnel = async (req, res) => {
    try {
        const { tournamentId, userId } = req.params;

        const result = await personnelService.removePersonnel({
            entityType: "TOURNAMENT",
            entityId: tournamentId,
            userId
        });

        res.json({
            success: true,
            message: "Personnel removed successfully",
            data: result
        });
    } catch (error) {
        console.error("Remove Tournament Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Remove match personnel
 */
export const removeMatchPersonnel = async (req, res) => {
    try {
        const { matchId, userId } = req.params;

        const result = await personnelService.removePersonnel({
            entityType: "MATCH",
            entityId: matchId,
            userId
        });

        res.json({
            success: true,
            message: "Personnel removed successfully",
            data: result
        });
    } catch (error) {
        console.error("Remove Match Personnel Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get all personnel assignments for a user
 */
export const getUserPersonnelAssignments = async (req, res) => {
    try {
        const { userId } = req.params;

        const assignments = await personnelService.getUserPersonnelAssignments(userId);

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error("Get User Personnel Assignments Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};