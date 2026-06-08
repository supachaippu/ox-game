import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'Missing Bearer token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer error="invalid_token"',
        },
      });
    }

    const token = authHeader.substring(7); // ดึงค่าหลัง "Bearer "
    const userId = await db.validateAccessToken(token);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'Token expired or invalid' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer error="invalid_token"',
        },
      });
    }

    const user = await db.getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    // ส่งคืนข้อมูลโปรไฟล์มาตรฐาน
    return NextResponse.json({
      sub: user.id, // Subject Identifier ตาม OIDC
      username: user.username,
      name: user.username,
    });
  } catch (error) {
    console.error('OAuth userinfo error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
