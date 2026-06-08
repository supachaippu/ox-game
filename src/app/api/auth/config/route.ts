import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  // ตรวจสอบว่าผู้ใช้ตั้งค่า GitHub Client ID และ Secret ใน env หรือไม่
  const hasGitHub = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  
  return NextResponse.json({
    useGitHub: hasGitHub,
    clientId: hasGitHub ? process.env.GITHUB_CLIENT_ID : 'ox-game-client',
  });
}
