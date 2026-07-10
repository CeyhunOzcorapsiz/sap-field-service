import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

interface CallType {
  CallTypeID: number;
  Name: string;
}
interface ProblemType {
  ProblemTypeID: number;
  Name: string;
}
interface ProblemSubType {
  ProblemSubTypeID: number;
  Name: string;
}

/**
 * GET - Servis cagrisi kurulum verileri: turler, problem turleri, alt turler.
 * Ariza/bakim alt tur listesini SAP'ye tanimlayinca otomatik gelir.
 * Kismi basari desteklenir: bir koleksiyon hata verirse digerleri yine doner.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const sap = getSAPClient();

    const [callTypes, problemTypes, problemSubTypes] = await Promise.all([
      sap
        .getList<CallType>(SAP_ENDPOINTS.SERVICE_CALL_TYPES, { $orderby: 'CallTypeID asc' })
        .catch(() => [] as CallType[]),
      sap
        .getList<ProblemType>(SAP_ENDPOINTS.PROBLEM_TYPES, { $orderby: 'ProblemTypeID asc' })
        .catch(() => [] as ProblemType[]),
      sap
        .getList<ProblemSubType>(SAP_ENDPOINTS.PROBLEM_SUB_TYPES, { $orderby: 'ProblemSubTypeID asc' })
        .catch(() => [] as ProblemSubType[]),
    ]);

    return NextResponse.json({ callTypes, problemTypes, problemSubTypes });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
