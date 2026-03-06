-- CreateTable
CREATE TABLE "MatchStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sportCode" "SportCode" NOT NULL,
    "gameType" "GameType" NOT NULL,
    "teamId" TEXT,
    "result" TEXT NOT NULL,
    "pointsScored" INTEGER NOT NULL DEFAULT 0,
    "pointsConceded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchStats_userId_sportCode_idx" ON "MatchStats"("userId", "sportCode");

-- CreateIndex
CREATE INDEX "MatchStats_sportCode_gameType_idx" ON "MatchStats"("sportCode", "gameType");

-- CreateIndex
CREATE INDEX "MatchStats_createdAt_idx" ON "MatchStats"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStats_userId_matchId_key" ON "MatchStats"("userId", "matchId");

-- AddForeignKey
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
