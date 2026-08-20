import prisma from "../../lib/prisma.js";
import { uploadToS3 } from "../../lib/uploadToS3.js";
import { generateCode } from "../../utils/generateCode.utils.js";
import { runKnockoutMatchmaking } from "./matchMaking/index.js";
import { generateNextRound } from "./roundProgression/index.js";
import { triggerTournamentMatchmaking } from "../scheduler/scheduler.service.js";

// Add this import at the top
import { addPersonnel } from "../personnel/personnel.service.js";

// Update createTournament function
// export const createTournament = async (data) => {
//     /* =====================
//        CREATE TOURNAMENT (TRANSACTION)
//     ===================== */

//     const tournament = await prisma.$transaction(async (tx) => {
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
//                 status: "PUBLISHED",
//                 logo: data.logoUrl ?? null,
//                 banner: data.bannerUrl ?? null,
//                 city: data.city ?? null,
//                 // organizerId: data.organizerId,
//                 // organizer: data.organizerId
//                 //     ? {
//                 //         connect: { id: data.organizerId },
//                 //     }
//                 //     : undefined,

//                 locations: {
//                     connectOrCreate: data.locations.map((loc) => ({
//                         where: {
//                             name_address: {
//                                 name: loc.name,
//                                 address: loc.address,
//                             },
//                         },
//                         create: {
//                             name: loc.name,
//                             address: loc.address,
//                             city: loc.city ?? null,
//                             state: loc.state ?? null,
//                             country: loc.country ?? "India",
//                             zipCode: loc.zipCode ?? null,
//                         },
//                     })),
//                 },
//             },
//         });

//         if (data.rules) {
//             const rules = await tx.tournamentRules.create({
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

//             if (data.reportingSlots?.length) {
//                 await tx.reportingSlot.createMany({
//                     data: data.reportingSlots.map((slot) => ({
//                         tournamentRulesId: rules.id,
//                         playArea: slot.playArea,
//                         reportTime: new Date(slot.reportTime),
//                     })),
//                 });
//             }
//         }

//         // 🆕 ADD PERSONNEL (Organizers and other staff)
//         // if (data.personnel && data.personnel.length) {
//         //     await addPersonnel({
//         //         entityType: "TOURNAMENT",
//         //         entityId: tournament.id,
//         //         personnel: data.personnel
//         //     });
//         // } else if (data.organizerId) {
//         //     // If only organizerId is provided (backward compatibility), add as personnel
//         //     await addPersonnel({
//         //         entityType: "TOURNAMENT",
//         //         entityId: tournament.id,
//         //         personnel: [{
//         //             userId: data.organizerId,
//         //             role: "ORGANIZER",
//         //             isPrimary: true
//         //         }]
//         //     });
//         // }

