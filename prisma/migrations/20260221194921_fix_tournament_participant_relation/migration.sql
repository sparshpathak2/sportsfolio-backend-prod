/*
  Warnings:

  - A unique constraint covering the columns `[winnerParticipantId]` on the table `Tournament` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "winnerParticipantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_winnerParticipantId_key" ON "Tournament"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
