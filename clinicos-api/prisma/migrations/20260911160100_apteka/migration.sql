-- Apteka: klinikalardan alohida biznes, ma'lumoti o'z kaliti ostida.
-- Klinika jadvaliga faqat qo'shimcha ustunlar (standart qiymat bilan) —
-- mavjud klinikalar o'zgarmaydi.
-- CreateEnum
CREATE TYPE "ClinicKind" AS ENUM ('CLINIC', 'PHARMACY');

-- CreateEnum
CREATE TYPE "MedicineForm" AS ENUM ('TABLET', 'CAPSULE', 'SYRUP', 'AMPOULE', 'OINTMENT', 'DROPS', 'SPRAY', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicineStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SaleMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'DISPENSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PurchasePayment" AS ENUM ('PAID', 'PARTIAL', 'CREDIT');

-- CreateEnum
CREATE TYPE "PharmacyStaffStatus" AS ENUM ('ACTIVE', 'FIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.



-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" "ClinicKind" NOT NULL DEFAULT 'CLINIC',
ADD COLUMN     "suspend_reason" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "form" "MedicineForm" NOT NULL DEFAULT 'TABLET',
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'dona',
    "prescription_only" BOOLEAN NOT NULL DEFAULT false,
    "sell_price" INTEGER NOT NULL,
    "status" "MedicineStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_batches" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buy_price" INTEGER NOT NULL,
    "supplier_id" TEXT,
    "purchase_id" TEXT,
    "received_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "inn" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "supplier_name" TEXT NOT NULL DEFAULT '',
    "invoice_number" TEXT NOT NULL DEFAULT '',
    "received_at" DATE NOT NULL,
    "total" INTEGER NOT NULL,
    "payment" "PurchasePayment" NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "due_date" DATE,
    "documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "received_by_id" TEXT NOT NULL,
    "received_by_name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "batch_code" TEXT NOT NULL,
    "expires_at" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buy_price" INTEGER NOT NULL,
    "sell_price" INTEGER NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "method" "SaleMethod" NOT NULL,
    "patient_id" TEXT,
    "prescription_id" TEXT,
    "sold_by_id" TEXT NOT NULL,
    "sold_by_name" TEXT NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "medicine_name" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "buy_price" INTEGER NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT,
    "patient_name" TEXT NOT NULL,
    "doctor_name" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "dispensed_at" TIMESTAMP(3),
    "dispensed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_shifts" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "seller_name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "expected_cash" INTEGER NOT NULL,
    "counted_cash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "card_total" INTEGER NOT NULL,
    "receipts" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "handed_to_id" TEXT,
    "handed_to_name" TEXT NOT NULL DEFAULT '',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_staff" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "login" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PHARMACIST',
    "salary" INTEGER NOT NULL DEFAULT 0,
    "workdays" INTEGER[],
    "shift_start" TEXT NOT NULL DEFAULT '09:00',
    "shift_end" TEXT NOT NULL DEFAULT '18:00',
    "status" "PharmacyStaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "hired_at" DATE NOT NULL,
    "can_receive" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pharmacy_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medicines_clinic_id_status_idx" ON "medicines"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "medicines_clinic_id_barcode_idx" ON "medicines"("clinic_id", "barcode");

-- CreateIndex
CREATE INDEX "medicine_batches_clinic_id_medicine_id_idx" ON "medicine_batches"("clinic_id", "medicine_id");

-- CreateIndex
CREATE INDEX "medicine_batches_clinic_id_expires_at_idx" ON "medicine_batches"("clinic_id", "expires_at");

-- CreateIndex
CREATE INDEX "suppliers_clinic_id_idx" ON "suppliers"("clinic_id");

-- CreateIndex
CREATE INDEX "purchases_clinic_id_received_at_idx" ON "purchases"("clinic_id", "received_at");

-- CreateIndex
CREATE INDEX "purchase_items_clinic_id_purchase_id_idx" ON "purchase_items"("clinic_id", "purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_number_key" ON "sales"("number");

-- CreateIndex
CREATE INDEX "sales_clinic_id_sold_at_idx" ON "sales"("clinic_id", "sold_at");

-- CreateIndex
CREATE INDEX "sales_clinic_id_sold_by_id_idx" ON "sales"("clinic_id", "sold_by_id");

-- CreateIndex
CREATE INDEX "sale_items_clinic_id_sale_id_idx" ON "sale_items"("clinic_id", "sale_id");

-- CreateIndex
CREATE INDEX "sale_items_clinic_id_medicine_id_idx" ON "sale_items"("clinic_id", "medicine_id");

-- CreateIndex
CREATE INDEX "prescriptions_clinic_id_status_idx" ON "prescriptions"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "pharmacy_shifts_clinic_id_date_idx" ON "pharmacy_shifts"("clinic_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_staff_user_id_key" ON "pharmacy_staff"("user_id");

-- CreateIndex
CREATE INDEX "pharmacy_staff_clinic_id_status_idx" ON "pharmacy_staff"("clinic_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_staff_clinic_id_login_key" ON "pharmacy_staff"("clinic_id", "login");

-- CreateIndex
CREATE INDEX "clinics_kind_idx" ON "clinics"("kind");

-- AddForeignKey
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_shifts" ADD CONSTRAINT "pharmacy_shifts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_staff" ADD CONSTRAINT "pharmacy_staff_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_staff" ADD CONSTRAINT "pharmacy_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
