-- AlterTable
-- O'chirish ARXIVLASHDAN boshqa narsa: arxiv "mijoz ketdi, qaytishi
-- mumkin" degani va klinika ro'yxatda turaveradi. O'chirilgani esa
-- platformaning ish ro'yxatidan chiqadi. Ma'lumot ikkalasida ham
-- bazada qoladi.
ALTER TABLE "clinics" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_reason" TEXT NOT NULL DEFAULT '';
