-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "nameEnc" TEXT NOT NULL DEFAULT '',
    "groupId" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT -1,
    "markColor" TEXT,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certificate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("content", "createdAt", "groupId", "icon", "id", "markColor", "name", "order", "updatedAt") SELECT "content", "createdAt", "groupId", "icon", "id", "markColor", "name", "order", "updatedAt" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE INDEX "Certificate_groupId_idx" ON "Certificate"("groupId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL DEFAULT '',
    "keyBlob" TEXT NOT NULL DEFAULT '',
    "kdfParams" TEXT NOT NULL DEFAULT '',
    "initTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "defaultGroupId" INTEGER NOT NULL DEFAULT 0,
    "totpSecret" TEXT NOT NULL DEFAULT '',
    "createPwdAlphabet" TEXT NOT NULL DEFAULT '',
    "createPwdLength" INTEGER NOT NULL DEFAULT 16,
    "metadataVersion" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_User" ("createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "kdfParams", "keyBlob", "passwordHash", "passwordSalt", "theme", "totpSecret") SELECT "createPwdAlphabet", "createPwdLength", "defaultGroupId", "id", "initTime", "kdfParams", "keyBlob", "passwordHash", "passwordSalt", "theme", "totpSecret" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
