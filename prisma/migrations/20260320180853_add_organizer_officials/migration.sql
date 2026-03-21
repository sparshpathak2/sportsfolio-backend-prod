-- CreateTable
CREATE TABLE "TournamentOrganizer" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentOrganizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchOfficial" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchOfficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentOrganizer_tournamentId_idx" ON "TournamentOrganizer"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentOrganizer_userId_idx" ON "TournamentOrganizer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentOrganizer_tournamentId_userId_key" ON "TournamentOrganizer"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "MatchOfficial_matchId_idx" ON "MatchOfficial"("matchId");

-- CreateIndex
CREATE INDEX "MatchOfficial_userId_idx" ON "MatchOfficial"("userId");

-- CreateIndex
CREATE INDEX "MatchOfficial_role_idx" ON "MatchOfficial"("role");

-- CreateIndex
CREATE UNIQUE INDEX "MatchOfficial_matchId_userId_key" ON "MatchOfficial"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "TournamentOrganizer" ADD CONSTRAINT "TournamentOrganizer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentOrganizer" ADD CONSTRAINT "TournamentOrganizer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficial" ADD CONSTRAINT "MatchOfficial_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficial" ADD CONSTRAINT "MatchOfficial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
