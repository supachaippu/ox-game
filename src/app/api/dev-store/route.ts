import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = process.env.NODE_ENV === 'production' ? 'edge' : 'nodejs';

let fs: any = null;
let os: any = null;
let path: any = null;

if (typeof window === 'undefined') {
  try {
    const fsName = 'fs';
    const osName = 'os';
    const pathName = 'path';
    fs = require(fsName);
    os = require(osName);
    path = require(pathName);
  } catch (e) {
    // Edge runtime doesn't have these
  }
}

function getFilePath() {
  if (fs && os && path) {
    return path.join(os.tmpdir(), 'ox-game-db-fallback.json');
  }
  return '/tmp/ox-game-db-fallback.json';
}

export async function GET() {
  try {
    if (fs && fs.existsSync(getFilePath())) {
      const data = fs.readFileSync(getFilePath(), 'utf8');
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
    if (fs) {
      fs.writeFileSync(getFilePath(), JSON.stringify(data, null, 2), 'utf8');
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'fs not available' }, { status: 500 });
  } catch (e) {
    console.error('dev-store POST error:', e);
    return NextResponse.json({ error: 'Failed to write' }, { status: 500 });
  }
}
