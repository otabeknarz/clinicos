#!/bin/sh
set -e

#
# Har ishga tushishda migratsiya qo'llanadi.
#
# NEGA SHU YERDA: yangi versiyada jadval o'zgargan bo'lsa, ilova
# eski baza ustida ishga tushib, tushunarsiz xato berardi.
# `migrate deploy` qo'llanmagan migratsiyalarni topadi, bo'lmasa
# hech narsa qilmaydi — ya'ni har safar ishlatish xavfsiz.
#
# `migrate dev` EMAS: u ishlab chiqishga mo'ljallangan va kerak
# bo'lsa bazani qayta yaratadi. Serverda bunday narsa bo'lmasin.
#
echo "Migratsiya tekshirilmoqda…"
npx prisma migrate deploy

#
# Boshlang'ich yozuvlar (platforma egasi, klinika) BU YERDA
# yaratilmaydi. Ular bir martalik va parol talab qiladi —
# `npm run bootstrap` bilan qo'lda bajariladi.
# Batafsil: deploy/README.md
#

exec "$@"
