-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'OWNER', 'RECEPTIONIST', 'DOCTOR');

-- CreateEnum
CREATE TYPE "DoctorStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PaymentTiming" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentPaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'SCHEDULED', 'DONE', 'MISSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('DOCTOR', 'NURSE', 'RECEPTIONIST', 'MANAGER', 'ACCOUNTANT', 'LAB_TECH', 'PHARMACIST', 'CLEANER', 'SECURITY', 'DRIVER', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'FIRED');

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('SALARY', 'PERCENT', 'SALARY_PERCENT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'DAY_OFF');

-- CreateEnum
CREATE TYPE "BonusRewardType" AS ENUM ('PERCENT_OF_SALARY', 'FIXED');

-- CreateEnum
CREATE TYPE "BonusSource" AS ENUM ('MANUAL', 'SUGGESTED', 'RULE');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PLANNED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PenaltyTrigger" AS ENUM ('LATE', 'LATE_MINUTES', 'ABSENT', 'CASH_SHORTFALL', 'BACKDATED_ATTENDANCE', 'DISCIPLINE_BELOW');

-- CreateEnum
CREATE TYPE "PenaltyAmountType" AS ENUM ('FIXED', 'PERCENT_OF_SHORTFALL', 'PERCENT_OF_DAILY_SALARY');

-- CreateEnum
CREATE TYPE "PenaltyStatus" AS ENUM ('APPLIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('LUXURY', 'STANDARD', 'GENERAL');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('FREE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatKind" AS ENUM ('GROUP', 'DIRECT');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "open" TEXT NOT NULL,
    "close" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "extra_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doctor_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar_url" TEXT,
    "consultation_fee" INTEGER NOT NULL,
    "status" "DoctorStatus" NOT NULL DEFAULT 'ACTIVE',
    "workdays" INTEGER[],
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "hired_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "primary_doctor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "payment_timing" "PaymentTiming" NOT NULL DEFAULT 'POSTPAID',
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_loyalty_tiers" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "after_visits" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "payment_status" "AppointmentPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT NOT NULL DEFAULT '',
    "checked_in_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "visited_at" TIMESTAMP(3) NOT NULL,
    "complaint" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "treatment" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "recommended_date" DATE NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "appointment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "amount" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL,
    "discount_pct" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "paid_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "href" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "position_title" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "workdays" INTEGER[],
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "work_rate" INTEGER NOT NULL DEFAULT 100,
    "pay_type" "PayType" NOT NULL DEFAULT 'SALARY',
    "percent_rate" INTEGER NOT NULL DEFAULT 0,
    "salary" INTEGER NOT NULL DEFAULT 0,
    "hired_at" DATE NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "has_system_access" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    "doctor_id" TEXT,
    "avatar_url" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "check_in_at" TIMESTAMP(3),
    "check_out_at" TIMESTAMP(3),
    "arrived_at" TEXT,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "marked_by" TEXT NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_rules" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "positions" "StaffPosition"[],
    "min_performance" INTEGER NOT NULL DEFAULT 0,
    "min_rating" INTEGER NOT NULL DEFAULT 0,
    "reward_type" "BonusRewardType" NOT NULL,
    "reward_value" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonuses" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "source" "BonusSource" NOT NULL DEFAULT 'MANUAL',
    "status" "BonusStatus" NOT NULL DEFAULT 'PLANNED',
    "rule_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "PenaltyTrigger" NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "amount_type" "PenaltyAmountType" NOT NULL,
    "amount_value" INTEGER NOT NULL,
    "positions" "StaffPosition"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rule_id" TEXT NOT NULL,
    "rule_name" TEXT NOT NULL,
    "trigger" "PenaltyTrigger" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "PenaltyStatus" NOT NULL DEFAULT 'APPLIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_waivers" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "penalty_id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "category" "RoomCategory" NOT NULL,
    "daily_rate" INTEGER NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'FREE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "bed_id" TEXT NOT NULL,
    "admitted_at" TIMESTAMP(3) NOT NULL,
    "expected_discharge_at" DATE,
    "discharged_at" TIMESTAMP(3),
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PLANNED',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "daily_rate" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_closures" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "expected_cash" INTEGER NOT NULL,
    "declared_cash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "patient_id" TEXT,
    "doctor_id" TEXT,
    "appointment_id" TEXT,
    "rating" INTEGER NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "text" TEXT NOT NULL DEFAULT '',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "reveal_at" TIMESTAMP(3) NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "reply" TEXT NOT NULL DEFAULT '',
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_groups" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ChatKind" NOT NULL DEFAULT 'GROUP',
    "description" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message_reads" (
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_month" INTEGER NOT NULL,
    "limit_doctors" INTEGER NOT NULL,
    "limit_staff" INTEGER NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "plan_id" TEXT NOT NULL,
    "price_per_month" INTEGER NOT NULL,
    "trial_ends_at" DATE,
    "subscribed_at" DATE,
    "next_invoice_at" DATE,
    "suspend_reason" TEXT NOT NULL DEFAULT '',
    "owner_name" TEXT NOT NULL,
    "owner_email" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invoices" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issued_at" DATE NOT NULL,
    "due_at" DATE NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "impersonation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_clinic_id_weekday_key" ON "working_hours"("clinic_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "users_doctor_id_key" ON "users"("doctor_id");

-- CreateIndex
CREATE INDEX "users_clinic_id_role_idx" ON "users"("clinic_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_clinic_id_email_key" ON "users"("clinic_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "doctors_clinic_id_status_idx" ON "doctors"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "patients_clinic_id_status_idx" ON "patients"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "patients_clinic_id_full_name_idx" ON "patients"("clinic_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "patients_clinic_id_phone_key" ON "patients"("clinic_id", "phone");

-- CreateIndex
CREATE INDEX "services_clinic_id_status_idx" ON "services"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "service_loyalty_tiers_clinic_id_idx" ON "service_loyalty_tiers"("clinic_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_loyalty_tiers_service_id_after_visits_key" ON "service_loyalty_tiers"("service_id", "after_visits");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_starts_at_idx" ON "appointments"("clinic_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_doctor_id_starts_at_idx" ON "appointments"("clinic_id", "doctor_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_patient_id_idx" ON "appointments"("clinic_id", "patient_id");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_status_idx" ON "appointments"("clinic_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "visits_appointment_id_key" ON "visits"("appointment_id");

-- CreateIndex
CREATE INDEX "visits_clinic_id_patient_id_visited_at_idx" ON "visits"("clinic_id", "patient_id", "visited_at");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_appointment_id_key" ON "follow_ups"("appointment_id");

-- CreateIndex
CREATE INDEX "follow_ups_clinic_id_status_recommended_date_idx" ON "follow_ups"("clinic_id", "status", "recommended_date");

-- CreateIndex
CREATE INDEX "payments_clinic_id_paid_at_idx" ON "payments"("clinic_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_clinic_id_doctor_id_paid_at_idx" ON "payments"("clinic_id", "doctor_id", "paid_at");

-- CreateIndex
CREATE INDEX "payments_clinic_id_status_idx" ON "payments"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "notifications_clinic_id_user_id_read_at_idx" ON "notifications"("clinic_id", "user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_doctor_id_key" ON "staff"("doctor_id");

-- CreateIndex
CREATE INDEX "staff_clinic_id_status_idx" ON "staff"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "staff_clinic_id_position_idx" ON "staff"("clinic_id", "position");

-- CreateIndex
CREATE INDEX "attendance_clinic_id_date_idx" ON "attendance"("clinic_id", "date");

-- CreateIndex
CREATE INDEX "attendance_clinic_id_flagged_idx" ON "attendance"("clinic_id", "flagged");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_staff_id_date_key" ON "attendance"("staff_id", "date");

-- CreateIndex
CREATE INDEX "bonus_rules_clinic_id_is_active_idx" ON "bonus_rules"("clinic_id", "is_active");

-- CreateIndex
CREATE INDEX "bonuses_clinic_id_period_idx" ON "bonuses"("clinic_id", "period");

-- CreateIndex
CREATE INDEX "bonuses_clinic_id_staff_id_period_idx" ON "bonuses"("clinic_id", "staff_id", "period");

-- CreateIndex
CREATE INDEX "penalty_rules_clinic_id_is_active_idx" ON "penalty_rules"("clinic_id", "is_active");

-- CreateIndex
CREATE INDEX "penalties_clinic_id_period_idx" ON "penalties"("clinic_id", "period");

-- CreateIndex
CREATE INDEX "penalties_clinic_id_staff_id_period_idx" ON "penalties"("clinic_id", "staff_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_waivers_penalty_id_key" ON "penalty_waivers"("penalty_id");

-- CreateIndex
CREATE INDEX "penalty_waivers_clinic_id_idx" ON "penalty_waivers"("clinic_id");

-- CreateIndex
CREATE INDEX "rooms_clinic_id_status_idx" ON "rooms"("clinic_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_clinic_id_number_key" ON "rooms"("clinic_id", "number");

-- CreateIndex
CREATE INDEX "beds_clinic_id_status_idx" ON "beds"("clinic_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_room_id_label_key" ON "beds"("room_id", "label");

-- CreateIndex
CREATE INDEX "admissions_clinic_id_status_idx" ON "admissions"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "admissions_clinic_id_patient_id_idx" ON "admissions"("clinic_id", "patient_id");

-- CreateIndex
CREATE INDEX "shift_closures_clinic_id_date_idx" ON "shift_closures"("clinic_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_closures_clinic_id_user_id_date_key" ON "shift_closures"("clinic_id", "user_id", "date");

-- CreateIndex
CREATE INDEX "feedback_clinic_id_status_idx" ON "feedback"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "feedback_clinic_id_doctor_id_reveal_at_idx" ON "feedback"("clinic_id", "doctor_id", "reveal_at");

-- CreateIndex
CREATE INDEX "chat_groups_clinic_id_idx" ON "chat_groups"("clinic_id");

-- CreateIndex
CREATE INDEX "chat_group_members_user_id_idx" ON "chat_group_members"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_message_reads_user_id_idx" ON "chat_message_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_tier_key" ON "plans"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_clinic_id_key" ON "subscriptions"("clinic_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_next_invoice_at_idx" ON "subscriptions"("next_invoice_at");

-- CreateIndex
CREATE INDEX "tenant_invoices_status_due_at_idx" ON "tenant_invoices"("status", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invoices_subscription_id_period_key" ON "tenant_invoices"("subscription_id", "period");

-- CreateIndex
CREATE INDEX "impersonation_logs_clinic_id_started_at_idx" ON "impersonation_logs"("clinic_id", "started_at");

-- CreateIndex
CREATE INDEX "impersonation_logs_admin_id_started_at_idx" ON "impersonation_logs"("admin_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_members_user_id_key" ON "platform_members"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_clinic_id_created_at_idx" ON "audit_logs"("clinic_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_clinic_id_entity_type_entity_id_idx" ON "audit_logs"("clinic_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_doctor_id_fkey" FOREIGN KEY ("primary_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_loyalty_tiers" ADD CONSTRAINT "service_loyalty_tiers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_rules" ADD CONSTRAINT "bonus_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "bonus_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonuses" ADD CONSTRAINT "bonuses_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "penalty_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_waivers" ADD CONSTRAINT "penalty_waivers_penalty_id_fkey" FOREIGN KEY ("penalty_id") REFERENCES "penalties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_closures" ADD CONSTRAINT "shift_closures_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_closures" ADD CONSTRAINT "shift_closures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "chat_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_logs" ADD CONSTRAINT "impersonation_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_members" ADD CONSTRAINT "platform_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
