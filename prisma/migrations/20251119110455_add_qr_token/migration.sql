/*
  Warnings:

  - A unique constraint covering the columns `[qrToken]` on the table `TicketPurchase` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TicketPurchase" ADD COLUMN "qrToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TicketPurchase_qrToken_key" ON "TicketPurchase"("qrToken");
