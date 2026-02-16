import { canvasService } from '../services/canvasService.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/canvas.js';

export default function registerPixelHandlers(io, socket) {
  socket.on('paint_pixel', async (payload) => {
    try {
      // 1. GELEN VERİYİ LOGLA (İstediğin o meşhur log)
      // Payload içindeki nickname, x, y ve colorIndex'i terminalde görelim
      console.log(`🎨 BOYAMA TALEBİ -> Kullanıcı: ${payload?.nickname || 'Anonim'}, X: ${payload?.x}, Y: ${payload?.y}, Renk: ${payload?.colorIndex}`);

      // 2. TEMEL YAPI KONTROLÜ
      if (!payload || typeof payload !== 'object') {
        console.warn(`⚠️  Hatalı Payload: Boş veya geçersiz veri geldi.`);
        return;
      }

      const { x, y, colorIndex, nickname } = payload;
      const userId = socket.id;

      // 3. VALIDASYON (Sayı mı? Sınırlar içinde mi?)
      if (
        !Number.isInteger(x) || x < 0 || x >= CANVAS_WIDTH ||
        !Number.isInteger(y) || y < 0 || y >= CANVAS_HEIGHT ||
        !Number.isInteger(colorIndex)
      ) {
        console.warn(`🚫 GEÇERSİZ KOORDİNAT/RENK -> User: ${nickname}, X: ${x}, Y: ${y}`);
        return; // İşlemi durdur ama frontend'e hata atma
      }

      // 4. COOLDOWN (BEKLEME SÜRESİ) KONTROLÜ
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

        // 7. HERKESE YAYINLA
        io.emit('pixel_changed', { x, y, colorIndex, nickname });
        
        console.log(`✅ BAŞARILI -> Pixel (${x},${y}) ${nickname} tarafından boyandı.`);
      }

    } catch (err) {
      // Kritik hataları her zaman loglamalıyız
      console.error("🚨 PIXEL HANDLER HATASI:", err);
    }
  });
}