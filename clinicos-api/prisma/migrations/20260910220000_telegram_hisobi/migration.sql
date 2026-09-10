-- Telegram hisobi — shifokorga telefonga xabar yuborish uchun.
--
-- Xodim ilovani mini app ichida ochganda oʻz-oʻzidan toʻldiriladi.
-- Global noyob emas: bitta odam ikki klinikada ishlashi mumkin.
ALTER TABLE "users" ADD COLUMN "telegram_user_id" TEXT;
CREATE INDEX "users_telegram_user_id_idx" ON "users"("telegram_user_id");