//         // 🆕 ADD PERSONNEL (Organizers and other staff)
//         if (data.personnel && data.personnel.length) {
//             await addPersonnel({
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: data.personnel,
//                 skipValidation: true  // ← Skip validation since tournament is being created
//             });
//         } else if (data.organizerId) {
//             await addPersonnel({
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: [{
//                     userId: data.organizerId,
//                     role: "ORGANIZER",
//                     isPrimary: true
//                 }],
//                 skipValidation: true  // ← Skip validation
//             });
//         }

//         return tournament;
//     });

//     // ✅ AUTO-TRIGGER: Schedule matchmaking if tournament has matchMakingAt
//     if (tournament.matchMakingAt) {
//         const now = new Date();
//         const matchMakingTime = new Date(tournament.matchMakingAt);

//         if (matchMakingTime <= now) {
//             console.log(`⚡ Tournament ${tournament.id} has past matchMakingAt, triggering now`);
//             triggerTournamentMatchmaking(tournament).catch(console.error);
//         } else {
//             console.log(`📅 Tournament ${tournament.id} scheduled for matchmaking at ${tournament.matchMakingAt}`);
//         }
//     }

//     return tournament;
// };

// export const createTournament = async (data) => {
//     /* =====================
//        CREATE TOURNAMENT (TRANSACTION)
//     ===================== */

//     const tournament = await prisma.$transaction(async (tx) => {
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
//                 status: "PUBLISHED",
//                 logo: data.logoUrl ?? null,
//                 banner: data.bannerUrl ?? null,
//                 city: data.city ?? null,

//                 locations: {
//                     connectOrCreate: data.locations.map((loc) => ({
//                         where: {
//                             name_address: {
//                                 name: loc.name,
//                                 address: loc.address,
//                             },
//                         },
//                         create: {
//                             name: loc.name,
//                             address: loc.address,
//                             city: loc.city ?? null,
//                             state: loc.state ?? null,
//                             country: loc.country ?? "India",
//                             zipCode: loc.zipCode ?? null,
//                         },
//                     })),
//                 },
//             },
//         });

//         if (data.rules) {
//             const rules = await tx.tournamentRules.create({
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

//             if (data.reportingSlots?.length) {
//                 await tx.reportingSlot.createMany({
//                     data: data.reportingSlots.map((slot) => ({
//                         tournamentRulesId: rules.id,
//                         playArea: slot.playArea,
//                         reportTime: new Date(slot.reportTime),
//                     })),
//                 });
//             }
//         }

//         // 🆕 ADD PERSONNEL (Organizers and other staff)
//         if (data.personnel && data.personnel.length) {
//             await addPersonnel({
//                 tx,  // ← Pass the transaction client
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: data.personnel,
//                 skipValidation: true
//             });
//         } else if (data.organizerId) {
//             await addPersonnel({
//                 tx,
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: [{
//                     userId: data.organizerId,
//                     role: "ORGANIZER",
//                     isPrimary: true
//                 }],
//                 skipValidation: true
//             });
//         }

//         return tournament;
//     });

//     // ✅ Fetch the complete tournament with personnel, locations, rules, and reporting slots
//     const completeTournament = await prisma.tournament.findUnique({
//         where: { id: tournament.id },
//         include: {
//             locations: true,
//             rules: {
//                 include: {
//                     reportingSlots: true
//                 }
//             },
//             // ✅ Include personnel
//             personnel: {
//                 where: {
//                     entityType: "TOURNAMENT",
//                     entityId: tournament.id
//                 },
//                 include: {
//                     user: {
//                         select: {
//                             id: true,
//                             name: true,
//                             username: true,
//                             phone: true,
//                             profileImage: true
//                         }
//                     }
//                 },
//                 orderBy: [
//                     { isPrimary: 'desc' },
//                     { joinedAt: 'asc' }
//                 ]
//             }
//         }
//     });

//     // ✅ AUTO-TRIGGER: Schedule matchmaking if tournament has matchMakingAt
//     if (tournament.matchMakingAt) {
//         const now = new Date();
//         const matchMakingTime = new Date(tournament.matchMakingAt);

//         if (matchMakingTime <= now) {
//             console.log(`⚡ Tournament ${tournament.id} has past matchMakingAt, triggering now`);
//             triggerTournamentMatchmaking(tournament).catch(console.error);
//         } else {
//             console.log(`📅 Tournament ${tournament.id} scheduled for matchmaking at ${tournament.matchMakingAt}`);
//         }
//     }

//     return completeTournament;
// };

// export const createTournament = async (data) => {
//     /* =====================
//        CREATE TOURNAMENT (TRANSACTION)
//     ===================== */

//     const tournament = await prisma.$transaction(async (tx) => {
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
//                 status: "PUBLISHED",
//                 logo: data.logoUrl ?? null,
//                 banner: data.bannerUrl ?? null,
//                 city: data.city ?? null,

//                 locations: {
//                     connectOrCreate: data.locations.map((loc) => ({
//                         where: {
//                             name_address: {
//                                 name: loc.name,
//                                 address: loc.address,
//                             },
//                         },
//                         create: {
//                             name: loc.name,
//                             address: loc.address,
//                             city: loc.city ?? null,
//                             state: loc.state ?? null,
//                             country: loc.country ?? "India",
//                             zipCode: loc.zipCode ?? null,
//                         },
//                     })),
//                 },
//             },
//         });

//         if (data.rules) {
//             const rules = await tx.tournamentRules.create({
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

//             if (data.reportingSlots?.length) {
//                 await tx.reportingSlot.createMany({
//                     data: data.reportingSlots.map((slot) => ({
//                         tournamentRulesId: rules.id,
//                         playArea: slot.playArea,
//                         reportTime: new Date(slot.reportTime),
//                     })),
//                 });
//             }
//         }

//         // 🆕 ADD PERSONNEL (Organizers and other staff)
//         if (data.personnel && data.personnel.length) {
//             await addPersonnel({
//                 tx,
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: data.personnel,
//                 skipValidation: true
//             });
//         } else if (data.organizerId) {
//             await addPersonnel({
//                 tx,
//                 entityType: "TOURNAMENT",
//                 entityId: tournament.id,
//                 personnel: [{
//                     userId: data.organizerId,
//                     role: "ORGANIZER",
//                     isPrimary: true
//                 }],
//                 skipValidation: true
//             });
//         }

//         return tournament;
//     });

//     // ✅ Fetch complete tournament with locations and rules
//     const completeTournament = await prisma.tournament.findUnique({
//         where: { id: tournament.id },
//         include: {
//             locations: true,
//             rules: {
//                 include: {
//                     reportingSlots: true
//                 }
//             }
//         }
//     });

//     // ✅ Fetch personnel separately (since it's not a relation on Tournament)
//     const personnel = await prisma.personnel.findMany({
//         where: {
//             entityType: "TOURNAMENT",
//             entityId: tournament.id
//         },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     phone: true,
//                     profileImage: true
//                 }
//             }
//         },
//         orderBy: [
//             { isPrimary: 'desc' },
//             { joinedAt: 'asc' }
//         ]
//     });

//     // ✅ Combine the data
//     const result = {
//         ...completeTournament,
//         personnel
//     };

//     // ✅ AUTO-TRIGGER: Schedule matchmaking if tournament has matchMakingAt
//     if (tournament.matchMakingAt) {
//         const now = new Date();
//         const matchMakingTime = new Date(tournament.matchMakingAt);

//         if (matchMakingTime <= now) {
//             console.log(`⚡ Tournament ${tournament.id} has past matchMakingAt, triggering now`);
//             triggerTournamentMatchmaking(tournament).catch(console.error);
//         } else {
//             console.log(`📅 Tournament ${tournament.id} scheduled for matchmaking at ${tournament.matchMakingAt}`);
//         }
//     }

//     return result;
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
                logo: data.logoUrl ?? null,
                banner: data.bannerUrl ?? null,
                city: data.city ?? null,

                locations: {
                    ...(data.locations.every(loc => loc.id)
                        ? { connect: data.locations.map(loc => ({ id: loc.id })) }
                        : {
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
                            }))
                        }
                    ),
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

        // ✅ ALWAYS ADD THE CREATOR AS ORGANIZER
        const creatorPersonnel = [{
            userId: data.organizerId,
            role: "ORGANIZER",
            isPrimary: true
        }];

        // 🆕 ADD PERSONNEL (Organizers and other staff)
        if (data.personnel && data.personnel.length) {
            // Merge creator with provided personnel, ensuring no duplicate
            const allPersonnel = [creatorPersonnel[0], ...data.personnel.filter(p => p.userId !== data.organizerId)];

            await addPersonnel({
                tx,
                entityType: "TOURNAMENT",
                entityId: tournament.id,
                personnel: allPersonnel,
                skipValidation: true
            });
        } else {
            // Add only the creator
            await addPersonnel({
                tx,
                entityType: "TOURNAMENT",
                entityId: tournament.id,
                personnel: creatorPersonnel,
                skipValidation: true
            });
        }

        return tournament;
    });

    // ... rest of the function remains the same
    const completeTournament = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: {
            locations: true,
            rules: {
                include: {
                    reportingSlots: true
                }
            }
        }
    });

    const personnel = await prisma.personnel.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: tournament.id
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    profileImage: true
                }
            }
        },
        orderBy: [
            { isPrimary: 'desc' },
            { joinedAt: 'asc' }
        ]
    });

    const result = {
        ...completeTournament,
        personnel
    };

    if (tournament.matchMakingAt) {
        const now = new Date();
        const matchMakingTime = new Date(tournament.matchMakingAt);

        if (matchMakingTime <= now) {
            console.log(`⚡ Tournament ${tournament.id} has past matchMakingAt, triggering now`);
            triggerTournamentMatchmaking(tournament).catch(console.error);
        } else {
            console.log(`📅 Tournament ${tournament.id} scheduled for matchmaking at ${tournament.matchMakingAt}`);
        }
    }

    return result;
};

