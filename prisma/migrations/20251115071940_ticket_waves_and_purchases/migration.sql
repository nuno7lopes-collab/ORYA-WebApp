-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "TicketPurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" INTEGER NOT NULL,
    "ticketId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketPurchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TicketPurchase_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "locationName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Lisbon',
    "coverImageUrl" TEXT,
    "organizerName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("address", "basePrice", "coverImageUrl", "createdAt", "description", "endDate", "id", "isFree", "locationName", "organizerName", "slug", "startDate", "timezone", "title", "updatedAt") SELECT "address", "basePrice", "coverImageUrl", "createdAt", "description", "endDate", "id", "isFree", "locationName", "organizerName", "slug", "startDate", "timezone", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
