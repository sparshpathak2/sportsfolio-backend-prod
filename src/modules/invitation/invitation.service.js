import prisma from "../../lib/prisma.js";
import { TeamMemberRole } from "@prisma/client";

const generateTempTeamName = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    return `T-${hh}${mm}${ss}`;
};

export const createInvitation = async ({
    type,
    playerId,
    invitedTeamId,
    tournamentId,
    matchId,
    targetTeamId,
}) => {
    if (!["PLAYER", "TEAM"].includes(type)) {
        throw new Error("INVALID_INVITATION_TYPE");
    }

    const targets = [tournamentId, matchId, targetTeamId].filter(Boolean);
    if (targets.length !== 1) {
        throw new Error("INVALID_INVITATION_TARGET");
    }

    let teamId = null;

    /* ======================================================
       PLAYER → TEAM
       ====================================================== */
    if (type === "PLAYER" && targetTeamId) {
        if (!playerId) throw new Error("PLAYER_ID_REQUIRED");

        const existingInvite = await prisma.invitation.findFirst({
            where: {
                type: "PLAYER",
                playerId,
                targetTeamId,
                status: "PENDING",
            },
        });

        if (existingInvite) {
            throw new Error("PLAYER_ALREADY_INVITED_TO_TEAM");
        }

        const alreadyMember = await prisma.teamMember.findFirst({
            where: {
                teamId: targetTeamId,
                userId: playerId,
            },
        });

        if (alreadyMember) {
            throw new Error("PLAYER_ALREADY_IN_TEAM");
        }
    }

    /* ======================================================
       TOURNAMENT CONTEXT
       ====================================================== */
    if (tournamentId) {
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: { rules: true },
        });

        if (!tournament || !tournament.rules?.gameType) {
            throw new Error("TOURNAMENT_RULES_NOT_SET");
        }

        const gameType = tournament.rules.gameType;

        /* =====================
           PLAYER → TOURNAMENT
           ===================== */
        if (type === "PLAYER") {
            if (!playerId) throw new Error("PLAYER_ID_REQUIRED");

            const existingInvite = await prisma.invitation.findFirst({
                where: {
                    type: "PLAYER",
                    tournamentId,
                    playerId,
                    status: "PENDING",
                },
            });

            if (existingInvite) {
                throw new Error("PLAYER_ALREADY_INVITED_TO_TOURNAMENT");
            }

            const alreadyParticipant =
                await prisma.tournamentParticipant.findFirst({
                    where: {
                        tournamentId,
                        OR: [
                            { playerId },
                            {
                                team: {
                                    members: {
                                        some: { userId: playerId },
                                    },
                                },
                            },
                        ],
                    },
                });

            if (alreadyParticipant) {
                throw new Error("PLAYER_ALREADY_IN_TOURNAMENT");
            }

            if (gameType === "DOUBLES") {
                const tempTeam = await prisma.team.create({
                    data: {
                        name: generateTempTeamName(),
                        sportCode: tournament.sportCode,
                        isTemporary: true,
                    },
                });

                await prisma.teamMember.create({
                    data: {
                        teamId: tempTeam.id,
                        userId: playerId,
                        role: "OWNER",
                    },
                });

                teamId = tempTeam.id;
            }
        }

        /* =====================
           TEAM → TOURNAMENT
           ===================== */
        if (type === "TEAM") {
            // 🔥 OLD behavior: playerId present → temp team
            if (playerId) {
                const tempTeam = await prisma.team.create({
                    data: {
                        name: generateTempTeamName(),
                        sportCode: tournament.sportCode,
                        isTemporary: true,
                    },
                });

                await prisma.teamMember.create({
                    data: {
                        teamId: tempTeam.id,
                        userId: playerId,
                        role: "OWNER",
                    },
                });

                teamId = tempTeam.id;
            } else {
                if (!invitedTeamId) throw new Error("TEAM_ID_REQUIRED");

                // ✅ FIX: prevent multiple invites
                const existingInvite = await prisma.invitation.findFirst({
                    where: {
                        type: "TEAM",
                        tournamentId,
                        teamId: invitedTeamId,
                        status: "PENDING",
                    },
                });

                if (existingInvite) {
                    throw new Error("TEAM_ALREADY_INVITED_TO_TOURNAMENT");
                }

                const alreadyParticipant =
                    await prisma.tournamentParticipant.findFirst({
                        where: {
                            tournamentId,
                            teamId: invitedTeamId,
                        },
                    });

                if (alreadyParticipant) {
                    throw new Error("TEAM_ALREADY_IN_TOURNAMENT");
                }

                teamId = invitedTeamId;
            }
        }
    }

    /* ======================================================
       MATCH → PLAYER
       ====================================================== */
    if (matchId && type === "PLAYER") {
        if (!playerId) throw new Error("PLAYER_ID_REQUIRED");

        const existingInvite = await prisma.invitation.findFirst({
            where: {
                type: "PLAYER",
                matchId,
                playerId,
                status: "PENDING",
            },
        });

        if (existingInvite) {
            throw new Error("PLAYER_ALREADY_INVITED_TO_MATCH");
        }
    }

    /* ======================================================
       CREATE INVITATION
       ====================================================== */
    return prisma.invitation.create({
        data: {
            type,
            playerId: type === "PLAYER" ? playerId : playerId ?? null,
            teamId,
            tournamentId,
            matchId,
            targetTeamId,
            status: "PENDING",
        },
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

        /* ================= AUTH ================= */

        if (invite.type === "PLAYER" && invite.playerId !== userId) {
            throw new Error("NOT_AUTHORIZED");
        }

        if (invite.type === "TEAM") {
            const admin = await tx.teamMember.findFirst({
                where: {
                    teamId: invite.teamId,
                    userId,
                    role: {
                        in: [
                            TeamMemberRole.OWNER,
                            TeamMemberRole.MANAGER,
                            TeamMemberRole.CAPTAIN,
                        ],
                    },
                },
            });
            if (!admin) {
                throw new Error("ONLY_TEAM_ADMIN_CAN_ACCEPT");
            }
        }

        /* ================= TOURNAMENT ================= */

        if (invite.tournamentId) {
            const gameType = invite.tournament.rules.gameType;

            if (invite.type === "PLAYER") {
                if (gameType === "SINGLES") {
                    await tx.tournamentParticipant.create({
                        data: {
                            tournamentId: invite.tournamentId,
                            playerId: userId,
                        },
                    });
                }

                if (gameType === "DOUBLES") {
                    if (!invite.teamId) {
                        throw new Error("TEMP_TEAM_MISSING");
                    }

                    await tx.teamMember.create({
                        data: {
                            teamId: invite.teamId,
                            userId,
                            role: "PLAYER",
                        },
                    });

                    await tx.tournamentParticipant.create({
                        data: {
                            tournamentId: invite.tournamentId,
                            teamId: invite.teamId,
                        },
                    });
                }
            }

            if (invite.type === "TEAM") {
                await tx.tournamentParticipant.create({
                    data: {
                        tournamentId: invite.tournamentId,
                        teamId: invite.teamId,
                    },
                });
            }
        }

        /* ================= MATCH ================= */

        if (invite.matchId && invite.type === "PLAYER") {
            await tx.matchParticipant.create({
                data: {
                    matchId: invite.matchId,
                    userId,
                },
            });
        }

        /* ================= PLAYER → TEAM ================= */

        if (invite.targetTeamId && invite.type === "PLAYER") {
            await tx.teamMember.create({
                data: {
                    teamId: invite.targetTeamId,
                    userId,
                    role: "PLAYER",
                },
            });
        }

        /* ================= FINALIZE ================= */

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
    const where = { playerId: userId };

    const [data, count] = await Promise.all([
        prisma.invitation.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                tournament: {
                    include: {
                        locations: true,
                    },
                },
                team: true,
            },
        }),
        prisma.invitation.count({ where }),
    ]);

    return { data, count };
};

