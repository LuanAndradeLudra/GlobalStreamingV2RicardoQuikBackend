-- DropIndex
DROP INDEX "ConnectedAccount_platform_externalChannelId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_userId_platform_externalChannelId_key" ON "ConnectedAccount"("userId", "platform", "externalChannelId");


