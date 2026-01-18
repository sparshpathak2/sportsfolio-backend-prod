/*
  Warnings:

  - You are about to drop the column `locationId` on the `Tournament` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Tournament" DROP CONSTRAINT "Tournament_locationId_fkey";

-- AlterTable
ALTER TABLE "Tournament" DROP COLUMN "locationId";

-- CreateTable
CREATE TABLE "_LocationToTournament" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_LocationToTournament_AB_unique" ON "_LocationToTournament"("A", "B");

-- CreateIndex
CREATE INDEX "_LocationToTournament_B_index" ON "_LocationToTournament"("B");

-- AddForeignKey
ALTER TABLE "_LocationToTournament" ADD CONSTRAINT "_LocationToTournament_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationToTournament" ADD CONSTRAINT "_LocationToTournament_B_fkey" FOREIGN KEY ("B") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
