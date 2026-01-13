import prisma from "../../lib/prisma.js";
import { uploadToS3 } from "../../lib/uploadToS3.js";
import { generateCode } from "../../utils/generateCode.utils.js";
import { runKnockoutMatchmaking } from "./matchMaking/index.js";
import { generateNextRound } from "./roundProgression/index.js";

// export const createTournament = async (data) => {
//     return prisma.$transaction(async (tx) => {
//         const tournament = await tx.tournament.create({
//             data: {
//                 name: data.name,
//                 sportCode: data.sportCode,
//                 tournamentType: data.tournamentType,
//                 startDate: new Date(data.startDate),
//                 endDate: data.endDate ? new Date(data.endDate) : null,
//                 scheduleType: data.scheduleType ?? "MANUAL",
//                 isPublic: data.isPublic ?? false,
//                 entryFee: data.entryFee ?? 0,
//                 publicJoinCode: data.isPublic ? generateCode() : null,
//                 matchMakingAt: data.matchMakingAt ?? null, // ✅ NEW

//                 // Location connectOrCreate
//                 location: {
//                     connectOrCreate: {
//                         where: {
//                             name_address: {
//                                 name: data.location.name,
//                                 address: data.location.address,
//                             },
//                         },
//                         create: {
//                             name: data.location.name,
//                             address: data.location.address,
//                             city: data.location.city ?? null,
//                             state: data.location.state ?? null,
//                             country: data.location.country ?? "India",
//                             zipCode: data.location.zipCode ?? null,
//                         },
//                     },
//                 },
//             },
//         });

//         // Rules
//         let rules = null;
//         if (data.rules) {
//             rules = await tx.tournamentRules.create({
//                 data: {
//                     tournamentId: tournament.id,
//                     playAreas: data.rules.playAreas,
//                     partsPerMatch: data.rules.partsPerMatch,
//                     gameType: data.rules.gameType,
//                     maxParticipants: data.rules.maxParticipants, // ✅ NEW
//                     minParticipants: data.rules.minParticipants ?? null, // ✅ NEW
//                     enableQuarterFinal: data.rules.enableQuarterFinal ?? false,
//                     enableSemiFinal: data.rules.enableSemiFinal ?? false,
//                     enableFinal: data.rules.enableFinal ?? true,
//                     daysOfWeek: data.rules.daysOfWeek,
//                 },
//             });
//         }

//         // Reporting slots
//         if (rules && data.reportingSlots?.length) {
//             await tx.reportingSlot.createMany({
//                 data: data.reportingSlots.map((slot) => ({
//                     tournamentRulesId: rules.id,
//                     playArea: slot.playArea,
//                     reportTime: new Date(slot.reportTime),
//                 })),
//             });
//         }

//         return tx.tournament.findUnique({
//             where: { id: tournament.id },
//             include: {
//                 location: true,
//                 rules: {
//                     include: {
//                         reportingSlots: true,
//                     },
//                 },
//             },
//         });
//     });
// };


// export const createTournament = async (data) => {
//     return prisma.$transaction(async (tx) => {
//         /* =====================
//            CREATE TOURNAMENT
//         ===================== */

//         const tournament = await tx.tournament.create({
//             data: {
//                 name: data.name,
//                 sportCode: data.sportCode,
//                 tournamentType: data.tournamentType,
//                 startDate: new Date(data.startDate),
//                 endDate: data.endDate ? new Date(data.endDate) : null,
//                 scheduleType: data.scheduleType ?? "MANUAL",
//                 isPublic: data.isPublic ?? false,
//                 entryFee: data.entryFee ?? 0,
//                 publicJoinCode: data.isPublic ? generateCode() : null,
//                 matchMakingAt: data.matchMakingAt ?? null,

//                 location: {
//                     connectOrCreate: {
//                         where: {
//                             name_address: {
//                                 name: data.location.name,
//                                 address: data.location.address,
//                             },
//                         },
//                         create: {
//                             name: data.location.name,
//                             address: data.location.address,
//                             city: data.location.city ?? null,
//                             state: data.location.state ?? null,
//                             country: data.location.country ?? "India",
//                             zipCode: data.location.zipCode ?? null,
//                         },
//                     },
//                 },
//             },
//         });

//         /* =====================
//            RULES
//         ===================== */

//         let rules = null;

//         if (data.rules) {
//             rules = await tx.tournamentRules.create({
//                 data: {
//                     tournamentId: tournament.id,
//                     playAreas: data.rules.playAreas,
//                     partsPerMatch: data.rules.partsPerMatch,
//                     gameType: data.rules.gameType,
//                     maxParticipants: data.rules.maxParticipants,
//                     minParticipants: data.rules.minParticipants ?? null,
//                     enableQuarterFinal: data.rules.enableQuarterFinal ?? false,
//                     enableSemiFinal: data.rules.enableSemiFinal ?? false,
//                     enableFinal: data.rules.enableFinal ?? true,
//                     daysOfWeek: data.rules.daysOfWeek,
//                 },
//             });
//         }

