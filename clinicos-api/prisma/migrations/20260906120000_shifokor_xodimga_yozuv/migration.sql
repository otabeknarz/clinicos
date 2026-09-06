-- SHIFOKOR LAVOZIMIDAGI XODIMLARGA `doctors` YOZUVI.
--
-- Klinikada shifokor faqat Xodimlar bo'limidan qo'shiladi, lekin
-- shu paytgacha unga `doctors` yozuvi ochilmasdi. Natijada
-- "Shifokorlar" ro'yxati bo'sh qolar, registrator qabulga
-- shifokor biriktira olmas, shifokorning o'zi esa tashrif yoza
-- olmasdi (`visits.service` qabulni shifokor bilan solishtiradi).
--
-- Kod endi yozuvni o'zi ochadi. Bu migratsiya ALLAQACHON
-- kiritilgan xodimlarni tuzatadi.
--
-- Mutaxassislik lavozim nomidan olinadi, qabul narxi 0 qoladi —
-- ularni klinika egasi Xodimlar formasidan aniqlaydi. Nol narx
-- to'siq emas: to'lov xizmat narxidan hisoblanadi.
--
-- Har bir xodim ALOHIDA aylanadi. To'plamli INSERT ... RETURNING
-- da yangi yozuvni xodimga qaytarib bog'lash uchun ism va
-- telefonga tayanishga to'g'ri kelardi — bir xil ismli ikki
-- xodimda ular chalkashib ketardi.

DO $$
DECLARE
  x   RECORD;
  yangi_id TEXT;
BEGIN
  FOR x IN
    SELECT * FROM staff WHERE position = 'DOCTOR' AND doctor_id IS NULL
  LOOP
    yangi_id := gen_random_uuid()::TEXT;

    INSERT INTO doctors (
      id, clinic_id, full_name, specialty, phone, email,
      consultation_fee, status, workdays, shift_start, shift_end,
      hired_at, created_at, updated_at
    ) VALUES (
      yangi_id,
      x.clinic_id,
      x.full_name,
      LEFT(COALESCE(NULLIF(TRIM(x.position_title), ''), 'Shifokor'), 60),
      x.phone,
      x.email,
      0,
      CASE x.status
        WHEN 'FIRED'    THEN 'INACTIVE'::"DoctorStatus"
        WHEN 'ON_LEAVE' THEN 'ON_LEAVE'::"DoctorStatus"
        ELSE                 'ACTIVE'::"DoctorStatus"
      END,
      x.workdays,
      x.shift_start,
      x.shift_end,
      x.hired_at,
      NOW(),
      NOW()
    );

    UPDATE staff SET doctor_id = yangi_id WHERE id = x.id;
  END LOOP;
END $$;

-- Shifokor o'z bemorlarini `users.doctor_id` orqali ko'radi.
-- Xodimda bog'lanish bor, foydalanuvchida yo'q bo'lsa — to'ldiramiz.
UPDATE users u
SET doctor_id = s.doctor_id
FROM staff s
WHERE s.user_id = u.id
  AND s.doctor_id IS NOT NULL
  AND u.doctor_id IS NULL;