// export const createTournament = async (data) => {
//     /* =====================
//        CREATE TOURNAMENT (TRANSACTION)
//     ===================== */

//     const tournament = await prisma.$transaction(async (tx) => {
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
//                 status: "PUBLISHED",
//                 logo: data.logoUrl ?? null,
//                 banner: data.bannerUrl ?? null,
//                 city: data.city ?? null,
//                 organizerId: data.organizerId,

//                 locations: {
//                     connectOrCreate: data.locations.map((loc) => ({
//                         where: {
//                             name_address: {
//                                 name: loc.name,
//                                 address: loc.address,
//                             },
//                         },
//                         create: {
//                             name: loc.name,
//                             address: loc.address,
//                             city: loc.city ?? null,
//                             state: loc.state ?? null,
//                             country: loc.country ?? "India",
//                             zipCode: loc.zipCode ?? null,
//                         },
//                     })),
//                 },
//             },
//         });

//         if (data.rules) {
//             const rules = await tx.tournamentRules.create({
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

//             if (data.reportingSlots?.length) {
//                 await tx.reportingSlot.createMany({
//                     data: data.reportingSlots.map((slot) => ({
//                         tournamentRulesId: rules.id,
//                         playArea: slot.playArea,
//                         reportTime: new Date(slot.reportTime),
//                     })),
//                 });
//             }
//         }

//         return tournament;
//     });


//     // ✅ AUTO-TRIGGER: Schedule matchmaking if tournament has matchMakingAt
//     if (tournament.matchMakingAt) {
//         const now = new Date();
//         const matchMakingTime = new Date(tournament.matchMakingAt);

//         if (matchMakingTime <= now) {
//             // If matchMakingAt is in the past, trigger immediately
//             console.log(`⚡ Tournament ${tournament.id} has past matchMakingAt, triggering now`);

//             // Don't await - let it run in background
//             triggerTournamentMatchmaking(tournament).catch(console.error);
//         } else {
//             // Future date - scheduler will pick it up
//             console.log(`📅 Tournament ${tournament.id} scheduled for matchmaking at ${tournament.matchMakingAt}`);
//         }
//     }


//     return tournament;
// };


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

// export const listTournaments = async ({
//     requesterId,
//     status,
//     scope,
//     visibility,
//     page,
//     limit,
// }) => {
//     const now = new Date();

//     const where = {};

//     /* ------------------
//        STATUS FILTER
//     ------------------ */
//     if (status === "upcoming") {
//         where.startDate = { gt: now };
//     }

//     if (status === "ongoing") {
//         where.startDate = { lte: now };
//         where.OR = [
//             { endDate: null },
//             { endDate: { gte: now } },
//         ];
//     }

//     if (status === "completed") {
//         where.OR = [
//             { endDate: { lt: now } },
//             { status: "COMPLETED" },
//         ];
//     }

//     /* ------------------
//        VISIBILITY FILTER
//     ------------------ */
//     if (visibility === "public") where.isPublic = true;
//     if (visibility === "private") where.isPublic = false;

//     /* ------------------
//        MY TOURNAMENTS
//     ------------------ */
//     if (scope === "my" && requesterId) {
//         where.OR = [
//             { organizerId: requesterId },
//             {
//                 participants: {
//                     some: {
//                         OR: [
//                             { playerId: requesterId },
//                             {
//                                 team: {
//                                     members: { some: { userId: requesterId } },
//                                 },
//                             },
//                         ],
//                     },
//                 },
//             },
//             {
//                 invitations: {
//                     some: {
//                         playerId: requesterId,
//                         status: "ACCEPTED",
//                     },
//                 },
//             },
//         ];
//     }

//     /* ------------------
//        PAGINATION
//     ------------------ */
//     const skip = (page - 1) * limit;

//     const [items, total] = await Promise.all([
//         prisma.tournament.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { startDate: "asc" },
//             include: {
//                 organizer: true,
//                 locations: true,
//                 rules: true,
//                 participants: requesterId
//                     ? {
//                         where: {
//                             OR: [
//                                 { playerId: requesterId },
//                                 {
//                                     team: {
//                                         members: { some: { userId: requesterId } },
//                                     },
//                                 },
//                             ],
//                         },
//                     }
//                     : false,
//                 _count: {
//                     select: { participants: true },
//                 },
//             },
//         }),

//         prisma.tournament.count({ where }),
//     ]);

//     return {
//         data: items.map(t => ({
//             ...t,
//             isOrganizer: requesterId ? t.organizerId === requesterId : false,
//             isParticipant: requesterId ? t.participants?.length > 0 : false,
//         })),
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//     };
// };

// export const listTournaments = async ({
//     requesterId,
//     status,
//     scope,
//     visibility,
//     page,
//     limit,
// }) => {
//     const now = new Date();

//     const where = {};

//     /* ------------------
//        STATUS FILTER
//     ------------------ */
//     if (status === "upcoming") {
//         where.startDate = { gt: now };
//     }

//     if (status === "ongoing") {
//         where.startDate = { lte: now };
//         where.OR = [
//             { endDate: null },
//             { endDate: { gte: now } },
//         ];
//     }

//     if (status === "completed") {
//         where.OR = [
//             { endDate: { lt: now } },
//             { status: "COMPLETED" },
//         ];
//     }

//     /* ------------------
//        VISIBILITY FILTER
//     ------------------ */
//     if (visibility === "public") where.isPublic = true;
//     if (visibility === "private") where.isPublic = false;

