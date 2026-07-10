import { NextRequest, NextResponse } from 'next/server';
import { getSAPClient } from '@/lib/sap/client';
import { getUserFromToken } from '@/lib/auth/jwt';
import { SAP_ENDPOINTS } from '@/lib/sap/endpoints';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const top = parseInt(searchParams.get('top') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const search = searchParams.get('search');
    const technicianCode = searchParams.get('technicianCode');

    const filters: string[] = [];
    if (status) {
      filters.push(`Status eq ${status}`);
    }
    if (search) {
      filters.push(`(contains(CustomerName,'${search}') or contains(Subject,'${search}'))`);
    }
    if (technicianCode) {
      filters.push(`TechnicianCode eq ${technicianCode}`);
    }

    const sap = getSAPClient();
    const serviceCalls = await sap.getList(SAP_ENDPOINTS.SERVICE_CALLS, {
      $top: top,
      $skip: skip,
      $orderby: 'ServiceCallID desc',
      $filter: filters.length > 0 ? filters.join(' and ') : undefined,
    });

    return NextResponse.json({ value: serviceCalls });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ message: 'Oturum gerekli' }, { status: 401 });
    }

    const body = await request.json();
    const sap = getSAPClient();
    const result = await sap.post(SAP_ENDPOINTS.SERVICE_CALLS, body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'SAP hatasi' },
      { status: 500 },
    );
  }
}