export const declineInvitation = async (invitationId, userId) => {
    const invite = await prisma.invitation.findUnique({
        where: { id: invitationId },
    });

    if (!invite || invite.status !== "PENDING") {
        throw new Error("INVALID_INVITATION");
    }

    // Only the invited player or team admin can decline
    if (invite.type === "PLAYER" && invite.playerId !== userId) {
        throw new Error("NOT_AUTHORIZED_TO_DECLINE");
    }

    if (invite.type === "TEAM") {
        const membership = await prisma.teamMember.findFirst({
            where: {
                teamId: invite.teamId,
                userId,
                role: {
                    in: ["OWNER", "CAPTAIN", "MANAGER"],
                },
            },
        });

        if (!membership) {
            throw new Error("ONLY_TEAM_ADMIN_CAN_DECLINE");
        }
    }

    return prisma.invitation.update({
        where: { id: invitationId },
        data: { status: "DECLINED" },
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


// export const listInvitationsByTargetId = async ({ tournamentId, matchId }) => {
//     const where = tournamentId ? { tournamentId } : { matchId };

//     const [data, count] = await Promise.all([
//         prisma.invitation.findMany({
//             where,
//             include: {
//                 player: true,
//                 team: true,
//             },
//             orderBy: { createdAt: "desc" },
//         }),
//         prisma.invitation.count({ where }),
//     ]);

//     return { data, count };
// };

export const listInvitationsByTargetId = async ({
    tournamentId,
    matchId,
    teamId,
}) => {
    const where =
        tournamentId
            ? { tournamentId }
            : matchId
                ? { matchId }
                : { targetTeamId: teamId };

    const [data, count] = await Promise.all([
        prisma.invitation.findMany({
            where,
            include: {
                player: true,
                team: true,
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.invitation.count({ where }),
    ]);

    return { data, count };
};