//     /* ------------------
//        MY TOURNAMENTS - Using Personnel for organizers
//     ------------------ */
//     if (scope === "my" && requesterId) {
//         // Get tournament IDs where user is an organizer
//         const organizerTournamentIds = await prisma.personnel.findMany({
//             where: {
//                 entityType: "TOURNAMENT",
//                 userId: requesterId,
//                 role: "ORGANIZER"
//             },
//             select: { entityId: true }
//         }).then(results => results.map(r => r.entityId));

//         where.OR = [
//             // User is an organizer
//             { id: { in: organizerTournamentIds } },
//             // User is a participant
//             {
//                 participants: {
//                     some: {
//                         OR: [
//                             { playerId: requesterId },
//                             {
//                                 team: {
//                                     members: { some: { userId: requesterId } },
//                                 },
//                             },
//                         ],
//                     },
//                 },
//             },
//             // User has an accepted invitation
//             {
//                 invitations: {
//                     some: {
//                         playerId: requesterId,
//                         status: "ACCEPTED",
//                     },
//                 },
//             },
//         ];
//     }

//     /* ------------------
//        PAGINATION
//     ------------------ */
//     const skip = (page - 1) * limit;

//     // First, get tournaments without personnel
//     const [items, total] = await Promise.all([
//         prisma.tournament.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { startDate: "asc" },
//             include: {
//                 locations: true,
//                 rules: true,
//                 participants: requesterId
//                     ? {
//                         where: {
//                             OR: [
//                                 { playerId: requesterId },
//                                 {
//                                     team: {
//                                         members: { some: { userId: requesterId } },
//                                     },
//                                 },
//                             ],
//                         },
//                     }
//                     : false,
//                 _count: {
//                     select: { participants: true },
//                 },
//             },
//         }),
//         prisma.tournament.count({ where }),
//     ]);

//     // Get tournament IDs from the fetched items
//     const tournamentIds = items.map(t => t.id);

//     // Fetch all personnel for these tournaments in a single query
//     const allPersonnel = await prisma.personnel.findMany({
//         where: {
//             entityType: "TOURNAMENT",
//             entityId: { in: tournamentIds }
//         },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     phone: true,
//                     profileImage: true
//                 }
//             }
//         },
//         orderBy: [
//             { isPrimary: 'desc' },
//             { joinedAt: 'asc' }
//         ]
//     });

//     // Group personnel by tournament ID
//     const personnelByTournament = {};
//     for (const p of allPersonnel) {
//         if (!personnelByTournament[p.entityId]) {
//             personnelByTournament[p.entityId] = [];
//         }
//         personnelByTournament[p.entityId].push(p);
//     }

//     return {
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//         data: items.map(tournament => {
//             const tournamentPersonnel = personnelByTournament[tournament.id] || [];
//             const organizers = tournamentPersonnel.filter(p => p.role === "ORGANIZER");

//             return {
//                 id: tournament.id,
//                 name: tournament.name,
//                 sportCode: tournament.sportCode,
//                 tournamentType: tournament.tournamentType,
//                 startDate: tournament.startDate,
//                 endDate: tournament.endDate,
//                 status: tournament.status,
//                 isPublic: tournament.isPublic,
//                 entryFee: tournament.entryFee,
//                 scheduleType: tournament.scheduleType,
//                 matchMakingAt: tournament.matchMakingAt,
//                 publicJoinCode: tournament.publicJoinCode,
//                 logo: tournament.logo,
//                 banner: tournament.banner,
//                 city: tournament.city,
//                 createdAt: tournament.createdAt,
//                 updatedAt: tournament.updatedAt,
//                 locations: tournament.locations,
//                 rules: tournament.rules,
//                 // Organizer information from personnel
//                 organizers: organizers.map(p => ({
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                     profileImage: p.user.profileImage,
//                     isPrimary: p.isPrimary,
//                     role: p.role
//                 })),
//                 // Primary organizer for quick access
//                 primaryOrganizer: organizers.find(p => p.isPrimary)?.user ||
//                     organizers[0]?.user || null,
//                 // User flags
//                 isOrganizer: requesterId ? organizers.some(p => p.userId === requesterId) : false,
//                 isParticipant: requesterId ? tournament.participants?.length > 0 : false,
//                 participantCount: tournament._count.participants,
//             };
//         }),
//     };
// };

// export const listTournaments = async ({
//     requesterId,
//     status,
//     scope,
//     visibility,
//     page,
//     limit,
// }) => {
//     const now = new Date();

//     const where = {};

//     /* ------------------
//        STATUS FILTER
//     ------------------ */
//     if (status === "upcoming") {
//         where.startDate = { gt: now };
//     }

//     if (status === "ongoing") {
//         where.startDate = { lte: now };
//         where.OR = [
//             { endDate: null },
//             { endDate: { gte: now } },
//         ];
//     }

//     if (status === "completed") {
//         where.OR = [
//             { endDate: { lt: now } },
//             { status: "COMPLETED" },
//         ];
//     }

//     /* ------------------
//        VISIBILITY FILTER
//     ------------------ */
//     if (visibility === "public") where.isPublic = true;
//     if (visibility === "private") where.isPublic = false;

//     /* ------------------
//        MY TOURNAMENTS - Using Personnel for organizers
//     ------------------ */
//     if (scope === "my" && requesterId) {
//         // Get tournament IDs where user is an organizer
//         const organizerTournamentIds = await prisma.personnel.findMany({
//             where: {
//                 entityType: "TOURNAMENT",
//                 userId: requesterId,
//                 role: "ORGANIZER"
//             },
//             select: { entityId: true }
//         }).then(results => results.map(r => r.entityId));

//         where.OR = [
//             // User is an organizer
//             { id: { in: organizerTournamentIds } },
//             // User is a participant
//             {
//                 participants: {
//                     some: {
//                         OR: [
//                             { playerId: requesterId },
//                             {
//                                 team: {
//                                     members: { some: { userId: requesterId } },
//                                 },
//                             },
//                         ],
//                     },
//                 },
//             },
//             // User has an accepted invitation
//             {
//                 invitations: {
//                     some: {
//                         playerId: requesterId,
//                         status: "ACCEPTED",
//                     },
//                 },
//             },
//         ];
//     }

//     /* ------------------
//        PAGINATION
//     ------------------ */
//     const skip = (page - 1) * limit;

