/*
  Warnings:

  - You are about to drop the column `participantId` on the `MatchParticipant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[servingParticipantId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[winnerParticipantId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `MatchParticipant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_servingParticipantId_fkey";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_winnerParticipantId_fkey";

-- DropForeignKey
ALTER TABLE "MatchPart" DROP CONSTRAINT "MatchPart_winnerParticipantId_fkey";

-- DropForeignKey
ALTER TABLE "MatchParticipant" DROP CONSTRAINT "MatchParticipant_participantId_fkey";

-- AlterTable
ALTER TABLE "MatchParticipant" DROP COLUMN "participantId",
ADD COLUMN     "team" INTEGER,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "position" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Match_servingParticipantId_key" ON "Match"("servingParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_winnerParticipantId_key" ON "Match"("winnerParticipantId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "fk_match_servingParticipant" FOREIGN KEY ("servingParticipantId") REFERENCES "MatchParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "fk_match_winnerParticipant" FOREIGN KEY ("winnerParticipantId") REFERENCES "MatchParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPart" ADD CONSTRAINT "fk_matchPart_winner" FOREIGN KEY ("winnerParticipantId") REFERENCES "MatchParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
