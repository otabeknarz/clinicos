import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { Spinner } from '@/components/ui/Button'
import { ForbiddenState } from '@/components/ui/States'
import { I18nProvider } from '@/i18n'
import { AuthProvider } from '@/store/AuthContext'
import { useAuth } from '@/store/auth-context'
import { ThemeProvider } from '@/store/ThemeContext'
import { ToastProvider } from '@/store/ToastContext'
import type { Permission } from '@/types/models'

import { DashboardPage } from '@/pages/Dashboard'
import { LoginPage } from '@/pages/Login'
import { NotFoundPage } from '@/pages/NotFound'

/**
 * Sahifalar talab bo'yicha yuklanadi (code splitting).
 *
 * Bosh sahifa va kirish sahifasi darhol kerak, qolganlari — foydalanuvchi
 * o'sha bo'limga o'tganda. Shu tufayli birinchi ochilish tezroq bo'ladi,
 * ayniqsa sekin internetda.
 */
const AnalyticsPage = lazy(() =>
  import('@/pages/Analytics').then((m) => ({ default: m.AnalyticsPage })),
)
const AppointmentsPage = lazy(() =>
  import('@/pages/Appointments').then((m) => ({ default: m.AppointmentsPage })),
)
const AttendancePage = lazy(() =>
  import('@/pages/Attendance').then((m) => ({ default: m.AttendancePage })),
)
const CashControlPage = lazy(() =>
  import('@/pages/CashControl').then((m) => ({ default: m.CashControlPage })),
)
const CalendarPage = lazy(() =>
  import('@/pages/Calendar').then((m) => ({ default: m.CalendarPage })),
)
const ChatPage = lazy(() => import('@/pages/Chat').then((m) => ({ default: m.ChatPage })))
const FeedbackPage = lazy(() =>
  import('@/pages/Feedback').then((m) => ({ default: m.FeedbackPage })),
)
const DoctorProfilePage = lazy(() =>
  import('@/pages/DoctorProfile').then((m) => ({ default: m.DoctorProfilePage })),
)
const DoctorsPage = lazy(() =>
  import('@/pages/Doctors').then((m) => ({ default: m.DoctorsPage })),
)
const PatientProfilePage = lazy(() =>
  import('@/pages/PatientProfile').then((m) => ({ default: m.PatientProfilePage })),
)
const PatientsPage = lazy(() =>
  import('@/pages/Patients').then((m) => ({ default: m.PatientsPage })),
)
const PaymentsPage = lazy(() =>
  import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })),
)
const ReceptionPage = lazy(() =>
  import('@/pages/Reception').then((m) => ({ default: m.ReceptionPage })),
)
const DoctorHomePage = lazy(() =>
  import('@/pages/DoctorHome').then((m) => ({ default: m.DoctorHomePage })),
)
const PlatformHomePage = lazy(() =>
  import('@/pages/platform/PlatformHome').then((m) => ({ default: m.PlatformHomePage })),
)
const PlatformClinicsPage = lazy(() =>
  import('@/pages/platform/Clinics').then((m) => ({ default: m.PlatformClinicsPage })),
)
const PlatformClinicDetailPage = lazy(() =>
  import('@/pages/platform/ClinicDetail').then((m) => ({
    default: m.PlatformClinicDetailPage,
  })),
)
const PlatformAnalyticsPage = lazy(() =>
  import('@/pages/platform/Analytics').then((m) => ({
    default: m.PlatformAnalyticsPage,
  })),
)
const PlatformRegistryPage = lazy(() =>
  import('@/pages/platform/Registry').then((m) => ({ default: m.PlatformRegistryPage })),
)
const PlatformTeamPage = lazy(() =>
  import('@/pages/platform/Team').then((m) => ({ default: m.PlatformTeamPage })),
)
const PlatformDataPage = lazy(() =>
  import('@/pages/platform/Data').then((m) => ({ default: m.PlatformDataPage })),
)
const PlatformPlansPage = lazy(() =>
  import('@/pages/platform/Plans').then((m) => ({ default: m.PlatformPlansPage })),
)
const PlatformInvoicesPage = lazy(() =>
  import('@/pages/platform/Invoices').then((m) => ({ default: m.PlatformInvoicesPage })),
)
const MyProfilePage = lazy(() =>
  import('@/pages/MyProfile').then((m) => ({ default: m.MyProfilePage })),
)
const SchedulePage = lazy(() =>
  import('@/pages/Schedule').then((m) => ({ default: m.SchedulePage })),
)
const RevenuePage = lazy(() =>
  import('@/pages/Revenue').then((m) => ({ default: m.RevenuePage })),
)
const ServicesPage = lazy(() =>
  import('@/pages/Services').then((m) => ({ default: m.ServicesPage })),
)
const StaffPage = lazy(() => import('@/pages/Staff').then((m) => ({ default: m.StaffPage })))
const WardPage = lazy(() => import('@/pages/Ward').then((m) => ({ default: m.WardPage })))
const SettingsPage = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })),
)

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

