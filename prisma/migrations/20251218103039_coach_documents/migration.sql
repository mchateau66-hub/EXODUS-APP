-- CreateEnum
CREATE TYPE "CoachDocKind" AS ENUM ('diploma', 'certification', 'other');

-- CreateEnum
CREATE TYPE "CoachDocStatus" AS ENUM ('pending', 'verified', 'needs_review', 'rejected');

-- CreateTable
CREATE TABLE "CoachDocument" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "CoachDocKind" NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "CoachDocStatus" NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachDocument_user_id_idx" ON "CoachDocument"("user_id");

-- CreateIndex
CREATE INDEX "CoachDocument_status_idx" ON "CoachDocument"("status");

-- AddForeignKey
ALTER TABLE "CoachDocument" ADD CONSTRAINT "CoachDocument_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachDocument" ADD CONSTRAINT "CoachDocument_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
