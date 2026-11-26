import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Header } from '../components/Header';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { fetchExecutiveSummary } from '../lib/ai';

interface TopRow {
  topic_tag: string;
  mode: string;
  channel: string;
  total_questions: number;
  last_asked_at: string;
}
interface Row {
  id: string;
  channel: string;
  mode: string;
  user_role: string | null;
  question: string;
  topic_tag: string;
  created_at: string;
}

const DEMO_TOP: TopRow[] = [
  { topic_tag: 'รับสมัครเรียน', mode: 'SCHOOL_INFO', channel: 'LINE', total_questions: 42, last_asked_at: new Date().toISOString() },
  { topic_tag: 'ลิ้นจี่เมืองจัง', mode: 'SCHOOL_INFO', channel: 'KIOSK_VOICE', total_questions: 31, last_asked_at: new Date().toISOString() },
  { topic_tag: 'ติววิทยาการคำนวณ', mode: 'TUTOR', channel: 'WEB', total_questions: 24, last_asked_at: new Date().toISOString() },
  { topic_tag: 'ตารางเรียน', mode: 'SCHOOL_INFO', channel: 'WEB', total_questions: 18, last_asked_at: new Date().toISOString() },
  { topic_tag: 'เงินอุดหนุน', mode: 'SCHOOL_INFO', channel: 'LINE', total_questions: 11, last_asked_at: new Date().toISOString() },
];

export function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-lychee-50 to-white">
      <Header route="dashboard" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {!ready ? (
          <p className="text-center text-lychee-700">กำลังโหลด…</p>
        ) : !isSupabaseConfigured ? (
          <Panel demo />
        ) : session ? (
          <Panel />
        ) : (
          <Login />
        )}
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm space-y-4 p-6">
      <h2 className="text-lg font-semibold text-lychee-700">เข้าสู่ระบบผู้บริหาร / แอดมิน</h2>
      <p className="text-xs text-lychee-900/70">ผู้ใช้สร้างโดยแอดมินใน Supabase Auth เท่านั้น</p>
      <label className="block text-sm">
        อีเมล
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
          className="mt-1 w-full rounded-xl border border-lychee-200 px-3 py-2 outline-none focus:ring-2 focus:ring-lychee-200" />
      </label>
      <label className="block text-sm">
        รหัสผ่าน
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-lychee-200 px-3 py-2 outline-none focus:ring-2 focus:ring-lychee-200" />
      </label>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" size={16} /> : null} เข้าสู่ระบบ
      </button>
    </form>
  );
}

