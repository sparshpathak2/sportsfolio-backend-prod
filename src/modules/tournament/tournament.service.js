import prisma from "../../lib/prisma.js";
import { uploadToS3 } from "../../lib/uploadToS3.js";
import { generateCode } from "../../utils/generateCode.utils.js";
import { runKnockoutMatchmaking } from "./matchMaking/index.js";
import { generateNextRound } from "./roundProgression/index.js";

export const createTournament = async (data) => {
    /* =====================
       CREATE TOURNAMENT (TRANSACTION)
    ===================== */

    const tournament = await prisma.$transaction(async (tx) => {
        const tournament = await tx.tournament.create({
            data: {
                name: data.name,
                sportCode: data.sportCode,
                tournamentType: data.tournamentType,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null,
                scheduleType: data.scheduleType ?? "MANUAL",
                isPublic: data.isPublic ?? false,
                entryFee: data.entryFee ?? 0,
                publicJoinCode: data.isPublic ? generateCode() : null,
                matchMakingAt: data.matchMakingAt ?? null,
                status: "PUBLISHED",
                logo: data.logoUrl ?? null,
                banner: data.bannerUrl ?? null,
                city: data.city ?? null,
                organizerId: data.organizerId,

                locations: {
                    connectOrCreate: data.locations.map((loc) => ({
                        where: {
                            name_address: {
                                name: loc.name,
                                address: loc.address,
                            },
                        },
                        create: {
                            name: loc.name,
                            address: loc.address,
                            city: loc.city ?? null,
                            state: loc.state ?? null,
                            country: loc.country ?? "India",
                            zipCode: loc.zipCode ?? null,
                        },
                    })),
                },
            },
        });

        if (data.rules) {
            const rules = await tx.tournamentRules.create({
                data: {
                    tournamentId: tournament.id,
                    playAreas: data.rules.playAreas,
                    partsPerMatch: data.rules.partsPerMatch,
                    gameType: data.rules.gameType,
                    maxParticipants: data.rules.maxParticipants,
                    minParticipants: data.rules.minParticipants ?? null,
                    enableQuarterFinal: data.rules.enableQuarterFinal ?? false,
                    enableSemiFinal: data.rules.enableSemiFinal ?? false,
                    enableFinal: data.rules.enableFinal ?? true,
                    daysOfWeek: data.rules.daysOfWeek,
                },
            });

            if (data.reportingSlots?.length) {
                await tx.reportingSlot.createMany({
                    data: data.reportingSlots.map((slot) => ({
                        tournamentRulesId: rules.id,
                        playArea: slot.playArea,
                        reportTime: new Date(slot.reportTime),
                    })),
                });
            }
        }

        return tournament;
    });




    return tournament;
};


// export const listTournaments = async (requesterId = null) => {
//     const tournaments = await prisma.tournament.findMany({
//         include: {
//             locations: true,
//             organizer: true,
//             rules: {
//                 include: {
//                     reportingSlots: true,
//                 },
//             },
//             participants: requesterId
//                 ? {
//                     where: {
//                         OR: [
//                             { playerId: requesterId },
//                             {
//                                 team: {
//                                     members: { some: { userId: requesterId } },
//                                 },
//                             },
//                         ],
//                     },
//                 }
//                 : false,
//             _count: {
//                 select: {
//                     participants: true,
//                 },
//             },
//         },
//         orderBy: {
//             createdAt: "desc",
//         },
//     });

//     return tournaments.map((t) => ({
//         ...t,
//         isOrganizer: requesterId ? t.organizerId === requesterId : false,
//         isParticipant: requesterId ? t.participants.length > 0 : false,
//     }));
// };

export const listTournaments = async ({
    requesterId,
    status,
    scope,
    visibility,
    page,
    limit,
}) => {
    const now = new Date();

    const where = {};

    /* ------------------
       STATUS FILTER
    ------------------ */
    if (status === "upcoming") {
        where.startDate = { gt: now };
    }

    if (status === "ongoing") {
        where.startDate = { lte: now };
        where.OR = [
            { endDate: null },
            { endDate: { gte: now } },
        ];
    }

    if (status === "completed") {
        where.OR = [
            { endDate: { lt: now } },
            { status: "COMPLETED" },
        ];
    }

    /* ------------------
       VISIBILITY FILTER
    ------------------ */
    if (visibility === "public") where.isPublic = true;
    if (visibility === "private") where.isPublic = false;

    /* ------------------
       MY TOURNAMENTS
    ------------------ */
    if (scope === "my" && requesterId) {
        where.OR = [
            { organizerId: requesterId },
            {
                participants: {
                    some: {
                        OR: [
                            { playerId: requesterId },
                            {
                                team: {
                                    members: { some: { userId: requesterId } },
                                },
                            },
                        ],
                    },
                },
            },
            {
                invitations: {
                    some: {
                        playerId: requesterId,
                        status: "ACCEPTED",
                    },
                },
            },
        ];
    }

    /* ------------------
       PAGINATION
    ------------------ */
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        prisma.tournament.findMany({
            where,
            skip,
            take: limit,
            orderBy: { startDate: "asc" },
            include: {
                organizer: true,
                locations: true,
                rules: true,
                participants: requesterId
                    ? {
                        where: {
                            OR: [
                                { playerId: requesterId },
                                {
                                    team: {
                                        members: { some: { userId: requesterId } },
                                    },
                                },
                            ],
                        },
                    }
                    : false,
                _count: {
                    select: { participants: true },
                },
            },
        }),

        prisma.tournament.count({ where }),
    ]);

    return {
        data: items.map(t => ({
            ...t,
            isOrganizer: requesterId ? t.organizerId === requesterId : false,
            isParticipant: requesterId ? t.participants?.length > 0 : false,
        })),
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};


