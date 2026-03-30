import prisma from "../../lib/prisma.js";

// export const createUser = async ({ phone, email, name }) => {
//     if (!phone) throw new Error("PHONE_REQUIRED");

//     const existing = await prisma.user.findFirst({
//         where: { OR: [{ phone }, { email }] },
//     });

//     if (existing) throw new Error("USER_ALREADY_EXISTS");

//     return prisma.user.create({
//         data: { phone, email, name },
//     });
// };

export const createUser = async ({ phone, name, email }) => {
    if (!phone) throw new Error("PHONE_REQUIRED");
    if (!name) throw new Error("NAME_REQUIRED");

    // Build where clause for checking existing user
    const whereClause = [{ phone }];

    // Only add email to check if it's provided
    if (email) {
        whereClause.push({ email });
    }

    const existing = await prisma.user.findFirst({
        where: { OR: whereClause },
    });

    if (existing) {
        // More specific error message
        if (existing.phone === phone) {
            throw new Error("PHONE_ALREADY_EXISTS");
        }
        if (email && existing.email === email) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }
        throw new Error("USER_ALREADY_EXISTS");
    }

    // Create user with only provided fields
    return prisma.user.create({
        data: {
            phone,
            name,
            ...(email && { email }), // Only include email if provided
        },
    });
};

// export const listUsers = async () => {
//     // 1️⃣ fetch all users with sportProfiles
//     const users = await prisma.user.findMany({
//         include: {
//             sportProfiles: true,
//         },
//     });

//     // 2️⃣ fetch all sports and create a map
//     const sportMap = await prisma.sport.findMany().then(arr => {
//         const map = {};
//         arr.forEach(s => (map[s.code] = s));
//         return map;
//     });

//     // 3️⃣ attach sport details to each user's sportProfiles
//     const usersWithSport = users.map(user => ({
//         ...user,
//         sportProfiles: user.sportProfiles.map(sp => ({
//             ...sp,
//             sport: sportMap[sp.sportCode] || null
//         }))
//     }));

//     // 4️⃣ return users + count
//     return {
//         count: users.length,
//         users: usersWithSport
//     };
// };


/**
 * List users with optional filters and pagination
 * @param {Object} params
 * @param {string} params.city - optional city filter
 * @param {string} params.query - optional search query
 * @param {number} params.page - page number (default 1)
 * @param {number} params.limit - items per page (default 20)
 */
// export const listUsers = async ({ city, query, page = 1, limit = 20 } = {}) => {
//     const where = {};

//     if (city) where.city = city;

//     // sanitize query
//     const searchQuery = query?.trim();

//     if (searchQuery) {
//         where.OR = [
//             { name: { contains: searchQuery, mode: "insensitive" } },
//             { username: { contains: searchQuery, mode: "insensitive" } },
//             { email: { contains: searchQuery, mode: "insensitive" } },
//         ];
//     }

//     const skip = (page - 1) * limit;

//     // 1️⃣ fetch users with sportProfiles
//     const users = await prisma.user.findMany({
//         where,
//         include: { sportProfiles: true },
//         skip,
//         take: limit,
//         orderBy: { name: "asc" },
//     });

//     // 2️⃣ fetch all sports and create a map
//     const sportMap = await prisma.sport.findMany().then(arr => {
//         const map = {};
//         arr.forEach(s => (map[s.code] = s));
//         return map;
//     });

//     // 3️⃣ attach sport details to each user's sportProfiles
//     const usersWithSport = users.map(user => ({
//         ...user,
//         sportProfiles: user.sportProfiles.map(sp => ({
//             ...sp,
//             sport: sportMap[sp.sportCode] || null,
//         })),
//     }));


//     // 4️⃣ fetch total count for pagination
//     const totalCount = await prisma.user.count({ where });

//     return { users: usersWithSport, totalCount };
// };

