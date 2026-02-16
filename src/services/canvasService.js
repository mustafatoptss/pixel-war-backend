import Redis from "ioredis";
import {
  CANVAS_KEY,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COOLDOWN_TIME,
} from "../constants/canvas.js";

// Production'da Redis bağlantı hatalarını yakalamak önemlidir
const redis = new Redis({
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("error", (err) => console.error("❌ Redis Hatası:", err));

export const canvasService = {
  async init() {
    try {
      const exists = await redis.exists(CANVAS_KEY);
      if (!exists) {
        // Her piksel 1 byte (0-255 arası renk indeksi)
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
    // Koordinat güvenliği: Ofset dışarı taşarsa Redis çökebilir, engelliyoruz
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
};