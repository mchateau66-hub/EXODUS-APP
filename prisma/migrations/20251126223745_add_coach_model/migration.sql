-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "coach_id" TEXT;

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "avatarInitial" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_slug_key" ON "Coach"("slug");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "Coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;
