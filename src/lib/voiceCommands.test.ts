import { describe, expect, it } from 'vitest';
import { hasWakeWord, parseUtterance } from './voiceCommands';

describe('wake word "น้องลิ้นจี่"', () => {
  it.each(['น้องลิ้นจี่', 'น้องลิ้นจี', 'น้อง ลิ้นจี่', 'น้องลินจี่', 'น้องลิ้นจิ', 'สวัสดีน้องลิ้นจี่ค่ะ', 'น้องลิ้นจี่ ช่วยหน่อย'])(
    'detects %s',
    (s) => expect(hasWakeWord(s)).toBe(true),
  );

  it.each(['ลิ้นจี่เมืองจังคืออะไร', 'ผู้อำนวยการชื่ออะไร', 'น้องๆ นักเรียนมีกี่คน', 'ทำไมลิ้นจี่ถึงมีสีแดง'])('ignores %s', (s) =>
    expect(hasWakeWord(s)).toBe(false),
  );

  it('strips the wake word and keeps the question', () => {
    const p = parseUtterance('น้องลิ้นจี่ ลิ้นจี่เมืองจังคืออะไร');
    expect(p.wake).toBe(true);
    expect(p.text).toBe('ลิ้นจี่เมืองจังคืออะไร');
    expect(p.command).toBeNull();
  });

  it('treats a bare call (with polite particle) as wake-only', () => {
    expect(parseUtterance('น้องลิ้นจี่')).toMatchObject({ wake: true, text: '', command: null });
    expect(parseUtterance('น้องลิ้นจี่คะ')).toMatchObject({ wake: true, text: '', command: null });
    expect(parseUtterance('น้องลิ้นจี่จ๋า')).toMatchObject({ wake: true, text: '', command: null });
  });

  it('keeps greetings as a normal question', () => {
    const p = parseUtterance('สวัสดีน้องลิ้นจี่ค่ะ');
    expect(p.wake).toBe(true);
    expect(p.command).toBeNull();
    expect(p.text).toContain('สวัสดี');
  });
});

describe('voice commands', () => {
  const cmd = (s: string) => parseUtterance(s).command;

  it('switches mode', () => {
    expect(cmd('โหมดติวเตอร์')).toEqual({ type: 'mode', mode: 'TUTOR' });
    expect(cmd('เปลี่ยนเป็นโหมดติวเตอร์ค่ะ')).toEqual({ type: 'mode', mode: 'TUTOR' });
    expect(cmd('น้องลิ้นจี่ สลับเป็นโหมดติวเตอร์นะคะ')).toEqual({ type: 'mode', mode: 'TUTOR' });
    expect(cmd('โหมดข้อมูลโรงเรียน')).toEqual({ type: 'mode', mode: 'SCHOOL_INFO' });
    expect(cmd('กลับไปโหมดข้อมูลโรงเรียน')).toEqual({ type: 'mode', mode: 'SCHOOL_INFO' });
  });

  it('sets the user role', () => {
    expect(cmd('ฉันเป็นนักเรียน')).toEqual({ type: 'role', role: 'นักเรียน' });
    expect(cmd('ผมเป็นผู้ปกครองครับ')).toEqual({ type: 'role', role: 'ผู้ปกครอง' });
    expect(cmd('ฉันคือผู้มาเยือน')).toEqual({ type: 'role', role: 'ผู้มาเยือน' });
    expect(cmd('เราเป็นคนทั่วไป')).toEqual({ type: 'role', role: 'ทั่วไป' });
  });

  it('clear / repeat / mute / goodbye / voice off / help', () => {
    expect(cmd('ล้างการสนทนา')).toEqual({ type: 'clear' });
    expect(cmd('เริ่มใหม่นะคะ')).toEqual({ type: 'clear' });
    expect(cmd('พูดอีกครั้ง')).toEqual({ type: 'repeat' });
    expect(cmd('ช่วยพูดซ้ำหน่อย')).toEqual({ type: 'repeat' });
    expect(cmd('ปิดเสียง')).toEqual({ type: 'mute' });
    expect(cmd('เปิดเสียง')).toEqual({ type: 'unmute' });
    expect(cmd('จบการสนทนา')).toEqual({ type: 'goodbye' });
    expect(cmd('ลาก่อนนะคะ')).toEqual({ type: 'goodbye' });
    expect(cmd('ปิดโหมดเสียง')).toEqual({ type: 'voiceOff' });
    expect(cmd('มีคำสั่งอะไรบ้าง')).toEqual({ type: 'help' });
  });

  it('emotion commands', () => {
    expect(cmd('โบกมือ')).toMatchObject({ type: 'emotion', emotion: 'WAVE' });
    expect(cmd('ยิ้มหน่อย')).toMatchObject({ type: 'emotion', emotion: 'HAPPY' });
    expect(cmd('ดีใจ')).toMatchObject({ type: 'emotion', emotion: 'EXCITED' });
  });

  it('does NOT hijack real questions that merely contain command words', () => {
    expect(cmd('ติวเตอร์ที่ดีควรทำอย่างไร')).toBeNull();
    expect(cmd('ช่วยสอนการบวกเลขเศษส่วนหน่อย')).toBeNull();
    expect(cmd('โรงเรียนเปิดเสียงตามสายกี่โมง')).toBeNull();
    expect(cmd('ล้างมือก่อนกินข้าวทำไม')).toBeNull();
    expect(cmd('ลิ้นจี่เมืองจังคืออะไร')).toBeNull();
    expect(cmd('ผู้อำนวยการโรงเรียนชื่ออะไร')).toBeNull();
    expect(cmd('รับสมัครนักเรียนต้องเตรียมอะไรบ้าง')).toBeNull();
    expect(cmd('')).toBeNull();
  });
});
