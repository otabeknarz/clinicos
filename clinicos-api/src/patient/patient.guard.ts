import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { checkClinicAccess } from '../common/clinic-access'
import { RequestContext } from '../common/request-context'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Bemor tokenining ichi.
 *
 * `kind` ATAYLAB BOR: xodim tokeni bilan bemor tokeni bir xil
 * kalit bilan imzolanadi, ya'ni ularni FARQLASH kerak. Farqsiz
 * bemor tokeni xodim marshrutlarida ham haqiqiy ko'rinardi.
 * `jwt.strategy.ts` esa `kind: 'patient'` bo'lgan tokenni rad
 * etadi — tekshiruv IKKI TOMONLAMA.
 */
export interface PatientJwtPayload {
  sub: string
  clinicId: string
  kind: 'patient'
}

/**
 * Bemor kabinetining qorovuli.
 *
 * Passport strategiyasi emas, oddiy qorovul: bemor marshrutlari
 * global qorovullardan `@Public()` bilan chetlab o'tadi va o'z
 * tekshiruvini shu yerda o'tkazadi.
 *
 * Klinika holati HAR SO'ROVDA tekshiriladi — xodim tokenidagi
 * kabi. Klinika to'xtatilsa yoki o'chirilsa, bemorning qo'lidagi
 * token ham darhol ishlamay qoladi.
 */
@Injectable()
export class PatientGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>
    }>()

    const header = request.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new UnauthorizedException('Kirish talab qilinadi')

    let payload: PatientJwtPayload
    try {
      payload = this.jwt.verify<PatientJwtPayload>(token)
    } catch {
      throw new UnauthorizedException('Sessiya muddati tugagan')
    }

    if (payload.kind !== 'patient') {
      throw new UnauthorizedException('Sessiya yaroqsiz')
    }

    const patient = await this.prisma.acrossAllClinics().patient.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        clinicId: true,
        clinic: {
          select: {
            isActive: true,
            deletedAt: true,
            subscription: { select: { status: true } },
          },
        },
      },
    })

    if (!patient || patient.clinicId !== payload.clinicId) {
      throw new UnauthorizedException('Sessiya yaroqsiz')
    }

    const access = checkClinicAccess({
      role: 'PATIENT',
      clinicIsActive: patient.clinic.isActive,
      subscriptionStatus: patient.clinic.subscription?.status ?? null,
      clinicDeletedAt: patient.clinic.deletedAt,
    })
    if (!access.ok) throw new UnauthorizedException(access.reason)

    /*
      Kontekst xodimnikidek to'ldiriladi, lekin RUXSATLAR BO'SH.
      Shu tufayli `forCurrentClinic()` odatdagidek ishlaydi va
      agar kabinet marshrutiga bexosdan `@RequirePermission`
      qo'yilsa, u ochilmaydi — xato tomonga yopiladi.
    */
    this.ctx.set({
      userId: '',
      clinicId: patient.clinicId,
      role: 'PATIENT',
      doctorId: null,
      patientId: patient.id,
      permissions: [],
      disabledModules: [],
      impersonationId: null,
    })

    return true
  }
}
