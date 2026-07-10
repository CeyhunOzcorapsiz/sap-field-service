import { NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';

export async function GET() {
  try {
    const sap = getSAPClient();

    // SAP baglantisini test et - ServiceCalls'dan ilk 3 kaydi cek
    const serviceCalls = await sap.getList('ServiceCalls', {
      $top: 3,
      $orderby: 'ServiceCallID desc',
      $select: 'ServiceCallID,Subject,CustomerCode,CustomerName,Status,CreateDate',
    });

    return NextResponse.json({
      status: 'connected',
      message: 'SAP B1 Service Layer baglantisi basarili!',
      sapUrl: process.env.SAP_SERVICE_LAYER_URL,
      companyDb: process.env.SAP_COMPANY_DB,
      sampleData: serviceCalls,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
        sapUrl: process.env.SAP_SERVICE_LAYER_URL,
        companyDb: process.env.SAP_COMPANY_DB,
      },
      { status: 500 },
    );
  }
}
