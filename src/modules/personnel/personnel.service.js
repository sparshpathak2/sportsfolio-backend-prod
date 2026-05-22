import prisma from "../../lib/prisma.js";

/**
 * Get available personnel for dropdown
 * Returns users who can be assigned as personnel (all users, optionally filtered)
 */
export const getAvailablePersonnel = async ({ entityType = null, role = null, search = null } = {}) => {
    const where = {};

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
        ];
    }

    const users = await prisma.user.findMany({
        where,
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            email: true,
            profileImage: true,
            // Optional: Get already assigned roles for context
            personnel: {
                where: entityType ? { entityType } : {},
                select: {
                    entityId: true,
                    entityType: true,
                    role: true
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Format for dropdown
    return users.map(user => ({
        id: user.id,
        name: user.name || user.username || user.phone,
        username: user.username,
        phone: user.phone,
        email: user.email,
        profileImage: user.profileImage,
        // Optional: Show if already assigned to current entity
        currentlyAssigned: user.personnel.length > 0
    }));
};

/**
 * Find or create user by phone number
 */
// const findOrCreateUserByPhone = async (phone) => {
//     // Clean phone number (remove spaces, special chars)
//     const cleanPhone = phone.replace(/[^0-9+]/g, '');

//     let user = await prisma.user.findUnique({
//         where: { phone: cleanPhone }
//     });

//     if (!user) {
//         // Create new user with just phone number
//         user = await prisma.user.create({
//             data: { phone: cleanPhone }
//         });
//     }

//     return user;
// };
// Helper to find or create user by phone number
const findOrCreateUserByPhone = async (phone) => {
    // Clean phone number (remove spaces, special chars)
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    let user = await prisma.user.findUnique({
        where: { phone: cleanPhone }
    });

    if (!user) {
        console.log(`📱 Creating new user for phone: ${cleanPhone}`);
        user = await prisma.user.create({
            data: { phone: cleanPhone }
        });
        console.log(`✅ Created new user with ID: ${user.id}`);
    } else {
        console.log(`✅ Found existing user: ${user.id}`);
    }

    return user;
};

/**
 * Add personnel to an entity (tournament or match)
 * Supports both userId and phoneNumber
 */
// export const addPersonnel = async ({ entityType, entityId, personnel }) => {
//     // Validate entity exists
//     if (entityType === "TOURNAMENT") {
//         const tournament = await prisma.tournament.findUnique({
//             where: { id: entityId }
//         });
//         if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//     } else if (entityType === "MATCH") {
//         const match = await prisma.match.findUnique({
//             where: { id: entityId }
//         });
//         if (!match) throw new Error("MATCH_NOT_FOUND");
//     } else {
//         throw new Error("INVALID_ENTITY_TYPE");
//     }

//     return prisma.$transaction(async (tx) => {
//         const results = [];

//         for (const p of personnel) {
//             let userId = p.userId;

//             // If phone number provided, find or create user
//             if (!userId && p.phone) {
//                 const user = await findOrCreateUserByPhone(p.phone);
//                 userId = user.id;
//             }

//             if (!userId) {
//                 throw new Error("Either userId or phone is required");
//             }

//             // Verify user exists
//             const user = await tx.user.findUnique({
//                 where: { id: userId }
//             });
//             if (!user) throw new Error(`User with ID ${userId} not found`);

//             const person = await tx.personnel.upsert({
//                 where: {
//                     entityType_entityId_userId: {
//                         entityType,
//                         entityId,
//                         userId
//                     }
//                 },
//                 update: {
//                     role: p.role,
//                     isPrimary: p.isPrimary || false
//                 },
//                 create: {
//                     entityType,
//                     entityId,
//                     userId,
//                     role: p.role,
//                     isPrimary: p.isPrimary || false
//                 }
//             });

//             results.push({
//                 ...person,
//                 user: {
//                     id: user.id,
//                     name: user.name,
//                     username: user.username,
//                     phone: user.phone,
//                     profileImage: user.profileImage
//                 }
//             });
//         }

//         return results;
//     });
// };

/**
 * Add personnel to an entity (tournament or match)
 * @param {Object} params
 * @param {string} params.entityType - "TOURNAMENT" or "MATCH"
 * @param {string} params.entityId - tournamentId or matchId
 * @param {Array} params.personnel - Array of personnel objects
 * @param {boolean} params.skipValidation - Skip entity existence validation
 * @returns {Promise<Array>} Created/updated personnel records
 */
// export const addPersonnel = async ({ entityType, entityId, personnel, skipValidation = false }) => {
//     // Skip validation if called from within transaction where entity is being created
//     if (!skipValidation) {
//         // Validate entity exists
//         if (entityType === "TOURNAMENT") {
//             const tournament = await prisma.tournament.findUnique({
//                 where: { id: entityId }
//             });
//             if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//         } else if (entityType === "MATCH") {
//             const match = await prisma.match.findUnique({
//                 where: { id: entityId }
//             });
//             if (!match) throw new Error("MATCH_NOT_FOUND");
//         } else {
//             throw new Error("INVALID_ENTITY_TYPE");
//         }
//     }

//     return prisma.$transaction(async (tx) => {
//         const results = [];

//         for (const p of personnel) {
//             let userId = p.userId;

//             // If phone number provided, find or create user
//             if (!userId && p.phone) {
//                 const user = await findOrCreateUserByPhone(p.phone);
//                 userId = user.id;
//             }

//             if (!userId) {
//                 throw new Error("Either userId or phone is required");
//             }

//             // Verify user exists
//             const user = await tx.user.findUnique({
//                 where: { id: userId }
//             });
//             if (!user) throw new Error(`User with ID ${userId} not found`);

//             const person = await tx.personnel.upsert({
//                 where: {
//                     entityType_entityId_userId: {
//                         entityType,
//                         entityId,
//                         userId
//                     }
//                 },
//                 update: {
//                     role: p.role,
//                     isPrimary: p.isPrimary || false
//                 },
//                 create: {
//                     entityType,
//                     entityId,
//                     userId,
//                     role: p.role,
//                     isPrimary: p.isPrimary || false
//                 }
//             });

//             results.push({
//                 ...person,
//                 user: {
//                     id: user.id,
//                     name: user.name,
//                     username: user.username,
//                     phone: user.phone,
//                     profileImage: user.profileImage
//                 }
//             });
//         }

//         return results;
//     });
// };

// In personnel.service.js
// export const addPersonnel = async ({ tx, entityType, entityId, personnel, skipValidation = false }) => {
//     // Use provided transaction or create new one
//     const prismaClient = tx || prisma;

//     // Skip validation if called from within transaction where entity is being created
//     if (!skipValidation) {
//         if (entityType === "TOURNAMENT") {
//             const tournament = await prismaClient.tournament.findUnique({
//                 where: { id: entityId }
//             });
//             if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//         } else if (entityType === "MATCH") {
//             const match = await prismaClient.match.findUnique({
//                 where: { id: entityId }
//             });
//             if (!match) throw new Error("MATCH_NOT_FOUND");
//         } else {
//             throw new Error("INVALID_ENTITY_TYPE");
//         }
//     }

//     const results = [];

//     for (const p of personnel) {
//         let userId = p.userId;

//         if (!userId && p.phone) {
//             const user = await findOrCreateUserByPhone(p.phone);
//             userId = user.id;
//         }

//         if (!userId) {
//             throw new Error("Either userId or phone is required");
//         }

//         const user = await prismaClient.user.findUnique({
//             where: { id: userId }
//         });
//         if (!user) throw new Error(`User with ID ${userId} not found`);

//         const person = await prismaClient.personnel.upsert({
//             where: {
//                 entityType_entityId_userId: {
//                     entityType,
//                     entityId,
//                     userId
//                 }
//             },
//             update: {
//                 role: p.role,
//                 isPrimary: p.isPrimary || false
//             },
//             create: {
//                 entityType,
//                 entityId,
//                 userId,
//                 role: p.role,
//                 isPrimary: p.isPrimary || false
//             }
//         });

//         results.push({
//             ...person,
//             user: {
//                 id: user.id,
//                 name: user.name,
//                 username: user.username,
//                 phone: user.phone,
//                 profileImage: user.profileImage
//             }
//         });
//     }

//     return results;
// };

/**
 * Add personnel to an entity (tournament or match)
 */
export const addPersonnel = async ({ tx, entityType, entityId, personnel, skipValidation = false }) => {
    // Use provided transaction or create new one
    const prismaClient = tx || prisma;

    console.log(`\n========== ADD PERSONNEL ==========`);
    console.log(`Entity: ${entityType} - ${entityId}`);
    console.log(`Personnel to add:`, JSON.stringify(personnel, null, 2));

    // Skip validation if called from within transaction where entity is being created
    if (!skipValidation) {
        if (entityType === "TOURNAMENT") {
            const tournament = await prismaClient.tournament.findUnique({
                where: { id: entityId }
            });
            if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
            console.log(`✅ Tournament found: ${tournament.id}`);
        } else if (entityType === "MATCH") {
            const match = await prismaClient.match.findUnique({
                where: { id: entityId }
            });
            if (!match) throw new Error("MATCH_NOT_FOUND");
            console.log(`✅ Match found: ${match.id}`);
        } else {
            throw new Error("INVALID_ENTITY_TYPE");
        }
    }

    const results = [];

    for (const p of personnel) {
        console.log(`\n--- Processing personnel:`, p);

        let userId = p.userId;

        // If phone number provided, find or create user
        if (!userId && p.phone) {
            console.log(`📞 Phone provided: ${p.phone} - looking up user...`);
            const user = await findOrCreateUserByPhone(p.phone);
            userId = user.id;
            console.log(`✅ User ID resolved: ${userId}`);
        }

        if (!userId) {
            console.error(`❌ Neither userId nor phone provided for personnel`);
            throw new Error("Either userId or phone is required");
        }

        // Verify user exists
        const user = await prismaClient.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            console.error(`❌ User with ID ${userId} not found`);
            throw new Error(`User with ID ${userId} not found`);
        }
        console.log(`✅ User found: ${user.id} - ${user.name || user.phone}`);

        // Create or update personnel
        const person = await prismaClient.personnel.upsert({
            where: {
                entityType_entityId_userId: {
                    entityType,
                    entityId,
                    userId
                }
            },
            update: {
                role: p.role,
                isPrimary: p.isPrimary || false
            },
            create: {
                entityType,
                entityId,
                userId,
                role: p.role,
                isPrimary: p.isPrimary || false
            }
        });

        console.log(`✅ Personnel created/updated: ${person.id}`);

        results.push({
            ...person,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                phone: user.phone,
                profileImage: user.profileImage
            }
        });
    }

    console.log(`\n✅ Added ${results.length} personnel records`);
    return results;
};

/**
 * Get all personnel for an entity
 */
export const getPersonnel = async ({ entityType, entityId, role = null }) => {
    const where = {
        entityType,
        entityId
    };

    if (role) {
        where.role = role;
    }

    return prisma.personnel.findMany({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    email: true,
                    profileImage: true
                }
            }
        },
        orderBy: [
            { isPrimary: 'desc' },
            { joinedAt: 'asc' }
        ]
    });
};

