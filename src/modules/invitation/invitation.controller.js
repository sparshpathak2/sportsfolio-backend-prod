import * as invitationService from "./invitation.service.js";

/* =====================
   INVITE TO TOURNAMENT / MATCH
   ===================== */
// export const invite = async (req, res) => {
//     try {
//         const { tournamentId, matchId } = req.params;
//         const { type, playerId, teamId } = req.body;

//         if (!type) return res.status(400).json({ message: "INVITATION_TYPE_REQUIRED" });

//         const invitation = await invitationService.createInvitation({
//             tournamentId,
//             matchId,
//             type,
//             playerId,
//             teamId,
//         });

//         res.status(201).json({
//             success: true,
//             message: tournamentId ? "TOURNAMENT_INVITATION_SENT" : "MATCH_INVITATION_SENT",
//             data: invitation,
//         });
//     } catch (err) {
//         console.error("Invite Error:", err);
//         res.status(400).json({
//             success: false,
//             message: err.message,
//         });
//     }
// };

export const invite = async (req, res) => {
    try {
        const { tournamentId, matchId, teamId } = req.params;
        const { type, playerId, teamId: invitedTeamId } = req.body;

        if (!type) {
            return res.status(400).json({ message: "INVITATION_TYPE_REQUIRED" });
        }

        const invitation = await invitationService.createInvitation({
            type,
            playerId,
            invitedTeamId,
            tournamentId,
            matchId,
            targetTeamId: teamId,
        });

        let message = "INVITATION_SENT";
        if (tournamentId) message = "TOURNAMENT_INVITATION_SENT";
        else if (matchId) message = "MATCH_INVITATION_SENT";
        else if (teamId) message = "TEAM_INVITATION_SENT";

        res.status(201).json({
            success: true,
            message,
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

/* =====================
   ACCEPT INVITATION
   ===================== */
export const acceptInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const userId = req.user.id;

        if (!invitationId) {
            return res.status(400).json({
                success: false,
                message: "INVITATION_ID_REQUIRED",
            });
        }

        const result = await invitationService.acceptInvitation(invitationId, userId);

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

/* =====================
   LIST INVITATIONS
   ===================== */
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
        const userId = req.params.userId;

        const { data, count } =
            await invitationService.listInvitationsByUserId(userId);

        res.json({
            success: true,
            count,
            data,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



// export const listInvitationsByTargetId = async (req, res) => {
//     try {
//         const { tournamentId, matchId } = req.params;

//         if (!tournamentId && !matchId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "TARGET_ID_REQUIRED",
//             });
//         }

//         const { data, count } =
//             await invitationService.listInvitationsByTargetId({
//                 tournamentId,
//                 matchId,
//             });

//         res.json({
//             success: true,
//             count,
//             data,
//         });
//     } catch (error) {
//         console.error("List Invitations Error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const listInvitationsByTargetId = async (req, res) => {
//     try {
//         const { tournamentId, matchId, teamId } = req.params;

//         console.log("tournamentId at listInvitationsByTargetId:", tournamentId)

//         // exactly ONE target must exist
//         if (!tournamentId && !matchId && !teamId) {
//             return res.status(400).json({
//                 success: false,
//                 message: "TARGET_ID_REQUIRED",
//             });
//         }

//         const { data, count } =
//             await invitationService.listInvitationsByTargetId({
//                 tournamentId,
//                 matchId,
//                 teamId,
//             });

//         res.json({
//             success: true,
//             count,
//             data,
//         });
//     } catch (error) {
//         console.error("List Invitations Error:", error);
//         res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

export const listInvitationsByTargetId = async (req, res) => {
    try {
        const { tournamentId, matchId, teamId } = req.params;
        const { status } = req.query;

        console.log("tournamentId at listInvitationsByTargetId:", tournamentId)
        console.log("status at listInvitationsByTargetId:", status)

        if (!tournamentId && !matchId && !teamId) {
            return res.status(400).json({
                success: false,
                message: "TARGET_ID_REQUIRED",
            });
        }

        const { data, count } =
            await invitationService.listInvitationsByTargetId({
                tournamentId,
                matchId,
                teamId,
                status,
            });

        res.json({
            success: true,
            count,
            data,
        });
    } catch (error) {
        console.error("List Invitations Error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


/* =====================
   DECLINE INVITATION
   ===================== */
export const declineInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        const userId = req.user.id; // ✅ Authenticated user

        const invitation = await invitationService.declineInvitation(invitationId, userId);

        res.json({
            success: true,
            data: invitation,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};



/* =====================
   DELETE INVITATION
   ===================== */
export const deleteInvitation = async (req, res) => {
    try {
        const { invitationId } = req.params;
        await invitationService.deleteInvitation(invitationId);
        res.json({ success: true, message: "INVITATION_DELETED" });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
