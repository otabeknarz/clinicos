-- Fikrga biriktiriladigan rasmlar.
--
-- Bemor kabinetda ko'rik haqida fikr yozganda rasm qo'sha oladi.
-- Alohida jadval, `String[]` emas: `SignedUrlInterceptor` nomi
-- `*Url` bo'lgan QATORNI imzolangan havolaga o'giradi, massivni
-- emas. `visit_images` ham aynan shu sababdan alohida turadi.
CREATE TABLE "feedback_images" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_images_clinic_id_feedback_id_idx"
    ON "feedback_images"("clinic_id", "feedback_id");

ALTER TABLE "feedback_images"
    ADD CONSTRAINT "feedback_images_feedback_id_fkey"
    FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
