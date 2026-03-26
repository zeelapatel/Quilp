import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const A = "#E8F94A";

// ── useInView ─────────────────────────────────────────────────────────────────
function useInView(threshold = 0.18): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      es => { if (es[0]?.isIntersecting) { setV(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, v];
}

// ── Reveal ────────────────────────────────────────────────────────────────────
function Reveal({
  children, delay = 0, y = 28, className = "",
}: {
  children: React.ReactNode; delay?: number; y?: number; className?: string;
}) {
  const [ref, v] = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: v ? 1 : 0,
      transform: v ? "translateY(0)" : `translateY(${y}px)`,
      transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms,
                   transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ── Waveform ──────────────────────────────────────────────────────────────────
const BARS = [28, 58, 42, 88, 52, 74, 36, 96, 62, 80, 30, 68, 44, 90, 56, 72];
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 48 }}>
      {BARS.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2, background: A,
          opacity: 0.35 + (h / 100) * 0.65,
          height: active ? `${h}%` : "12%",
          transition: `height ${0.25 + (i % 5) * 0.08}s cubic-bezier(0.22,1,0.36,1) ${active ? i * 35 : 0}ms`,
        }} />
      ))}
    </div>
  );
}

// ── AnimCheck ─────────────────────────────────────────────────────────────────
function AnimCheck({ active }: { active: boolean }) {
  return (
    <svg width={52} height={52} viewBox="0 0 52 52" fill="none">
      <circle cx={26} cy={26} r={22} stroke={A} strokeWidth={1.5}
        strokeDasharray={138} strokeDashoffset={active ? 0 : 138}
        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s" }} />
      <polyline points="14,26 22,35 38,18" stroke={A} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={34} strokeDashoffset={active ? 0 : 34}
        style={{ transition: "stroke-dashoffset 0.4s ease 0.9s" }} />
    </svg>
  );
}

