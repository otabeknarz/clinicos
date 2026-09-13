-- TOZA PLATFORMA — SOTUV BOSHLANISHIDAN OLDIN.
--
-- 2026-09-18 gacha tizimdagi hamma narsa SINOV edi: klinikalar, aptekalar,
-- bemorlar, shifokorlar, xodimlar, qabullar, to'lovlar, kirim-chiqim, sotuv
-- so'rovlari, audit jurnali, bot bog'lanishlari. Egasining qarori bilan
-- (zaxirasiz) hammasi o'chiriladi.
--
-- SAQLANADI — admin panel sozlamalari va platforma egasi:
--   plans, billing_terms, trial_policies    — tariflar, muddat chegirmalari, sinov shartlari
--   module_restrictions (target_clinic_id = '') — hamma uchun umumiy cheklovlar
--   platforma EGASI — `SUPERADMIN` + lavozimi "Asoschi" (yoki a'zolik yozuvi yo'q)
--   foydalanuvchi(lar), a'zolik yozuvi, klinika yozuvi ("ClinicOS platformasi"), ish
--   soatlari va sessiyasi. Paroli o'zgarmaydi.
--
-- O'CHIRILADI — qolgan HAMMASI, jumladan platforma jamoasi a'zolari (ular ham
-- `SUPERADMIN`, lekin lavozimi boshqa). Egasini ajratib bo'lmasa, eng birinchi
-- yaratilgan superadmin qoldiriladi — aks holda admin panelga hech kim kira
-- olmasdi.
--
-- NEGA MIGRATSIYA: productionga to'g'ridan-to'g'ri ulanish yo'q, `migrate
-- deploy` esa har ko'tarilishda bir marta ishlaydi va aynan bir marta.
-- Yangi (bo'sh) bazada hech narsa o'chirmaydi.
--
-- NEGA SIKL: jadvallar orasida o'nlab tashqi kalit bor, bir qismi
-- `RESTRICT`. O'chirish tartibini qo'lda yozish keyingi yangi jadvalda
-- buzilardi. Shuning uchun har bir jadval navbat bilan urinib ko'riladi;
-- bog'liq yozuv hali bor bo'lsa, keyingi aylanishda qaytadan. Tugamasa —
-- butun migratsiya bekor bo'ladi va HECH NARSA o'chmaydi (bitta tranzaksiya).

DO $$
DECLARE
  keep_users   text[];
  keep_clinics text[];
  pending      text[];
  remaining    text[];
  tname        text;
  cond         text;
  pass         int := 0;
BEGIN
  /*
    Platforma egasi: `bootstrap` uni "Asoschi" lavozimi bilan yaratadi.
    Jamoa a'zolari keyin boshqa lavozim bilan qo'shiladi. A'zolik yozuvi
    umuman yo'q superadmin ham egasi hisoblanadi (eski yozuvlar).
  */
  SELECT coalesce(array_agg(u.id), '{}') INTO keep_users
  FROM users u
  WHERE u.role = 'SUPERADMIN'
    AND (
      NOT EXISTS (SELECT 1 FROM platform_members m WHERE m.user_id = u.id)
      OR EXISTS (SELECT 1 FROM platform_members m WHERE m.user_id = u.id AND m.position = 'Asoschi')
    );

  /* Topilmasa — eng birinchi yaratilgan superadmin (admin panelsiz qolmaslik uchun) */
  IF cardinality(keep_users) = 0 THEN
    SELECT coalesce(array_agg(id), '{}') INTO keep_users
    FROM (SELECT id FROM users WHERE role = 'SUPERADMIN' ORDER BY created_at ASC LIMIT 1) AS first_admin;
  END IF;

  SELECT coalesce(array_agg(DISTINCT u.clinic_id), '{}') INTO keep_clinics
  FROM users u WHERE u.id = ANY (keep_users);

  SELECT array_agg(table_name::text ORDER BY table_name) INTO pending
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN ('_prisma_migrations', 'plans', 'billing_terms', 'trial_policies');

  IF pending IS NULL THEN
    RETURN;
  END IF;

  LOOP
    pass := pass + 1;
    remaining := '{}';

    FOREACH tname IN ARRAY pending LOOP
      cond := CASE tname
        WHEN 'users'               THEN 'NOT (id = ANY ($1))'
        WHEN 'sessions'            THEN 'NOT (user_id = ANY ($1))'
        WHEN 'platform_members'    THEN 'NOT (user_id = ANY ($1))'
        WHEN 'clinics'             THEN 'NOT (id = ANY ($2))'
        WHEN 'working_hours'       THEN 'NOT (clinic_id = ANY ($2))'
        WHEN 'module_restrictions' THEN 'target_clinic_id <> '''''
        ELSE 'TRUE'
      END;

      BEGIN
        EXECUTE format('DELETE FROM %I WHERE %s', tname, cond) USING keep_users, keep_clinics;
      EXCEPTION WHEN foreign_key_violation THEN
        remaining := remaining || tname;
      END;
    END LOOP;

    EXIT WHEN cardinality(remaining) = 0;

    IF pass >= 80 THEN
      RAISE EXCEPTION 'Toza platforma: jadvallar bo''shamadi: %', remaining;
    END IF;

    pending := remaining;
  END LOOP;

  RAISE NOTICE 'Toza platforma: % aylanishda tugadi, % ta foydalanuvchi va % ta klinika qoldi',
    pass, cardinality(keep_users), cardinality(keep_clinics);
END $$;
