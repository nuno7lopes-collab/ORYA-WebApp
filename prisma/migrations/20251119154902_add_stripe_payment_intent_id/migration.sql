/*
  Warnings:

  - A unique constraint covering the columns `[stripePaymentIntentId]` on the table `TicketPurchase` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TicketPurchase" ADD COLUMN "stripePaymentIntentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TicketPurchase_stripePaymentIntentId_key" ON "TicketPurchase"("stripePaymentIntentId");
