import prisma from "../../lib/prisma.js";
import { getRequesterRole, validateRole } from "../../utils/checkUserRole.utils.js";

/* =====================
   CREATE TEAM
   ===================== */
export const createTeam = async ({ name, sportCode, ownerUserId, logo, city }) => {
    if (!name) throw new Error("TEAM_NAME_REQUIRED");
    if (!sportCode) throw new Error("SPORT_REQUIRED");

    return prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
            data: {
                name,
                sportCode, // ✅ direct enum usage
                logo: logo || null,
                city: city || null,
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
// export const listTeams = async ({ sportCode }) => {
//     return prisma.team.findMany({
//         where: sportCode
//             ? { sportCode } // enum filter
//             : {},
//         include: {
//             members: {
//                 include: {
//                     user: {
//                         select: {
//                             id: true,
//                             name: true,
//                             phone: true,
//                             city: true,
//                         },
//                     },
//                 },
//             },
//             _count: {
//                 select: {
//                     members: true,
//                 },
//             },
//         },
//         orderBy: {
//             createdAt: "desc",
//         },
//     });
// };

// export const listTeams = async ({ sportCode } = {}) => {
//     const where = {};

//     if (sportCode && sportCode.toLowerCase() !== "null") {
//         where.sportCode = sportCode.toUpperCase(); // normalize enum
//     }

//     return prisma.team.findMany({
//         where,
//         include: {
//             members: {
//                 include: {
//                     user: {
//                         select: {
//                             id: true,
//                             name: true,
//                             phone: true,
//                             city: true,
//                         },
//                     },
//                 },
//             },
//             _count: { select: { members: true } },
//         },
//         orderBy: { createdAt: "desc" },
//     });
// };

export const listTeams = async ({ city, query, sportCode, page = 1, limit = 20 } = {}) => {
    const andFilters = [];

    // City filter - case-insensitive
    if (city && city.toLowerCase() !== "null") {
        andFilters.push({
            city: {
                equals: city,
                mode: "insensitive"
            }
        });
    }

    // SportCode filter
    if (sportCode && sportCode.toLowerCase() !== "null") {
        andFilters.push({ sportCode: sportCode.toUpperCase() });
    }

    // Search query filter
    const searchQuery = query?.trim();
    if (searchQuery && searchQuery.toLowerCase() !== "null") {
        andFilters.push({ name: { contains: searchQuery, mode: "insensitive" } });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};

    const skip = (page - 1) * limit;

    const teams = await prisma.team.findMany({
        where,
        include: {
            members: {
                include: { user: { select: { id: true, name: true, phone: true, city: true } } },
            },
            _count: { select: { members: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    const totalCount = await prisma.team.count({ where });

    return { teams, totalCount };
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


export const updateTeam = async ({
    teamId,
    userId,
    name,
    logo,
    city,
}) => {
    if (!teamId) throw new Error("TEAM_ID_REQUIRED");

    const team = await prisma.team.findUnique({
        where: { id: teamId },
    });

    if (!team) {
        throw new Error("TEAM_NOT_FOUND");
    }

    const membership = await prisma.teamMember.findFirst({
        where: {
            teamId,
            userId,
            role: {
                in: ["OWNER", "MANAGER", "CAPTAIN"],
            },
        },
    });

    if (!membership) {
        throw new Error("NOT_AUTHORIZED_TO_UPDATE_TEAM");
    }

    // ❌ Prevent empty update
    if (
        name === undefined &&
        logo === undefined &&
        city === undefined
    ) {
        throw new Error("NO_FIELDS_TO_UPDATE");
    }

    return prisma.team.update({
        where: { id: teamId },
        data: {
            ...(name !== undefined && { name }),
            ...(logo !== undefined && { logo }),
            ...(city !== undefined && { city }),
        },
    });
};

export const deleteTeam = async (teamId, userId) => {
    return prisma.$transaction(async (tx) => {
        // Check if team exists
        const team = await tx.team.findUnique({ where: { id: teamId } });
        if (!team) throw new Error("TEAM_NOT_FOUND");

        // Check if user is OWNER
        const owner = await tx.teamMember.findFirst({
            where: { teamId, userId, role: "OWNER" },
        });
        if (!owner) throw new Error("ONLY_OWNER_CAN_DELETE");

        // Optional: prevent deleting temporary teams
        if (team.isTemporary) throw new Error("CANNOT_DELETE_TEMP_TEAM");

        // Delete team members
        await tx.teamMember.deleteMany({ where: { teamId } });

        // Delete related invitations
        await tx.invitation.deleteMany({ where: { teamId } });

        // Delete tournament participants for this team
        await tx.tournamentParticipant.deleteMany({ where: { teamId } });

        // Delete the team itself
        return tx.team.delete({ where: { id: teamId } });
    });
};


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

export const removeTeamMember = async ({ teamId, userId, requestedByUserId }) => {
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
