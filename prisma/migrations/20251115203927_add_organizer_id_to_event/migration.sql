/*
  Warnings:

  - You are about to drop the column `creatorId` on the `Event` table. All the data in the column will be lost.

*/
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
    "organizerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("address", "basePrice", "coverImageUrl", "createdAt", "description", "endDate", "id", "isFree", "locationName", "organizerName", "slug", "startDate", "timezone", "title", "updatedAt") SELECT "address", "basePrice", "coverImageUrl", "createdAt", "description", "endDate", "id", "isFree", "locationName", "organizerName", "slug", "startDate", "timezone", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
