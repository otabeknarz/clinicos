-- Xodimning yuz izi (davomat uchun).
-- RASM EMAS: 128 o'lchovli son ketma-ketligi.
CREATE TABLE "staff_faces" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "descriptor" DOUBLE PRECISION[],
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_faces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_faces_clinic_id_staff_id_idx" ON "staff_faces"("clinic_id", "staff_id");

ALTER TABLE "staff_faces" ADD CONSTRAINT "staff_faces_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_faces" ADD CONSTRAINT "staff_faces_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
