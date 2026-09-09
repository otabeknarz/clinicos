-- CreateTable
-- Chegirma MUDDATGA biriktiriladi, tarifga emas: "6 oy — 10%" barcha
-- tariflarga bir xil qo'llanadi.
CREATE TABLE "billing_terms" (
    "id" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_terms_months_key" ON "billing_terms"("months");

-- AlterTable
-- Mavjud obunalar 3 oylik va chegirmasiz deb qabul qilinadi: ular
-- shu paytgacha shunday to'lab kelgan.
ALTER TABLE "subscriptions" ADD COLUMN     "term_months" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "discount_pct" INTEGER NOT NULL DEFAULT 0;

-- Boshlang'ich muddatlar. Ekrandagi jadval bilan bir xil:
-- 3 oy chegirmasiz, 6 oy 10%, 12 oy 20%.
INSERT INTO "billing_terms" ("id", "months", "discount_pct", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 3, 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 6, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 12, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
