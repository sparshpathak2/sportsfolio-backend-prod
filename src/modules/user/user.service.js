import prisma from "../../lib/prisma.js";

export const createUser = async ({ phone, email, name }) => {
    if (!phone) throw new Error("PHONE_REQUIRED");

    const existing = await prisma.user.findFirst({
        where: { OR: [{ phone }, { email }] },
    });

    if (existing) throw new Error("USER_ALREADY_EXISTS");

    return prisma.user.create({
        data: { phone, email, name },
    });
};


// export const listUsers = async () => {
//     const users = await prisma.user.findMany({
//         include: {
//             sportProfiles: true,
//         },
//     });

//     // attach sport details
//     const sportMap = await prisma.sport.findMany().then(arr => {
//         const map = {};
//         arr.forEach(s => (map[s.code] = s));
//         return map;
//     });

//     return users.map(user => ({
//         ...user,
//         sportProfiles: user.sportProfiles.map(sp => ({
//             ...sp,
//             sport: sportMap[sp.sportCode] || null
//         }))
//     }));
// };

export const listUsers = async () => {
    // 1️⃣ fetch all users with sportProfiles
    const users = await prisma.user.findMany({
        include: {
            sportProfiles: true,
        },
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
            sport: sportMap[sp.sportCode] || null
        }))
    }));

    // 4️⃣ return users + count
    return {
        count: users.length,
        users: usersWithSport
    };
};


export const getUserById = async (id) => {
    // 1️⃣ Fetch user + sportProfiles + sessions + favoriteTeams/favoriteUsers
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,

            // sportProfiles without any invalid include
            sportProfiles: true,

            sessions: true,

            favoriteTeams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            sportCode: true, // ✅ use sportCode, NOT sport
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
