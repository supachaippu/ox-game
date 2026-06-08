import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ใช้ Node.js runtime ปกติเพื่อให้เข้าถึงไฟล์ได้ (ไม่ใช้ edge runtime)
export const dynamic = 'force-dynamic';

const filePath = path.join(os.tmpdir(), 'ox-game-db-fallback.json');

export async function GET() {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return NextResponse.json(JSON.parse(data));
    }
  } catch (e) {
    console.error('dev-store GET error:', e);
  }
  return NextResponse.json({
    users: {},
    scores: {},
    authCodes: {},
    accessTokens: {}
  });
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('dev-store POST error:', e);
    return NextResponse.json({ error: 'Failed to write' }, { status: 500 });
  }
}
