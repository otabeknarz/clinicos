-- Bo'lim cheklovi (sababi bilan) va sinov shartlari
CREATE TYPE "ModuleBlockReason" AS ENUM ('SOON', 'PLAN', 'MAINTENANCE', 'OFF');

CREATE TABLE "module_restrictions" (
    "id" TEXT NOT NULL,
    "target_clinic_id" TEXT NOT NULL DEFAULT '',
    "module" TEXT NOT NULL,
    "reason" "ModuleBlockReason" NOT NULL DEFAULT 'SOON',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_restrictions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "module_restrictions_target_clinic_id_module_key"
    ON "module_restrictions"("target_clinic_id", "module");
CREATE INDEX "module_restrictions_module_idx" ON "module_restrictions"("module");

CREATE TABLE "trial_policies" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 14,
    "disabled_modules" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trial_policies_direction_key" ON "trial_policies"("direction");
