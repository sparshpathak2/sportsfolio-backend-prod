import prisma from "../../lib/prisma.js";

// export const createInvitation = async ({ type, playerId, teamId, tournamentId, matchId }) => {
//     // Validate type
//     if (!["PLAYER", "TEAM"].includes(type)) throw new Error("INVALID_INVITATION_TYPE");

//     // 🆕 NEW: Prevent ambiguous target (tournament + match together)
//     if (tournamentId && matchId) {
//         throw new Error("INVITATION_TARGET_CONFLICT");
//     }

//     // 🆕 NEW: Prevent mixed IDs
//     if (type === "PLAYER" && teamId) {
//         throw new Error("TEAM_ID_NOT_ALLOWED_FOR_PLAYER_INVITE");
//     }

//     if (type === "TEAM" && playerId) {
//         throw new Error("PLAYER_ID_NOT_ALLOWED_FOR_TEAM_INVITE");
//     }

//     let targetGameType;
//     let sportCode;

//     // Check target and get gameType
//     if (tournamentId) {
//         const tournament = await prisma.tournament.findUnique({
//             where: { id: tournamentId },
//             include: { rules: true, participants: true },
//         });
//         if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//         if (!tournament.rules || !tournament.rules.gameType) throw new Error("TOURNAMENT_RULES_NOT_SET");

//         targetGameType = tournament.rules.gameType;
//         sportCode = tournament.sportCode;

//         // If it's doubles, player invitations are not allowed
//         if (targetGameType === "DOUBLES" && type === "PLAYER") {
//             throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
//         }

//         // If it's doubles and type is TEAM, auto-create a team if teamId not provided
//         if (type === "TEAM" && !teamId) {
//             const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;
//             const newTeamName = `Team ${existingTeamsCount + 1}`;

//             const newTeam = await prisma.team.create({
//                 data: {
//                     name: newTeamName,
//                     sportCode: tournament.sportCode,
//                     isTemporary: true, // Mark as temporary since it's auto-created
//                 },
//             });

//             teamId = newTeam.id;
//         }

//     }

//     if (matchId) {
//         const match = await prisma.match.findUnique({ where: { id: matchId } });
//         if (!match) throw new Error("MATCH_NOT_FOUND");
//         if (!match.gameType) throw new Error("MATCH_GAME_TYPE_NOT_SET");

//         targetGameType = match.gameType;

//         // Only allow team invites for doubles
//         if (type === "TEAM" && targetGameType === "SINGLES") {
//             throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
//         }

//         // Player invites not allowed for doubles
//         if (type === "PLAYER" && targetGameType === "DOUBLES") {
//             throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
//         }
//     }

//     // Validate IDs
//     if (type === "PLAYER" && !playerId) throw new Error("PLAYER_ID_REQUIRED");
//     if (type === "TEAM" && !teamId) throw new Error("TEAM_ID_REQUIRED");

//     // Prevent duplicate invitation
//     const existing = await prisma.invitation.findFirst({
//         where: {
//             tournamentId,
//             matchId,
//             playerId,
//             teamId,
//             status: "PENDING",
//         },
//     });

//     if (existing) throw new Error("INVITATION_ALREADY_EXISTS");

//     // Create invitation
//     return prisma.invitation.create({
//         data: { type, playerId, teamId, tournamentId, matchId },
//     });
// };

// export const createInvitation = async ({ type, playerId, teamId, tournamentId, matchId }) => {
//     // Validate type
//     if (!["PLAYER", "TEAM"].includes(type)) {
//         throw new Error("INVALID_INVITATION_TYPE");
//     }

//     // 🆕 NEW: Prevent ambiguous target
//     if (tournamentId && matchId) {
//         throw new Error("INVITATION_TARGET_CONFLICT");
//     }

//     // 🆕 NEW: Prevent mixed identifiers
//     if (type === "PLAYER" && teamId) {
//         throw new Error("TEAM_ID_NOT_ALLOWED_FOR_PLAYER_INVITE");
//     }

//     if (type === "TEAM" && playerId) {
//         throw new Error("PLAYER_ID_NOT_ALLOWED_FOR_TEAM_INVITE");
//     }

//     let targetGameType;
//     let sportCode;

//     /* ======================
//        TOURNAMENT INVITES
//        ====================== */
//     if (tournamentId) {
//         const tournament = await prisma.tournament.findUnique({
//             where: { id: tournamentId },
//             include: { rules: true, participants: true },
//         });

//         console.log("tournament at createInvitation:", tournament)

//         if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//         if (!tournament.rules?.gameType) throw new Error("TOURNAMENT_RULES_NOT_SET");

//         targetGameType = tournament.rules.gameType;
//         sportCode = tournament.sportCode;

//         /* 🔥 OPTION 1 CORE LOGIC 🔥
//            DOUBLES + PLAYER → AUTO TEAM + USER INVITE
//         */
//         if (targetGameType === "DOUBLES" && type === "PLAYER") {
//             // 🆕 NEW: Auto-create temp team
//             const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;

//             const tempTeam = await prisma.team.create({
//                 data: {
//                     name: `Team ${existingTeamsCount + 1}`,
//                     sportCode,
//                     isTemporary: true,
//                 },
//             });

//             // 🆕 NEW: Attach player to temp team (pending via invite)
//             teamId = tempTeam.id;
//         }

//         /* TEAM invite to tournament (existing behavior) */
//         if (targetGameType === "DOUBLES" && type === "TEAM" && !teamId) {
//             const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;

//             const tempTeam = await prisma.team.create({
//                 data: {
//                     name: `Team ${existingTeamsCount + 1}`,
//                     sportCode,
//                     isTemporary: true,
//                 },
//             });

//             teamId = tempTeam.id;
//         }

