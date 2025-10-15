-- CreateTable
CREATE TABLE "Sat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Sat_jti_key" ON "Sat"("jti");
