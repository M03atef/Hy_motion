import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring, Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Cairo';

const { fontFamily } = loadFont('normal', { weights: ['400', '600', '700', '800', '900'], subsets: ['arabic', 'latin'] });

export const FPS = 30;
const LIME = '#8BE01E';
const LIME_DIM = 'rgba(139,224,30,0.18)';
const BG = '#070907';

// Voice line lengths (seconds) after silence trimming.
const VOICE = [4.96, 4.13, 7.43, 11.33, 7.25, 5.21, 7.84, 7.14, 8.08, 8.75, 4.34];
const LEAD = 6;   // frames before the voice starts in each scene
const TAIL = 12;  // frames after the voice ends
const EXTRA = { 5: 20, 10: 75 }; // scene index -> extra frames (POS clip, CTA hold)
const DURS = VOICE.map((s, i) => Math.ceil(s * FPS) + LEAD + TAIL + (EXTRA[i] || 0));
const STARTS = DURS.reduce((a, d, i) => (a.push(i ? a[i - 1] + DURS[i - 1] : 0), a), []);
export const TOTAL_FRAMES = DURS.reduce((a, b) => a + b, 0);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
const ease = Easing.bezier(0.45, 0, 0.2, 1);

/* ---------- building blocks ---------- */

const Background = () => {
  const f = useCurrentFrame();
  const gx = 50 + Math.sin(f / 70) * 18;
  const gy = 30 + Math.cos(f / 90) * 10;
  return (
    <AbsoluteFill style={{ background: BG }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 700px at ${gx}% ${gy}%, rgba(139,224,30,0.16), transparent 70%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(700px 600px at 80% 95%, rgba(139,224,30,0.08), transparent 70%)' }} />
      <AbsoluteFill style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        backgroundPosition: `0 ${(f * 0.6) % 72}px`,
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }} />
    </AbsoluteFill>
  );
};

const Mark = ({ size = 120, color = LIME }) => (
  <div style={{
    width: size, height: size, background: color,
    WebkitMaskImage: `url(${staticFile('hymotion-mark.png')})`, WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
  }} />
);

const Logo = ({ width = 520 }) => (
  <Img src={staticFile('hymotion-logo.png')} style={{ width, filter: 'invert(1)' }} />
);

