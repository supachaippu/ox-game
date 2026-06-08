import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const scores = db.getAllScores();
    return NextResponse.json({
      success: true,
      scores,
    });
  } catch (error) {
    console.error('Fetch scores API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