/**
 * Get personnel by role
 */
export const getPersonnelByRole = async ({ entityType, entityId, role }) => {
    return getPersonnel({ entityType, entityId, role });
};

/**
 * Get primary personnel for an entity
 */
export const getPrimaryPersonnel = async ({ entityType, entityId }) => {
    return prisma.personnel.findMany({
        where: {
            entityType,
            entityId,
            isPrimary: true
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
        }
    });
};

/**
 * Update personnel role
 */
export const updatePersonnelRole = async ({ entityType, entityId, userId, role, isPrimary }) => {
    const existing = await prisma.personnel.findUnique({
        where: {
            entityType_entityId_userId: {
                entityType,
                entityId,
                userId
            }
        }
    });

    if (!existing) throw new Error("PERSONNEL_NOT_FOUND");

    return prisma.personnel.update({
        where: {
            entityType_entityId_userId: {
                entityType,
                entityId,
                userId
            }
        },
        data: {
            ...(role && { role }),
            ...(isPrimary !== undefined && { isPrimary })
        }
    });
};

/**
 * Remove personnel from an entity
 */
export const removePersonnel = async ({ entityType, entityId, userId }) => {
    console.log("🔍 Removing personnel with:", {
        entityType,
        entityId,
        userId
    });
    const existing = await prisma.personnel.findUnique({
        where: {
            entityType_entityId_userId: {
                entityType,
                entityId,
                userId
            }
        }
    });

    if (!existing) throw new Error("PERSONNEL_NOT_FOUND");

    return prisma.personnel.delete({
        where: {
            entityType_entityId_userId: {
                entityType,
                entityId,
                userId
            }
        }
    });
};

