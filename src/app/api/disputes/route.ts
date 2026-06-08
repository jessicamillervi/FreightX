import { NextResponse } from 'next/server';

let globalDisputes: any[] = [];

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      disputes: globalDisputes,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      globalDisputes = body;
    } else {
      globalDisputes.push(body);
    }
    return NextResponse.json({
      success: true,
      message: 'Successfully updated in-memory disputes database',
      count: globalDisputes.length,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
