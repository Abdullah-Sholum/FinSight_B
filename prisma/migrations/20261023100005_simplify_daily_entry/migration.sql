/*
  Warnings:

  - You are about to drop the column `rawLine` on the `daily_entries` table. All the data in the column will be lost.
  - You are about to drop the column `sourceFile` on the `daily_entries` table. All the data in the column will be lost.
  - You are about to drop the column `writtenTotal` on the `daily_entries` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- AlterTable
ALTER TABLE "daily_entries" DROP COLUMN "rawLine",
DROP COLUMN "sourceFile",
DROP COLUMN "writtenTotal";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
