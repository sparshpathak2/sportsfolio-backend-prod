-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Team_latitude_longitude_idx" ON "Team"("latitude", "longitude");
