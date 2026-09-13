/**
 * SOTUV BO'LIMLARINING TARJIMASI — tanlov sahifasi, apteka taqdimoti va
 * klinika sahifasiga qo'shilgan bloklar.
 *
 * `about-i18n.tsx` bilan bir xil qoida: kalit — o'zbekcha matnning
 * O'ZI (bo'shliqlar siqilgan holda). Alohida faylda, chunki asosiy
 * lug'at klinika sahifasi bilan birga tasdiqlangan va u yerga yangi
 * qatorlarni aralashtirish uni o'qib bo'lmas qilardi.
 */

export const RU_SALES: Record<string, string> = {
  /* --- Asl lug'atda yo'q edi --- */
  Yakunlandi: 'Завершён',
  Qabulda: 'На приёме',
  Kutilmoqda: 'Ожидает',
  'Terapevt · 09:00': 'Терапевт · 09:00',
  'Terapevt · 10:00': 'Терапевт · 10:00',
  'Konsultatsiya · 09:30': 'Консультация · 09:30',
  '11-sentabr · Demo': '11 сентября · Демо',
  '11-sentabr': '11 сентября',
  '4-sentabr': '4 сентября',
  '28-avgust': '28 августа',
  '11-sentabr · 09:00': '11 сентября · 09:00',
  '0 so‘m': '0 сум',
  'Yuqoridagi «Kirish» tugmasini bosing. U sizni': 'Нажмите кнопку «Войти» вверху. Она переведёт вас',
  'olib o‘tadi.': 'в аккаунт.',
  Du: 'Пн',
  Se: 'Вт',
  Ch: 'Ср',
  Pa: 'Чт',
  Ju: 'Пт',
  Sh: 'Сб',
  Ya: 'Вс',

  /* --- Qobiq --- */
  'Klinika va apteka uchun boshqaruv tizimi': 'Система управления для клиник и аптек',
  'Klinikangizga tartib. Sizga xotirjamlik.': 'Порядок в вашей клинике. Вам — спокойствие.',
  'Dorixonangizga tartib. Kassangizga aniqlik.': 'Порядок в аптеке. Точность в кассе.',
  'Klinikalar uchun': 'Для клиник',
  'Aptekalar uchun': 'Для аптек',
  'Bemorlar uchun': 'Для пациентов',
  'Onlayn retsept': 'Онлайн-рецепт',
  Boshlash: 'Как начать',
  'Klinika va apteka uchun — bitta tizimda.': 'Для клиник и аптек — в одной системе.',
  'Xususiy klinikalar va aptekalar uchun boshqaruv tizimi.':
    'Система управления для частных клиник и аптек.',
  'Yo‘nalishni tanlang': 'Выберите направление',

  /* --- Tanlov sahifasi --- */
  'Xususiy klinika va aptekalar uchun': 'Для частных клиник и аптек',
  'Biznesingizga tartib.': 'Порядок в вашем бизнесе.',
  'Biznesingizni tanlang — o‘sha yo‘nalish uchun imkoniyatlar, jonli demo va ko‘p so‘raladigan savollarga javoblar ochiladi.':
    'Выберите свой бизнес — откроются возможности, живое демо и ответы на частые вопросы именно для него.',
  Tasdiqladi: 'Подтвердил',
  'Xususiy klinikalar': 'Частные клиники',
  'Qabullar, bemorlar, shifokorlar va kassa — qabuldan to‘lovgacha bitta jarayon.':
    'Приёмы, пациенты, врачи и касса — один процесс от записи до оплаты.',
  'Qabul jadvali va navbat': 'Расписание приёмов и очередь',
  'Bemorga Telegram orqali eslatma': 'Напоминание пациенту в Telegram',
  'Shifokorning telefonida ish joyi': 'Рабочее место врача в телефоне',
  'Kassa va qarzdorlik nazorati': 'Контроль кассы и долгов',
  'Klinikalar uchun ko‘rish': 'Смотреть для клиник',
  'Joriy chek': 'Текущий чек',
  Dorixonalar: 'Аптеки',
  'Kassa, dori zaxirasi, muddatlar va smenalar — kirimdan kassagacha nazorat.':
    'Касса, остатки, сроки годности и смены — контроль от прихода до кассы.',
  'Shtrix-kod bilan tezkor kassa': 'Быстрая касса со штрихкодом',
  'Partiya va muddat nazorati': 'Контроль партий и сроков',
  'Smena va kassa kamomadi': 'Смены и недостачи в кассе',
  'Klinikalardan onlayn retsept': 'Онлайн-рецепты от клиник',
  'Aptekalar uchun ko‘rish': 'Смотреть для аптек',
  '14 kun bepul': '14 дней бесплатно',
  'Karta ma’lumoti so‘ralmaydi': 'Данные карты не нужны',
  Jami: 'Итого',
  '19 500 so‘m': '19 500 сум',
  'Paratsetamol 500 mg': 'Парацетамол 500 мг',
  'Ibuprofen 200 mg': 'Ибупрофен 200 мг',
  'Loratadin 10 mg': 'Лоратадин 10 мг',
  'Amoksitsillin 500 mg': 'Амоксициллин 500 мг',
  'Sefazolin 1 g': 'Цефазолин 1 г',
  'Vitamin D3': 'Витамин D3',

  /* --- Apteka: hero va demo --- */
  'Dorixonalar uchun yaratilgan': 'Создано для аптек',
  'Dorixonangizga tartib.': 'Порядок в аптеке.',
  Kassangizga: 'В кассе —',
  'aniqlik.': 'точность.',
  'Kassa, dori zaxirasi, muddatlar va xodimlar — bir tizimda.':
    'Касса, остатки, сроки годности и сотрудники — в одной системе.',
  'Kun oxirida kassa nega farq qilganini aniq bilasiz.':
    'В конце дня вы точно знаете, почему касса не сошлась.',
  '14 kun bepul sinash': 'Попробовать 14 дней бесплатно',
  Kirimdan: 'От прихода',
  'kassagacha.': 'до кассы.',
  'Bir apteka. Har kimga o‘z ish joyi.': 'Одна аптека. Каждому — своё рабочее место.',
  'Apteka rahbari': 'Руководитель аптеки',
  Sotuvchi: 'Продавец',
  DORIXONA: 'АПТЕКА',
  Kassa: 'Касса',
  Dorilar: 'Лекарства',
  Zaxira: 'Остатки',
  'Kelgan retseptlar': 'Входящие рецепты',
  Smena: 'Смена',
  Analitika: 'Аналитика',
  'Shtrix-kod va DataMatrix': 'Штрихкод и DataMatrix',
  'Partiya va muddat': 'Партии и сроки',
  'Rahbar va sotuvchi alohida': 'Руководитель и продавец раздельно',
  'Aptekangiz bugun': 'Ваша аптека сегодня',
  'Tushum, foyda va kassa — umumiy ko‘rinishda.': 'Выручка, прибыль и касса — в одном обзоре.',
  'Bugungi foyda': 'Прибыль сегодня',
  'O‘rtacha ustama 24%': 'Средняя наценка 24%',
  'Muddati yaqin': 'Срок истекает',
  partiya: 'партий',
  '90 kun ichida tugaydi': 'Истекает в течение 90 дней',
  Smenalar: 'Смены',
  'Kassa nazorati': 'Контроль кассы',
  'Kecha · 08:00–20:00': 'Вчера · 08:00–20:00',
  'Kassa to‘g‘ri': 'Касса сошлась',
  'Bugun · 20:00 gacha': 'Сегодня · до 20:00',
  Smenada: 'На смене',
  '10-sentabr': '10 сентября',
  '25 000 kam': 'Недостача 25 000',
  'Aptekangiz ma’lumotlari bir joyda': 'Данные аптеки в одном месте',
  'Qutini skanerlang — dori chekka tushadi.': 'Сканируйте упаковку — лекарство попадёт в чек.',
  'Bugungi cheklar': 'Чеков сегодня',
  chek: 'чеков',
  'O‘rtacha chek 72 000 so‘m': 'Средний чек 72 000 сум',
  'Kassadagi naqd': 'Наличные в кассе',
  'Smena oxirida sanaladi': 'Пересчитываются в конце смены',
  retsept: 'рецепта',
  'Klinikalardan onlayn': 'Онлайн от клиник',
  '2 dona': '2 шт.',
  '1 dona': '1 шт.',
  '38 dona': '38 шт.',
  '28 500 so‘m': '28 500 сум',
  Karta: 'Карта',
  Skanerdan: 'Со сканера',
  'Shtrix-kod o‘qildi': 'Штрихкод считан',
  Dori: 'Лекарство',
  Partiya: 'Партия',
  'B-2407 · 2027-yil, mart': 'B-2407 · март 2027',
  Qoldiq: 'Остаток',

  /* --- Apteka: savol kartalari --- */
  'Apteka egalari so‘raydi': 'Спрашивают владельцы аптек',
  'Savolingiz —': 'Ваш вопрос —',
  'tizimdagi javobi.': 'и ответ системы.',
  'Tizim o‘rnatishdan oldin eng ko‘p beriladigan savollar. Har biriga — tizim ichida qanday ishlashi.':
    'Самые частые вопросы перед внедрением. И как это устроено в системе.',
  'Kassa kamomadi': 'Недостача в кассе',
  'Kassadan pul kam chiqsa,': 'Если в кассе не хватает денег,',
  'qanday bilaman?': 'как я об этом узнаю?',
  'Sotuvchi smenani yopishda naqd pulni sanab yozadi. Summa tizimdagidan kam bo‘lsa, u ogohlantiriladi. Shunday qoldirsa — yozuv sizning ro‘yxatingizda alohida belgilanadi.':
    'Закрывая смену, продавец пересчитывает и вносит наличные. Если сумма меньше, чем в системе, он получает предупреждение. Если оставит так — запись будет отдельно отмечена в вашем списке.',
  'Smenani yopish': 'Закрытие смены',
  'Naqd savdo (tizim)': 'Продажи наличными (система)',
  '2 150 000 so‘m': '2 150 000 сум',
  'Sanalgan naqd': 'Пересчитано наличных',
  '2 125 000 so‘m': '2 125 000 сум',
  'Tizim summasidan 25 000 so‘m kam': 'На 25 000 сум меньше, чем в системе',
  'Rahbar ro‘yxatida alohida belgilanadi': 'Отдельно отмечается у руководителя',
  'Muddat nazorati': 'Контроль сроков',
  'Muddati o‘tgan dori': 'Просроченное лекарство',
  'sotilib ketmaydimi?': 'не продадут по ошибке?',
  'Har bir partiya muddati bilan yoziladi. Muddati o‘tgani kassada chiqmaydi, 90 kundan kam qolganlari alohida ro‘yxatda turadi.':
    'Каждая партия записывается со сроком годности. Просроченная не появляется в кассе, а партии, у которых осталось меньше 90 дней, — в отдельном списке.',
  'Zaxira · Namuna': 'Остатки · Пример',
  'Partiya B-2311': 'Партия B-2311',
  'Partiya B-2402': 'Партия B-2402',
  'Partiya B-2405': 'Партия B-2405',
  '18 kun': '18 дней',
  '46 kun': '46 дней',
  '83 kun': '83 дня',
  'Tezkor kassa': 'Быстрая касса',
  'Dori qidirib,': 'Пока ищут лекарство,',
  'navbat yig‘ilmaydimi?': 'не собирается очередь?',
  'Qutini skanerlang — dori chekka tushadi. Kirimda esa DataMatrix kodidan partiya va muddat o‘zi o‘qiladi.':
    'Сканируйте упаковку — лекарство попадёт в чек. А при приходе партия и срок сами считываются из кода DataMatrix.',
  'Kirim · skanerdan · Demo': 'Приход · со сканера · Демо',
  Muddati: 'Срок годности',
  '2027-yil, mart': 'март 2027',
  Narxi: 'Цена',
  '12 500 so‘m': '12 500 сум',
  'Xodimlar va ruxsatlar': 'Сотрудники и доступы',
  'Sotuvchi tannarx va': 'Видит ли продавец',
  'foydani ko‘radimi?': 'себестоимость и прибыль?',
  'Yo‘q. Sotuvchi kassa va smenani ko‘radi. Tannarx, foyda, kirim va kassa nazorati — faqat rahbarda.':
    'Нет. Продавец видит кассу и смену. Себестоимость, прибыль, приход и контроль кассы — только у руководителя.',
  Sotadi: 'Продаёт',
  'Kirim huquqi': 'Право на приход',
  'Tovar qabul qiladi': 'Принимает товар',

  /* --- Apteka: jarayon --- */
  'Dorining aptekadagi yo‘li': 'Путь лекарства в аптеке',
  'Bosqichni tanlang: tovar kelganidan kun yakunigacha ma’lumot qanday bog‘lanishini ko‘ring.':
    'Выберите этап: посмотрите, как связаны данные — от поступления товара до конца дня.',
  'Bosqichni tanlang': 'Выберите этап',
  'Tovar qabul qilinadi': 'Товар принимается',
  'Ta’minotchi hujjati bo‘yicha': 'По документу поставщика',
  'Chek uriladi': 'Пробивается чек',
  'Sotuvchi skanerlaydi': 'Продавец сканирует',
  'Kassa topshiriladi': 'Касса сдаётся',
  'Naqd pul sanaladi': 'Наличные пересчитываются',
  'Tanlangan bosqich': 'Выбранный этап',
  KIRIM: 'ПРИХОД',
  'Tovar zaxiraga tushdi.': 'Товар поступил на остатки.',
  'Har bir qator partiya, muddat va tannarx bilan yoziladi. Dori katalogda bo‘lmasa, shu yerning o‘zida ochiladi.':
    'Каждая строка — с партией, сроком и себестоимостью. Если лекарства нет в каталоге, его можно создать прямо здесь.',
  'Ta’minotchi': 'Поставщик',
  'Farm Distribyutor': 'Фарм Дистрибьютор',
  Qatorlar: 'Строк',
  '24 ta': '24',
  'Jami tannarx': 'Итого по себестоимости',
  '18 400 000 so‘m': '18 400 000 сум',
  'Kirim qabul qilindi · Namuna': 'Приход принят · Пример',
  'Chek urildi.': 'Чек пробит.',
  'Kassada eng yaqin muddatli partiya birinchi turadi. Sotilgan dori zaxiradan o‘zi ayiriladi.':
    'В кассе первой стоит партия с ближайшим сроком. Проданное лекарство само списывается с остатков.',
  Chekda: 'В чеке',
  '3 ta dori': '3 лекарства',
  'Savdo zaxiradan ayirildi': 'Продажа списана с остатков',
  SMENA: 'СМЕНА',
  'Smena yopildi.': 'Смена закрыта.',
  'Sotuvchi naqd pulni sanab yozadi. Farq chiqsa, rahbar kimning smenasida va qancha ekanini ko‘radi.':
    'Продавец пересчитывает и вносит наличные. Если есть расхождение, руководитель видит, в чью смену и на сколько.',
  'Naqd (tizim)': 'Наличные (система)',
  Farq: 'Расхождение',
  'Kassa to‘g‘ri topshirildi': 'Касса сдана без расхождений',

  /* --- Apteka: onlayn retsept --- */
  'Yangi xaridorlar': 'Новые покупатели',
  'Klinika retsepti': 'Рецепт из клиники',
  'aptekangizga keladi.': 'приходит в вашу аптеку.',
  'ClinicOS’dagi klinikalarda shifokor retsept yozganda, bemorga uchta apteka narxi bilan taklif qilinadi. Tanlangan aptekaga retsept onlayn keladi — dorini oldindan tayyorlab qo‘yasiz.':
    'Когда врач клиники в ClinicOS выписывает рецепт, пациенту предлагают три аптеки с ценами. В выбранную аптеку рецепт приходит онлайн — лекарство можно подготовить заранее.',
  'Narx aptekangiz katalogidan hisoblanadi': 'Цена считается по каталогу вашей аптеки',
  'Taklif navbat bilan — har safar bir xil apteka chiqmaydi':
    'Аптеки предлагаются по очереди — не всегда одна и та же',
  'Bemor retsept kodi bilan keladi': 'Пациент приходит с кодом рецепта',
  'Kelgan retsept': 'Входящий рецепт',
  'RETSEPT KODI': 'КОД РЕЦЕПТА',
  'bemor ko‘rsatadi': 'показывает пациент',
  'TAXMINIY SUMMA': 'ОРИЕНТИРОВОЧНАЯ СУММА',
  'so‘m · katalog narxida': 'сум · по ценам каталога',
  '1 quti': '1 уп.',
  'Dori tayyorlab qo‘yildi': 'Лекарство подготовлено',
  Tayyor: 'Готово',
  'Namunaviy retsept. Haqiqiy bemor ma’lumoti emas.':
    'Пример рецепта. Не реальные данные пациента.',

  /* --- Apteka: kengroq imkoniyatlar --- */
  'Rahbarga kerak': 'Всё, что нужно',
  'bo‘lgan hammasi.': 'руководителю.',
  'Kundalik savdodan tashqari — aptekani boshqarishga kerak bo‘ladigan ishlar.':
    'Помимо ежедневных продаж — всё, что нужно для управления аптекой.',
  'Tushum, foyda, ustama va o‘rtacha chek. Eng ko‘p sotilgan va umuman sotilmayotgan tovar alohida.':
    'Выручка, прибыль, наценка и средний чек. Самые продаваемые и совсем не продающиеся товары — отдельно.',
  'Kirim va ta’minotchilar': 'Приход и поставщики',
  'Har bir kirim hujjat raqami, partiya, muddat va tannarx bilan. Qaysi ta’minotchidan nima kelgani ko‘rinadi.':
    'Каждый приход — с номером документа, партией, сроком и себестоимостью. Видно, что пришло от какого поставщика.',
  'Smena jadvali': 'График смен',
  'Kim qaysi kun va soatda kassada ekanini tizim biladi. Farq kimning smenasida chiqqani ko‘rinadi.':
    'Система знает, кто в какой день и час стоит на кассе. Видно, в чью смену возникло расхождение.',
  'Excel’dan ko‘chirish': 'Перенос из Excel',
  'Dori katalogi va ta’minotchilar Excel jadvalidan (CSV) bir marta yuklanadi — bittalab kiritish shart emas.':
    'Каталог лекарств и поставщики загружаются из таблицы Excel (CSV) один раз — вносить по одному не нужно.',
  'Hisobotni yuklab olish': 'Выгрузка отчётов',
  'Savdo, kirim, zaxira va smenalar — Excel’da ochiladigan faylga yoki Google Sheets jadvaliga.':
    'Продажи, приход, остатки и смены — в файл для Excel или в таблицу Google Sheets.',
  'Ishdan ketgan xodim': 'Уволенный сотрудник',
  'Kirishi o‘sha zahoti yopiladi. Uning savdo va smena tarixi esa saqlanib qoladi.':
    'Доступ закрывается сразу. А история его продаж и смен сохраняется.',

  /* --- Qanday boshlaymiz --- */
  'Qanday boshlaymiz?': 'Как начать?',
  'Bugun ro‘yxatdan o‘ting,': 'Зарегистрируйтесь сегодня,',
  'ertaga soting.': 'продавайте завтра.',
  'ertaga ishlang.': 'работайте завтра.',
  'Dastur o‘rnatilmaydi — kompyuter yoki planshetda brauzer orqali ishlaydi.':
    'Ничего не нужно устанавливать — работает в браузере на компьютере или планшете.',
  'Dastur o‘rnatilmaydi — kompyuter, planshet yoki telefonda brauzer orqali ishlaydi.':
    'Ничего не нужно устанавливать — работает в браузере на компьютере, планшете или телефоне.',
  'Ro‘yxatdan o‘ting': 'Зарегистрируйтесь',
  'Telefon raqamingiz Telegram orqali tasdiqlanadi. Bir necha daqiqa.':
    'Номер телефона подтверждается через Telegram. Пара минут.',
  'Dorilarni yuklang': 'Загрузите лекарства',
  'Katalogni Excel jadvalidan ko‘chiring yoki birinchi kirimda yozing.':
    'Перенесите каталог из таблицы Excel или внесите при первом приходе.',
  'Sotuvchilarni qo‘shing': 'Добавьте продавцов',
  'Har biriga login va ish vaqti. Parolni birinchi kirishda o‘zi almashtiradi.':
    'Каждому — логин и рабочее время. Пароль сотрудник сменит при первом входе.',
  '14 kun bepul ishlang': 'Работайте 14 дней бесплатно',
  'Karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz siz bilan bog‘lanadi.':
    'Данные карты не нужны. Во время пробного периода с вами свяжется наш менеджер.',
  'Raqamingiz Telegram orqali tasdiqlanadi. Yo‘nalishni tanlaysiz — bo‘limlar shunga moslab ochiladi.':
    'Номер подтверждается через Telegram. Вы выбираете направление — разделы открываются под него.',
  'Ma’lumotlarni ko‘chiring': 'Перенесите данные',
  'Bemorlar va xizmatlar ro‘yxatini Excel jadvalidan (CSV) yuklang.':
    'Загрузите списки пациентов и услуг из таблицы Excel (CSV).',
  'Jamoani qo‘shing': 'Добавьте команду',
  'Shifokor va registratorga o‘z logini. Shifokor Telegram’ga bir tugma bilan ulanadi.':
    'Врачу и регистратору — свой логин. Врач подключает Telegram одной кнопкой.',
  'Umumiy klinika': 'Многопрофильная клиника',
  Stomatologiya: 'Стоматология',
  'Ko‘z klinikasi': 'Глазная клиника',
  Laboratoriya: 'Лаборатория',

  /* --- Savollar --- */
  'Apteka egalari uchrashuvda eng ko‘p so‘raydigan savollar.':
    'Вопросы, которые владельцы аптек чаще всего задают на встрече.',
  'Klinika egalari uchrashuvda eng ko‘p so‘raydigan savollar.':
    'Вопросы, которые владельцы клиник чаще всего задают на встрече.',
  'Narxi qancha? Bepul sinab ko‘rsa bo‘ladimi?': 'Сколько стоит? Можно попробовать бесплатно?',
  'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz bog‘lanib, aptekangiz hajmiga mos tarifni taklif qiladi.':
    'Первые 14 дней — бесплатно, данные карты не нужны. Во время пробного периода менеджер свяжется с вами и предложит тариф под размер вашей аптеки.',
  'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Keyin tarif 3, 6 yoki 12 oyga olinadi. Aniq narxni menejerimiz klinikangiz hajmiga qarab aytadi.':
    'Первые 14 дней — бесплатно, данные карты не нужны. Затем тариф оформляется на 3, 6 или 12 месяцев. Точную цену менеджер назовёт с учётом размера клиники.',
  'Qanday uskuna kerak?': 'Какое оборудование нужно?',
  'Internetga ulangan kompyuter, noutbuk yoki planshet. Dastur o‘rnatilmaydi — brauzerda ishlaydi. Shtrix-kod skaneri bo‘lsa, dori qidirmasdan chekka tushadi; usiz ham ishlash mumkin.':
    'Компьютер, ноутбук или планшет с интернетом. Ничего не устанавливается — всё работает в браузере. Со сканером штрихкодов лекарство попадает в чек без поиска; без него тоже можно работать.',
  'Dorilarimni bittalab kiritib chiqishim kerakmi?': 'Придётся вносить лекарства по одному?',
  'Yo‘q. Dori katalogi va ta’minotchilar ro‘yxatini Excel jadvalidan (CSV fayl) yuklaysiz. Tizim avval nima qo‘shilishini ko‘rsatadi, keyin saqlaydi — bor dorilar takrorlanmaydi.':
    'Нет. Каталог лекарств и список поставщиков загружаются из таблицы Excel (CSV-файл). Система сначала показывает, что будет добавлено, затем сохраняет — уже существующие лекарства не дублируются.',
  'Bir nechta sotuvchi ishlasa-chi?': 'А если работают несколько продавцов?',
  'Har bir sotuvchi o‘z logini bilan kiradi. Ish vaqtiga qarab kassa kimda ekanini tizim biladi, kassa farqi esa kimning smenasida chiqqani bilan yoziladi.':
    'Каждый продавец входит под своим логином. По рабочему времени система знает, у кого касса, а расхождение записывается на смену конкретного человека.',
  'Klinikalardan retsept qanday keladi?': 'Как приходят рецепты от клиник?',
  'ClinicOS’dagi klinikada shifokor retsept yozganda bemorga uchta apteka narxi bilan taklif qilinadi. Bemor sizni tanlasa, retsept «Kelgan retseptlar» bo‘limiga tushadi: dorini tayyorlab «Tayyor», bergach «Berildi» deb belgilaysiz.':
    'Когда врач клиники в ClinicOS выписывает рецепт, пациенту предлагают три аптеки с ценами. Если пациент выбрал вас, рецепт попадает во «Входящие рецепты»: подготовив лекарство, отмечаете «Готово», а выдав — «Выдано».',
  'Ma’lumotlarim xavfsizmi?': 'Мои данные в безопасности?',
  'Har bir aptekaning ma’lumoti alohida saqlanadi — boshqa apteka yoki klinika sizning dori, savdo va kassa ma’lumotingizni ko‘rmaydi. Sotuvchi esa faqat o‘z ishiga kerak bo‘lgan qismini ko‘radi.':
    'Данные каждой аптеки хранятся отдельно — другая аптека или клиника не видит ваши лекарства, продажи и кассу. А продавец видит только то, что нужно для его работы.',
  'Qancha vaqtda ishga tushiramiz?': 'Как быстро можно начать?',
  'Ro‘yxatdan o‘tish bir necha daqiqa. Bemorlar va xizmatlarni Excel jadvalidan yuklab, xodimlarga login bersangiz — o‘sha kuniyoq qabul yozishni boshlaysiz.':
    'Регистрация занимает пару минут. Загрузите пациентов и услуги из Excel, выдайте сотрудникам логины — и в тот же день начинайте записывать на приём.',
  'Bemorlar ro‘yxatini qaytadan kiritib chiqamizmi?': 'Придётся заново вносить всех пациентов?',
  'Yo‘q. Bemorlar va xizmatlar ro‘yxati Excel jadvalidan (CSV fayl) yuklanadi. Tizim avval nima qo‘shilishini ko‘rsatadi, bor yozuvlar esa takrorlanmaydi.':
    'Нет. Списки пациентов и услуг загружаются из таблицы Excel (CSV-файл). Система сначала показывает, что будет добавлено, а существующие записи не дублируются.',
  'Shifokor kompyuterdan uzoqda bo‘lsa-chi?': 'А если врач не у компьютера?',
  'Shifokor ClinicOS’ni Telegram ichida, telefonidan ochadi. Yangi qabul haqida xabar keladi, tugmani bossa ko‘rik formasi ochiladi.':
    'Врач открывает ClinicOS прямо в Telegram на телефоне. Приходит сообщение о новом приёме, по кнопке открывается форма осмотра.',
  'Registrator pulni yashirsa, bilamanmi?': 'Узнаю ли я, если регистратор скроет деньги?',
  'To‘lovni registrator yozadi, nazoratni siz qilasiz. Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi. Kun oxirida tizimdagi naqd tushum kassadagi pul bilan solishtiriladi.':
    'Оплату вносит регистратор, контролируете вы. Внесённую оплату нельзя удалить — ошибка исправляется только записью о возврате. В конце дня наличная выручка в системе сверяется с деньгами в кассе.',
  'Bemorlar qabulga kelmay qolsa-chi?': 'А если пациенты не приходят на приём?',
  'Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma boradi va u qabulni tasdiqlaydi. Kelmay qolganlar alohida belgilanadi — ularning ulushini hisobotda ko‘rasiz.':
    'За 3 дня и за 1 день до приёма пациенту приходит напоминание в Telegram, и он подтверждает запись. Неявки отмечаются отдельно — их долю видно в отчёте.',
  'Ma’lumotlarimiz xavfsizmi?': 'Наши данные в безопасности?',
  'Har bir klinikaning ma’lumoti alohida — boshqa klinika sizning bemorlaringizni ko‘rmaydi. Fayllar yopiq omborda saqlanadi, ishdan ketgan xodimning kirishi esa o‘sha zahoti yopiladi.':
    'Данные каждой клиники хранятся отдельно — другая клиника не видит ваших пациентов. Файлы лежат в закрытом хранилище, а доступ уволенного сотрудника закрывается сразу.',

  /* --- Yakun --- */
  Aptekangizni: 'Попробуйте свою аптеку',
  Klinikangizni: 'Попробуйте свою клинику',
  '14 kun bepul sinang.': '14 дней бесплатно.',
  'Ro‘yxatdan o‘tish bir necha daqiqa. Karta ma’lumoti so‘ralmaydi.':
    'Регистрация — пара минут. Данные карты не нужны.',
  'Bepul boshlash': 'Начать бесплатно',

  /* --- Klinika: yangi bloklar --- */
  'Yangi qabul haqida shifokor telefonidan xabar oladi. Tugmani bossa — ko‘rik formasi ochiladi.':
    'О новом приёме врач узнаёт с телефона. Нажмёт кнопку — откроется форма осмотра.',
  'Avvalgi tashriflar, tashxis, rentgen suratlari va to‘lovlar — bemorning yagona profilida.':
    'Прошлые визиты, диагнозы, рентгеновские снимки и оплаты — в едином профиле пациента.',
  'Shifokor ko‘rik yozadi, registrator to‘lov oladi, siz nazorat qilasiz. Hech kim o‘z ishini o‘zi tekshirmaydi.':
    'Врач записывает осмотр, регистратор принимает оплату, вы контролируете. Никто не проверяет сам себя.',
  'Bemor kelmay qolmasin': 'Чтобы пациент не пропустил приём',
  'Eslatma o‘zi boradi.': 'Напоминание уходит само.',
  'Bemor o‘zi tasdiqlaydi.': 'Пациент сам подтверждает.',
  'Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma yuboriladi. «Qabul qildim» tugmasini bossa, registraturada qabul tasdiqlangan bo‘lib ko‘rinadi.':
    'За 3 дня и за 1 день до приёма пациенту уходит напоминание в Telegram. Нажмёт «Принято» — в регистратуре запись будет отмечена как подтверждённая.',
  'Bemor kabineti: tashriflar tarixi va qarzi — telefonida':
    'Кабинет пациента: история визитов и долг — в телефоне',
  'Tashrifdan keyin anonim izoh — shifokor reytingiga qo‘shiladi':
    'Анонимный отзыв после визита — учитывается в рейтинге врача',
  'Raqam Telegram orqali tasdiqlanadi — begona odam kira olmaydi':
    'Номер подтверждается через Telegram — посторонний не войдёт',
  'Bemor kabineti': 'Кабинет пациента',
  'Eslatma · Namuna': 'Напоминание · Пример',
  'Assalomu alaykum, Madina! 3 kundan keyin — seshanba, soat 10:00 da qabulingiz bor.':
    'Здравствуйте, Мадина! Через 3 дня — во вторник в 10:00 — у вас приём.',
  'Qabul qildim': 'Принято',
  Registratura: 'Регистратура',
  'Bugungi qabullar · Namuna': 'Приёмы сегодня · Пример',
  'Seshanba · 10:00': 'Вторник · 10:00',
  Tasdiqlangan: 'Подтверждён',
  'Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi':
    'Внесённую оплату нельзя удалить — ошибка исправляется только возвратом',
  'Qarzdorlar ro‘yxati to‘lovlardan o‘zi hisoblanadi': 'Список должников считается сам по оплатам',
  'Ko‘rikdan keyin registratorga to‘lov haqida xabar boradi':
    'После осмотра регистратор получает сообщение об оплате',
  'Kundalik qabuldan tashqari — rahbarga kerak bo‘ladigan ishlar ham bir joyda.':
    'Помимо ежедневных приёмов — всё, что нужно руководителю, тоже в одном месте.',
  'Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlar. Yotgan kunlar bo‘yicha hisob o‘zi chiqadi.':
    'Палаты, свободные койки и госпитализированные пациенты. Счёт по дням пребывания считается сам.',
  'Yuz bilan davomat': 'Учёт посещаемости по лицу',
  'Xodim ishga kelganini planshet kamerasi orqali belgilaydi. Har bir belgilash jurnalga yoziladi.':
    'Сотрудник отмечает приход через камеру планшета. Каждая отметка записывается в журнал.',
  'Izohlar va reyting': 'Отзывы и рейтинг',
  'Bemor tashrifdan keyin anonim baho qoldiradi. Har bir shifokorning reytingi ko‘rinadi.':
    'После визита пациент оставляет анонимную оценку. Виден рейтинг каждого врача.',
  'Shifokor retseptni tizimda yozadi — bemorga uchta apteka narxi bilan taklif qilinadi.':
    'Врач выписывает рецепт в системе — пациенту предлагают три аптеки с ценами.',
  'Rentgen va suratlar': 'Рентген и снимки',
  'Rentgen yoki tish surati tashrifga biriktiriladi va keyingi shifokorga ham ko‘rinadi.':
    'Рентген или снимок зуба прикрепляется к визиту и виден следующему врачу.',
  'Shifokor qo‘yadigan narx': 'Цену ставит врач',
  'Operatsiya kabi xizmatlarga oraliq narx qo‘yiladi — aniq summani shifokor ko‘rikdan keyin yozadi.':
    'Для услуг вроде операций задаётся диапазон цены — точную сумму врач указывает после осмотра.',
  'Tahlil va prognoz': 'Аналитика и прогноз',
  'Tushum, shifokorlar ishi, kelmay qolganlar ulushi va keyingi oylar prognozi.':
    'Выручка, работа врачей, доля неявок и прогноз на следующие месяцы.',
  'Excel va Google Sheets': 'Excel и Google Sheets',
  'Bemorlar va xizmatlar jadvaldan ko‘chiriladi. Hisobotlar Excel’da ochiladigan faylga yoki Google Sheets’ga.':
    'Пациенты и услуги переносятся из таблицы. Отчёты — в файл для Excel или в Google Sheets.',
}

