-- Public listing layer on Project (Explore API / widget / WhatsApp bot)
ALTER TABLE "Project" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "listingDescription" TEXT;
ALTER TABLE "Project" ADD COLUMN "locationCity" TEXT;
ALTER TABLE "Project" ADD COLUMN "locationState" TEXT;
ALTER TABLE "Project" ADD COLUMN "locationAddress" TEXT;
ALTER TABLE "Project" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN "galleryUrls" JSONB;
ALTER TABLE "Project" ADD COLUMN "amenities" JSONB;

CREATE INDEX "Project_tenantId_isPublished_idx" ON "Project"("tenantId", "isPublished");
