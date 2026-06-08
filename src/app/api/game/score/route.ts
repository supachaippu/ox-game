import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const runtime = 'edge';

const COOKIE_NAME = 'ox_session';

export async function POST(request: Request) {
  try {
    // 1. ตรวจสอบเซสชันผู้ใช้งานจาก Cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionCookie.value);
    
    // ตรวจสอบความถูกต้องของ Token
    const userId = await db.validateAccessToken(sessionData.token);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Session expired' }, { status: 401 });
    }

    // 2. ดึงผลลัพธ์ของเกมเข้ามา
    const body = await request.json();
    const { result } = body; // 'win' | 'loss' | 'draw'

    if (!['win', 'loss', 'draw'].includes(result)) {
      return NextResponse.json({ error: 'Invalid game result' }, { status: 400 });
    }

    // 3. ปรับปรุงคะแนนในฐานข้อมูลจำลอง
    const updatedRecord = await db.updateGameResult(userId, result);

    return NextResponse.json({
      success: true,
      record: updatedRecord,
    });
  } catch (error) {
    console.error('Update score API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
