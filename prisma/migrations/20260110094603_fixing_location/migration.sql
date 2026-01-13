/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Location` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Location` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,address]` on the table `Location` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Location" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ALTER COLUMN "country" DROP NOT NULL,
ALTER COLUMN "country" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_address_key" ON "Location"("name", "address");
