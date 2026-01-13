import prisma from "../../lib/prisma.js";

export const createSport = async ({ code, name }) => {
    // Prevent duplicate sport codes
    const existing = await prisma.sport.findUnique({
        where: { code },
    });

    if (existing) {
        throw new Error("SPORT_CODE_ALREADY_EXISTS");
    }

    return prisma.sport.create({
        data: {
            code,
            name,
        },
    });
};

export const listSports = async () => {
    return prisma.sport.findMany({
        orderBy: {
            createdAt: "asc",
        },
    });
};

export const getSportById = async (id) => {
    return prisma.sport.findUnique({
        where: { id },
        include: {
            teams: true,
            profiles: true,
        },
    });
};

export const updateSport = async (id, { name }) => {
    const sport = await prisma.sport.findUnique({
        where: { id },
    });

    if (!sport) {
        throw new Error("SPORT_NOT_FOUND");
    }

    return prisma.sport.update({
        where: { id },
        data: {
            ...(name && { name }),
        },
    });
};

export const deleteSport = async (id) => {
    const sport = await prisma.sport.findUnique({
        where: { id },
    });

    if (!sport) {
        throw new Error("SPORT_NOT_FOUND");
    }

    // Optional: prevent delete if teams exist
    const teamsCount = await prisma.team.count({
        where: { sportId: id },
    });

    if (teamsCount > 0) {
        throw new Error("SPORT_HAS_TEAMS");
    }

    return prisma.sport.delete({
        where: { id },
    });
};
