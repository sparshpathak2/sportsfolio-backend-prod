import prisma from "../lib/prisma.js";
import { TeamMemberRole } from "@prisma/client";

export const VALID_ROLES = Object.values(TeamMemberRole);

export const validateRole = (role) => {
    if (!VALID_ROLES.includes(role)) {
        throw new Error("INVALID_TEAM_MEMBER_ROLE");
    }
};


export const getRequesterRole = async ({ teamId, userId }) => {
    const member = await prisma.teamMember.findUnique({
        where: {
            teamId_userId: { teamId, userId },
        },
    });

    if (!member) throw new Error("NOT_A_TEAM_MEMBER");

    return member.role;
};