export const listUsers = async ({ city, query, page = 1, limit = 20, includeArchived = false } = {}) => {
    const where = {};

    // Add this line to filter out archived users by default
    if (!includeArchived) {
        where.isArchived = false;
    }

    if (city) where.city = city;

    // sanitize query
    const searchQuery = query?.trim();

    if (searchQuery) {
        where.OR = [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { username: { contains: searchQuery, mode: "insensitive" } },
            { email: { contains: searchQuery, mode: "insensitive" } },
        ];
    }

    const skip = (page - 1) * limit;

    // 1️⃣ fetch users with sportProfiles
    const users = await prisma.user.findMany({
        where,
        include: { sportProfiles: true },
        skip,
        take: limit,
        orderBy: { name: "asc" },
    });

    // 2️⃣ fetch all sports and create a map
    const sportMap = await prisma.sport.findMany().then(arr => {
        const map = {};
        arr.forEach(s => (map[s.code] = s));
        return map;
    });

    // 3️⃣ attach sport details to each user's sportProfiles
    const usersWithSport = users.map(user => ({
        ...user,
        sportProfiles: user.sportProfiles.map(sp => ({
            ...sp,
            sport: sportMap[sp.sportCode] || null,
        })),
    }));

    // 4️⃣ fetch total count for pagination
    const totalCount = await prisma.user.count({ where });

    return { users: usersWithSport, totalCount };
};


// export const getUserById = async (id) => {
//     // 1️⃣ Fetch user + sportProfiles + sessions + favoriteTeams/favoriteUsers
//     const user = await prisma.user.findUnique({
//         where: { id },
//         select: {
//             id: true,
//             name: true,
//             username: true,
//             phone: true,
//             city: true,

//             // sportProfiles without any invalid include
//             sportProfiles: true,

//             sessions: true,

//             favoriteTeams: {
//                 select: {
//                     team: {
//                         select: {
//                             id: true,
//                             name: true,
//                             sportCode: true, // ✅ use sportCode, NOT sport
//                             isTemporary: true,
//                             createdAt: true,
//                         },
//                     },
//                 },
//             },

//             favoriteUsers: {
//                 select: {
//                     favoriteUser: {
//                         select: {
//                             id: true,
//                             name: true,
//                             username: true,
//                             city: true,
//                         },
//                     },
//                 },
//             },
//         },
//     });

//     if (!user) throw new Error("USER_NOT_FOUND");

//     // 2️⃣ Optionally: attach full Sport info to sportProfiles
//     const sportCodes = user.sportProfiles.map((sp) => sp.sportCode);
//     const sports = await prisma.sport.findMany({
//         where: { code: { in: sportCodes } },
//     });
//     const sportMap = {};
//     sports.forEach((s) => (sportMap[s.code] = s));

//     const sportProfilesWithSport = user.sportProfiles.map((sp) => ({
//         ...sp,
//         sport: sportMap[sp.sportCode] || null,
//     }));

//     return {
//         ...user,
//         sportProfiles: sportProfilesWithSport,
//     };
// };

export const getUserById = async (id, includeArchived = false) => {
    // Build where clause with optional archive filtering
    const where = { id };
    if (!includeArchived) {
        where.isArchived = false;
    }

    // 1️⃣ Fetch user + sportProfiles + sessions + favoriteTeams/favoriteUsers
    const user = await prisma.user.findFirst({
        where,  // Changed from findUnique to findFirst to support additional where conditions
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,
            isArchived: true,     // Add this to know if user is archived
            archivedAt: true,     // Add this to know when they were archived

            // sportProfiles without any invalid include
            sportProfiles: true,

            sessions: true,

            favoriteTeams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            sportCode: true,
                            isTemporary: true,
                            createdAt: true,
                        },
                    },
                },
            },

            favoriteUsers: {
                select: {
                    favoriteUser: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            city: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) throw new Error("USER_NOT_FOUND");

    // 2️⃣ Optionally: attach full Sport info to sportProfiles
    const sportCodes = user.sportProfiles.map((sp) => sp.sportCode);
    const sports = await prisma.sport.findMany({
        where: { code: { in: sportCodes } },
    });
    const sportMap = {};
    sports.forEach((s) => (sportMap[s.code] = s));

    const sportProfilesWithSport = user.sportProfiles.map((sp) => ({
        ...sp,
        sport: sportMap[sp.sportCode] || null,
    }));

    return {
        ...user,
        sportProfiles: sportProfilesWithSport,
    };
};


export const updateUser = async (id, data) => {
    return prisma.user.update({
        where: { id },
        data,
    });
};





// NEW: Archive user (soft delete)
export const archiveUser = async (id) => {
    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.isArchived) throw new Error("USER_ALREADY_ARCHIVED");

    return prisma.user.update({
        where: { id },
        data: {
            isArchived: true,
            archivedAt: new Date(),
        },
    });
};

// NEW: Restore archived user
export const restoreUser = async (id) => {
    const user = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) throw new Error("USER_NOT_FOUND");
    if (!user.isArchived) throw new Error("USER_NOT_ARCHIVED");

    return prisma.user.update({
        where: { id },
        data: {
            isArchived: false,
            archivedAt: null,
        },
    });
};