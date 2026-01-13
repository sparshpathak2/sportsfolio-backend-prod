import * as invitationService from "./invitation.service.js";
import prisma from "../../lib/prisma.js"

/* =====================
   INVITE TO TOURNAMENT / MATCH
   ===================== */
export const invite = async (req, res) => {
    try {
        const { tournamentId, matchId } = req.params; // flexible
        const { type, playerId, teamId } = req.body;

        if (!type) return res.status(400).json({ message: "INVITATION_TYPE_REQUIRED" });

        const invitation = await invitationService.createInvitation({
            tournamentId,
            matchId,
            type,
            playerId,
            teamId,
        });

        res.status(201).json({
            success: true,
            message: tournamentId ? "TOURNAMENT_INVITATION_SENT" : "MATCH_INVITATION_SENT",
            data: invitation,
        });
    } catch (err) {
        console.error("Invite Error:", err);
        res.status(400).json({
            success: false,
            message: err.message,
        });
    }
};


export const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const userId = req.user.id; // assuming auth middleware sets this

        if (!invitationId) {
            return res.status(400).json({
                success: false,
                message: "INVITATION_ID_REQUIRED",
            });
        }

        const result = await invitationService.acceptInvitation({
            invitationId,
            userId,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const listInvitations = async (req, res) => {
    try {
        const invitations = await invitationService.listInvitations();
        res.json({ success: true, data: invitations });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


export const listInvitationsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res
                .status(400)
                .json({ success: false, message: "USER_ID_REQUIRED" });
        }

        const invitations = await invitationService.listInvitationsByUserId(userId);

        res.json({ success: true, data: invitations });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


export const listInvitationsByTargetId = async (req, res) => {
    try {
        const { tournamentId, matchId } = req.params;

        if (!tournamentId && !matchId) {
            return res.status(400).json({ message: "TARGET_ID_REQUIRED" });
        }

        const whereClause = tournamentId
            ? { tournamentId }
            : { matchId };

        const invitations = await prisma.invitation.findMany({
            where: whereClause,
            include: {
                player: true,
                team: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        res.status(200).json({
            success: true,
            data: invitations,
        });
    } catch (error) {
        console.error("List Invitations Error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


export const deleteInvitation = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res
                .status(400)
                .json({ success: false, message: "INVITATION_ID_REQUIRED" });
        }

        await invitationService.deleteInvitation(id);

        res.json({
            success: true,
            message: "INVITATION_DELETED",
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};


export const listInvitationsByTournamentId = async (req, res) => {
    try {
        const invitations =
            await invitationService.listInvitationsByTournamentId(
                req.params.tournamentId
            );
        res.json({ success: true, data: invitations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};