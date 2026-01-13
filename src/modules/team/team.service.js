import prisma from "../../lib/prisma.js";
import { getRequesterRole, validateRole } from "../../utils/checkUserRole.utils.js";

/* =====================
   CREATE TEAM
   ===================== */
export const createTeam = async ({ name, sportCode, ownerUserId }) => {
    if (!name) throw new Error("TEAM_NAME_REQUIRED");
    if (!sportCode) throw new Error("SPORT_REQUIRED");

    return prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
            data: {
                name,
                sportCode, // ✅ direct enum usage
            },
        });

        // ✅ Add owner as first member
        if (ownerUserId) {
            await tx.teamMember.create({
                data: {
                    teamId: team.id,
                    userId: ownerUserId,
                    role: "OWNER",
                },
            });
        }

        return team;
    });
};


/* =====================
   LIST TEAMS
   ===================== */
export const listTeams = async ({ sportCode }) => {
    return prisma.team.findMany({
        where: sportCode
            ? { sportCode } // enum filter
            : {},
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            city: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    members: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};


/* =====================
   GET TEAM
   ===================== */

export const getTeamById = async (id) => {
    if (!id) throw new Error("TEAM_ID_REQUIRED");

    const team = await prisma.team.findUnique({
        where: { id },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            city: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    members: true,
                },
            },
        },
    });

    if (!team) throw new Error("TEAM_NOT_FOUND");

    return team;
};



// export const joinTeam = async ({ teamId, userId }) => {
//     if (!teamId || !userId) {
//         throw new Error("TEAM_ID_AND_USER_ID_REQUIRED");
//     }

//     const existing = await prisma.teamMember.findUnique({
//         where: {
//             teamId_userId: { teamId, userId },
//         },
//     });

//     if (existing) {
//         throw new Error("ALREADY_TEAM_MEMBER");
//     }

//     return prisma.teamMember.create({
//         data: {
//             teamId,
//             userId,
//             role: "PLAYER",
//         },
//     });
// };


// export const joinTeam = async ({ teamId, userId }) => {
//     if (!teamId || !userId) {
//         throw new Error("TEAM_ID_AND_USER_ID_REQUIRED");
//     }

//     // 1️⃣ Check if user is already a team member
//     const existingMember = await prisma.teamMember.findUnique({
//         where: { teamId_userId: { teamId, userId } },
//     });

//     if (existingMember) {
//         throw new Error("ALREADY_TEAM_MEMBER");
//     }

//     // 2️⃣ Check if the user has a pending invitation for this team
//     const invitation = await prisma.tournamentInvitation.findFirst({
//         where: {
//             teamId,
//             playerId: userId,
//             status: "PENDING",
//         },
//     });

//     if (!invitation) {
//         throw new Error("NO_PENDING_INVITATION");
//     }

//     // 3️⃣ Add the user as a team member and update the invitation in a transaction
//     const [member, updatedInvitation] = await prisma.$transaction([
//         prisma.teamMember.create({
//             data: {
//                 teamId,
//                 userId,
//                 role: "PLAYER",
//             },
//         }),
//         prisma.tournamentInvitation.update({
//             where: { id: invitation.id },
//             data: { status: "ACCEPTED" },
//         }),
//     ]);

//     return {
//         member,
//         invitation: updatedInvitation,
//     };
// };


// export const removeTeamMember = async ({ teamId, userId }) => {
//     return prisma.teamMember.delete({
//         where: {
//             teamId_userId: {
//                 teamId,
//                 userId,
//             },
//         },
//     });
// };

export const joinTeam = async ({ teamId, userId }) => {
    if (!teamId || !userId) {
        throw new Error("TEAM_ID_AND_USER_ID_REQUIRED");
    }

    // 1️⃣ Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
        where: {
            teamId_userId: {
                teamId,
                userId,
            },
        },
    });

    if (existingMember) {
        throw new Error("ALREADY_TEAM_MEMBER");
    }

    // 2️⃣ Check pending TEAM invitation
    const invitation = await prisma.invitation.findFirst({
        where: {
            teamId,
            playerId: userId,
            type: "TEAM",
            status: "PENDING",
        },
    });

    if (!invitation) {
        throw new Error("NO_PENDING_TEAM_INVITATION");
    }

    // 3️⃣ Accept invitation + add member (atomic)
    const [member, updatedInvitation] = await prisma.$transaction([
        prisma.teamMember.create({
            data: {
                teamId,
                userId,
                role: "PLAYER",
            },
        }),
        prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: "ACCEPTED" },
        }),
    ]);

    return {
        member,
        invitation: updatedInvitation,
    };
};


export const removeTeamMember = async ({
    teamId,
    userId,
    requestedByUserId,
}) => {
    const requesterRole = await getRequesterRole({
        teamId,
        userId: requestedByUserId,
    });

    if (!["OWNER", "MANAGER"].includes(requesterRole)) {
        throw new Error("NOT_AUTHORIZED_TO_REMOVE_MEMBER");
    }

    const memberToRemove = await prisma.teamMember.findUnique({
        where: {
            teamId_userId: { teamId, userId },
        },
    });

    if (!memberToRemove) throw new Error("TEAM_MEMBER_NOT_FOUND");

    if (memberToRemove.role === "OWNER") {
        throw new Error("CANNOT_REMOVE_TEAM_OWNER");
    }

    return prisma.teamMember.delete({
        where: {
            teamId_userId: { teamId, userId },
        },
    });
};


export const listTeamMembers = async (teamId) => {
    return prisma.teamMember.findMany({
        where: { teamId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    city: true,
                },
            },
        },
    });
};
