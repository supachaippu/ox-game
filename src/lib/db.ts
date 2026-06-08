import fs from 'fs';
import path from 'path';

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

interface DatabaseSchema {
  users: User[];
  scores: ScoreRecord[];
  authCodes: AuthCode[];
  accessTokens: AccessToken[];
}

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const DB_DIR = IS_VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

class LocalDB {
  private cache: DatabaseSchema | null = null;

  constructor() {
    this.initDB();
  }

  // เตรียมไฟล์ข้อมูล JSON
  private initDB() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        // ดึงโครงสร้างข้อมูลเริ่มต้นจาก db.json ดั้งเดิมที่ติดไปกับตัวบิลด์
        const templatePath = path.join(process.cwd(), 'data', 'db.json');
        let initialData: DatabaseSchema = {
          users: [],
          scores: [],
          authCodes: [],
          accessTokens: [],
        };

        if (fs.existsSync(templatePath)) {
          try {
            const templateContent = fs.readFileSync(templatePath, 'utf8');
            initialData = JSON.parse(templateContent);
          } catch (e) {
            console.error('Failed to parse template db.json:', e);
          }
        }

        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
        this.cache = initialData;
      } else {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.cache = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error initializing database, using in-memory fallback:', error);
      this.cache = {
        users: [],
        scores: [],
        authCodes: [],
        accessTokens: [],
      };
    }
  }

  // อ่านข้อมูลทั้งหมด
  private read(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        this.cache = JSON.parse(data);
      }
      return this.cache || { users: [], scores: [], authCodes: [], accessTokens: [] };
    } catch (error) {
      console.error('Error reading local db, using cache/fallback:', error);
      if (this.cache) return this.cache;
      return { users: [], scores: [], authCodes: [], accessTokens: [] };
    }
  }

  // เขียนข้อมูลทั้งหมดแบบปลอดภัย
  private write(data: DatabaseSchema) {
    this.cache = data;
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (error) {
      console.error('Error writing to database file:', error);
      // fallback ในหน่วยความจำทำงานต่อได้
    }
  }

  // === ฟังก์ชันจัดการ User ===
  public getUser(userId: string): User | undefined {
    const db = this.read();
    return db.users.find(u => u.id === userId);
  }

  public getOrCreateUser(username: string): User {
    const db = this.read();
    const cleanUsername = username.trim();
    const userId = cleanUsername.toLowerCase();
    
    let user = db.users.find(u => u.id === userId);
    if (!user) {
      user = { id: userId, username: cleanUsername };
      db.users.push(user);
      
      // สร้างแถวบันทึกสถิติคะแนนเริ่มต้น
      const initialScore: ScoreRecord = {
        userId,
        username: cleanUsername,
        wins: 0,
        losses: 0,
        draws: 0,
        score: 0,
        currentStreak: 0,
        maxStreak: 0,
        bonusPoints: 0,
        updatedAt: new Date().toISOString(),
      };
      db.scores.push(initialScore);
      this.write(db);
    }
    return user;
  }

  // === ฟังก์ชันจัดการคะแนนสะสม ===
  public getScore(userId: string): ScoreRecord | undefined {
    const db = this.read();
    return db.scores.find(s => s.userId === userId);
  }

  public getAllScores(): ScoreRecord[] {
    const db = this.read();
    // เรียงคะแนนจากมากไปน้อย
    return [...db.scores].sort((a, b) => b.score - a.score);
  }

  /**
   * ปรับปรุงคะแนนผู้เล่นหลังจากจบเกมแต่ละรอบ
   * @param userId รหัสผู้เล่น
   * @param result ผลลัพธ์การเล่น 'win' | 'loss' | 'draw'
   */
  public updateGameResult(userId: string, result: 'win' | 'loss' | 'draw'): ScoreRecord {
    const db = this.read();
    const scoreIndex = db.scores.findIndex(s => s.userId === userId);
    if (scoreIndex === -1) {
      throw new Error(`Score record not found for user: ${userId}`);
    }

    const record = db.scores[scoreIndex];
    
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
      // การเสมอจะไม่รีเซ็ต Streak หรือหักคะแนนตามเงื่อนไข (เว้นแต่คุณต้องการล้าง Streak เมื่อเสมอ แต่ปกติ Oxford rule จะรีเซ็ตเฉพาะเมื่อแพ้)
    }

    record.updatedAt = new Date().toISOString();
    db.scores[scoreIndex] = record;
    this.write(db);
    
    return record;
  }

  // === ฟังก์ชันจัดการ OAuth Auth Codes ===
  public createAuthCode(userId: string, clientId: string, redirectUri: string): string {
    const db = this.read();
    const code = 'code_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุภายใน 5 นาที

    // ล้างรหัสเก่าที่อาจตกค้าง
    db.authCodes = db.authCodes.filter(c => c.expiresAt > Date.now());

    db.authCodes.push({
      code,
      userId,
      clientId,
      redirectUri,
      expiresAt,
    });
    this.write(db);
    return code;
  }

  public validateAndConsumeAuthCode(code: string, clientId: string, redirectUri: string): string | null {
    const db = this.read();
    const index = db.authCodes.findIndex(c => 
      c.code === code && 
      c.clientId === clientId && 
      c.redirectUri === redirectUri &&
      c.expiresAt > Date.now()
    );

    if (index === -1) return null;

    const auth = db.authCodes[index];
    // ลบรหัสนี้ออกไปทันทีหลังจากใช้งาน (One-time use)
    db.authCodes.splice(index, 1);
    this.write(db);
    return auth.userId;
  }

  // === ฟังก์ชันจัดการ OAuth Access Tokens ===
  public createAccessToken(userId: string, clientId: string): string {
    const db = this.read();
    const token = 'token_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 60 * 60 * 1000; // หมดอายุภายใน 1 ชั่วโมง

    // ล้างโทเคนที่หมดอายุแล้ว
    db.accessTokens = db.accessTokens.filter(t => t.expiresAt > Date.now());

    db.accessTokens.push({
      token,
      userId,
      clientId,
      expiresAt,
    });
    this.write(db);
    return token;
  }

  public validateAccessToken(token: string): string | null {
    const db = this.read();
    const accessToken = db.accessTokens.find(t => t.token === token && t.expiresAt > Date.now());
    return accessToken ? accessToken.userId : null;
  }
}

export const db = new LocalDB();
