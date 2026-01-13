/*
  Warnings:

  - Added the required column `maxParticipants` to the `TournamentRules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isTemporary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "matchMakingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TournamentRules" ADD COLUMN     "maxParticipants" INTEGER NOT NULL,
ADD COLUMN     "minParticipants" INTEGER;