// ── RisingBars ────────────────────────────────────────────────────────────────
function RisingBars({ active }: { active: boolean }) {
  const hs = [22, 38, 30, 50, 44, 62, 55, 78, 70, 94];
  return (
    <div className="flex items-end gap-1.5" style={{ height: 48 }}>
      {hs.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{
          height: active ? `${h}%` : "5%",
          background: i === hs.length - 1 ? A : "#252525",
          transition: `height 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
        }} />
      ))}
    </div>
  );
}

// ── Neon glow filter helper (unique id per instance) ─────────────────────────
function GlowFilter({ id, stdDeviation = 5 }: { id: string; stdDeviation?: number }) {
  return (
    <filter id={id} x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation={stdDeviation} result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// ── Character 1 — "Maya" seated at laptop · Cyan ──────────────────────────────
function CharMaya() {
  const C = "#00D4FF";
  const dark = "#060A0D";
  return (
    <svg viewBox="0 0 240 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs><GlowFilter id="g1" stdDeviation={4} /></defs>

      {/* floating notification — animate */}
      <g style={{ animation: "pfloat1 3.4s ease-in-out infinite" }}>
        <rect x="148" y="14" width="76" height="36" rx="8" fill={dark} stroke={C} strokeWidth="1.5" strokeOpacity="0.7" />
        <circle cx="161" cy="32" r="6" fill={C} fillOpacity="0.15" stroke={C} strokeWidth="1.2" />
        <line x1="173" y1="27" x2="216" y2="27" stroke={C} strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1="173" y1="37" x2="207" y2="37" stroke={C} strokeWidth="1.2" strokeOpacity="0.35" />
        <line x1="145" y1="38" x2="152" y2="48" stroke={C} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.5" />
      </g>

      {/* decorative dots */}
      <circle cx="22" cy="68" r="3.5" fill={C} fillOpacity="0.5" filter="url(#g1)" />
      <circle cx="34" cy="50" r="2" fill={C} fillOpacity="0.3" />
      <circle cx="14" cy="44" r="2.5" fill={C} fillOpacity="0.2" />

      <g filter="url(#g1)" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* desk */}
        <rect x="10" y="214" width="210" height="9" rx="4.5" fill="#0A1419" />

        {/* laptop screen */}
        <rect x="100" y="154" width="104" height="62" rx="5" fill="#070E12" />
        <line x1="111" y1="168" x2="192" y2="168" stroke={C} strokeWidth="1.4" strokeOpacity="0.45" />
        <line x1="111" y1="179" x2="180" y2="179" stroke={C} strokeWidth="1.4" strokeOpacity="0.45" />
        <line x1="111" y1="190" x2="186" y2="190" stroke={C} strokeWidth="1.4" strokeOpacity="0.45" />
        {/* laptop base */}
        <path d="M92 213 L208 213 L214 222 L86 222 Z" fill="#0A1419" />

        {/* person body */}
        {/* torso */}
        <path d="M56 105 C56 98 72 93 102 93 C132 93 148 98 148 105 L148 205 Q102 212 56 205 Z" fill="#080B0E" />
        {/* neck */}
        <rect x="94" y="88" width="16" height="15" rx="6" fill="#080B0E" />
        {/* head */}
        <circle cx="102" cy="57" r="32" fill="#080B0E" />
        {/* hair */}
        <path d="M70 44 C72 18 132 18 134 44" fill="#0F1A20" stroke={C} strokeWidth="2.2" />
        {/* bun */}
        <circle cx="102" cy="24" r="10" fill="#0F1A20" stroke={C} strokeWidth="2.2" />
        {/* eyes */}
        <ellipse cx="90" cy="56" rx="4.5" ry="5" fill={C} />
        <ellipse cx="114" cy="56" rx="4.5" ry="5" fill={C} />
        <circle cx="91" cy="57" r="2.2" fill="#080B0E" />
        <circle cx="115" cy="57" r="2.2" fill="#080B0E" />
        {/* eyebrows */}
        <path d="M85 47 Q90 44 95 47" strokeWidth="1.8" />
        <path d="M109 47 Q114 44 119 47" strokeWidth="1.8" />
        {/* smile */}
        <path d="M93 70 Q102 77 111 70" strokeWidth="2" />

        {/* left arm — elbow on desk */}
        <path d="M62 113 Q32 148 28 206" strokeWidth="18" stroke="#080B0E" strokeLinecap="round" />
        <path d="M62 113 Q32 148 28 206" />
        <ellipse cx="27" cy="209" rx="14" ry="9" fill="#080B0E" />
        <ellipse cx="27" cy="209" rx="14" ry="9" />

        {/* right arm — to laptop */}
        <path d="M144 113 Q172 155 172 205" strokeWidth="18" stroke="#080B0E" strokeLinecap="round" />
        <path d="M144 113 Q172 155 172 205" />
        <ellipse cx="172" cy="208" rx="13" ry="9" fill="#080B0E" />
        <ellipse cx="172" cy="208" rx="13" ry="9" />
      </g>
    </svg>
  );
}

// ── Character 2 — "James" standing with phone · Pink ─────────────────────────
function CharJames() {
  const C = "#FF3CAC";
  const dark = "#0D070A";
  return (
    <svg viewBox="0 0 240 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs><GlowFilter id="g2" stdDeviation={4} /></defs>

      {/* floating post card */}
      <g style={{ animation: "pfloat2 3.8s ease-in-out infinite" }}>
        <rect x="152" y="80" width="74" height="56" rx="8" fill={dark} stroke={C} strokeWidth="1.5" strokeOpacity="0.7" />
        <circle cx="164" cy="98" r="7" fill={C} fillOpacity="0.12" stroke={C} strokeWidth="1.2" />
        <line x1="177" y1="93" x2="218" y2="93" stroke={C} strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1="177" y1="102" x2="212" y2="102" stroke={C} strokeWidth="1.2" strokeOpacity="0.4" />
        <line x1="159" y1="116" x2="218" y2="116" stroke={C} strokeWidth="1.2" strokeOpacity="0.25" />
        <line x1="159" y1="124" x2="204" y2="124" stroke={C} strokeWidth="1.2" strokeOpacity="0.25" />
        <line x1="149" y1="107" x2="138" y2="118" stroke={C} strokeWidth="1" strokeDasharray="3 2" strokeOpacity="0.5" />
      </g>

      {/* rising metric */}
      <g style={{ animation: "pfloat1 4.2s ease-in-out infinite" }}>
        <text x="16" y="200" fontFamily="monospace" fontSize="10" fill={C} fillOpacity="0.7">↑ 3.2k</text>
      </g>

      {/* decorative dots */}
      <circle cx="210" cy="52" r="3" fill={C} fillOpacity="0.5" filter="url(#g2)" />
      <circle cx="220" cy="68" r="2" fill={C} fillOpacity="0.3" />
      <circle cx="18" cy="120" r="3" fill={C} fillOpacity="0.3" />
      <circle cx="26" cy="136" r="2" fill={C} fillOpacity="0.2" />

      <g filter="url(#g2)" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* phone in right hand */}
        <rect x="135" y="128" width="26" height="46" rx="5" fill="#0D070A" />
        <rect x="138" y="131" width="20" height="36" rx="3" fill="#120A0E" />
        <line x1="141" y1="137" x2="155" y2="137" stroke={C} strokeWidth="1" strokeOpacity="0.5" />
        <line x1="141" y1="143" x2="153" y2="143" stroke={C} strokeWidth="1" strokeOpacity="0.35" />

        {/* person body */}
        {/* torso */}
        <path d="M62 108 C62 101 78 96 105 96 C132 96 148 101 148 108 L144 222 Q105 228 66 222 Z" fill="#0D070A" />
        {/* neck */}
        <rect x="97" y="90" width="16" height="16" rx="6" fill="#0D070A" />
        {/* head */}
        <circle cx="105" cy="58" r="33" fill="#0D070A" />
        {/* hair */}
        <path d="M72 44 C73 14 137 14 138 44" fill="#160C12" stroke={C} strokeWidth="2.2" />
        {/* eyes */}
        <ellipse cx="93" cy="57" rx="4.5" ry="5" fill={C} />
        <ellipse cx="117" cy="57" rx="4.5" ry="5" fill={C} />
        <circle cx="94" cy="58" r="2.2" fill="#0D070A" />
        <circle cx="118" cy="58" r="2.2" fill="#0D070A" />
        {/* eyebrows */}
        <path d="M88 48 Q93 44 98 48" strokeWidth="1.8" />
        <path d="M112 48 Q117 44 122 48" strokeWidth="1.8" />
        {/* slight smirk */}
        <path d="M97 72 Q106 79 116 73" strokeWidth="2" />

        {/* left arm — relaxed at side */}
        <path d="M66 116 Q44 158 44 210" strokeWidth="18" stroke="#0D070A" strokeLinecap="round" />
        <path d="M66 116 Q44 158 44 210" />
        <ellipse cx="44" cy="213" rx="13" ry="9" fill="#0D070A" />
        <ellipse cx="44" cy="213" rx="13" ry="9" />

        {/* right arm — holding phone up */}
        <path d="M144 116 Q158 118 148 128" strokeWidth="18" stroke="#0D070A" strokeLinecap="round" />
        <path d="M144 116 Q158 118 148 128" />

        {/* legs */}
        <path d="M88 222 Q82 254 78 290" strokeWidth="18" stroke="#0D070A" strokeLinecap="round" />
        <path d="M88 222 Q82 254 78 290" />
        <line x1="64" y1="289" x2="88" y2="289" />

        <path d="M122 222 Q128 254 132 290" strokeWidth="18" stroke="#0D070A" strokeLinecap="round" />
        <path d="M122 222 Q128 254 132 290" />
        <line x1="118" y1="289" x2="142" y2="289" />
      </g>
    </svg>
  );
}

// ── Character 3 — "Alex" relaxed, done · Purple ───────────────────────────────
function CharAlex() {
  const C = "#9B5DE5";
  const dark = "#0A080F";
  return (
    <svg viewBox="0 0 240 300" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs><GlowFilter id="g3" stdDeviation={4} /></defs>

      {/* rising bar chart in bg */}
      <g style={{ animation: "pfloat3 4.6s ease-in-out infinite" }}>
        {[26, 44, 34, 60, 50, 76, 64].map((h, i) => (
          <rect key={i}
            x={24 + i * 14} y={180 - h} width={10} height={h}
            rx="2" fill={C} fillOpacity={0.12 + i * 0.03}
            stroke={C} strokeWidth="1" strokeOpacity="0.4"
          />
        ))}
        <line x1="20" y1="182" x2="126" y2="182" stroke={C} strokeWidth="1" strokeOpacity="0.3" />
      </g>

      {/* floating checkmark bubble */}
      <g style={{ animation: "pfloat2 3.2s ease-in-out infinite" }}>
        <circle cx="186" cy="54" r="24" fill={dark} stroke={C} strokeWidth="1.5" strokeOpacity="0.7" />
        <polyline points="174,54 182,64 198,44" stroke={C} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* decorative dots */}
      <circle cx="218" cy="105" r="3" fill={C} fillOpacity="0.5" filter="url(#g3)" />
      <circle cx="226" cy="88" r="2" fill={C} fillOpacity="0.3" />
      <circle cx="14" cy="220" r="3" fill={C} fillOpacity="0.4" />

      <g filter="url(#g3)" stroke={C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {/* person body */}
        {/* torso */}
        <path d="M68 108 C68 101 84 96 112 96 C140 96 156 101 156 108 L152 222 Q112 228 72 222 Z" fill={dark} />
        {/* neck */}
        <rect x="104" y="90" width="16" height="16" rx="6" fill={dark} />
        {/* head */}
        <circle cx="112" cy="57" r="34" fill={dark} />
        {/* hair — short, swept */}
        <path d="M78 42 C76 14 148 14 146 42" fill="#120E1A" stroke={C} strokeWidth="2.2" />
        {/* eyes */}
        <ellipse cx="100" cy="56" rx="4.5" ry="5" fill={C} />
        <ellipse cx="124" cy="56" rx="4.5" ry="5" fill={C} />
        <circle cx="101" cy="57" r="2.2" fill={dark} />
        <circle cx="125" cy="57" r="2.2" fill={dark} />
        {/* raised eyebrows — confident */}
        <path d="M94 45 Q100 41 106 45" strokeWidth="1.8" />
        <path d="M118 45 Q124 41 130 45" strokeWidth="1.8" />
        {/* wide smile */}
        <path d="M100 71 Q112 81 124 71" strokeWidth="2.2" />

        {/* left arm — raised, casual behind head */}
        <path d="M74 114 Q44 96 36 66" strokeWidth="18" stroke={dark} strokeLinecap="round" />
        <path d="M74 114 Q44 96 36 66" />
        <ellipse cx="34" cy="62" rx="10" ry="13" fill={dark} />
        <ellipse cx="34" cy="62" rx="10" ry="13" />

        {/* right arm — behind head other side */}
        <path d="M152 114 Q182 96 190 66" strokeWidth="18" stroke={dark} strokeLinecap="round" />
        <path d="M152 114 Q182 96 190 66" />
        <ellipse cx="192" cy="62" rx="10" ry="13" fill={dark} />
        <ellipse cx="192" cy="62" rx="10" ry="13" />

        {/* legs */}
        <path d="M96 222 Q90 256 86 292" strokeWidth="18" stroke={dark} strokeLinecap="round" />
        <path d="M96 222 Q90 256 86 292" />
        <line x1="72" y1="291" x2="96" y2="291" />

        <path d="M128 222 Q134 256 138 292" strokeWidth="18" stroke={dark} strokeLinecap="round" />
        <path d="M128 222 Q134 256 138 292" />
        <line x1="124" y1="291" x2="148" y2="291" />
      </g>
    </svg>
  );
}

// ── IllustrationsSection ───────────────────────────────────────────────────────
const PERSONAS = [
  {
    component: <CharMaya />,
    color: "#00D4FF",
    role: "Content Director",
    name: "Maya",
    line: "Connects Gmail on Monday. Posts go live Thursday. No extra steps.",
  },
  {
    component: <CharJames />,
    color: "#FF3CAC",
    role: "Sales Manager",
    name: "James",
    line: "Every Fathom recap becomes a post. His pipeline grows without touching LinkedIn.",
  },
  {
    component: <CharAlex />,
    color: "#9B5DE5",
    role: "Founder",
    name: "Alex",
    line: "Approved 47 posts last month from his inbox. Spent zero minutes writing them.",
  },
];

function IllustrationsSection() {
  const [ref, inView] = useInView(0.15);
  return (
    <section className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="mb-4 font-mono text-xs tracking-[0.22em] text-text-tertiary">WHO USES QUILP</p>
          <h2 className="mb-16 font-sans font-bold tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)" }}>
            Professionals who stopped writing posts manually.
          </h2>
        </Reveal>

        <div ref={ref} className="grid gap-6 md:grid-cols-3">
          {PERSONAS.map(({ component, color, role, name, line }, i) => (
            <div key={name}
              className="relative overflow-hidden rounded-xl border border-border bg-bg-secondary"
              style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(32px)",
                transition: `opacity 0.75s cubic-bezier(0.22,1,0.36,1) ${i * 110}ms,
                             transform 0.75s cubic-bezier(0.22,1,0.36,1) ${i * 110}ms`,
              }}
            >
              {/* glow in corner */}
              <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full"
                style={{ background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`, transform: "translate(30%, -30%)" }} />

              {/* illustration */}
              <div className="flex justify-center pt-8 pb-4 px-6" style={{ minHeight: 240 }}>
                <div style={{ width: 180 }}>
                  {component}
                </div>
              </div>

              {/* label */}
              <div className="border-t border-border px-6 py-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-sans text-base font-semibold text-text-primary">{name}</span>
                  <span className="font-mono text-xs" style={{ color }}>· {role}</span>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{line}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PipelineVisual ────────────────────────────────────────────────────────────
function PipelineVisual({ active }: { active: boolean }) {
  const enter = (side: "left" | "right"): React.CSSProperties => ({
    opacity: active ? 1 : 0,
    transform: active ? "translateX(0)" : `translateX(${side === "left" ? -20 : 20}px)`,
    transition: `opacity 0.7s ease ${side === "left" ? 0.2 : 0.45}s,
                 transform 0.7s cubic-bezier(0.22,1,0.36,1) ${side === "left" ? 0.2 : 0.45}s`,
  });

  const card = (children: React.ReactNode, side: "left" | "right") => (
    <div className="rounded-xl border bg-bg-secondary p-4"
      style={{ borderColor: "#242424", width: 210, ...enter(side) }}>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Email card */}
      {card(
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold"
              style={{ background: "#1a2a1a", color: A }}>F</div>
            <div>
              <div className="font-mono text-[11px] font-medium text-text-primary">Fathom AI</div>
              <div className="font-mono text-[9px] text-text-tertiary">noreply@fathom.video</div>
            </div>
          </div>
          <div className="mb-2.5 font-mono text-[10px] text-text-secondary">
            Meeting recap: Product strategy sync
          </div>
          <div className="space-y-1">
            {[100, 82, 91, 68].map((w, i) => (
              <div key={i} className="h-1 rounded-full" style={{ width: `${w}%`, background: "#252525" }} />
            ))}
          </div>
          <div className="mt-3 rounded px-2 py-1.5 font-mono text-[9px]"
            style={{ background: "#141414", border: "1px solid #202020", color: "#555" }}>
            confidence 94% · 847 words
          </div>
        </>,
        "left"
      )}

      {/* Connector */}
      <div className="relative flex items-center gap-2 pl-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{
          opacity: active ? 1 : 0, transition: "opacity 0.3s ease 0.6s",
        }}>
          <path d="M12 5v14M6 13l6 6 6-6" stroke={A} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={28} strokeDashoffset={active ? 0 : 28}
            style={{ transition: "stroke-dashoffset 0.4s ease 0.65s" }} />
        </svg>
        <div className="rounded border px-2.5 py-1 font-mono text-[10px] font-medium"
          style={{
            borderColor: "#2a2a2a", background: "#0d0d0d", color: A,
            opacity: active ? 1 : 0, transform: active ? "scale(1)" : "scale(0.9)",
            transition: "opacity 0.3s ease 0.7s, transform 0.3s ease 0.7s",
          }}>
          claude · generating
        </div>
      </div>

      {/* Post card */}
      {card(
        <>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-bg-tertiary shrink-0" />
            <div>
              <div className="font-mono text-[11px] font-medium text-text-primary">Sarah Chen</div>
              <div className="font-mono text-[9px] text-text-tertiary">Product Director</div>
            </div>
          </div>
          <div className="space-y-1 mb-2.5">
            {[100, 94, 85, 100, 78].map((w, i) => (
              <div key={i} className="h-1 rounded-full"
                style={{ width: `${w}%`, background: i < 2 ? "#2a2a2a" : "#1e1e1e" }} />
            ))}
          </div>
          <div className="flex items-center gap-2.5 font-mono text-[9px]">
            <span style={{ color: A }}>LinkedIn</span>
            <span className="text-text-tertiary">Thu 9:00 AM</span>
          </div>
        </>,
        "right"
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function LandingPage() {
  const { session } = useAuth();
  const [scrollY, setScrollY]   = useState(0);
  const [heroReady, setHeroReady] = useState(false);

  const [voiceRef, voiceInView]         = useInView(0.25);
  const [approvalRef, approvalInView]   = useInView(0.25);
  const [analyticsRef, analyticsInView] = useInView(0.25);
  const [quoteRef, quoteInView]         = useInView(0.3);
  const [ctaRef, ctaInView]             = useInView(0.25);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  const ease = "cubic-bezier(0.22,1,0.36,1)";

  // Clip-up reveal for each hero line (no text-center)
  const heroLine = (content: React.ReactNode, delay: number, accent = false) => (
    <div style={{ overflow: "hidden", lineHeight: 1.04 }}>
      <div style={{
        transform: heroReady ? "translateY(0)" : "translateY(108%)",
        opacity: heroReady ? 1 : 0,
        transition: `transform 0.9s ${ease} ${delay}ms, opacity 0.9s ease ${delay}ms`,
        ...(accent ? { color: A } : {}),
      }}>
        {content}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary font-sans text-text-primary" style={{ overflowX: "hidden" }}>
      <style>{`
        @keyframes dashMove  { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -32; } }
        @keyframes pfloat1 { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-7px); } }
        @keyframes pfloat2 { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-9px); } }
        @keyframes pfloat3 { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
      `}</style>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full transition-all duration-500" style={{
        background: scrollY > 56 ? "rgba(10,10,10,0.88)" : "transparent",
        borderBottom: scrollY > 56 ? "1px solid #1c1c1c" : "1px solid transparent",
        backdropFilter: scrollY > 56 ? "blur(24px) saturate(160%)" : "none",
      }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-1.5 font-mono text-xl font-bold text-text-primary tracking-[-0.02em]">
            quilp<span className="h-2 w-2 rounded-full" style={{ background: A }} />
          </Link>
          <div className="flex items-center gap-1">
            {session ? (
              <Link to="/dashboard"
                className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{ background: A, color: "#0A0A0A" }}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login"
                  className="px-4 py-2 font-mono text-sm text-text-secondary transition-colors hover:text-text-primary">
                  Sign in
                </Link>
                <Link to="/signup"
                  className="rounded-lg px-5 py-2.5 font-mono text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                  style={{ background: A, color: "#0A0A0A" }}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero — split: text LEFT · visual RIGHT ─────────────────────── */}
      <section
        className="relative min-h-screen px-6"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 10% 50%, rgba(232,249,74,0.045) 0%, transparent 60%)",
        }}
      >
        <div className="mx-auto grid max-w-6xl min-h-screen grid-cols-1 items-center gap-12 lg:grid-cols-2">

          {/* ── Left: copy ── */}
          <div className="pt-28 pb-16 lg:py-0">
            {/* Eyebrow */}
            <div className="mb-8" style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.6s ease, transform 0.6s ease",
            }}>
              <span className="font-mono text-xs tracking-[0.22em] text-text-tertiary">
                MEETING INTELLIGENCE ENGINE
              </span>
            </div>

            {/* Headline — left-aligned */}
            <div className="mb-7 font-sans font-bold tracking-tight"
              style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)", letterSpacing: "-0.03em" }}>
              {heroLine("Your next post", 100)}
              {heroLine("is in your inbox.", 230, true)}
            </div>

            {/* Subtext — left-aligned, constrained width */}
            <p className="mb-10 max-w-sm text-lg leading-relaxed text-text-secondary" style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.7s ease 400ms, transform 0.7s ease 400ms",
            }}>
              Quilp reads meeting summary emails and turns them into LinkedIn posts.
              In your voice. Without you lifting a finger.
            </p>

            {/* CTAs — left-aligned row */}
            <div className="flex flex-row flex-wrap gap-3" style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.7s ease 540ms, transform 0.7s ease 540ms",
            }}>
              <a href="/signup"
                className="rounded-lg px-8 py-3.5 font-mono text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                style={{ background: A, color: "#0A0A0A" }}>
                Start for free
              </a>
              <a href="#process"
                className="px-8 py-3.5 font-mono text-sm text-text-secondary transition-colors hover:text-text-primary">
                See how it works
              </a>
            </div>
          </div>

          {/* ── Right: pipeline visual ── */}
          <div className="hidden items-center justify-end lg:flex" style={{
            opacity: heroReady ? 1 : 0,
            transition: "opacity 0.8s ease 0.6s",
          }}>
            <PipelineVisual active={heroReady} />
          </div>

        </div>
      </section>

      {/* ── Process — 3 steps ──────────────────────────────────────────── */}
      <section id="process" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-4 font-mono text-xs tracking-[0.22em] text-text-tertiary">THE PIPELINE</p>
            <h2 className="mb-16 font-sans font-bold tracking-tight"
              style={{ fontSize: "clamp(1.7rem, 3.5vw, 2.8rem)", lineHeight: 1.12 }}>
              From email to audience.{" "}
              <span className="text-text-secondary" style={{ fontWeight: 400 }}>
                No steps in between.
              </span>
            </h2>
          </Reveal>

          <div className="grid gap-[1px] md:grid-cols-3"
            style={{ background: "#161616", borderRadius: 10, overflow: "hidden" }}>
            {[
              { n: "01", h: "Ingress", b: "Gmail or Outlook polls for meeting summaries. Each email is confidence-scored. Low-signal mail never reaches the pipeline." },
              { n: "02", h: "Generate", b: "Claude drafts a post using your voice profile. PII is stripped before the AI sees any of your content." },
              { n: "03", h: "Approve & post", b: "One approval email arrives. One click to confirm. Quilp finds your best time window and posts automatically." },
            ].map(({ n, h, b }, i) => (
              <Reveal key={n} delay={i * 90}>
                <div className="bg-bg-primary p-8" style={{ height: "100%" }}>
                  <div className="mb-6 font-mono text-xs tracking-widest text-text-tertiary">{n}</div>
                  <div className="mb-3 font-mono text-sm font-semibold text-text-primary">{h}</div>
                  <p className="text-sm leading-relaxed text-text-secondary">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <IllustrationsSection />

      {/* ── Features bento ─────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-16 font-mono text-xs tracking-[0.22em] text-text-tertiary">CAPABILITIES</p>
          </Reveal>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "#1a1a1a",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #1a1a1a",
          }}>
            {/* Voice — 2 cols */}
            <div ref={voiceRef} className="bg-bg-primary p-10" style={{
              gridColumn: "1 / 3",
              opacity: voiceInView ? 1 : 0,
              transform: voiceInView ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)",
            }}>
              <div className="mb-10"><Waveform active={voiceInView} /></div>
              <h3 className="mb-4 font-sans font-bold leading-snug"
                style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.9rem)" }}>
                Sounds like you.<br />Not like AI.
              </h3>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
                Feed it your five best posts. It learns your cadence, vocabulary, and structure — and filters every generated draft through your voice before you ever see it.
              </p>
            </div>

            {/* Approval — right, 2 rows tall */}
            <div ref={approvalRef}
              className="flex flex-col items-start justify-between bg-bg-primary p-10"
              style={{
                gridColumn: "3 / 4", gridRow: "1 / 3",
                opacity: approvalInView ? 1 : 0,
                transform: approvalInView ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.7s ease 0.1s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.1s",
              }}>
              <div>
                <div className="mb-8"><AnimCheck active={approvalInView} /></div>
                <h3 className="mb-4 font-sans font-bold leading-snug"
                  style={{ fontSize: "clamp(1.1rem, 1.6vw, 1.4rem)" }}>
                  You approve it.<br />From your inbox.
                </h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  Every post reaches you as an email before publishing. One click to approve, one to discard. No dashboard, no login.
                </p>
              </div>
              <div className="mt-8 font-mono text-[11px] text-text-tertiary">
                One-click approval workflow
              </div>
            </div>

            {/* Scheduling */}
            <Reveal delay={0} className="bg-bg-primary p-8">
              <div className="mb-8">
                <div className="font-mono font-bold" style={{ fontSize: "3rem", lineHeight: 1, color: A }}>
                  9<span style={{ fontSize: "1.4rem", color: "#555" }}>:00</span>
                </div>
                <div className="mt-1.5 font-mono text-[10px] tracking-widest text-text-tertiary">
                  PEAK TIME, YOUR TIMEZONE
                </div>
              </div>
              <h3 className="mb-2 font-sans text-lg font-bold">Posted when they're listening.</h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                Timezone-aware. Frequency-capped. Quilp finds the window your audience is most active.
              </p>
            </Reveal>

            {/* Privacy */}
            <Reveal delay={80} className="bg-bg-primary p-8">
              <div className="mb-8">
                <div className="mb-2 font-mono text-xs font-semibold tracking-widest" style={{ color: A, letterSpacing: "0.18em" }}>
                  AES-256-GCM
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div key={i} style={{
                      width: 3, height: 14, borderRadius: 2,
                      background: i < 11 ? "#252525" : A,
                      opacity: i < 11 ? 0.6 : 0.2 + (i - 11) * 0.1,
                    }} />
                  ))}
                </div>
              </div>
              <h3 className="mb-2 font-sans text-lg font-bold">End-to-end encrypted.</h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                OAuth tokens encrypted at rest. PII automatically stripped before Claude processes your content.
              </p>
            </Reveal>

            {/* Analytics */}
            <div ref={analyticsRef} className="bg-bg-primary p-8" style={{
              opacity: analyticsInView ? 1 : 0,
              transform: analyticsInView ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.7s ease 0.16s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 0.16s",
            }}>
              <div className="mb-8"><RisingBars active={analyticsInView} /></div>
              <h3 className="mb-2 font-sans text-lg font-bold">What works, repeated.</h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                Engagement feeds back into generation. Each post is informed by what the last one taught.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pull quote — intentionally centered as a visual break ──────── */}
      <section className="border-t border-border px-6 py-40">
        <div ref={quoteRef} className="mx-auto max-w-4xl">
          <p className="font-sans font-bold leading-tight tracking-tight"
            style={{ fontSize: "clamp(1.6rem, 4vw, 3.2rem)", letterSpacing: "-0.02em" }}>
            <span style={{
              color: quoteInView ? "#d4d4d4" : "#282828",
              transition: "color 1.4s cubic-bezier(0.22,1,0.36,1)",
            }}>
              Every meeting you attend is{" "}
            </span>
            <span style={{
              color: quoteInView ? A : "#282828",
              transition: "color 1.4s cubic-bezier(0.22,1,0.36,1) 0.35s",
            }}>
              a story worth telling.
            </span>
            <span style={{
              color: quoteInView ? "#d4d4d4" : "#282828",
              transition: "color 1.4s cubic-bezier(0.22,1,0.36,1) 0.15s",
            }}>
              {" "}You just never had time to tell it.
            </span>
          </p>
        </div>
      </section>

      {/* ── Integrations ───────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-4 font-mono text-xs tracking-[0.22em] text-text-tertiary">INTEGRATIONS</p>
            <h2 className="mb-16 font-sans font-bold tracking-tight"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)" }}>
              Works with what you already use.
            </h2>
          </Reveal>

          <div className="grid gap-16 md:grid-cols-2">
            <Reveal delay={0}>
              <p className="mb-5 font-mono text-xs tracking-[0.22em] text-text-tertiary">READS FROM</p>
              <div className="flex flex-wrap gap-2">
                {["Fathom", "Fireflies", "Otter.ai", "Zoom", "Google Meet", "Loom", "Grain", "Read.ai", "Avoma"].map(n => (
                  <span key={n} className="rounded-md border border-border px-3 py-1.5 font-mono text-sm text-text-secondary">
                    {n}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120}>
              <p className="mb-5 font-mono text-xs tracking-[0.22em] text-text-tertiary">POSTS TO</p>
              <div className="mb-8 flex flex-wrap gap-2">
                {["LinkedIn", "Twitter / X"].map(n => (
                  <span key={n} className="rounded-md px-3 py-1.5 font-mono text-sm"
                    style={{ border: `1px solid ${A}33`, color: A }}>
                    {n}
                  </span>
                ))}
                <span className="rounded-md border border-border px-3 py-1.5 font-mono text-sm text-text-tertiary">
                  + more soon
                </span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
                Connect Gmail or Outlook in 30 seconds. Quilp only reads emails from recognised meeting tools — never your personal mail.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA — left-aligned, editorial finish ───────────────────────── */}
      <section className="relative overflow-hidden border-t border-border px-6 py-36"
        style={{
          background: "radial-gradient(ellipse 50% 60% at 0% 100%, rgba(232,249,74,0.05) 0%, transparent 60%)",
        }}>
        <div ref={ctaRef} className="mx-auto max-w-6xl">
          {/* Headline — left-aligned, large */}
          {[
            { text: "The meeting ended.", delay: 0.05, accent: false },
            { text: "Your post is ready.", delay: 0.22, accent: true },
          ].map(({ text, delay, accent }) => (
            <div key={text} style={{ overflow: "hidden", marginBottom: 4 }}>
              <p className="font-sans font-bold tracking-tight" style={{
                fontSize: "clamp(2.4rem, 6vw, 5.5rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.06,
                transform: ctaInView ? "translateY(0)" : "translateY(110%)",
                opacity: ctaInView ? 1 : 0,
                transition: `transform 0.9s ${ease} ${delay}s, opacity 0.9s ease ${delay}s`,
                ...(accent ? { color: A } : {}),
              }}>
                {text}
              </p>
            </div>
          ))}

          {/* Subtext + button — left row */}
          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center" style={{
            opacity: ctaInView ? 1 : 0,
            transition: "opacity 0.6s ease 0.75s",
          }}>
            <a href="/signup"
              className="inline-block rounded-lg px-10 py-4 font-mono text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{ background: A, color: "#0A0A0A" }}>
              Get started for free
            </a>
            <span className="font-mono text-sm text-text-tertiary">
              Free to start. No credit card required.
            </span>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-1 font-mono text-lg font-bold text-text-primary tracking-[-0.02em]">
            quilp<span className="h-1.5 w-1.5 rounded-full" style={{ background: A }} />
          </Link>
          <div className="flex gap-5">
            <a href="/login" className="font-mono text-xs text-text-tertiary transition-colors hover:text-text-secondary">Sign in</a>
            <a href="/signup" className="font-mono text-xs text-text-tertiary transition-colors hover:text-text-secondary">Sign up</a>
          </div>
          <span className="font-mono text-xs text-text-tertiary">&copy; {new Date().getFullYear()} Quilp</span>
        </div>
      </footer>
    </div>
  );
}
