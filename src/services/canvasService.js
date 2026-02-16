import Redis from "ioredis";
import {
  CANVAS_KEY,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COOLDOWN_TIME,
} from "../constants/canvas.js";

// REDIS_URL ortam değişkenini kullan, yoksa localhost'a düş.
const REDIS_HOST = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
console.log(`[DEBUG] Redis Connection Host: ${REDIS_HOST} (from process.env.REDIS_URL: ${process.env.REDIS_URL})`);

const redis = new Redis(REDIS_HOST, {
  maxRetriesPerRequest: null, 
  enableReadyCheck: false, 
});

// --- YENİ EKLENEN SABİT ---
const LEADERBOARD_KEY = "leaderboard:pixels";
const USER_NAMES_KEY = "user:names";

// Redis bağlantısı koptuğunda veya hata verdiğinde uygulamanın çökmesini engeller
redis.on("error", (err) => {
  console.error("❌ Redis Bağlantı Hatası:", err);
});

// Başarılı bağlantı durumunda loglama
redis.on("connect", () => {
  console.log("✅ Redis'e başarıyla bağlandı.");
});
redis.on("reconnecting", (delay) => {
  console.log(`⚠️ Redis yeniden bağlanıyor... Son denemeden sonra ${delay}ms bekleyecek.`);
});
redis.on("end", () => {
  console.log("🔌 Redis bağlantısı kapatıldı.");
});

export const canvasService = {
  async init() {
    try {
      const exists = await redis.exists(CANVAS_KEY);
      if (!exists) {
        const emptyCanvas = Buffer.alloc(CANVAS_WIDTH * CANVAS_HEIGHT, 0);
        await redis.set(CANVAS_KEY, emptyCanvas);
        console.log("🎨 Canvas initialized in Redis.");
      }
    } catch (err) {
      console.error("❌ Canvas Init Hatası:", err);
    }
  },

  async getCanvas() {
    try {
      return await redis.getBuffer(CANVAS_KEY);
    } catch (err) {
      console.error("❌ Canvas Get Hatası:", err);
      return null;
    }
  },

  async updatePixel(x, y, colorIndex) {
    if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) return false;
    
    const offset = y * CANVAS_WIDTH + x;
    try {
      await redis.setrange(CANVAS_KEY, offset, Buffer.from([colorIndex]));
      return true;
    } catch (err) {
      console.error("❌ UpdatePixel Hatası:", err);
      return false;
    }
  },

  async setCooldown(userId) {
    if (!userId) return;
    await redis.set(`cooldown:${userId}`, "1", "EX", COOLDOWN_TIME);
  },

  async isOnCooldown(userId) {
    if (!userId) return false;
    const cooldown = await redis.get(`cooldown:${userId}`);
    return !!cooldown;
  },

  // --- BURADAN AŞAĞISI LEADERBOARD İÇİN YENİ EKLENDİ ---

  async incrementScore(userId, nickname) {
    if (!userId || !nickname) return;
    try {
      // Nickname'i HASH içinde güncelle
      await redis.hset(USER_NAMES_KEY, userId, nickname);
      // userId üzerinden skoru 1 artır
      await redis.zincrby(LEADERBOARD_KEY, 1, userId);
    } catch (err) {
      console.error("❌ Skor Artırma Hatası:", err);
    }
  },

  async getLeaderboard() {
    try {
      // En yüksek 10 skoru (ID ve skor olarak) çek
      const topData = await redis.zrevrange(LEADERBOARD_KEY, 0, 9, "WITHSCORES");
      
      const leaderboard = [];
      if (topData.length === 0) return leaderboard;

      // Top 10'daki kullanıcı ID'lerini al
      const userIds = topData.filter((_, i) => i % 2 === 0);
      
      // HASH'ten bu ID'lere ait nickname'leri tek seferde çek
      const nicknames = await redis.hmget(USER_NAMES_KEY, ...userIds);

      for (let i = 0; i < userIds.length; i++) {
        leaderboard.push({
          nickname: nicknames[i] || 'Unknown', // Eğer HASH'te isim yoksa
          score: parseInt(topData[i * 2 + 1])
        });
      }
      return leaderboard;
    } catch (err) {
      console.error("❌ Leaderboard Çekme Hatası:", err);
      return [];
    }
  }
};