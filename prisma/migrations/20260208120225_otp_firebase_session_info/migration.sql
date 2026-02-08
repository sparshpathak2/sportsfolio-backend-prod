-- AlterTable
ALTER TABLE "OTP" ADD COLUMN     "sessionInfo" TEXT,
ALTER COLUMN "code" DROP NOT NULL;
