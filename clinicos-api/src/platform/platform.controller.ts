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

import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  ChangePlanDto,
  ImpersonateDto,
  ImpersonationQueryDto,
  InvoiceQueryDto,
  MemberInputDto,
  PlanInputDto,
  PlatformDoctorQueryDto,
  PlatformPatientQueryDto,
  PlatformSearchDto,
  SuspendDto,
  TenantQueryDto,
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
  updateMember(@Param() params: IdParamDto, @Body() dto: MemberInputDto) {
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
    return this.platform.changePlan(params.id, dto.planId)
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
