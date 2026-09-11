import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'

import { Audit } from '../common/audit.interceptor'
import { RequirePermission } from '../common/guards/permissions.guard'
import { IdParamDto } from '../patients/patients.dto'
import {
  BatchQueryDto,
  CreatePurchaseDto,
  CreateSaleDto,
  DaysQueryDto,
  MedicinePatchDto,
  MedicineQueryDto,
  PharmacyShiftCloseDto,
  PharmacyStaffInputDto,
  PrescriptionQueryDto,
  SaleSearchDto,
  SupplierCreateDto,
  UpdatePharmacyStaffDto,
} from './pharmacy.dto'
import { PharmacyPurchasesService } from './pharmacy-purchases.service'
import { PharmacyStaffService } from './pharmacy-staff.service'
import { PharmacyService } from './pharmacy.service'

/**
 * APTEKA.
 *
 * Har bir marshrut o'z ruxsati bilan. Vazifalar ajratilgan, klinikadagi
 * kabi:
 *
 *   sotuvchi (`pharmacy.sell`, `pharmacy.shift`) — sotadi, kassani
 *     topshiradi; narxni ham, kassa nazoratini ham ko'rmaydi;
 *   rahbar (`pharmacy.manage`, `.analytics`, `.cashcontrol`) — katalog,
 *     xodimlar, hisobot; SOTMAYDI — o'z ishini o'zi tekshirmasin;
 *   `pharmacy.receive` — kirim; rahbarda doim, sotuvchiga alohida beriladi.
 *
 * Klinika xodimida bu ruxsatlarning birortasi ham yo'q, apteka
 * xodimida esa klinika ruxsatlari yo'q — ikki biznes bir-birining
 * ma'lumotini ko'rmaydi.
 */
@Controller('pharmacy')
export class PharmacyController {
  constructor(
    private readonly pharmacy: PharmacyService,
    private readonly staff: PharmacyStaffService,
    private readonly purchases: PharmacyPurchasesService,
  ) {}

  /* ---------------- Katalog ---------------- */

  @Get('medicines')
  @RequirePermission('pharmacy.view')
  medicines(@Query() query: MedicineQueryDto) {
    return this.pharmacy.listMedicines(query)
  }

  @Patch('medicines/:id')
  @RequirePermission('pharmacy.manage')
  @Audit('update', 'Medicine')
  updateMedicine(@Param() { id }: IdParamDto, @Body() dto: MedicinePatchDto) {
    return this.pharmacy.updateMedicine(id, dto)
  }

  @Post('medicines/:id/archive')
  @RequirePermission('pharmacy.manage')
  @Audit('archive', 'Medicine')
  archiveMedicine(@Param() { id }: IdParamDto) {
    return this.pharmacy.archiveMedicine(id)
  }

  @Get('batches')
  @RequirePermission('pharmacy.view')
  batches(@Query() query: BatchQueryDto) {
    return this.pharmacy.listBatches(query)
  }

  @Get('summary')
  @RequirePermission('pharmacy.view')
  summary() {
    return this.pharmacy.summary()
  }

  /* ---------------- Kassa ---------------- */

  @Get('sale-search')
  @RequirePermission('pharmacy.sell')
  saleSearch(@Query() query: SaleSearchDto) {
    return this.pharmacy.searchForSale(query.term)
  }

  @Post('sales')
  @RequirePermission('pharmacy.sell')
  createSale(@Body() dto: CreateSaleDto) {
    return this.pharmacy.createSale(dto)
  }

  @Get('sales')
  @RequirePermission('pharmacy.analytics')
  sales(@Query() query: DaysQueryDto) {
    return this.pharmacy.listSales(query.days ?? 7)
  }

  @Get('analytics')
  @RequirePermission('pharmacy.analytics')
  analytics(@Query() query: DaysQueryDto) {
    return this.pharmacy.analytics(query.days ?? 30)
  }

  /* ---------------- Retseptlar ---------------- */

  @Get('prescriptions')
  @RequirePermission('pharmacy.view')
  prescriptions(@Query() query: PrescriptionQueryDto) {
    return this.pharmacy.listPrescriptions(query)
  }

  @Post('prescriptions/:id/dispense')
  @RequirePermission('pharmacy.sell')
  @Audit('dispense', 'Prescription')
  dispense(@Param() { id }: IdParamDto) {
    return this.pharmacy.dispensePrescription(id)
  }

  /* ---------------- Smena ---------------- */

  @Get('on-duty')
  @RequirePermission('pharmacy.view')
  onDuty() {
    return this.staff.onDuty()
  }

  @Get('shift/today')
  @RequirePermission('pharmacy.shift')
  todayShift() {
    return this.staff.todayShift()
  }

  @Post('shift/close')
  @RequirePermission('pharmacy.shift')
  closeShift(@Body() dto: PharmacyShiftCloseDto) {
    return this.staff.closeShift(dto)
  }

  @Get('shift/handover-candidates')
  @RequirePermission('pharmacy.shift')
  handoverCandidates() {
    return this.staff.handoverCandidates()
  }

  /* Kassa nazorati — faqat rahbar: sotuvchi o'z tekshiruvini ko'rmaydi */
  @Get('shifts')
  @RequirePermission('pharmacy.cashcontrol')
  shifts(@Query() query: DaysQueryDto) {
    return this.staff.listShifts(query.days ?? 30)
  }

  /* ---------------- Xodimlar ---------------- */

  @Get('staff')
  @RequirePermission('pharmacy.manage')
  staffList(@Query() query: DaysQueryDto) {
    return this.staff.list(query.days ?? 30)
  }

  @Post('staff')
  @RequirePermission('pharmacy.manage')
  createStaff(@Body() dto: PharmacyStaffInputDto) {
    return this.staff.create(dto)
  }

  @Patch('staff/:id')
  @RequirePermission('pharmacy.manage')
  @Audit('update', 'PharmacyStaff')
  updateStaff(@Param() { id }: IdParamDto, @Body() dto: UpdatePharmacyStaffDto) {
    return this.staff.update(id, dto)
  }

  @Post('staff/:id/fire')
  @RequirePermission('pharmacy.manage')
  @Audit('fire', 'PharmacyStaff')
  fireStaff(@Param() { id }: IdParamDto) {
    return this.staff.fire(id)
  }

  @Post('staff/:id/password')
  @RequirePermission('pharmacy.manage')
  @Audit('reset_password', 'PharmacyStaff')
  resetStaffPassword(@Param() { id }: IdParamDto) {
    return this.staff.resetPassword(id)
  }

  /* ---------------- Kirim ---------------- */

  @Get('suppliers')
  @RequirePermission('pharmacy.receive')
  suppliers() {
    return this.purchases.listSuppliers()
  }

  @Post('suppliers')
  @RequirePermission('pharmacy.receive')
  createSupplier(@Body() dto: SupplierCreateDto) {
    return this.purchases.createSupplier(dto)
  }

  @Get('supplier-debts')
  @RequirePermission('pharmacy.manage')
  supplierDebts() {
    return this.purchases.supplierDebts()
  }

  @Get('purchases')
  @RequirePermission('pharmacy.receive')
  purchaseList(@Query() query: DaysQueryDto) {
    return this.purchases.listPurchases(query.days ?? 90)
  }

  @Post('purchases')
  @RequirePermission('pharmacy.receive')
  createPurchase(@Body() dto: CreatePurchaseDto) {
    return this.purchases.createPurchase(dto)
  }
}
