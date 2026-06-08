import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, client_id, redirect_uri, state } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // ในระบบ Mock นี้เราตั้งค่า Client ID และ Redirect URL ที่กำหนดไว้ล่วงหน้า
    const ALLOWED_CLIENT_ID = 'ox-game-client';
    // อนุญาตให้ใช้ redirect ไปยังหน้า callback หลักของแอป
    if (client_id !== ALLOWED_CLIENT_ID) {
      return NextResponse.json({ error: 'Invalid client_id' }, { status: 400 });
    }

    if (!redirect_uri || !redirect_uri.startsWith('http')) {
      return NextResponse.json({ error: 'Invalid or missing redirect_uri' }, { status: 400 });
    }

    // ดึงหรือสร้าง User ในไฟล์ JSON
    const user = db.getOrCreateUser(username);

    // สร้าง Authorization Code
    const code = db.createAuthCode(user.id, client_id, redirect_uri);

    // ประกอบ URL สำหรับดีดกลับ (Callback URL)
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return NextResponse.json({ redirectUrl: redirectUrl.toString() });
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
