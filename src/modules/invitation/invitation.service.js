import prisma from "../../lib/prisma.js";

export const createInvitation = async ({ type, playerId, teamId, tournamentId, matchId }) => {
    // Validate type
    if (!["PLAYER", "TEAM"].includes(type)) throw new Error("INVALID_INVITATION_TYPE");

    let targetGameType;
    let sportCode;

    // Check target and get gameType
    if (tournamentId) {
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { rules: true, participants: true },
        });
        if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
        if (!tournament.rules || !tournament.rules.gameType) throw new Error("TOURNAMENT_RULES_NOT_SET");

        targetGameType = tournament.rules.gameType;
        sportCode = tournament.sportCode;

        // If it's doubles, player invitations are not allowed
        if (targetGameType === "DOUBLES" && type === "PLAYER") {
            throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
        }

        // If it's doubles and type is TEAM, auto-create a team if teamId not provided
        if (type === "TEAM" && !teamId) {
            const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;
            const newTeamName = `Team ${existingTeamsCount + 1}`;

            const newTeam = await prisma.team.create({
                data: {
                    name: newTeamName,
                    sportCode: tournament.sportCode,
                    isTemporary: true, // Mark as temporary since it's auto-created
                },
            });

            teamId = newTeam.id;
        }

    }

    if (matchId) {
        const match = await prisma.match.findUnique({ where: { id: matchId } });
        if (!match) throw new Error("MATCH_NOT_FOUND");
        if (!match.gameType) throw new Error("MATCH_GAME_TYPE_NOT_SET");

        targetGameType = match.gameType;

        // Only allow team invites for doubles
        if (type === "TEAM" && targetGameType === "SINGLES") {
            throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
        }

        // Player invites not allowed for doubles
        if (type === "PLAYER" && targetGameType === "DOUBLES") {
            throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
        }
    }

    // Validate IDs
    if (type === "PLAYER" && !playerId) throw new Error("PLAYER_ID_REQUIRED");
    if (type === "TEAM" && !teamId) throw new Error("TEAM_ID_REQUIRED");

    // Prevent duplicate invitation
    const existing = await prisma.invitation.findFirst({
        where: {
            tournamentId,
            matchId,
            playerId,
            teamId,
            status: "PENDING",
        },
    });

    if (existing) throw new Error("INVITATION_ALREADY_EXISTS");

    // Create invitation
    return prisma.invitation.create({
        data: { type, playerId, teamId, tournamentId, matchId },
    });
};


export const acceptInvitation = async (invitationId, userId) => {
    return prisma.$transaction(async (tx) => {
        const invite = await tx.invitation.findUnique({
            where: { id: invitationId },
            include: {
                tournament: { include: { rules: true } },
            },
        });

        if (!invite || invite.status !== "PENDING") {
            throw new Error("INVALID_INVITATION");
        }
        
        // Ensure the user accepting is the one invited (if it's a player invite)
        if (invite.type === "PLAYER" && invite.playerId !== userId) {
            throw new Error("NOT_AUTHORIZED_TO_ACCEPT");
        }

        // PLAYER INVITE to Tournament
        if (invite.tournamentId) {
            if (invite.type === "PLAYER") {
                await tx.tournamentParticipant.create({
                    data: {
                        tournamentId: invite.tournamentId,
                        playerId: invite.playerId,
                    },
                });
            } else if (invite.type === "TEAM") {
                await tx.tournamentParticipant.create({
                    data: {
                        tournamentId: invite.tournamentId,
                        teamId: invite.teamId,
                    },
                });
            }
        }
        
        // TODO: Handle match invite acceptance if needed

        return tx.invitation.update({
            where: { id: invitationId },
            data: { status: "ACCEPTED" },
        });
    });
};


export const listInvitations = async () => {
    return prisma.invitation.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            tournament: true,
            player: true,
            team: true,
        },
    });
};


export const listInvitationsByUserId = async (userId) => {
    return prisma.invitation.findMany({
        where: {
            playerId: userId,
        },
        orderBy: { createdAt: "desc" },
        include: {
            tournament: {
                include: {
                    location: true,
                },
            },
            team: true,
        },
    });
};


export const deleteInvitation = async (invitationId) => {
    const existing = await prisma.invitation.findUnique({
        where: { id: invitationId },
    });

    if (!existing) {
        throw new Error("INVITATION_NOT_FOUND");
    }

    return prisma.invitation.delete({
        where: { id: invitationId },
    });
};

export const listInvitationsByTargetId = async (targetIdObject) => {
    const { tournamentId, matchId } = targetIdObject;
    const where = tournamentId ? { tournamentId } : { matchId };
    
    return prisma.invitation.findMany({
        where,
        include: {
            player: true,
            team: true,
        },
        orderBy: { createdAt: "desc" },
    });
};

export const listInvitationsByTournamentId = async (tournamentId) => {
    return prisma.invitation.findMany({
        where: { tournamentId },
        include: {
            player: true,
            team: true,
        },
        orderBy: { createdAt: "desc" },
    });
};