// Words spring in one after another.
const Headline = ({ lines, delay = 0, size = 92, color = '#fff', accent = [], top = 210 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  let idx = 0;
  return (
    <div style={{ position: 'absolute', top, left: 50, right: 50, textAlign: 'center', direction: 'rtl' }}>
      {lines.map((line, li) => (
        <div key={li} style={{ fontSize: size, fontWeight: 900, lineHeight: 1.25, color }}>
          {line.split(' ').map((w, wi) => {
            const i = idx++;
            const s = spring({ frame: f - delay - i * 3, fps, config: { damping: 14, stiffness: 140 } });
            const hl = accent.includes(w);
            return (
              <span key={wi} style={{
                display: 'inline-block', margin: '0 10px', opacity: s,
                transform: `translateY(${(1 - s) * 50}px) scale(${0.8 + s * 0.2})`,
                color: hl ? LIME : undefined,
                textShadow: hl ? '0 0 40px rgba(139,224,30,0.45)' : '0 6px 30px rgba(0,0,0,0.6)',
              }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const Panel = ({ children, w, h, top, delay = 0, glow = true }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 16, stiffness: 110 } });
  return (
    <div style={{
      position: 'absolute', top, left: (1080 - w) / 2, width: w, height: h,
      borderRadius: 34, overflow: 'hidden', background: '#111',
      border: '2px solid rgba(139,224,30,0.35)',
      boxShadow: glow ? '0 40px 120px rgba(0,0,0,0.7), 0 0 80px rgba(139,224,30,0.18)' : '0 30px 80px rgba(0,0,0,0.6)',
      opacity: s, transform: `translateY(${(1 - s) * 120}px) scale(${0.92 + s * 0.08})`,
    }}>{children}</div>
  );
};

// Animated crop over a 2880x1800 screenshot. from/to = { x, y, zw } as fractions of the image.
const Shot = ({ src, w, h, from, to, start = 0, dur = 90 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: ease });
  const x = from.x + (to.x - from.x) * p;
  const y = from.y + (to.y - from.y) * p;
  const zw = from.zw + (to.zw - from.zw) * p;
  const s = w / (zw * 2880);
  return (
    <div style={{ width: w, height: h, overflow: 'hidden', position: 'relative', background: '#0d0f0c' }}>
      <Img src={staticFile('shots/' + src)} style={{
        position: 'absolute', width: 2880 * s, height: 1800 * s,
        transform: `translate(${-x * 2880 * s}px, ${-y * 1800 * s}px)`,
      }} />
    </div>
  );
};

const Chip = ({ label, at, top, left, right, size = 40, solid = false }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <div style={{
      position: 'absolute', top, left, right, direction: 'rtl',
      padding: '16px 34px', borderRadius: 999, fontSize: size, fontWeight: 800,
      background: solid ? LIME : 'rgba(18,22,15,0.92)', color: solid ? '#0a0d06' : '#fff',
      border: `2px solid ${solid ? LIME : 'rgba(139,224,30,0.55)'}`,
      boxShadow: '0 16px 50px rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: 16,
      opacity: s, transform: `scale(${0.6 + s * 0.4})`, whiteSpace: 'nowrap',
    }}>
      {!solid && <span style={{
        width: 44, height: 44, borderRadius: 22, background: LIME, color: '#0a0d06',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900,
      }}>✓</span>}
      {label}
    </div>
  );
};

const Stat = ({ label, value, prefix = '', at, top, left, w = 300 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 140 } });
  const n = Math.round(interpolate(f, [at, at + 30], [0, value], { ...clamp, easing: Easing.out(Easing.cubic) }));
  return (
    <div style={{
      position: 'absolute', top, left, width: w, padding: '22px 24px', borderRadius: 26,
      background: 'rgba(14,17,12,0.95)', border: '2px solid rgba(139,224,30,0.45)', direction: 'rtl',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)', opacity: s, transform: `translateY(${(1 - s) * 60}px)`,
    }}>
      <div style={{ fontSize: 28, color: '#b9c2b0', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 46, fontWeight: 900, color: LIME, direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {prefix}{n.toLocaleString('en-US')}
      </div>
    </div>
  );
};

const SceneWrap = ({ children, dur }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, dur - 6, dur], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: o, fontFamily }}>{children}</AbsoluteFill>;
};

const Voice = ({ n }) => (
  <Sequence from={LEAD}><Audio src={staticFile(`voice/v${n}.wav`)} volume={1} /></Sequence>
);

const TopBrand = () => (
  <div style={{ position: 'absolute', top: 70, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.9 }}>
    <Logo width={250} />
  </div>
);

/* ---------- scenes ---------- */

const S1Hook = ({ dur }) => {
  const f = useCurrentFrame();
  const strike = interpolate(f, [55, 72], [0, 1], clamp);
  const shake = f > 50 && f < 80 ? Math.sin(f * 2.2) * 6 : 0;
  const second = interpolate(f, [80, 92], [0, 1], clamp);
  return (
    <SceneWrap dur={dur}>
      <Headline lines={['لسه بتدير جيمك']} top={330} size={100} />
      <div style={{ position: 'absolute', top: 560, left: 0, right: 0, textAlign: 'center', transform: `translateX(${shake}px)` }}>
        <div style={{
          display: 'inline-block', position: 'relative', fontSize: 120, fontWeight: 900, color: '#ff5a4f', direction: 'rtl',
          opacity: interpolate(f, [10, 22], [0, 1], clamp), transform: `scale(${interpolate(f, [10, 24], [1.4, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })})`,
        }}>
          بالدفتر والإكسيل؟
          <div style={{ position: 'absolute', top: '55%', right: -10, height: 14, borderRadius: 7, background: '#fff', width: `calc(${strike * 100}% + 20px)`, boxShadow: '0 0 30px rgba(255,255,255,0.6)' }} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 860, left: 0, right: 0, textAlign: 'center', fontSize: 210, transform: `rotate(${shake * 1.5}deg)` }}>📒🧮</div>
      <div style={{ position: 'absolute', top: 1220, left: 60, right: 60, textAlign: 'center', direction: 'rtl', opacity: second, transform: `translateY(${(1 - second) * 40}px)` }}>
        <div style={{ fontSize: 76, fontWeight: 800, color: '#fff' }}>وآخر الشهر…</div>
        <div style={{ fontSize: 86, fontWeight: 900, color: '#ff5a4f' }}>الحسابات مش راكبة 😩</div>
      </div>
      <Voice n={1} />
    </SceneWrap>
  );
};

