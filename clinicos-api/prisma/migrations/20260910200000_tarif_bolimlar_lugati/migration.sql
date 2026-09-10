-- Tarif imkoniyatlari KLINIKA MODULLARI bilan bitta lug'atga keltirildi.
--
-- Ilgari ikki xil nom ishlatilardi: tarifda `cashControl` va `staff`,
-- modullarda esa `cashcontrol` va `attendance`. Bir xil narsa ikki xil
-- atalgani uchun tarifda va'da qilingan bo'limni o'chirib bo'lmasdi.

-- Kassa nazorati: harf farqi
UPDATE "plans"
SET "features" = array_replace("features", 'cashControl', 'cashcontrol');

-- "Xodimlar" aslida davomat/rag'bat moduli edi
UPDATE "plans"
SET "features" = array_replace("features", 'staff', 'attendance');

-- `api` OLIB TASHLANADI: mahsulotda tashqi tizimlar uchun API yo'q.
-- Tarifda turgani — yo'q narsani sotish degani.
UPDATE "plans"
SET "features" = array_remove("features", 'api');

-- Qo'llab-quvvatlash darajasi: queue (navbat) | fast (24 soat) | manager
ALTER TABLE "plans" ADD COLUMN "support_level" TEXT NOT NULL DEFAULT 'queue';
