-- CreateEnum
CREATE TYPE "DatasetType" AS ENUM ('REAL', 'SYNTHETIC');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "datasets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DatasetType" NOT NULL,
    "seed" INTEGER,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "rawLine" TEXT NOT NULL,
    "sourceFile" TEXT,
    "writtenTotal" INTEGER,
    "isEmptyDay" BOOLEAN NOT NULL DEFAULT false,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "datasets_name_key" ON "datasets"("name");

-- CreateIndex
CREATE INDEX "import_batches_datasetId_idx" ON "import_batches"("datasetId");

-- CreateIndex
CREATE INDEX "daily_entries_importBatchId_idx" ON "daily_entries"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_datasetId_date_key" ON "daily_entries"("datasetId", "date");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