export const getPublicTournaments = async (requesterId = null) => {
    const tournaments = await prisma.tournament.findMany({
        where: {
            isPublic: true,
            status: "PUBLISHED", // Only show active/published ones
        },
        include: {
            locations: true,
            organizer: true,
            rules: {
                include: {
                    reportingSlots: true,
                },
            },
            participants: requesterId
                ? {
                    where: {
                        OR: [
                            { playerId: requesterId },
                            {
                                team: {
                                    members: { some: { userId: requesterId } },
                                },
                            },
                        ],
                    },
                }
                : false,
            _count: {
                select: {
                    participants: true,
                },
            },
        },
        orderBy: {
            startDate: "asc", // Show upcoming ones first
        },
    });

    return tournaments.map((t) => ({
        ...t,
        isOrganizer: requesterId ? t.organizerId === requesterId : false,
        isParticipant: requesterId ? t.participants.length > 0 : false,
    }));
};

export const getMyTournaments = async (userId) => {
    const tournaments = await prisma.tournament.findMany({
        where: {
            organizerId: userId,
        },
        include: {
            locations: true,
            rules: {
                include: {
                    reportingSlots: true,
                },
            },
            participants: {
                where: {
                    OR: [
                        { playerId: userId },
                        {
                            team: {
                                members: { some: { userId: userId } },
                            },
                        },
                    ],
                },
            },
            _count: {
                select: {
                    participants: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return tournaments.map((t) => ({
        ...t,
        isOrganizer: true, // It is my tournament
        isParticipant: t.participants.length > 0,
    }));
};

export const getTournament = async (id, requesterId = null) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
            locations: true,
            rules: {
                include: {
                    reportingSlots: true,
                },
            },
            participants: {
                include: {
                    player: {
                        select: {
                            id: true,
                            name: true,
                            profileImage: true,
                        },
                    },
                    team: {
                        include: {
                            members: true,
                        },
                    },
                },
            },
            matches: {
                include: {
                    participants: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    profileImage: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    // ✅ Virtual fields
    const isOrganizer = requesterId === tournament.organizerId;

    let isParticipant = false;
    if (requesterId) {
        isParticipant = tournament.participants.some((p) => {
            // Check direct player participation
            if (p.playerId === requesterId) return true;
            // Check team participation (if user is in the team)
            if (p.teamId && p.team?.members?.some((m) => m.userId === requesterId)) {
                return true;
            }
            return false;
        });
    }

    return {
        ...tournament,
        isOrganizer,
        isParticipant,
    };
};

export const updateTournament = async (id, data) => {
    const existing = await prisma.tournament.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    if (existing.status === "ONGOING" || existing.status === "COMPLETED") {
        throw new Error("TOURNAMENT_LOCKED");
    }

    if (data.endDate && data.startDate) {
        if (new Date(data.endDate) < new Date(data.startDate)) {
            throw new Error("INVALID_DATE_RANGE");
        }
    }

    return prisma.tournament.update({
        where: { id },
        data: {
            name: data.name,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            status: data.status,
            isPublic: data.isPublic,
            entryFee: data.entryFee,
            scheduleType: data.scheduleType,
            logo: data.logo,
            banner: data.banner,
        },
    });
};


export const deleteTournament = async (id) => {
    const existing = await prisma.tournament.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
        throw new Error("TOURNAMENT_CANNOT_BE_DELETED");
    }

    return prisma.tournament.delete({
        where: { id },
    });
};


export const upsertTournamentRules = async (tournamentId, rules) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    return prisma.tournamentRules.upsert({
        where: { tournamentId },
        update: {
            playAreas: rules.playAreas,
            matchesPerPlayAreaPerDay: rules.matchesPerPlayAreaPerDay,
            reportingTimeMinutes: rules.reportingTimeMinutes,
            partsPerMatch: rules.partsPerMatch,
            gameType: rules.gameType,
            groupsCount: rules.groupsCount,
            teamsPerGroup: rules.teamsPerGroup,
            enableQuarterFinal: rules.enableQuarterFinal,
            enableSemiFinal: rules.enableSemiFinal,
            enableFinal: rules.enableFinal,
            daysOfWeek: rules.daysOfWeek,
            extraConfig: rules.extraConfig,
        },
        create: {
            tournamentId,
            playAreas: rules.playAreas,
            matchesPerPlayAreaPerDay: rules.matchesPerPlayAreaPerDay,
            reportingTimeMinutes: rules.reportingTimeMinutes,
            partsPerMatch: rules.partsPerMatch,
            gameType: rules.gameType,
            groupsCount: rules.groupsCount,
            teamsPerGroup: rules.teamsPerGroup,
            enableQuarterFinal: rules.enableQuarterFinal,
            enableSemiFinal: rules.enableSemiFinal,
            enableFinal: rules.enableFinal,
            daysOfWeek: rules.daysOfWeek,
            extraConfig: rules.extraConfig,
        },
    });
};


export const runMatchmaking = async (tournamentId) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            rules: true,
            participants: true,
        },
    });

    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (tournament.status !== "PUBLISHED") throw new Error("INVALID_STATE");

    if (tournament.tournamentType === "KNOCKOUT") {
        return runKnockoutMatchmaking(tournament);
    }

    throw new Error("UNSUPPORTED_TOURNAMENT_TYPE");
};

export const advanceRound = async (tournamentId) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
            id: true,
            status: true,
            tournamentType: true,
        },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    if (tournament.status !== "ONGOING") {
        throw new Error("INVALID_STATE");
    }

    if (tournament.tournamentType === "KNOCKOUT") {
        return generateNextRound(tournamentId);
    }

    throw new Error("UNSUPPORTED_TOURNAMENT_TYPE");
};
