-- CreateTable
CREATE TABLE "TicketReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "userId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketReservation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketReservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TicketReservation_ticketId_idx" ON "TicketReservation"("ticketId");

-- CreateIndex
CREATE INDEX "TicketReservation_eventId_idx" ON "TicketReservation"("eventId");

-- CreateIndex
CREATE INDEX "TicketReservation_userId_idx" ON "TicketReservation"("userId");

-- CreateIndex
CREATE INDEX "TicketReservation_status_expiresAt_idx" ON "TicketReservation"("status", "expiresAt");
