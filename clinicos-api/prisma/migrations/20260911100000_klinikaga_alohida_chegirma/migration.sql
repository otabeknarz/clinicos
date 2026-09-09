-- Klinikaga ALOHIDA chegirma.
--
-- `discount_pct` obuna paytida muzlatilgan natija; muddat
-- almashtirilganda u qaytadan hisoblanadi. Kelishilgan foiz esa
-- qaror bo'lgani uchun alohida saqlanadi va har hisobda ustun
-- turadi. NULL — muddatning umumiy chegirmasi amal qiladi.
ALTER TABLE "subscriptions" ADD COLUMN "custom_discount_pct" INTEGER;
