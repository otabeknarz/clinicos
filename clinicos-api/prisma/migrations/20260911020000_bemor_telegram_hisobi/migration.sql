-- Bemor kabinetiga kirish uchun Telegram hisobi.
--
-- Bemor alohida botda telefon raqamini ulashadi, Telegram raqamni
-- o'zi tasdiqlaydi va server uni `phone` bilan solishtirib shu
-- ustunni to'ldiradi.
--
-- NOYOB EMAS: bir odam ikki klinikada bemor bo'lishi mumkin.
ALTER TABLE "patients" ADD COLUMN "telegram_user_id" TEXT;

CREATE INDEX "patients_telegram_user_id_idx" ON "patients"("telegram_user_id");
