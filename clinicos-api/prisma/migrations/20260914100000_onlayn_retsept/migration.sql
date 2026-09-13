-- Onlayn retsept: klinikadan aptekaga
CREATE TYPE "OnlineRxStatus" AS ENUM ('SENT', 'READY', 'DISPENSED', 'CANCELLED');

CREATE TABLE "online_prescriptions" (
    "id" TEXT NOT NULL,
    "issuer_clinic_id" TEXT NOT NULL,
    "pharmacy_clinic_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL,
    "patient_phone" TEXT NOT NULL DEFAULT '',
    "doctor_id" TEXT,
    "doctor_name" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "code" TEXT NOT NULL,
    "estimated_total" INTEGER NOT NULL DEFAULT 0,
    "offered_ids" TEXT[],
    "status" "OnlineRxStatus" NOT NULL DEFAULT 'SENT',
    "note" TEXT NOT NULL DEFAULT '',
    "ready_at" TIMESTAMP(3),
    "dispensed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_prescriptions_code_key" ON "online_prescriptions"("code");
CREATE INDEX "online_prescriptions_issuer_clinic_id_status_idx" ON "online_prescriptions"("issuer_clinic_id", "status");
CREATE INDEX "online_prescriptions_pharmacy_clinic_id_status_idx" ON "online_prescriptions"("pharmacy_clinic_id", "status");
