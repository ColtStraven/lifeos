import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const sb = createClient(
  "https://gkthkqsgobavcsyjtbsg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdGhrcXNnb2JhdmNzeWp0YnNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MzA2MzcsImV4cCI6MjA4ODQwNjYzN30.4Z_5g0D66bfLmPiqs-zmGmaBbUAoW6NOm6LdoXfqu3Y"
);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "—";
const last7 = (arr) => arr.slice(-7);
const uid = () => Date.now() + Math.floor(Math.random() * 9999);

// ─── PROGRESSIVE OVERLOAD ENGINE ─────────────────────────────────────────────
const LOWER = ["Squat","Deadlift","Romanian Deadlift","Leg Press","Hip Thrust","Leg Curl","Leg Extension","Calf Raise","Bulgarian Split Squat","Hack Squat","Sumo Deadlift"];

function calcNextTarget(exercise, templateEx, prevSets) {
  const done = prevSets.filter(s => s.completed && s.exercise === exercise);
  if (!done.length) return { weight: templateEx.weight, reps: templateEx.max_reps, note: "First session — establish your baseline", arrow: "→" };
  const inc = LOWER.includes(exercise) ? 10 : 5;
  const lastWeight = parseFloat(done[0].actual_weight) || templateEx.weight;
  const allHitTop = done.length >= templateEx.sets && done.every(s => parseInt(s.actual_reps) >= templateEx.max_reps);
  const anyFailed = done.some(s => parseInt(s.actual_reps) < templateEx.min_reps);
  if (allHitTop) return { weight: lastWeight + inc, reps: templateEx.min_reps, note: `↑ Add ${inc}lbs — you hit the top of your range!`, arrow: "↑" };
  if (anyFailed) { const deload = Math.round(lastWeight * 0.9 / 5) * 5; return { weight: deload, reps: templateEx.min_reps, note: `↓ Deload to ${deload}lbs — reset and rebuild`, arrow: "↓" }; }
  return { weight: lastWeight, reps: templateEx.max_reps, note: `→ Same weight — push for ${templateEx.max_reps} reps every set`, arrow: "→" };
}

// ─── PLATE CALC ──────────────────────────────────────────────────────────────
const PLATES = [45, 35, 25, 10, 5, 2.5];
const BAR = 45;
function getPlates(w) {
  let rem = (w - BAR) / 2; const out = [];
  for (const p of PLATES) { const n = Math.floor(rem / p); if (n > 0) { out.push({ p, n }); rem -= p * n; } }
  return out;
}

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = { bg:"#08080d", surface:"#101018", card:"#14141c", border:"#1e1e2e", accent:"#00ff88", accentDim:"#00ff8818", accentMid:"#00ff8844", red:"#ff4466", amber:"#ffaa00", blue:"#4d8fff", purple:"#b44dff", text:"#eaeaf4", muted:"#55556a", subtext:"#8888a8" };

const EXERCISES = ["Squat","Bench Press","Deadlift","Overhead Press","Barbell Row","Incline Press","Romanian Deadlift","Sumo Deadlift","Close Grip Bench","Skull Crusher","Hack Squat","DB Bench Press","DB Incline Press","DB Shoulder Press","DB Row","DB Curl","DB Hammer Curl","DB Incline Curl","DB Lateral Raise","DB Front Raise","DB Fly","DB Incline Fly","DB Romanian Deadlift","DB Lunge","DB Bulgarian Split Squat","DB Goblet Squat","DB Tricep Kickback","DB Overhead Tricep Extension","DB Shrug","DB Reverse Fly","DB Wrist Curl","Pull-up","Chin-up","Dip","Cable Row","Seated Row","Lat Pulldown","Chest Supported Row","Cable Fly","Cable Lateral Raise","Tricep Pushdown","Cable Curl","Face Pull","Leg Press","Hip Thrust","Leg Curl","Leg Extension","Calf Raise","Bulgarian Split Squat","Chest Fly","DB Flat Press","Machine Shoulder Press","Cable Rear Delt Fly","Rope Overhead Tricep Extension","Rope Pushdowns","Cable Pushdowns","Wide Grip Lat Pulldown","Single Arm DB Row","Low Incline DB Press"];

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let _toast = () => {};
const toast = (msg, type="success") => _toast(msg, type);
function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    _toast = (msg, type="success") => {
      const id = uid();
      setToasts(p => [...p, {id, msg, type}]);
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
    };
  }, []);
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed", bottom:24, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:"linear-gradient(135deg,#1a1a24,#141420)", border:`1px solid ${t.type==="error"?C.red+"55":C.accent+"55"}`, borderRadius:12, padding:"13px 18px", color:t.type==="error"?C.red:C.text, fontSize:14, fontWeight:600, boxShadow:"0 12px 40px rgba(0,0,0,0.6)", backdropFilter:"blur(16px)", animation:"slideIn 0.22s ease-out", display:"flex", alignItems:"center", gap:10, minWidth:200, maxWidth:320 }}>
          <span style={{ fontSize:16, color:t.type==="error"?C.red:C.accent }}>{t.type==="error"?"✕":"✓"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── UI PRIMITIVES ───────────────────────────────────────────────────────────
const Tag = ({ children, color = C.accent }) => <span style={{ background:color+"18", color, border:`1px solid ${color}33`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>{children}</span>;
const Card = ({ children, style={} }) => <div style={{ background:"linear-gradient(155deg,#17171f 0%,#13131a 100%)", border:`1px solid ${C.border}`, borderRadius:16, padding:20, boxShadow:"0 4px 20px rgba(0,0,0,0.3)", ...style }}>{children}</div>;
const Spinner = () => <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60 }}><div style={{ width:36, height:36, border:`2px solid ${C.border}`, borderTop:`2px solid ${C.accent}`, borderRight:`2px solid ${C.accent}44`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

const Btn = ({ children, onClick, variant="primary", small=false, disabled=false, full=false, style={} }) => {
  const vs = {
    primary:{ background:`linear-gradient(135deg,${C.accent},#00d4a0)`, color:"#000", border:"none", boxShadow:`0 4px 18px ${C.accent}33` },
    ghost:{ background:"transparent", color:C.accent, border:`1px solid ${C.accent}33` },
    danger:{ background:C.red+"18", color:C.red, border:`1px solid ${C.red}33` },
    amber:{ background:C.amber+"18", color:C.amber, border:`1px solid ${C.amber}33` },
  };
  return <button onClick={onClick} disabled={disabled}
    style={{ ...vs[variant], borderRadius:9, padding:small?"6px 14px":"11px 22px", fontSize:small?12:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, letterSpacing:"0.04em", transition:"all 0.15s", width:full?"100%":"auto", fontFamily:"inherit", ...style }}
    onMouseOver={e=>{if(disabled)return;e.currentTarget.style.opacity="0.85";if(variant==="primary")e.currentTarget.style.boxShadow=`0 6px 28px ${C.accent}55`;}}
    onMouseOut={e=>{if(disabled)return;e.currentTarget.style.opacity="1";if(variant==="primary")e.currentTarget.style.boxShadow=`0 4px 18px ${C.accent}33`;}}>{children}</button>;
};

const Input = ({ label, type="number", value, onChange, min, max, step=1, unit, placeholder }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    {label && <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}{unit && <span style={{ color:C.subtext }}> ({unit})</span>}</label>}
    <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(type==="number"?parseFloat(e.target.value)||"":e.target.value)} min={min} max={max} step={step}
      style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, padding:"10px 13px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box", transition:"all 0.2s" }}
      onFocus={e=>{e.target.style.borderColor=C.accent;e.target.style.boxShadow=`0 0 0 3px ${C.accent}18`;}}
      onBlur={e=>{e.target.style.borderColor=C.border;e.target.style.boxShadow="none";}} />
  </div>
);

const Slider = ({ label, value, onChange, min=1, max=10, color=C.accent }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
      <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</label>
      <span style={{ fontSize:20, fontWeight:900, color, fontFamily:"'DM Mono',monospace" }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e=>onChange(parseInt(e.target.value))} style={{ width:"100%", accentColor:color, cursor:"pointer" }} />
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted }}><span>{min} — Low</span><span>High — {max}</span></div>
  </div>
);

const Stat = ({ label, value, unit, color=C.accent, sub }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
    <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700 }}>{label}</div>
    <div style={{ fontSize:26, fontWeight:900, color, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{value}<span style={{ fontSize:12, fontWeight:500, color:C.subtext, marginLeft:3 }}>{unit}</span></div>
    {sub && <div style={{ fontSize:11, color:C.subtext }}>{sub}</div>}
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom:20 }}>
    <h2 style={{ margin:0, fontSize:22, fontWeight:900, color:C.text, letterSpacing:"-0.03em", lineHeight:1.2 }}>{title}</h2>
    {subtitle && <p style={{ margin:"5px 0 0", fontSize:13, color:C.muted }}>{subtitle}</p>}
  </div>
);

const CTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return <div style={{ background:"#1a1a24", border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
    <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{fmt(label)}</div>
    {payload.map((p,i)=><div key={i} style={{ fontSize:13, color:p.color, fontWeight:700 }}>{p.name}: {typeof p.value==="number"?p.value.toFixed(1):p.value}</div>)}
  </div>;
};

const ExSelect = ({ value, onChange }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"10px 12px", fontSize:14, outline:"none", width:"100%" }}>
    {EXERCISES.map(e=><option key={e}>{e}</option>)}
  </select>
);

