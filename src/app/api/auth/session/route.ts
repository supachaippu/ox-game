import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const runtime = 'edge';

const COOKIE_NAME = 'ox_session';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    const hasGitHub = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    let userData: { sub: string; username: string };
    let tokenToStore: string;

    if (hasGitHub) {
      // 1. เรียกแลกเปลี่ยน Token จาก GitHub OAuth Server
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${baseUrl}/oauth/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || tokenData.error) {
        return NextResponse.json({ error: tokenData.error_description || 'GitHub Token exchange failed' }, { status: 400 });
      }

      const gitAccessToken = tokenData.access_token;

      // 2. เรียกดูโปรไฟล์ผู้ใช้งานจาก GitHub API
      const userinfoResponse = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${gitAccessToken}`,
          'User-Agent': 'ox-game-app',
        },
      });

      const gitUserData = await userinfoResponse.json();
      if (!userinfoResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch GitHub user profile' }, { status: 400 });
      }

      // ดึงหรือสร้าง User ในไฟล์ D1
      const user = await db.getOrCreateUser(gitUserData.login);

      // สร้าง Local Access Token สำหรับใช้งานเซสชันภายในแอป
      tokenToStore = await db.createAccessToken(user.id, 'github-oauth');
      userData = {
        sub: user.id,
        username: user.username,
      };
    } else {
      // 1. เรียกแลกเปลี่ยน Token จาก Mock OAuth Server
      const tokenResponse = await fetch(`${baseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${baseUrl}/oauth/callback`,
          client_id: 'ox-game-client',
          client_secret: 'ox-game-secret',
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        return NextResponse.json({ error: tokenData.error || 'Token exchange failed' }, { status: tokenResponse.status });
      }

      const accessToken = tokenData.access_token;

      // 2. เรียกดูโปรไฟล์ผู้ใช้งานจาก UserInfo Endpoint
      const userinfoResponse = await fetch(`${baseUrl}/api/oauth/userinfo`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const mockUserData = await userinfoResponse.json();
      if (!userinfoResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: userinfoResponse.status });
      }

      userData = {
        sub: mockUserData.sub,
        username: mockUserData.username,
      };
      tokenToStore = accessToken;
    }

    // 3. บันทึกข้อมูลเซสชันลงใน HTTP-Only Cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, JSON.stringify({
      userId: userData.sub,
      username: userData.username,
      token: tokenToStore,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 ชั่วโมง
      path: '/',
    });

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error('Session login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ตรวจสอบข้อมูลเซสชัน (GET)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);

    if (!sessionCookie) {
      return NextResponse.json({ loggedIn: false });
    }

    const sessionData = JSON.parse(sessionCookie.value);
    
    // ตรวจสอบว่า Access Token ยังคงใช้งานได้จริงในระบบ
    const userId = await db.validateAccessToken(sessionData.token);
    if (!userId) {
      // โทเค็นหมดอายุแล้ว ลบเซสชันคุกกี้ทิ้ง
      const response = NextResponse.json({ loggedIn: false });
      cookieStore.delete(COOKIE_NAME);
      return response;
    }

    const user = await db.getUser(userId);
    if (!user) {
      return NextResponse.json({ loggedIn: false });
    }

    const score = await db.getScore(userId);

    return NextResponse.json({
      loggedIn: true,
      user: {
        id: user.id,
        username: user.username,
      },
      score: score || null,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ loggedIn: false });
  }
}

// ออกจากระบบ (DELETE)
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ success: true });
}