function Panel({ demo = false }: { demo?: boolean }) {
  const [top, setTop] = useState<TopRow[]>(demo ? DEMO_TOP : []);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState('');
  const [sumLoading, setSumLoading] = useState(false);

  const load = useCallback(async () => {
    if (demo || !supabase) return;
    setLoading(true);
    setErr('');
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const [t, r] = await Promise.all([
      supabase.from('executive_top_topics').select('*'),
      supabase.from('chat_analytics').select('id,channel,mode,user_role,question,topic_tag,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    ]);
    if (t.error || r.error) setErr('โหลดข้อมูลไม่สำเร็จ (ตรวจสอบว่ารัน SUPABASE_SETUP.sql แล้ว และล็อกอินด้วยผู้ใช้ที่ได้รับอนุญาต)');
    setTop((t.data as TopRow[]) ?? []);
    setRows((r.data as Row[]) ?? []);
    setLoading(false);
  }, [days, demo]);

  useEffect(() => void load(), [load]);

  const byChannel = useMemo(() => count(rows, (r) => r.channel), [rows]);
  const byMode = useMemo(() => count(rows, (r) => r.mode), [rows]);
  const byRole = useMemo(() => count(rows, (r) => r.user_role ?? 'ทั่วไป'), [rows]);
  const maxTop = Math.max(1, ...top.map((x) => Number(x.total_questions)));

  const summarize = async () => {
    setSumLoading(true);
    setSummary('');
    try {
      setSummary(demo ? 'ตัวอย่างรายงาน: เชื่อมต่อ Supabase และ Edge Function เพื่อให้ Gemini สรุปรายงานผู้บริหารจากข้อมูลจริง' : await fetchExecutiveSummary(days));
    } catch {
      setSummary('สร้างรายงานไม่สำเร็จ ตรวจสอบว่า Deploy Edge Function mascot-chat และตั้งค่า GEMINI_API_KEY แล้ว');
    }
    setSumLoading(false);
  };

  return (
    <div className="space-y-5">
      {demo && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
          ข้อมูลด้านล่างเป็น <b>ตัวอย่างสำหรับสาธิต</b> — ยังไม่ได้เชื่อมต่อ Supabase
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-xl font-semibold text-lychee-700">แดชบอร์ดผู้บริหาร · คำถามยอดฮิต</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-full border border-lychee-200 bg-white px-3 py-1.5 text-sm" aria-label="ช่วงเวลา">
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>{d} วันล่าสุด</option>)}
        </select>
        <button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
        {!demo && (
          <button className="btn btn-ghost" onClick={() => void supabase!.auth.signOut()}>
            <LogOut size={15} /> ออกจากระบบ
          </button>
        )}
      </div>
      {err && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{err}</p>}

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section className="card p-5">
          <h3 className="mb-3 font-medium">Top 10 หัวข้อ (view: executive_top_topics)</h3>
          {top.length === 0 ? <p className="text-sm text-lychee-900/60">ยังไม่มีข้อมูล</p> : (
            <ol className="space-y-2.5">
              {top.map((t, i) => (
                <li key={`${t.topic_tag}-${t.mode}-${t.channel}`}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate"><b>{i + 1}.</b> {t.topic_tag} <span className="text-xs text-lychee-900/50">· {t.channel} · {t.mode === 'TUTOR' ? 'ติวเตอร์' : 'ข้อมูลโรงเรียน'}</span></span>
                    <span className="font-semibold text-lychee-700">{t.total_questions}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-lychee-50">
                    <div className="h-full rounded-full bg-gradient-to-r from-lychee-400 to-lychee-600" style={{ width: `${(Number(t.total_questions) / maxTop) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <Stat title="ตามช่องทาง" data={byChannel} demo={demo} />
          <Stat title="ตามโหมด" data={byMode} demo={demo} />
          <Stat title="ตามผู้ถาม" data={byRole} demo={demo} />
          <p className="text-xs text-lychee-900/60">{demo ? '' : `รวม ${rows.length} รายการใน ${days} วัน (แสดงสูงสุด 500)`}</p>
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="mr-auto font-medium">รายงานสรุปผู้บริหารโดย Gemini</h3>
          <button className="btn btn-primary" onClick={() => void summarize()} disabled={sumLoading}>
            {sumLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} สร้างรายงาน
          </button>
        </div>
        {summary ? <div className="whitespace-pre-wrap rounded-2xl bg-lychee-50 p-4 text-sm leading-relaxed">{summary}</div> : <p className="text-sm text-lychee-900/60">กดปุ่มเพื่อให้ AI สรุปแนวโน้มคำถามและข้อเสนอแนะ</p>}
      </section>

      {!demo && (
        <section className="card overflow-x-auto p-5">
          <h3 className="mb-3 font-medium">คำถามล่าสุด</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-lychee-900/60">
              <tr><th className="py-1 pr-3">เวลา</th><th className="pr-3">ช่องทาง</th><th className="pr-3">หมวด</th><th>คำถาม</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-t border-lychee-50 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 text-xs">{new Date(r.created_at).toLocaleString('th-TH')}</td>
                  <td className="pr-3 text-xs">{r.channel}</td>
                  <td className="pr-3 text-xs">{r.topic_tag}</td>
                  <td>{r.question}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function count<T>(rows: T[], key: (r: T) => string): [string, number][] {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Stat({ title, data, demo }: { title: string; data: [string, number][]; demo: boolean }) {
  const list = demo ? ([['LINE', 53], ['WEB', 42], ['KIOSK_VOICE', 31]] as [string, number][]).slice(0, title === 'ตามช่องทาง' ? 3 : 2) : data;
  const total = list.reduce((s, [, n]) => s + n, 0) || 1;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-medium">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {list.length === 0 && <span className="text-xs text-lychee-900/60">ไม่มีข้อมูล</span>}
        {list.map(([k, n]) => (
          <span key={k} className="rounded-full bg-lychee-50 px-3 py-1 text-xs text-lychee-700">
            {k} <b>{n}</b> ({Math.round((n / total) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
