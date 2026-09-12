-- O'zi ro'yxatdan o'tgan odam platformaga so'rov bo'lib tushadi
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "created_clinic_id" TEXT,
    "clinic_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "staff_count" TEXT NOT NULL DEFAULT '',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");