// ═══════════════════════════════════════════════════════════════════════════════
// REST TIMER
// ═══════════════════════════════════════════════════════════════════════════════
function RestTimer({ seconds, onDone, onSkip }) {
  const [rem, setRem] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (paused||rem<=0) {
      if (rem<=0) {
        try {
          const ctx=new(window.AudioContext||window.webkitAudioContext)();
          [[0,523],[0.18,659],[0.36,784]].forEach(([t,freq])=>{
            const osc=ctx.createOscillator(),g=ctx.createGain();
            osc.connect(g);g.connect(ctx.destination);
            osc.frequency.value=freq;
            g.gain.setValueAtTime(0.28,ctx.currentTime+t);
            g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.45);
            osc.start(ctx.currentTime+t);osc.stop(ctx.currentTime+t+0.45);
          });
        } catch {}
        try{navigator.vibrate?.([180,80,180]);}catch{}
        onDone?.();
      }
      return;
    }
    ref.current = setTimeout(()=>setRem(r=>r-1), 1000);
    return ()=>clearTimeout(ref.current);
  }, [rem, paused]);
  const pct = ((seconds-rem)/seconds)*100;
  const color = rem<=10?C.red:rem<=30?C.amber:C.accent;
  return (
    <div style={{ background:C.surface, border:`2px solid ${color}44`, borderRadius:16, padding:20, textAlign:"center" }}>
      <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12, fontWeight:700 }}>Rest</div>
      <div style={{ position:"relative", width:110, height:110, margin:"0 auto 16px" }}>
        <svg width="110" height="110" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="55" cy="55" r="48" fill="none" stroke={C.border} strokeWidth="7" />
          <circle cx="55" cy="55" r="48" fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${2*Math.PI*48}`} strokeDashoffset={`${2*Math.PI*48*(1-pct/100)}`}
            style={{ transition:"stroke-dashoffset 1s linear, stroke 0.3s" }} />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:26, fontWeight:900, color, fontFamily:"'DM Mono',monospace" }}>{Math.floor(rem/60)}:{(rem%60).toString().padStart(2,"0")}</span>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <Btn onClick={()=>setPaused(p=>!p)} variant="ghost" small>{paused?"Resume":"Pause"}</Btn>
        <Btn onClick={()=>setRem(r=>Math.min(r+30,seconds+120))} variant="ghost" small>+30s</Btn>
        <Btn onClick={onSkip} variant="danger" small>Skip</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════
function PlateCalc({ defaultWeight=135 }) {
  const [w, setW] = useState(defaultWeight);
  const plates = getPlates(w);
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
      <div style={{ fontSize:11, color:C.amber, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>🏋️ Plate Calculator</div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12 }}>
        <input type="number" value={w} step={2.5} onChange={e=>setW(parseFloat(e.target.value)||45)}
          style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:20, fontWeight:900, outline:"none", width:110, fontFamily:"'DM Mono',monospace" }} />
        <span style={{ color:C.subtext, fontSize:13 }}>lbs total · bar = 45lbs</span>
      </div>
      {w < BAR ? <div style={{ color:C.red, fontSize:13 }}>Below bar weight</div>
        : plates.length===0 ? <div style={{ color:C.muted, fontSize:13 }}>Just the bar (45lbs)</div>
        : <div>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8, fontWeight:700 }}>EACH SIDE:</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {plates.map(({p,n})=>(
                <div key={p} style={{ background:C.card, border:`1px solid ${C.amber}44`, borderRadius:8, padding:"8px 14px", textAlign:"center", minWidth:60 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.amber, fontFamily:"'DM Mono',monospace" }}>{p}</div>
                  <div style={{ fontSize:11, color:C.muted }}>×{n}</div>
                </div>
              ))}
            </div>
          </div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveWorkout({ template, exercises, lastSets, onFinish, onCancel }) {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [exIdx, setExIdx] = useState(0);
  const [resting, setResting] = useState(false);
  const [restSecs, setRestSecs] = useState(120);
  const [restKey, setRestKey] = useState(0);
  const [exList, setExList] = useState(() => [...exercises]);
  const [showSwap, setShowSwap] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [saving, setSaving] = useState(false);

  // Build initial set log with auto-progressive targets
  const [setLog, setSetLog] = useState(() =>
    exercises.map(ex => {
      const prev = lastSets.filter(s => s.exercise === ex.exercise);
      const next = calcNextTarget(ex.exercise, ex, prev);
      return Array.from({ length: ex.sets }, (_, i) => ({
        idx: i, exercise: ex.exercise,
        targetWeight: next.weight, targetReps: next.reps,
        actualWeight: next.weight, actualReps: "",
        completed: false, pr: false, note: "", showNote: false,
      }));
    })
  );

  useEffect(() => {
    const t = setInterval(()=>setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000);
    return ()=>clearInterval(t);
  }, []);

  const curEx = exList[exIdx];
  const curSets = setLog[exIdx]||[];
  const prevSetsForEx = lastSets.filter(s=>s.exercise===curEx.exercise);
  const nextTarget = calcNextTarget(curEx.exercise, curEx, prevSetsForEx);
  const totalSets = setLog.flat().length;
  const doneSets = setLog.flat().filter(s=>s.completed).length;

  const updateSet = (si, key, val) => setSetLog(prev=>prev.map((exs,ei)=>ei!==exIdx?exs:exs.map((s,i)=>i!==si?s:{...s,[key]:val})));

  useEffect(() => {
    setRestSecs(exList[exIdx]?.rest_seconds || 120);
    setShowSwap(false);
  }, [exIdx]);

  const completeSet = (si) => {
    const s = curSets[si];
    const vol = (parseFloat(s.actualWeight)||0)*(parseInt(s.actualReps)||0);
    const prevBest = prevSetsForEx.reduce((b,ls)=>Math.max(b,(parseFloat(ls.actual_weight)||0)*(parseInt(ls.actual_reps)||0)),0);
    const isPR = vol > prevBest && prevBest > 0;
    setSetLog(prev=>prev.map((exs,ei)=>ei!==exIdx?exs:exs.map((s2,i)=>i!==si?s2:{...s2,completed:true,pr:isPR})));
    setRestKey(k => k + 1);
    setResting(true);
  };

  const swapExercise = (newEx) => {
    setExList(prev => prev.map((ex,i) => i!==exIdx ? ex : {...ex, exercise:newEx}));
    setSetLog(prev => prev.map((exs,ei) => ei!==exIdx ? exs : exs.map(s => ({...s, exercise:newEx}))));
    setShowSwap(false);
  };

  const finishWorkout = async () => {
    setSaving(true);
    const allSets = setLog.flat().filter(s=>s.completed);
    const vol = allSets.reduce((sum,s)=>(parseFloat(s.actualWeight)||0)*(parseInt(s.actualReps)||0)+sum,0);
    const sid = uid();
    await sb.from("workout_sessions").insert({ id:sid, template_id:template.id, template_name:template.name, started_at:new Date(startRef.current).toISOString(), finished_at:new Date().toISOString(), duration_seconds:elapsed, total_volume:vol, date:today() });
    if (allSets.length) await sb.from("session_sets").insert(allSets.map((s,i)=>({ id:uid()+i, session_id:sid, exercise:s.exercise, set_number:s.idx+1, target_weight:s.targetWeight, target_reps:s.targetReps, actual_weight:parseFloat(s.actualWeight)||0, actual_reps:parseInt(s.actualReps)||0, completed:true, pr:s.pr, note:s.note||null })));
    setSaving(false);
    onFinish({ totalVol:vol, sets:allSets, elapsed, prs:allSets.filter(s=>s.pr) });
  };

  const elapsedStr = `${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,"0")}`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Header bar */}
      <Card style={{ padding:"14px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Active</div>
            <div style={{ fontSize:17, fontWeight:900, color:C.text }}>{template.name}</div>
          </div>
          <div style={{ display:"flex", gap:24 }}>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", fontWeight:700 }}>Time</div><div style={{ fontSize:22, fontWeight:900, color:C.accent, fontFamily:"'DM Mono',monospace" }}>{elapsedStr}</div></div>
            <div style={{ textAlign:"center" }}><div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", fontWeight:700 }}>Sets</div><div style={{ fontSize:22, fontWeight:900, color:C.blue, fontFamily:"'DM Mono',monospace" }}>{doneSets}/{totalSets}</div></div>
          </div>
        </div>
        <div style={{ marginTop:10, height:4, background:C.border, borderRadius:2 }}>
          <div style={{ height:"100%", width:`${totalSets?(doneSets/totalSets)*100:0}%`, background:C.accent, borderRadius:2, transition:"width 0.3s" }} />
        </div>
      </Card>

      {/* Exercise tabs */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
        {exList.map((ex,i)=>{
          const done=(setLog[i]||[]).every(s=>s.completed)&&(setLog[i]||[]).length>0;
          const partial=(setLog[i]||[]).some(s=>s.completed);
          return <button key={i} onClick={()=>{setResting(false);setExIdx(i);}}
            style={{ flexShrink:0, padding:"6px 14px", borderRadius:8, border:`1px solid ${exIdx===i?C.accent:done?C.accent+"44":C.border}`, background:exIdx===i?C.accentDim:"transparent", color:exIdx===i?C.accent:done?C.accent:C.subtext, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit" }}>
            {done?"✓ ":partial?"◑ ":""}{ex.exercise}
          </button>;
        })}
      </div>

      {/* Rest timer */}
      {resting && <RestTimer key={restKey} seconds={restSecs} onDone={()=>setResting(false)} onSkip={()=>setResting(false)} />}

      {/* Current exercise */}
      {!resting && <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:showSwap?10:14 }}>
          <div style={{ flex:1, minWidth:0, marginRight:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <div style={{ fontSize:20, fontWeight:900, color:C.text }}>{curEx.exercise}</div>
              <button onClick={()=>setShowSwap(p=>!p)} style={{ background:showSwap?C.red+"22":C.blue+"22", border:`1px solid ${showSwap?C.red+"44":C.blue+"44"}`, color:showSwap?C.red:C.blue, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>
                {showSwap ? "Cancel" : "⇄ Swap"}
              </button>
            </div>
            <div style={{ fontSize:12, color:nextTarget.arrow==="↑"?C.accent:nextTarget.arrow==="↓"?C.red:C.subtext, fontWeight:600 }}>{nextTarget.note}</div>
          </div>
          <button onClick={()=>setShowPlates(p=>!p)} style={{ background:C.amber+"22", border:`1px solid ${C.amber}44`, color:C.amber, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>
            {showPlates?"Hide":"🏋️ Plates"}
          </button>
        </div>

        {showSwap && (
          <div style={{ marginBottom:14 }}>
            <ExSelect value={curEx.exercise} onChange={swapExercise} />
          </div>
        )}

        {showPlates && <div style={{ marginBottom:16 }}><PlateCalc defaultWeight={parseFloat(curSets[0]?.actualWeight)||135} /></div>}

        {/* Set table */}
        <div style={{ display:"grid", gridTemplateColumns:"36px 80px 1fr 1fr 44px 28px", gap:8, marginBottom:8 }}>
          {["Set","Target","Weight","Reps","",""].map((h,i)=><div key={i} style={{ fontSize:10, color:C.muted, textTransform:"uppercase", fontWeight:700, textAlign:"center" }}>{h}</div>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {curSets.map((s,si)=>(
            <div key={si} style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <div style={{ display:"grid", gridTemplateColumns:"36px 80px 1fr 1fr 44px 28px", gap:8, alignItems:"center", opacity:s.completed?0.55:1 }}>
                <div style={{ textAlign:"center", fontSize:15, fontWeight:900, color:s.completed?(s.pr?C.amber:C.accent):C.muted }}>
                  {s.completed?(s.pr?"★":"✓"):si+1}
                </div>
                <div style={{ textAlign:"center", fontSize:12, color:C.subtext, fontFamily:"'DM Mono',monospace", lineHeight:1.3 }}>
                  {s.targetWeight}lbs<br/>{s.targetReps}reps
                </div>
                <input type="number" value={s.actualWeight} disabled={s.completed} step={2.5}
                  onChange={e=>updateSet(si,"actualWeight",e.target.value)}
                  style={{ background:C.surface, border:`1px solid ${s.completed?C.accent+"33":C.border}`, borderRadius:8, color:C.text, padding:"12px 8px", fontSize:17, fontWeight:900, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace", width:"100%" }} />
                <input type="number" value={s.actualReps} disabled={s.completed}
                  onChange={e=>updateSet(si,"actualReps",e.target.value)}
                  style={{ background:C.surface, border:`1px solid ${s.completed?C.accent+"33":C.border}`, borderRadius:8, color:C.text, padding:"12px 8px", fontSize:17, fontWeight:900, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace", width:"100%" }} />
                <button disabled={s.completed} onClick={()=>completeSet(si)}
                  style={{ background:s.completed?C.accent+"22":C.accent, color:s.completed?C.accent:"#000", border:"none", borderRadius:8, padding:"12px 0", fontSize:18, fontWeight:900, cursor:s.completed?"default":"pointer", width:"100%" }}>
                  {s.completed?"✓":"→"}
                </button>
                <button onClick={()=>updateSet(si,"showNote",!s.showNote)}
                  style={{ background:"transparent", border:`1px solid ${s.note?C.blue+"66":C.border}`, color:s.note?C.blue:C.muted, borderRadius:8, padding:"12px 0", fontSize:13, cursor:"pointer", width:"100%", fontFamily:"inherit" }}
                  title="Add note">
                  {s.note?"💬":"✎"}
                </button>
              </div>
              {(s.showNote || s.note) && (
                <input type="text" placeholder="Note this set… e.g. felt easy, left shoulder tight"
                  value={s.note} disabled={s.completed}
                  onChange={e=>updateSet(si,"note",e.target.value)}
                  style={{ background:C.surface, border:`1px solid ${C.blue}44`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" }}
                  onFocus={e=>e.target.style.borderColor=C.blue} onBlur={e=>e.target.style.borderColor=C.blue+"44"} />
              )}
            </div>
          ))}
        </div>

        {/* Rest time selector */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Rest</span>
          {[60,90,120,180,300].map(s=>(
            <button key={s} onClick={()=>setRestSecs(s)}
              style={{ flex:1, padding:"6px 0", borderRadius:8, border:`1px solid ${restSecs===s?C.accent:C.border}`, background:restSecs===s?C.accentDim:"transparent", color:restSecs===s?C.accent:C.subtext, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {s<120?`${s}s`:s===120?"2m":s===180?"3m":"5m"}
            </button>
          ))}
        </div>
      </Card>}

      {/* Nav between exercises */}
      <div style={{ display:"flex", gap:8 }}>
        {exIdx>0 && <Btn onClick={()=>{setResting(false);setExIdx(i=>i-1);}} variant="ghost">← Prev</Btn>}
        {exIdx<exList.length-1 && <Btn onClick={()=>{setResting(false);setExIdx(i=>i+1);}} variant="ghost" style={{ marginLeft:"auto" }}>Next →</Btn>}
      </div>

      <div style={{ display:"flex", gap:10 }}>
        <Btn onClick={onCancel} variant="danger">Abandon</Btn>
        <Btn onClick={finishWorkout} disabled={saving} full style={{ marginLeft:"auto" }}>{saving?"Saving...":doneSets===0?"Finish (no sets logged)":`Finish Workout ✓ ${doneSets} sets`}</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function WorkoutSummary({ data, onDone }) {
  const { totalVol, sets, elapsed, prs } = data;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ textAlign:"center", padding:"24px 0 8px" }}>
        <div style={{ fontSize:52, marginBottom:10 }}>🏆</div>
        <h2 style={{ margin:0, fontSize:26, fontWeight:900, color:C.accent }}>Workout Complete!</h2>
      </div>
      <div className="r-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
        <Card><Stat label="Duration" value={Math.floor(elapsed/60)} unit="min" color={C.blue} /></Card>
        <Card><Stat label="Volume" value={(totalVol/1000).toFixed(1)} unit="k lbs" color={C.accent} /></Card>
        <Card><Stat label="Sets" value={sets.length} color={C.purple} /></Card>
      </div>
      {prs.length>0 && (
        <Card style={{ border:`1px solid ${C.amber}55`, background:C.amber+"0a" }}>
          <div style={{ fontSize:12, color:C.amber, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>🌟 New PRs This Session!</div>
          {prs.map((s,i)=><div key={i} style={{ fontSize:14, color:C.text, marginBottom:6 }}>{s.exercise} — <span style={{ color:C.amber, fontWeight:700 }}>{s.actualWeight}lbs × {s.actualReps} reps</span></div>)}
        </Card>
      )}
      <Btn onClick={onDone} full>← Back to Gym</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GYM MODULE
// ═══════════════════════════════════════════════════════════════════════════════
function Gym() {
  const [view, setView] = useState("home");
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [activeExercises, setActiveExercises] = useState([]);
  const [lastSets, setLastSets] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [buildName, setBuildName] = useState("");
  const [buildDesc, setBuildDesc] = useState("");
  const [buildExs, setBuildExs] = useState([{ id:uid(), exercise:"Squat", sets:3, min_reps:8, max_reps:12, weight:135, rest_seconds:120 }]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);

  const reload = async () => {
    const [t,s] = await Promise.all([sb.from("workout_templates").select("*").order("id",{ascending:false}), sb.from("workout_sessions").select("*").order("date",{ascending:false}).limit(15)]);
    if(t.data) setTemplates(t.data); if(s.data) setSessions(s.data);
  };

  useEffect(()=>{ reload().then(()=>setLoading(false)); },[]);

  const startWorkout = async (tmpl) => {
    const { data:exs } = await sb.from("template_exercises").select("*").eq("template_id",tmpl.id).order("order_index");
    const { data:lastSess } = await sb.from("workout_sessions").select("id").eq("template_id",tmpl.id).order("started_at",{ascending:false}).limit(1);
    let prev = [];
    if (lastSess?.length) { const { data:ls } = await sb.from("session_sets").select("*").eq("session_id",lastSess[0].id); if(ls) prev=ls; }
    setActiveTemplate(tmpl); setActiveExercises(exs||[]); setLastSets(prev); setView("active");
  };

  const saveTemplate = async () => {
    if (!buildName.trim()) return toast("Give your workout a name", "error");
    setSaving(true);
    const tid = editing?.id || uid();
    if (editing) {
      await sb.from("workout_templates").update({ name:buildName, description:buildDesc }).eq("id",tid);
      await sb.from("template_exercises").delete().eq("template_id",tid);
    } else {
      await sb.from("workout_templates").insert({ id:tid, name:buildName, description:buildDesc });
    }
    await sb.from("template_exercises").insert(buildExs.map((ex,i)=>({ id:uid()+i, template_id:tid, exercise:ex.exercise, sets:ex.sets, min_reps:ex.min_reps, max_reps:ex.max_reps, weight:ex.weight, rest_seconds:ex.rest_seconds, order_index:i })));
    await reload(); setSaving(false); setView("home"); setEditing(null); setBuildName(""); setBuildDesc(""); setBuildExs([{ id:uid(), exercise:"Squat", sets:3, min_reps:8, max_reps:12, weight:135, rest_seconds:120 }]);
  };

  const editTemplate = async (t) => {
    const { data:exs } = await sb.from("template_exercises").select("*").eq("template_id",t.id).order("order_index");
    setEditing(t); setBuildName(t.name); setBuildDesc(t.description||""); setBuildExs(exs?.map(e=>({...e})) || []); setView("builder");
  };

  const deleteTemplate = async (id) => { if(!confirm("Delete this workout?")) return; await sb.from("workout_templates").delete().eq("id",id); setTemplates(p=>p.filter(t=>t.id!==id)); };
  const addEx = () => setBuildExs(p=>[...p,{ id:uid(), exercise:"Bench Press", sets:3, min_reps:8, max_reps:12, weight:135, rest_seconds:120 }]);
  const removeEx = (id) => setBuildExs(p=>p.filter(e=>e.id!==id));
  const updateEx = (id,k,v) => setBuildExs(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));

  if (loading) return <Spinner />;
  if (view==="active") return <ActiveWorkout template={activeTemplate} exercises={activeExercises} lastSets={lastSets} onFinish={d=>{setSummaryData(d);setView("summary");}} onCancel={()=>setView("home")} />;
  if (view==="summary") return <WorkoutSummary data={summaryData} onDone={()=>{reload();setView("home");}} />;

  if (view==="builder") return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <SectionHeader title={editing?"Edit Workout":"Build Workout"} subtitle="Create your template" />
        <Btn onClick={()=>{setView("home");setEditing(null);setBuildName("");setBuildExs([{id:uid(),exercise:"Squat",sets:3,min_reps:8,max_reps:12,weight:135,rest_seconds:120}]);}} variant="danger" small>Cancel</Btn>
      </div>
      <Card>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Input label="Workout Name" type="text" value={buildName} onChange={setBuildName} placeholder="Push A, Pull B, Leg Day..." />
          <Input label="Description (optional)" type="text" value={buildDesc} onChange={setBuildDesc} placeholder="e.g. Heavy compound focus" />
        </div>
      </Card>

      {buildExs.map((ex,i)=>(
        <Card key={ex.id}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontSize:13, color:C.accent, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em" }}>Exercise {i+1}</div>
            {buildExs.length>1 && <button onClick={()=>removeEx(ex.id)} style={{ background:C.red+"22", border:`1px solid ${C.red}44`, color:C.red, borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>Remove</button>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Exercise</label>
              <ExSelect value={ex.exercise} onChange={v=>updateEx(ex.id,"exercise",v)} />
            </div>
            <div className="r-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <Input label="Sets" value={ex.sets} onChange={v=>updateEx(ex.id,"sets",parseInt(v)||3)} min={1} max={10} />
              <Input label="Min Reps" value={ex.min_reps} onChange={v=>updateEx(ex.id,"min_reps",parseInt(v)||6)} min={1} max={30} />
              <Input label="Max Reps" value={ex.max_reps} onChange={v=>updateEx(ex.id,"max_reps",parseInt(v)||12)} min={1} max={30} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Input label="Starting Weight" value={ex.weight} onChange={v=>updateEx(ex.id,"weight",parseFloat(v)||45)} step={2.5} unit="lbs" />
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Rest Timer</label>
                <select value={ex.rest_seconds} onChange={e=>updateEx(ex.id,"rest_seconds",parseInt(e.target.value))}
                  style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"10px 12px", fontSize:14, outline:"none" }}>
                  <option value={60}>1 min</option><option value={90}>90 sec</option><option value={120}>2 min</option><option value={180}>3 min</option><option value={240}>4 min</option><option value={300}>5 min</option>
                </select>
              </div>
            </div>
            <div style={{ background:C.surface, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:11, color:C.accent, fontWeight:700, marginBottom:2 }}>Double Progression Auto-Overload</div>
              <div style={{ fontSize:12, color:C.subtext }}>Hit {ex.max_reps} reps on all {ex.sets} sets → auto adds {LOWER.includes(ex.exercise)?10:5}lbs next session</div>
            </div>
          </div>
        </Card>
      ))}
      <Btn onClick={addEx} variant="ghost" full>+ Add Exercise</Btn>
      <Btn onClick={saveTemplate} disabled={saving} full>{saving?"Saving...":(editing?"Update Workout":"Save Workout")}</Btn>
    </div>
  );

  // HOME
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <SectionHeader title="Gym" subtitle={`${templates.length} workouts · ${sessions.length} recent sessions`} />
        <Btn onClick={()=>setView("builder")}>+ Build Workout</Btn>
      </div>

      <PlateCalc defaultWeight={135} />

      {templates.length===0 ? (
        <Card><div style={{ textAlign:"center", padding:"40px 0" }}><div style={{ fontSize:48, marginBottom:12 }}>🏋️</div><div style={{ color:C.muted, fontSize:15 }}>No workouts yet. Build your first routine above!</div></div></Card>
      ) : templates.map(t=>(
        <Card key={t.id} style={{ border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:C.text, marginBottom:2 }}>{t.name}</div>
              {t.description && <div style={{ fontSize:13, color:C.subtext }}>{t.description}</div>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn onClick={()=>editTemplate(t)} variant="ghost" small>Edit</Btn>
              <Btn onClick={()=>deleteTemplate(t.id)} variant="danger" small>✕</Btn>
            </div>
          </div>
          <Btn onClick={()=>startWorkout(t)} full>🚀 Start Workout</Btn>
        </Card>
      ))}

      {sessions.length>0 && (
        <Card>
          <div style={{ fontSize:12, color:C.blue, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Recent Sessions</div>
          {sessions.map(s=>(
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}22` }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.template_name}</div>
                <div style={{ fontSize:12, color:C.subtext }}>{fmt(s.date)} · {Math.floor((s.duration_seconds||0)/60)}min · {Math.round(s.total_volume||0).toLocaleString()}lbs</div>
              </div>
              <Tag color={C.blue}>{fmt(s.date)}</Tag>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LOG
