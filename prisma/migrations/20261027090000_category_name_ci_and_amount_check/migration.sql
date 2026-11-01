-- Nama kategori unik tanpa membedakan huruf besar-kecil
CREATE UNIQUE INDEX "categories_name_lower_key" ON "categories" (lower("name"));

-- Nominal pengeluaran harus positif
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount" > 0);