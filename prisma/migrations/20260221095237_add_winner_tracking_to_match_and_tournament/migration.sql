-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "winnerTeamId" TEXT,
ADD COLUMN     "winnerUserId" TEXT;

-- AlterTable
ALTER TABLE "MatchPart" ADD COLUMN     "winnerTeamId" TEXT,
ADD COLUMN     "winnerUserId" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "winnerTeamId" TEXT,
ADD COLUMN     "winnerUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPart" ADD CONSTRAINT "MatchPart_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPart" ADD CONSTRAINT "MatchPart_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
