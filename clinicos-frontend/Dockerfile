# ClinicOS interfeysi.
#
# Ikki bosqich: yig'ish va tarqatish. Natija — Nginx ichidagi
# statik fayllar, Node umuman qolmaydi.

FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

#
# DIQQAT: `VITE_API_URL` YIG'ISH PAYTIDA fayllarga kiritiladi.
# Konteynerni ishga tushirganda berilsa KECH BO'LADI — Vite uni
# `import.meta.env` orqali build vaqtida o'rniga qo'yadi.
#
# Coolify'da bu o'zgaruvchi "Build Variable" deb belgilangan
# bo'lishi kerak, oddiy muhit o'zgaruvchisi emas.
#
# Berilmasa ilova DEMO rejimda yig'iladi: hamma ma'lumot
# brauzerda yasaladi va serverga bitta ham so'rov ketmaydi.
# Shuning uchun bo'shligini shu yerda ushlaymiz — bunday build
# jimgina chiqib ketmasin.
#
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "XATO: VITE_API_URL berilmagan — demo rejimda yig'ilib ketardi" && exit 1)

RUN npm run build

# ------------------------------------------------------------------

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
