import prisma from "../../lib/prisma.js";

// ==================== ACHIEVEMENT DEFINITIONS ==================== //

export const ACHIEVEMENT_DEFINITIONS = [
    {
        name: "First Match",
        description: "My badminton journey has started. First match on record.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🏸",
        target: 1,
    },
    {
        name: "Consistency Starter",
        description: "Small steps, big consistency.",
        type: "MILESTONE",
        tier: "BRONZE",
        icon: "📅",
        target: 3,
    },
    {
        name: "Consistency Pro",
        description: "Consistency is my real opponent.",
        type: "MILESTONE",
        tier: "SILVER",
        icon: "💪",
        target: 10,
    },
    {
        name: "Weekend Player",
        description: "Weekends are for badminton.",
        type: "BADGE",
        tier: "SILVER",
        icon: "🗓️",
        target: 3,
    },
    {
        name: "Winning Start",
        description: "First win on the board.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🥇",
        target: 1,
    },
    {
        name: "Winning Streak",
        description: "3 wins in a row. Momentum building.",
        type: "STREAK",
        tier: "SILVER",
        icon: "🔥",
        target: 3,
    },
    {
        name: "Marathon Day",
        description: "Test of stamina. 3 matches in one day.",
        type: "BADGE",
        tier: "SILVER",
        icon: "⚡",
        target: 3,
    },
    {
        name: "Close Match Fighter",
        description: "Fought till the last point.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "⚔️",
        target: 1,
    },
    {
        name: "Comeback Player",
        description: "Never give up. Great comeback.",
        type: "BADGE",
        tier: "SILVER",
        icon: "↩️",
        target: 1,
    },
    {
        name: "Doubles Partner",
        description: "Strong partnership on court.",
        type: "BADGE",
        tier: "SILVER",
        icon: "🤝",
        target: 5,
    },
    {
        name: "Singles Grind",
        description: "Singles grind unlocked.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🏃",
        target: 10,
    },
    {
        name: "Early Bird",
        description: "Early morning discipline.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🌅",
        target: 1,
    },
    {
        name: "Night Player",
        description: "Late night badminton session.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🌙",
        target: 1,
    },
    {
        name: "Tournament Player",
        description: "Tournament player badge unlocked.",
        type: "BADGE",
        tier: "BRONZE",
        icon: "🏟️",
        target: 1,
    },
    {
        name: "Semi Finalist",
        description: "Top 4 finish.",
        type: "BADGE",
        tier: "SILVER",
        icon: "🥈",
        target: 1,
    },
    {
        name: "Finalist",
        description: "Final stage player.",
        type: "BADGE",
        tier: "GOLD",
        icon: "🏅",
        target: 1,
    },
    {
        name: "Champion",
        description: "Champion title unlocked.",
        type: "TROPHY",
        tier: "PLATINUM",
        icon: "🏆",
        target: 1,
    },
    {
        name: "Active Player",
        description: "Active player streak.",
        type: "STREAK",
        tier: "GOLD",
        icon: "📈",
        target: 4,
    },
];

// ==================== HELPERS ==================== //

/**
 * Upsert an achievement record.
 * Returns { achievement, isNew } where isNew = was just now unlocked for the first time.
 */
const upsertAchievement = async (userId, sportCode, name, data) => {
    const definition = ACHIEVEMENT_DEFINITIONS.find((d) => d.name === name);
    if (!definition) return { achievement: null, isNew: false };

    const wasAlreadyUnlocked = await prisma.achievement.findUnique({
        where: { userId_sportCode_name: { userId, sportCode, name } },
        select: { unlockedAt: true },
    });

    const achievement = await prisma.achievement.upsert({
        where: { userId_sportCode_name: { userId, sportCode, name } },
        create: {
            userId,
            sportCode,
            name,
            description: definition.description,
            type: definition.type,
            tier: definition.tier,
            icon: definition.icon,
            target: definition.target,
            ...data,
        },
        update: data,
    });

    const isNew = !wasAlreadyUnlocked?.unlockedAt && !!achievement.unlockedAt;
    return { achievement, isNew };
};

// ==================== INDIVIDUAL CHECK FUNCTIONS ==================== //

