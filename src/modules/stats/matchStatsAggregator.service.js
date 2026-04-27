import prisma from "../../lib/prisma.js";

/**
 * Main aggregator - processes all match events and populates stats tables
 * Called when match completes
 */
export const aggregateMatchStats = async (matchId) => {
    console.log(`\n========== AGGREGATING STATS FOR MATCH ${matchId} ==========`);

    // 1. Get match details
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            participants: {
                include: {
                    user: true,
                    team: {
                        include: {
                            members: true
                        }
                    }
                }
            },
            events: {
                where: { type: "SCORE" }, // Only SCORE events, ignore UNDO
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!match) throw new Error("MATCH_NOT_FOUND");

    // 2. Group events by participant
    const eventsByParticipant = {};
    const eventsByTeam = {};

    for (const event of match.events) {
        const participantId = event.payload.participantId;
        const teamId = event.payload.teamId;
        const userId = event.payload.userId;

        // Group by participant
        if (!eventsByParticipant[participantId]) {
            eventsByParticipant[participantId] = {
                participantId,
                userId,
                teamId,
                events: []
            };
        }
        eventsByParticipant[participantId].events.push(event);

        // Group by team (for team sports)
        if (teamId) {
            if (!eventsByTeam[teamId]) {
                eventsByTeam[teamId] = {
                    teamId,
                    participantIds: [],
                    events: []
                };
            }
            if (!eventsByTeam[teamId].participantIds.includes(participantId)) {
                eventsByTeam[teamId].participantIds.push(participantId);
            }
            eventsByTeam[teamId].events.push(event);
        }
    }

    // 3. Aggregate stats for each participant using sport-specific handlers
    const aggregatedStats = [];

    for (const [participantId, data] of Object.entries(eventsByParticipant)) {
        const participant = match.participants.find(p => p.id === participantId);
        if (!participant) continue;

        // Get sport-specific aggregator
        const aggregator = getSportAggregator(match.sportCode);

        // Aggregate stats from events
        const stats = aggregator.aggregate(data.events, {
            matchId: match.id,
            participant,
            match
        });

        aggregatedStats.push({
            userId: participant.userId,
            teamId: participant.teamId,
            stats
        });
    }

    // 4. Store aggregated stats in database
    await storeAggregatedStats(match, aggregatedStats);

    console.log(`✅ Stats aggregation complete for match ${matchId}`);
    return aggregatedStats;
};

/**
 * Get sport-specific aggregator
 */
const getSportAggregator = (sportCode) => {
    switch (sportCode) {
        case "BADMINTON":
            return badmintonStatsAggregator;
        case "CRICKET":
            return cricketStatsAggregator;
        case "FOOTBALL":
            return footballStatsAggregator;
        default:
            throw new Error(`Unsupported sport: ${sportCode}`);
    }
};

/**
 * BADMINTON Stats Aggregator
 */
