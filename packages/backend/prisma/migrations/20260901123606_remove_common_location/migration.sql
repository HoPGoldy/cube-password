/*
  Warnings:

  - You are about to drop the column `commonLocation` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL DEFAULT '',
    "initTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "defaultGroupId" INTEGER NOT NULL DEFAULT 0,
    "totpSecret" TEXT NOT NULL DEFAULT '',
    "createPwdAlphabet" TEXT NOT NULL DEFAULT '',
    "createPwdLength" INTEGER NOT NULL DEFAULT 16
);
INSERT INTO "new_User" ("createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "passwordHash", "passwordSalt", "theme", "totpSecret") SELECT "createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "passwordHash", "passwordSalt", "theme", "totpSecret" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
