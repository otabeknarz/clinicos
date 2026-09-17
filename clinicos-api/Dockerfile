# ClinicOS API.
#
# Bitta bosqichli image va bu ATAYLAB.
#
# Ko'p bosqichli qilib devDependencies ni tashlab yuborish mumkin
# edi, lekin serverda ular baribir kerak bo'ladi:
#
#   prisma      — `prisma migrate deploy` (har ishga tushishda)
#   ts-node     — `npm run bootstrap` (birinchi hisob, yangi klinika)
#   @nestjs/cli — yig'ish
#
# Ularsiz migratsiyani ham, birinchi klinikani ham qo'shib
# bo'lmasdi. Image kattaroq, lekin serverga kirib ish qilish
# mumkin bo'lib qoladi.

FROM node:24-slim

# NEGA 24: `package-lock.json` npm 11 bilan yozilgan. Node 20 da
# npm 10 keladi va u daraxtni boshqacha yechib, `npm ci` ni
# "lockfile mos emas" deb to'xtatadi (chokidar, readdirp).
# Loyiha ham Node 24 da ishlab chiqilgan — bir xil tursin.

# Prisma va HTTPS uchun
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Avval faqat manifest — kod o'zgarganda npm qatlami qayta
# yuklanmasin (Docker qatlam keshi)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# TAYYORLIK TEKSHIRUVI. Coolify yangi konteynerni shu tekshiruv o'tgandan
# keyingina ishga qo'yadi va eskisini shundan keyin to'xtatadi. Tekshiruvsiz
# eski konteyner darrov to'xtatilardi va yangi versiya migratsiya qilib
# ko'tarilguncha (20–40 soniya) har bir so'rov xato qaytarardi.
# `curl` yo'q (slim image) — Node'ning o'z `fetch` i ishlatiladi.
# `start-period` — migratsiya va ishga tushish uchun vaqt.
HEALTHCHECK --interval=5s --timeout=4s --start-period=90s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main"]
