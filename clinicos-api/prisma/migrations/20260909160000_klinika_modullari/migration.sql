-- AlterTable
-- Bo'sh ro'yxat = hamma modul yoqilgan. Mavjud klinikalarda hech narsa
-- o'zgarmaydi: ular avvalgidek to'liq ishlayveradi.
ALTER TABLE "clinics" ADD COLUMN     "disabled_modules" TEXT[];
