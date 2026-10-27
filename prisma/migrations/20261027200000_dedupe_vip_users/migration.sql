-- AlterTable
ALTER TABLE "VipUser" ADD COLUMN "usernameKey" TEXT;

UPDATE "VipUser" SET "usernameKey" = lower(btrim("platformUsername"));

-- Mantém um VIP por nick. Fica o de validade mais longa; sem validade ganha de qualquer data.
DELETE FROM "VipUser"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "userId", "platform", "usernameKey"
        ORDER BY
          ("expiresAt" IS NULL) DESC,
          "expiresAt" DESC NULLS LAST,
          "createdAt" DESC,
          "id" DESC
      ) AS rn
    FROM "VipUser"
  ) ranked
  WHERE rn > 1
);

ALTER TABLE "VipUser" ALTER COLUMN "usernameKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VipUser_userId_platform_usernameKey_key" ON "VipUser"("userId", "platform", "usernameKey");
