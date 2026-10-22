-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('IMPORT', 'RULE', 'MANUAL');

-- CreateTable
CREATE TABLE "category_rules" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "datasetId" INTEGER NOT NULL,
    "entryId" INTEGER,
    "date" DATE NOT NULL,
    "item" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "categorySource" "CategorySource" NOT NULL DEFAULT 'IMPORT',
    "ruleId" INTEGER,
    "legacyId" INTEGER,
    "importBatchId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_keyword_key" ON "category_rules"("keyword");

-- CreateIndex
CREATE INDEX "category_rules_categoryId_idx" ON "category_rules"("categoryId");

-- CreateIndex
CREATE INDEX "expenses_datasetId_date_idx" ON "expenses"("datasetId", "date");

-- CreateIndex
CREATE INDEX "expenses_datasetId_categoryId_idx" ON "expenses"("datasetId", "categoryId");

-- CreateIndex
CREATE INDEX "expenses_entryId_idx" ON "expenses"("entryId");

-- CreateIndex
CREATE INDEX "expenses_importBatchId_idx" ON "expenses"("importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_datasetId_legacyId_key" ON "expenses"("datasetId", "legacyId");

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "daily_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "category_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
