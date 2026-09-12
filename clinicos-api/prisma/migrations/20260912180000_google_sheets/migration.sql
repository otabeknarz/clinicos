-- Google akkaunt va jadvallar.
-- refresh_token_enc — SHIFRLANGAN holda (AES-256-GCM).
CREATE TABLE "google_accounts" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "connected_by_id" TEXT NOT NULL,
    "connected_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_accounts_clinic_id_key" ON "google_accounts"("clinic_id");

CREATE TABLE "google_sheets" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_sheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_sheets_clinic_id_dataset_key" ON "google_sheets"("clinic_id", "dataset");

ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "google_sheets" ADD CONSTRAINT "google_sheets_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
