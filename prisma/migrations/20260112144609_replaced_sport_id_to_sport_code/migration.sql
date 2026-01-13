/*
  Warnings:

  - You are about to drop the column `sportId` on the `SportProfile` table. All the data in the column will be lost.
  - You are about to drop the column `sportId` on the `Team` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,sportCode]` on the table `SportProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sportCode` to the `SportProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sportCode` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SportProfile" DROP CONSTRAINT "SportProfile_sportId_fkey";

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_sportId_fkey";

-- DropIndex
DROP INDEX "SportProfile_userId_sportId_key";

-- AlterTable
ALTER TABLE "SportProfile" DROP COLUMN "sportId",
ADD COLUMN     "sportCode" "SportCode" NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "sportId",
ADD COLUMN     "sportCode" "SportCode" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SportProfile_userId_sportCode_key" ON "SportProfile"("userId", "sportCode");
