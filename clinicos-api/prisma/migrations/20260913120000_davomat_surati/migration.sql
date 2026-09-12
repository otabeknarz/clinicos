-- Xodim o'zi belgilagan davomat: surat va belgi
ALTER TABLE "attendance" ADD COLUMN "photo_key" TEXT;
ALTER TABLE "attendance" ADD COLUMN "self_marked" BOOLEAN NOT NULL DEFAULT false;
