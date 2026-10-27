-- DropIndex
DROP INDEX IF EXISTS "VipUser_userId_externalId_key";

-- AlterTable
ALTER TABLE "VipUser" DROP COLUMN IF EXISTS "externalId";
