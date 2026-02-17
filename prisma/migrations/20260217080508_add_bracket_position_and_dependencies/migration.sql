-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bracketPosition" INTEGER;

-- CreateTable
CREATE TABLE "MatchDependency" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "dependsOnMatchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketNode" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "nodeIndex" INTEGER NOT NULL,
    "matchId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "byeTeamId" TEXT,
    "parentNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BracketNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchDependency_matchId_idx" ON "MatchDependency"("matchId");

-- CreateIndex
CREATE INDEX "MatchDependency_dependsOnMatchId_idx" ON "MatchDependency"("dependsOnMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchDependency_matchId_dependsOnMatchId_key" ON "MatchDependency"("matchId", "dependsOnMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketNode_matchId_key" ON "BracketNode"("matchId");

-- CreateIndex
CREATE INDEX "BracketNode_tournamentId_idx" ON "BracketNode"("tournamentId");

-- CreateIndex
CREATE INDEX "BracketNode_matchId_idx" ON "BracketNode"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketNode_tournamentId_round_nodeIndex_key" ON "BracketNode"("tournamentId", "round", "nodeIndex");

-- RenameForeignKey
ALTER TABLE "Match" RENAME CONSTRAINT "fk_match_servingParticipant" TO "Match_servingParticipantId_fkey";

-- RenameForeignKey
ALTER TABLE "Match" RENAME CONSTRAINT "fk_match_winnerParticipant" TO "Match_winnerParticipantId_fkey";

-- AddForeignKey
ALTER TABLE "MatchDependency" ADD CONSTRAINT "MatchDependency_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchDependency" ADD CONSTRAINT "MatchDependency_dependsOnMatchId_fkey" FOREIGN KEY ("dependsOnMatchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_parentNodeId_fkey" FOREIGN KEY ("parentNodeId") REFERENCES "BracketNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketNode" ADD CONSTRAINT "BracketNode_byeTeamId_fkey" FOREIGN KEY ("byeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
