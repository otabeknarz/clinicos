-- CreateEnum
CREATE TYPE "ServicePriceMode" AS ENUM ('FIXED', 'DOCTOR_SET');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "price_mode" "ServicePriceMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "min_price" INTEGER,
ADD COLUMN     "max_price" INTEGER;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "price" INTEGER;
