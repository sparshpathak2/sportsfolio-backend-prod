-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "TournamentRequest" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentRequest_tournamentId_idx" ON "TournamentRequest"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentRequest_userId_idx" ON "TournamentRequest"("userId");

-- CreateIndex
CREATE INDEX "TournamentRequest_teamId_idx" ON "TournamentRequest"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRequest_tournamentId_userId_teamId_key" ON "TournamentRequest"("tournamentId", "userId", "teamId");

-- AddForeignKey
ALTER TABLE "TournamentRequest" ADD CONSTRAINT "TournamentRequest_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRequest" ADD CONSTRAINT "TournamentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRequest" ADD CONSTRAINT "TournamentRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
