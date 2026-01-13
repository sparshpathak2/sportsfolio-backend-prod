/*
  Warnings:

  - You are about to drop the `TournamentInvitation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TournamentInvitation" DROP CONSTRAINT "TournamentInvitation_playerId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentInvitation" DROP CONSTRAINT "TournamentInvitation_teamId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentInvitation" DROP CONSTRAINT "TournamentInvitation_tournamentId_fkey";

-- DropTable
DROP TABLE "TournamentInvitation";

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "type" "InvitationType" NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tournamentId" TEXT,
    "matchId" TEXT,
    "playerId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invitation_tournamentId_idx" ON "Invitation"("tournamentId");

-- CreateIndex
CREATE INDEX "Invitation_matchId_idx" ON "Invitation"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tournamentId_playerId_teamId_key" ON "Invitation"("tournamentId", "playerId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_matchId_playerId_teamId_key" ON "Invitation"("matchId", "playerId", "teamId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
