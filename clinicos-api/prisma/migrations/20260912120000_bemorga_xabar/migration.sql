-- Bemorga xabar: xodim yozgan umumiy xabar va qabul eslatmasi.
CREATE TYPE "PatientNoticeKind" AS ENUM ('BROADCAST', 'REMINDER');

CREATE TABLE "patient_notices" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "kind" "PatientNoticeKind" NOT NULL DEFAULT 'BROADCAST',
    "text" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL DEFAULT '',
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_notices_pkey" PRIMARY KEY ("id")
);

-- Bitta qabulga bitta eslatma: fon vazifasi qayta ishga tushsa ham takrorlanmaydi
CREATE UNIQUE INDEX "patient_notices_appointment_id_kind_key"
    ON "patient_notices"("appointment_id", "kind");
CREATE INDEX "patient_notices_clinic_id_patient_id_created_at_idx"
    ON "patient_notices"("clinic_id", "patient_id", "created_at");

ALTER TABLE "patient_notices" ADD CONSTRAINT "patient_notices_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patient_notices" ADD CONSTRAINT "patient_notices_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patient_notices" ADD CONSTRAINT "patient_notices_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
