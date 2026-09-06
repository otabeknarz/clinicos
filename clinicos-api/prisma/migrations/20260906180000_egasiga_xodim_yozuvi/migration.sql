-- KLINIKA EGASIGA `staff` YOZUVI.
--
-- Egasi klinikaning xodimi: profili, ish jadvali, davomati va
-- bonusi `staff` ga bog'langan. Klinika yaratilganda esa faqat
-- `users` yozuvi ochilardi. Natijada egasi kirishi bilan
-- "Mening profilim" va "Mening ish jadvalim" 404 qaytarardi —
-- ikkala sahifa ham umuman ochilmasdi.
--
-- Kod endi yozuvni klinika bilan birga ochadi. Bu migratsiya
-- ALLAQACHON yaratilgan klinikalarni tuzatadi.
--
-- Maosh 0 va lavozim "Klinika egasi" — qolganini egasining
-- o'zi Xodimlar bo'limidan to'ldiradi.
--
-- FAQAT `OWNER` roli. Platforma administratori boshqa narsa:
-- uning "klinikasi" — platforma yozuvi, u yerda xodim bo'lmaydi.

INSERT INTO staff (
  id, clinic_id, user_id, full_name, phone, email,
  position, position_title, department,
  workdays, shift_start, shift_end, work_rate,
  pay_type, percent_rate, salary,
  hired_at, status, has_system_access, notes,
  created_at, updated_at
)
SELECT
  gen_random_uuid()::TEXT,
  u.clinic_id,
  u.id,
  u.full_name,
  u.phone,
  u.email,
  'MANAGER'::"StaffPosition",
  'Klinika egasi',
  'Boshqaruv',
  ARRAY[1,2,3,4,5,6],
  '09:00',
  '18:00',
  100,
  'SALARY'::"PayType",
  0,
  0,
  COALESCE(u.created_at::DATE, CURRENT_DATE),
  'ACTIVE'::"StaffStatus",
  true,
  '',
  NOW(),
  NOW()
FROM users u
WHERE u.role = 'OWNER'
  AND NOT EXISTS (SELECT 1 FROM staff s WHERE s.user_id = u.id);
