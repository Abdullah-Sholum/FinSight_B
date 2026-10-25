ALTER TABLE "datasets"
  ADD CONSTRAINT "real_never_published"
  CHECK (NOT ("type" = 'REAL' AND "isPublished"));