-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "admission_id" TEXT,
ALTER COLUMN "service_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
