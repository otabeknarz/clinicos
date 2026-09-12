-- Google Sheets havolalari.
-- Token bazada SAQLANMAYDI: faqat SHA-256 xeshi turadi.
CREATE TABLE "export_links" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "export_links_token_hash_key" ON "export_links"("token_hash");
CREATE INDEX "export_links_clinic_id_idx" ON "export_links"("clinic_id");

ALTER TABLE "export_links" ADD CONSTRAINT "export_links_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
