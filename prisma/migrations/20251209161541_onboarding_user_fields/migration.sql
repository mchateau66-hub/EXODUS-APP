-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT;

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