// ═══════════════════════════════════════════════════════════════════════════════
const ACTIVITY_LEVELS=[
  {val:1.2,   label:"Sedentary (desk job, no exercise)"},
  {val:1.375, label:"Lightly Active (1-3 days/week)"},
  {val:1.55,  label:"Moderately Active (3-5 days/week)"},
  {val:1.725, label:"Very Active (6-7 days/week)"},
  {val:1.9,   label:"Extra Active (athlete / physical job)"},
];
const DEFAULT_SUPPS=["Creatine","Vitamin D","Magnesium","Omega-3"];
const lsGet=(k,fb)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};

function DailyLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date:today(), weight:"", sleep:7, energy:7, mood:7, stress:4, protein:"", carbs:"", fat:"", water:"", steps:"", notes:"" });
  const f = (k)=>(v)=>setForm(p=>({...p,[k]:v}));

  // ── TDEE ──
  const [tdee, setTdee] = useState(()=>lsGet("lifeos_tdee",null));
  const [showTDEE, setShowTDEE] = useState(false);
  const [tdeeForm, setTdeeForm] = useState(()=>lsGet("lifeos_tdee",{sex:"male",age:25,heightIn:70,weightLbs:175,activity:1.55}));
  const tf = (k)=>(v)=>setTdeeForm(p=>({...p,[k]:v}));
  const calcTDEE=(s)=>{
    const bmr=s.sex==="male"?4.536*s.weightLbs+12.7*s.heightIn-5*s.age+5:4.536*s.weightLbs+12.7*s.heightIn-5*s.age-161;
    return Math.round(bmr*parseFloat(s.activity));
  };
  const saveTDEE=()=>{ lsSet("lifeos_tdee",tdeeForm); setTdee(tdeeForm); setShowTDEE(false); };
  const openTDEE=()=>{ setTdeeForm(lsGet("lifeos_tdee",{sex:"male",age:25,heightIn:70,weightLbs:175,activity:1.55})); setShowTDEE(true); };

  // ── Supplements ──
  const [supplements, setSupplements] = useState(()=>lsGet("lifeos_supplements",DEFAULT_SUPPS));
  const [suppChecks, setSuppChecks] = useState(()=>lsGet(`lifeos_supps_${today()}`,{}));
  const [newSupp, setNewSupp] = useState("");
  const [showAddSupp, setShowAddSupp] = useState(false);
  const toggleSupp=(name)=>{const next={...suppChecks,[name]:!suppChecks[name]};setSuppChecks(next);lsSet(`lifeos_supps_${today()}`,next);};
  const addSupp=()=>{if(!newSupp.trim())return;const next=[...supplements,newSupp.trim()];setSupplements(next);lsSet("lifeos_supplements",next);setNewSupp("");};
  const removeSupp=(name)=>{const next=supplements.filter(s=>s!==name);setSupplements(next);lsSet("lifeos_supplements",next);};

  useEffect(()=>{
    sb.from("daily_logs").select("*").order("date",{ascending:true}).then(({data})=>{
      if(data){ setLogs(data); const tl=data.find(l=>l.date===today()); if(tl) setForm({date:tl.date,weight:tl.weight||"",sleep:tl.sleep||7,energy:tl.energy||7,mood:tl.mood||7,stress:tl.stress||4,protein:tl.protein||"",carbs:tl.carbs||"",fat:tl.fat||"",water:tl.water||"",steps:tl.steps||"",notes:tl.notes||""}); }
      setLoading(false);
    });
  },[]);

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("daily_logs").upsert({ date:form.date, weight:form.weight||null, sleep:form.sleep, energy:form.energy, mood:form.mood, stress:form.stress, protein:form.protein||null, carbs:form.carbs||null, fat:form.fat||null, water:form.water||null, steps:form.steps||null, notes:form.notes||null, saved_at:new Date().toISOString() }, { onConflict:"date" });
    if(!error){ const {data}=await sb.from("daily_logs").select("*").order("date"); if(data)setLogs(data); toast("Log saved!"); } else toast("Error: "+error.message,"error");
    setSaving(false);
  };

  if(loading) return <Spinner />;
  const cals = (form.protein?form.protein*4:0)+(form.carbs?form.carbs*4:0)+(form.fat?form.fat*9:0);
  const tdeeVal = tdee ? calcTDEE(tdee) : null;
  const balance = tdeeVal && cals>0 ? Math.round(cals-tdeeVal) : null;
  const suppDone = supplements.filter(s=>suppChecks[s]).length;

  const inputStyle={ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"10px 12px", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <SectionHeader title="Daily Log" subtitle={new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} />

      {/* TDEE Card */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showTDEE||!tdeeVal ? 12 : 0 }}>
          <div style={{ fontSize:12, color:C.amber, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em" }}>TDEE / Calorie Target</div>
          <Btn onClick={showTDEE?()=>setShowTDEE(false):openTDEE} variant="ghost" small>{showTDEE?"Cancel":tdee?"Edit":"Set Up"}</Btn>
        </div>
        {showTDEE && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", gap:8 }}>
              {["male","female"].map(s=>(
                <button key={s} onClick={()=>tf("sex")(s)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:`1px solid ${tdeeForm.sex===s?C.amber+"88":C.border}`, background:tdeeForm.sex===s?C.amber+"22":"transparent", color:tdeeForm.sex===s?C.amber:C.subtext, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize" }}>
                  {s==="male"?"♂ Male":"♀ Female"}
                </button>
              ))}
            </div>
            <div className="r-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <Input label="Age" value={tdeeForm.age} onChange={v=>tf("age")(parseInt(v)||25)} min={10} max={100} />
              <Input label="Height (in)" value={tdeeForm.heightIn} onChange={v=>tf("heightIn")(parseFloat(v)||70)} step={0.5} />
              <Input label="Weight (lbs)" value={tdeeForm.weightLbs} onChange={v=>tf("weightLbs")(parseFloat(v)||175)} step={0.5} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Activity Level</label>
              <select value={tdeeForm.activity} onChange={e=>tf("activity")(e.target.value)} style={inputStyle}>
                {ACTIVITY_LEVELS.map(a=><option key={a.val} value={a.val}>{a.label}</option>)}
              </select>
            </div>
            <div style={{ background:C.surface, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.subtext }}>
              Estimated TDEE: <span style={{ color:C.amber, fontWeight:800 }}>{calcTDEE(tdeeForm).toLocaleString()} kcal/day</span>
            </div>
            <Btn onClick={saveTDEE} full>Save TDEE Settings</Btn>
          </div>
        )}
        {!showTDEE && tdeeVal && (
          <div>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginBottom: balance!==null ? 14 : 0 }}>
              <Stat label="Maintenance" value={tdeeVal.toLocaleString()} unit="kcal" color={C.amber}/>
              {cals>0 && <Stat label="Today" value={Math.round(cals).toLocaleString()} unit="kcal" color={C.blue}/>}
              {balance!==null && <Stat label={balance<0?"Deficit":"Surplus"} value={Math.abs(balance).toLocaleString()} unit="kcal" color={balance<0?C.accent:C.red}/>}
            </div>
            {balance!==null && (
              <div>
                <div style={{ height:6, background:C.surface, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min((cals/tdeeVal)*100,110)}%`, background:balance<0?C.accent:C.red, borderRadius:3, transition:"width 0.3s" }}/>
                </div>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{balance<0?`${Math.abs(balance)} kcal below maintenance`:`${balance} kcal above maintenance`}</div>
              </div>
            )}
            {!cals && <p style={{ fontSize:12, color:C.muted, marginTop:8 }}>Log your macros below to see today's balance.</p>}
          </div>
        )}
        {!showTDEE && !tdeeVal && (
          <p style={{ fontSize:13, color:C.muted }}>Enter your stats to automatically track your calorie deficit or surplus every day.</p>
        )}
      </Card>

      {/* Body + Macros */}
      <div className="r-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Card>
          <div style={{ fontSize:12, color:C.accent, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Body</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Weight" value={form.weight} onChange={f("weight")} step={0.1} unit="lbs" />
            <Input label="Steps" value={form.steps} onChange={f("steps")} />
            <Input label="Water" value={form.water} onChange={f("water")} step={0.5} unit="oz" />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize:12, color:C.blue, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Macros {cals>0&&<span style={{ color:C.subtext, fontSize:11 }}>· {Math.round(cals)} kcal</span>}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Input label="Protein" value={form.protein} onChange={f("protein")} unit="g" />
            <Input label="Carbs" value={form.carbs} onChange={f("carbs")} unit="g" />
            <Input label="Fat" value={form.fat} onChange={f("fat")} unit="g" />
          </div>
        </Card>
      </div>

      {/* Supplements */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:12, color:C.blue, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            Supplements <span style={{ color:suppDone===supplements.length&&supplements.length>0?C.accent:C.muted, fontWeight:500 }}>{suppDone}/{supplements.length}</span>
          </div>
          <Btn onClick={()=>setShowAddSupp(p=>!p)} variant="ghost" small>{showAddSupp?"Done":"+ Add"}</Btn>
        </div>
        {showAddSupp && (
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input value={newSupp} onChange={e=>setNewSupp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSupp()} placeholder="e.g. Zinc, Ashwagandha…"
              style={{ ...inputStyle, flex:1 }} />
            <Btn onClick={addSupp} small>Add</Btn>
          </div>
        )}
        {supplements.length===0 && <p style={{ color:C.muted, fontSize:13 }}>No supplements yet. Hit "+ Add" to get started.</p>}
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          {supplements.map(s=>(
            <div key={s} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom:`1px solid ${C.border}22` }}>
              <button onClick={()=>toggleSupp(s)} style={{ width:24, height:24, borderRadius:6, border:`2px solid ${suppChecks[s]?C.accent:C.border}`, background:suppChecks[s]?C.accent:"transparent", color:"#000", fontSize:14, fontWeight:900, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
                {suppChecks[s]?"✓":""}
              </button>
              <span style={{ flex:1, fontSize:14, color:suppChecks[s]?C.accent:C.text, textDecoration:suppChecks[s]?"line-through":"none", transition:"all 0.15s" }}>{s}</span>
              {showAddSupp && <button onClick={()=>removeSupp(s)} style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:16, padding:"0 4px", fontFamily:"inherit" }}>✕</button>}
            </div>
          ))}
        </div>
      </Card>

      {/* Wellbeing */}
      <Card>
        <div style={{ fontSize:12, color:C.purple, fontWeight:800, marginBottom:18, textTransform:"uppercase", letterSpacing:"0.1em" }}>Wellbeing</div>
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <Slider label="Sleep hours" value={form.sleep} onChange={f("sleep")} min={3} max={12} color={C.blue} />
          <Slider label="Energy" value={form.energy} onChange={f("energy")} color={C.accent} />
          <Slider label="Mood" value={form.mood} onChange={f("mood")} color={C.purple} />
          <Slider label="Stress" value={form.stress} onChange={f("stress")} color={C.red} />
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <div style={{ fontSize:12, color:C.amber, fontWeight:800, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.1em" }}>Notes & Wins</div>
        <textarea value={form.notes} onChange={e=>f("notes")(e.target.value)} placeholder="What went well? Any insights..."
          style={{ width:"100%", minHeight:90, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:12, fontSize:14, resize:"vertical", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
          onFocus={e=>e.target.style.borderColor=C.amber} onBlur={e=>e.target.style.borderColor=C.border} />
      </Card>

      <Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save Today's Log"}</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BODY
// ═══════════════════════════════════════════════════════════════════════════════
const MEAS_FIELDS=[
  {k:"waist",l:"Waist",color:C.accent},{k:"chest",l:"Chest",color:C.blue},{k:"hips",l:"Hips",color:C.purple},
  {k:"bicep",l:"Bicep",color:C.amber},{k:"thigh",l:"Thigh",color:C.red},{k:"shoulder",l:"Shoulders",color:C.blue},
  {k:"neck",l:"Neck",color:C.subtext},{k:"calf",l:"Calf",color:C.accent},
];

const compressImage=(file,maxW=900,q=0.72)=>new Promise(res=>{
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(1,maxW/img.width);
      const c=document.createElement("canvas");
      c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL("image/jpeg",q));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
});

function Body() {
  const [measurements,setMeasurements]=useState([]);
  const [photos,setPhotos]=useState([]);
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [bodyTab,setBodyTab]=useState("measurements");
  const [form,setForm]=useState({date:today(),chest:"",waist:"",hips:"",neck:"",shoulder:"",bicep:"",thigh:"",calf:"",bf:""});
  const f=(k)=>(v)=>setForm(p=>({...p,[k]:v}));

  // Charts
  const [chartField,setChartField]=useState("waist");

  // Photos
  const [photoFile,setPhotoFile]=useState(null);
  const [photoDate,setPhotoDate]=useState(today());
  const [photoNotes,setPhotoNotes]=useState("");
  const [uploading,setUploading]=useState(false);
  const [compareA,setCompareA]=useState("");
  const [compareB,setCompareB]=useState("");
  const [photosSupported,setPhotosSupported]=useState(true);

  useEffect(()=>{
    Promise.all([
      sb.from("measurements").select("*").order("date",{ascending:true}),
      sb.from("daily_logs").select("date,weight").order("date",{ascending:true}),
      sb.from("progress_photos").select("id,date,notes,photo_data").order("date",{ascending:true}),
    ]).then(([m,l,p])=>{
      if(m.data)setMeasurements(m.data);
      if(l.data)setLogs(l.data);
      if(p.data){
        setPhotos(p.data);
        if(p.data.length>=1)setCompareA(p.data[0].date);
        if(p.data.length>=2)setCompareB(p.data[p.data.length-1].date);
      } else if(p.error){setPhotosSupported(false);}
      setLoading(false);
    });
  },[]);

  const saveMeasurements=async()=>{
    setSaving(true);
    const{error}=await sb.from("measurements").upsert({date:form.date,chest:form.chest||null,waist:form.waist||null,hips:form.hips||null,neck:form.neck||null,shoulder:form.shoulder||null,bicep:form.bicep||null,thigh:form.thigh||null,calf:form.calf||null,bf:form.bf||null},{onConflict:"date"});
    if(!error){const{data}=await sb.from("measurements").select("*").order("date");if(data)setMeasurements(data);toast("Measurements saved!");}
    setSaving(false);
  };

  const uploadPhoto=async()=>{
    if(!photoFile)return;
    setUploading(true);
    try{
      const data=await compressImage(photoFile);
      const{error}=await sb.from("progress_photos").insert({id:String(uid()),date:photoDate,notes:photoNotes||null,photo_data:data});
      if(!error){
        const{data:rows}=await sb.from("progress_photos").select("id,date,notes,photo_data").order("date",{ascending:true});
        if(rows){setPhotos(rows);if(rows.length>=1)setCompareA(rows[0].date);if(rows.length>=2)setCompareB(rows[rows.length-1].date);}
        setPhotoFile(null);setPhotoNotes("");
      } else toast("Upload failed: "+error.message,"error");
    } catch(e){toast("Error: "+e.message,"error");}
    setUploading(false);
  };

  const deletePhoto=async(id)=>{
    if(!confirm("Delete this photo?"))return;
    await sb.from("progress_photos").delete().eq("id",id);
    setPhotos(p=>p.filter(x=>x.id!==id));
  };

  if(loading)return<Spinner/>;

  const wData=logs.filter(l=>l.weight).map(l=>({date:l.date,weight:parseFloat(l.weight)}));
  const fields=[{k:"chest",l:"Chest"},{k:"waist",l:"Waist"},{k:"hips",l:"Hips"},{k:"neck",l:"Neck"},{k:"shoulder",l:"Shoulders"},{k:"bicep",l:"Bicep"},{k:"thigh",l:"Thigh"},{k:"calf",l:"Calf"}];
  const selField=MEAS_FIELDS.find(f=>f.k===chartField)||MEAS_FIELDS[0];
  const chartData=measurements.filter(m=>m[chartField]!=null).map(m=>({date:m.date,[chartField]:parseFloat(m[chartField])}));
  const photoByDate=Object.fromEntries(photos.map(p=>[p.date,p]));
  const photoA=photoByDate[compareA];
  const photoB=photoByDate[compareB];
  const BODY_TABS=[{id:"measurements",label:"Measurements"},{id:"charts",label:"Charts"},{id:"photos",label:"Photos"}];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionHeader title="Body Recomp" subtitle="Measurements, trends & progress photos"/>

      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
        {BODY_TABS.map(t=>(
          <button key={t.id} onClick={()=>setBodyTab(t.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1px solid ${bodyTab===t.id?C.accent:C.border}`,background:bodyTab===t.id?C.accentDim:"transparent",color:bodyTab===t.id?C.accent:C.subtext,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MEASUREMENTS ── */}
      {bodyTab==="measurements" && <>
        {wData.length>2 && <Card>
          <div style={{fontSize:12,color:C.accent,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Weight Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={wData}>
              <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Area type="monotone" dataKey="weight" name="Weight" stroke={C.accent} fill="url(#wg)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>}
        <Card>
          <div style={{fontSize:12,color:C.blue,fontWeight:800,marginBottom:16,textTransform:"uppercase",letterSpacing:"0.1em"}}>Log Measurements</div>
          <div style={{marginBottom:14}}><Input label="Date" type="text" value={form.date} onChange={f("date")}/></div>
          <div className="r-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            {fields.map(({k,l})=><Input key={k} label={l} value={form[k]} onChange={f(k)} step={0.1} unit="in"/>)}
          </div>
          <div style={{marginBottom:14}}><Input label="Body Fat %" value={form.bf} onChange={f("bf")} step={0.1} unit="%"/></div>
          <Btn onClick={saveMeasurements} disabled={saving} full>{saving?"Saving...":"Save Measurements"}</Btn>
        </Card>
        {measurements.length>0 && <Card>
          <div style={{fontSize:12,color:C.purple,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>History</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Date","Chest","Waist","Hips","Bicep","BF%"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",borderBottom:`1px solid ${C.border}`,fontWeight:700,fontSize:11,color:C.muted}}>{h}</th>)}</tr></thead>
              <tbody>{[...measurements].reverse().slice(0,10).map((m,i)=><tr key={i}>{[fmt(m.date),m.chest,m.waist,m.hips,m.bicep,m.bf].map((v,j)=><td key={j} style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}22`,color:C.subtext}}>{v||"—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </Card>}
      </>}

      {/* ── CHARTS ── */}
      {bodyTab==="charts" && <>
        {measurements.length<2
          ? <Card><p style={{color:C.muted,textAlign:"center",padding:40}}>Log at least 2 measurement entries to see trends.</p></Card>
          : <>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {MEAS_FIELDS.map(mf=>{
                const hasData=measurements.some(m=>m[mf.k]!=null);
                return <button key={mf.k} onClick={()=>setChartField(mf.k)} disabled={!hasData}
                  style={{padding:"6px 14px",borderRadius:8,border:`1px solid ${chartField===mf.k?mf.color:C.border}`,background:chartField===mf.k?mf.color+"22":"transparent",color:chartField===mf.k?mf.color:hasData?C.subtext:C.muted,fontSize:12,fontWeight:700,cursor:hasData?"pointer":"default",fontFamily:"inherit",opacity:hasData?1:0.4}}>
                  {mf.l}
                </button>;
              })}
            </div>
            {chartData.length>=2 ? <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:12,color:selField.color,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em"}}>{selField.l} Trend</div>
                <div style={{display:"flex",gap:12}}>
                  {chartData.length>=2 && <Stat label="Start" value={chartData[0][chartField]} unit="in" color={C.muted}/>}
                  <Stat label="Latest" value={chartData[chartData.length-1][chartField]} unit="in" color={selField.color}/>
                  {chartData.length>=2 && (() => {
                    const diff=(chartData[chartData.length-1][chartField]-chartData[0][chartField]).toFixed(1);
                    return <Stat label="Change" value={(diff>0?"+":"")+diff} unit="in" color={diff<0?C.accent:diff>0?C.red:C.muted}/>;
                  })()}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id={`cg_${chartField}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={selField.color} stopOpacity={0.2}/><stop offset="95%" stopColor={selField.color} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
                  <XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/>
                  <YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}} tickFormatter={v=>v+"\""}/>
                  <Tooltip content={<CTip/>}/>
                  <Area type="monotone" dataKey={chartField} name={selField.l} stroke={selField.color} fill={`url(#cg_${chartField})`} strokeWidth={2} dot={{r:4,fill:selField.color,stroke:"none"}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Card> : <Card><p style={{color:C.muted,textAlign:"center",padding:30,fontSize:13}}>Not enough {selField.l.toLowerCase()} data points yet.</p></Card>}
          </>
        }
      </>}

      {/* ── PHOTOS ── */}
      {bodyTab==="photos" && <>
        {!photosSupported && <Card style={{border:`1px solid ${C.amber}44`}}>
          <div style={{fontSize:13,color:C.amber}}>Create a <code style={{background:C.surface,padding:"2px 6px",borderRadius:4}}>progress_photos</code> table in Supabase with columns: <code style={{background:C.surface,padding:"2px 6px",borderRadius:4}}>id text, date text, notes text, photo_data text</code></div>
        </Card>}

        <Card>
          <div style={{fontSize:12,color:C.purple,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Upload Photo</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <Input label="Date" type="text" value={photoDate} onChange={setPhotoDate}/>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <label style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>Photo</label>
              <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files[0]||null)}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"10px 12px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"}}/>
            </div>
            {photoFile && <div style={{fontSize:12,color:C.muted}}>Will compress to ~800px wide before saving.</div>}
            <input placeholder="Notes (optional, e.g. 8 weeks in)" value={photoNotes} onChange={e=>setPhotoNotes(e.target.value)}
              style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"10px 12px",fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit"}}/>
            <Btn onClick={uploadPhoto} disabled={!photoFile||uploading} full>{uploading?"Compressing & Saving…":"Upload Photo"}</Btn>
          </div>
        </Card>

        {photos.length>=2 && <Card>
          <div style={{fontSize:12,color:C.blue,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Side-by-Side Comparison</div>
          <div className="r-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            {[{val:compareA,set:setCompareA,label:"Before"},{val:compareB,set:setCompareB,label:"After"}].map(({val,set,label})=>(
              <div key={label} style={{display:"flex",flexDirection:"column",gap:6}}>
                <label style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>{label}</label>
                <select value={val} onChange={e=>set(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:13,outline:"none"}}>
                  {photos.map(p=><option key={p.id} value={p.date}>{fmt(p.date)}{p.notes?` — ${p.notes}`:""}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="r-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[photoA,photoB].map((p,i)=>p
              ? <div key={i} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <img src={p.photo_data} alt={p.date} style={{width:"100%",borderRadius:10,objectFit:"cover",aspectRatio:"3/4",border:`1px solid ${C.border}`}}/>
                  <div style={{fontSize:12,color:C.subtext,textAlign:"center"}}>{fmt(p.date)}{p.notes&&<><br/><span style={{fontSize:11,color:C.muted}}>{p.notes}</span></>}</div>
                </div>
              : <div key={i} style={{background:C.surface,borderRadius:10,aspectRatio:"3/4",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:C.muted,fontSize:13}}>No photo</span></div>
            )}
          </div>
        </Card>}

        {photos.length>0 && <Card>
          <div style={{fontSize:12,color:C.accent,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>All Photos</div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
            {[...photos].reverse().map(p=>(
              <div key={p.id} style={{flexShrink:0,width:120,display:"flex",flexDirection:"column",gap:6}}>
                <img src={p.photo_data} alt={p.date} style={{width:120,height:160,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>
                <div style={{fontSize:11,color:C.subtext,textAlign:"center",lineHeight:1.3}}>{fmt(p.date)}</div>
                <button onClick={()=>deletePhoto(p.id)} style={{background:"transparent",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>delete</button>
              </div>
            ))}
          </div>
        </Card>}

        {photos.length===0&&photosSupported && <Card><p style={{color:C.muted,textAlign:"center",padding:40,fontSize:13}}>Upload your first progress photo above.</p></Card>}
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════════════════════
const GOAL_CATS=["Health","Fitness","Career","Finance","Personal","Learning","Relationships"];
const catColor={Health:C.accent,Fitness:C.blue,Career:C.amber,Finance:C.accent,Personal:C.purple,Learning:C.blue,Relationships:C.red};

function Goals() {
  const [goals,setGoals]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({title:"",category:"Health",target:"",deadline:"",progress:0,notes:"",status:"active"});
  const f=(k)=>(v)=>setForm(p=>({...p,[k]:v}));
  useEffect(()=>{sb.from("goals").select("*").order("id",{ascending:false}).then(({data})=>{if(data)setGoals(data);setLoading(false);});}, []);
  const save=async()=>{setSaving(true);const g={...form,id:uid(),created:today()};const{error}=await sb.from("goals").insert(g);if(!error){setGoals(p=>[g,...p]);setShow(false);setForm({title:"",category:"Health",target:"",deadline:"",progress:0,notes:"",status:"active"});}setSaving(false);};
  const upd=async(id,k,v)=>{await sb.from("goals").update({[k]:v}).eq("id",id);setGoals(p=>p.map(g=>g.id===id?{...g,[k]:v}:g));};
  const del=async(id)=>{await sb.from("goals").delete().eq("id",id);setGoals(p=>p.filter(g=>g.id!==id));};
  if(loading) return <Spinner />;
  const active=goals.filter(g=>g.status==="active"), done=goals.filter(g=>g.status==="complete");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <SectionHeader title="Goals" subtitle={`${active.length} active · ${done.length} complete`}/>
        <Btn onClick={()=>setShow(!show)} variant={show?"danger":"primary"}>{show?"Cancel":"+ New Goal"}</Btn>
      </div>
      {show && <Card>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Input label="Goal title" type="text" value={form.title} onChange={f("title")}/>
          <div className="r-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>Category</label>
              <select value={form.category} onChange={e=>f("category")(e.target.value)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"10px 12px", fontSize:14, outline:"none" }}>
                {GOAL_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <Input label="Deadline" type="text" value={form.deadline} onChange={f("deadline")}/>
          </div>
          <Input label="Target / Metric" type="text" value={form.target} onChange={f("target")}/>
          <Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save Goal"}</Btn>
        </div>
      </Card>}
      {active.map(g=>(
        <Card key={g.id}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:800, color:C.text, fontSize:16, marginBottom:4 }}>{g.title}</div>
              <div style={{ display:"flex", gap:8 }}><Tag color={catColor[g.category]||C.accent}>{g.category}</Tag>{g.deadline&&<Tag color={C.muted}>{g.deadline}</Tag>}</div>
            </div>
            <div style={{ display:"flex", gap:8 }}><Btn onClick={()=>upd(g.id,"status","complete")} variant="ghost" small>✓</Btn><Btn onClick={()=>del(g.id)} variant="danger" small>✕</Btn></div>
          </div>
          {g.target&&<div style={{ fontSize:13, color:C.subtext, marginBottom:12 }}>Target: {g.target}</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted }}><span>Progress</span><span>{g.progress}%</span></div>
            <input type="range" min={0} max={100} value={g.progress} onChange={e=>upd(g.id,"progress",parseInt(e.target.value))} style={{ width:"100%", accentColor:catColor[g.category]||C.accent }}/>
            <div style={{ height:4, background:C.surface, borderRadius:2 }}><div style={{ height:"100%", width:`${g.progress}%`, background:catColor[g.category]||C.accent, borderRadius:2, transition:"width 0.3s" }}/></div>
          </div>
        </Card>
      ))}
      {done.length>0 && <Card>
        <div style={{ fontSize:12, color:C.accent, fontWeight:800, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.1em" }}>Completed 🎯</div>
        {done.map(g=><div key={g.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}22` }}>
          <span style={{ color:C.subtext, textDecoration:"line-through", fontSize:14 }}>{g.title}</span>
          <Btn onClick={()=>upd(g.id,"status","active")} variant="ghost" small>Reopen</Btn>
        </div>)}
      </Card>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const MUSCLE_MAP={
  "Squat":"Quads","Hack Squat":"Quads","Leg Press":"Quads","Leg Extension":"Quads","Bulgarian Split Squat":"Quads","DB Bulgarian Split Squat":"Quads","DB Goblet Squat":"Quads","DB Lunge":"Quads",
  "Deadlift":"Back","Barbell Row":"Back","Lat Pulldown":"Back","Wide Grip Lat Pulldown":"Back","Cable Row":"Back","Seated Row":"Back","Chest Supported Row":"Back","Single Arm DB Row":"Back","DB Row":"Back","Pull-up":"Back",
  "Bench Press":"Chest","Incline Press":"Chest","Close Grip Bench":"Chest","DB Bench Press":"Chest","DB Incline Press":"Chest","DB Flat Press":"Chest","Low Incline DB Press":"Chest","Cable Fly":"Chest","Chest Fly":"Chest","DB Fly":"Chest","DB Incline Fly":"Chest",
  "Overhead Press":"Shoulders","DB Shoulder Press":"Shoulders","Machine Shoulder Press":"Shoulders","DB Lateral Raise":"Shoulders","DB Front Raise":"Shoulders","Cable Lateral Raise":"Shoulders","Cable Rear Delt Fly":"Shoulders","DB Reverse Fly":"Shoulders","Face Pull":"Shoulders",
  "Romanian Deadlift":"Hamstrings","Sumo Deadlift":"Hamstrings","Leg Curl":"Hamstrings","DB Romanian Deadlift":"Hamstrings",
  "Hip Thrust":"Glutes",
  "Chin-up":"Biceps","DB Curl":"Biceps","DB Hammer Curl":"Biceps","DB Incline Curl":"Biceps","Cable Curl":"Biceps",
  "Skull Crusher":"Triceps","Tricep Pushdown":"Triceps","Rope Overhead Tricep Extension":"Triceps","Rope Pushdowns":"Triceps","Cable Pushdowns":"Triceps","DB Tricep Kickback":"Triceps","DB Overhead Tricep Extension":"Triceps","Dip":"Triceps",
  "Calf Raise":"Calves",
};
const MRV={Quads:20,Back:25,Chest:20,Shoulders:20,Biceps:20,Triceps:18,Hamstrings:16,Glutes:16,Calves:16};
const MEV={Quads:8,Back:10,Chest:10,Shoulders:8,Biceps:8,Triceps:6,Hamstrings:6,Glutes:4,Calves:6};
const e1rm=(w,r)=>Math.round(parseFloat(w||0)*(1+(parseInt(r)||0)/30));
const GC={A:C.accent,B:C.blue,C:C.amber,D:C.red,F:C.red};
const letterGrade=(val,thresholds)=>{const[a,b,c,d]=thresholds;return val>=a?"A":val>=b?"B":val>=c?"C":val>=d?"D":"F";};
const weekMonday=()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));return d.toISOString().slice(0,10);};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
function Analytics() {
  const [logs,setLogs]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [allSets,setAllSets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [aTab,setATab]=useState("overview");
  const [range,setRange]=useState("30");
  const [prEx,setPrEx]=useState("");

  useEffect(()=>{
    Promise.all([
      sb.from("daily_logs").select("*").order("date",{ascending:true}),
      sb.from("workout_sessions").select("*").order("date",{ascending:true}),
      sb.from("session_sets").select("*"),
    ]).then(([l,s,ss])=>{
      if(l.data)setLogs(l.data);
      if(s.data)setSessions(s.data);
      if(ss.data){
        setAllSets(ss.data);
        const exes=[...new Set(ss.data.filter(x=>x.completed).map(x=>x.exercise))];
        if(exes.length)setPrEx(exes[0]);
      }
      setLoading(false);
    });
  },[]);

  if(loading) return <Spinner/>;

  // ── Overview ──
  const sliced=range==="7"?last7(logs):logs.slice(-30);
  const data=sliced.map(l=>({date:l.date,weight:parseFloat(l.weight)||null,energy:l.energy,mood:l.mood,sleep:l.sleep,protein:parseFloat(l.protein)||null}));
  const vByDay={};sessions.forEach(s=>{vByDay[s.date]=(vByDay[s.date]||0)+(s.total_volume||0);});
  const volData=data.map(d=>({date:d.date,volume:Math.round(vByDay[d.date]||0)}));
  const wkCount=sessions.filter(s=>data.some(d=>d.date===s.date)).length;

  // ── Sets with dates ──
  const sessById=Object.fromEntries(sessions.map(s=>[s.id,s]));
  const setsWithDate=allSets.map(s=>({...s,date:sessById[s.session_id]?.date})).filter(s=>s.date&&s.completed);

  // ── Correlations (sleep → energy/mood/volume) ──
  const BUCKETS=["<6h","6-7h","7-8h","8+h"];
  const bkt={};BUCKETS.forEach(b=>bkt[b]={energy:[],mood:[],volume:[]});
  logs.forEach(l=>{
    if(!l.sleep)return;
    const h=parseFloat(l.sleep);
    const b=h<6?"<6h":h<7?"6-7h":h<8?"7-8h":"8+h";
    if(l.energy)bkt[b].energy.push(l.energy);
    if(l.mood)bkt[b].mood.push(l.mood);
    if(vByDay[l.date]>0)bkt[b].volume.push(vByDay[l.date]);
  });
  const corrData=BUCKETS.map(b=>({
    label:b,
    energy:bkt[b].energy.length>=2?parseFloat(avg(bkt[b].energy)):null,
    mood:bkt[b].mood.length>=2?parseFloat(avg(bkt[b].mood)):null,
    volume:bkt[b].volume.length>=1?Math.round(bkt[b].volume.reduce((a,v)=>a+v,0)/bkt[b].volume.length):null,
  }));
  const insights=[];
  const validE=corrData.filter(d=>d.energy!==null);
  if(validE.length>=2){
    const best=[...validE].sort((a,b)=>b.energy-a.energy)[0];
    const worst=[...validE].sort((a,b)=>a.energy-b.energy)[0];
    if(best.label!==worst.label)insights.push({icon:"⚡",text:`Your energy peaks (${best.energy}/10) after ${best.label} sleep — drops to ${worst.energy}/10 after ${worst.label}`});
    const validV=corrData.filter(d=>d.volume!==null);
    if(validV.length>=2){const bv=[...validV].sort((a,b)=>b.volume-a.volume)[0];insights.push({icon:"🏋️",text:`You lift the most volume (avg ${Math.round(bv.volume/1000)}k lbs) after ${bv.label} of sleep`});}
  }
  const protDays=logs.filter(l=>l.protein&&l.energy);
  if(protDays.length>=5){
    const hi=protDays.filter(l=>parseFloat(l.protein)>=150),lo=protDays.filter(l=>parseFloat(l.protein)<150);
    if(hi.length>=2&&lo.length>=2){
      const avgHi=parseFloat(avg(hi.map(l=>l.energy))),avgLo=parseFloat(avg(lo.map(l=>l.energy)));
      if(avgHi>avgLo+0.4)insights.push({icon:"🥩",text:`Days with 150g+ protein: energy ${avgHi.toFixed(1)}/10 vs ${avgLo.toFixed(1)}/10 on lower protein days`});
    }
  }
  if(!insights.length)insights.push({icon:"📊",text:"Log at least 2 weeks of data to unlock personalized insights"});

  // ── Weekly report card ──
  const wkMon=weekMonday();
  const wkLogs=logs.filter(l=>l.date>=wkMon);
  const wkSess=sessions.filter(s=>s.date>=wkMon);
  const sleepVals=wkLogs.filter(l=>l.sleep).map(l=>parseFloat(l.sleep));
  const avgSleepWk=sleepVals.length?sleepVals.reduce((a,b)=>a+b,0)/sleepVals.length:null;
  const protDaysWk=wkLogs.filter(l=>l.protein&&parseFloat(l.protein)>0).length;
  const sessionsWk=wkSess.length;
  const totalVolWk=wkSess.reduce((s,x)=>s+(x.total_volume||0),0);
  const daysLoggedWk=wkLogs.length;
  const reportCards=[
    {label:"Sleep",    grade:avgSleepWk?letterGrade(avgSleepWk,[8,7,6,5]):"—", val:avgSleepWk?avgSleepWk.toFixed(1)+"h avg":"No data"},
    {label:"Nutrition",grade:letterGrade(protDaysWk,[6,5,4,2]),              val:`${protDaysWk}/7 days protein logged`},
    {label:"Training", grade:letterGrade(sessionsWk,[4,3,2,1]),              val:`${sessionsWk} sessions · ${Math.round(totalVolWk/1000)}k lbs`},
    {label:"Consistency",grade:letterGrade(daysLoggedWk,[6,5,4,2]),         val:`${daysLoggedWk}/7 days logged`},
  ];
  const gScore={A:4,B:3,C:2,D:1,F:0,"—":0};
  const overallGrade=(()=>{const s=reportCards.filter(g=>g.grade!=="—").map(g=>gScore[g.grade]);if(!s.length)return "—";const m=s.reduce((a,b)=>a+b,0)/s.length;return m>=3.5?"A":m>=2.5?"B":m>=1.5?"C":m>=0.5?"D":"F";})();

  // ── PR timeline ──
  const exOptions=[...new Set(setsWithDate.map(s=>s.exercise))].sort();
  const prSets=setsWithDate.filter(s=>s.exercise===prEx&&parseFloat(s.actual_weight)>0);
  const prByDate={};
  prSets.forEach(s=>{const rm=e1rm(s.actual_weight,s.actual_reps);if(!prByDate[s.date]||rm>prByDate[s.date].e1rm)prByDate[s.date]={date:s.date,e1rm:rm,weight:parseFloat(s.actual_weight),reps:parseInt(s.actual_reps)||0};});
  const prData=Object.values(prByDate).sort((a,b)=>a.date.localeCompare(b.date));
  let maxRm=0;prData.forEach(d=>{if(d.e1rm>maxRm){d.isPR=true;maxRm=d.e1rm;}else d.isPR=false;});

  // ── Volume landmarks ──
  const wkSetsAll=setsWithDate.filter(s=>s.date>=wkMon);
  const setsByMuscle={};wkSetsAll.forEach(s=>{const m=MUSCLE_MAP[s.exercise];if(m)setsByMuscle[m]=(setsByMuscle[m]||0)+1;});

  const exportAll=async()=>{const[l,s,g,m]=await Promise.all([sb.from("daily_logs").select("*"),sb.from("workout_sessions").select("*"),sb.from("goals").select("*"),sb.from("measurements").select("*")]);const blob=new Blob([JSON.stringify({logs:l.data,sessions:s.data,goals:g.data,measurements:m.data},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`lifeos-${today()}.json`;a.click();};

  const ATABS=[{id:"overview",label:"Overview"},{id:"report",label:"Report Card"},{id:"insights",label:"Insights"},{id:"prs",label:"PRs"},{id:"volume",label:"Volume"}];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionHeader title="Analytics" subtitle="Performance intelligence"/>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
        {ATABS.map(t=>(
          <button key={t.id} onClick={()=>setATab(t.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1px solid ${aTab===t.id?C.accent:C.border}`,background:aTab===t.id?C.accentDim:"transparent",color:aTab===t.id?C.accent:C.subtext,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {aTab==="overview" && <>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
          {["7","30"].map(r=><Btn key={r} onClick={()=>setRange(r)} variant={range===r?"primary":"ghost"} small>{r}D</Btn>)}
        </div>
        <Card><div className="r-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
          <Stat label="Avg Energy" value={avg(data.filter(d=>d.energy).map(d=>d.energy))} unit="/10" color={C.accent}/>
          <Stat label="Avg Mood"   value={avg(data.filter(d=>d.mood).map(d=>d.mood))}     unit="/10" color={C.purple}/>
          <Stat label="Avg Sleep"  value={avg(data.filter(d=>d.sleep).map(d=>d.sleep))}   unit="hrs" color={C.blue}/>
          <Stat label="Workouts"   value={wkCount} color={C.amber}/>
        </div></Card>
        {data.length>1 && <Card>
          <div style={{fontSize:12,color:C.accent,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Energy, Mood & Sleep</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={[0,12]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Line type="monotone" dataKey="energy" name="Energy" stroke={C.accent} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="mood"   name="Mood"   stroke={C.purple} strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="sleep"  name="Sleep"  stroke={C.blue}   strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>}
        {data.filter(d=>d.weight).length>1 && <Card>
          <div style={{fontSize:12,color:C.blue,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Weight</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.filter(d=>d.weight)}>
              <defs><linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.25}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Area type="monotone" dataKey="weight" name="Weight" stroke={C.blue} fill="url(#wg2)" strokeWidth={2} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>}
        {volData.some(d=>d.volume>0) && <Card>
          <div style={{fontSize:12,color:C.amber,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Lifting Volume</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={volData}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/><Bar dataKey="volume" name="Volume (lbs)" fill={C.amber} radius={[4,4,0,0]}/></BarChart>
          </ResponsiveContainer>
        </Card>}
        {data.length===0 && <Card><p style={{color:C.muted,textAlign:"center",padding:40}}>Start logging daily to see your analytics.</p></Card>}
      </>}

      {/* ── REPORT CARD ── */}
      {aTab==="report" && <>
        <Card style={{border:`1px solid ${GC[overallGrade]||C.border}33`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:700,marginBottom:4}}>
                Week of {new Date(wkMon+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              </div>
              <div style={{fontSize:17,fontWeight:900,color:C.text}}>Weekly Report Card</div>
            </div>
            <div style={{fontSize:60,fontWeight:900,color:GC[overallGrade]||C.muted,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{overallGrade}</div>
          </div>
          <div className="r-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {reportCards.map(g=>(
              <div key={g.label} style={{background:C.surface,borderRadius:10,padding:"14px 16px",border:`1px solid ${(GC[g.grade]||C.border)}33`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700}}>{g.label}</div>
                  <div style={{fontSize:28,fontWeight:900,color:GC[g.grade]||C.muted,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{g.grade}</div>
                </div>
                <div style={{fontSize:12,color:C.subtext}}>{g.val}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>Grading Scale</div>
          {[["Sleep","A≥8h  B≥7h  C≥6h  D≥5h"],["Nutrition","A=6/7 days  B=5  C=4  D=2"],["Training","A=4+ sessions  B=3  C=2  D=1"],["Consistency","A=6/7 days logged  B=5  C=4  D=2"]].map(([l,s])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}22`,fontSize:12}}>
              <span style={{color:C.subtext,fontWeight:600}}>{l}</span>
              <span style={{color:C.muted,fontFamily:"'DM Mono',monospace",fontSize:11}}>{s}</span>
            </div>
          ))}
        </Card>
      </>}

      {/* ── INSIGHTS ── */}
      {aTab==="insights" && <>
        <Card style={{border:`1px solid ${C.accent}22`}}>
          <div style={{fontSize:12,color:C.accent,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Correlation Insights</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {insights.map((ins,i)=>(
              <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 14px",background:C.surface,borderRadius:10}}>
                <span style={{fontSize:20,flexShrink:0}}>{ins.icon}</span>
                <span style={{fontSize:14,color:C.text,lineHeight:1.5}}>{ins.text}</span>
              </div>
            ))}
          </div>
        </Card>
        {corrData.some(d=>d.energy!==null) && <Card>
          <div style={{fontSize:12,color:C.blue,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Avg Energy by Sleep Duration</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={corrData.filter(d=>d.energy!==null)}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:C.muted,fontSize:11}}/><YAxis domain={[0,10]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Bar dataKey="energy" name="Avg Energy" fill={C.blue} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>}
        {corrData.some(d=>d.mood!==null) && <Card>
          <div style={{fontSize:12,color:C.purple,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Avg Mood by Sleep Duration</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={corrData.filter(d=>d.mood!==null)}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:C.muted,fontSize:11}}/><YAxis domain={[0,10]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Bar dataKey="mood" name="Avg Mood" fill={C.purple} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>}
        {corrData.some(d=>d.volume!==null) && <Card>
          <div style={{fontSize:12,color:C.amber,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>Avg Lifting Volume by Sleep Duration</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={corrData.filter(d=>d.volume!==null)}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
              <Bar dataKey="volume" name="Avg Volume (lbs)" fill={C.amber} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>}
        {!corrData.some(d=>d.energy!==null) && <Card><p style={{color:C.muted,textAlign:"center",padding:40,fontSize:13}}>Log at least 2 weeks of data with sleep tracked to see correlations.</p></Card>}
      </>}

      {/* ── PRs ── */}
      {aTab==="prs" && <>
        {exOptions.length===0
          ? <Card><p style={{color:C.muted,textAlign:"center",padding:40}}>Complete workouts to build your PR history.</p></Card>
          : <>
            <Card style={{padding:"14px 20px"}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:700,marginBottom:8}}>Exercise</div>
              <select value={prEx} onChange={e=>setPrEx(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"10px 12px",fontSize:14,outline:"none",width:"100%"}}>
                {exOptions.map(e=><option key={e}>{e}</option>)}
              </select>
            </Card>
            {prData.length>0 ? <>
              <Card>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:12,color:C.accent,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em"}}>Est. 1RM Over Time</div>
                  <Tag color={C.amber}>Peak: {maxRm} lbs</Tag>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={prData}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
                    <XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/>
                    <YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}}/>
                    <Tooltip content={({active,payload,label})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0]?.payload;
                      return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px"}}>
                        <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{fmt(label)}</div>
                        <div style={{fontSize:15,color:C.accent,fontWeight:800}}>e1RM: {d?.e1rm} lbs</div>
                        <div style={{fontSize:12,color:C.subtext}}>{d?.weight}lbs × {d?.reps} reps</div>
                        {d?.isPR&&<div style={{fontSize:11,color:C.amber,fontWeight:700,marginTop:4}}>★ All-time PR</div>}
                      </div>;
                    }}/>
                    <Line type="monotone" dataKey="e1rm" name="Est. 1RM" stroke={C.accent} strokeWidth={2}
                      dot={(props)=>{const{cx,cy,payload}=props;return <circle key={payload.date} cx={cx} cy={cy} r={payload.isPR?5:3} fill={payload.isPR?C.amber:C.accent} stroke="none"/>;}}/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>⭐ gold dots = all-time PRs · Epley formula: weight × (1 + reps/30)</div>
              </Card>
              {prData.filter(d=>d.isPR).length>0 && <Card>
                <div style={{fontSize:12,color:C.amber,fontWeight:800,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.1em"}}>PR History</div>
                {[...prData].filter(d=>d.isPR).reverse().map((d,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}22`}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text}}>{d.weight}lbs × {d.reps} reps</div>
                      <div style={{fontSize:11,color:C.muted}}>{fmt(d.date)}</div>
                    </div>
                    <div style={{fontSize:18,fontWeight:900,color:C.amber,fontFamily:"'DM Mono',monospace"}}>{d.e1rm}<span style={{fontSize:12,fontWeight:500,color:C.subtext}}> e1RM</span></div>
                  </div>
                ))}
              </Card>}
            </> : <Card><p style={{color:C.muted,textAlign:"center",padding:40,fontSize:13}}>No logged sets yet for {prEx}.</p></Card>}
          </>
        }
      </>}

      {/* ── VOLUME ── */}
      {aTab==="volume" && <>
        <Card>
          <div style={{fontSize:12,color:C.blue,fontWeight:800,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>Weekly Volume Landmarks</div>
          <div style={{fontSize:12,color:C.subtext,marginBottom:20}}>Sets logged this week · MEV = minimum effective · MRV = junk volume threshold</div>
          {Object.keys(MRV).map(muscle=>{
            const sets=setsByMuscle[muscle]||0;
            const mrv=MRV[muscle],mev=MEV[muscle];
            const pct=Math.min((sets/mrv)*100,100);
            const overMRV=sets>=mrv,nearMRV=sets>=mrv*0.8&&!overMRV;
            const color=overMRV?C.red:nearMRV?C.amber:sets>=mev?C.accent:C.muted;
            const badge=overMRV?"⚠ Junk Volume":nearMRV?"Approaching MRV":sets>=mev?"In Effective Range":sets>0?"Below MEV":"—";
            return (
              <div key={muscle} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
                  <span style={{fontSize:14,fontWeight:700,color:sets>0?C.text:C.muted}}>{muscle}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <span style={{fontSize:11,color,fontWeight:700}}>{badge}</span>
                    <span style={{fontSize:15,fontWeight:900,color,fontFamily:"'DM Mono',monospace"}}>{sets}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>/{mrv}</span></span>
                  </div>
                </div>
                <div style={{position:"relative",height:8,background:C.surface,borderRadius:4}}>
                  <div style={{position:"absolute",height:"100%",left:0,width:`${(mev/mrv)*100}%`,background:C.border,borderRadius:4}}/>
                  <div style={{position:"absolute",height:"100%",left:0,width:`${pct}%`,background:color,borderRadius:4,transition:"width 0.3s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:10,color:C.muted}}>
                  <span>MEV: {mev} sets</span><span>MRV: {mrv} sets</span>
                </div>
              </div>
            );
          })}
          {!Object.keys(setsByMuscle).length && <p style={{color:C.muted,textAlign:"center",padding:20,fontSize:13}}>Log workouts this week to see your volume breakdown.</p>}
        </Card>
        <Card>
          <div style={{fontSize:12,color:C.accent,fontWeight:800,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.1em"}}>This Week</div>
          <div className="r-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            <Stat label="Sessions" value={sessionsWk} color={C.blue}/>
            <Stat label="Total Sets" value={wkSetsAll.length} color={C.accent}/>
            <Stat label="Volume" value={(totalVolWk/1000).toFixed(1)} unit="k lbs" color={C.amber}/>
          </div>
        </Card>
      </>}

      <Btn variant="ghost" onClick={exportAll} full>↓ Export All Data</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [logs,setLogs]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [goals,setGoals]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ Promise.all([sb.from("daily_logs").select("*").order("date",{ascending:true}),sb.from("workout_sessions").select("date,total_volume,template_name,duration_seconds").order("date",{ascending:false}).limit(20),sb.from("goals").select("*")]).then(([l,s,g])=>{if(l.data)setLogs(l.data);if(s.data)setSessions(s.data);if(g.data)setGoals(g.data);setLoading(false);}); },[]);
  if(loading) return <Spinner />;
  const todayLog=logs.find(l=>l.date===today());
  const last7logs=last7(logs);
  const streak=(()=>{let s=0;const d=new Date();while(true){const ds=d.toISOString().slice(0,10);if(logs.find(l=>l.date===ds)){s++;d.setDate(d.getDate()-1);}else break;}return s;})();
  const weekWorkouts=sessions.filter(s=>(new Date()-new Date(s.date+"T12:00:00"))/86400000<=7).length;
  const activeGoals=goals.filter(g=>g.status==="active");
  const lastSess=sessions[0];
  const hour=new Date().getHours();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <div style={{ fontSize:12, color:C.muted, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:700, marginBottom:4 }}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
        <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:C.text, letterSpacing:"-0.03em" }}>Good {hour<12?"morning":hour<17?"afternoon":"evening"} 👋</h1>
      </div>
      <Card style={{ border:todayLog?`1px solid ${C.accent}44`:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:13, color:C.muted, marginBottom:4 }}>Today's Log</div><div style={{ fontSize:16, fontWeight:700, color:todayLog?C.accent:C.amber }}>{todayLog?"✓ Logged":"⚠ Not logged yet"}</div></div>
          {todayLog && <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            {todayLog.weight&&<Stat label="Weight" value={todayLog.weight} unit="lbs" color={C.text}/>}
            {todayLog.energy&&<Stat label="Energy" value={todayLog.energy} unit="/10" color={C.accent}/>}
            {todayLog.sleep&&<Stat label="Sleep" value={todayLog.sleep} unit="hrs" color={C.blue}/>}
          </div>}
        </div>
      </Card>
      <div className="r-grid-3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        <Card><Stat label="Log Streak" value={streak} unit="days" color={C.amber} sub="Keep it up!"/></Card>
        <Card><Stat label="This Week" value={weekWorkouts} unit="sessions" color={C.blue}/></Card>
        <Card><Stat label="Active Goals" value={activeGoals.length} color={C.purple}/></Card>
      </div>
      {lastSess && <Card style={{ border:`1px solid ${C.blue}33` }}>
        <div style={{ fontSize:12, color:C.blue, fontWeight:800, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.1em" }}>Last Session</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:16, fontWeight:800, color:C.text }}>{lastSess.template_name}</div><div style={{ fontSize:13, color:C.subtext }}>{fmt(lastSess.date)} · {Math.floor((lastSess.duration_seconds||0)/60)}min · {Math.round(lastSess.total_volume||0).toLocaleString()}lbs</div></div>
          <Tag color={C.blue}>{fmt(lastSess.date)}</Tag>
        </div>
      </Card>}
      {last7logs.length>1 && <Card>
        <div style={{ fontSize:12, color:C.accent, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>7-Day Wellbeing</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={last7logs}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={[0,10]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
            <Line type="monotone" dataKey="energy" name="Energy" stroke={C.accent} strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="mood" name="Mood" stroke={C.purple} strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>}
      {activeGoals.length>0 && <Card>
        <div style={{ fontSize:12, color:C.purple, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Active Goals</div>
        {activeGoals.slice(0,4).map(g=><div key={g.id} style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ fontSize:14, color:C.text, fontWeight:600 }}>{g.title}</span>
            <span style={{ fontSize:12, color:C.muted }}>{g.progress}%</span>
          </div>
          <div style={{ height:4, background:C.surface, borderRadius:2 }}><div style={{ height:"100%", width:`${g.progress}%`, background:C.purple, borderRadius:2, transition:"width 0.3s" }}/></div>
        </div>)}
      </Card>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════════
const NAV=[{id:"dashboard",icon:"◈",label:"Dashboard"},{id:"daily",icon:"◎",label:"Daily Log"},{id:"gym",icon:"◉",label:"Gym"},{id:"body",icon:"◌",label:"Body"},{id:"goals",icon:"◆",label:"Goals"},{id:"analytics",icon:"◐",label:"Analytics"}];

export default function LifeOS() {
  const [tab,setTab]=useState("dashboard");
  const isMobile=useIsMobile();
  const pages={dashboard:Dashboard,daily:DailyLog,gym:Gym,body:Body,goals:Goals,analytics:Analytics};
  const Page=pages[tab];
  return (
    <div style={{ width:"100vw", minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{width:100%;min-height:100vh;background:#08080d;}
        body{overflow-x:hidden;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:8px;}
        input[type=range]{-webkit-appearance:none;height:3px;background:#1e1e2e;border-radius:8px;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #08080d;}
        select option{background:#101018;}
        select{transition:border-color 0.2s,box-shadow 0.2s;}
        select:focus{outline:none;border-color:#00ff88!important;box-shadow:0 0 0 3px rgba(0,255,136,0.12)!important;}
        button:not(:disabled):active{transform:scale(0.96)!important;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .page-fade{animation:fadeIn 0.18s ease-out;}
        @media(max-width:639px){
          .r-grid-2{grid-template-columns:1fr!important;}
          .r-grid-3{grid-template-columns:repeat(2,1fr)!important;}
          .r-grid-4{grid-template-columns:repeat(2,1fr)!important;}
        }
      `}</style>
      <div style={{ position:"sticky", top:0, zIndex:100, background:"#0a0a0fee", backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${C.accent},#4d8fff)`, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#000", boxShadow:`0 4px 14px ${C.accent}44` }}>L</div>
          <span style={{ fontWeight:900, fontSize:17, letterSpacing:"-0.03em", background:`linear-gradient(135deg,${C.accent},#4d8fff)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>LifeOS</span>
          <span style={{ fontSize:11, color:C.muted, fontWeight:600 }}>v2.0</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:C.accent, boxShadow:`0 0 6px ${C.accent}` }}/>
          <span style={{ fontSize:11, color:C.subtext }}>Cloud sync</span>
        </div>
      </div>
      {isMobile ? (
        <>
          <main style={{ flex:1, padding:"16px 14px 76px", overflowY:"auto", minHeight:"calc(100vh - 57px)" }}>
            <div key={tab} className="page-fade"><Page/></div>
          </main>
          <nav style={{ position:"fixed", bottom:0, left:0, right:0, display:"flex", background:"#0a0a0fee", backdropFilter:"blur(12px)", borderTop:`1px solid ${C.border}`, zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"8px 4px", background:"transparent", border:"none", borderTop:`2px solid ${tab===n.id?C.accent:"transparent"}`, color:tab===n.id?C.accent:C.muted, cursor:"pointer", fontSize:9, fontWeight:tab===n.id?700:500, fontFamily:"inherit", transition:"color 0.15s" }}>
                <span style={{ fontSize:18, lineHeight:1 }}>{n.icon}</span>
                {n.label.split(" ")[0]}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <div style={{ display:"flex", minHeight:"calc(100vh - 57px)" }}>
          <nav style={{ width:180, padding:"24px 12px", borderRight:`1px solid ${C.border}`, flexShrink:0, display:"flex", flexDirection:"column", gap:4 }}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:tab===n.id?C.accentDim:"transparent", border:"none", borderRadius:8, borderLeft:tab===n.id?`3px solid ${C.accent}`:"3px solid transparent", color:tab===n.id?C.accent:C.subtext, cursor:"pointer", fontSize:14, fontWeight:tab===n.id?700:500, textAlign:"left", transition:"all 0.15s", fontFamily:"inherit", width:"100%" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>
          <main style={{ flex:1, padding:"24px 28px", overflowY:"auto" }}>
            <div key={tab} className="page-fade"><Page/></div>
          </main>
        </div>
      )}
      <ToastContainer/>
    </div>
  );
}