/**
 * "Mening profilim" rolga qarab tanlanadi.
 *
 * Shifokorda profil qabullar, bemorlar va ko'rsatkichlar bilan
 * birga keladi — shuning uchun uning o'z shifokor profili ochiladi.
 * Boshqa xodimlarda esa uchta savol muhim: qanday ishlayapman,
 * qancha olaman, qaysi kunlari ishlayman.
 */
function MyProfile() {
  const { session } = useAuth()

  if (session?.user.role === 'doctor' && session.user.doctorId) {
    return <DoctorProfilePage self />
  }

  return <MyProfilePage />
}

/**
 * Bosh sahifa rolga qarab tanlanadi.
 *
 * Registrator uchun tahlil va grafik emas, kunlik ish paneli kerak:
 * navbat, keyingi qabullar, kassasi. Egasi esa aksincha — umumiy
 * ko'rsatkichlarni ko'radi.
 */
function HomePage() {
  const { session, impersonating } = useAuth()

  // Klinika paneliga kirilgan bo'lsa — o'sha klinikaning bosh sahifasi
  if (impersonating) return <DashboardPage />

  // Platforma egasining bosh sahifasi — klinika paneli emas
  if (session?.user.role === 'superadmin') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PlatformHomePage />
      </Suspense>
    )
  }

  // Shifokorga klinika ko'rsatkichlari emas, o'z kuni kerak
  if (session?.user.role === 'doctor') {
    return (
      <Suspense fallback={<PageLoader />}>
        <DoctorHomePage />
      </Suspense>
    )
  }

  if (session?.user.role === 'receptionist') {
    return (
      <Suspense fallback={<PageLoader />}>
        <ReceptionPage />
      </Suspense>
    )
  }

  return <DashboardPage />
}

