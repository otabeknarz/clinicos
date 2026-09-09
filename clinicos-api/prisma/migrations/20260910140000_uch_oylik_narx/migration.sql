-- Narx birligi OYLIKDAN UCH OYLIKKA o'tdi.
--
-- Tariflar uch oydan boshlab sotiladi va e'lon qilingan narx ham uch
-- oylik bo'lishi kerak. Oylik saqlansa, uch oylik narxni kiritish
-- uchun uchga bo'lish kerak bo'lardi — 2 000 000 / 3 butun songa
-- bo'linmaydi va ko'rsatilgan raqam kiritilganidan farq qilardi.

-- Tarifning asosiy narxi: eski oylik qiymat uch oyga ko'paytiriladi,
-- ya'ni mijoz uchun narx O'ZGARMAYDI.
ALTER TABLE "plans" RENAME COLUMN "price_per_month" TO "base_price";
UPDATE "plans" SET "base_price" = "base_price" * 3;

-- Obunadagi muzlatilgan narx: endi u MUDDAT uchun jami summa.
-- Eski qiymat oylik edi, shuning uchun obunaning o'z muddatiga
-- ko'paytiriladi (mavjud obunalarda `term_months` = 3).
ALTER TABLE "subscriptions" RENAME COLUMN "price_per_month" TO "term_price";
UPDATE "subscriptions" SET "term_price" = "term_price" * "term_months";