//         if (rules && data.reportingSlots?.length) {
//             await tx.reportingSlot.createMany({
//                 data: data.reportingSlots.map(slot => ({
//                     tournamentRulesId: rules.id,
//                     playArea: slot.playArea,
//                     reportTime: new Date(slot.reportTime),
//                 })),
//             });
//         }

//         /* =====================
//            ASSETS (LOGO & BANNER)
//         ===================== */

//         const assetCreates = [];

//         if (data.logo) {
//             const logoKey = `public/tournament-${tournament.id}-logo-${Date.now()}`;

//             const logoUrl = await uploadToS3({
//                 buffer: data.logo.buffer,
//                 mimetype: data.logo.mimetype,
//                 key: logoKey,
//             });

//             assetCreates.push({
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 type: "LOGO",
//                 url: logoUrl,
//             });
//         }

//         if (data.banner) {
//             const bannerKey = `public/tournament-${tournament.id}-banner-${Date.now()}`;

//             const bannerUrl = await uploadToS3({
//                 buffer: data.banner.buffer,
//                 mimetype: data.banner.mimetype,
//                 key: bannerKey,
//             });

//             assetCreates.push({
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 type: "BANNER",
//                 url: bannerUrl,
//             });
//         }

//         if (assetCreates.length) {
//             await tx.asset.createMany({ data: assetCreates });
//         }

//         /* =====================
//            RETURN FULL TOURNAMENT
//         ===================== */

//         const assets = await tx.asset.findMany({
//             where: {
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//             },
//         });

//         return {
//             ...tournament,
//             assets: {
//                 logo: assets.find(a => a.type === "LOGO") || null,
//                 banner: assets.find(a => a.type === "BANNER") || null,
//             },
//         };
//     });
// };

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

                location: {
                    connectOrCreate: {
                        where: {
                            name_address: {
                                name: data.location.name,
                                address: data.location.address,
                            },
                        },
                        create: {
                            name: data.location.name,
                            address: data.location.address,
                            city: data.location.city ?? null,
                            state: data.location.state ?? null,
                            country: data.location.country ?? "India",
                            zipCode: data.location.zipCode ?? null,
                        },
                    },
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

    /* =====================
       ASSETS (BEST EFFORT)
    ===================== */

    const assetCreates = [];

    // LOGO
    if (data.logo) {
        try {
            const logoUrl = await uploadToS3({
                buffer: data.logo.buffer,
                mimetype: data.logo.mimetype,
                key: `public/tournament-${tournament.id}-logo-${Date.now()}`,
            });

            assetCreates.push({
                entityType: "TOURNAMENT",
                entityId: tournament.id,
                type: "LOGO",
                url: logoUrl,
            });
        } catch (err) {
            console.error("Logo upload failed:", err.message);
        }
    }

    // BANNER
    if (data.banner) {
        try {
            const bannerUrl = await uploadToS3({
                buffer: data.banner.buffer,
                mimetype: data.banner.mimetype,
                key: `public/tournament-${tournament.id}-banner-${Date.now()}`,
            });

            assetCreates.push({
                entityType: "TOURNAMENT",
                entityId: tournament.id,
                type: "BANNER",
                url: bannerUrl,
            });
        } catch (err) {
            console.error("Banner upload failed:", err.message);
        }
    }

    if (assetCreates.length) {
        await prisma.asset.createMany({ data: assetCreates });
    }

    /* =====================
       RETURN TOURNAMENT + ASSETS
    ===================== */

    const assets = await prisma.asset.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: tournament.id,
        },
    });

    return {
        ...tournament,
        assets: {
            logo: assets.find((a) => a.type === "LOGO") || null,
            banner: assets.find((a) => a.type === "BANNER") || null,
        },
    };
};


export const listTournaments = async () => {
    const tournaments = await prisma.tournament.findMany({
        include: {
            location: true,
            rules: {
                include: {
                    reportingSlots: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    const tournamentIds = tournaments.map(t => t.id);

    const assets = await prisma.asset.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: { in: tournamentIds },
            type: { in: ["LOGO", "BANNER"] },
        },
    });

    const assetMap = {};
    assets.forEach(asset => {
        if (!assetMap[asset.entityId]) {
            assetMap[asset.entityId] = {};
        }
        assetMap[asset.entityId][asset.type] = asset;
    });

    return tournaments.map(tournament => ({
        ...tournament,
        logo: assetMap[tournament.id]?.LOGO || null,
        banner: assetMap[tournament.id]?.BANNER || null,
    }));
};

export const getTournament = async (id) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
            location: true,
            rules: {
                include: {
                    reportingSlots: true,
                },
            },
            participants: true,
            matches: {
                include: {
                    participants: {
                        include: {
                            user: true,
                        },
                    },
                },
            },
        },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    const assets = await prisma.asset.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: id,
        },
    });

    const formattedAssets = {
        logo: assets.find(a => a.type === "LOGO") || null,
        banner: assets.find(a => a.type === "BANNER") || null,
        // others: assets.filter(a => !["LOGO", "BANNER"].includes(a.type)),
    };

    return {
        ...tournament,
        assets: formattedAssets,
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
