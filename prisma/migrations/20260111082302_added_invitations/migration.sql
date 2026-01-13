-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('PLAYER', 'TEAM');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "TournamentInvitation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT,
    "teamId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentInvitation_tournamentId_idx" ON "TournamentInvitation"("tournamentId");

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