const checkFirstMatch = async (userId) => {
    const count = await prisma.matchStats.count({
        where: { userId, sportCode: "BADMINTON" },
    });

    const progress = Math.min(count, 1);
    const unlocked = count >= 1;

    return upsertAchievement(userId, "BADMINTON", "First Match", {
        progress,
        target: 1,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkConsistencyStarter = async (userId) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const count = await prisma.matchStats.count({
        where: { userId, sportCode: "BADMINTON", createdAt: { gte: weekAgo } },
    });

    const progress = Math.min(count, 3);
    const unlocked = count >= 3;

    return upsertAchievement(userId, "BADMINTON", "Consistency Starter", {
        progress,
        target: 3,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkConsistencyPro = async (userId) => {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const count = await prisma.matchStats.count({
        where: { userId, sportCode: "BADMINTON", createdAt: { gte: monthAgo } },
    });

    const progress = Math.min(count, 10);
    const unlocked = count >= 10;

    return upsertAchievement(userId, "BADMINTON", "Consistency Pro", {
        progress,
        target: 10,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkWeekendPlayer = async (userId) => {
    // Fetch all match dates for badminton, ordered ascending
    const matchStats = await prisma.matchStats.findMany({
        where: { userId, sportCode: "BADMINTON" },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
    });

    // Build set of unique "week number" for weekends played
    // A "weekend" is Saturday (6) or Sunday (0) — track by ISO week + year
    const weekendWeeks = new Set();
    for (const ms of matchStats) {
        const d = new Date(ms.createdAt);
        const day = d.getDay(); // 0 = Sun, 6 = Sat
        if (day === 0 || day === 6) {
            // Get ISO week number
            const yearStart = new Date(Date.UTC(d.getFullYear(), 0, 1));
            const weekNo = Math.ceil(((d - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
            weekendWeeks.add(`${d.getFullYear()}-${weekNo}`);
        }
    }

    const weekendList = Array.from(weekendWeeks).sort();

    // Count consecutive weekends
    let maxConsecutive = 0;
    let currentRun = 1;
    for (let i = 1; i < weekendList.length; i++) {
        const [prevYear, prevWeek] = weekendList[i - 1].split("-").map(Number);
        const [currYear, currWeek] = weekendList[i].split("-").map(Number);
        const totalPrevWeek = prevYear * 52 + prevWeek;
        const totalCurrWeek = currYear * 52 + currWeek;

        if (totalCurrWeek - totalPrevWeek === 1) {
            currentRun++;
        } else {
            currentRun = 1;
        }
        maxConsecutive = Math.max(maxConsecutive, currentRun);
    }
    if (weekendList.length > 0) maxConsecutive = Math.max(maxConsecutive, 1);

    const progress = Math.min(maxConsecutive, 3);
    const unlocked = maxConsecutive >= 3;

    return upsertAchievement(userId, "BADMINTON", "Weekend Player", {
        progress,
        target: 3,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkWinningStart = async (userId) => {
    const winCount = await prisma.matchStats.count({
        where: { userId, sportCode: "BADMINTON", result: "WIN" },
    });

    const progress = Math.min(winCount, 1);
    const unlocked = winCount >= 1;

    return upsertAchievement(userId, "BADMINTON", "Winning Start", {
        progress,
        target: 1,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkWinningStreak = async (userId) => {
    // Fetch last 3 results
    const recent = await prisma.matchStats.findMany({
        where: { userId, sportCode: "BADMINTON" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { result: true },
    });

    // Count current consecutive wins from most recent
    let consecutiveWins = 0;
    for (const ms of recent) {
        if (ms.result === "WIN") {
            consecutiveWins++;
        } else {
            break;
        }
    }

    const progress = Math.min(consecutiveWins, 3);
    const unlocked = consecutiveWins >= 3;

    return upsertAchievement(userId, "BADMINTON", "Winning Streak", {
        progress,
        target: 3,
        isActive: unlocked,
        streakType: "WIN_STREAK",
        ...(unlocked && { unlockedAt: new Date(), streakEnd: new Date() }),
    });
};

const checkMarathonDay = async (userId) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const count = await prisma.matchStats.count({
        where: {
            userId,
            sportCode: "BADMINTON",
            createdAt: { gte: todayStart, lt: todayEnd },
        },
    });

    const progress = Math.min(count, 3);
    const unlocked = count >= 3;

    return upsertAchievement(userId, "BADMINTON", "Marathon Day", {
        progress,
        target: 3,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkCloseMatchFighter = async (userId, matchId) => {
    // Check if this specific match had a 21-19 or 22-20 set score
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: true,
            participants: { select: { userId: true, side: true } },
        },
    });

    if (!match) return { achievement: null, isNew: false };

    let isCloseMatch = false;
    for (const part of match.parts) {
        const scores = [part.p1Score, part.p2Score].sort((a, b) => a - b);
        const [lower, higher] = scores;
        if ((higher === 21 && lower === 19) || (higher === 22 && lower === 20)) {
            isCloseMatch = true;
            break;
        }
    }

    if (!isCloseMatch) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Close Match Fighter", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkComebackPlayer = async (userId, matchId, result) => {
    if (result !== "WIN") return { achievement: null, isNew: false };

    // Check if user lost the first part but won overall
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            parts: { orderBy: { partNumber: "asc" } },
            participants: { select: { userId: true, side: true } },
        },
    });

    if (!match || match.parts.length < 2) return { achievement: null, isNew: false };

    const userSide = match.participants.find((p) => p.userId === userId)?.side;
    if (userSide == null) return { achievement: null, isNew: false };

    const firstPart = match.parts[0];
    const userFirstPartScore = userSide === 1 ? firstPart.p1Score : firstPart.p2Score;
    const oppFirstPartScore = userSide === 1 ? firstPart.p2Score : firstPart.p1Score;
    const lostFirstPart = userFirstPartScore < oppFirstPartScore;

    if (!lostFirstPart) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Comeback Player", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkDoublesPartner = async (userId, matchId, gameType) => {
    if (gameType !== "DOUBLES") return { achievement: null, isNew: false };

    // Find all doubles matches for this user, grouped by co-participant
    const doublesStats = await prisma.matchStats.findMany({
        where: { userId, sportCode: "BADMINTON", gameType: "DOUBLES" },
        select: { matchId: true },
    });

    const matchIds = doublesStats.map((ms) => ms.matchId);
    if (matchIds.length === 0) return { achievement: null, isNew: false };

    // Find all co-participants in those matches (same team side)
    const userParticipations = await prisma.matchParticipant.findMany({
        where: { matchId: { in: matchIds }, userId },
        select: { matchId: true, side: true, teamId: true },
    });

    // Count matches per co-participant
    const partnerCount = {};
    for (const participation of userParticipations) {
        const teammates = await prisma.matchParticipant.findMany({
            where: {
                matchId: participation.matchId,
                teamId: participation.teamId,
                NOT: { userId },
            },
            select: { userId: true },
        });

        for (const teammate of teammates) {
            if (!teammate.userId) continue;
            partnerCount[teammate.userId] = (partnerCount[teammate.userId] || 0) + 1;
        }
    }

    const maxPartnerMatches = Math.max(0, ...Object.values(partnerCount));
    const progress = Math.min(maxPartnerMatches, 5);
    const unlocked = maxPartnerMatches >= 5;

    return upsertAchievement(userId, "BADMINTON", "Doubles Partner", {
        progress,
        target: 5,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkSinglesGrind = async (userId, gameType) => {
    if (gameType !== "SINGLES") return { achievement: null, isNew: false };

    const count = await prisma.matchStats.count({
        where: { userId, sportCode: "BADMINTON", gameType: "SINGLES" },
    });

    const progress = Math.min(count, 10);
    const unlocked = count >= 10;

    return upsertAchievement(userId, "BADMINTON", "Singles Grind", {
        progress,
        target: 10,
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

const checkEarlyBird = async (userId, matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { startedAt: true },
    });

    if (!match?.startedAt) return { achievement: null, isNew: false };

    const hour = new Date(match.startedAt).getHours();
    if (hour >= 8) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Early Bird", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkNightPlayer = async (userId, matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { startedAt: true },
    });

    if (!match?.startedAt) return { achievement: null, isNew: false };

    const hour = new Date(match.startedAt).getHours();
    if (hour < 22) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Night Player", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkActivePlayer = async (userId) => {
    // Check last 4 complete calendar weeks (Mon–Sun), user must have ≥2 matches in each
    const now = new Date();

    // Get current day of week (0=Sun, 1=Mon, ..., 6=Sat); normalize to Mon=0
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

    // Start of the current week (Monday)
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);

    // We need 4 complete weeks before the current week
    const weeks = [];
    for (let i = 4; i >= 1; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        weeks.push({ start: weekStart, end: weekEnd });
    }

    let qualifyingWeeks = 0;
    for (const week of weeks) {
        const count = await prisma.matchStats.count({
            where: {
                userId,
                sportCode: "BADMINTON",
                createdAt: { gte: week.start, lt: week.end },
            },
        });
        if (count >= 2) qualifyingWeeks++;
    }

    const progress = Math.min(qualifyingWeeks, 4);
    const unlocked = qualifyingWeeks >= 4;

    return upsertAchievement(userId, "BADMINTON", "Active Player", {
        progress,
        target: 4,
        isActive: unlocked,
        streakType: "ACTIVITY_STREAK",
        ...(unlocked && { unlockedAt: new Date() }),
    });
};

// ==================== TOURNAMENT ACHIEVEMENTS ==================== //

const checkTournamentPlayer = async (userId) => {
    const count = await prisma.matchStats.count({
        where: {
            userId,
            sportCode: "BADMINTON",
            match: { tournamentId: { not: null } },
        },
    });

    const unlocked = count >= 1;
    if (!unlocked) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Tournament Player", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkSemiFinalist = async (userId, matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true, round: true },
    });

    if (!match?.tournamentId || match.round == null) return { achievement: null, isNew: false };

    // Get max round in tournament
    const maxRoundResult = await prisma.match.aggregate({
        where: { tournamentId: match.tournamentId },
        _max: { round: true },
    });

    const maxRound = maxRoundResult._max.round;
    if (maxRound == null || match.round !== maxRound - 1) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Semi Finalist", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkFinalist = async (userId, matchId) => {
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true, round: true },
    });

    if (!match?.tournamentId || match.round == null) return { achievement: null, isNew: false };

    const maxRoundResult = await prisma.match.aggregate({
        where: { tournamentId: match.tournamentId },
        _max: { round: true },
    });

    const maxRound = maxRoundResult._max.round;
    if (maxRound == null || match.round !== maxRound) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Finalist", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

const checkChampion = async (userId, matchId, result) => {
    if (result !== "WIN") return { achievement: null, isNew: false };

    const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { tournamentId: true, round: true },
    });

    if (!match?.tournamentId || match.round == null) return { achievement: null, isNew: false };

    const maxRoundResult = await prisma.match.aggregate({
        where: { tournamentId: match.tournamentId },
        _max: { round: true },
    });

    const maxRound = maxRoundResult._max.round;
    if (maxRound == null || match.round !== maxRound) return { achievement: null, isNew: false };

    return upsertAchievement(userId, "BADMINTON", "Champion", {
        progress: 1,
        target: 1,
        unlockedAt: new Date(),
    });
};

// ==================== ORCHESTRATORS ==================== //

/**
 * Run all match-based achievement checks for a player.
 * Called automatically after every match ends.
 * Returns array of newly unlocked achievement names.
 */
export const checkMatchBasedAchievements = async (userId, matchId, result, gameType, sportCode) => {
    if (sportCode !== "BADMINTON") return [];

    const results = await Promise.allSettled([
        checkFirstMatch(userId),
        checkConsistencyStarter(userId),
        checkConsistencyPro(userId),
        checkWeekendPlayer(userId),
        checkWinningStart(userId),
        checkWinningStreak(userId),
        checkMarathonDay(userId),
        checkCloseMatchFighter(userId, matchId),
        checkComebackPlayer(userId, matchId, result),
        checkDoublesPartner(userId, matchId, gameType),
        checkSinglesGrind(userId, gameType),
        checkEarlyBird(userId, matchId),
        checkNightPlayer(userId, matchId),
        checkActivePlayer(userId),
    ]);

    const newlyUnlocked = [];
    for (const r of results) {
        if (r.status === "fulfilled" && r.value?.isNew) {
            newlyUnlocked.push(r.value.achievement.name);
        }
    }

    return newlyUnlocked;
};

/**
 * Run tournament-related achievement checks for a player.
 * Called when a tournament match ends (for all participants).
 */
export const checkTournamentMatchAchievements = async (userId, matchId, result) => {
    const results = await Promise.allSettled([
        checkTournamentPlayer(userId),
        checkSemiFinalist(userId, matchId),
        checkFinalist(userId, matchId),
        checkChampion(userId, matchId, result),
    ]);

    const newlyUnlocked = [];
    for (const r of results) {
        if (r.status === "fulfilled" && r.value?.isNew) {
            newlyUnlocked.push(r.value.achievement.name);
        }
    }

    return newlyUnlocked;
};

// ==================== READ / QUERY FUNCTIONS ==================== //

/**
 * Get all 18 badminton achievements for a user with lock status and progress.
 */
export const getBadmintonAchievements = async (userId) => {
    const dbAchievements = await prisma.achievement.findMany({
        where: { userId, sportCode: "BADMINTON" },
        orderBy: [
            { unlockedAt: { sort: "desc", nulls: "last" } },
            { progress: "desc" },
        ],
    });

    const dbMap = new Map(dbAchievements.map((a) => [a.name, a]));

    // Merge definitions with DB state; include definitions not yet in DB as locked
    const achievements = ACHIEVEMENT_DEFINITIONS.map((def) => {
        const db = dbMap.get(def.name);
        const progress = db?.progress ?? 0;
        const target = def.target;
        const percentage = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;

        return {
            id: db?.id ?? null,
            name: def.name,
            description: def.description,
            type: def.type,
            tier: def.tier,
            icon: def.icon,
            isUnlocked: !!db?.unlockedAt,
            progress,
            target,
            percentage,
            unlockedAt: db?.unlockedAt ?? null,
            isActive: db?.isActive ?? null,
        };
    });

    const totalUnlocked = achievements.filter((a) => a.isUnlocked).length;
    const totalAchievements = ACHIEVEMENT_DEFINITIONS.length;

    const recentlyUnlocked = achievements
        .filter((a) => a.isUnlocked)
        .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
        .slice(0, 6);

    const inProgress = achievements.filter(
        (a) => !a.isUnlocked && a.progress > 0
    );

    return {
        summary: {
            totalUnlocked,
            totalAchievements,
            progressPercentage:
                totalAchievements > 0
                    ? Math.round((totalUnlocked / totalAchievements) * 100)
                    : 0,
        },
        achievements,
        recentlyUnlocked,
        inProgress,
    };
};

/**
 * Get share card data for a specific achievement.
 * The achievement must exist (unlocked or in progress) in the DB.
 */
export const getShareCard = async (userId, achievementId) => {
    const achievement = await prisma.achievement.findUnique({
        where: { id: achievementId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    profileImage: true,
                },
            },
        },
    });

    if (!achievement || achievement.userId !== userId) {
        return null;
    }

    return {
        achievementName: achievement.name,
        shareCardText: achievement.description,
        tier: achievement.tier,
        icon: achievement.icon,
        type: achievement.type,
        isUnlocked: !!achievement.unlockedAt,
        unlockedAt: achievement.unlockedAt,
        progress: achievement.progress,
        target: achievement.target,
        user: achievement.user,
    };
};

/**
 * On-demand: evaluate all achievements for a user using their latest match.
 * Returns newly unlocked achievement names.
 */
export const evaluateAllAchievements = async (userId) => {
    const latestStat = await prisma.matchStats.findFirst({
        where: { userId, sportCode: "BADMINTON" },
        orderBy: { createdAt: "desc" },
        select: { matchId: true, result: true, gameType: true },
    });

    if (!latestStat) {
        return { newlyUnlocked: [], message: "No matches found to evaluate" };
    }

    const newlyUnlocked = await checkMatchBasedAchievements(
        userId,
        latestStat.matchId,
        latestStat.result,
        latestStat.gameType,
        "BADMINTON"
    );

    // Also run tournament checks using the latest match
    const tournamentNewlyUnlocked = await checkTournamentMatchAchievements(
        userId,
        latestStat.matchId,
        latestStat.result
    );

    return {
        newlyUnlocked: [...new Set([...newlyUnlocked, ...tournamentNewlyUnlocked])],
    };
};
