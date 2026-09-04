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

FROM node:20-slim

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

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main"]
