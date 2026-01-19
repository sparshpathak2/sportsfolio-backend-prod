import * as RequestService from "./request.service.js";

export const createTournamentRequest = async (req, res) => {
    try {
        const { tournamentId, teamId, message } = req.body;
        const userId = req.user.id;

        const request = await RequestService.createRequest({
            tournamentId,
            userId: teamId ? null : userId, // If teamId is provided, it's a team request
            teamId,
            message
        });

        res.status(201).json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error("Create Request Error:", error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const getTournamentRequests = async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const organizerId = req.user.id;

        const requests = await RequestService.listTournamentRequests(tournamentId, organizerId);

        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const respondToRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;
        const organizerId = req.user.id;

        const updatedRequest = await RequestService.updateRequestStatus(requestId, status, organizerId);

        res.status(200).json({
            success: true,
            data: updatedRequest
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

export const getMyRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await RequestService.listMySentRequests(userId);

        res.status(200).json({
            success: true,
            data: requests
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
