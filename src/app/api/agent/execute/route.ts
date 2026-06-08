/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { runAgentCoordinator } from '@/lib/agent-coordinator';

export async function POST() {
  try {
    console.log('[Agent API] Manually triggering agent coordinator loop...');
    const result = await runAgentCoordinator();
    return NextResponse.json({
      success: result.success,
      executedLogs: result.executedLogs,
      message: 'Agent coordinator verification loop completed.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