const S2Intro = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 11, stiffness: 120 } });
  const ring = interpolate(f, [0, 40], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const logo = spring({ frame: f - 18, fps, config: { damping: 16 } });
  return (
    <SceneWrap dur={dur}>
      <div style={{ position: 'absolute', top: 470, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 340, height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: -ring * 120, borderRadius: '50%', border: `4px solid rgba(139,224,30,${0.6 * (1 - ring)})` }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,224,30,0.35), transparent 70%)', opacity: s }} />
          <div style={{ transform: `scale(${s}) rotate(${(1 - s) * -30}deg)` }}><Mark size={260} /></div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 880, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: logo, transform: `translateY(${(1 - logo) * 40}px)` }}>
        <Logo width={640} />
      </div>
      <Headline lines={['سيستم بيدير الجيم كله', 'من مكان واحد']} top={1090} size={78} delay={30} accent={['كله', 'واحد']} />
      <Voice n={2} />
    </SceneWrap>
  );
};

const S3Dashboard = ({ dur }) => (
  <SceneWrap dur={dur}>
    <TopBrand />
    <Headline lines={['كل أرقام جيمك', 'لايف قدامك']} top={170} size={86} accent={['لايف']} />
    <Panel w={980} h={780} top={460} delay={4}>
      <Shot src="dash.png" w={980} h={780} from={{ x: 0.0, y: 0.05, zw: 0.84 }} to={{ x: 0.33, y: 0.27, zw: 0.5 }} start={8} dur={120} />
    </Panel>
    <Stat label="إيراد النهارده" value={8135} prefix="EGP " at={40} top={1280} left={60} w={310} />
    <Stat label="حضور النهارده" value={19} at={70} top={1280} left={385} w={310} />
    <Stat label="صافي الربح" value={11630} prefix="EGP " at={100} top={1280} left={710} w={310} />
    <Chip label="بيتحدّث لحظة بلحظة" at={130} top={1530} left={250} size={42} solid />
    <Voice n={3} />
  </SceneWrap>
);

const S4Members = ({ dur }) => {
  const f = useCurrentFrame();
  const swap = interpolate(f, [150, 168], [0, 1], clamp);
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['عضو جديد + اشتراك', 'في أقل من دقيقة']} top={170} size={84} accent={['دقيقة']} />
      <Panel w={980} h={860} top={480} delay={4}>
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap }}>
          <Shot src="members.png" w={980} h={860} from={{ x: 0.0, y: 0.0, zw: 0.84 }} to={{ x: 0.1, y: 0.05, zw: 0.7 }} start={0} dur={150} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: swap }}>
          <Shot src="member.png" w={980} h={860} from={{ x: 0.14, y: 0.04, zw: 0.7 }} to={{ x: 0.3, y: 0.1, zw: 0.52 }} start={150} dur={170} />
        </div>
      </Panel>
      <Chip label="شهري" at={150} top={1390} right={80} />
      <Chip label="باكدج حصص" at={175} top={1390} left={80} />
      <Chip label="مواعيد محددة" at={200} top={1510} right={80} />
      <Chip label="تجميد وتجديد" at={225} top={1510} left={80} />
      <Chip label="🔔 السيستم بيفكّرك بالقسط" at={265} top={1660} left={170} solid size={44} />
      <Voice n={4} />
    </SceneWrap>
  );
};

