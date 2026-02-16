import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { canvasService } from "./services/canvasService.js";
import registerPixelHandlers from "./sockets/pixelHandler.js";

const app = express();
const httpServer = createServer(app);

// CORS ayarları
const io = new Server(httpServer, { 
  cors: { origin: "*" },
  transports: ['websocket', 'polling']
});

// Başlangıçta tuvali hazırla
await canvasService.init();

const broadcastUserCount = () => {
  const count = io.engine.clientsCount;
  io.emit('user_count', count);
};

io.on("connection", async (socket) => {
  // Yeni bağlanan için hemen sayıyı güncelle
  broadcastUserCount();

  // --- YENİ: NICKNAME KONTROLÜ (İstersen giriş ekranında kullan) ---
  socket.on("check_nickname", async (nickname) => {
    // Sadece nick'in boşta olup olmadığını döner, frontend'i bozmaz
    const isAvailable = await canvasService.isNicknameAvailable(nickname);
    socket.emit("nick_status", { success: isAvailable, nickname });
  });

  socket.on("request_canvas", async () => {
    try {
      const currentCanvas = await canvasService.getCanvas();
      if (currentCanvas) {
        socket.emit("init_canvas", currentCanvas);
        socket.emit('user_count', io.engine.clientsCount);
      }
    } catch (err) {
      console.error("📤 Tuval gönderim hatası:", err);
    }
  });

  // Handler'ı bağla
  registerPixelHandlers(io, socket);

  socket.on("disconnect", () => {
    broadcastUserCount();
  });
});

// Global hata yakalayıcı
process.on('uncaughtException', (err) => {
  console.error('🔥 Kritik Hata (Uncaught):', err);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});