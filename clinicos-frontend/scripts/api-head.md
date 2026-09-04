# ClinicOS — Backend shartnomasi

**{{COUNT}} ta endpoint.**

Bu hujjat **avtomatik generatsiya qilinadi**, manba — `src/api/` papkasi.
Frontend backendga faqat o'sha papka orqali murojaat qiladi; boshqa
hech qayerda `fetch` yo'q. Kodni o'zgartirgach qayta yarating:

```bash
npm run docs:api
```

---

## Umumiy qoidalar

**Manzil.** Frontend `.env` dagi `VITE_API_URL` ga so'rov yuboradi.
U berilmasa ilova demo (mock) rejimda ishlaydi va serverga umuman
murojaat qilmaydi — shuning uchun backendsiz ham to'liq ko'rish mumkin.

**Autentifikatsiya.** Har bir so'rovda `Authorization: Bearer <token>`.
So'rovlar `credentials: 'include'` bilan ketadi, ya'ni HttpOnly cookie
ishlatsangiz ham bo'ladi — u holda token brauzerda umuman saqlanmaydi
va bu xavfsizroq variant.

**Javob formati.** Barchasi JSON. Ro'yxatlar sahifalangan:

```json
{ "items": [], "total": 620, "page": 1, "pageSize": 20 }
```

**Xatolik.** HTTP holat kodi va tana:

```json
{ "message": "Telefon band", "errors": { "phone": "Bu raqam ro'yxatda bor" } }
```

`errors` ichidagi maydonlar formada tegishli katak ostida ko'rsatiladi.
`204 No Content` — javob tanasi yo'q degani.

---

## To'rtta qoida: buzilsa tizim ishlamaydi

**1. Klinika ajratish.** Frontend so'rovga `clinicId` **qo'shmaydi**.
Server uni **tokendan** oladi va HAR BIR so'rovni shu klinika bo'yicha
filtrlaydi. Bu eng muhim qoida: buzilsa, bir klinika boshqasining
bemorlarini ko'radi.

**2. Ruxsatlar serverda tekshiriladi.** Frontenddagi tekshiruvlar faqat
interfeys uchun — tugmani ko'rsatish yoki yashirish. **Ular himoya
emas**: so'rovni brauzer konsolidan ham yuborsa bo'ladi. Server har bir
so'rovda rolni mustaqil tekshirishi shart. Rollar va ruxsatlar ro'yxati:
`src/lib/permissions.ts`.

**3. Shifokor ko'lami.** Rol `doctor` bo'lsa, server javobni faqat o'sha
shifokorga tegishli yozuvlar bilan cheklaydi. Frontend buni
`scopeDoctorId` orqali taqlid qiladi, lekin haqiqiy cheklov serverda
bo'lishi kerak.

**4. To'lov yozuvi o'zgarmaydi.** Kiritilgan to'lovni tahrirlash yoki
o'chirish endpointi **yo'q, va bo'lmasligi kerak**. Xato bo'lsa —
qaytarish (refund) yozuvi qo'shiladi. Butun firibgarlikka qarshi mantiq
shunga tayanadi: shifokor tashrifni yozadi, registrator pulni yozadi,
tizim ikkalasini solishtiradi. Yozuvni o'chirib bo'ladigan bo'lsa,
solishtirishning ma'nosi qolmaydi.

---

## Yana nima o'qish kerak

| Nima | Qayerda |
|---|---|
| Jadvallar va bog'lanishlar | `docs/DATABASE.md` |
| So'rov/javob JSON tuzilishi (tiplar) | `src/types/models.ts` |
| Rollar va ruxsatlar | `src/lib/permissions.ts` |
| HTTP qatlami, token, xatolik | `src/api/client.ts` |

Quyidagi ro'yxatdagi TypeScript imzolari `src/types/models.ts` dagi
tiplarga ishora qiladi — javob JSON'i aynan o'sha shaklda bo'lishi kerak.

---
