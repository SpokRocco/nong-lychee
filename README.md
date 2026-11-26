# น้องลิ้นจี่ AI Mascot 3D 🍒

มาสคอต AI 3D อัจฉริยะของ **โรงเรียนบ้านหาดเค็ด** (สพป.น่าน เขต 1) ผู้อำนวยการ: นายเอกชัย สุภา
สื่อถึง "ลิ้นจี่เมืองจัง" ของดีประจำอำเภอภูเพียง จังหวัดน่าน

Stack: Vite + React 18 + TypeScript + Tailwind · Three.js (`@react-three/fiber`/`drei`) · Web Speech API + Web Audio API · MediaPipe · Gemini · Supabase (Postgres + pgvector + Auth + Edge Functions) · Google Drive/Apps Script · LINE Messaging API · Vercel

## หน้าในแอป (hash routing)

| URL | หน้า |
|---|---|
| `#/` | น้องลิ้นจี่ 3D + แชท (โหมด **ข้อมูลโรงเรียน** / **ติวเตอร์**, เลือกผู้ใช้: นักเรียน/ผู้ปกครอง/ผู้มาเยือน, พูดถามด้วยเสียงภาษาไทย) |
| `#/kiosk` | Smart Kiosk เต็มจอ: ตรวจคนเดินผ่านด้วยกล้อง (ในเบราว์เซอร์) → ทักทายด้วยเสียง → เปิดไมค์รอรับคำถาม |
| `#/dashboard` | แดชบอร์ดผู้บริหาร (ล็อกอิน Supabase Auth): Top 10 หัวข้อ, สถิติ, รายงานสรุปโดย Gemini |

## เริ่มต้นในเครื่อง (พอร์ต 8080)

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env แล้วแก้ค่า
npm run dev               # http://localhost:8080
```

> บน Windows PowerShell ถ้า `npm` ถูกบล็อกด้วย Execution Policy ให้ใช้ `npm.cmd` แทน

ไม่ตั้งค่า `.env` ก็รันได้: แอปจะเข้า **โหมดออฟไลน์** (ตอบเฉพาะข้อมูลพื้นฐานที่ยืนยันแล้ว, โมเดล 3D/เสียง/กล้องทำงานปกติ)
ต้องใช้ **Chrome หรือ Edge** สำหรับรับเสียงพูดภาษาไทย (`SpeechRecognition` ต้องออนไลน์และเปิดผ่าน `localhost` หรือ HTTPS)

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ supabase.com
2. เปิด **SQL Editor** → วางไฟล์ [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql) ทั้งไฟล์ → **Run** (รันซ้ำได้ปลอดภัย)
3. **Authentication → Users → Add user** สร้างบัญชีผู้บริหาร/แอดมินสำหรับล็อกอิน `#/dashboard`
   (ปิด "Allow new users to sign up" ที่ Authentication → Providers → Email เพื่อไม่ให้คนนอกสมัครแล้วอ่านสถิติได้ เพราะนโยบาย `authenticated read` อนุญาตผู้ล็อกอินทุกคน)
