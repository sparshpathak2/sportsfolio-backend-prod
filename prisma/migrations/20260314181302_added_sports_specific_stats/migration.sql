-- CreateTable
CREATE TABLE "BadmintonMatchStats" (
    "id" TEXT NOT NULL,
    "matchStatsId" TEXT NOT NULL,
    "totalRallies" INTEGER NOT NULL DEFAULT 0,
    "ralliesWon" INTEGER NOT NULL DEFAULT 0,
    "longestRally" INTEGER NOT NULL DEFAULT 0,
    "averageRally" DOUBLE PRECISION,
    "smashes" INTEGER NOT NULL DEFAULT 0,
    "drops" INTEGER NOT NULL DEFAULT 0,
    "clears" INTEGER NOT NULL DEFAULT 0,
    "netShots" INTEGER NOT NULL DEFAULT 0,
    "drives" INTEGER NOT NULL DEFAULT 0,
    "lifts" INTEGER NOT NULL DEFAULT 0,
    "serves" INTEGER NOT NULL DEFAULT 0,
    "serveAces" INTEGER NOT NULL DEFAULT 0,
    "serveErrors" INTEGER NOT NULL DEFAULT 0,
    "winners" INTEGER NOT NULL DEFAULT 0,
    "unforcedErrors" INTEGER NOT NULL DEFAULT 0,
    "forcedErrors" INTEGER NOT NULL DEFAULT 0,
    "forehandShots" INTEGER NOT NULL DEFAULT 0,
    "backhandShots" INTEGER NOT NULL DEFAULT 0,
    "overheadShots" INTEGER NOT NULL DEFAULT 0,
    "distanceCovered" DOUBLE PRECISION,
    "biggestComeback" INTEGER,
    "longestStreak" INTEGER,

    CONSTRAINT "BadmintonMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CricketMatchStats" (
    "id" TEXT NOT NULL,
    "matchStatsId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "strikeRate" DOUBLE PRECISION,
    "dotBalls" INTEGER NOT NULL DEFAULT 0,
    "dismissalType" TEXT,
    "bowlerId" TEXT,
    "fielderId" TEXT,
    "overs" DOUBLE PRECISION,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "economy" DOUBLE PRECISION,
    "dotBallsBowled" INTEGER NOT NULL DEFAULT 0,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "runOuts" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "isPlayerOfMatch" BOOLEAN NOT NULL DEFAULT false,
    "matchImpact" DOUBLE PRECISION,

    CONSTRAINT "CricketMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootballMatchStats" (
    "id" TEXT NOT NULL,
    "matchStatsId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "penalties" INTEGER NOT NULL DEFAULT 0,
    "penaltyGoals" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "shots" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "shotAccuracy" DOUBLE PRECISION,
    "passes" INTEGER NOT NULL DEFAULT 0,
    "passesCompleted" INTEGER NOT NULL DEFAULT 0,
    "passAccuracy" DOUBLE PRECISION,
    "keyPasses" INTEGER NOT NULL DEFAULT 0,
    "crosses" INTEGER NOT NULL DEFAULT 0,
    "throughBalls" INTEGER NOT NULL DEFAULT 0,
    "tackles" INTEGER NOT NULL DEFAULT 0,
    "tacklesWon" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 0,
    "clearances" INTEGER NOT NULL DEFAULT 0,
    "dribbledPast" INTEGER NOT NULL DEFAULT 0,
    "touches" INTEGER NOT NULL DEFAULT 0,
    "dispossessed" INTEGER NOT NULL DEFAULT 0,
    "turnovers" INTEGER NOT NULL DEFAULT 0,
    "duels" INTEGER NOT NULL DEFAULT 0,
    "duelsWon" INTEGER NOT NULL DEFAULT 0,
    "aerialDuels" INTEGER NOT NULL DEFAULT 0,
    "aerialDuelsWon" INTEGER NOT NULL DEFAULT 0,
    "foulsCommitted" INTEGER NOT NULL DEFAULT 0,
    "foulsWon" INTEGER NOT NULL DEFAULT 0,
    "offsides" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "savePercentage" DOUBLE PRECISION,
    "distanceCovered" DOUBLE PRECISION,
    "sprints" INTEGER NOT NULL DEFAULT 0,
    "topSpeed" DOUBLE PRECISION,

    CONSTRAINT "FootballMatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sportCode" "SportCode" NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" TEXT,
    "progress" INTEGER,
    "target" INTEGER,
    "unlockedAt" TIMESTAMP(3),
    "streakType" TEXT,
    "streakStart" TIMESTAMP(3),
    "streakEnd" TIMESTAMP(3),
    "isActive" BOOLEAN,
    "icon" TEXT,
    "nameHindi" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "sportCode" "SportCode" NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "lastPlayedAt" TIMESTAMP(3),

    CONSTRAINT "CourtStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BadmintonMatchStats_matchStatsId_key" ON "BadmintonMatchStats"("matchStatsId");

-- CreateIndex
CREATE UNIQUE INDEX "CricketMatchStats_matchStatsId_key" ON "CricketMatchStats"("matchStatsId");

-- CreateIndex
CREATE UNIQUE INDEX "FootballMatchStats_matchStatsId_key" ON "FootballMatchStats"("matchStatsId");

-- CreateIndex
CREATE INDEX "Achievement_userId_sportCode_unlockedAt_idx" ON "Achievement"("userId", "sportCode", "unlockedAt");

-- CreateIndex
CREATE INDEX "Achievement_userId_sportCode_type_idx" ON "Achievement"("userId", "sportCode", "type");

-- CreateIndex
CREATE INDEX "Achievement_userId_sportCode_streakType_isActive_idx" ON "Achievement"("userId", "sportCode", "streakType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_sportCode_name_key" ON "Achievement"("userId", "sportCode", "name");

-- CreateIndex
CREATE INDEX "CourtStats_userId_sportCode_idx" ON "CourtStats"("userId", "sportCode");

-- CreateIndex
CREATE UNIQUE INDEX "CourtStats_userId_locationId_sportCode_key" ON "CourtStats"("userId", "locationId", "sportCode");

-- AddForeignKey
ALTER TABLE "BadmintonMatchStats" ADD CONSTRAINT "BadmintonMatchStats_matchStatsId_fkey" FOREIGN KEY ("matchStatsId") REFERENCES "MatchStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CricketMatchStats" ADD CONSTRAINT "CricketMatchStats_matchStatsId_fkey" FOREIGN KEY ("matchStatsId") REFERENCES "MatchStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootballMatchStats" ADD CONSTRAINT "FootballMatchStats_matchStatsId_fkey" FOREIGN KEY ("matchStatsId") REFERENCES "MatchStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtStats" ADD CONSTRAINT "CourtStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtStats" ADD CONSTRAINT "CourtStats_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