/**
 * Get all matches where a user is listed as personnel
 */
export const getUserMatchesAsPersonnel = async (userId) => {
    const matchPersonnel = await prisma.personnel.findMany({
        where: { userId, entityType: "MATCH" },
        orderBy: { joinedAt: 'desc' }
    });

    const matchIds = matchPersonnel.map(p => p.entityId);

    if (matchIds.length === 0) return [];

    const matches = await prisma.match.findMany({
        where: { id: { in: matchIds } },
        include: {
            location: true,
            tournament: {
                select: { id: true, name: true, sportCode: true }
            },
            participants: {
                include: {
                    user: {
                        select: { id: true, name: true, username: true, profileImage: true }
                    }
                }
            },
            parts: {
                orderBy: { partNumber: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Attach the user's personnel role to each match
    const personnelByMatchId = Object.fromEntries(matchPersonnel.map(p => [p.entityId, p]));

    return matches.map(match => ({
        ...match,
        personnelRole: personnelByMatchId[match.id]?.role ?? null,
        isPrimary: personnelByMatchId[match.id]?.isPrimary ?? false
    }));
};

/**
 * Get all entities where a user is personnel
 */
export const getUserPersonnelAssignments = async (userId) => {
    const assignments = await prisma.personnel.findMany({
        where: { userId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true
                }
            }
        },
        orderBy: { joinedAt: 'desc' }
    });

    // Group by entity type
    const grouped = {
        tournaments: assignments.filter(a => a.entityType === "TOURNAMENT"),
        matches: assignments.filter(a => a.entityType === "MATCH")
    };

    return grouped;
};