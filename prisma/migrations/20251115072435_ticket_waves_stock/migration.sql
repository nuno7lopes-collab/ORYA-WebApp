/*
  Warnings:

  - You are about to drop the column `eventId` on the `TicketPurchase` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "totalQuantity" INTEGER,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("available", "createdAt", "currency", "description", "endsAt", "eventId", "id", "isVisible", "name", "price", "soldQuantity", "sortOrder", "startsAt", "totalQuantity", "updatedAt") SELECT "available", "createdAt", "currency", "description", "endsAt", "eventId", "id", "isVisible", "name", "price", "soldQuantity", "sortOrder", "startsAt", "totalQuantity", "updatedAt" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE TABLE "new_TicketPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketPurchase_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TicketPurchase" ("createdAt", "currency", "id", "pricePaid", "quantity", "ticketId") SELECT "createdAt", "currency", "id", "pricePaid", "quantity", "ticketId" FROM "TicketPurchase";
DROP TABLE "TicketPurchase";
ALTER TABLE "new_TicketPurchase" RENAME TO "TicketPurchase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
