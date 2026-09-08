-- CreateTable
CREATE TABLE "visit_images" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_images_clinic_id_visit_id_idx" ON "visit_images"("clinic_id", "visit_id");

-- AddForeignKey
ALTER TABLE "visit_images" ADD CONSTRAINT "visit_images_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
