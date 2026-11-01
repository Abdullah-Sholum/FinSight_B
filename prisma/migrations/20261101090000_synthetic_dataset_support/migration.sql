ALTER TABLE "datasets"
  ADD COLUMN "config" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

-- Paling banyak satu dataset terbit pada satu waktu
CREATE UNIQUE INDEX "datasets_single_published" ON "datasets" ((true)) WHERE "isPublished";

-- Dataset terbit harus punya waktu terbit
ALTER TABLE "datasets"
  ADD CONSTRAINT "published_has_timestamp"
  CHECK (NOT "isPublished" OR "publishedAt" IS NOT NULL);