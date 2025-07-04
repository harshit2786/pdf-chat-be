/*
  Warnings:

  - Added the required column `createdAt` to the `Folder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "createdAt" TEXT NOT NULL;
