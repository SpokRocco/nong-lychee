/**
 * Google Apps Script: ซิงก์ไฟล์ใน Google Drive -> Supabase (school_knowledge) ผ่าน Edge Function sync-knowledge
 *
 * วิธีตั้งค่า
 *  1) script.google.com > New project > วางโค้ดนี้
 *  2) Services (+) > เพิ่ม "Drive API" (Advanced Drive Service v3) เพื่อใช้ OCR ไฟล์ PDF
 *  3) Project Settings > Script properties เพิ่ม:
 *       FOLDER_ID   = ไอดีโฟลเดอร์ Google Drive ที่เก็บเอกสารโรงเรียน
 *       SYNC_URL    = https://YOUR-PROJECT.supabase.co/functions/v1/sync-knowledge
 *       SYNC_SECRET = ค่าเดียวกับ secret SYNC_SECRET ใน Supabase
 *  4) รัน setupTrigger() หนึ่งครั้ง (อนุญาตสิทธิ์) แล้วระบบจะซิงก์ทุก 1 ชั่วโมง; หรือรัน syncAll() เอง
 *
 * โครงสร้างโฟลเดอร์: ชื่อโฟลเดอร์ย่อยระดับแรก = category (เช่น วิชาการ, กิจกรรม, บุคลากร, รับสมัครนักเรียน)
 * รองรับ: Google Docs, Google Sheets, PDF (OCR ภาษาไทย)
 * ข้อควรระวัง: ห้ามใส่ข้อมูลส่วนบุคคลที่ไม่ควรเผยแพร่ (เช่น เลขบัตรประชาชน) ในโฟลเดอร์นี้ เพราะตาราง school_knowledge อ่านได้แบบสาธารณะ
 */

const MIME_DOC = 'application/vnd.google-apps.document';
const MIME_SHEET = 'application/vnd.google-apps.spreadsheet';
const MIME_PDF = 'application/pdf';

function cfg_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('ยังไม่ได้ตั้งค่า Script property: ' + key);
  return v;
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAll').timeBased().everyHours(1).create();
}

function syncAll() {
  const root = DriveApp.getFolderById(cfg_('FOLDER_ID'));
  const state = JSON.parse(PropertiesService.getScriptProperties().getProperty('STATE') || '{}');
  const seen = {};
  walk_(root, 'ทั่วไป', state, seen);

  // ไฟล์ที่ถูกลบ/ย้ายออกจากโฟลเดอร์ -> ลบความรู้ออกจาก Supabase
  Object.keys(state).forEach(function (id) {
    if (!seen[id]) {
      if (post_({ drive_file_id: id, delete: true })) delete state[id];
    }
  });
  PropertiesService.getScriptProperties().setProperty('STATE', JSON.stringify(state));
}

function walk_(folder, category, state, seen) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    const mime = f.getMimeType();
    if ([MIME_DOC, MIME_SHEET, MIME_PDF].indexOf(mime) < 0) continue;
    const id = f.getId();
    seen[id] = true;
    const stamp = String(f.getLastUpdated().getTime());
    if (state[id] === stamp) continue; // ไม่เปลี่ยน ข้ามได้

    try {
      const content = extractText_(f, mime);
      if (!content || !content.trim()) continue;
      if (post_({ drive_file_id: id, file_name: f.getName(), category: category, content: content })) {
        state[id] = stamp;
      }
    } catch (e) {
      console.error('ซิงก์ไม่สำเร็จ: ' + f.getName() + ' - ' + e);
    }
  }
  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    // โฟลเดอร์ย่อยระดับแรกกำหนด category ลึกกว่านั้นใช้ category เดิม
    walk_(sub, category === 'ทั่วไป' ? sub.getName() : category, state, seen);
  }
}

function extractText_(file, mime) {
  if (mime === MIME_DOC) return DocumentApp.openById(file.getId()).getBody().getText();
  if (mime === MIME_SHEET) {
    return SpreadsheetApp.openById(file.getId())
      .getSheets()
      .map(function (sh) {
        const rows = sh.getDataRange().getDisplayValues();
        return '## ' + sh.getName() + '\n' + rows.map(function (r) { return r.join(' | '); }).join('\n');
      })
      .join('\n\n');
  }
  // PDF: แปลงเป็น Google Doc ชั่วคราวด้วย OCR (ภาษาไทย) แล้วอ่านข้อความ จากนั้นลบไฟล์ชั่วคราวทิ้ง
  const tmp = Drive.Files.create(
    { name: '[tmp-ocr] ' + file.getName(), mimeType: MIME_DOC },
    file.getBlob(),
    { ocrLanguage: 'th' }
  );
  try {
    return DocumentApp.openById(tmp.id).getBody().getText();
  } finally {
    Drive.Files.remove(tmp.id);
  }
}

function post_(payload) {
  const res = UrlFetchApp.fetch(cfg_('SYNC_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sync-secret': cfg_('SYNC_SECRET') },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  if (!ok) console.error('sync-knowledge ' + res.getResponseCode() + ': ' + res.getContentText());
  return ok;
}
