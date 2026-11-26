// สร้าง Rich Menu ของ LINE Official Account ให้น้องลิ้นจี่
// ใช้:  set LINE_CHANNEL_ACCESS_TOKEN=xxxx && node scripts/create-richmenu.mjs ./richmenu.png
// รูป richmenu.png ต้องขนาด 2500x1686 px (JPEG/PNG ไม่เกิน 1MB) - ออกแบบเองหรือใช้ Canva
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const imagePath = process.argv[2];
if (!token || !imagePath) {
  console.error('ต้องระบุ LINE_CHANNEL_ACCESS_TOKEN และ path รูป Rich Menu');
  process.exit(1);
}
import { readFile } from 'node:fs/promises';

const W = 2500, H = 1686, cw = Math.floor(W / 3), ch = Math.floor(H / 2);
const cell = (i, label, text) => ({
  bounds: { x: (i % 3) * cw, y: Math.floor(i / 3) * ch, width: cw, height: ch },
  action: { type: 'message', label, text },
});

const menu = {
  size: { width: W, height: H },
  selected: true,
  name: 'nong-lychee-menu',
  chatBarText: 'เมนูน้องลิ้นจี่',
  areas: [
    cell(0, 'ข้อมูลโรงเรียน', 'โหมดข้อมูลโรงเรียน'),
    cell(1, 'โหมดติวเตอร์', 'โหมดติวเตอร์'),
    cell(2, 'รับสมัครนักเรียน', 'รับสมัครนักเรียนต้องเตรียมอะไรบ้าง'),
    cell(3, 'ลิ้นจี่เมืองจัง', 'ลิ้นจี่เมืองจังคืออะไร'),
    cell(4, 'ตารางเรียน', 'ขอดูตารางเรียน'),
    cell(5, 'ติดต่อโรงเรียน', 'ติดต่อโรงเรียนบ้านหาดเค็ดได้อย่างไร'),
  ],
};

const headers = { Authorization: `Bearer ${token}` };
const created = await fetch('https://api.line.me/v2/bot/richmenu', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify(menu),
});
if (!created.ok) throw new Error(`create richmenu: ${created.status} ${await created.text()}`);
const { richMenuId } = await created.json();

const img = await readFile(imagePath);
const type = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': type },
  body: img,
});
if (!up.ok) throw new Error(`upload image: ${up.status} ${await up.text()}`);

const def = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST', headers });
if (!def.ok) throw new Error(`set default: ${def.status} ${await def.text()}`);
console.log('สร้าง Rich Menu สำเร็จ:', richMenuId);
