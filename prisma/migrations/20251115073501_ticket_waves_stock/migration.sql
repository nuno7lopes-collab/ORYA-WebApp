/*
  Warnings:

  - Added the required column `eventId` to the `TicketPurchase` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TicketPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketPurchase_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketPurchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TicketPurchase" ("createdAt", "currency", "id", "pricePaid", "quantity", "ticketId") SELECT "createdAt", "currency", "id", "pricePaid", "quantity", "ticketId" FROM "TicketPurchase";
DROP TABLE "TicketPurchase";
ALTER TABLE "new_TicketPurchase" RENAME TO "TicketPurchase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
