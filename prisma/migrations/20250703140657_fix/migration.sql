/*
  Warnings:

  - Added the required column `totalPages` to the `Pdfs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pdfs" ADD COLUMN     "totalPages" INTEGER NOT NULL;