4. ติดตั้ง [Supabase CLI](https://supabase.com/docs/guides/cli) แล้ว Deploy Edge Functions:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY=xxxx SYNC_SECRET=ตั้งรหัสลับยาวๆ ALLOWED_ORIGIN=https://YOUR-APP.vercel.app
# (ไม่บังคับ) GEMINI_MODEL=gemini-2.5-flash  GEMINI_EMBEDDING_MODEL=gemini-embedding-001

supabase functions deploy mascot-chat
supabase functions deploy sync-knowledge --no-verify-jwt
supabase functions deploy line-webhook   --no-verify-jwt   # ถ้าใช้ LINE
```

5. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` (Project Settings → API) ใน `.env` และใน Vercel

คีย์ Gemini **อยู่ฝั่ง Edge Function เท่านั้น** ไม่ถูกส่งไปที่เบราว์เซอร์ (ตัวแปร `VITE_DEV_GEMINI_API_KEY` ใช้ทดสอบในเครื่องเท่านั้น ห้ามตั้งบน Vercel)

### ⚠️ หมายเหตุเรื่อง Embedding Model

สเปคกำหนด `text-embedding-004` (768 มิติ) แต่ Google **ปิดบริการโมเดลนี้บน Gemini API แล้วเมื่อ 14 ม.ค. 2569**
โปรเจกต์จึงใช้ **`gemini-embedding-001` พร้อม `outputDimensionality: 768`** เป็นค่าเริ่มต้น ซึ่งตรงกับคอลัมน์ `vector(768)` และสคีมาตามสเปคทุกประการ
ถ้าบัญชีของคุณยังเรียก `text-embedding-004` ได้ ให้ตั้ง `GEMINI_EMBEDDING_MODEL=text-embedding-004` ได้ (ห้ามสลับโมเดลโดยไม่ซิงก์ข้อมูลใหม่ เพราะเวกเตอร์จากคนละโมเดลเทียบกันไม่ได้)

## ซิงก์ความรู้จาก Google Drive (RAG)

1. สร้างโฟลเดอร์ใน Drive เช่น `ความรู้น้องลิ้นจี่/` และโฟลเดอร์ย่อยตามหมวด: `วิชาการ`, `กิจกรรม`, `บุคลากร`, `รับสมัครนักเรียน` (ชื่อโฟลเดอร์ย่อย = `category`)
2. วางไฟล์ Google Docs / Sheets / PDF
3. สร้างโปรเจกต์ Apps Script แล้ววางโค้ดจาก [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) ตั้ง Script properties (`FOLDER_ID`, `SYNC_URL`, `SYNC_SECRET`) และเปิด Drive API (Advanced Service)
4. รัน `setupTrigger()` หนึ่งครั้ง → ซิงก์ทุกชั่วโมง (หรือรัน `syncAll()` ทันที)

Edge Function `sync-knowledge` แบ่งไฟล์เป็นชิ้นละ ~1,200 ตัวอักษร สร้าง embedding แล้ว upsert ลง `school_knowledge` (`drive_file_id = <fileId>#<n>`)
> ตาราง `school_knowledge` ตามสเปคอ่านได้แบบสาธารณะ — **อย่าวางเอกสารที่มีข้อมูลส่วนบุคคลหรือข้อมูลลับ** ลงในโฟลเดอร์ซิงก์

## LINE Messaging API

1. LINE Developers → สร้าง Messaging API channel → เก็บ **Channel secret** และ **Channel access token**
2. `supabase secrets set LINE_CHANNEL_SECRET=... LINE_CHANNEL_ACCESS_TOKEN=...`
3. ตั้ง Webhook URL เป็น `https://YOUR-PROJECT.supabase.co/functions/v1/line-webhook` แล้วเปิด *Use webhook* (ปิด auto-reply)
4. Rich Menu: เตรียมรูป 2500×1686 px แล้วรัน `LINE_CHANNEL_ACCESS_TOKEN=... node scripts/create-richmenu.mjs ./richmenu.png`
   (PowerShell: `$env:LINE_CHANNEL_ACCESS_TOKEN="..."; node scripts/create-richmenu.mjs ./richmenu.png`)

คำตอบส่งเป็น **Flex Message** สีตามอารมณ์ของน้อง พิมพ์ "โหมดติวเตอร์" / "โหมดข้อมูลโรงเรียน" เพื่อสลับโหมด (เก็บในหน่วยความจำของ Edge instance ชั่วคราว) ทุกคำถามถูกบันทึกลง `chat_analytics` ช่องทาง `LINE`

## โมเดล 3D

- ค่าเริ่มต้น: **โมเดล Procedural** ในโค้ด (`src/components/Mascot3D.tsx`) — ฮู้ดเปลือกลิ้นจี่สีแดงผิวขรุขระ, ใบลิ้นจี่สีเขียว, ใบหน้าขาวใสแก้มชมพู, ชุดนักเรียนประถม พร้อมอารมณ์ HAPPY / EXCITED / THINKING / SAD / SURPRISED / WAVE
- ใช้โมเดลของจริง: วางไฟล์ `.glb` หรือ `.vrm` ที่ `public/models/` แล้วตั้ง `VITE_MASCOT_MODEL_URL=/models/nong-lychee.glb`
  - `.vrm` ควบคุมปากด้วย expression `aa` และอารมณ์ `happy/sad/surprised/relaxed`
  - `.glb` ขยับปากผ่าน morph target ชื่อ `mouthOpen` / `jawOpen` / `viseme_aa` / `aa`
  - โหลดไม่สำเร็จ → สลับกลับโมเดล Procedural อัตโนมัติ

## เสียง / Lip-Sync — ข้อจำกัดที่ควรรู้

- **ตอนผู้ใช้พูด:** `AnalyserNode` (Web Audio API) อ่านระดับเสียงไมโครโฟนจริง → น้องอ้าปาก/ขยับตามเสียงผู้พูด
- **ตอนน้องพูด:** เบราว์เซอร์ **ไม่อนุญาตให้ดึงเสียงของ `speechSynthesis` เข้า `AnalyserNode`** จึงขยับปากด้วยสัญญาณ `boundary` ของ TTS (จังหวะคำจริง) ผสม envelope สังเคราะห์ ไม่ใช่การวิเคราะห์คลื่นเสียงจริง
  ถ้าต้องการ lip-sync จากคลื่นเสียงจริง ให้เปลี่ยน TTS เป็นบริการที่คืนไฟล์เสียง (เช่น Google Cloud TTS) แล้วเล่นผ่าน `<audio>` + `createMediaElementSource`
- คุณภาพเสียงไทยขึ้นกับเครื่อง (Chrome/Android มักมีเสียง `th-TH`; ถ้าเครื่องไม่มีเสียงไทย จะไม่มีเสียงพูดแต่ข้อความยังแสดง)
- เบราว์เซอร์บังคับให้ต้องมี "การแตะ" ก่อนเล่นเสียง ดังนั้น Kiosk ต้องกด **เริ่มระบบ** หนึ่งครั้งหลังเปิดหน้าจอ

## Smart Kiosk & ความเป็นส่วนตัว

- ใช้ `@mediapipe/tasks-vision` (Face Detector) ตรวจ "มีใบหน้าหรือไม่" ในเบราว์เซอร์; ถ้าโหลดโมเดลไม่ได้ จะสลับเป็นตรวจการเคลื่อนไหวด้วยภาพ 64×48
- **ไม่บันทึก ไม่อัปโหลด ไม่แสดงภาพ ไม่จดจำ/ระบุตัวบุคคล**; ไฟล์ WASM/โมเดลโหลดจาก CDN (jsdelivr / storage.googleapis.com) ตั้งค่า URL ภายในองค์กรได้ที่ `VITE_MEDIAPIPE_*`
- แนะนำติดป้ายแจ้งผู้มาเยือนหน้าตู้ Kiosk และแจ้งตามนโยบาย PDPA ของโรงเรียน
- ตั้งค่า Chrome Kiosk: `chrome --kiosk --use-fake-ui-for-media-stream http://localhost:8080/#/kiosk` (หรืออนุญาตกล้อง/ไมค์ถาวรสำหรับโดเมนใน Chrome Settings)
- ข้อมูลเสียงถูกส่งไปยังบริการรับเสียงของเบราว์เซอร์ (Chrome ส่งไปเซิร์ฟเวอร์ของ Google) — ควรแจ้งผู้ใช้

## Deploy: GitHub + Vercel

```bash
git init && git add . && git commit -m "น้องลิ้นจี่ AI Mascot"
git remote add origin https://github.com/YOUR/nong-lychee.git && git push -u origin main
```

Vercel → Import Project → Framework: Vite (อ่าน `vercel.json` อัตโนมัติ) → ตั้ง Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (และ `VITE_MASCOT_MODEL_URL` ถ้ามี) → Deploy
จากนั้นนำโดเมนไปตั้ง `ALLOWED_ORIGIN` ใน `supabase secrets` เพื่อจำกัด CORS ของ `mascot-chat`

## โครงสร้างโปรเจกต์

```
SUPABASE_SETUP.sql          สคีมา pgvector / RLS / view
supabase/functions/         mascot-chat · sync-knowledge · line-webhook · _shared/brain.ts (RAG + Gemini)
google-apps-script/Code.gs  ซิงก์ Drive → Supabase
scripts/create-richmenu.mjs LINE Rich Menu
src/components/             Mascot3D (Procedural), ExternalModel (.glb/.vrm), MascotStage, ChatPanel, Header
src/lib/                    ai, speech (STT/TTS), audioMeter (AnalyserNode), presence (MediaPipe), mascotBus
src/pages/                  HomePage, KioskPage, DashboardPage
```

## ความปลอดภัย

- RLS เปิดทุกตาราง; view `executive_top_topics` สร้างด้วย `security_invoker = true` เพื่อให้ผู้ที่ไม่ได้ล็อกอินอ่านสถิติไม่ได้ (ปรับจากสคริปต์ต้นฉบับเล็กน้อยเพียงจุดนี้)
- `line-webhook` ตรวจลายเซ็น HMAC-SHA256; `sync-knowledge` ตรวจ `x-sync-secret`; การสรุปรายงานต้องใช้ JWT ผู้ใช้ที่ล็อกอินจริง
- Prompt สั่งให้ไม่แต่งข้อมูลโรงเรียนนอกเหนือจากข้อมูลอ้างอิง และไม่ขอข้อมูลส่วนตัวจากเด็ก
- `chat_analytics` เก็บคำถามดิบ — แนะนำแจ้งผู้ใช้ไม่ให้พิมพ์ข้อมูลส่วนตัว
