/*
  Warnings:

  - You are about to drop the column `officialUserId` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `organizerId` on the `Tournament` table. All the data in the column will be lost.
  - You are about to drop the `MatchOfficial` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TournamentOrganizer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_officialUserId_fkey";

-- DropForeignKey
ALTER TABLE "MatchOfficial" DROP CONSTRAINT "MatchOfficial_matchId_fkey";

-- DropForeignKey
ALTER TABLE "MatchOfficial" DROP CONSTRAINT "MatchOfficial_userId_fkey";

-- DropForeignKey
ALTER TABLE "Tournament" DROP CONSTRAINT "Tournament_organizerId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentOrganizer" DROP CONSTRAINT "TournamentOrganizer_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "TournamentOrganizer" DROP CONSTRAINT "TournamentOrganizer_userId_fkey";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "officialUserId";

-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "organizerId";

-- DropTable
DROP TABLE "MatchOfficial";

-- DropTable
DROP TABLE "TournamentOrganizer";

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Personnel_entityType_entityId_idx" ON "Personnel"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Personnel_userId_idx" ON "Personnel"("userId");

-- CreateIndex
CREATE INDEX "Personnel_role_idx" ON "Personnel"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_entityType_entityId_userId_key" ON "Personnel"("entityType", "entityId", "userId");

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "personnel_tournament_fk" FOREIGN KEY ("entityId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "personnel_match_fk" FOREIGN KEY ("entityId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
