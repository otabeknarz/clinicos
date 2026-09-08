-- CreateTable
CREATE TABLE "debt_waivers" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "admission_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "debt_waivers_appointment_id_key" ON "debt_waivers"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "debt_waivers_admission_id_key" ON "debt_waivers"("admission_id");

-- CreateIndex
CREATE INDEX "debt_waivers_clinic_id_idx" ON "debt_waivers"("clinic_id");

-- AddForeignKey
ALTER TABLE "debt_waivers" ADD CONSTRAINT "debt_waivers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_waivers" ADD CONSTRAINT "debt_waivers_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_waivers" ADD CONSTRAINT "debt_waivers_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
