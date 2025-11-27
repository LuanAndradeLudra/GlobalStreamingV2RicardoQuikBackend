-- Add foreign key constraint for winnerParticipantId
ALTER TABLE "StreamGiveawayWinner" ADD CONSTRAINT "StreamGiveawayWinner_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "StreamGiveawayParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index for winnerParticipantId
CREATE INDEX "StreamGiveawayWinner_winnerParticipantId_idx" ON "StreamGiveawayWinner"("winnerParticipantId");

