-- DropIndex
DROP INDEX "TournamentParticipant_tournamentId_idx";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "servingParticipantId" TEXT,
ALTER COLUMN "playArea" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TournamentParticipant" ALTER COLUMN "tournamentId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_servingParticipantId_fkey" FOREIGN KEY ("servingParticipantId") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
