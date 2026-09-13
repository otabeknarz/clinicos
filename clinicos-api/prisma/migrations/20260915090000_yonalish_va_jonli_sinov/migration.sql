-- Klinika o'z yo'nalishini biladi
ALTER TABLE "clinics" ADD COLUMN "direction" TEXT NOT NULL DEFAULT '';

-- O'zi ro'yxatdan o'tganlarning yo'nalishi so'rovdan tiklanadi
UPDATE "clinics" c
SET "direction" = l."direction"
FROM "leads" l
WHERE l."created_clinic_id" = c."id";

/*
  SINOV BO'LIMLARI ENDI NUSXALANMAYDI, jonli hisoblanadi.

  Ilgari ro'yxatdan o'tishda sinovda yopiq bo'limlar
  `disabled_modules` ga YOZIB QO'YILARDI: admin keyin shartni
  o'zgartirsa ta'sir qilmasdi, mijoz to'lagach esa ular yopiq
  qolib ketardi. Faqat HALI SINOVDA turgan, o'zi ro'yxatdan
  o'tgan klinikalar tozalanadi — yo'nalishning o'z to'plamiga
  qaytariladi. Qo'lda ochilgan klinikalarga tegilmaydi.
*/
UPDATE "clinics" c
SET "disabled_modules" = CASE l."direction"
    WHEN 'dental' THEN ARRAY['ward']::TEXT[]
    WHEN 'eye' THEN ARRAY['ward']::TEXT[]
    WHEN 'lab' THEN ARRAY['ward', 'attendance', 'analytics']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END
FROM "leads" l
JOIN "subscriptions" s ON s."clinic_id" = l."created_clinic_id"
WHERE l."created_clinic_id" = c."id"
  AND s."status" = 'TRIAL';
