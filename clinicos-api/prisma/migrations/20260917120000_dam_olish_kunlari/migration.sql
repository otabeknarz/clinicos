-- DAM OLISH KUNLARI
--
-- days_off — butun klinika (doctor_id bo'sh) yoki bitta shifokor ishlamaydigan kun.
-- PatientNoticeKind.RESCHEDULED — qabul ko'chirilganda bemorga xabar.

-- AlterEnum
ALTER TYPE "PatientNoticeKind" ADD VALUE 'RESCHEDULED';

-- CreateTable
CREATE TABLE "days_off" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "doctor_id" TEXT,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "days_off_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "days_off_clinic_id_date_idx" ON "days_off"("clinic_id", "date");

-- CreateIndex
CREATE INDEX "days_off_clinic_id_doctor_id_date_idx" ON "days_off"("clinic_id", "doctor_id", "date");

-- AddForeignKey
ALTER TABLE "days_off" ADD CONSTRAINT "days_off_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "days_off" ADD CONSTRAINT "days_off_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