const S5Card = ({ dur }) => {
  const f = useCurrentFrame();
  const swap = interpolate(f, [150, 165], [0, 1], clamp);
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['كارنيه بباركود…', 'ودخول في ثانية']} top={170} size={86} accent={['ثانية']} />
      <Panel w={1000} h={760} top={500} delay={4}>
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap }}>
          <OffthreadVideo src={staticFile('clips/card.mp4')} startFrom={6} muted style={{ width: 1000, height: 760, objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: swap }}>
          <Shot src="attendance.png" w={1000} h={760} from={{ x: 0.15, y: 0.05, zw: 0.68 }} to={{ x: 0.3, y: 0.37, zw: 0.52 }} start={150} dur={80} />
        </div>
      </Panel>
      <Chip label="يتطبع من السيستم" at={40} top={1330} right={90} />
      <Chip label="يتمسح على الباب" at={90} top={1450} left={90} />
      <Chip label="✓ بس لو اشتراكه ساري" at={170} top={1600} left={220} solid size={46} />
      <Voice n={5} />
    </SceneWrap>
  );
};

const S6Pos = ({ dur }) => {
  const f = useCurrentFrame();
  const swap = interpolate(f, [55, 68], [0, 1], clamp);
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['مياه؟ بروتين؟', 'دوسة… والفاتورة مطبوعة']} top={170} size={78} accent={['دوسة…', 'مطبوعة']} />
      <Panel w={1000} h={800} top={480} delay={2}>
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap }}>
          <Shot src="pos.png" w={1000} h={800} from={{ x: 0.02, y: 0.12, zw: 0.62 }} to={{ x: 0.05, y: 0.25, zw: 0.5 }} start={0} dur={70} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: swap }}>
          <Sequence from={55}>
            <OffthreadVideo src={staticFile('clips/receipt.mp4')} startFrom={105} muted style={{ width: 1000, height: 800, objectFit: 'cover' }} />
          </Sequence>
        </div>
      </Panel>
      <Chip label="🧾 فاتورة فورية" at={80} top={1340} left={300} solid size={46} />
      <Voice n={6} />
    </SceneWrap>
  );
};

const S7Brand = ({ dur }) => {
  const f = useCurrentFrame();
  const colors = [LIME, '#38bdf8', '#f97316', '#e11d48', LIME];
  const ci = Math.min(colors.length - 1, Math.max(0, Math.floor((f - 120) / 22)));
  const c = f < 120 ? LIME : colors[ci];
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['السيستم بشكل جيمك انت']} top={190} size={80} accent={['جيمك']} />
      <Panel w={980} h={560} top={330} delay={4}>
        <Shot src="settings2.png" w={980} h={560} from={{ x: 0.0, y: 0.2, zw: 0.82 }} to={{ x: 0.0, y: 0.33, zw: 0.78 }} start={10} dur={110} />
      </Panel>
      {/* membership card mock-up with the gym's own colors */}
      <div style={{
        position: 'absolute', top: 1000, left: 190, width: 700, height: 420, borderRadius: 34, direction: 'rtl',
        background: `linear-gradient(135deg, ${c}, #0d1209 75%)`, border: `3px solid ${c}`,
        boxShadow: `0 30px 90px rgba(0,0,0,0.7), 0 0 70px ${c}55`,
        opacity: interpolate(f, [60, 80], [0, 1], clamp),
        transform: `rotate(${interpolate(f, [60, 90], [-8, -3], clamp)}deg) translateY(${interpolate(f, [60, 85], [80, 0], clamp)}px)`,
        padding: 40, color: '#fff', fontWeight: 800,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 900 }}>لوجو جيمك</div>
          <div style={{ width: 90, height: 90, borderRadius: 20, background: 'rgba(255,255,255,0.18)', border: '2px dashed rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>LOGO</div>
        </div>
        <div style={{ fontSize: 50, marginTop: 50 }}>أحمد حسن</div>
        <div style={{ fontSize: 30, opacity: 0.85, direction: 'ltr', textAlign: 'right' }}>GYM-001</div>
        <div style={{ marginTop: 26, height: 70, background: 'repeating-linear-gradient(90deg, #fff 0 6px, transparent 6px 10px, #fff 10px 13px, transparent 13px 20px)', borderRadius: 6, opacity: 0.95 }} />
      </div>
      <Chip label="اللوجو بتاعك" at={100} top={1530} right={110} />
      <Chip label="ألوانك" at={125} top={1530} left={110} />
      <Chip label="على كارنيه كل عضو" at={150} top={1660} left={260} solid size={42} />
      <Voice n={7} />
    </SceneWrap>
  );
};

