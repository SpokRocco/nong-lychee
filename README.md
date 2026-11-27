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
npm run dev               # เปิด URL ที่แสดงใน Terminal (ปกติ http://localhost:8080)
npm test                  # ทดสอบตัวแยกคำสั่งเสียง
```

> บน Windows PowerShell ถ้า `npm` ถูกบล็อกด้วย Execution Policy ให้ใช้ `npm.cmd` แทน

ไม่ตั้งค่า `.env` ก็รันได้: แอปจะเข้า **โหมดออฟไลน์** (ตอบเฉพาะข้อมูลพื้นฐานที่ยืนยันแล้ว, โมเดล 3D/เสียง/กล้องทำงานปกติ)
ต้องใช้ **Chrome หรือ Edge** สำหรับรับเสียงพูดภาษาไทย (`SpeechRecognition` ต้องออนไลน์และเปิดผ่าน `localhost` หรือ HTTPS เท่านั้น — เปิดผ่าน IP เช่น `http://192.168.x.x` ไมค์จะถูกบล็อก)

### ถ้า `npm run dev` ขึ้นไม่ได้
- **พอร์ตชน/ถูกสงวน** (เช่น `Port 8080 is already in use`): ตอนนี้ Vite จะขยับไปพอร์ตถัดไปเอง (8081, 8082 …) ให้เปิด URL ที่ Terminal แสดง หรือกำหนดเอง `PORT=3000 npm run dev` (PowerShell: `$env:PORT=3000; npm run dev`)
- **`npm` ถูกบล็อกบน Windows**: ใช้ `npm.cmd run dev`
- **หน้าขาว/ไม่มีน้องลิ้นจี่**: เบราว์เซอร์ต้องเปิด WebGL (Chrome/Edge ล่าสุด) และดู Console (F12) ว่ามี error อะไร
- ต้องใช้ Node.js 18 ขึ้นไป (`node -v`); ลบ `node_modules` แล้ว `npm ci` ถ้าติดตั้งค้างครึ่งทาง

## ตั้งค่า Supabase (ใช้โปรเจกต์เดียวกับเว็บไซต์โรงเรียน แต่แยกฐานข้อมูล 100%)

น้องลิ้นจี่ใช้ **โปรเจกต์ Supabase เดียวกับเว็บโรงเรียน** แต่ทุกอย่างอยู่ใน Postgres **schema แยกชื่อ `nong_lychee`** — ไม่สร้าง/แก้/อ่านตารางใน `public` ของเว็บโรงเรียนเลย:

| ส่วน | ของน้องลิ้นจี่ | เว็บโรงเรียน |
|---|---|---|
| ตาราง | schema `nong_lychee` (`knowledge`, `chat_analytics`, `admins`, view `executive_top_topics`) | schema `public` (ไม่แตะ) |
| ผู้ดูแลแดชบอร์ด | ตาราง `nong_lychee.admins` (ของเราเอง) | `public.admin_users` (ไม่แตะ ไม่อ่าน) |
| Edge Functions | `nong-lychee-chat`, `nong-lychee-sync`, `nong-lychee-line` | — |
| Secrets | ขึ้นต้น `NONG_LYCHEE_` | — |
| สิทธิ์ผู้เยี่ยมชม (anon) | **ไม่มีสิทธิ์ใน schema นี้เลย** คุยผ่าน Edge Function เท่านั้น | ตามเดิม |

โฟลเดอร์ [`supabase/nong-lychee/`](./supabase/nong-lychee) เก็บ SQL ของน้องลิ้นจี่ทั้งหมด: `schema.sql` (ติดตั้ง รันซ้ำได้), `checks.sql` (ตรวจการแยก), `uninstall.sql` (ถอนออกโดยไม่กระทบเว็บโรงเรียน)

**ขั้นตอน**

1. เปิด Supabase Dashboard ของโปรเจกต์โรงเรียน → **SQL Editor** → วางไฟล์ [`supabase/nong-lychee/schema.sql`](./supabase/nong-lychee/schema.sql) ทั้งไฟล์ → **Run**
2. **Project Settings → Data API → Exposed schemas** → เพิ่ม `nong_lychee` *ต่อท้ายรายการเดิม* (ห้ามลบของเดิม) → Save
3. **Authentication → Users → Add user** สร้างบัญชีผู้บริหาร แล้วเพิ่มเป็นผู้ดูแลแดชบอร์ด (แก้อีเมล):
   ```sql
   insert into nong_lychee.admins (user_id, note)
   select id, 'ผู้อำนวยการ' from auth.users where email = 'director@example.com'
   on conflict (user_id) do nothing;
   ```
   ผู้ใช้ที่ล็อกอินได้แต่ไม่อยู่ใน `nong_lychee.admins` จะ **อ่านสถิติไม่ได้** (RLS ตรวจ `nong_lychee.is_admin()`)
