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
const C = { bg:"#0a0a0f", surface:"#12121a", card:"#16161f", border:"#1e1e2e", accent:"#00ff88", accentDim:"#00ff8822", accentMid:"#00ff8855", red:"#ff4466", amber:"#ffaa00", blue:"#4488ff", purple:"#aa44ff", text:"#e8e8f0", muted:"#5a5a7a", subtext:"#9090b0" };

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

// ─── UI PRIMITIVES ───────────────────────────────────────────────────────────
const Tag = ({ children, color = C.accent }) => <span style={{ background: color+"22", color, border:`1px solid ${color}44`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{children}</span>;
const Card = ({ children, style={} }) => <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, ...style }}>{children}</div>;
const Spinner = () => <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60 }}><div style={{ width:32, height:32, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

const Btn = ({ children, onClick, variant="primary", small=false, disabled=false, full=false, style={} }) => {
  const vs = { primary:{background:C.accent,color:"#000",border:"none"}, ghost:{background:"transparent",color:C.accent,border:`1px solid ${C.accent}44`}, danger:{background:C.red+"22",color:C.red,border:`1px solid ${C.red}44`}, amber:{background:C.amber+"22",color:C.amber,border:`1px solid ${C.amber}44`} };
  return <button onClick={onClick} disabled={disabled} style={{ ...vs[variant], borderRadius:8, padding:small?"6px 14px":"11px 22px", fontSize:small?12:14, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, letterSpacing:"0.04em", transition:"all 0.15s", width:full?"100%":"auto", fontFamily:"inherit", ...style }}
    onMouseOver={e=>!disabled&&(e.currentTarget.style.opacity="0.8")} onMouseOut={e=>!disabled&&(e.currentTarget.style.opacity="1")}>{children}</button>;
};

const Input = ({ label, type="number", value, onChange, min, max, step=1, unit, placeholder }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}{unit && <span style={{ color:C.subtext }}> ({unit})</span>}</label>}
    <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(type==="number"?parseFloat(e.target.value)||"":e.target.value)} min={min} max={max} step={step}
      style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"10px 12px", fontSize:15, outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.2s" }}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border} />
  </div>
);

const Slider = ({ label, value, onChange, min=1, max=10, color=C.accent }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <label style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</label>
      <span style={{ fontSize:18, fontWeight:800, color, fontFamily:"'DM Mono',monospace" }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e=>onChange(parseInt(e.target.value))} style={{ width:"100%", accentColor:color, cursor:"pointer" }} />
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.muted }}><span>{min} — Low</span><span>High — {max}</span></div>
  </div>
);

const Stat = ({ label, value, unit, color=C.accent, sub }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
    <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700 }}>{label}</div>
    <div style={{ fontSize:28, fontWeight:900, color, fontFamily:"'DM Mono',monospace", lineHeight:1 }}>{value}<span style={{ fontSize:13, fontWeight:500, color:C.subtext, marginLeft:3 }}>{unit}</span></div>
    {sub && <div style={{ fontSize:11, color:C.subtext }}>{sub}</div>}
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom:20 }}>
    <h2 style={{ margin:0, fontSize:20, fontWeight:900, color:C.text, letterSpacing:"-0.02em" }}>{title}</h2>
    {subtitle && <p style={{ margin:"4px 0 0", fontSize:13, color:C.subtext }}>{subtitle}</p>}
  </div>
);

