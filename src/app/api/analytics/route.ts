import { NextResponse } from 'next/server';
import { getAnalyticsData } from '@/lib/analytics';
import { getAuthUser } from '@/lib/auth';

interface CacheEntry {
  timestamp: number;
  data: any;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL_MS = 5000; // 5 seconds cache time

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || 'admin';
    const address = searchParams.get('address') || (await getAuthUser(req)) || '';

    const cacheKey = `${role}-${address.toLowerCase()}`;
    const now = Date.now();

    if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        cached: true,
        data: cache[cacheKey].data
      });
    }

    const data = await getAnalyticsData(role, address);
    
    // Store in cache
    cache[cacheKey] = {
      timestamp: now,
      data
    };

    return NextResponse.json({
      success: true,
      cached: false,
      data
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
