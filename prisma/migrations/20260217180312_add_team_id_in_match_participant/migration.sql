-- AlterTable
ALTER TABLE "MatchParticipant" ADD COLUMN     "side" INTEGER,
ADD COLUMN     "teamId" TEXT;

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
