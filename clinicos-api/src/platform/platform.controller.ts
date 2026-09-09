import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  ArchiveDto,
  BillingTermDto,
  ChangePlanDto,
  ImpersonateDto,
  ImpersonationQueryDto,
  InvoiceQueryDto,
  MemberInputDto,
  UpdateMemberDto,
  PlanInputDto,
  PlatformDoctorQueryDto,
  PlatformPatientQueryDto,
  PlatformSearchDto,
  SuspendDto,
  TenantModulesDto,
  TenantCreateDto,
  TenantQueryDto,
  TenantUpdateDto,
} from './platform.dto'
import { PlatformService } from './platform.service'

/**
 * PLATFORMA PANELI.
 *
 * BUTUN kontroller `platform.view` bilan yopilgan va bu ruxsat
 * faqat SUPERADMIN da bor — klinika egasida ham yo'q.
 *
 * Bu yerdagi so'rovlar klinika filtridan TASHQARIDA ishlaydi,
 * shuning uchun bitta ochiq qolgan endpoint butun tizimni
 * ochib yuborardi. Ruxsat kontroller darajasida qo'yilgan:
 * yangi endpoint qo'shilganda uni belgilashni unutib bo'lmaydi.
 */
@Controller('platform')
@RequirePermission('platform.view')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  /*
    Aniq yo'llar `:id` dan OLDIN turishi kerak — aks holda
    Express "stats" ni klinika id'si deb qabul qiladi.
  */

  @Get('stats')
  stats() {
    return this.platform.stats()
  }

  @Get('data')
  data() {
    return this.platform.data()
  }

  @Get('analytics')
  analytics() {
    return this.platform.analytics()
  }

  @Get('search')
  search(@Query() query: PlatformSearchDto) {
    return this.platform.search(query)
  }

  @Get('plans')
  listPlans() {
    return this.platform.listPlans()
  }

  @Patch('plans/:id')
  @RequirePermission('platform.manage')
  updatePlan(@Param() params: IdParamDto, @Body() dto: PlanInputDto) {
    return this.platform.updatePlan(params.id, dto)
  }

  /*
    GET /platform/billing-terms

    To'lov muddatlari (3, 6, 12 oy) va ularning chegirmasi.
    Chegirma MUDDATGA biriktirilgan, tarifga emas.
  */
  @Get('billing-terms')
  listBillingTerms() {
    return this.platform.listBillingTerms()
  }

  // PATCH /platform/billing-terms/:id
  @Patch('billing-terms/:id')
  @RequirePermission('platform.manage')
  updateBillingTerm(@Param() params: IdParamDto, @Body() dto: BillingTermDto) {
    return this.platform.updateBillingTerm(params.id, dto)
  }

  @Get('invoices')
  listInvoices(@Query() query: InvoiceQueryDto) {
    return this.platform.listInvoices(query)
  }

  @Post('invoices/:id/paid')
  @RequirePermission('platform.manage')
  markPaid(@Param() params: IdParamDto) {
    return this.platform.markInvoicePaid(params.id)
  }

  @Get('impersonations')
  listImpersonations(@Query() query: ImpersonationQueryDto) {
    return this.platform.listImpersonations(query.limit, query.tenantId)
  }

  @Get('doctors')
  listDoctors(@Query() query: PlatformDoctorQueryDto) {
    return this.platform.listTenantDoctors(query)
  }

  @Get('patients')
  listPatients(@Query() query: PlatformPatientQueryDto) {
    return this.platform.listTenantPatients(query)
  }

  @Get('team')
  listTeam() {
    return this.platform.listTeam()
  }

  @Post('team')
  @RequirePermission('platform.manage')
  createMember(@Body() dto: MemberInputDto) {
    return this.platform.createMember(dto)
  }

  @Patch('team/:id')
  @RequirePermission('platform.manage')
  updateMember(@Param() params: IdParamDto, @Body() dto: UpdateMemberDto) {
    return this.platform.updateMember(params.id, dto)
  }

  @Delete('team/:id')
  @RequirePermission('platform.manage')
  deleteMember(@Param() params: IdParamDto) {
    return this.platform.deleteMember(params.id)
  }

  /* ---------------- Klinikalar ---------------- */

  @Get('tenants')
  listTenants(@Query() query: TenantQueryDto) {
    return this.platform.listTenants(query)
  }

  @Get('tenants/:id')
  getTenant(@Param() params: IdParamDto) {
    return this.platform.getTenant(params.id)
  }

  /*
    POST /platform/tenants

    Yangi klinika: klinika + egasi + obuna birga yaratiladi.
    Javobda egasining boshlang'ich paroli BIR MARTA qaytadi
    (agar admin o'zi bermagan bo'lsa).
  */
  @Post('tenants')
  @RequirePermission('platform.manage')
  createTenant(@Body() dto: TenantCreateDto) {
    return this.platform.createTenant(dto)
  }

  // PATCH /platform/tenants/:id
  @Patch('tenants/:id')
  @RequirePermission('platform.manage')
  updateTenant(@Param() params: IdParamDto, @Body() dto: TenantUpdateDto) {
    return this.platform.updateTenant(params.id, dto)
  }

  /*
    POST /platform/tenants/:id/reset-owner-password

    Klinika egasi parolini unutgan bo'lsa. Vaqtinchalik parol
    javobda BIR MARTA qaytadi, egasining sessiyalari uziladi va
    u kirgach almashtirishga majbur bo'ladi.

    Audit jurnaliga yoziladi: bu kuchli amal — tiklagan odam
    o'sha parol bilan egasi nomidan kira oladi.
  */
  @Post('tenants/:id/reset-owner-password')
  @RequirePermission('platform.manage')
  @Audit('reset_password', 'Clinic')
  resetOwnerPassword(@Param() params: IdParamDto) {
    return this.platform.resetOwnerPassword(params.id)
  }

  /*
    POST /platform/tenants/:id/archive

    O'CHIRISH EMAS, arxivlash. Ma'lumot joyida qoladi, kirish
    yopiladi. Qaytarish uchun `/activate`.

    DELETE endpointi ATAYLAB YO'Q: tibbiy yozuvni o'chirish
    odatda qonun bilan taqiqlanadi va tasodifiy bosishning
    narxi qaytarib bo'lmas.
  */
  @Post('tenants/:id/archive')
  @RequirePermission('platform.manage')
  archiveTenant(@Param() params: IdParamDto, @Body() dto: ArchiveDto) {
    return this.platform.archiveTenant(params.id, dto)
  }

  /*
    POST /platform/tenants/:id/delete

    ARXIVLASHDAN BOSHQA NARSA. Arxiv — "mijoz ketdi, qaytishi mumkin",
    klinika ro'yxatda turaveradi. O'chirish esa uni platformaning ish
    ro'yxatidan olib tashlaydi va xodimlari kira olmay qoladi.

    Ma'lumot ikkalasida ham bazada qoladi — `DELETE` yo'q.
  */
  @Post('tenants/:id/delete')
  @RequirePermission('platform.manage')
  @Audit('delete', 'Clinic')
  deleteTenant(@Param() params: IdParamDto, @Body() dto: ArchiveDto) {
    return this.platform.deleteTenant(params.id, dto)
  }

  // POST /platform/tenants/:id/undelete
  @Post('tenants/:id/undelete')
  @RequirePermission('platform.manage')
  @Audit('restore', 'Clinic')
  undeleteTenant(@Param() params: IdParamDto) {
    return this.platform.undeleteTenant(params.id)
  }

  /*
    PATCH /platform/tenants/:id/modules

    Klinikada qaysi bo'limlar ishlashini belgilaydi. Bo'lim
    o'chirilsa MA'LUMOT o'chmaydi — u shunchaki ko'rinmaydi va
    endpointlari 403 qaytaradi. Qayta yoqilsa hammasi joyida.
  */
  @Patch('tenants/:id/modules')
  @RequirePermission('platform.manage')
  @Audit('update', 'clinic_modules')
  setModules(@Param() params: IdParamDto, @Body() dto: TenantModulesDto) {
    return this.platform.setModules(params.id, dto)
  }

  @Post('tenants/:id/suspend')
  @RequirePermission('platform.manage')
  suspend(@Param() params: IdParamDto, @Body() dto: SuspendDto) {
    return this.platform.suspend(params.id, dto)
  }

  @Post('tenants/:id/activate')
  @RequirePermission('platform.manage')
  activate(@Param() params: IdParamDto) {
    return this.platform.activate(params.id)
  }

  @Post('tenants/:id/plan')
  @RequirePermission('platform.manage')
  changePlan(@Param() params: IdParamDto, @Body() dto: ChangePlanDto) {
    return this.platform.changePlan(params.id, dto.planId, dto.termMonths, dto.discountPct)
  }

  /*
    Klinika paneliga kirish.

    Yozuv AVVAL yaratiladi, keyin kirish beriladi — qayd
    etilmagan kirish bo'lmasligi uchun.
  */
  @Post('tenants/:id/impersonate')
  @RequirePermission('platform.impersonate')
  impersonate(@Param() params: IdParamDto, @Body() dto: ImpersonateDto) {
    return this.platform.startImpersonation(params.id, dto)
  }

}
