import { getCloudflareContext } from "@opennextjs/cloudflare";

// อินเทอร์เฟซโครงสร้างข้อมูล
export interface User {
  id: string;
  username: string;
}

export interface ScoreRecord {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  score: number;
  currentStreak: number;
  maxStreak: number;
  bonusPoints: number;
  updatedAt: string;
}

export interface AuthCode {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}

export interface AccessToken {
  token: string;
  userId: string;
  clientId: string;
  expiresAt: number;
}

function getDB() {
  const context = getCloudflareContext();
  const env = context?.env as any;
  if (!env || !env.DB) {
    throw new Error("Cloudflare D1 Database binding 'DB' is missing. Make sure wrangler.jsonc contains the correct binding and you are running under Wrangler/OpenNext context.");
  }
  return env.DB;
}

class CloudflareDB {
  // === ฟังก์ชันจัดการ User ===
  public async getUser(userId: string): Promise<User | undefined> {
    const db = getDB();
    const result = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first() as User | null;
    return result || undefined;
  }

  public async getOrCreateUser(username: string): Promise<User> {
    const db = getDB();
    const cleanUsername = username.trim();
    const userId = cleanUsername.toLowerCase();
    
    // ค้นหาผู้ใช้เดิม
    let user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first() as User | null;
    
    if (!user) {
      user = { id: userId, username: cleanUsername };
      // บันทึกผู้ใช้ใหม่
      await db.prepare("INSERT INTO users (id, username) VALUES (?, ?)").bind(userId, cleanUsername).run();
      
      // สร้างแถวบันทึกสถิติคะแนนเริ่มต้น
      const updatedAt = new Date().toISOString();
      await db.prepare(
        "INSERT INTO scores (userId, username, wins, losses, draws, score, currentStreak, maxStreak, bonusPoints, updatedAt) VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, ?)"
      ).bind(userId, cleanUsername, updatedAt).run();
    }
    return user;
  }

  // === ฟังก์ชันจัดการคะแนนสะสม ===
  public async getScore(userId: string): Promise<ScoreRecord | undefined> {
    const db = getDB();
    const result = await db.prepare("SELECT * FROM scores WHERE userId = ?").bind(userId).first() as ScoreRecord | null;
    return result || undefined;
  }

  public async getAllScores(): Promise<ScoreRecord[]> {
    const db = getDB();
    const { results } = await db.prepare("SELECT * FROM scores ORDER BY score DESC").all() as { results: ScoreRecord[] };
    return results || [];
  }

  /**
   * ปรับปรุงคะแนนผู้เล่นหลังจากจบเกมแต่ละรอบ
   * @param userId รหัสผู้เล่น
   * @param result ผลลัพธ์การเล่น 'win' | 'loss' | 'draw'
   */
  public async updateGameResult(userId: string, result: 'win' | 'loss' | 'draw'): Promise<ScoreRecord> {
    const db = getDB();
    const record = await db.prepare("SELECT * FROM scores WHERE userId = ?").bind(userId).first() as ScoreRecord | null;
    if (!record) {
      throw new Error(`Score record not found for user: ${userId}`);
    }

    if (result === 'win') {
      record.wins += 1;
      record.currentStreak += 1;
      
      // บันทึกสถิติการชนะติดต่อกันสูงสุด
      if (record.currentStreak > record.maxStreak) {
        record.maxStreak = record.currentStreak;
      }

      // บวกคะแนนปกติ +1
      record.score += 1;

      // ตรวจสอบคะแนนพิเศษ (โบนัสชนะ 3 ครั้งติดต่อกัน)
      if (record.currentStreak === 3) {
        record.bonusPoints += 1;
        record.score += 1; // ชนะ 3 ครั้งติด ได้คะแนนพิเศษเพิ่มอีก 1
        record.currentStreak = 0; // เริ่มนับรอบการชนะติดต่อกันใหม่
      }
    } else if (result === 'loss') {
      record.losses += 1;
      record.currentStreak = 0; // รีเซ็ตสถานะชนะติดต่อกัน
      
      // หักคะแนน 1 คะแนน
      record.score -= 1;
    } else {
      record.draws += 1;
    }

    const updatedAt = new Date().toISOString();
    
    await db.prepare(
      "UPDATE scores SET wins = ?, losses = ?, draws = ?, score = ?, currentStreak = ?, maxStreak = ?, bonusPoints = ?, updatedAt = ? WHERE userId = ?"
    ).bind(
      record.wins,
      record.losses,
      record.draws,
      record.score,
      record.currentStreak,
      record.maxStreak,
      record.bonusPoints,
      updatedAt,
      userId
    ).run();

    record.updatedAt = updatedAt;
    return record;
  }

  // === ฟังก์ชันจัดการ OAuth Auth Codes ===
  public async createAuthCode(userId: string, clientId: string, redirectUri: string): Promise<string> {
    const db = getDB();
    const code = 'code_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุภายใน 5 นาที

    // ล้างรหัสเก่าที่หมดอายุแล้ว
    await db.prepare("DELETE FROM authCodes WHERE expiresAt < ?").bind(Date.now()).run();

    // บันทึกรหัสใหม่
    await db.prepare(
      "INSERT INTO authCodes (code, userId, clientId, redirectUri, expiresAt) VALUES (?, ?, ?, ?, ?)"
    ).bind(code, userId, clientId, redirectUri, expiresAt).run();

    return code;
  }

  public async validateAndConsumeAuthCode(code: string, clientId: string, redirectUri: string): Promise<string | null> {
    const db = getDB();
    const auth = await db.prepare(
      "SELECT userId FROM authCodes WHERE code = ? AND clientId = ? AND redirectUri = ? AND expiresAt > ?"
    ).bind(code, clientId, redirectUri, Date.now()).first() as { userId: string } | null;

    if (!auth) return null;

    // ลบรหัสนี้ออกไปทันทีหลังจากใช้งาน (One-time use)
    await db.prepare("DELETE FROM authCodes WHERE code = ?").bind(code).run();
    return auth.userId;
  }

  // === ฟังก์ชันจัดการ OAuth Access Tokens ===
  public async createAccessToken(userId: string, clientId: string): Promise<string> {
    const db = getDB();
    const token = 'token_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 60 * 60 * 1000; // หมดอายุภายใน 1 ชั่วโมง

    // ล้างโทเคนที่หมดอายุแล้ว
    await db.prepare("DELETE FROM accessTokens WHERE expiresAt < ?").bind(Date.now()).run();

    // บันทึกโทเคนใหม่
    await db.prepare(
      "INSERT INTO accessTokens (token, userId, clientId, expiresAt) VALUES (?, ?, ?, ?)"
    ).bind(token, userId, clientId, expiresAt).run();

    return token;
  }

  public async validateAccessToken(token: string): Promise<string | null> {
    const db = getDB();
    const accessToken = await db.prepare(
      "SELECT userId FROM accessTokens WHERE token = ? AND expiresAt > ?"
    ).bind(token, Date.now()).first() as { userId: string } | null;
    
    return accessToken ? accessToken.userId : null;
  }
}

export const db = new CloudflareDB();