//     // First, get tournaments without personnel
//     const [items, total] = await Promise.all([
//         prisma.tournament.findMany({
//             where,
//             skip,
//             take: limit,
//             orderBy: { startDate: "asc" },
//             include: {
//                 locations: true,
//                 rules: true,
//                 participants: requesterId
//                     ? {
//                         where: {
//                             OR: [
//                                 { playerId: requesterId },
//                                 {
//                                     team: {
//                                         members: { some: { userId: requesterId } },
//                                     },
//                                 },
//                             ],
//                         },
//                     }
//                     : false,
//                 _count: {
//                     select: { participants: true },
//                 },
//             },
//         }),
//         prisma.tournament.count({ where }),
//     ]);

//     // Get tournament IDs from the fetched items
//     const tournamentIds = items.map(t => t.id);

//     // Fetch all personnel for these tournaments in a single query
//     const allPersonnel = await prisma.personnel.findMany({
//         where: {
//             entityType: "TOURNAMENT",
//             entityId: { in: tournamentIds }
//         },
//         include: {
//             user: {
//                 select: {
//                     id: true,
//                     name: true,
//                     username: true,
//                     phone: true,
//                     profileImage: true
//                 }
//             }
//         },
//         orderBy: [
//             { isPrimary: 'desc' },
//             { joinedAt: 'asc' }
//         ]
//     });

//     // Group personnel by tournament ID
//     const personnelByTournament = {};
//     for (const p of allPersonnel) {
//         if (!personnelByTournament[p.entityId]) {
//             personnelByTournament[p.entityId] = [];
//         }
//         personnelByTournament[p.entityId].push(p);
//     }

//     // Format the data to match create tournament response
//     const formattedData = items.map(tournament => {
//         const tournamentPersonnel = personnelByTournament[tournament.id] || [];

//         // Check if user is an organizer
//         const isOrganizer = requesterId ? tournamentPersonnel.some(p => p.userId === requesterId && p.role === "ORGANIZER") : false;

//         // Check if user is a participant
//         const isParticipant = requesterId ? tournament.participants?.length > 0 : false;

//         return {
//             id: tournament.id,
//             name: tournament.name,
//             sportCode: tournament.sportCode,
//             tournamentType: tournament.tournamentType,
//             startDate: tournament.startDate,
//             endDate: tournament.endDate,
//             status: tournament.status,
//             isPublic: tournament.isPublic,
//             entryFee: tournament.entryFee,
//             scheduleType: tournament.scheduleType,
//             matchMakingAt: tournament.matchMakingAt,
//             publicJoinCode: tournament.publicJoinCode,
//             logo: tournament.logo,
//             banner: tournament.banner,
//             city: tournament.city,
//             createdAt: tournament.createdAt,
//             updatedAt: tournament.updatedAt,
//             locations: tournament.locations,
//             rules: tournament.rules,
//             // Personnel in the same format as create tournament
//             personnel: tournamentPersonnel.map(p => ({
//                 id: p.id,
//                 entityType: p.entityType,
//                 entityId: p.entityId,
//                 userId: p.userId,
//                 role: p.role,
//                 isPrimary: p.isPrimary,
//                 joinedAt: p.joinedAt,
//                 user: {
//                     id: p.user.id,
//                     name: p.user.name,
//                     username: p.user.username,
//                     phone: p.user.phone,
//                     profileImage: p.user.profileImage
//                 }
//             })),
//             // Counts
//             participantCount: tournament._count.participants,
//             // Flags
//             isOrganizer,
//             isParticipant,
//         };
//     });

