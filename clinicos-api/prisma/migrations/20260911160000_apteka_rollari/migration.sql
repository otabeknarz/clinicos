-- Apteka rollari.
--
-- ALOHIDA MIGRATSIYADA, chunki PostgreSQL enum ga qo'shilgan yangi
-- qiymatni o'sha tranzaksiya ichida ishlatishga ruxsat bermaydi
-- ("unsafe use of new value"). Keyingi migratsiyada `pharmacy_staff.role`
-- ustuni `DEFAULT 'PHARMACIST'` bilan yaratiladi — ikkalasi bitta faylda
-- bo'lsa, `migrate deploy` serverda yiqilib, ilova ko'tarilmasdi.
ALTER TYPE "Role" ADD VALUE 'PHARMACIST';
ALTER TYPE "Role" ADD VALUE 'PHARMACY_OWNER';