const badmintonStatsAggregator = {
    aggregate: (events, context) => {
        const stats = {
            // Shot counts
            smashes: 0,
            drops: 0,
            clears: 0,
            netShots: 0,
            drives: 0,
            lifts: 0,

            // Rally stats
            totalRallies: 0,
            ralliesWon: 0,
            longestRally: 0,
            totalRallyDuration: 0,

            // Winners & Errors
            winners: 0,
            unforcedErrors: 0,
            forcedErrors: 0,

            // Serve stats
            serves: 0,
            serveAces: 0,
            serveErrors: 0,

            // Shot quality
            forehandShots: 0,
            backhandShots: 0,
            overheadShots: 0,

            // Position tracking (optional)
            shotsFromBackcourt: 0,
            shotsFromFrontcourt: 0,
            shotsFromMidcourt: 0
        };

        for (const event of events) {
            const payload = event.payload;
            const sportData = payload.badminton || payload; // Handle both namespaced and flat

            const rawType = sportData.shotType ? String(sportData.shotType).toUpperCase() : null;

            // Normalise compound types from Flutter (e.g. "smash_winner" → "SMASH_WINNER")
            // and extract the base shot and outcome
            const isWinnerShot = rawType && (rawType.endsWith("_WINNER") || rawType === "WINNER" || sportData.isWinner);
            const isUnforcedError = rawType === "UNFORCED_ERROR" || sportData.isUnforcedError;
            const isForcedError = rawType === "FORCED_ERROR" || sportData.isForcedError;
            const isServeAce = rawType === "SERVE_ACE" || sportData.isServeAce;
            const isServeError = rawType === "SERVE_ERROR" || sportData.isServeError;
            const isServe = rawType === "SERVE" || isServeAce || isServeError || sportData.isServe;

            // Extract base shot type (strip trailing _WINNER / _ERROR etc.)
            const baseShotType = rawType
                ? rawType
                    .replace(/_WINNER$/, "")
                    .replace(/_ERROR$/, "")
                    .replace(/_ACE$/, "")
                : null;

            // Map base shot types to stat counters (handles both plain and compound)
            const shotTypeMap = {
                "SMASH":    () => stats.smashes++,
                "DROP":     () => stats.drops++,
                "CLEAR":    () => stats.clears++,
                "NET":      () => stats.netShots++,
                "NET_SHOT": () => stats.netShots++,
                "DRIVE":    () => stats.drives++,
                "LIFT":     () => stats.lifts++,
                "FOREHAND": () => stats.forehandShots++,
                "BACKHAND": () => stats.backhandShots++,
                "OVERHEAD": () => stats.overheadShots++,
            };

            if (baseShotType && shotTypeMap[baseShotType]) {
                shotTypeMap[baseShotType]();
            }

            // Winners & Errors
            if (isWinnerShot) stats.winners++;
            if (isUnforcedError) stats.unforcedErrors++;
            if (isForcedError) stats.forcedErrors++;

            // Serve stats
            if (isServe) stats.serves++;
            if (isServeAce) stats.serveAces++;
            if (isServeError) stats.serveErrors++;

            // Rally stats
            if (sportData.rallyLength && sportData.rallyLength > 0) {
                stats.totalRallies++;
                if (isWinnerShot) stats.ralliesWon++;
                if (sportData.rallyLength > stats.longestRally) {
                    stats.longestRally = sportData.rallyLength;
                }
                if (sportData.rallyDuration) {
                    stats.totalRallyDuration += sportData.rallyDuration;
                }
            }

            // Position tracking
            const fromArea = sportData.fromArea ? String(sportData.fromArea).toUpperCase() : null;
            if (fromArea === "BACKCOURT") stats.shotsFromBackcourt++;
            if (fromArea === "FRONTCOURT") stats.shotsFromFrontcourt++;
            if (fromArea === "MIDCOURT") stats.shotsFromMidcourt++;
        }

        // Calculate derived stats
        stats.averageRally = stats.totalRallies > 0
            ? Math.round(stats.totalRallyDuration / stats.totalRallies)
            : 0;

        return stats;
    }
};

/**
 * CRICKET Stats Aggregator (scalable example)
 */
const cricketStatsAggregator = {
    aggregate: (events, context) => {
        const stats = {
            // Batting
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            dotBalls: 0,

            // Bowling
            overs: 0,
            ballsBowled: 0,
            runsConceded: 0,
            wickets: 0,
            maidens: 0,

            // Fielding
            catches: 0,
            runOuts: 0,
            stumpings: 0,

            // Dismissals
            dismissalType: null,
            bowlerId: null,
            fielderId: null
        };

        for (const event of events) {
            const payload = event.payload;
            const sportData = payload.cricket || payload;

            // Batting events
            if (sportData.runs) {
                stats.runs += sportData.runs;
                stats.ballsFaced++;

                if (sportData.runs === 4) stats.fours++;
                if (sportData.runs === 6) stats.sixes++;
                if (sportData.runs === 0) stats.dotBalls++;
            }

            // Bowling events
            if (sportData.isBall) {
                stats.ballsBowled++;
                stats.runsConceded += sportData.runsConceded || 0;
                if (sportData.isWicket) stats.wickets++;
            }

            // Fielding events
            if (sportData.isCatch) stats.catches++;
            if (sportData.isRunOut) stats.runOuts++;
            if (sportData.isStumping) stats.stumpings++;
        }

        // Calculate overs
        stats.overs = Math.floor(stats.ballsBowled / 6) + (stats.ballsBowled % 6) / 10;
        stats.economy = stats.overs > 0 ? stats.runsConceded / stats.overs : 0;
        stats.strikeRate = stats.ballsFaced > 0 ? (stats.runs / stats.ballsFaced) * 100 : 0;

        return stats;
    }
};

/**
 * FOOTBALL Stats Aggregator (scalable example)
 */
