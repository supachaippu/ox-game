import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let grant_type, code, redirect_uri, client_id, client_secret;

    const contentType = request.headers.get('content-type') || '';

    // ตรวจสอบ Content-Type เพื่อดึงข้อมูลทั้งแบบ JSON และ Form URL-Encoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      grant_type = formData.get('grant_type') as string;
      code = formData.get('code') as string;
      redirect_uri = formData.get('redirect_uri') as string;
      client_id = formData.get('client_id') as string;
      client_secret = formData.get('client_secret') as string;
    } else {
      const body = await request.json();
      grant_type = body.grant_type;
      code = body.code;
      redirect_uri = body.redirect_uri;
      client_id = body.client_id;
      client_secret = body.client_secret;
    }

    if (grant_type !== 'authorization_code') {
      return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
    }

    if (!code || !redirect_uri || !client_id) {
      return NextResponse.json({ error: 'invalid_request', error_description: 'Missing required parameters' }, { status: 400 });
    }

    const ALLOWED_CLIENT_ID = 'ox-game-client';
    const ALLOWED_CLIENT_SECRET = 'ox-game-secret';

    if (client_id !== ALLOWED_CLIENT_ID || (client_secret && client_secret !== ALLOWED_CLIENT_SECRET)) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
    }

    // ตรวจสอบและใช้งาน Code
    const userId = db.validateAndConsumeAuthCode(code, client_id, redirect_uri);
    if (!userId) {
      return NextResponse.json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }, { status: 400 });
    }

    // สร้าง Access Token
    const accessToken = db.createAccessToken(userId, client_id);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // 1 ชั่วโมง
      scope: 'profile',
    });
  } catch (error) {
    console.error('OAuth token error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