//     return {
//         success: true,
//         data: formattedData,
//         meta: {
//             page,
//             limit,
//             total,
//             totalPages: Math.ceil(total / limit),
//         },
//     };
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

    console.log(`🔍 listTournaments called with scope=${scope}, requesterId=${requesterId}`);
    
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
       MY TOURNAMENTS - All 4 categories
    ------------------ */
    if (scope === "my" && requesterId) {
        // 1️⃣ Get tournament IDs where user is an organizer (from Personnel)
        const organizerTournamentIds = await prisma.personnel.findMany({
            where: {
                entityType: "TOURNAMENT",
                userId: requesterId,
                role: "ORGANIZER"
            },
            select: { entityId: true }
        }).then(results => results.map(r => r.entityId));

        // 2️⃣ Get tournament IDs where user is a participant
        const participantTournamentIds = await prisma.tournamentParticipant.findMany({
            where: {
                OR: [
                    { playerId: requesterId },
                    { team: { members: { some: { userId: requesterId } } } }
                ]
            },
            select: { tournamentId: true }
        }).then(results => results.map(r => r.tournamentId));

        // 3️⃣ Get tournament IDs where user has accepted invitations
        const invitationTournamentIds = await prisma.invitation.findMany({
            where: {
                playerId: requesterId,
                status: "ACCEPTED"
            },
            select: { tournamentId: true }
        }).then(results => results.map(r => r.tournamentId));

        // Combine all IDs
        const allRelatedTournamentIds = [
            ...new Set([
                ...organizerTournamentIds,
                ...participantTournamentIds,
                ...invitationTournamentIds
            ])
        ];

        console.log(`🔍 User ${requesterId} is related to ${allRelatedTournamentIds.length} tournaments:`, {
            organizer: organizerTournamentIds.length,
            participant: participantTournamentIds.length,
            invitation: invitationTournamentIds.length
        });

        where.id = { in: allRelatedTournamentIds };
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
            orderBy: { createdAt: "desc" },
            include: {
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

    // Get tournament IDs from the fetched items
    const tournamentIds = items.map(t => t.id);

    // Fetch all personnel for these tournaments in a single query
    const allPersonnel = await prisma.personnel.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: { in: tournamentIds }
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    profileImage: true
                }
            }
        },
        orderBy: [
            { isPrimary: 'desc' },
            { joinedAt: 'asc' }
        ]
    });

    // Group personnel by tournament ID
    const personnelByTournament = {};
    for (const p of allPersonnel) {
        if (!personnelByTournament[p.entityId]) {
            personnelByTournament[p.entityId] = [];
        }
        personnelByTournament[p.entityId].push(p);
    }

    // Format the data
    const formattedData = items.map(tournament => {
        const tournamentPersonnel = personnelByTournament[tournament.id] || [];

        const isOrganizer = requesterId ? tournamentPersonnel.some(p => p.userId === requesterId && p.role === "ORGANIZER") : false;
        const isParticipant = requesterId ? tournament.participants?.length > 0 : false;

        return {
            id: tournament.id,
            name: tournament.name,
            sportCode: tournament.sportCode,
            tournamentType: tournament.tournamentType,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            status: tournament.status,
            isPublic: tournament.isPublic,
            entryFee: tournament.entryFee,
            scheduleType: tournament.scheduleType,
            matchMakingAt: tournament.matchMakingAt,
            publicJoinCode: tournament.publicJoinCode,
            logo: tournament.logo,
            banner: tournament.banner,
            city: tournament.city,
            createdAt: tournament.createdAt,
            updatedAt: tournament.updatedAt,
            locations: tournament.locations,
            rules: tournament.rules,
            personnel: tournamentPersonnel.map(p => ({
                id: p.id,
                entityType: p.entityType,
                entityId: p.entityId,
                userId: p.userId,
                role: p.role,
                isPrimary: p.isPrimary,
                joinedAt: p.joinedAt,
                user: {
                    id: p.user.id,
                    name: p.user.name,
                    username: p.user.username,
                    phone: p.user.phone,
                    profileImage: p.user.profileImage
                }
            })),
            participantCount: tournament._count.participants,
            isOrganizer,
            isParticipant,
        };
    });

    return {
        success: true,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: formattedData,
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
    // Find tournaments where user is organizer via Personnel table
    const personnelRecords = await prisma.personnel.findMany({
        where: {
            userId,
            entityType: "TOURNAMENT",
            role: { in: ["ORGANIZER", "ADMIN"] }
        },
        select: { entityId: true }
    });
    const organizedIds = personnelRecords.map(p => p.entityId);

    const tournaments = await prisma.tournament.findMany({
        where: {
            id: { in: organizedIds }
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

// export const getTournament = async (id, requesterId = null) => {
//     const tournament = await prisma.tournament.findUnique({
//         where: { id },
//         include: {
//             locations: true,
//             rules: {
//                 include: {
//                     reportingSlots: true,
//                 },
//             },
//             participants: {
//                 include: {
//                     player: {
//                         select: {
//                             id: true,
//                             name: true,
//                             profileImage: true,
//                         },
//                     },
//                     team: {
//                         include: {
//                             members: true,
//                         },
//                     },
//                 },
//             },
//             matches: {
//                 include: {
//                     participants: {
//                         include: {
//                             user: {
//                                 select: {
//                                     id: true,
//                                     name: true,
//                                     profileImage: true,
//                                 },
//                             },
//                         },
//                     },
//                 },
//             },
//         },
//     });

//     if (!tournament) {
//         throw new Error("TOURNAMENT_NOT_FOUND");
//     }

//     // ✅ Virtual fields
//     const isOrganizer = requesterId === tournament.organizerId;

//     let isParticipant = false;
//     if (requesterId) {
//         isParticipant = tournament.participants.some((p) => {
//             // Check direct player participation
//             if (p.playerId === requesterId) return true;
//             // Check team participation (if user is in the team)
//             if (p.teamId && p.team?.members?.some((m) => m.userId === requesterId)) {
//                 return true;
//             }
//             return false;
//         });
//     }

//     return {
//         ...tournament,
//         isOrganizer,
//         isParticipant,
//     };
// };

// export const updateTournament = async (id, data) => {
//     const existing = await prisma.tournament.findUnique({
//         where: { id },
//     });

//     if (!existing) {
//         throw new Error("TOURNAMENT_NOT_FOUND");
//     }

//     if (existing.status === "ONGOING" || existing.status === "COMPLETED") {
//         throw new Error("TOURNAMENT_LOCKED");
//     }

//     if (data.endDate && data.startDate) {
//         if (new Date(data.endDate) < new Date(data.startDate)) {
//             throw new Error("INVALID_DATE_RANGE");
//         }
//     }

//     return prisma.tournament.update({
//         where: { id },
//         data: {
//             name: data.name,
//             startDate: data.startDate ? new Date(data.startDate) : undefined,
//             endDate: data.endDate ? new Date(data.endDate) : undefined,
//             status: data.status,
//             isPublic: data.isPublic,
//             entryFee: data.entryFee,
//             scheduleType: data.scheduleType,
//             logo: data.logo,
//             banner: data.banner,
//         },
//     });
// };

// export const updateTournament = async (id, data) => {
//     const existing = await prisma.tournament.findUnique({
//         where: { id },
//         include: { locations: true },
//     });

//     if (!existing) throw new Error("TOURNAMENT_NOT_FOUND");

//     if (["ONGOING", "COMPLETED"].includes(existing.status)) {
//         throw new Error("TOURNAMENT_LOCKED");
//     }

//     if (data.endDate && data.startDate) {
//         if (new Date(data.endDate) < new Date(data.startDate)) {
//             throw new Error("INVALID_DATE_RANGE");
//         }
//     }

//     const locations = Array.isArray(data.locations)
//         ? data.locations
//         : [];

//     return prisma.$transaction(async (tx) => {
//         // 🔥 Step 1: Clear old locations if new ones are provided
//         if (locations.length) {
//             await tx.tournament.update({
//                 where: { id },
//                 data: {
//                     locations: {
//                         set: [], // removes existing relations
//                     },
//                 },
//             });
//         }

//         // 🔥 Step 2: Update tournament + attach locations
//         const updated = await tx.tournament.update({
//             where: { id },
//             data: {
//                 name: data.name ?? undefined,
//                 startDate: data.startDate ? new Date(data.startDate) : undefined,
//                 endDate: data.endDate ? new Date(data.endDate) : undefined,
//                 status: data.status ?? undefined,
//                 isPublic: data.isPublic ?? undefined,
//                 entryFee: data.entryFee ?? undefined,
//                 scheduleType: data.scheduleType ?? undefined,
//                 logo: data.logo ?? undefined,
//                 banner: data.banner ?? undefined,
//                 city: data.city ?? undefined,
//                 matchMakingAt: data.matchMakingAt ? new Date(data.matchMakingAt) : undefined,

//                 ...(locations.length && {
//                     locations: {
//                         connectOrCreate: locations.map((loc) => ({
//                             where: {
//                                 name_address: {
//                                     name: loc.name,
//                                     address: loc.address,
//                                 },
//                             },
//                             create: {
//                                 name: loc.name,
//                                 address: loc.address,
//                                 city: loc.city ?? null,
//                                 state: loc.state ?? null,
//                                 country: loc.country ?? "India",
//                                 zipCode: loc.zipCode ?? null,
//                             },
//                         })),
//                     },
//                 }),
//             },
//         });


//         // ✅ AUTO-TRIGGER: Handle matchmaking rescheduling
//         if (updated.status === "PUBLISHED" && updated.matchMakingAt) {
//             const now = new Date();
//             const matchMakingTime = new Date(updated.matchMakingAt);

//             // Check if no matches exist yet
//             const matchesExist = await prisma.match.findFirst({
//                 where: { tournamentId: id }
//             });

//             if (!matchesExist) {
//                 if (matchMakingTime <= now) {
//                     console.log(`⚡ Tournament ${updated.id} has past matchMakingAt after update, triggering now`);
//                     triggerTournamentMatchmaking(updated).catch(console.error);
//                 } else {
//                     console.log(`📅 Tournament ${updated.id} rescheduled for matchmaking at ${updated.matchMakingAt}`);
//                 }
//             }
//         }

//         return updated;
//     });
// };

// export const updateTournament = async (id, data) => {
//     const existing = await prisma.tournament.findUnique({
//         where: { id },
//         include: { locations: true },
//     });

//     if (!existing) throw new Error("TOURNAMENT_NOT_FOUND");

//     if (["ONGOING", "COMPLETED"].includes(existing.status)) {
//         throw new Error("TOURNAMENT_LOCKED");
//     }

//     if (data.endDate && data.startDate) {
//         if (new Date(data.endDate) < new Date(data.startDate)) {
//             throw new Error("INVALID_DATE_RANGE");
//         }
//     }

//     const locations = Array.isArray(data.locations)
//         ? data.locations
//         : [];

//     return prisma.$transaction(async (tx) => {
//         // 🔥 Step 1: Clear old locations if new ones are provided
//         if (locations.length) {
//             await tx.tournament.update({
//                 where: { id },
//                 data: {
//                     locations: {
//                         set: [], // removes existing relations
//                     },
//                 },
//             });
//         }

//         // 🔥 Step 2: Update tournament + attach locations
//         const updated = await tx.tournament.update({
//             where: { id },
//             data: {
//                 name: data.name ?? undefined,
//                 startDate: data.startDate ? new Date(data.startDate) : undefined,
//                 endDate: data.endDate ? new Date(data.endDate) : undefined,
//                 status: data.status ?? undefined,
//                 isPublic: data.isPublic ?? undefined,
//                 entryFee: data.entryFee ?? undefined,
//                 scheduleType: data.scheduleType ?? undefined,
//                 logo: data.logo ?? undefined,
//                 banner: data.banner ?? undefined,
//                 city: data.city ?? undefined,
//                 matchMakingAt: data.matchMakingAt ? new Date(data.matchMakingAt) : undefined,

//                 ...(locations.length && {
//                     locations: {
//                         connectOrCreate: locations.map((loc) => ({
//                             where: {
//                                 name_address: {
//                                     name: loc.name,
//                                     address: loc.address,
//                                 },
//                             },
//                             create: {
//                                 name: loc.name,
//                                 address: loc.address,
//                                 city: loc.city ?? null,
//                                 state: loc.state ?? null,
//                                 country: loc.country ?? "India",
//                                 zipCode: loc.zipCode ?? null,
//                             },
//                         })),
//                     },
//                 }),
//             },
//         });

//         // 🆕 UPDATE PERSONNEL
//         if (data.personnel !== undefined) {
//             // If personnel array is provided, replace all personnel
//             if (data.personnel.length) {
//                 // First, remove all existing personnel for this tournament
//                 await tx.personnel.deleteMany({
//                     where: {
//                         entityType: "TOURNAMENT",
//                         entityId: id
//                     }
//                 });

//                 // Then add new personnel
//                 for (const person of data.personnel) {
//                     await tx.personnel.create({
//                         data: {
//                             entityType: "TOURNAMENT",
//                             entityId: id,
//                             userId: person.userId,
//                             role: person.role,
//                             isPrimary: person.isPrimary || false
//                         }
//                     });
//                 }
//             } else if (data.personnel === null || data.personnel.length === 0) {
//                 // If explicitly set to empty, remove all personnel
//                 await tx.personnel.deleteMany({
//                     where: {
//                         entityType: "TOURNAMENT",
//                         entityId: id
//                     }
//                 });
//             }
//         }

//         // ✅ AUTO-TRIGGER: Handle matchmaking rescheduling
//         if (updated.status === "PUBLISHED" && updated.matchMakingAt) {
//             const now = new Date();
//             const matchMakingTime = new Date(updated.matchMakingAt);

//             const matchesExist = await prisma.match.findFirst({
//                 where: { tournamentId: id }
//             });

//             if (!matchesExist) {
//                 if (matchMakingTime <= now) {
//                     console.log(`⚡ Tournament ${updated.id} has past matchMakingAt after update, triggering now`);
//                     triggerTournamentMatchmaking(updated).catch(console.error);
//                 } else {
//                     console.log(`📅 Tournament ${updated.id} rescheduled for matchmaking at ${updated.matchMakingAt}`);
//                 }
//             }
//         }

//         return updated;
//     });
// };

export const getTournament = async (id, requesterId = null) => {
    // First, fetch the tournament
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
                            members: {
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
                take: 10,
                orderBy: { createdAt: 'desc' },
            },
        },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    // ✅ Fetch personnel separately (to match create tournament format)
    const personnel = await prisma.personnel.findMany({
        where: {
            entityType: "TOURNAMENT",
            entityId: id
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    profileImage: true
                }
            }
        },
        orderBy: [
            { isPrimary: 'desc' },
            { joinedAt: 'asc' }
        ]
    });

    // ✅ Format participants with user details
    const formattedParticipants = tournament.participants.map(p => ({
        id: p.id,
        playerId: p.playerId,
        teamId: p.teamId,
        seed: p.seed,
        eliminated: p.eliminated,
        createdAt: p.createdAt,
        player: p.player,
        team: p.team ? {
            id: p.team.id,
            name: p.team.name,
            sportCode: p.team.sportCode,
            logo: p.team.logo,
            city: p.team.city,
            isTemporary: p.team.isTemporary,
            members: p.team.members.map(m => ({
                id: m.id,
                userId: m.userId,
                role: m.role,
                user: m.user
            }))
        } : null
    }));

    // ✅ Format matches
    const formattedMatches = tournament.matches.map(match => ({
        id: match.id,
        name: match.name,
        sportCode: match.sportCode,
        gameType: match.gameType,
        status: match.status,
        round: match.round,
        bracketPosition: match.bracketPosition,
        participants: match.participants.map(p => ({
            id: p.id,
            userId: p.userId,
            userName: p.user?.name,
            teamId: p.teamId,
            position: p.position,
            side: p.side
        }))
    }));

    // ✅ Check if user is an organizer
    let isOrganizer = false;
    if (requesterId) {
        isOrganizer = personnel.some(p => p.userId === requesterId && p.role === "ORGANIZER");
    }

    // ✅ Check if user is a participant
    let isParticipant = false;
    if (requesterId) {
        isParticipant = tournament.participants.some((p) => {
            if (p.playerId === requesterId) return true;
            if (p.teamId && p.team?.members?.some((m) => m.userId === requesterId)) return true;
            return false;
        });
    }

    return {
        ...tournament,
        participants: formattedParticipants,
        matches: formattedMatches,
        personnel, // Return personnel exactly as fetched (matching create tournament format)
        isOrganizer,
        isParticipant,
    };
};

export const updateTournament = async (id, data) => {
    const existing = await prisma.tournament.findUnique({
        where: { id },
        include: { locations: true },
    });

    if (!existing) throw new Error("TOURNAMENT_NOT_FOUND");

    if (["ONGOING", "COMPLETED"].includes(existing.status)) {
        throw new Error("TOURNAMENT_LOCKED");
    }

    if (data.endDate && data.startDate) {
        if (new Date(data.endDate) < new Date(data.startDate)) {
            throw new Error("INVALID_DATE_RANGE");
        }
    }

    const locations = Array.isArray(data.locations) ? data.locations : [];

    return prisma.$transaction(async (tx) => {
        // Update locations
        if (locations.length) {
            await tx.tournament.update({
                where: { id },
                data: { locations: { set: [] } }
            });
        }

        // Update tournament basic info
        const updated = await tx.tournament.update({
            where: { id },
            data: {
                name: data.name ?? undefined,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                status: data.status ?? undefined,
                isPublic: data.isPublic ?? undefined,
                entryFee: data.entryFee ?? undefined,
                scheduleType: data.scheduleType ?? undefined,
                logo: data.logo ?? undefined,
                banner: data.banner ?? undefined,
                city: data.city ?? undefined,
                matchMakingAt: data.matchMakingAt ? new Date(data.matchMakingAt) : undefined,
                ...(locations.length && {
                    locations: {
                        connectOrCreate: locations.map((loc) => ({
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
                }),
            },
        });

        // 🔥 FIX: Use addPersonnel instead of manual creation
        if (data.personnel !== undefined) {
            // Remove all existing personnel
            await tx.personnel.deleteMany({
                where: {
                    entityType: "TOURNAMENT",
                    entityId: id
                }
            });

            // Add new personnel using the service function
            if (data.personnel.length) {
                await addPersonnel({
                    tx,
                    entityType: "TOURNAMENT",
                    entityId: id,
                    personnel: data.personnel,
                    skipValidation: true
                });
            }
        }

        // Fetch complete updated tournament
        const completeTournament = await tx.tournament.findUnique({
            where: { id },
            include: {
                locations: true,
                rules: {
                    include: {
                        reportingSlots: true
                    }
                }
            }
        });

        // Fetch personnel
        const personnel = await tx.personnel.findMany({
            where: {
                entityType: "TOURNAMENT",
                entityId: id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        phone: true,
                        profileImage: true
                    }
                }
            },
            orderBy: [
                { isPrimary: 'desc' },
                { joinedAt: 'asc' }
            ]
        });

        // AUTO-TRIGGER: Handle matchmaking rescheduling
        if (updated.status === "PUBLISHED" && updated.matchMakingAt) {
            const now = new Date();
            const matchMakingTime = new Date(updated.matchMakingAt);
            const matchesExist = await tx.match.findFirst({
                where: { tournamentId: id }
            });

            if (!matchesExist) {
                if (matchMakingTime <= now) {
                    console.log(`⚡ Tournament ${updated.id} has past matchMakingAt after update, triggering now`);
                    triggerTournamentMatchmaking(updated).catch(console.error);
                } else {
                    console.log(`📅 Tournament ${updated.id} rescheduled for matchmaking at ${updated.matchMakingAt}`);
                }
            }
        }

        return {
            ...completeTournament,
            personnel
        };
    });
};


export const deleteTournament = async (id) => {
    // 1️⃣ Check if the tournament exists
    const existing = await prisma.tournament.findUnique({
        where: { id },
    });

    if (!existing) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    // 2️⃣ Only allow deletion if status is DRAFT
    if (existing.status !== "DRAFT") {
        throw new Error("TOURNAMENT_CANNOT_BE_DELETED");
    }

    // 3️⃣ Delete all dependent records in a transaction
    return prisma.$transaction([
        prisma.invitation.deleteMany({ where: { tournamentId: id } }),
        prisma.match.deleteMany({ where: { tournamentId: id } }),
        prisma.tournamentParticipant.deleteMany({ where: { tournamentId: id } }),
        prisma.tournament.delete({ where: { id } }), // finally delete tournament
    ]);
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
            locations: true,
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
