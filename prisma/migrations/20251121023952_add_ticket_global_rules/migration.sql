-- CreateTable
CREATE TABLE "TicketGlobalRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "role" TEXT NOT NULL,
    "ticketsPerUnit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketGlobalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketGlobalDonationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "ConnectedPlatform" NOT NULL,
    "unitType" TEXT NOT NULL,
    "unitsPerTicket" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketGlobalDonationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketGlobalRule_userId_platform_role_key" ON "TicketGlobalRule"("userId", "platform", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TicketGlobalDonationRule_userId_platform_unitType_key" ON "TicketGlobalDonationRule"("userId", "platform", "unitType");

-- AddForeignKey
ALTER TABLE "TicketGlobalRule" ADD CONSTRAINT "TicketGlobalRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketGlobalDonationRule" ADD CONSTRAINT "TicketGlobalDonationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
