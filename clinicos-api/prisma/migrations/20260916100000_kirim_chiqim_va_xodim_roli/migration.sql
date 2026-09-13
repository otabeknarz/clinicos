-- KIRIM-CHIQIM va XODIM ROLI
--
-- 1. finance_entries — bemor to'lovidan tashqari pul: xarajatlar va boshqa kirimlar.
--    O'zgarmas: tahrir/o'chirish yo'q, xato yozuv bekor qilinadi (voided_at).
-- 2. Role.STAFF — buxgalter, kassir kabi xodimlar uchun tizimga kirish roli.
-- 3. Yangi lavozimlar: kassir, sanitar, omborchi, texnik, oshpaz,
--    marketolog, IT. Mavjud yozuvlarga tegilmaydi.
-- CreateEnum
CREATE TYPE "FinanceEntryType" AS ENUM ('EXPENSE', 'INCOME');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'STAFF';

-- AlterEnum


ALTER TYPE "StaffPosition" ADD VALUE 'CASHIER';
ALTER TYPE "StaffPosition" ADD VALUE 'ORDERLY';
ALTER TYPE "StaffPosition" ADD VALUE 'STOREKEEPER';
ALTER TYPE "StaffPosition" ADD VALUE 'TECHNICIAN';
ALTER TYPE "StaffPosition" ADD VALUE 'COOK';
ALTER TYPE "StaffPosition" ADD VALUE 'MARKETING';
ALTER TYPE "StaffPosition" ADD VALUE 'IT';

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "counterparty" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "receipts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),
    "voided_by" TEXT,
    "void_reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_entries_clinic_id_occurred_at_idx" ON "finance_entries"("clinic_id", "occurred_at");

-- CreateIndex
CREATE INDEX "finance_entries_clinic_id_created_by_occurred_at_idx" ON "finance_entries"("clinic_id", "created_by", "occurred_at");

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

