/**
 * MA'LUMOTLARNI tarjima qilish (interfeys matnlari emas).
 *
 * Mutaxassislik va xizmat kategoriyalari bazada bitta kalit sifatida
 * saqlanadi, ekranda esa tanlangan tilda ko'rsatiladi.
 *
 * Backend qo'shilganda: server kalitni qaytaradi (`therapist`), frontend
 * shu yerdan tarjima qiladi. Yoki backend `name_uz/name_ru/name_en`
 * ustunlarini qaytaradi — u holda bu fayl kerak bo'lmaydi.
 */

import type { Lang } from './dictionary'

/* --- Mutaxassisliklar --- */

export const SPECIALTIES = [
  'therapist',
  'cardiologist',
  'pediatrician',
  'neurologist',
  'dentist',
  'gynecologist',
  'dermatologist',
  'ultrasound',
  'surgeon',
  'endocrinologist',
] as const

export type SpecialtyKey = (typeof SPECIALTIES)[number]

const SPECIALTY_NAMES: Record<SpecialtyKey, Record<Lang, string>> = {
  therapist: { uz: 'Terapevt', ru: 'Терапевт', en: 'Therapist' },
  cardiologist: { uz: 'Kardiolog', ru: 'Кардиолог', en: 'Cardiologist' },
  pediatrician: { uz: 'Pediatr', ru: 'Педиатр', en: 'Pediatrician' },
  neurologist: { uz: 'Nevrolog', ru: 'Невролог', en: 'Neurologist' },
  dentist: { uz: 'Stomatolog', ru: 'Стоматолог', en: 'Dentist' },
  gynecologist: { uz: 'Ginekolog', ru: 'Гинеколог', en: 'Gynecologist' },
  dermatologist: { uz: 'Dermatolog', ru: 'Дерматолог', en: 'Dermatologist' },
  ultrasound: { uz: 'UZI mutaxassisi', ru: 'УЗИ-специалист', en: 'Ultrasound specialist' },
  surgeon: { uz: 'Jarroh', ru: 'Хирург', en: 'Surgeon' },
  endocrinologist: { uz: 'Endokrinolog', ru: 'Эндокринолог', en: 'Endocrinologist' },
}

export function specialtyName(key: string, lang: Lang): string {
  return SPECIALTY_NAMES[key as SpecialtyKey]?.[lang] ?? key
}

/* --- Xizmat kategoriyalari --- */

export const SERVICE_CATEGORIES = [
  'consultation',
  'diagnostics',
  'lab',
  'procedure',
  'dental',
  'surgery',
] as const

export type ServiceCategoryKey = (typeof SERVICE_CATEGORIES)[number]

const CATEGORY_NAMES: Record<ServiceCategoryKey, Record<Lang, string>> = {
  consultation: { uz: 'Konsultatsiya', ru: 'Консультация', en: 'Consultation' },
  diagnostics: { uz: 'Diagnostika', ru: 'Диагностика', en: 'Diagnostics' },
  lab: { uz: 'Laboratoriya', ru: 'Лаборатория', en: 'Laboratory' },
  procedure: { uz: 'Muolaja', ru: 'Процедура', en: 'Procedure' },
  dental: { uz: 'Stomatologiya', ru: 'Стоматология', en: 'Dental' },
  surgery: { uz: 'Jarrohlik', ru: 'Хирургия', en: 'Surgery' },
}

export function categoryName(key: string, lang: Lang): string {
  return CATEGORY_NAMES[key as ServiceCategoryKey]?.[lang] ?? key
}

/* --- Xizmat nomlari --- */

export const SERVICE_KEYS = [
  'consultation_primary',
  'consultation_repeat',
  'ultrasound_abdomen',
  'ultrasound_thyroid',
  'ecg',
  'blood_general',
  'blood_biochem',
  'urine_general',
  'dressing',
  'injection',
  'iv_drip',
  'dental_cleaning',
  'dental_filling',
  'dental_extraction',
  'physiotherapy',
  'minor_surgery',
] as const

