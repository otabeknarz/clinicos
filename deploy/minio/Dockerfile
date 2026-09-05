# ClinicOS fayl xotirasi — MinIO (S3 mos).
#
# NEGA ALOHIDA DOCKERFILE, tayyor image emas:
#
# MinIO image'ining CMD'i shunchaki `minio` — kichik buyruqsiz u
# yordam matnini chiqarib to'xtaydi. Ya'ni `server /data` buyrug'i
# albatta berilishi kerak. Coolify'ning "docker image" ilovasida
# buyruqni ishonchli berib bo'lmadi (konteyner qayta-qayta
# qulardi), shuning uchun buyruq shu yerda qat'iy yozilgan.
#
# Yon foydasi: versiya ham, buyruq ham git'da ko'rinib turadi va
# o'zgarishi ko'rib chiqiladi.

FROM minio/minio:RELEASE.2025-09-07T16-13-09Z

# Ma'lumot shu papkada. Coolify uni doimiy hajmga bog'laydi.
VOLUME /data

EXPOSE 9000

# `--console-address` yo'q: veb-konsol o'chirilgan (MINIO_BROWSER=off).
# Bizga faqat S3 API kerak, konsol ortiqcha hujum yuzasi.
CMD ["server", "/data"]
