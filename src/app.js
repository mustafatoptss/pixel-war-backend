import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { canvasService } from "./services/canvasService.js";
import registerPixelHandlers from "./sockets/pixelHandler.js";

const app = express();
const httpServer = createServer(app);

// CORS ayarlarını production için biraz daha spesifik tutabilirsin
const io = new Server(httpServer, { 
  cors: { origin: "*" },
  transports: ['websocket', 'polling'] // Bağlantı stabilitesi için
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

  socket.on("request_canvas", async () => {
    try {
      const currentCanvas = await canvasService.getCanvas();
      if (currentCanvas) {
        socket.emit("init_canvas", currentCanvas);
        // Garanti olsun diye tekrar sayı gönder
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

// Global hata yakalayıcı (Server'ın kapanmasını önler)
process.on('uncaughtException', (err) => {
  console.error('🔥 Kritik Hata (Uncaught):', err);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});