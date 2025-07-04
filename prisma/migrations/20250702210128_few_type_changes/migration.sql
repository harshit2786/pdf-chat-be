/*
  Warnings:

  - Added the required column `color` to the `Folder` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `createdAt` on the `Folder` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `uploadedAt` to the `Pdfs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "color" TEXT NOT NULL,
DROP COLUMN "createdAt",
ADD COLUMN     "createdAt" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Pdfs" ADD COLUMN     "uploadedAt" INTEGER NOT NULL;
