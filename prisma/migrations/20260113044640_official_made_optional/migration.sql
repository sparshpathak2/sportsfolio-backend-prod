-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_officialUserId_fkey";

-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "officialUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_officialUserId_fkey" FOREIGN KEY ("officialUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