const S8Shifts = ({ dur }) => (
  <SceneWrap dur={dur}>
    <TopBrand />
    <Headline lines={['مفيش جنيه ناقص', 'من الدرج تاني']} top={170} size={88} accent={['جنيه']} />
    <Panel w={980} h={880} top={480} delay={4}>
      <Shot src="shifts.png" w={980} h={880} from={{ x: 0.0, y: 0.05, zw: 0.82 }} to={{ x: 0.3, y: 0.2, zw: 0.52 }} start={8} dur={150} />
    </Panel>
    <Chip label="🔓 كل موظف يفتح ورديته" at={40} top={1410} right={80} />
    <Chip label="🔒 يقفل بعدّ الفلوس" at={85} top={1530} left={80} />
    <Chip label="تقرير Z لكل وردية" at={130} top={1670} left={250} solid size={46} />
    <Voice n={8} />
  </SceneWrap>
);

const S9Roles = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: f - 6, fps, config: { damping: 15 } });
  const b = spring({ frame: f - 70, fps, config: { damping: 15 } });
  const card = (src, label, sub, s, left, highlight) => (
    <div style={{ position: 'absolute', top: 470, left, width: 470, opacity: s, transform: `translateY(${(1 - s) * 100}px)` }}>
      <div style={{ borderRadius: 30, overflow: 'hidden', border: `3px solid ${highlight}`, boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 50px ${highlight}44` }}>
        <Shot src={src} w={470} h={900} from={{ x: 0.835, y: 0.0, zw: 0.165 }} to={{ x: 0.835, y: 0.49, zw: 0.165 }} start={40} dur={170} />
      </div>
      <div style={{ marginTop: 26, textAlign: 'center', direction: 'rtl' }}>
        <div style={{ fontSize: 54, fontWeight: 900, color: highlight }}>{label}</div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#d6dccf' }}>{sub}</div>
      </div>
    </div>
  );
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['كل موظف شايف', 'شغله بس']} top={170} size={88} accent={['شغله', 'بس']} />
      {card('dash.png', 'المالك 👑', 'شايف كل حاجة', a, 570, LIME)}
      {card('rec_dash.png', 'الاستقبال', 'شغل الديسك بس', b, 40, '#38bdf8')}
      <Chip label="مدير · استقبال · مدرب · وصلاحيات تحددها انت" at={150} top={1720} left={60} size={36} solid />
      <Voice n={9} />
    </SceneWrap>
  );
};

const S10More = ({ dur }) => {
  const items = [
    { src: 'reports.png', label: '📊 تقارير', at: 4, from: { x: 0.02, y: 0.14, zw: 0.5 } },
    { src: 'payroll.png', label: '💼 مرتبات الموظفين', at: 50, from: { x: 0.3, y: 0.05, zw: 0.5 } },
    { src: 'products.png', label: '📦 المخزون', at: 95, from: { x: 0.02, y: 0.1, zw: 0.5 } },
    { src: 'backup.png', label: '🛡️ باك أب كل ليلة', at: 140, from: { x: 0.3, y: 0.05, zw: 0.5 } },
  ];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const off = spring({ frame: f - 200, fps, config: { damping: 12 } });
  return (
    <SceneWrap dur={dur}>
      <TopBrand />
      <Headline lines={['وكمان…']} top={180} size={90} accent={['وكمان…']} />
      {items.map((it, i) => {
        const s = spring({ frame: f - it.at, fps, config: { damping: 14, stiffness: 130 } });
        const col = i % 2, row = Math.floor(i / 2);
        return (
          <div key={i} style={{ position: 'absolute', top: 360 + row * 560, left: col ? 60 : 560, width: 460, opacity: s, transform: `scale(${0.7 + 0.3 * s})` }}>
            <div style={{ borderRadius: 26, overflow: 'hidden', border: '2px solid rgba(139,224,30,0.45)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
              <Shot src={it.src} w={460} h={400} from={it.from} to={{ ...it.from, y: it.from.y + 0.04, zw: it.from.zw * 0.9 }} start={it.at} dur={120} />
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 40, fontWeight: 900, color: '#fff', direction: 'rtl' }}>{it.label}</div>
          </div>
        );
      })}
      <div style={{
        position: 'absolute', top: 1520, left: 140, right: 140, padding: '30px 0', borderRadius: 999, textAlign: 'center',
        background: LIME, color: '#0a0d06', fontSize: 58, fontWeight: 900, direction: 'rtl',
        opacity: off, transform: `scale(${0.6 + 0.4 * off})`, boxShadow: '0 0 80px rgba(139,224,30,0.5)',
      }}>📶 كله من غير إنترنت</div>
      <Voice n={10} />
    </SceneWrap>
  );
};

const S11Cta = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = spring({ frame: f, fps, config: { damping: 12 } });
  const t = spring({ frame: f - 40, fps, config: { damping: 14 } });
  const ph = spring({ frame: f - 75, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(f / 6) * 0.025 * (f > 90 ? 1 : 0);
  return (
    <SceneWrap dur={dur}>
      <div style={{ position: 'absolute', top: 260, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${m})` }}>
        <Mark size={200} />
      </div>
      <div style={{ position: 'absolute', top: 500, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: m }}>
        <Logo width={560} />
      </div>
      <Headline lines={['جيمك تحت إيدك']} top={690} size={104} accent={['إيدك']} delay={8} />
      <div style={{
        position: 'absolute', top: 920, left: 150, right: 150, padding: '34px 0', borderRadius: 30, textAlign: 'center', direction: 'rtl',
        border: `4px solid ${LIME}`, color: '#fff', fontSize: 62, fontWeight: 900, background: 'rgba(139,224,30,0.1)',
        opacity: t, transform: `translateY(${(1 - t) * 50}px)`,
      }}>🎁 تجربة مجانية <span style={{ color: LIME }}>15 يوم</span></div>
      <div style={{ position: 'absolute', top: 1170, left: 0, right: 0, textAlign: 'center', opacity: ph, transform: `scale(${(0.7 + 0.3 * ph) * pulse})` }}>
        <div style={{ fontSize: 46, fontWeight: 800, color: '#d6dccf', direction: 'rtl' }}>ابعتلنا واتساب أو كلّمنا</div>
        <div style={{
          display: 'inline-block', marginTop: 24, padding: '26px 60px', borderRadius: 999, background: LIME,
          color: '#0a0d06', fontSize: 92, fontWeight: 900, letterSpacing: 4, boxShadow: '0 0 90px rgba(139,224,30,0.55)',
        }}>01070386575</div>
      </div>
      <Voice n={11} />
    </SceneWrap>
  );
};

const SCENES = [S1Hook, S2Intro, S3Dashboard, S4Members, S5Card, S6Pos, S7Brand, S8Shifts, S9Roles, S10More, S11Cta];

const Progress = () => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: 'rgba(255,255,255,0.08)' }}>
      <div style={{ height: '100%', width: `${(f / TOTAL_FRAMES) * 100}%`, background: LIME, boxShadow: `0 0 20px ${LIME}`, marginLeft: 'auto' }} />
    </div>
  );
};

export const Promo = () => (
  <AbsoluteFill style={{ fontFamily, background: BG }}>
    <Background />
    {SCENES.map((Scene, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={DURS[i]}>
        <Scene dur={DURS[i]} />
      </Sequence>
    ))}
    <Progress />
  </AbsoluteFill>
);
