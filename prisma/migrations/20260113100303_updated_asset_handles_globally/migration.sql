/*
  Warnings:

  - The values [TOURNAMENT_LOGO,TOURNAMENT_BANNER] on the enum `AssetType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `tournamentId` on the `Asset` table. All the data in the column will be lost.
  - Added the required column `entityId` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Asset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssetEntityType" AS ENUM ('TOURNAMENT', 'TEAM', 'USER');

-- AlterEnum
BEGIN;
CREATE TYPE "AssetType_new" AS ENUM ('LOGO', 'BANNER', 'PROFILE_PICTURE', 'OTHER');
ALTER TABLE "Asset" ALTER COLUMN "type" TYPE "AssetType_new" USING ("type"::text::"AssetType_new");
ALTER TYPE "AssetType" RENAME TO "AssetType_old";
ALTER TYPE "AssetType_new" RENAME TO "AssetType";
DROP TYPE "AssetType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_tournamentId_fkey";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "tournamentId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" "AssetEntityType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Asset_entityType_entityId_idx" ON "Asset"("entityType", "entityId");
