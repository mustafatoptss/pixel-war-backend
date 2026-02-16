import { canvasService } from '../services/canvasService.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/canvas.js';

export default function registerPixelHandlers(io, socket) {
  socket.on('paint_pixel', async (payload) => {
    try {
      // 1. GELEN VERİYİ LOGLA (Aynen duruyor)
      console.log(`🎨 BOYAMA TALEBİ -> Kullanıcı: ${payload?.nickname || 'Anonim'}, X: ${payload?.x}, Y: ${payload?.y}, Renk: ${payload?.colorIndex}`);

      // 2. TEMEL YAPI KONTROLÜ
      if (!payload || typeof payload !== 'object') {
        console.warn(`⚠️  Hatalı Payload: Boş veya geçersiz veri geldi.`);
        return;
      }

      const { x, y, colorIndex, nickname } = payload;
      const userId = socket.id; // Cooldown hala socket.id üzerinden (Frontend bozulmasın diye)

      // 3. VALIDASYON
      if (
        !Number.isInteger(x) || x < 0 || x >= CANVAS_WIDTH ||
        !Number.isInteger(y) || y < 0 || y >= CANVAS_HEIGHT ||
        !Number.isInteger(colorIndex)
      ) {
        console.warn(`🚫 GEÇERSİZ KOORDİNAT/RENK -> User: ${nickname}, X: ${x}, Y: ${y}`);
        return;
      }

      // 4. COOLDOWN KONTROLÜ
      const onCooldown = await canvasService.isOnCooldown(userId);
      if (onCooldown) {
        console.log(`⏱️  COOLDOWN ENGELİ -> User: ${nickname} henüz süresi dolmadı.`);
        return; 
      }

      // 5. REDİS GÜNCELLEME
      const success = await canvasService.updatePixel(x, y, colorIndex);
      
      if (success) {
        // 6. COOLDOWN BAŞLAT
        await canvasService.setCooldown(userId);

        // --- YENİ: LEADERBOARD SKORUNU ARTIR ---
        await canvasService.incrementScore(payload.userId, nickname);

        // 7. HERKESE YAYINLA
        io.emit('pixel_changed', { x, y, colorIndex, nickname });
        
        console.log(`✅ BAŞARILI -> Pixel (${x},${y}) ${nickname} tarafından boyandı. (SKOR+1)`);
      }

    } catch (err) {
      console.error("🚨 PIXEL HANDLER HATASI:", err);
    }
  });

  // --- YENİ: LEADERBOARD VERİSİNİ GÖNDER ---
  socket.on('get_leaderboard', async () => {
    try {
      const data = await canvasService.getLeaderboard();
      socket.emit('leaderboard_data', data);
    } catch (err) {
      console.error("🚨 Leaderboard Gönderim Hatası:", err);
    }
  });
}