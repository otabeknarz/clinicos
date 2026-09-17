-- QARZ MUDDATI, XIZMAT BO'YICHA FOIZ, KOD BILAN O'CHIRISH
--
-- appointments/admissions.debt_due_date — qarzni qachongacha to'lashi.
-- PatientNoticeKind.DEBT_DUE — muddat kelganda bemorga xabar.
-- doctor_service_rates — shifokorning xizmat bo'yicha alohida foizi.
-- clinics.delete_code_hash — o'chirishni tasdiqlaydigan kod.
-- patients/services.deleted_at — ro'yxatdan o'chirilgan (tarix saqlanadi).

-- AlterEnum
ALTER TYPE "PatientNoticeKind" ADD VALUE 'DEBT_DUE';

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN "delete_code_hash" TEXT;
ALTER TABLE "patients" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "services" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "debt_due_date" DATE;
ALTER TABLE "admissions" ADD COLUMN "debt_due_date" DATE;

-- CreateTable
CREATE TABLE "doctor_service_rates" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_service_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_service_rates_doctor_id_service_id_key" ON "doctor_service_rates"("doctor_id", "service_id");

-- CreateIndex
CREATE INDEX "doctor_service_rates_clinic_id_idx" ON "doctor_service_rates"("clinic_id");

-- AddForeignKey
ALTER TABLE "doctor_service_rates" ADD CONSTRAINT "doctor_service_rates_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_service_rates" ADD CONSTRAINT "doctor_service_rates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_service_rates" ADD CONSTRAINT "doctor_service_rates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
