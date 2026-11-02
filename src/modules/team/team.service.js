import prisma from "../../lib/prisma.js";
import { getRequesterRole, validateRole } from "../../utils/checkUserRole.utils.js";
import {
    parseGeoFilter,
    findLocationsWithinRadius,
    findTeamIdsWithinRadius,
} from "../../utils/geoFilter.utils.js";


/**
 * Team base location from request values.
 * Returns { latitude, longitude } rounded to 2 decimals (~1 km),
 * { latitude: null, longitude: null } when both are null (clear),
 * or null when neither was sent.
 * Throws COORDINATES_INCOMPLETE / INVALID_COORDINATES.
 */
const resolveTeamHome = (latitude, longitude) => {
    if (latitude === undefined && longitude === undefined) return null;
    if (latitude === null && longitude === null) return { latitude: null, longitude: null };

    const home = parseGeoFilter({ latitude, longitude });
    if (!home) throw new Error("COORDINATES_INCOMPLETE"); // e.g. both empty strings

    return {
        latitude: Math.round(home.latitude * 100) / 100,
        longitude: Math.round(home.longitude * 100) / 100,
    };
};


/* =====================
   CREATE TEAM
   ===================== */
// export const createTeam = async ({ name, sportCode, ownerUserId, logo, city }) => {
//     if (!name) throw new Error("TEAM_NAME_REQUIRED");
//     if (!sportCode) throw new Error("SPORT_REQUIRED");

//     return prisma.$transaction(async (tx) => {
//         const team = await tx.team.create({
//             data: {
//                 name,
//                 sportCode, // ✅ direct enum usage
//                 logo: logo || null,
//                 city: city || null,
//             },
//         });

//         // ✅ Add owner as first member
//         if (ownerUserId) {
//             await tx.teamMember.create({
//                 data: {
//                     teamId: team.id,
//                     userId: ownerUserId,
//                     role: "OWNER",
//                 },
//             });
//         }

//         return team;
//     });
// };

