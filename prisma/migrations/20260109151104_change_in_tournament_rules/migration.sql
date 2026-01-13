/*
  Warnings:

  - You are about to drop the column `matchesPerPlayAreaPerDay` on the `TournamentRules` table. All the data in the column will be lost.
  - You are about to drop the column `reportingTimeMinutes` on the `TournamentRules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TournamentRules" DROP COLUMN "matchesPerPlayAreaPerDay",
DROP COLUMN "reportingTimeMinutes";

-- CreateTable
CREATE TABLE "ReportingSlot" (
    "id" TEXT NOT NULL,
    "tournamentRulesId" TEXT NOT NULL,
    "playArea" INTEGER NOT NULL,
    "dayOfWeek" "WeekDay" NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "reportTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportingSlot_tournamentRulesId_playArea_dayOfWeek_slotInde_key" ON "ReportingSlot"("tournamentRulesId", "playArea", "dayOfWeek", "slotIndex");

-- AddForeignKey
ALTER TABLE "ReportingSlot" ADD CONSTRAINT "ReportingSlot_tournamentRulesId_fkey" FOREIGN KEY ("tournamentRulesId") REFERENCES "TournamentRules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