4. รัน [`supabase/nong-lychee/checks.sql`](./supabase/nong-lychee/checks.sql) เพื่อยืนยันว่า anon ไม่มีสิทธิ์ และไม่มีอะไรหลุดไป `public`
5. ติดตั้ง [Supabase CLI](https://supabase.com/docs/guides/cli) แล้ว Deploy **เฉพาะ function ของน้องลิ้นจี่** (ระบุชื่อทุกครั้ง):

```bash
supabase login
supabase link --project-ref YOUR_SCHOOL_PROJECT_REF   # โปรเจกต์เดียวกับเว็บโรงเรียน
supabase secrets set NONG_LYCHEE_GEMINI_API_KEY=xxxx NONG_LYCHEE_SYNC_SECRET=ตั้งรหัสลับยาวๆ NONG_LYCHEE_ALLOWED_ORIGIN=https://YOUR-APP.vercel.app
# (ไม่บังคับ) NONG_LYCHEE_GEMINI_MODEL=gemini-2.5-flash  NONG_LYCHEE_GEMINI_EMBEDDING_MODEL=gemini-embedding-001

supabase functions deploy nong-lychee-chat
supabase functions deploy nong-lychee-sync --no-verify-jwt
supabase functions deploy nong-lychee-line --no-verify-jwt   # ถ้าใช้ LINE
```

> ⚠️ **ห้าม** รัน `supabase db push`, `supabase db reset`, `supabase config push` หรือ `supabase migration ...` กับโปรเจกต์ที่ใช้ร่วมกับเว็บโรงเรียน — คำสั่งเหล่านี้จัดการฐานข้อมูล/ตั้งค่าทั้งโปรเจกต์ ฐานข้อมูลน้องลิ้นจี่ติดตั้งด้วย `schema.sql` ใน SQL Editor เท่านั้น
> `secrets set` ใช้ได้ แต่ต้องขึ้นต้น `NONG_LYCHEE_` เสมอ เพื่อไม่ทับ secret อื่นของโปรเจกต์

6. ใส่ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` (Project Settings → API — ค่าชุดเดียวกับที่เว็บโรงเรียนใช้) ใน `.env` และใน Vercel

คีย์ Gemini **อยู่ฝั่ง Edge Function เท่านั้น** ไม่ถูกส่งไปที่เบราว์เซอร์ (ตัวแปร `VITE_DEV_GEMINI_API_KEY` ใช้ทดสอบในเครื่องเท่านั้น ห้ามตั้งบน Vercel)

**ถอนการติดตั้ง:** รัน [`uninstall.sql`](./supabase/nong-lychee/uninstall.sql) (ลบเฉพาะ schema `nong_lychee`) แล้วเอา `nong_lychee` ออกจาก Exposed schemas

### ⚠️ หมายเหตุเรื่อง Embedding Model

สเปคกำหนด `text-embedding-004` (768 มิติ) แต่ Google **ปิดบริการโมเดลนี้บน Gemini API แล้วเมื่อ 14 ม.ค. 2569**
โปรเจกต์จึงใช้ **`gemini-embedding-001` พร้อม `outputDimensionality: 768`** เป็นค่าเริ่มต้น ซึ่งตรงกับคอลัมน์ `vector(768)` ในสคีมา
ถ้าบัญชีของคุณยังเรียก `text-embedding-004` ได้ ให้ตั้ง `NONG_LYCHEE_GEMINI_EMBEDDING_MODEL=text-embedding-004` ได้ (ห้ามสลับโมเดลโดยไม่ซิงก์ข้อมูลใหม่ เพราะเวกเตอร์จากคนละโมเดลเทียบกันไม่ได้)

## สั่งงานด้วยเสียง (Voice Mode)

กดปุ่ม **“สั่งงานด้วยเสียง”** ในแชท (หรือปุ่มไมค์ใหญ่ในหน้า Kiosk) เพื่อคุยกับน้องลิ้นจี่ต่อเนื่องโดยไม่ต้องกดไมค์ทุกครั้ง

- **เรียกชื่อ:** พูดว่า “น้องลิ้นจี่ …” แล้วตามด้วยคำถาม เช่น *“น้องลิ้นจี่ ลิ้นจี่เมืองจังคืออะไร”* หลังน้องตอบ พูดต่อได้เลยภายใน ~25 วินาทีโดยไม่ต้องเรียกชื่อซ้ำ (ถ้าไม่มีใครพูด น้องจะกลับไปรอฟังชื่อ — เสียงคุยรอบข้างจะถูกข้าม)
- **คำสั่งเสียง** (พูดทั้งประโยค ใส่ “น้องลิ้นจี่” นำหน้าหรือไม่ก็ได้):

| พูดว่า | ผล |
|---|---|
| โหมดติวเตอร์ / โหมดข้อมูลโรงเรียน | สลับโหมด |
| ฉันเป็นนักเรียน / ผู้ปกครอง / ผู้มาเยือน | ตั้งผู้ถาม |
| พูดอีกครั้ง / พูดซ้ำ | อ่านคำตอบล่าสุดซ้ำ |
| ล้างการสนทนา / เริ่มใหม่ | ล้างแชท |
| ปิดเสียง / เปิดเสียง | ปิด-เปิดเสียงพูดของน้อง |
| จบการสนทนา / ลาก่อน | จบช่วงสนทนา (กลับไปรอฟังชื่อ) |
| ปิดโหมดเสียง | ปิดการฟังต่อเนื่อง |
| โบกมือ / ยิ้ม / ดีใจ | ท่าทางของน้อง |
| ทำอะไรได้บ้าง | อ่านรายการคำสั่ง |

- **ข้อจำกัดที่ควรรู้:** ขณะน้องพูด ไมค์จะปิดชั่วคราวเพื่อกันไมค์ได้ยินเสียงตัวเอง จึง “พูดแทรก” กลางประโยคไม่ได้ (รอให้น้องพูดจบ หรือกดปุ่มสั่งงานด้วยเสียงเพื่อปิด)
- ใช้ได้เฉพาะ **Chrome / Edge** บน `localhost` หรือ HTTPS, ต้องอนุญาตไมโครโฟน และต้องออนไลน์ (Chrome ส่งเสียงไปประมวลผลที่เซิร์ฟเวอร์ของ Google) บนมือถือบางเครื่องอาจมีเสียง “ติ๊ง” ทุกครั้งที่เริ่มฟังใหม่
- ตัวแยกคำสั่งอยู่ที่ [`src/lib/voiceCommands.ts`](./src/lib/voiceCommands.ts) (มีชุดทดสอบ `npm test`) เพิ่ม/แก้คำสั่งได้ที่ตาราง `RULES`

## ซิงก์ความรู้จาก Google Drive (RAG)

1. สร้างโฟลเดอร์ใน Drive เช่น `ความรู้น้องลิ้นจี่/` และโฟลเดอร์ย่อยตามหมวด: `วิชาการ`, `กิจกรรม`, `บุคลากร`, `รับสมัครนักเรียน` (ชื่อโฟลเดอร์ย่อย = `category`)
2. วางไฟล์ Google Docs / Sheets / PDF
3. สร้างโปรเจกต์ Apps Script แล้ววางโค้ดจาก [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) ตั้ง Script properties (`FOLDER_ID`, `SYNC_URL` = `…/functions/v1/nong-lychee-sync`, `SYNC_SECRET` = ค่าเดียวกับ `NONG_LYCHEE_SYNC_SECRET`) และเปิด Drive API (Advanced Service)
4. รัน `setupTrigger()` หนึ่งครั้ง → ซิงก์ทุกชั่วโมง (หรือรัน `syncAll()` ทันที)

Edge Function `nong-lychee-sync` แบ่งไฟล์เป็นชิ้นละ ~1,200 ตัวอักษร สร้าง embedding แล้ว upsert ลง `nong_lychee.knowledge` (`drive_file_id = <fileId>#<n>`)
> ตาราง `nong_lychee.knowledge` เปิดให้เฉพาะ Edge Function อ่าน (ผู้เยี่ยมชมอ่านตรงไม่ได้) แต่เนื้อหาจะถูกนำไปตอบทุกคนที่ถามน้องลิ้นจี่ — **อย่าวางเอกสารที่มีข้อมูลส่วนบุคคลหรือข้อมูลลับ** ลงในโฟลเดอร์ซิงก์

## LINE Messaging API

1. LINE Developers → สร้าง Messaging API channel → เก็บ **Channel secret** และ **Channel access token**
2. `supabase secrets set NONG_LYCHEE_LINE_CHANNEL_SECRET=... NONG_LYCHEE_LINE_CHANNEL_ACCESS_TOKEN=...`
3. ตั้ง Webhook URL เป็น `https://YOUR-PROJECT.supabase.co/functions/v1/nong-lychee-line` แล้วเปิด *Use webhook* (ปิด auto-reply)
4. Rich Menu: เตรียมรูป 2500×1686 px แล้วรัน `LINE_CHANNEL_ACCESS_TOKEN=... node scripts/create-richmenu.mjs ./richmenu.png`
   (PowerShell: `$env:LINE_CHANNEL_ACCESS_TOKEN="..."; node scripts/create-richmenu.mjs ./richmenu.png`)

คำตอบส่งเป็น **Flex Message** สีตามอารมณ์ของน้อง พิมพ์ "โหมดติวเตอร์" / "โหมดข้อมูลโรงเรียน" เพื่อสลับโหมด (เก็บในหน่วยความจำของ Edge instance ชั่วคราว) ทุกคำถามถูกบันทึกลง `nong_lychee.chat_analytics` ช่องทาง `LINE`

## โมเดล 3D

- ค่าเริ่มต้น: **โมเดล Procedural** ในโค้ด (`src/components/Mascot3D.tsx`) — ฮู้ดเปลือกลิ้นจี่หนามแหลมประดับกิ๊บเขียว ใบและผลจิ๋วด้านบน ดวงตาสีน้ำตาลเป็นประกาย แก้มชมพู ชุดนักเรียนหญิง (โบว์กรมท่า กระโปรงจีบ อกขวาปักชื่อ `น้องลิ้นจี่` / `โรงเรียนบ้านหาดเค็ด` และอกซ้ายติดโลโก้ `public/logo-hadket-2026.png`) พร้อมอารมณ์ HAPPY / EXCITED / THINKING / SAD / SURPRISED / WAVE
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
จากนั้นนำโดเมนไปตั้ง `NONG_LYCHEE_ALLOWED_ORIGIN` ใน `supabase secrets` เพื่อจำกัด CORS ของ `nong-lychee-chat`

## โครงสร้างโปรเจกต์

```
supabase/nong-lychee/        schema.sql (schema nong_lychee) · checks.sql · uninstall.sql — แยกจากฐานข้อมูลเว็บโรงเรียน
supabase/functions/          nong-lychee-chat · nong-lychee-sync · nong-lychee-line · _nong_lychee_shared/brain.ts (RAG + Gemini)
google-apps-script/Code.gs   ซิงก์ Drive → Supabase
scripts/create-richmenu.mjs  LINE Rich Menu
src/components/              Mascot3D (Procedural), ExternalModel (.glb/.vrm), MascotStage, ChatPanel, Header
src/hooks/useMascotChat.ts   แชท + เสียง (push-to-talk และโหมดสั่งงานด้วยเสียง)
src/lib/                     ai, speech (STT/TTS), voiceCommands (wake word + คำสั่งเสียง), audioMeter, presence (MediaPipe), mascotBus
src/pages/                   HomePage, KioskPage, DashboardPage
```

## ความปลอดภัย

- RLS เปิดทุกตารางใน `nong_lychee`; **anon ไม่มีสิทธิ์ใน schema นี้** ผู้เยี่ยมชมเข้าถึงข้อมูลผ่าน Edge Function เท่านั้น; view `executive_top_topics` ใช้ `security_invoker = true`
- แดชบอร์ด/รายงาน Gemini ต้องล็อกอิน **และอยู่ในตาราง `nong_lychee.admins`** (โปรเจกต์ใช้ร่วมกับเว็บโรงเรียน ผู้ใช้ที่ล็อกอินได้จึงไม่ใช่ผู้ดูแลน้องลิ้นจี่ทุกคน)
- `nong-lychee-line` ตรวจลายเซ็น HMAC-SHA256; `nong-lychee-sync` ตรวจ `x-sync-secret`
- Prompt สั่งให้ไม่แต่งข้อมูลโรงเรียนนอกเหนือจากข้อมูลอ้างอิง และไม่ขอข้อมูลส่วนตัวจากเด็ก
- `nong_lychee.chat_analytics` เก็บคำถามดิบ — แนะนำแจ้งผู้ใช้ไม่ให้พูด/พิมพ์ข้อมูลส่วนตัว (โหมดเสียงส่งเสียงไปที่บริการรับเสียงของเบราว์เซอร์ด้วย)
