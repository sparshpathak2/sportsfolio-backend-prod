-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "matchNumber" INTEGER,
ADD COLUMN     "round" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3);
