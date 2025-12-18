/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `Coach` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Coach_user_id_key" ON "Coach"("user_id");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
