import * as teamService from "./team.service.js";

export const createTeam = async (req, res) => {
    try {
        const { name, sportCode, ownerUserId } = req.body;

        const team = await teamService.createTeam({
            name,
            sportCode,
            ownerUserId,
        });

        res.status(201).json({
            success: true,
            data: team,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const listTeams = async (req, res) => {
    try {
        const { sportId } = req.query;

        const teams = await teamService.listTeams({ sportId });

        res.json({
            success: true,
            data: teams,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getTeamById = async (req, res) => {
    try {
        const { id } = req.params;

        const team = await teamService.getTeamById(id);

        res.json({
            success: true,
            data: team,
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};

export const joinTeamController = async (req, res) => {
    try {
        const { teamId } = req.params;
        const userId = req.user.id;

        const member = await teamService.joinTeam({
            teamId,
            userId,
        });

        return res.status(201).json({
            success: true,
            message: "JOIN_REQUEST_SUCCESS",
            data: member,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
};



export const removeTeamMember = async (req, res) => {
    try {
        const { id, userId } = req.params;

        await teamService.removeTeamMember({
            teamId: id,
            userId,
        });

        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const listTeamMembers = async (req, res) => {
    try {
        const { id } = req.params;

        const members = await teamService.listTeamMembers(id);

        res.json({
            success: true,
            data: members,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
