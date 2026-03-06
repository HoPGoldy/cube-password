/*
  Warnings:

  - You are about to drop the `Attachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Diary` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Attachment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Diary";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passwordHash" TEXT NOT NULL,
    "initTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "defaultGroupId" INTEGER NOT NULL DEFAULT 0,
    "commonLocation" TEXT NOT NULL DEFAULT '',
    "totpSecret" TEXT NOT NULL DEFAULT '',
    "createPwdAlphabet" TEXT NOT NULL DEFAULT '',
    "createPwdLength" INTEGER NOT NULL DEFAULT 16
);

-- CreateTable
CREATE TABLE "Group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockType" TEXT NOT NULL DEFAULT 'None',
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT -1,
    "markColor" TEXT,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" INTEGER NOT NULL DEFAULT 1,
    "isRead" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "Certificate_groupId_idx" ON "Certificate"("groupId");