function AppRoutes() {
  const { session, ready } = useAuth()

  // Sessiya tiklanguncha bo'sh ekran ko'rsatmaymiz — kichik yuklagich
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas text-label-tertiary">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />

      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        <Route
          path="patients"
          element={
            <Guard permission="patients.view">
              <PatientsPage />
            </Guard>
          }
        />
        <Route
          path="patients/:id"
          element={
            <Guard permission="patients.view">
              <PatientProfilePage />
            </Guard>
          }
        />

        <Route
          path="appointments"
          element={
            <Guard permission="appointments.view">
              <AppointmentsPage />
            </Guard>
          }
        />
        <Route
          path="calendar"
          element={
            <Guard permission="calendar.view">
              <CalendarPage />
            </Guard>
          }
        />

        <Route
          path="ward"
          element={
            <Guard permission="ward.view">
              <WardPage />
            </Guard>
          }
        />

        <Route
          path="doctors"
          element={
            <Guard permission="doctors.view">
              <DoctorsPage />
            </Guard>
          }
        />
        {/* --- Platforma paneli (super admin) --- */}
        <Route
          path="platform"
          element={
            <Guard permission="platform.view">
              <PlatformHomePage />
            </Guard>
          }
        />
        <Route
          path="platform/clinics"
          element={
            <Guard permission="platform.view">
              <PlatformClinicsPage />
            </Guard>
          }
        />
        <Route
          path="platform/clinics/:id"
          element={
            <Guard permission="platform.view">
              <PlatformClinicDetailPage />
            </Guard>
          }
        />
        <Route
          path="platform/analytics"
          element={
            <Guard permission="platform.view">
              <PlatformAnalyticsPage />
            </Guard>
          }
        />
        <Route
          path="platform/registry"
          element={
            <Guard permission="platform.view">
              <PlatformRegistryPage />
            </Guard>
          }
        />
        <Route
          path="platform/team"
          element={
            <Guard permission="platform.manage">
              <PlatformTeamPage />
            </Guard>
          }
        />
        <Route
          path="platform/data"
          element={
            <Guard permission="platform.view">
              <PlatformDataPage />
            </Guard>
          }
        />
        <Route
          path="platform/plans"
          element={
            <Guard permission="platform.view">
              <PlatformPlansPage />
            </Guard>
          }
        />
        <Route
          path="platform/invoices"
          element={
            <Guard permission="platform.view">
              <PlatformInvoicesPage />
            </Guard>
          }
        />

        <Route
          path="schedule"
          element={
            <Guard permission="dashboard.view">
              <SchedulePage />
            </Guard>
          }
        />
        <Route
          path="attendance"
          element={
            <Guard permission="attendance.view">
              <AttendancePage />
            </Guard>
          }
        />
        <Route
          path="staff"
          element={
            <Guard permission="staff.view">
              <StaffPage />
            </Guard>
          }
        />
        <Route
          path="feedback"
          element={
            <Guard permission="feedback.view">
              <FeedbackPage />
            </Guard>
          }
        />
        <Route
          path="chat"
          element={
            <Guard permission="chat.use">
              <ChatPage />
            </Guard>
          }
        />
        {/*
          Xodimning o'z profili. Alohida yo'l kerak, chunki xodimda
          `doctors.view` yoki `staff.view` yo'q — u hamkasblarining
          ro'yxatini ko'rmasligi kerak, lekin o'zini ko'rishi shart.
        */}
        <Route
          path="me"
          element={
            <Guard permission="dashboard.view">
              <MyProfile />
            </Guard>
          }
        />
        <Route
          path="doctors/:id"
          element={
            <Guard permission="doctors.view">
              <DoctorProfilePage />
            </Guard>
          }
        />

        <Route
          path="services"
          element={
            <Guard permission="services.view">
              <ServicesPage />
            </Guard>
          }
        />

        <Route
          path="payments"
          element={
            <Guard permission="payments.view">
              <PaymentsPage />
            </Guard>
          }
        />
        <Route
          path="cash-control"
          element={
            <Guard permission="cashcontrol.view">
              <CashControlPage />
            </Guard>
          }
        />
        <Route
          path="revenue"
          element={
            <Guard permission="revenue.view">
              <RevenuePage />
            </Guard>
          }
        />
        <Route
          path="analytics"
          element={
            <Guard permission="analytics.view">
              <AnalyticsPage />
            </Guard>
          }
        />

        <Route
          path="settings"
          element={
            <Guard permission="settings.view">
              <SettingsPage />
            </Guard>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

/**
 * Marshrut himoyasi.
 *
 * DIQQAT: bu faqat interfeys darajasidagi to'siq. Foydalanuvchi manzilni
 * qo'lda kiritsa, sahifa ochilmaydi — lekin ma'lumot baribir serverdan
 * kelmasligi kerak. Server har bir endpoint'da ruxsatni o'zi tekshiradi.
 */
function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, impersonating } = useAuth()

  /*
    Klinika paneliga kirilganda platforma egasi o'sha klinikaning
    EGASI darajasida ishlaydi — aks holda yordam berish uchun hech
    narsani ko'ra olmaydi.

    Platforma bo'limlari esa aksincha yopiladi: kirilgan holatda ular
    kontekstga to'g'ri kelmaydi va chalkashlik tug'diradi.

    DASTURCHIGA: bu FAQAT interfeys mantiqi. Serverda ruxsat kirish
    tokeniga bog'lanadi — mijoz "men kirdim" deb aytishi bilan
    hech qanday huquq ochilmasligi kerak.
  */
  if (impersonating) {
    if (permission.startsWith('platform.')) return <ForbiddenState />
    return <Suspense fallback={<PageLoader />}>{children}</Suspense>
  }

  if (!can(permission)) return <ForbiddenState />
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

/** Sahifa yuklangunча ko'rsatiladigan yengil belgi */
function PageLoader() {
  return (
    <div className="flex min-h-64 items-center justify-center text-label-tertiary">
      <Spinner className="h-6 w-6" />
    </div>
  )
}
