-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "lockType" TEXT NOT NULL DEFAULT 'None',
    "passwordHash" TEXT,
    "passwordSalt" TEXT,
    "keyBlob" TEXT,
    "kdfParams" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Group" ("createdAt", "id", "keyBlob", "lockType", "name", "order", "passwordHash", "passwordSalt", "updatedAt") SELECT "createdAt", "id", "keyBlob", "lockType", "name", "order", "passwordHash", "passwordSalt", "updatedAt" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
