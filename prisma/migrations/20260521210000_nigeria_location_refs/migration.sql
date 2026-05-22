CREATE TABLE "NigeriaStateRef" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lgaCount" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NigeriaStateRef_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NigeriaLgaRef" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "NigeriaLgaRef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NigeriaStateRef_name_key" ON "NigeriaStateRef"("name");
CREATE UNIQUE INDEX "NigeriaStateRef_slug_key" ON "NigeriaStateRef"("slug");
CREATE UNIQUE INDEX "NigeriaLgaRef_stateId_slug_key" ON "NigeriaLgaRef"("stateId", "slug");
CREATE INDEX "NigeriaLgaRef_stateId_idx" ON "NigeriaLgaRef"("stateId");
CREATE INDEX "NigeriaLgaRef_name_idx" ON "NigeriaLgaRef"("name");

ALTER TABLE "NigeriaLgaRef" ADD CONSTRAINT "NigeriaLgaRef_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "NigeriaStateRef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