//         if (targetGameType === "SINGLES" && type === "TEAM") {
//             throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
//         }
//     }

//     /* ======================
//        MATCH INVITES (QUICK MATCH)
//        ====================== */
//     if (matchId) {
//         const match = await prisma.match.findUnique({ where: { id: matchId } });

//         if (!match) throw new Error("MATCH_NOT_FOUND");
//         if (!match.gameType) throw new Error("MATCH_GAME_TYPE_NOT_SET");

//         targetGameType = match.gameType;

//         if (targetGameType === "SINGLES" && type === "TEAM") {
//             throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
//         }

//         if (targetGameType === "DOUBLES" && type === "PLAYER") {
//             throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
//         }
//     }

//     // Final validation
//     if (type === "PLAYER" && !playerId) throw new Error("PLAYER_ID_REQUIRED");
//     if (type === "TEAM" && !teamId) throw new Error("TEAM_ID_REQUIRED");

//     // Prevent duplicate invitation
//     const existing = await prisma.invitation.findFirst({
//         where: {
//             tournamentId,
//             matchId,
//             playerId,
//             teamId,
//             status: "PENDING",
//         },
//     });

//     if (existing) throw new Error("INVITATION_ALREADY_EXISTS");

//     // Create invitation
//     return prisma.invitation.create({
//         data: {
//             type,
//             playerId,   // ✅ USER is the recipient
//             teamId,     // ✅ TEAM is auto-managed
//             tournamentId,
//             matchId,
//         },
//     });
// };

export const createInvitation = async ({
    type,
    playerId,
    teamId,
    tournamentId,
    matchId,
}) => {
    /* ======================
       BASIC VALIDATIONS
       ====================== */
    if (!["PLAYER", "TEAM"].includes(type)) {
        throw new Error("INVALID_INVITATION_TYPE");
    }

    if (tournamentId && matchId) {
        throw new Error("INVITATION_TARGET_CONFLICT");
    }

    if (!tournamentId && !matchId) {
        throw new Error("TARGET_REQUIRED");
    }

    /* ======================
       TARGET RESOLUTION
       ====================== */
    let targetGameType;
    let sportCode;

    if (tournamentId) {
        const tournament = await prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                rules: true,
                participants: true,
            },
        });

        if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
        if (!tournament.rules?.gameType) throw new Error("TOURNAMENT_RULES_NOT_SET");

        targetGameType = tournament.rules.gameType;
        sportCode = tournament.sportCode;

        /* DOUBLES + PLAYER → AUTO TEMP TEAM */
        if (targetGameType === "DOUBLES" && type === "PLAYER") {
            if (!playerId) throw new Error("PLAYER_ID_REQUIRED");

            const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;

            const tempTeam = await prisma.team.create({
                data: {
                    name: `Team ${existingTeamsCount + 1}`,
                    sportCode,
                    isTemporary: true,
                },
            });

            teamId = tempTeam.id;
        }

        /* DOUBLES + TEAM (NO TEAM PROVIDED) → AUTO TEAM */
        if (targetGameType === "DOUBLES" && type === "TEAM" && !teamId) {
            const existingTeamsCount = tournament.participants.filter(p => p.teamId).length;

            const tempTeam = await prisma.team.create({
                data: {
                    name: `Team ${existingTeamsCount + 1}`,
                    sportCode,
                    isTemporary: true,
                },
            });

            teamId = tempTeam.id;
        }

        if (targetGameType === "SINGLES" && type === "TEAM") {
            throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
        }
    }

    if (matchId) {
        const match = await prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match) throw new Error("MATCH_NOT_FOUND");
        if (!match.gameType) throw new Error("MATCH_GAME_TYPE_NOT_SET");

        targetGameType = match.gameType;

        if (targetGameType === "SINGLES" && type === "TEAM") {
            throw new Error("TEAM_INVITATION_NOT_ALLOWED_FOR_SINGLES");
        }

        if (targetGameType === "DOUBLES" && type === "PLAYER") {
            throw new Error("PLAYER_INVITATION_NOT_ALLOWED_FOR_DOUBLES");
        }
    }

    /* ======================
       FINAL REQUIRED CHECKS
       ====================== */
    if (type === "PLAYER" && !playerId) {
        throw new Error("PLAYER_ID_REQUIRED");
    }

    if (type === "TEAM" && !teamId) {
        throw new Error("TEAM_ID_REQUIRED");
    }

    /* ======================
       DUPLICATE PREVENTION
       ====================== */
    const existing = await prisma.invitation.findFirst({
        where: {
            tournamentId,
            matchId,
            playerId: type === "PLAYER" ? playerId : undefined,
            teamId: type === "TEAM" ? teamId : undefined,
            status: "PENDING",
        },
    });

    if (existing) throw new Error("INVITATION_ALREADY_EXISTS");

    /* ======================
       SAFE CREATE (🔥 FIX)
       ====================== */
    /* ======================
   FK-SAFE CREATE
   ====================== */
    const data = {
        type,
        tournamentId,
        matchId,
    };

    if (type === "PLAYER") {
        const userExists = await prisma.user.findUnique({
            where: { id: playerId },
            select: { id: true },
        });

        if (!userExists) {
            throw new Error("PLAYER_NOT_FOUND");
        }

        data.playerId = playerId;
        data.teamId = teamId ?? null;
    }

    if (type === "TEAM") {
        data.teamId = teamId;
    }

    return prisma.invitation.create({ data });

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

        // 🔐 USER is ALWAYS the acceptor
        if (invite.playerId !== userId) {
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


export const listInvitationsByTargetId = async ({ tournamentId, matchId }) => {
    const where = tournamentId ? { tournamentId } : { matchId };

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
