-- AlterTable
ALTER TABLE "Group" ADD COLUMN "passwordSalt" TEXT;

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
    "commonLocation" TEXT NOT NULL DEFAULT '',
    "totpSecret" TEXT NOT NULL DEFAULT '',
    "createPwdAlphabet" TEXT NOT NULL DEFAULT '',
    "createPwdLength" INTEGER NOT NULL DEFAULT 16
);
INSERT INTO "new_User" ("commonLocation", "createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "passwordHash", "theme", "totpSecret") SELECT "commonLocation", "createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "passwordHash", "theme", "totpSecret" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