export type ServiceKey = (typeof SERVICE_KEYS)[number]

const SERVICE_NAMES: Record<ServiceKey, Record<Lang, string>> = {
  consultation_primary: {
    uz: 'Birlamchi konsultatsiya',
    ru: 'Первичная консультация',
    en: 'Initial consultation',
  },
  consultation_repeat: {
    uz: 'Takroriy konsultatsiya',
    ru: 'Повторная консультация',
    en: 'Follow-up consultation',
  },
  ultrasound_abdomen: {
    uz: 'Qorin bo’shlig’i UZI',
    ru: 'УЗИ брюшной полости',
    en: 'Abdominal ultrasound',
  },
  ultrasound_thyroid: {
    uz: 'Qalqonsimon bez UZI',
    ru: 'УЗИ щитовидной железы',
    en: 'Thyroid ultrasound',
  },
  ecg: { uz: 'EKG', ru: 'ЭКГ', en: 'ECG' },
  blood_general: {
    uz: 'Umumiy qon tahlili',
    ru: 'Общий анализ крови',
    en: 'Complete blood count',
  },
  blood_biochem: {
    uz: 'Biokimyoviy qon tahlili',
    ru: 'Биохимия крови',
    en: 'Blood biochemistry',
  },
  urine_general: {
    uz: 'Umumiy siydik tahlili',
    ru: 'Общий анализ мочи',
    en: 'Urinalysis',
  },
  dressing: { uz: 'Bog’lam qo’yish', ru: 'Перевязка', en: 'Wound dressing' },
  injection: { uz: 'In’eksiya', ru: 'Инъекция', en: 'Injection' },
  iv_drip: { uz: 'Tomchi (kapelnitsa)', ru: 'Капельница', en: 'IV drip' },
  dental_cleaning: {
    uz: 'Tish toshini tozalash',
    ru: 'Чистка зубного камня',
    en: 'Dental cleaning',
  },
  dental_filling: { uz: 'Tish plombalash', ru: 'Пломбирование зуба', en: 'Dental filling' },
  dental_extraction: { uz: 'Tish olish', ru: 'Удаление зуба', en: 'Tooth extraction' },
  physiotherapy: { uz: 'Fizioterapiya', ru: 'Физиотерапия', en: 'Physiotherapy' },
  minor_surgery: { uz: 'Kichik jarrohlik', ru: 'Малая хирургия', en: 'Minor surgery' },
}

export function serviceName(key: string, lang: Lang): string {
  return SERVICE_NAMES[key as ServiceKey]?.[lang] ?? key
}

/* --- Shikoyat / tashxis namunalari (demo ma'lumot uchun) --- */

export const COMPLAINT_KEYS = [
  'headache',
  'fever',
  'cough',
  'back_pain',
  'stomach_pain',
  'checkup',
  'fatigue',
  'blood_pressure',
] as const

const COMPLAINT_NAMES: Record<string, Record<Lang, string>> = {
  headache: { uz: 'Bosh og’rig’i', ru: 'Головная боль', en: 'Headache' },
  fever: { uz: 'Harorat ko’tarilishi', ru: 'Повышенная температура', en: 'Fever' },
  cough: { uz: 'Yo’tal', ru: 'Кашель', en: 'Cough' },
  back_pain: { uz: 'Bel og’rig’i', ru: 'Боль в спине', en: 'Back pain' },
  stomach_pain: { uz: 'Qorin og’rig’i', ru: 'Боль в животе', en: 'Stomach pain' },
  checkup: { uz: 'Profilaktik ko’rik', ru: 'Профилактический осмотр', en: 'Routine check-up' },
  fatigue: { uz: 'Holsizlik', ru: 'Слабость', en: 'Fatigue' },
  blood_pressure: { uz: 'Qon bosimi', ru: 'Артериальное давление', en: 'Blood pressure' },
}

export function complaintName(key: string, lang: Lang): string {
  return COMPLAINT_NAMES[key]?.[lang] ?? key
}
