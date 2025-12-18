-- CreateIndex
CREATE INDEX "Coach_slug_idx" ON "Coach"("slug");

-- CreateIndex
CREATE INDEX "Message_user_id_created_at_idx" ON "Message"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Message_coach_id_created_at_idx" ON "Message"("coach_id", "created_at");
