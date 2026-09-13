import { cloneElement, Fragment, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { useI18n } from '@/i18n'

/**
 * TANISHTIRUV SAHIFASINING TARJIMASI.
 *
 * NEGA ALOHIDA VA NEGA KALIT — O'ZBEKCHA MATNNING O'ZI.
 *
 * Sahifa 1200 qatorlik bitta hikoya: sarlavhalar, izohlar va demo
 * ekranidagi o'nlab kichik yozuvlar. Ularning har birini
 * `t('about.hero.title1')` ko'rinishiga o'tkazish — bu kod bilan
 * matnni bir-biridan uzib qo'yish demak: keyin sahifani o'qib,
 * qayerda nima yozilganini tushunib bo'lmasdi.
 *
 * Shuning uchun matn JSX da O'Z JOYIDA qoladi, tarjima esa
 * chegarada bo'ladi: `Lang` daraxtdagi matn tugunlarini aylanib
 * chiqib, lug'atdan mos qiymatni qo'yadi. Tarjimasi yo'q yozuv
 * o'zbekchasicha qoladi — bo'sh joy yoki kalit ko'rinib qolmaydi.
 *
 * Ismlar, sanalar va summalar lug'atda YO'Q: ular namunaviy
 * ma'lumot va uch tilda ham bir xil o'qiladi.
 */

/** Matnni solishtirishga tayyorlaydi: JSX ko'p qatorli yozuvni siqadi */
function norm(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

const RU: Record<string, string> = {
  'Asosiy mazmunga o‘tish': 'Перейти к основному содержанию',
  Imkoniyatlar: 'Возможности',
  'Qanday ishlaydi': 'Как это работает',
  'Moliya nazorati': 'Контроль финансов',
  Savollar: 'Вопросы',
  Kirish: 'Войти',
  'Ro‘yxatdan o‘tish': 'Регистрация',
  'Xususiy klinikalar uchun yaratilgan': 'Создано для частных клиник',
  'Klinikangizga tartib.': 'Порядок в вашей клинике.',
  Sizga: 'Вам —',
  'xotirjamlik.': 'спокойствие.',
  'Qabullar, bemorlar, jamoa va moliya — bir tizimda.':
    'Приёмы, пациенты, команда и финансы — в одной системе.',
  'Klinikangizdagi har bir jarayonni aniq ko‘rib boring.':
    'Видьте каждый процесс в клинике ясно и целиком.',
  'Tizimni ko‘rib chiqish': 'Посмотреть систему',
  'Qanday ishlaydi?': 'Как это работает?',
  'Klinikangizning': 'Новый рабочий',
  'yangi ish tartibi.': 'порядок клиники.',
  'Bir klinika. Har kimga o‘z ish joyi.': 'Одна клиника. Каждому — своё рабочее место.',
  'Klinika egasi': 'Владелец клиники',
  Registrator: 'Регистратор',
  Shifokor: 'Врач',
  'KLINIKA BOSHQARUVI': 'УПРАВЛЕНИЕ КЛИНИКОЙ',
  'Namunaviy ish joyi': 'Демонстрационное рабочее место',
  'Rollarni almashtirib, ish joylari bilan tanishing. Bu — demo.':
    'Переключайте роли и смотрите рабочие места. Это демо.',
  'Hisobingiz bormi? Kirish ↗': 'Уже есть аккаунт? Войти ↗',
  'O‘zbek · Русский · English': 'O‘zbek · Русский · English',
  'Telegram bilan bog‘langan': 'Связано с Telegram',
  'Rollar bo‘yicha kirish': 'Доступ по ролям',
  'Qabuldan kassagacha': 'От приёма до кассы',
  'Bitta tizim. Butun klinika.': 'Одна система. Вся клиника.',
  'Har bir ishga —': 'Для каждой задачи —',
  'o‘z yechimi.': 'своё решение.',
  'Klinika hayoti ko‘p jarayondan iborat. ClinicOS ularni bitta tushunarli ish tartibiga birlashtiradi.':
    'Жизнь клиники состоит из множества процессов. ClinicOS объединяет их в один понятный порядок работы.',
  'Qabul va jadval': 'Приёмы и расписание',
  'Navbat tartibli.': 'Очередь под контролем.',
  'Qabul o‘z vaqtida.': 'Приём вовремя.',
  'Shifokorlar jadvalini bir ekranda ko‘ring. Har bir bemorga kerakli vaqtni ajrating.':
    'Смотрите расписание врачей на одном экране. Выделяйте каждому пациенту нужное время.',
  'Bugungi qabullar': 'Приёмы сегодня',
  'Telegram integratsiyasi': 'Интеграция с Telegram',
  'Kerakli xabar.': 'Нужное сообщение.',
  'Kerakli odamga.': 'Нужному человеку.',
  'Yangi qabul haqida shifokor o‘z telefonidan xabar topadi.':
    'О новом приёме врач узнаёт со своего телефона.',
  'Yangi qabul · Namuna': 'Новый приём · Пример',
  'Terapevt ko‘rigi': 'Приём терапевта',
  'Bugun, soat 09:00': 'Сегодня, в 09:00',
  'Tashrifni ko‘rish ↗': 'Открыть визит ↗',
  'Bemor profili': 'Профиль пациента',
  'Tarix bor.': 'История есть.',
  'Tasavvur to‘liq.': 'Картина полная.',
  'Avvalgi tashriflar, ko‘rik qaydlari va to‘lovlar — bemorning yagona profilida.':
    'Прошлые визиты, записи осмотров и платежи — в едином профиле пациента.',
  'Bemor kartasi · Demo': 'Карта пациента · Демо',
  'Qayta konsultatsiya': 'Повторная консультация',
  'Birlamchi tashrif': 'Первичный визит',
  'Jamoa va ruxsatlar': 'Команда и права',
  'Har kim o‘z': 'Каждый видит',
  'ishini ko‘radi.': 'только своё.',
  'Vazifalar taqsimlangan. Har bir rolga kerakli imkoniyatlar ochilgan.':
    'Задачи распределены. Каждой роли открыто ровно то, что нужно.',
  'Nazorat qiladi': 'Контролирует',
  'To‘lov oladi': 'Принимает оплату',
  'Ko‘rik yozadi': 'Ведёт приём',
  'Bemorning bitta tashrifi': 'Один визит пациента',
  'Uch bosqich.': 'Три шага.',
  'Uzluksiz jarayon.': 'Единый процесс.',
  'Bosqichni tanlang va qabuldan to‘lovgacha ma’lumotlar qanday bog‘lanishini ko‘ring.':
    'Выберите шаг и посмотрите, как данные связываются от приёма до оплаты.',
  'Qabulga yozish': 'Запись на приём',
  'Registrator vaqtni belgilaydi': 'Регистратор назначает время',
  'Ko‘rikni qayd etish': 'Запись осмотра',
  'Shifokor tashrifni yozadi': 'Врач фиксирует визит',
  'To‘lovni qabul qilish': 'Приём оплаты',
  'Registrator tushumni qayd etadi': 'Регистратор проводит оплату',
  'Klinika egasi uchun': 'Для владельца клиники',
  'Kun tugaganda': 'В конце дня',
  'savol qolmasin.': 'без вопросов.',
  'Tizimdagi tushum va kassadagi naqd pulni solishtiring. Tafovut bo‘lsa, qayerdan kelganini tekshiring.':
    'Сверяйте выручку в системе с наличными в кассе. Есть расхождение — сразу видно, откуда оно.',
  'To‘lov qaydi va nazorat — alohida vazifalar.': 'Проведение оплаты и контроль — разные задачи.',
  'Kun yakuni': 'Итог дня',
  Demo: 'Демо',
  'TIZIM BO‘YICHA': 'ПО СИСТЕМЕ',
  'so‘m · naqd tushum': 'сум · наличная выручка',
  'SANALGAN NAQD': 'ПЕРЕСЧИТАНО В КАССЕ',
  'so‘m · kassada': 'сум · в кассе',
  'Hisoblar mos keldi': 'Суммы сошлись',
  'Namunaviy solishtiruv. Haqiqiy klinika ko‘rsatkichlari emas.':
    'Пример сверки. Не показатели реальной клиники.',
  'Kengroq imkoniyatlar': 'Больше возможностей',
  'boshqa ishlari ham.': 'и другие задачи.',
  'Kundalik qabullardan tashqari, statsionar va dorixona uchun ham alohida bo‘limlar.':
    'Кроме ежедневных приёмов — отдельные разделы для стационара и аптеки.',
  Statsionar: 'Стационар',
  'Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlarni kuzatib boring.':
    'Следите за палатами, свободными койками и госпитализированными пациентами.',
  Dorixona: 'Аптека',
  'Dori zaxirasi, xarid va savdolarni alohida ish joyida boshqaring.':
    'Ведите остатки лекарств, закупки и продажи в отдельном рабочем месте.',
  'Savol-javob': 'Вопросы и ответы',
  'Boshlashdan': 'Перед',
  'oldin.': 'началом.',
  'Mahsulot bilan tanishishda kerak bo‘ladigan asosiy javoblar.':
    'Главные ответы, которые нужны при знакомстве с продуктом.',
  'ClinicOS kimlar uchun mo‘ljallangan?': 'Для кого создан ClinicOS?',
  'O‘zbekistondagi xususiy klinikalar uchun. Klinika egasi, registrator va shifokor o‘z vazifasiga mos ish joyidan foydalanadi.':
    'Для частных клиник Узбекистана. Владелец, регистратор и врач работают каждый в своём рабочем месте.',
  'Qaysi tillarda ishlash mumkin?': 'На каких языках работает система?',
  'Mahsulot interfeysida o‘zbek, rus va ingliz tillari mavjud.':
    'Интерфейс доступен на узбекском, русском и английском.',
  'Xodimlar barcha ma’lumotlarni ko‘radimi?': 'Все ли данные видят сотрудники?',
  'Kirish huquqlari rolga bog‘liq. Shifokor ko‘rikni qayd etadi, registrator to‘lovni qabul qiladi, klinika egasi esa natijalarni nazorat qiladi.':
    'Права зависят от роли. Врач фиксирует осмотр, регистратор принимает оплату, а владелец контролирует результат.',
  'Hisobim bor. Qayerdan kiraman?': 'У меня есть аккаунт. Где войти?',
  'hisobga kirish sahifasiga': 'на страницу входа',
  'Demodagi raqamlar haqiqiy ma’lumotlarmi?': 'Цифры в демо настоящие?',
  'Yo‘q. Sahifadagi ismlar, grafik va summalar imkoniyatlarni ko‘rsatish uchun tayyorlangan namunalardir.':
    'Нет. Имена, графики и суммы на странице — подготовленные примеры, чтобы показать возможности.',
  'Klinikangizga': 'Одного взгляда',
  'bir nazar yetarli.': 'достаточно.',
  'ClinicOS ish joylari bilan tanishishni boshlang.':
    'Начните знакомство с рабочими местами ClinicOS.',
  'Demoni ko‘rish': 'Посмотреть демо',
  'Allaqachon hisobingiz bormi? Kirish ↗': 'Уже есть аккаунт? Войти ↗',
  'Qabuldan kassagacha — bitta tizimda.': 'От приёма до кассы — в одной системе.',
  'Xususiy klinikalar uchun boshqaruv tizimi.': 'Система управления для частных клиник.',
  '11-sentabr, juma': '11 сентября, пятница',
  'Klinikangiz ma’lumotlari bir joyda': 'Данные клиники в одном месте',
  'Demo · Ismlar va raqamlar namunaviy': 'Демо · Имена и цифры условные',
  Konsultatsiya: 'Консультация',
  'Namunaviy ko‘rinish': 'Демонстрационный вид',
  'Haftalik tushum': 'Выручка за неделю',
  'Hammasi hisobda': 'Всё учтено',
  'Qabul jadvali': 'Расписание приёмов',
  Bugun: 'Сегодня',
  'Navbatdagi bemorlar': 'Пациенты в очереди',
  Namuna: 'Пример',
  'Sizning qabullaringiz': 'Ваши приёмы',
  'Terapevt ko‘rigi · 09:00': 'Приём терапевта · 09:00',
  'Oldingi tashrif': 'Прошлый визит',
  'Ko‘rik turi': 'Тип приёма',
  'ClinicOS bosh sahifa': 'Главная страница ClinicOS',
  'Asosiy navigatsiya': 'Основная навигация',
  'Demo uchun rolni tanlang': 'Выберите роль для демо',
  'Mahsulot menyusi namunasi': 'Пример меню продукта',
  'Tanlangan rolning ish joyi': 'Рабочее место выбранной роли',
  'Tashrif bosqichini tanlang': 'Выберите шаг визита',
  'Tanlangan tashrif bosqichi': 'Выбранный шаг визита',
  'Pastki navigatsiya': 'Нижняя навигация',
  'Klinikangiz bugun': 'Ваша клиника сегодня',
  'Tushum, qabullar va jamoa — umumiy ko‘rinishda.':
    'Выручка, приёмы и команда — в общем обзоре.',
  'Bugungi tushum': 'Выручка за сегодня',
  'so‘m': 'сум',
  'Naqd va karta orqali': 'Наличными и картой',
  qabul: 'приёмов',
  '24 ta ko‘rik yakunlandi': '24 приёма завершено',
  bemor: 'пациентов',
  'Qabul kutilmoqda': 'Ожидают приёма',
  'Namunaviy haftalik tushum chizig‘i': 'Пример графика недельной выручки',
  'Bugungi qabul': 'Приём сегодня',
  'Bemorlar, jadval va to‘lovlar — bir ekranda.':
    'Пациенты, расписание и платежи — на одном экране.',
  'Shifokorlar jadvali bo‘yicha': 'По расписанию врачей',
  Navbatda: 'В очереди',
  'To‘lov kutilmoqda': 'Ожидает оплаты',
  'Xizmatlar bo‘yicha': 'По услугам',
  'Bugungi bemorlaringiz': 'Ваши пациенты сегодня',
  'Qabullar va ko‘rik qaydlariga e’tibor qarating.':
    'Обратите внимание на приёмы и записи осмотров.',
  'Shaxsiy jadvalingiz': 'Ваше личное расписание',
  'Ko‘rik yakunlandi': 'Приём завершён',
  'Tashriflar qayd etilgan': 'Визиты зафиксированы',
  'Qolgan qabullar': 'Оставшиеся приёмы',
  'Ko‘rik kutilmoqda': 'Ожидает приёма',
  'Bosh sahifa': 'Главная',
  Qabullar: 'Приёмы',
  Bemorlar: 'Пациенты',
  Shifokorlar: 'Врачи',
  'To‘lovlar': 'Платежи',
  Hisobotlar: 'Отчёты',
  REGISTRATURA: 'РЕГИСТРАТУРА',
  SHIFOKOR: 'ВРАЧ',
  KASSA: 'КАССА',
  'Bemor qabulga yozildi.': 'Пациент записан на приём.',
  'Shifokor, xizmat va vaqt — barchasi belgilangan.':
    'Врач, услуга и время — всё назначено.',
  'Ko‘rik qayd etildi.': 'Осмотр зафиксирован.',
  'Yangi tashrif bemor tarixiga qo‘shildi. Oldingi ma’lumotlar ham qo‘l ostida.':
    'Новый визит добавлен в историю пациента. Прошлые данные тоже под рукой.',
  'To‘lov qabul qilindi.': 'Оплата принята.',
  'Ko‘rsatilgan xizmat va tushum bog‘landi. Natija klinika hisobida ko‘rinadi.':
    'Оказанная услуга и выручка связаны. Результат виден в отчёте клиники.',
  Bemor: 'Пациент',
  'Qabul vaqti': 'Время приёма',
  'Qabul jadvalga qo‘shildi': 'Приём добавлен в расписание',
  Xizmat: 'Услуга',
  Holati: 'Статус',
  'Tashrif bemor tarixida saqlandi': 'Визит сохранён в истории пациента',
  'To‘lov usuli': 'Способ оплаты',
  Naqd: 'Наличные',
  Summa: 'Сумма',
  'To‘lov qayd etildi · Namuna': 'Оплата проведена · Пример',
  Terapevt: 'Терапевт',
  'Qayta ko‘rik': 'Повторный приём',
  'Ko‘rik': 'Приём',
  'Menyuni yopish': 'Закрыть меню',
  'Menyuni ochish': 'Открыть меню',
}

const EN: Record<string, string> = {
  'Asosiy mazmunga o‘tish': 'Skip to main content',
  Imkoniyatlar: 'Features',
  'Qanday ishlaydi': 'How it works',
  'Moliya nazorati': 'Money control',
  Savollar: 'Questions',
  Kirish: 'Sign in',
  'Ro‘yxatdan o‘tish': 'Get started',
  'Xususiy klinikalar uchun yaratilgan': 'Built for private clinics',
  'Klinikangizga tartib.': 'Order for your clinic.',
  Sizga: 'Peace of',
  'xotirjamlik.': 'mind for you.',
  'Qabullar, bemorlar, jamoa va moliya — bir tizimda.':
    'Appointments, patients, staff and money — in one system.',
  'Klinikangizdagi har bir jarayonni aniq ko‘rib boring.':
    'See every process in your clinic clearly.',
  'Tizimni ko‘rib chiqish': 'Take a look',
  'Qanday ishlaydi?': 'How does it work?',
  'Klinikangizning': 'A new way',
  'yangi ish tartibi.': 'to run your clinic.',
  'Bir klinika. Har kimga o‘z ish joyi.': 'One clinic. A workspace for everyone.',
  'Klinika egasi': 'Clinic owner',
  Registrator: 'Receptionist',
  Shifokor: 'Doctor',
  'KLINIKA BOSHQARUVI': 'CLINIC MANAGEMENT',
  'Namunaviy ish joyi': 'Sample workspace',
  'Rollarni almashtirib, ish joylari bilan tanishing. Bu — demo.':
    'Switch roles and explore the workspaces. This is a demo.',
  'Hisobingiz bormi? Kirish ↗': 'Already have an account? Sign in ↗',
  'O‘zbek · Русский · English': 'O‘zbek · Русский · English',
  'Telegram bilan bog‘langan': 'Connected to Telegram',
  'Rollar bo‘yicha kirish': 'Role-based access',
  'Qabuldan kassagacha': 'From booking to cash',
  'Bitta tizim. Butun klinika.': 'One system. The whole clinic.',
  'Har bir ishga —': 'Every job —',
  'o‘z yechimi.': 'its own answer.',
  'Klinika hayoti ko‘p jarayondan iborat. ClinicOS ularni bitta tushunarli ish tartibiga birlashtiradi.':
    'A clinic runs on many processes. ClinicOS brings them into one clear way of working.',
  'Qabul va jadval': 'Appointments and schedule',
  'Navbat tartibli.': 'The queue holds.',
  'Qabul o‘z vaqtida.': 'Appointments on time.',
  'Shifokorlar jadvalini bir ekranda ko‘ring. Har bir bemorga kerakli vaqtni ajrating.':
    'See every doctor’s schedule on one screen. Give each patient the time they need.',
  'Bugungi qabullar': 'Today’s appointments',
  'Telegram integratsiyasi': 'Telegram integration',
  'Kerakli xabar.': 'The right message.',
  'Kerakli odamga.': 'To the right person.',
  'Yangi qabul haqida shifokor o‘z telefonidan xabar topadi.':
    'The doctor learns about a new booking on their own phone.',
  'Yangi qabul · Namuna': 'New appointment · Sample',
  'Terapevt ko‘rigi': 'Therapist visit',
  'Bugun, soat 09:00': 'Today at 09:00',
  'Tashrifni ko‘rish ↗': 'Open the visit ↗',
  'Bemor profili': 'Patient profile',
  'Tarix bor.': 'The history is there.',
  'Tasavvur to‘liq.': 'The picture is whole.',
  'Avvalgi tashriflar, ko‘rik qaydlari va to‘lovlar — bemorning yagona profilida.':
    'Past visits, exam notes and payments — in one patient profile.',
  'Bemor kartasi · Demo': 'Patient card · Demo',
  'Qayta konsultatsiya': 'Follow-up consultation',
  'Birlamchi tashrif': 'First visit',
  'Jamoa va ruxsatlar': 'Team and permissions',
  'Har kim o‘z': 'Everyone sees',
  'ishini ko‘radi.': 'their own work.',
  'Vazifalar taqsimlangan. Har bir rolga kerakli imkoniyatlar ochilgan.':
    'Duties are split. Each role gets exactly what it needs.',
  'Nazorat qiladi': 'Oversees',
  'To‘lov oladi': 'Takes payment',
  'Ko‘rik yozadi': 'Records the visit',
  'Bemorning bitta tashrifi': 'A single patient visit',
  'Uch bosqich.': 'Three steps.',
  'Uzluksiz jarayon.': 'One unbroken flow.',
  'Bosqichni tanlang va qabuldan to‘lovgacha ma’lumotlar qanday bog‘lanishini ko‘ring.':
    'Pick a step and see how the data connects from booking to payment.',
  'Qabulga yozish': 'Booking',
  'Registrator vaqtni belgilaydi': 'The receptionist sets the time',
  'Ko‘rikni qayd etish': 'Recording the visit',
  'Shifokor tashrifni yozadi': 'The doctor writes the visit',
  'To‘lovni qabul qilish': 'Taking payment',
  'Registrator tushumni qayd etadi': 'The receptionist records the money',
  'Klinika egasi uchun': 'For the clinic owner',
  'Kun tugaganda': 'When the day ends',
  'savol qolmasin.': 'no questions left.',
  'Tizimdagi tushum va kassadagi naqd pulni solishtiring. Tafovut bo‘lsa, qayerdan kelganini tekshiring.':
    'Compare the revenue in the system with the cash in the drawer. If they differ, you can see where it came from.',
  'To‘lov qaydi va nazorat — alohida vazifalar.': 'Taking money and checking it are separate jobs.',
  'Kun yakuni': 'End of day',
  Demo: 'Demo',
  'TIZIM BO‘YICHA': 'IN THE SYSTEM',
  'so‘m · naqd tushum': 'UZS · cash revenue',
  'SANALGAN NAQD': 'CASH COUNTED',
  'so‘m · kassada': 'UZS · in the drawer',
  'Hisoblar mos keldi': 'The numbers match',
  'Namunaviy solishtiruv. Haqiqiy klinika ko‘rsatkichlari emas.':
    'A sample reconciliation. Not real clinic figures.',
  'Kengroq imkoniyatlar': 'More to it',
  'boshqa ishlari ham.': 'other work too.',
  'Kundalik qabullardan tashqari, statsionar va dorixona uchun ham alohida bo‘limlar.':
    'Beyond daily appointments — separate sections for the ward and the pharmacy.',
  Statsionar: 'Ward',
  'Palatalar, bo‘sh yotoqlar va yotqizilgan bemorlarni kuzatib boring.':
    'Track rooms, free beds and admitted patients.',
  Dorixona: 'Pharmacy',
  'Dori zaxirasi, xarid va savdolarni alohida ish joyida boshqaring.':
    'Run medicine stock, purchases and sales in a workspace of its own.',
  'Savol-javob': 'Questions and answers',
  'Boshlashdan': 'Before you',
  'oldin.': 'begin.',
  'Mahsulot bilan tanishishda kerak bo‘ladigan asosiy javoblar.':
    'The answers you need while getting to know the product.',
  'ClinicOS kimlar uchun mo‘ljallangan?': 'Who is ClinicOS for?',
  'O‘zbekistondagi xususiy klinikalar uchun. Klinika egasi, registrator va shifokor o‘z vazifasiga mos ish joyidan foydalanadi.':
    'For private clinics in Uzbekistan. The owner, the receptionist and the doctor each work in a place built for their job.',
  'Qaysi tillarda ishlash mumkin?': 'Which languages are supported?',
  'Mahsulot interfeysida o‘zbek, rus va ingliz tillari mavjud.':
    'The interface is available in Uzbek, Russian and English.',
  'Xodimlar barcha ma’lumotlarni ko‘radimi?': 'Does every employee see all the data?',
  'Kirish huquqlari rolga bog‘liq. Shifokor ko‘rikni qayd etadi, registrator to‘lovni qabul qiladi, klinika egasi esa natijalarni nazorat qiladi.':
    'Access follows the role. The doctor records the visit, the receptionist takes payment, and the owner reviews the results.',
  'Hisobim bor. Qayerdan kiraman?': 'I have an account. Where do I sign in?',
  'hisobga kirish sahifasiga': 'to the sign-in page',
  'Demodagi raqamlar haqiqiy ma’lumotlarmi?': 'Are the demo numbers real?',
  'Yo‘q. Sahifadagi ismlar, grafik va summalar imkoniyatlarni ko‘rsatish uchun tayyorlangan namunalardir.':
    'No. The names, charts and amounts on this page are samples prepared to show what the product does.',
  'Klinikangizga': 'One look at',
  'bir nazar yetarli.': 'your clinic is enough.',
  'ClinicOS ish joylari bilan tanishishni boshlang.':
    'Start exploring the ClinicOS workspaces.',
  'Demoni ko‘rish': 'See the demo',
  'Allaqachon hisobingiz bormi? Kirish ↗': 'Already have an account? Sign in ↗',
  'Qabuldan kassagacha — bitta tizimda.': 'From booking to cash — in one system.',
  'Xususiy klinikalar uchun boshqaruv tizimi.': 'A management system for private clinics.',
  '11-sentabr, juma': 'September 11, Friday',
  'Klinikangiz ma’lumotlari bir joyda': 'Your clinic’s data in one place',
  'Demo · Ismlar va raqamlar namunaviy': 'Demo · Names and numbers are samples',
  Konsultatsiya: 'Consultation',
  'Namunaviy ko‘rinish': 'Sample view',
  'Haftalik tushum': 'Weekly revenue',
  'Hammasi hisobda': 'All accounted for',
  'Qabul jadvali': 'Appointment schedule',
  Bugun: 'Today',
  'Navbatdagi bemorlar': 'Patients in queue',
  Namuna: 'Sample',
  'Sizning qabullaringiz': 'Your appointments',
  'Terapevt ko‘rigi · 09:00': 'Therapist visit · 09:00',
  'Oldingi tashrif': 'Previous visit',
  'Ko‘rik turi': 'Visit type',
  'ClinicOS bosh sahifa': 'ClinicOS home',
  'Asosiy navigatsiya': 'Main navigation',
  'Demo uchun rolni tanlang': 'Pick a role for the demo',
  'Mahsulot menyusi namunasi': 'Sample product menu',
  'Tanlangan rolning ish joyi': 'The selected role’s workspace',
  'Tashrif bosqichini tanlang': 'Pick a step of the visit',
  'Tanlangan tashrif bosqichi': 'The selected step of the visit',
  'Pastki navigatsiya': 'Footer navigation',
  'Klinikangiz bugun': 'Your clinic today',
  'Tushum, qabullar va jamoa — umumiy ko‘rinishda.':
    'Revenue, appointments and staff — at a glance.',
  'Bugungi tushum': 'Revenue today',
  'so‘m': 'UZS',
  'Naqd va karta orqali': 'Cash and card',
  qabul: 'appointments',
  '24 ta ko‘rik yakunlandi': '24 visits completed',
  bemor: 'patients',
  'Qabul kutilmoqda': 'Waiting to be seen',
  'Namunaviy haftalik tushum chizig‘i': 'Sample weekly revenue line',
  'Bugungi qabul': 'Today’s appointments',
  'Bemorlar, jadval va to‘lovlar — bir ekranda.':
    'Patients, schedule and payments — on one screen.',
  'Shifokorlar jadvali bo‘yicha': 'By doctor schedule',
  Navbatda: 'In queue',
  'To‘lov kutilmoqda': 'Awaiting payment',
  'Xizmatlar bo‘yicha': 'By service',
  'Bugungi bemorlaringiz': 'Your patients today',
  'Qabullar va ko‘rik qaydlariga e’tibor qarating.':
    'Keep an eye on appointments and exam notes.',
  'Shaxsiy jadvalingiz': 'Your personal schedule',
  'Ko‘rik yakunlandi': 'Visit completed',
  'Tashriflar qayd etilgan': 'Visits recorded',
  'Qolgan qabullar': 'Remaining appointments',
  'Ko‘rik kutilmoqda': 'Waiting for the visit',
  'Bosh sahifa': 'Home',
  Qabullar: 'Appointments',
  Bemorlar: 'Patients',
  Shifokorlar: 'Doctors',
  'To‘lovlar': 'Payments',
  Hisobotlar: 'Reports',
  REGISTRATURA: 'RECEPTION',
  SHIFOKOR: 'DOCTOR',
  KASSA: 'CASH DESK',
  'Bemor qabulga yozildi.': 'The patient is booked.',
  'Shifokor, xizmat va vaqt — barchasi belgilangan.':
    'Doctor, service and time — all set.',
  'Ko‘rik qayd etildi.': 'The visit is recorded.',
  'Yangi tashrif bemor tarixiga qo‘shildi. Oldingi ma’lumotlar ham qo‘l ostida.':
    'The new visit is added to the patient’s history. Earlier records stay at hand.',
  'To‘lov qabul qilindi.': 'The payment is taken.',
  'Ko‘rsatilgan xizmat va tushum bog‘landi. Natija klinika hisobida ko‘rinadi.':
    'The service and the money are linked. The result shows up in the clinic’s books.',
  Bemor: 'Patient',
  'Qabul vaqti': 'Appointment time',
  'Qabul jadvalga qo‘shildi': 'Added to the schedule',
  Xizmat: 'Service',
  Holati: 'Status',
  'Tashrif bemor tarixida saqlandi': 'Saved to the patient’s history',
  'To‘lov usuli': 'Payment method',
  Naqd: 'Cash',
  Summa: 'Amount',
  'To‘lov qayd etildi · Namuna': 'Payment recorded · Sample',
  Terapevt: 'Therapist',
  'Qayta ko‘rik': 'Follow-up',
  'Ko‘rik': 'Visit',
  'Menyuni yopish': 'Close the menu',
  'Menyuni ochish': 'Open the menu',
}

/** Tarjima qilinadigan xossalar. Ro'yxat YOPIQ: sinf nomi yoki id tegmasin. */
const TEXT_PROPS = ['label', 'title', 'text', 'note', 'unit', 'hint', 'caption', 'aria-label', 'placeholder', 'alt']

function translate(node: ReactNode, dict: Record<string, string>): ReactNode {
  if (typeof node === 'string') {
    const key = norm(node)
    const hit = dict[key]
    if (!hit) return node
    /* Atrofidagi bo'shliqlar saqlanadi — JSX ularga tayanadi */
    return node.replace(key, hit)
  }

  if (Array.isArray(node)) {
    /*
      HAR BIR BOLAGA KALIT QO'YILADI.

      Massiv React uchun ro'yxat: kalitsiz bo'lsa u ogohlantiradi
      va qayta chizishda joylarni almashtirib yuborishi mumkin.
      Asl kalit bor bo'lsa saqlanadi — tarjima ro'yxat tartibini
      o'zgartirmasligi kerak.
    */
    return node.map((child, index) => {
      const translated = translate(child, dict)
      if (isValidElement(translated)) {
        const element = translated as ReactElement
        return cloneElement(element, { key: element.key ?? `i${index}` })
      }
      return <Fragment key={`i${index}`}>{translated}</Fragment>
    })
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<Record<string, unknown>>
    const props = element.props
    const next: Record<string, unknown> = {}
    let changed = false

    for (const name of TEXT_PROPS) {
      const value = props[name]
      if (typeof value === 'string') {
        const hit = dict[norm(value)]
        if (hit) {
          next[name] = hit
          changed = true
        }
      }
    }

    const children = props.children as ReactNode
    if (children !== undefined && children !== null) {
      next.children = translate(children, dict)
      changed = true
    }

    return changed ? cloneElement(element, next) : node
  }

  return node
}

/**
 * Ichidagi barcha matnni joriy tilga o'giradi.
 *
 * Komponent ichida yozilgan matn `children` da ko'rinmaydi —
 * shuning uchun sahifaning har bir bo'lagi (`OwnerScene`, `Flow`
 * va hokazo) o'z qaytarishini ham shu bilan o'raydi.
 */
export function Lang({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  if (lang === 'uz') return <>{children}</>
  return <>{translate(children, lang === 'ru' ? RU : EN)}</>
}

/** Bitta yozuvni o'giradi — sahifa sarlavhasi kabi JSX dan tashqari joylar uchun */
export function translateText(lang: string, value: string): string {
  if (lang === 'uz') return value
  const dict = lang === 'ru' ? RU : EN
  return dict[norm(value)] ?? value
}
