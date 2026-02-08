-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