export const EN_SALES: Record<string, string> = {
  /* --- Asl lug'atda yo'q edi --- */
  Yakunlandi: 'Completed',
  Qabulda: 'In visit',
  Kutilmoqda: 'Waiting',
  'Terapevt · 09:00': 'Therapist · 09:00',
  'Terapevt · 10:00': 'Therapist · 10:00',
  'Konsultatsiya · 09:30': 'Consultation · 09:30',
  '11-sentabr · Demo': 'September 11 · Demo',
  '11-sentabr': 'September 11',
  '4-sentabr': 'September 4',
  '28-avgust': 'August 28',
  '11-sentabr · 09:00': 'September 11 · 09:00',
  '0 so‘m': '0 UZS',
  'Yuqoridagi «Kirish» tugmasini bosing. U sizni': 'Click “Sign in” at the top. It takes you',
  'olib o‘tadi.': 'right away.',
  Du: 'Mo',
  Se: 'Tu',
  Ch: 'We',
  Pa: 'Th',
  Ju: 'Fr',
  Sh: 'Sa',
  Ya: 'Su',

  /* --- Qobiq --- */
  'Klinika va apteka uchun boshqaruv tizimi': 'Management system for clinics and pharmacies',
  'Klinikangizga tartib. Sizga xotirjamlik.': 'Order for your clinic. Peace of mind for you.',
  'Dorixonangizga tartib. Kassangizga aniqlik.': 'Order for your pharmacy. Accuracy at the till.',
  'Klinikalar uchun': 'For clinics',
  'Aptekalar uchun': 'For pharmacies',
  'Bemorlar uchun': 'For patients',
  'Onlayn retsept': 'Online prescriptions',
  Boshlash: 'Getting started',
  'Klinika va apteka uchun — bitta tizimda.': 'For clinics and pharmacies — in one system.',
  'Xususiy klinikalar va aptekalar uchun boshqaruv tizimi.':
    'Management system for private clinics and pharmacies.',
  'Yo‘nalishni tanlang': 'Choose your business',

  /* --- Tanlov sahifasi --- */
  'Xususiy klinika va aptekalar uchun': 'For private clinics and pharmacies',
  'Biznesingizga tartib.': 'Order for your business.',
  'Biznesingizni tanlang — o‘sha yo‘nalish uchun imkoniyatlar, jonli demo va ko‘p so‘raladigan savollarga javoblar ochiladi.':
    'Choose your business — you will see its features, a live demo and answers to the most common questions.',
  Tasdiqladi: 'Confirmed',
  'Xususiy klinikalar': 'Private clinics',
  'Qabullar, bemorlar, shifokorlar va kassa — qabuldan to‘lovgacha bitta jarayon.':
    'Appointments, patients, doctors and the till — one process from booking to payment.',
  'Qabul jadvali va navbat': 'Appointment schedule and queue',
  'Bemorga Telegram orqali eslatma': 'Patient reminders via Telegram',
  'Shifokorning telefonida ish joyi': 'The doctor’s workspace on their phone',
  'Kassa va qarzdorlik nazorati': 'Cash and debt control',
  'Klinikalar uchun ko‘rish': 'See it for clinics',
  'Joriy chek': 'Current receipt',
  Dorixonalar: 'Pharmacies',
  'Kassa, dori zaxirasi, muddatlar va smenalar — kirimdan kassagacha nazorat.':
    'Till, stock, expiry dates and shifts — control from delivery to checkout.',
  'Shtrix-kod bilan tezkor kassa': 'Fast checkout with barcodes',
  'Partiya va muddat nazorati': 'Batch and expiry control',
  'Smena va kassa kamomadi': 'Shifts and cash shortages',
  'Klinikalardan onlayn retsept': 'Online prescriptions from clinics',
  'Aptekalar uchun ko‘rish': 'See it for pharmacies',
  '14 kun bepul': '14 days free',
  'Karta ma’lumoti so‘ralmaydi': 'No card required',
  Jami: 'Total',
  '19 500 so‘m': '19,500 UZS',
  'Paratsetamol 500 mg': 'Paracetamol 500 mg',
  'Loratadin 10 mg': 'Loratadine 10 mg',
  'Amoksitsillin 500 mg': 'Amoxicillin 500 mg',
  'Sefazolin 1 g': 'Cefazolin 1 g',

  /* --- Apteka: hero va demo --- */
  'Dorixonalar uchun yaratilgan': 'Built for pharmacies',
  'Dorixonangizga tartib.': 'Order for your pharmacy.',
  Kassangizga: 'Accuracy',
  'aniqlik.': 'at the till.',
  'Kassa, dori zaxirasi, muddatlar va xodimlar — bir tizimda.':
    'Till, stock, expiry dates and staff — in one system.',
  'Kun oxirida kassa nega farq qilganini aniq bilasiz.':
    'At the end of the day you know exactly why the till didn’t match.',
  '14 kun bepul sinash': 'Try free for 14 days',
  Kirimdan: 'From delivery',
  'kassagacha.': 'to checkout.',
  'Bir apteka. Har kimga o‘z ish joyi.': 'One pharmacy. Everyone gets their own workspace.',
  'Apteka rahbari': 'Pharmacy manager',
  Sotuvchi: 'Cashier',
  DORIXONA: 'PHARMACY',
  Kassa: 'Till',
  Dorilar: 'Medicines',
  Zaxira: 'Stock',
  'Kelgan retseptlar': 'Incoming prescriptions',
  Smena: 'Shift',
  Analitika: 'Analytics',
  'Shtrix-kod va DataMatrix': 'Barcode and DataMatrix',
  'Partiya va muddat': 'Batches and expiry',
  'Rahbar va sotuvchi alohida': 'Manager and cashier kept apart',
  'Aptekangiz bugun': 'Your pharmacy today',
  'Tushum, foyda va kassa — umumiy ko‘rinishda.': 'Revenue, profit and the till — at a glance.',
  'Bugungi foyda': 'Today’s profit',
  'O‘rtacha ustama 24%': 'Average markup 24%',
  'Muddati yaqin': 'Expiring soon',
  partiya: 'batches',
  '90 kun ichida tugaydi': 'Expire within 90 days',
  Smenalar: 'Shifts',
  'Kassa nazorati': 'Cash control',
  'Kecha · 08:00–20:00': 'Yesterday · 08:00–20:00',
  'Kassa to‘g‘ri': 'Till matched',
  'Bugun · 20:00 gacha': 'Today · until 20:00',
  Smenada: 'On shift',
  '10-sentabr': 'September 10',
  '25 000 kam': '25,000 short',
  'Aptekangiz ma’lumotlari bir joyda': 'All your pharmacy data in one place',
  'Qutini skanerlang — dori chekka tushadi.': 'Scan the box — the medicine lands on the receipt.',
  'Bugungi cheklar': 'Receipts today',
  chek: 'receipts',
  'O‘rtacha chek 72 000 so‘m': 'Average receipt 72,000 UZS',
  'Kassadagi naqd': 'Cash in the till',
  'Smena oxirida sanaladi': 'Counted at the end of the shift',
  retsept: 'prescriptions',
  'Klinikalardan onlayn': 'Online from clinics',
  '2 dona': '2 pcs',
  '1 dona': '1 pc',
  '38 dona': '38 pcs',
  '28 500 so‘m': '28,500 UZS',
  Karta: 'Card',
  Skanerdan: 'From the scanner',
  'Shtrix-kod o‘qildi': 'Barcode scanned',
  Dori: 'Medicine',
  Partiya: 'Batch',
  'B-2407 · 2027-yil, mart': 'B-2407 · March 2027',
  Qoldiq: 'In stock',

  /* --- Apteka: savol kartalari --- */
  'Apteka egalari so‘raydi': 'Pharmacy owners ask',
  'Savolingiz —': 'Your question —',
  'tizimdagi javobi.': 'the system’s answer.',
  'Tizim o‘rnatishdan oldin eng ko‘p beriladigan savollar. Har biriga — tizim ichida qanday ishlashi.':
    'The questions asked most before switching over — and how each one works inside the system.',
  'Kassa kamomadi': 'Cash shortage',
  'Kassadan pul kam chiqsa,': 'If money is missing from the till,',
  'qanday bilaman?': 'how will I know?',
  'Sotuvchi smenani yopishda naqd pulni sanab yozadi. Summa tizimdagidan kam bo‘lsa, u ogohlantiriladi. Shunday qoldirsa — yozuv sizning ro‘yxatingizda alohida belgilanadi.':
    'When closing a shift, the cashier counts and enters the cash. If it’s less than the system expects, they get a warning. If they leave it anyway, the entry is flagged on your list.',
  'Smenani yopish': 'Closing the shift',
  'Naqd savdo (tizim)': 'Cash sales (system)',
  '2 150 000 so‘m': '2,150,000 UZS',
  'Sanalgan naqd': 'Cash counted',
  '2 125 000 so‘m': '2,125,000 UZS',
  'Tizim summasidan 25 000 so‘m kam': '25,000 UZS less than the system',
  'Rahbar ro‘yxatida alohida belgilanadi': 'Flagged separately for the manager',
  'Muddat nazorati': 'Expiry control',
  'Muddati o‘tgan dori': 'Can expired medicine',
  'sotilib ketmaydimi?': 'be sold by mistake?',
  'Har bir partiya muddati bilan yoziladi. Muddati o‘tgani kassada chiqmaydi, 90 kundan kam qolganlari alohida ro‘yxatda turadi.':
    'Every batch is recorded with its expiry date. Expired batches don’t show up at the till, and those with under 90 days left sit on a separate list.',
  'Zaxira · Namuna': 'Stock · Sample',
  'Partiya B-2311': 'Batch B-2311',
  'Partiya B-2402': 'Batch B-2402',
  'Partiya B-2405': 'Batch B-2405',
  '18 kun': '18 days',
  '46 kun': '46 days',
  '83 kun': '83 days',
  'Tezkor kassa': 'Fast checkout',
  'Dori qidirib,': 'While staff search for medicine,',
  'navbat yig‘ilmaydimi?': 'doesn’t a queue build up?',
  'Qutini skanerlang — dori chekka tushadi. Kirimda esa DataMatrix kodidan partiya va muddat o‘zi o‘qiladi.':
    'Scan the box — the medicine lands on the receipt. On delivery, the batch and expiry are read straight from the DataMatrix code.',
  'Kirim · skanerdan · Demo': 'Delivery · scanned · Demo',
  Muddati: 'Expiry',
  '2027-yil, mart': 'March 2027',
  Narxi: 'Price',
  '12 500 so‘m': '12,500 UZS',
  'Xodimlar va ruxsatlar': 'Staff and access',
  'Sotuvchi tannarx va': 'Can the cashier see',
  'foydani ko‘radimi?': 'cost and profit?',
  'Yo‘q. Sotuvchi kassa va smenani ko‘radi. Tannarx, foyda, kirim va kassa nazorati — faqat rahbarda.':
    'No. The cashier sees the till and their shift. Cost, profit, deliveries and cash control are for the manager only.',
  Sotadi: 'Sells',
  'Kirim huquqi': 'Delivery rights',
  'Tovar qabul qiladi': 'Receives goods',

  /* --- Apteka: jarayon --- */
  'Dorining aptekadagi yo‘li': 'A medicine’s path through the pharmacy',
  'Bosqichni tanlang: tovar kelganidan kun yakunigacha ma’lumot qanday bog‘lanishini ko‘ring.':
    'Pick a stage to see how the data connects — from delivery to the end of the day.',
  'Bosqichni tanlang': 'Choose a stage',
  'Tovar qabul qilinadi': 'Goods are received',
  'Ta’minotchi hujjati bo‘yicha': 'Against the supplier’s invoice',
  'Chek uriladi': 'A sale is rung up',
  'Sotuvchi skanerlaydi': 'The cashier scans',
  'Kassa topshiriladi': 'The till is handed over',
  'Naqd pul sanaladi': 'Cash is counted',
  'Tanlangan bosqich': 'Selected stage',
  KIRIM: 'DELIVERY',
  'Tovar zaxiraga tushdi.': 'Goods added to stock.',
  'Har bir qator partiya, muddat va tannarx bilan yoziladi. Dori katalogda bo‘lmasa, shu yerning o‘zida ochiladi.':
    'Each line is recorded with batch, expiry and cost. If a medicine isn’t in the catalogue yet, you create it right here.',
  'Ta’minotchi': 'Supplier',
  'Farm Distribyutor': 'Farm Distributor',
  Qatorlar: 'Lines',
  '24 ta': '24',
  'Jami tannarx': 'Total cost',
  '18 400 000 so‘m': '18,400,000 UZS',
  'Kirim qabul qilindi · Namuna': 'Delivery received · Sample',
  'Chek urildi.': 'Sale completed.',
  'Kassada eng yaqin muddatli partiya birinchi turadi. Sotilgan dori zaxiradan o‘zi ayiriladi.':
    'The batch closest to expiry comes first at the till. Sold medicine is deducted from stock automatically.',
  Chekda: 'On the receipt',
  '3 ta dori': '3 medicines',
  'Savdo zaxiradan ayirildi': 'Sale deducted from stock',
  SMENA: 'SHIFT',
  'Smena yopildi.': 'Shift closed.',
  'Sotuvchi naqd pulni sanab yozadi. Farq chiqsa, rahbar kimning smenasida va qancha ekanini ko‘radi.':
    'The cashier counts and enters the cash. If there’s a difference, the manager sees whose shift it was and how much.',
  'Naqd (tizim)': 'Cash (system)',
  Farq: 'Difference',
  'Kassa to‘g‘ri topshirildi': 'Till handed over with no difference',

  /* --- Apteka: onlayn retsept --- */
  'Yangi xaridorlar': 'New customers',
  'Klinika retsepti': 'A clinic’s prescription',
  'aptekangizga keladi.': 'comes to your pharmacy.',
  'ClinicOS’dagi klinikalarda shifokor retsept yozganda, bemorga uchta apteka narxi bilan taklif qilinadi. Tanlangan aptekaga retsept onlayn keladi — dorini oldindan tayyorlab qo‘yasiz.':
    'When a doctor at a ClinicOS clinic writes a prescription, the patient is offered three pharmacies with prices. The chosen pharmacy receives it online — so you can prepare the medicine in advance.',
  'Narx aptekangiz katalogidan hisoblanadi': 'The price comes from your pharmacy’s catalogue',
  'Taklif navbat bilan — har safar bir xil apteka chiqmaydi':
    'Pharmacies are offered in rotation — not the same one every time',
  'Bemor retsept kodi bilan keladi': 'The patient arrives with a prescription code',
  'Kelgan retsept': 'Incoming prescription',
  'RETSEPT KODI': 'PRESCRIPTION CODE',
  'bemor ko‘rsatadi': 'shown by the patient',
  'TAXMINIY SUMMA': 'ESTIMATED TOTAL',
  'so‘m · katalog narxida': 'UZS · at catalogue prices',
  '1 quti': '1 box',
  'Dori tayyorlab qo‘yildi': 'Medicine prepared',
  Tayyor: 'Ready',
  'Namunaviy retsept. Haqiqiy bemor ma’lumoti emas.': 'Sample prescription. Not real patient data.',

  /* --- Apteka: kengroq imkoniyatlar --- */
  'Rahbarga kerak': 'Everything',
  'bo‘lgan hammasi.': 'a manager needs.',
  'Kundalik savdodan tashqari — aptekani boshqarishga kerak bo‘ladigan ishlar.':
    'Beyond daily sales — everything it takes to run a pharmacy.',
  'Tushum, foyda, ustama va o‘rtacha chek. Eng ko‘p sotilgan va umuman sotilmayotgan tovar alohida.':
    'Revenue, profit, markup and average receipt. Best sellers and items that don’t sell at all, shown separately.',
  'Kirim va ta’minotchilar': 'Deliveries and suppliers',
  'Har bir kirim hujjat raqami, partiya, muddat va tannarx bilan. Qaysi ta’minotchidan nima kelgani ko‘rinadi.':
    'Every delivery with invoice number, batch, expiry and cost. You can see what came from which supplier.',
  'Smena jadvali': 'Shift schedule',
  'Kim qaysi kun va soatda kassada ekanini tizim biladi. Farq kimning smenasida chiqqani ko‘rinadi.':
    'The system knows who is on the till on which day and hour. You can see whose shift a difference came from.',
  'Excel’dan ko‘chirish': 'Import from Excel',
  'Dori katalogi va ta’minotchilar Excel jadvalidan (CSV) bir marta yuklanadi — bittalab kiritish shart emas.':
    'The medicine catalogue and suppliers are loaded once from an Excel sheet (CSV) — no typing them in one by one.',
  'Hisobotni yuklab olish': 'Report downloads',
  'Savdo, kirim, zaxira va smenalar — Excel’da ochiladigan faylga yoki Google Sheets jadvaliga.':
    'Sales, deliveries, stock and shifts — to a file that opens in Excel, or to Google Sheets.',
  'Ishdan ketgan xodim': 'Staff who leave',
  'Kirishi o‘sha zahoti yopiladi. Uning savdo va smena tarixi esa saqlanib qoladi.':
    'Their access is closed immediately. Their sales and shift history is kept.',

  /* --- Qanday boshlaymiz --- */
  'Qanday boshlaymiz?': 'How do we start?',
  'Bugun ro‘yxatdan o‘ting,': 'Sign up today,',
  'ertaga soting.': 'start selling tomorrow.',
  'ertaga ishlang.': 'start working tomorrow.',
  'Dastur o‘rnatilmaydi — kompyuter yoki planshetda brauzer orqali ishlaydi.':
    'Nothing to install — it runs in the browser on a computer or tablet.',
  'Dastur o‘rnatilmaydi — kompyuter, planshet yoki telefonda brauzer orqali ishlaydi.':
    'Nothing to install — it runs in the browser on a computer, tablet or phone.',
  'Ro‘yxatdan o‘ting': 'Sign up',
  'Telefon raqamingiz Telegram orqali tasdiqlanadi. Bir necha daqiqa.':
    'Your phone number is confirmed through Telegram. It takes a couple of minutes.',
  'Dorilarni yuklang': 'Load your medicines',
  'Katalogni Excel jadvalidan ko‘chiring yoki birinchi kirimda yozing.':
    'Import the catalogue from an Excel sheet, or enter it with your first delivery.',
  'Sotuvchilarni qo‘shing': 'Add your cashiers',
  'Har biriga login va ish vaqti. Parolni birinchi kirishda o‘zi almashtiradi.':
    'Each gets a login and working hours. They change the password on first sign-in.',
  '14 kun bepul ishlang': 'Work free for 14 days',
  'Karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz siz bilan bog‘lanadi.':
    'No card required. Our manager will get in touch during the trial.',
  'Raqamingiz Telegram orqali tasdiqlanadi. Yo‘nalishni tanlaysiz — bo‘limlar shunga moslab ochiladi.':
    'Your number is confirmed through Telegram. Pick your specialty — the sections adapt to it.',
  'Ma’lumotlarni ko‘chiring': 'Bring your data over',
  'Bemorlar va xizmatlar ro‘yxatini Excel jadvalidan (CSV) yuklang.':
    'Load your patient and service lists from an Excel sheet (CSV).',
  'Jamoani qo‘shing': 'Add your team',
  'Shifokor va registratorga o‘z logini. Shifokor Telegram’ga bir tugma bilan ulanadi.':
    'Doctors and receptionists get their own logins. Doctors connect Telegram with one tap.',
  'Umumiy klinika': 'General clinic',
  Stomatologiya: 'Dentistry',
  'Ko‘z klinikasi': 'Eye clinic',
  Laboratoriya: 'Laboratory',

  /* --- Savollar --- */
  'Apteka egalari uchrashuvda eng ko‘p so‘raydigan savollar.':
    'The questions pharmacy owners ask most in meetings.',
  'Klinika egalari uchrashuvda eng ko‘p so‘raydigan savollar.':
    'The questions clinic owners ask most in meetings.',
  'Narxi qancha? Bepul sinab ko‘rsa bo‘ladimi?': 'How much does it cost? Can we try it free?',
  'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Sinov davomida menejerimiz bog‘lanib, aptekangiz hajmiga mos tarifni taklif qiladi.':
    'The first 14 days are free, no card required. During the trial our manager will contact you and suggest a plan that fits your pharmacy’s size.',
  'Birinchi 14 kun — bepul, karta ma’lumoti so‘ralmaydi. Keyin tarif 3, 6 yoki 12 oyga olinadi. Aniq narxni menejerimiz klinikangiz hajmiga qarab aytadi.':
    'The first 14 days are free, no card required. After that, a plan is taken for 3, 6 or 12 months. Our manager will quote the exact price based on your clinic’s size.',
  'Qanday uskuna kerak?': 'What equipment do we need?',
  'Internetga ulangan kompyuter, noutbuk yoki planshet. Dastur o‘rnatilmaydi — brauzerda ishlaydi. Shtrix-kod skaneri bo‘lsa, dori qidirmasdan chekka tushadi; usiz ham ishlash mumkin.':
    'A computer, laptop or tablet with internet. Nothing to install — it runs in the browser. With a barcode scanner medicine goes on the receipt without searching; you can work without one too.',
  'Dorilarimni bittalab kiritib chiqishim kerakmi?': 'Do I have to enter my medicines one by one?',
  'Yo‘q. Dori katalogi va ta’minotchilar ro‘yxatini Excel jadvalidan (CSV fayl) yuklaysiz. Tizim avval nima qo‘shilishini ko‘rsatadi, keyin saqlaydi — bor dorilar takrorlanmaydi.':
    'No. You load the medicine catalogue and supplier list from an Excel sheet (CSV file). The system first shows what will be added, then saves it — existing medicines aren’t duplicated.',
  'Bir nechta sotuvchi ishlasa-chi?': 'What if several cashiers work here?',
  'Har bir sotuvchi o‘z logini bilan kiradi. Ish vaqtiga qarab kassa kimda ekanini tizim biladi, kassa farqi esa kimning smenasida chiqqani bilan yoziladi.':
    'Each cashier signs in with their own login. From the working hours the system knows who holds the till, and any difference is recorded against that person’s shift.',
  'Klinikalardan retsept qanday keladi?': 'How do prescriptions from clinics arrive?',
  'ClinicOS’dagi klinikada shifokor retsept yozganda bemorga uchta apteka narxi bilan taklif qilinadi. Bemor sizni tanlasa, retsept «Kelgan retseptlar» bo‘limiga tushadi: dorini tayyorlab «Tayyor», bergach «Berildi» deb belgilaysiz.':
    'When a doctor at a ClinicOS clinic writes a prescription, the patient is offered three pharmacies with prices. If they choose you, it appears under “Incoming prescriptions”: mark it “Ready” once prepared and “Dispensed” once handed over.',
  'Ma’lumotlarim xavfsizmi?': 'Is my data safe?',
  'Har bir aptekaning ma’lumoti alohida saqlanadi — boshqa apteka yoki klinika sizning dori, savdo va kassa ma’lumotingizni ko‘rmaydi. Sotuvchi esa faqat o‘z ishiga kerak bo‘lgan qismini ko‘radi.':
    'Each pharmacy’s data is stored separately — no other pharmacy or clinic can see your medicines, sales or till. And cashiers only see what their job requires.',
  'Qancha vaqtda ishga tushiramiz?': 'How quickly can we get started?',
  'Ro‘yxatdan o‘tish bir necha daqiqa. Bemorlar va xizmatlarni Excel jadvalidan yuklab, xodimlarga login bersangiz — o‘sha kuniyoq qabul yozishni boshlaysiz.':
    'Signing up takes a couple of minutes. Load patients and services from Excel, give your staff logins — and start booking appointments the same day.',
  'Bemorlar ro‘yxatini qaytadan kiritib chiqamizmi?': 'Do we have to re-enter all our patients?',
  'Yo‘q. Bemorlar va xizmatlar ro‘yxati Excel jadvalidan (CSV fayl) yuklanadi. Tizim avval nima qo‘shilishini ko‘rsatadi, bor yozuvlar esa takrorlanmaydi.':
    'No. Patient and service lists are loaded from an Excel sheet (CSV file). The system first shows what will be added, and existing records aren’t duplicated.',
  'Shifokor kompyuterdan uzoqda bo‘lsa-chi?': 'What if the doctor isn’t at a computer?',
  'Shifokor ClinicOS’ni Telegram ichida, telefonidan ochadi. Yangi qabul haqida xabar keladi, tugmani bossa ko‘rik formasi ochiladi.':
    'Doctors open ClinicOS inside Telegram on their phone. They get a message about each new appointment, and one tap opens the visit form.',
  'Registrator pulni yashirsa, bilamanmi?': 'Will I know if a receptionist hides money?',
  'To‘lovni registrator yozadi, nazoratni siz qilasiz. Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi. Kun oxirida tizimdagi naqd tushum kassadagi pul bilan solishtiriladi.':
    'The receptionist records payments; you do the checking. A recorded payment can’t be deleted — mistakes are fixed only with a refund entry. At the end of the day, cash revenue in the system is reconciled against the money in the till.',
  'Bemorlar qabulga kelmay qolsa-chi?': 'What about patients who don’t show up?',
  'Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma boradi va u qabulni tasdiqlaydi. Kelmay qolganlar alohida belgilanadi — ularning ulushini hisobotda ko‘rasiz.':
    'Patients get a Telegram reminder 3 days and 1 day before, and confirm the appointment. No-shows are marked separately — you’ll see their share in the reports.',
  'Ma’lumotlarimiz xavfsizmi?': 'Is our data safe?',
  'Har bir klinikaning ma’lumoti alohida — boshqa klinika sizning bemorlaringizni ko‘rmaydi. Fayllar yopiq omborda saqlanadi, ishdan ketgan xodimning kirishi esa o‘sha zahoti yopiladi.':
    'Each clinic’s data is kept separate — no other clinic can see your patients. Files are stored in private storage, and a departing employee’s access is closed immediately.',

  /* --- Yakun --- */
  Aptekangizni: 'Try your pharmacy',
  Klinikangizni: 'Try your clinic',
  '14 kun bepul sinang.': 'free for 14 days.',
  'Ro‘yxatdan o‘tish bir necha daqiqa. Karta ma’lumoti so‘ralmaydi.':
    'Signing up takes a couple of minutes. No card required.',
  'Bepul boshlash': 'Start for free',

  /* --- Klinika: yangi bloklar --- */
  'Yangi qabul haqida shifokor telefonidan xabar oladi. Tugmani bossa — ko‘rik formasi ochiladi.':
    'Doctors hear about new appointments on their phone. One tap opens the visit form.',
  'Avvalgi tashriflar, tashxis, rentgen suratlari va to‘lovlar — bemorning yagona profilida.':
    'Past visits, diagnoses, X-rays and payments — in a single patient profile.',
  'Shifokor ko‘rik yozadi, registrator to‘lov oladi, siz nazorat qilasiz. Hech kim o‘z ishini o‘zi tekshirmaydi.':
    'The doctor records the visit, the receptionist takes payment, you do the checking. Nobody audits their own work.',
  'Bemor kelmay qolmasin': 'Fewer missed appointments',
  'Eslatma o‘zi boradi.': 'Reminders go out on their own.',
  'Bemor o‘zi tasdiqlaydi.': 'Patients confirm themselves.',
  'Qabuldan 3 kun va 1 kun oldin bemorga Telegram orqali eslatma yuboriladi. «Qabul qildim» tugmasini bossa, registraturada qabul tasdiqlangan bo‘lib ko‘rinadi.':
    'Patients get a Telegram reminder 3 days and 1 day before their appointment. When they tap “Got it”, reception sees the appointment as confirmed.',
  'Bemor kabineti: tashriflar tarixi va qarzi — telefonida':
    'Patient account: visit history and balance — on their phone',
  'Tashrifdan keyin anonim izoh — shifokor reytingiga qo‘shiladi':
    'Anonymous feedback after each visit — counted in the doctor’s rating',
  'Raqam Telegram orqali tasdiqlanadi — begona odam kira olmaydi':
    'The number is verified through Telegram — strangers can’t get in',
  'Bemor kabineti': 'Patient account',
  'Eslatma · Namuna': 'Reminder · Sample',
  'Assalomu alaykum, Madina! 3 kundan keyin — seshanba, soat 10:00 da qabulingiz bor.':
    'Hello, Madina! You have an appointment in 3 days — Tuesday at 10:00.',
  'Qabul qildim': 'Got it',
  Registratura: 'Reception',
  'Bugungi qabullar · Namuna': 'Today’s appointments · Sample',
  'Seshanba · 10:00': 'Tuesday · 10:00',
  Tasdiqlangan: 'Confirmed',
  'Yozilgan to‘lov o‘chirilmaydi — xato faqat qaytarish yozuvi bilan tuzatiladi':
    'Recorded payments can’t be deleted — mistakes are fixed only with a refund',
  'Qarzdorlar ro‘yxati to‘lovlardan o‘zi hisoblanadi':
    'The debtor list is calculated from payments automatically',
  'Ko‘rikdan keyin registratorga to‘lov haqida xabar boradi':
    'After the visit, reception is notified to collect payment',
  'Kundalik qabuldan tashqari — rahbarga kerak bo‘ladigan ishlar ham bir joyda.':
    'Beyond daily appointments — everything a manager needs, in one place.',
  'Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlar. Yotgan kunlar bo‘yicha hisob o‘zi chiqadi.':
    'Rooms, free beds and admitted patients. Charges for days of stay are calculated automatically.',
  'Yuz bilan davomat': 'Face check-in',
  'Xodim ishga kelganini planshet kamerasi orqali belgilaydi. Har bir belgilash jurnalga yoziladi.':
    'Staff check in with the tablet camera. Every check-in is logged.',
  'Izohlar va reyting': 'Feedback and ratings',
  'Bemor tashrifdan keyin anonim baho qoldiradi. Har bir shifokorning reytingi ko‘rinadi.':
    'Patients leave an anonymous rating after the visit. Every doctor’s rating is visible.',
  'Shifokor retseptni tizimda yozadi — bemorga uchta apteka narxi bilan taklif qilinadi.':
    'The doctor writes the prescription in the system — the patient is offered three pharmacies with prices.',
  'Rentgen va suratlar': 'X-rays and images',
  'Rentgen yoki tish surati tashrifga biriktiriladi va keyingi shifokorga ham ko‘rinadi.':
    'An X-ray or tooth photo is attached to the visit and visible to the next doctor too.',
  'Shifokor qo‘yadigan narx': 'Doctor-set prices',
  'Operatsiya kabi xizmatlarga oraliq narx qo‘yiladi — aniq summani shifokor ko‘rikdan keyin yozadi.':
    'Services like surgery get a price range — the doctor enters the exact amount after the visit.',
  'Tahlil va prognoz': 'Analytics and forecast',
  'Tushum, shifokorlar ishi, kelmay qolganlar ulushi va keyingi oylar prognozi.':
    'Revenue, doctor performance, no-show rate and a forecast for the coming months.',
  'Excel va Google Sheets': 'Excel and Google Sheets',
  'Bemorlar va xizmatlar jadvaldan ko‘chiriladi. Hisobotlar Excel’da ochiladigan faylga yoki Google Sheets’ga.':
    'Patients and services are imported from a spreadsheet. Reports go to an Excel-ready file or to Google Sheets.',
}
