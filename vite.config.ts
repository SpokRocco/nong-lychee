import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// พอร์ตเริ่มต้น 8080 — ถ้าพอร์ตถูกใช้อยู่/ถูกระบบสงวนไว้ (เจอบ่อยบน Windows) Vite จะขยับไปพอร์ตถัดไปเอง
// แล้วแสดง URL จริงใน Terminal (เช่น http://localhost:8081) แทนที่จะล้มเหลวทันที
// อยากกำหนดเอง:  PORT=3000 npm run dev
const port = Number(process.env.PORT) || 8080;

export default defineConfig({
  plugins: [react()],
  server: { port, strictPort: false, host: true, allowedHosts: true },
  preview: { port, strictPort: false, host: true, allowedHosts: true },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