const CTip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px" }}>
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
    if (paused||rem<=0) { if(rem<=0) onDone?.(); return; }
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
        completed: false, pr: false,
      }));
    })
  );

  useEffect(() => {
    const t = setInterval(()=>setElapsed(Math.floor((Date.now()-startRef.current)/1000)), 1000);
    return ()=>clearInterval(t);
  }, []);

  const curEx = exercises[exIdx];
  const curSets = setLog[exIdx]||[];
  const prevSetsForEx = lastSets.filter(s=>s.exercise===curEx.exercise);
  const nextTarget = calcNextTarget(curEx.exercise, curEx, prevSetsForEx);
  const totalSets = setLog.flat().length;
  const doneSets = setLog.flat().filter(s=>s.completed).length;

  const updateSet = (si, key, val) => setSetLog(prev=>prev.map((exs,ei)=>ei!==exIdx?exs:exs.map((s,i)=>i!==si?s:{...s,[key]:val})));

  useEffect(() => {
    setRestSecs(exercises[exIdx]?.rest_seconds || 120);
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

  const finishWorkout = async () => {
    setSaving(true);
    const allSets = setLog.flat().filter(s=>s.completed);
    const vol = allSets.reduce((sum,s)=>(parseFloat(s.actualWeight)||0)*(parseInt(s.actualReps)||0)+sum,0);
    const sid = uid();
    await sb.from("workout_sessions").insert({ id:sid, template_id:template.id, template_name:template.name, started_at:new Date(startRef.current).toISOString(), finished_at:new Date().toISOString(), duration_seconds:elapsed, total_volume:vol, date:today() });
    if (allSets.length) await sb.from("session_sets").insert(allSets.map((s,i)=>({ id:uid()+i, session_id:sid, exercise:s.exercise, set_number:s.idx+1, target_weight:s.targetWeight, target_reps:s.targetReps, actual_weight:parseFloat(s.actualWeight)||0, actual_reps:parseInt(s.actualReps)||0, completed:true, pr:s.pr })));
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
        {exercises.map((ex,i)=>{
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:C.text, marginBottom:4 }}>{curEx.exercise}</div>
            <div style={{ fontSize:12, color:nextTarget.arrow==="↑"?C.accent:nextTarget.arrow==="↓"?C.red:C.subtext, fontWeight:600 }}>{nextTarget.note}</div>
          </div>
          <button onClick={()=>setShowPlates(p=>!p)} style={{ background:C.amber+"22", border:`1px solid ${C.amber}44`, color:C.amber, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {showPlates?"Hide":"🏋️ Plates"}
          </button>
        </div>

        {showPlates && <div style={{ marginBottom:16 }}><PlateCalc defaultWeight={parseFloat(curSets[0]?.actualWeight)||135} /></div>}

        {/* Set table */}
        <div style={{ display:"grid", gridTemplateColumns:"36px 80px 1fr 1fr 44px", gap:8, marginBottom:8 }}>
          {["Set","Target","Weight","Reps",""].map(h=><div key={h} style={{ fontSize:10, color:C.muted, textTransform:"uppercase", fontWeight:700, textAlign:"center" }}>{h}</div>)}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {curSets.map((s,si)=>(
            <div key={si} style={{ display:"grid", gridTemplateColumns:"36px 80px 1fr 1fr 44px", gap:8, alignItems:"center", opacity:s.completed?0.55:1 }}>
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
        {exIdx<exercises.length-1 && <Btn onClick={()=>{setResting(false);setExIdx(i=>i+1);}} variant="ghost" style={{ marginLeft:"auto" }}>Next →</Btn>}
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
    if (!buildName.trim()) return alert("Give your workout a name");
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
function DailyLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date:today(), weight:"", sleep:7, energy:7, mood:7, stress:4, protein:"", carbs:"", fat:"", water:"", steps:"", notes:"" });
  const f = (k)=>(v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    sb.from("daily_logs").select("*").order("date",{ascending:true}).then(({data})=>{
      if(data){ setLogs(data); const tl=data.find(l=>l.date===today()); if(tl) setForm({date:tl.date,weight:tl.weight||"",sleep:tl.sleep||7,energy:tl.energy||7,mood:tl.mood||7,stress:tl.stress||4,protein:tl.protein||"",carbs:tl.carbs||"",fat:tl.fat||"",water:tl.water||"",steps:tl.steps||"",notes:tl.notes||""}); }
      setLoading(false);
    });
  },[]);

  const save = async () => {
    setSaving(true);
    const { error } = await sb.from("daily_logs").upsert({ date:form.date, weight:form.weight||null, sleep:form.sleep, energy:form.energy, mood:form.mood, stress:form.stress, protein:form.protein||null, carbs:form.carbs||null, fat:form.fat||null, water:form.water||null, steps:form.steps||null, notes:form.notes||null, saved_at:new Date().toISOString() }, { onConflict:"date" });
    if(!error){ const {data}=await sb.from("daily_logs").select("*").order("date"); if(data)setLogs(data); alert("✓ Saved!"); } else alert("Error: "+error.message);
    setSaving(false);
  };

  if(loading) return <Spinner />;
  const cals = (form.protein?form.protein*4:0)+(form.carbs?form.carbs*4:0)+(form.fat?form.fat*9:0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <SectionHeader title="Daily Log" subtitle={new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} />
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
      <Card>
        <div style={{ fontSize:12, color:C.purple, fontWeight:800, marginBottom:18, textTransform:"uppercase", letterSpacing:"0.1em" }}>Wellbeing</div>
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <Slider label="Sleep hours" value={form.sleep} onChange={f("sleep")} min={3} max={12} color={C.blue} />
          <Slider label="Energy" value={form.energy} onChange={f("energy")} color={C.accent} />
          <Slider label="Mood" value={form.mood} onChange={f("mood")} color={C.purple} />
          <Slider label="Stress" value={form.stress} onChange={f("stress")} color={C.red} />
        </div>
      </Card>
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
function Body() {
  const [measurements, setMeasurements] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date:today(), chest:"", waist:"", hips:"", neck:"", shoulder:"", bicep:"", thigh:"", calf:"", bf:"" });
  const f = (k)=>(v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{ Promise.all([sb.from("measurements").select("*").order("date",{ascending:true}), sb.from("daily_logs").select("date,weight").order("date",{ascending:true})]).then(([m,l])=>{ if(m.data)setMeasurements(m.data); if(l.data)setLogs(l.data); setLoading(false); }); },[]);

  const save = async () => { setSaving(true); const {error}=await sb.from("measurements").upsert({date:form.date,chest:form.chest||null,waist:form.waist||null,hips:form.hips||null,neck:form.neck||null,shoulder:form.shoulder||null,bicep:form.bicep||null,thigh:form.thigh||null,calf:form.calf||null,bf:form.bf||null},{onConflict:"date"}); if(!error){const{data}=await sb.from("measurements").select("*").order("date");if(data)setMeasurements(data);alert("✓ Saved!");} setSaving(false); };

  if(loading) return <Spinner />;
  const wData = logs.filter(l=>l.weight).map(l=>({date:l.date,weight:parseFloat(l.weight)}));
  const fields=[{k:"chest",l:"Chest"},{k:"waist",l:"Waist"},{k:"hips",l:"Hips"},{k:"neck",l:"Neck"},{k:"shoulder",l:"Shoulders"},{k:"bicep",l:"Bicep"},{k:"thigh",l:"Thigh"},{k:"calf",l:"Calf"}];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <SectionHeader title="Body Recomp" subtitle="Track measurements & weight trend" />
      {wData.length>2 && <Card>
        <div style={{ fontSize:12, color:C.accent, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Weight Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={wData}>
            <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/>
            <YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}}/>
            <Tooltip content={<CTip />}/>
            <Area type="monotone" dataKey="weight" name="Weight" stroke={C.accent} fill="url(#wg)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>}
      <Card>
        <div style={{ fontSize:12, color:C.blue, fontWeight:800, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.1em" }}>Log Measurements</div>
        <div style={{ marginBottom:14 }}><Input label="Date" type="text" value={form.date} onChange={f("date")} /></div>
        <div className="r-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          {fields.map(({k,l})=><Input key={k} label={l} value={form[k]} onChange={f(k)} step={0.1} unit="in"/>)}
        </div>
        <div style={{ marginBottom:14 }}><Input label="Body Fat %" value={form.bf} onChange={f("bf")} step={0.1} unit="%"/></div>
        <Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save Measurements"}</Btn>
      </Card>
      {measurements.length>0 && <Card>
        <div style={{ fontSize:12, color:C.purple, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>History</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr>{["Date","Chest","Waist","Hips","Bicep","BF%"].map(h=><th key={h} style={{ textAlign:"left", padding:"6px 10px", borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:11, color:C.muted }}>{h}</th>)}</tr></thead>
            <tbody>{[...measurements].reverse().slice(0,10).map((m,i)=><tr key={i}>{[fmt(m.date),m.chest,m.waist,m.hips,m.bicep,m.bf].map((v,j)=><td key={j} style={{ padding:"8px 10px", borderBottom:`1px solid ${C.border}22`, color:C.subtext }}>{v||"—"}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Card>}
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
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
function Analytics() {
  const [logs,setLogs]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [range,setRange]=useState("30");
  useEffect(()=>{ Promise.all([sb.from("daily_logs").select("*").order("date",{ascending:true}),sb.from("workout_sessions").select("*").order("date",{ascending:true})]).then(([l,s])=>{if(l.data)setLogs(l.data);if(s.data)setSessions(s.data);setLoading(false);}); },[]);
  if(loading) return <Spinner />;
  const sliced=range==="7"?last7(logs):logs.slice(-30);
  const data=sliced.map(l=>({date:l.date,weight:parseFloat(l.weight)||null,energy:l.energy,mood:l.mood,sleep:l.sleep,protein:parseFloat(l.protein)||null}));
  const vByDay={}; sessions.forEach(s=>{vByDay[s.date]=(vByDay[s.date]||0)+(s.total_volume||0);});
  const volData=data.map(d=>({date:d.date,volume:Math.round(vByDay[d.date]||0)}));
  const wkCount=sessions.filter(s=>data.some(d=>d.date===s.date)).length;
  const exportAll=async()=>{ const[l,s,g,m]=await Promise.all([sb.from("daily_logs").select("*"),sb.from("workout_sessions").select("*"),sb.from("goals").select("*"),sb.from("measurements").select("*")]); const blob=new Blob([JSON.stringify({logs:l.data,sessions:s.data,goals:g.data,measurements:m.data},null,2)],{type:"application/json"}); const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`lifeos-${today()}.json`;a.click(); };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <SectionHeader title="Analytics" subtitle="Your trends at a glance"/>
        <div style={{ display:"flex", gap:8 }}>{["7","30"].map(r=><Btn key={r} onClick={()=>setRange(r)} variant={range===r?"primary":"ghost"} small>{r}D</Btn>)}</div>
      </div>
      <Card><div className="r-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
        <Stat label="Avg Energy" value={avg(data.filter(d=>d.energy).map(d=>d.energy))} unit="/10" color={C.accent}/>
        <Stat label="Avg Mood" value={avg(data.filter(d=>d.mood).map(d=>d.mood))} unit="/10" color={C.purple}/>
        <Stat label="Avg Sleep" value={avg(data.filter(d=>d.sleep).map(d=>d.sleep))} unit="hrs" color={C.blue}/>
        <Stat label="Workouts" value={wkCount} color={C.amber}/>
      </div></Card>
      {data.length>1 && <Card>
        <div style={{ fontSize:12, color:C.accent, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Energy, Mood & Sleep</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={[0,12]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
            <Line type="monotone" dataKey="energy" name="Energy" stroke={C.accent} strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="mood" name="Mood" stroke={C.purple} strokeWidth={2} dot={false}/>
            <Line type="monotone" dataKey="sleep" name="Sleep" stroke={C.blue} strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </Card>}
      {data.filter(d=>d.weight).length>1 && <Card>
        <div style={{ fontSize:12, color:C.blue, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Weight</div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data.filter(d=>d.weight)}>
            <defs><linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.25}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis domain={["auto","auto"]} tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/>
            <Area type="monotone" dataKey="weight" name="Weight" stroke={C.blue} fill="url(#wg2)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>}
      {volData.some(d=>d.volume>0) && <Card>
        <div style={{ fontSize:12, color:C.amber, fontWeight:800, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.1em" }}>Lifting Volume</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={volData}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={fmt} tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CTip/>}/><Bar dataKey="volume" name="Volume (lbs)" fill={C.amber} radius={[4,4,0,0]}/></BarChart>
        </ResponsiveContainer>
      </Card>}
      {data.length===0 && <Card><p style={{ color:C.muted, textAlign:"center", padding:40 }}>Start logging daily to see your analytics.</p></Card>}
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body,#root{width:100%;min-height:100vh;background:#0a0a0f;}
        body{overflow-x:hidden;}
        ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:#0a0a0f;}::-webkit-scrollbar-thumb{background:#1e1e2e;border-radius:3px;}
        input[type=range]{-webkit-appearance:none;height:4px;background:#1e1e2e;border-radius:2px;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;cursor:pointer;}
        select option{background:#12121a;}
        @media(max-width:639px){
          .r-grid-2{grid-template-columns:1fr!important;}
          .r-grid-3{grid-template-columns:repeat(2,1fr)!important;}
          .r-grid-4{grid-template-columns:repeat(2,1fr)!important;}
        }
      `}</style>
      <div style={{ position:"sticky", top:0, zIndex:100, background:"#0a0a0fee", backdropFilter:"blur(12px)", borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, background:C.accent, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#000" }}>L</div>
          <span style={{ fontWeight:900, fontSize:16, letterSpacing:"-0.02em" }}>LifeOS</span>
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
            <Page/>
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
              <button key={n.id} onClick={()=>setTab(n.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:tab===n.id?C.accentDim:"transparent", border:tab===n.id?`1px solid ${C.accentMid}`:"1px solid transparent", borderRadius:8, color:tab===n.id?C.accent:C.subtext, cursor:"pointer", fontSize:14, fontWeight:tab===n.id?700:500, textAlign:"left", transition:"all 0.15s", fontFamily:"inherit" }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>
          <main style={{ flex:1, padding:"24px 28px", overflowY:"auto" }}>
            <Page/>
          </main>
        </div>
      )}
    </div>
  );
}