const footballStatsAggregator = {
    aggregate: (events, context) => {
        const stats = {
            // Scoring
            goals: 0,
            assists: 0,
            penalties: 0,
            penaltyGoals: 0,
            ownGoals: 0,

            // Shooting
            shots: 0,
            shotsOnTarget: 0,

            // Passing
            passes: 0,
            passesCompleted: 0,
            keyPasses: 0,

            // Defense
            tackles: 0,
            tacklesWon: 0,
            interceptions: 0,
            blocks: 0,
            clearances: 0,

            // Cards
            yellowCards: 0,
            redCards: 0,

            // Goalkeeper
            saves: 0,
            cleanSheet: false,
            goalsConceded: 0
        };

        for (const event of events) {
            const payload = event.payload;
            const sportData = payload.football || payload;

            if (sportData.isGoal) stats.goals++;
            if (sportData.isAssist) stats.assists++;
            if (sportData.isPenalty) stats.penalties++;
            if (sportData.isPenaltyGoal) stats.penaltyGoals++;
            if (sportData.isOwnGoal) stats.ownGoals++;
            if (sportData.isShot) stats.shots++;
            if (sportData.isShotOnTarget) stats.shotsOnTarget++;
            if (sportData.isPass) stats.passes++;
            if (sportData.isPassCompleted) stats.passesCompleted++;
            if (sportData.isKeyPass) stats.keyPasses++;
            if (sportData.isTackle) stats.tackles++;
            if (sportData.isTackleWon) stats.tacklesWon++;
            if (sportData.isInterception) stats.interceptions++;
            if (sportData.isBlock) stats.blocks++;
            if (sportData.isClearance) stats.clearances++;
            if (sportData.isYellowCard) stats.yellowCards++;
            if (sportData.isRedCard) stats.redCards++;
            if (sportData.isSave) stats.saves++;
            if (sportData.isCleanSheet) stats.cleanSheet = true;
            if (sportData.goalsConceded) stats.goalsConceded += sportData.goalsConceded;
        }

        // Calculate derived stats
        stats.shotAccuracy = stats.shots > 0
            ? (stats.shotsOnTarget / stats.shots) * 100
            : 0;
        stats.passAccuracy = stats.passes > 0
            ? (stats.passesCompleted / stats.passes) * 100
            : 0;
        stats.tackleSuccessRate = stats.tackles > 0
            ? (stats.tacklesWon / stats.tackles) * 100
            : 0;

        return stats;
    }
};

/**
 * Store aggregated stats in database
 */
const storeAggregatedStats = async (match, aggregatedStats) => {
    for (const { userId, teamId, stats } of aggregatedStats) {
        // Determine result (WIN/LOSS) for this participant
        let result = "LOSS";
        if (match.winnerUserId === userId) {
            result = "WIN";
        } else if (match.winnerTeamId === teamId) {
            result = "WIN";
        }

        // Create or update MatchStats
        const matchStats = await prisma.matchStats.upsert({
            where: {
                userId_matchId: {
                    userId,
                    matchId: match.id
                }
            },
            update: {
                result,
                pointsScored: stats.pointsScored || 0,
                pointsConceded: stats.pointsConceded || 0
            },
            create: {
                userId,
                matchId: match.id,
                sportCode: match.sportCode,
                gameType: match.gameType,
                teamId: teamId || null,
                result,
                pointsScored: stats.pointsScored || 0,
                pointsConceded: stats.pointsConceded || 0
            }
        });

        // Store sport-specific stats
        switch (match.sportCode) {
            case "BADMINTON": {
                const badmintonData = {
                    totalRallies: stats.totalRallies || 0,
                    ralliesWon: stats.ralliesWon || 0,
                    longestRally: stats.longestRally || 0,
                    averageRally: stats.averageRally || null,
                    smashes: stats.smashes || 0,
                    drops: stats.drops || 0,
                    clears: stats.clears || 0,
                    netShots: stats.netShots || 0,
                    drives: stats.drives || 0,
                    lifts: stats.lifts || 0,
                    serves: stats.serves || 0,
                    serveAces: stats.serveAces || 0,
                    serveErrors: stats.serveErrors || 0,
                    winners: stats.winners || 0,
                    unforcedErrors: stats.unforcedErrors || 0,
                    forcedErrors: stats.forcedErrors || 0,
                    forehandShots: stats.forehandShots || 0,
                    backhandShots: stats.backhandShots || 0,
                    overheadShots: stats.overheadShots || 0,
                    distanceCovered: stats.distanceCovered || null,
                    biggestComeback: stats.biggestComeback || null,
                    longestStreak: stats.longestStreak || null,
                };
                await prisma.badmintonMatchStats.upsert({
                    where: { matchStatsId: matchStats.id },
                    update: badmintonData,
                    create: { matchStatsId: matchStats.id, ...badmintonData }
                });
                break;
            }

            case "CRICKET":
                await prisma.cricketMatchStats.upsert({
                    where: { matchStatsId: matchStats.id },
                    update: stats,
                    create: {
                        matchStatsId: matchStats.id,
                        ...stats
                    }
                });
                break;

            case "FOOTBALL":
                await prisma.footballMatchStats.upsert({
                    where: { matchStatsId: matchStats.id },
                    update: stats,
                    create: {
                        matchStatsId: matchStats.id,
                        ...stats
                    }
                });
                break;
        }

        console.log(`✅ Stored stats for user ${userId} (${result})`);
    }
};