export const createTeam = async ({ name, sportCode, ownerUserId, logo, city, latitude, longitude }) => {
    if (!name) throw new Error("TEAM_NAME_REQUIRED");
    if (!sportCode) throw new Error("SPORT_REQUIRED");

    const home = resolveTeamHome(latitude, longitude);

    return prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
            data: {
                name,
                sportCode, // ✅ direct enum usage
                logo: logo || null,
                city: city || null,
                ...(home && { latitude: home.latitude, longitude: home.longitude }),
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

// export const listTeams = async ({
//     city,
//     query,
//     sportCode,
//     page = 1,
//     limit = 20,
//     scope = "all",
//     userId,
// } = {}) => {
//     const andFilters = [];

//     // City filter
//     if (city && city.toLowerCase() !== "null") {
//         andFilters.push({
//             city: { equals: city, mode: "insensitive" },
//         });
//     }

//     // Sport filter
//     if (sportCode && sportCode.toLowerCase() !== "null") {
//         andFilters.push({ sportCode: sportCode.toUpperCase() });
//     }

//     // Name search
//     if (query?.trim()) {
//         andFilters.push({
//             name: { contains: query.trim(), mode: "insensitive" },
//         });
//     }

//     // 👇 Scope filter
//     if (scope === "my") {
//         if (!userId) throw new Error("UNAUTHORIZED");

//         andFilters.push({
//             members: {
//                 some: { userId },
//             },
//         });
//     }

//     const where = andFilters.length ? { AND: andFilters } : {};

//     const skip = (page - 1) * limit;

//     const teams = await prisma.team.findMany({
//         where,
//         include: {
//             members: {
//                 include: {
//                     user: {
//                         select: { id: true, name: true, phone: true, city: true },
//                     },
//                 },
//             },
//             _count: { select: { members: true } },
//         },
//         skip,
//         take: limit,
//         orderBy: { createdAt: "desc" },
//     });

//     const totalCount = await prisma.team.count({ where });

//     return { teams, totalCount };
// };


export const listTeams = async ({
    city,
    query,
    sportCode,
    page = 1,
    limit = 20,
    scope = "all",
    userId,
    location,
    geo = null,
    locationBy = ["home", "venues"],
} = {}) => {
    const andFilters = [];

    // City filter
    if (city && city.toLowerCase() !== "null") {
        andFilters.push({
            city: { equals: city, mode: "insensitive" },
        });
    }

    // Sport filter
    if (sportCode && sportCode.toLowerCase() !== "null") {
        andFilters.push({ sportCode: sportCode.toUpperCase() });
    }

    // Name search
    if (query?.trim()) {
        andFilters.push({
            name: { contains: query.trim(), mode: "insensitive" },
        });
    }

    // 👇 Scope filter
    if (scope === "my") {
        if (!userId) throw new Error("UNAUTHORIZED");

        andFilters.push({
            members: {
                some: { userId },
            },
        });
    }

    /* ------------------
       LOCATION TEXT SEARCH (?location=indiranagar)
       Matches the team's city, or the name / address / city of a venue
       where the team played a match or joined a tournament.
    ------------------ */
    if (location) {
        const venueText = {
            OR: [
                { name: { contains: location, mode: "insensitive" } },
                { address: { contains: location, mode: "insensitive" } },
                { city: { contains: location, mode: "insensitive" } },
            ],
        };

        andFilters.push({
            OR: [
                { city: { contains: location, mode: "insensitive" } },
                { matchParticipants: { some: { match: { location: venueText } } } },
                { tournamentParticipations: { some: { tournament: { locations: { some: venueText } } } } },
            ],
        });
    }

    /* ------------------
       NEARBY FILTER (latitude, longitude, radiusKm, locationBy)
       locationBy is any combination; a team matching ANY chosen mode is returned:
         home   -> the team's own saved base location is inside the radius
         venues -> the team played a match, or joined a tournament, at a venue inside the radius
         city   -> the team's city equals the city of the nearest venue in range
    ------------------ */
    if (geo) {
        const clauses = [];

        const needsVenues = locationBy.includes("venues") || locationBy.includes("city");
        const nearbyLocations = needsVenues ? await findLocationsWithinRadius(prisma, geo) : [];
        const nearbyLocationIds = nearbyLocations.map((l) => l.id);

        if (locationBy.includes("home")) {
            const homeIds = await findTeamIdsWithinRadius(prisma, geo);
            if (homeIds.length) clauses.push({ id: { in: homeIds } });
        }

        if (locationBy.includes("venues") && nearbyLocationIds.length) {
            clauses.push(
                { matchParticipants: { some: { match: { locationId: { in: nearbyLocationIds } } } } },
                { tournamentParticipations: { some: { tournament: { locations: { some: { id: { in: nearbyLocationIds } } } } } } },
            );
        }

        if (locationBy.includes("city")) {
            const nearestCity = nearbyLocations.find((l) => l.city)?.city;
            if (nearestCity) clauses.push({ city: { equals: nearestCity, mode: "insensitive" } });
        }

        // Nothing matched in any chosen mode -> empty result (not "all teams")
        andFilters.push(clauses.length ? { OR: clauses } : { id: { in: [] } });
    }

    const where = andFilters.length ? { AND: andFilters } : {};

    const skip = (page - 1) * limit;

    const teams = await prisma.team.findMany({
        where,
        include: {
            members: {
                include: {
                    user: {
                        select: { id: true, name: true, phone: true, city: true },
                    },
                },
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


// export const updateTeam = async ({
//     teamId,
//     userId,
//     name,
//     logo,
//     city,
// }) => {
//     if (!teamId) throw new Error("TEAM_ID_REQUIRED");

//     const team = await prisma.team.findUnique({
//         where: { id: teamId },
//     });

//     if (!team) {
//         throw new Error("TEAM_NOT_FOUND");
//     }

//     const membership = await prisma.teamMember.findFirst({
//         where: {
//             teamId,
//             userId,
//             role: {
//                 in: ["OWNER", "MANAGER", "CAPTAIN"],
//             },
//         },
//     });

//     if (!membership) {
//         throw new Error("NOT_AUTHORIZED_TO_UPDATE_TEAM");
//     }

//     // ❌ Prevent empty update
//     if (
//         name === undefined &&
//         logo === undefined &&
//         city === undefined
//     ) {
//         throw new Error("NO_FIELDS_TO_UPDATE");
//     }

//     return prisma.team.update({
//         where: { id: teamId },
//         data: {
//             ...(name !== undefined && { name }),
//             ...(logo !== undefined && { logo }),
//             ...(city !== undefined && { city }),
//         },
//     });
// };

export const updateTeam = async ({
    teamId,
    userId,
    name,
    logo,
    city,
    latitude,
    longitude,
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

    const home = resolveTeamHome(latitude, longitude);

    // ❌ Prevent empty update
    if (
        name === undefined &&
        logo === undefined &&
        city === undefined &&
        !home
    ) {
        throw new Error("NO_FIELDS_TO_UPDATE");
    }

    return prisma.team.update({
        where: { id: teamId },
        data: {
            ...(name !== undefined && { name }),
            ...(logo !== undefined && { logo }),
            ...(city !== undefined && { city }),
            ...(home && { latitude: home.latitude, longitude: home.longitude }),
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
