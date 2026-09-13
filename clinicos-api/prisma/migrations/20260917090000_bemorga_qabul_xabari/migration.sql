-- BEMORGA QABUL XABARI
--
-- 1. PatientNoticeKind.BOOKED — qabul yozilgan zahoti bemorga boradigan xabar.
-- 2. telegram_phone_links — botda tasdiqlangan raqam, kartasi keyin ochilsa
--    ham bog'lanishi uchun. Hozir bog'langan bemorlardan to'ldiriladi.

-- AlterEnum
ALTER TYPE "PatientNoticeKind" ADD VALUE 'BOOKED';

-- CreateTable
CREATE TABLE "telegram_phone_links" (
    "phone" TEXT NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_phone_links_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "telegram_phone_links_telegram_user_id_idx" ON "telegram_phone_links"("telegram_user_id");

-- Backfill: allaqachon botga bog'langan bemorlarning raqamlari
INSERT INTO "telegram_phone_links" ("phone", "telegram_user_id", "updated_at")
SELECT DISTINCT ON (digits) digits, "telegram_user_id", CURRENT_TIMESTAMP
FROM (
    SELECT regexp_replace("phone", '[^0-9]', '', 'g') AS digits, "telegram_user_id", "updated_at"
    FROM "patients"
    WHERE "telegram_user_id" IS NOT NULL
) AS linked
WHERE length(digits) >= 9
ORDER BY digits, "updated_at" DESC
ON CONFLICT ("phone") DO NOTHING;
