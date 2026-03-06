import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ─── STORAGE ────────────────────────────────────────────────────────────────
const KEYS = {
  logs: "lifeos:daily_logs",
  workouts: "lifeos:workouts",
  goals: "lifeos:goals",
  measurements: "lifeos:measurements",
};

const store = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "—";
const last7 = (arr) => arr.slice(-7);
const last30 = (arr) => arr.slice(-30);

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  card: "#16161f",
  border: "#1e1e2e",
  accent: "#00ff88",
  accentDim: "#00ff8822",
  accentMid: "#00ff8855",
  red: "#ff4466",
  amber: "#ffaa00",
  blue: "#4488ff",
  purple: "#aa44ff",
  text: "#e8e8f0",
  muted: "#5a5a7a",
  subtext: "#9090b0",
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const Tag = ({ children, color = C.accent }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase"
  }}>{children}</span>
);

const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 20, ...style
  }}>{children}</div>
);

const Input = ({ label, type = "number", value, onChange, min, max, step = 1, unit }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
      {label} {unit && <span style={{ color: C.subtext }}>({unit})</span>}
    </label>
    <input
      type={type} value={value} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
      min={min} max={max} step={step}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.text, padding: "10px 12px", fontSize: 15, outline: "none",
        transition: "border-color 0.2s", width: "100%", boxSizing: "border-box"
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

const Slider = ({ label, value, onChange, min = 1, max = 10, color = C.accent }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <label style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</label>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'DM Mono', monospace" }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))}
      style={{ width: "100%", accentColor: color, cursor: "pointer" }} />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted }}>
      <span>{min} — Low</span><span>High — {max}</span>
    </div>
  </div>
);

const Btn = ({ children, onClick, variant = "primary", small = false, style = {} }) => {
  const styles = {
    primary: { background: C.accent, color: "#000", border: "none" },
    ghost: { background: "transparent", color: C.accent, border: `1px solid ${C.accent}44` },
    danger: { background: C.red + "22", color: C.red, border: `1px solid ${C.red}44` },
  };
  return (
    <button onClick={onClick} style={{
      ...styles[variant], borderRadius: 8, padding: small ? "6px 14px" : "11px 22px",
      fontSize: small ? 12 : 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
      transition: "all 0.15s", ...style
    }}
      onMouseOver={e => e.currentTarget.style.opacity = "0.85"}
      onMouseOut={e => e.currentTarget.style.opacity = "1"}
    >{children}</button>
  );
};

const Stat = ({ label, value, unit, color = C.accent, sub }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
      {value}<span style={{ fontSize: 13, fontWeight: 500, color: C.subtext, marginLeft: 3 }}>{unit}</span>
    </div>
    {sub && <div style={{ fontSize: 11, color: C.subtext }}>{sub}</div>}
  </div>
);

const SectionHeader = ({ title, subtitle }) => (
  <div style={{ marginBottom: 20 }}>
    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: "-0.02em" }}>{title}</h2>
    {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: C.subtext }}>{subtitle}</p>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{fmt(label)}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: p.color, fontWeight: 700 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "◈", label: "Dashboard" },
  { id: "daily", icon: "◎", label: "Daily Log" },
  { id: "lifting", icon: "◉", label: "Lifting" },
  { id: "body", icon: "◌", label: "Body" },
  { id: "goals", icon: "◆", label: "Goals" },
  { id: "analytics", icon: "◐", label: "Analytics" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LOG
// ═══════════════════════════════════════════════════════════════════════════════
function DailyLog() {
  const [logs, setLogs] = useState(() => store.get(KEYS.logs));
  const todayLog = logs.find(l => l.date === today()) || {};
  const [form, setForm] = useState({
    date: today(),
    weight: todayLog.weight || "",
    sleep: todayLog.sleep || 7,
    energy: todayLog.energy || 7,
    mood: todayLog.mood || 7,
    stress: todayLog.stress || 4,
    protein: todayLog.protein || "",
    carbs: todayLog.carbs || "",
    fat: todayLog.fat || "",
    water: todayLog.water || "",
    steps: todayLog.steps || "",
    notes: todayLog.notes || "",
  });

  const f = (key) => (val) => setForm(p => ({ ...p, [key]: val }));

  const save = () => {
    const updated = logs.filter(l => l.date !== form.date);
    const saved = [...updated, { ...form, savedAt: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date));
    store.set(KEYS.logs, saved);
    setLogs(saved);
    alert("✓ Day logged!");
  };

  const calories = (form.protein ? form.protein * 4 : 0) + (form.carbs ? form.carbs * 4 : 0) + (form.fat ? form.fat * 9 : 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="Daily Log" subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Body */}
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Body</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Weight" value={form.weight} onChange={f("weight")} step={0.1} unit="lbs" />
            <Input label="Steps" value={form.steps} onChange={f("steps")} unit="steps" />
            <Input label="Water" value={form.water} onChange={f("water")} step={0.5} unit="oz" />
          </div>
        </Card>

        {/* Macros */}
        <Card>
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Macros {calories > 0 && <span style={{ color: C.subtext, fontSize: 11 }}>· {Math.round(calories)} kcal</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Protein" value={form.protein} onChange={f("protein")} unit="g" />
            <Input label="Carbs" value={form.carbs} onChange={f("carbs")} unit="g" />
            <Input label="Fat" value={form.fat} onChange={f("fat")} unit="g" />
          </div>
        </Card>
      </div>

      {/* Wellbeing */}
      <Card>
        <div style={{ fontSize: 12, color: C.purple, fontWeight: 800, marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.1em" }}>Wellbeing</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Slider label="Sleep hours" value={form.sleep} onChange={f("sleep")} min={3} max={12} color={C.blue} />
          <Slider label="Energy" value={form.energy} onChange={f("energy")} color={C.accent} />
          <Slider label="Mood" value={form.mood} onChange={f("mood")} color={C.purple} />
          <Slider label="Stress" value={form.stress} onChange={f("stress")} color={C.red} />
        </div>
      </Card>

      {/* Notes */}
      <Card>
        <div style={{ fontSize: 12, color: C.amber, fontWeight: 800, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Notes & Wins</div>
        <textarea
          value={form.notes} onChange={e => f("notes")(e.target.value)}
          placeholder="What went well? How do you feel? Any insights..."
          style={{
            width: "100%", minHeight: 90, background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, color: C.text, padding: 12, fontSize: 14, resize: "vertical",
            outline: "none", fontFamily: "inherit", boxSizing: "border-box"
          }}
          onFocus={e => e.target.style.borderColor = C.amber}
          onBlur={e => e.target.style.borderColor = C.border}
        />
      </Card>

      <Btn onClick={save}>Save Today's Log</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIFTING
// ═══════════════════════════════════════════════════════════════════════════════
const EXERCISES = [
  "Squat", "Bench Press", "Deadlift", "Overhead Press", "Barbell Row",
  "Pull-up", "Dip", "Incline Press", "Romanian Deadlift", "Leg Press",
  "Hip Thrust", "Cable Row", "Lat Pulldown", "Tricep Pushdown", "Curl",
  "Lateral Raise", "Face Pull", "Leg Curl", "Leg Extension", "Calf Raise",
];

function Lifting() {
  const [workouts, setWorkouts] = useState(() => store.get(KEYS.workouts));
  const [showForm, setShowForm] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(today());
  const [workoutName, setWorkoutName] = useState("");
  const [sets, setSets] = useState([{ exercise: "Squat", weight: "", reps: "", sets: "" }]);

  const addSet = () => setSets(p => [...p, { exercise: "Squat", weight: "", reps: "", sets: "" }]);
  const removeSet = (i) => setSets(p => p.filter((_, idx) => idx !== i));
  const updateSet = (i, key, val) => setSets(p => p.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  const saveWorkout = () => {
    const w = { date: workoutDate, name: workoutName || "Workout", sets, id: Date.now() };
    const updated = [...workouts, w].sort((a, b) => a.date.localeCompare(b.date));
    store.set(KEYS.workouts, updated);
    setWorkouts(updated);
    setShowForm(false);
    setSets([{ exercise: "Squat", weight: "", reps: "", sets: "" }]);
    setWorkoutName("");
  };

  // PRs
  const prs = {};
  workouts.forEach(w => w.sets?.forEach(s => {
    const vol = (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
    if (!prs[s.exercise] || vol > prs[s.exercise].vol) {
      prs[s.exercise] = { weight: s.weight, reps: s.reps, vol, date: w.date };
    }
  }));

  const recent = [...workouts].reverse().slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionHeader title="Lifting" subtitle="Track workouts & progressive overload" />
        <Btn onClick={() => setShowForm(!showForm)} variant={showForm ? "danger" : "primary"}>
          {showForm ? "Cancel" : "+ Log Workout"}
        </Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <Input label="Date" type="text" value={workoutDate} onChange={setWorkoutDate} />
            <Input label="Workout name" type="text" value={workoutName} onChange={setWorkoutName} />
          </div>

          {sets.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Exercise</label>
                <select value={s.exercise} onChange={e => updateSet(i, "exercise", e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none" }}>
                  {EXERCISES.map(ex => <option key={ex}>{ex}</option>)}
                </select>
              </div>
              <Input label="Weight" value={s.weight} onChange={v => updateSet(i, "weight", v)} unit="lbs" />
              <Input label="Reps" value={s.reps} onChange={v => updateSet(i, "reps", v)} />
              <Input label="Sets" value={s.sets} onChange={v => updateSet(i, "sets", v)} />
              <button onClick={() => removeSet(i)} style={{ background: C.red + "22", border: `1px solid ${C.red}44`, color: C.red, borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontSize: 16, alignSelf: "end" }}>✕</button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Btn onClick={addSet} variant="ghost" small>+ Add Exercise</Btn>
            <Btn onClick={saveWorkout}>Save Workout</Btn>
          </div>
        </Card>
      )}

      {/* PRs */}
      {Object.keys(prs).length > 0 && (
        <Card>
          <div style={{ fontSize: 12, color: C.amber, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Personal Records</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {Object.entries(prs).slice(0, 8).map(([ex, pr]) => (
              <div key={ex} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", minWidth: 130 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", fontWeight: 700 }}>{ex}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontFamily: "'DM Mono', monospace" }}>{pr.weight}<span style={{ fontSize: 11, color: C.subtext }}>lbs</span></div>
                <div style={{ fontSize: 12, color: C.subtext }}>{pr.reps} reps · {fmt(pr.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent workouts */}
      <Card>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Recent Workouts</div>
        {recent.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 14 }}>No workouts logged yet. Hit that + button!</p>
        ) : recent.map(w => (
          <div key={w.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: C.text }}>{w.name}</span>
              <Tag color={C.blue}>{fmt(w.date)}</Tag>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {w.sets?.map((s, i) => (
                <span key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, color: C.subtext }}>
                  {s.exercise} {s.weight && `· ${s.weight}lbs`} {s.sets && `· ${s.sets}×${s.reps}`}
                </span>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BODY RECOMP
// ═══════════════════════════════════════════════════════════════════════════════
function Body() {
  const [measurements, setMeasurements] = useState(() => store.get(KEYS.measurements));
  const [form, setForm] = useState({ date: today(), chest: "", waist: "", hips: "", neck: "", shoulder: "", bicep: "", thigh: "", calf: "", bf: "", notes: "" });
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    const updated = [...measurements.filter(m => m.date !== form.date), { ...form }].sort((a, b) => a.date.localeCompare(b.date));
    store.set(KEYS.measurements, updated);
    setMeasurements(updated);
    alert("✓ Measurements saved!");
  };

  const logs = store.get(KEYS.logs);
  const weightData = logs.slice(-30).map(l => ({ date: l.date, weight: parseFloat(l.weight) || null })).filter(l => l.weight);

  const fields = [
    { key: "chest", label: "Chest" }, { key: "waist", label: "Waist" },
    { key: "hips", label: "Hips" }, { key: "neck", label: "Neck" },
    { key: "shoulder", label: "Shoulders" }, { key: "bicep", label: "Bicep" },
    { key: "thigh", label: "Thigh" }, { key: "calf", label: "Calf" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeader title="Body Recomp" subtitle="Track measurements & weight trend" />

      {/* Weight trend */}
      {weightData.length > 2 && (
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Weight Trend · 30 Days</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weightData}>
              <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.accent} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="weight" name="Weight" stroke={C.accent} fill="url(#wg)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Measurements form */}
      <Card>
        <div style={{ fontSize: 12, color: C.blue, fontWeight: 800, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.1em" }}>Log Measurements</div>
        <div style={{ marginBottom: 14 }}>
          <Input label="Date" type="text" value={form.date} onChange={f("date")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {fields.map(({ key, label }) => (
            <Input key={key} label={label} value={form[key]} onChange={f(key)} step={0.1} unit="in" />
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <Input label="Body Fat %" value={form.bf} onChange={f("bf")} step={0.1} unit="%" />
        </div>
        <Btn onClick={save}>Save Measurements</Btn>
      </Card>

      {/* History */}
      {measurements.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>History</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.muted }}>
                  {["Date", "Chest", "Waist", "Hips", "Bicep", "BF%"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().slice(0, 8).map((m, i) => (
                  <tr key={i} style={{ color: C.subtext }}>
                    {[fmt(m.date), m.chest, m.waist, m.hips, m.bicep, m.bf].map((v, j) => (
                      <td key={j} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}22` }}>{v || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════════════════════
const GOAL_CATS = ["Health", "Fitness", "Career", "Finance", "Personal", "Learning", "Relationships"];

function Goals() {
  const [goals, setGoals] = useState(() => store.get(KEYS.goals));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Health", target: "", deadline: "", progress: 0, notes: "", status: "active" });
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const save = () => {
    const g = { ...form, id: Date.now(), created: today() };
    const updated = [...goals, g];
    store.set(KEYS.goals, updated);
    setGoals(updated);
    setShowForm(false);
    setForm({ title: "", category: "Health", target: "", deadline: "", progress: 0, notes: "", status: "active" });
  };

  const updateGoal = (id, key, val) => {
    const updated = goals.map(g => g.id === id ? { ...g, [key]: val } : g);
    store.set(KEYS.goals, updated);
    setGoals(updated);
  };

  const deleteGoal = (id) => {
    const updated = goals.filter(g => g.id !== id);
    store.set(KEYS.goals, updated);
    setGoals(updated);
  };

  const catColor = { Health: C.accent, Fitness: C.blue, Career: C.amber, Finance: C.accent, Personal: C.purple, Learning: C.blue, Relationships: C.red };

  const active = goals.filter(g => g.status === "active");
  const done = goals.filter(g => g.status === "complete");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionHeader title="Goals" subtitle={`${active.length} active · ${done.length} complete`} />
        <Btn onClick={() => setShowForm(!showForm)} variant={showForm ? "danger" : "primary"}>
          {showForm ? "Cancel" : "+ New Goal"}
        </Btn>
      </div>

      {showForm && (
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Goal title" type="text" value={form.title} onChange={f("title")} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Category</label>
                <select value={form.category} onChange={e => f("category")(e.target.value)}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "10px 12px", fontSize: 14, outline: "none" }}>
                  {GOAL_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <Input label="Deadline" type="text" value={form.deadline} onChange={f("deadline")} />
            </div>
            <Input label="Target / Metric" type="text" value={form.target} onChange={f("target")} />
            <Input label="Notes" type="text" value={form.notes} onChange={f("notes")} />
            <Btn onClick={save}>Save Goal</Btn>
          </div>
        </Card>
      )}

      {active.map(g => (
        <Card key={g.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 16, marginBottom: 4 }}>{g.title}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Tag color={catColor[g.category] || C.accent}>{g.category}</Tag>
                {g.deadline && <Tag color={C.muted}>{g.deadline}</Tag>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => updateGoal(g.id, "status", "complete")} variant="ghost" small>✓ Done</Btn>
              <Btn onClick={() => deleteGoal(g.id)} variant="danger" small>✕</Btn>
            </div>
          </div>
          {g.target && <div style={{ fontSize: 13, color: C.subtext, marginBottom: 12 }}>Target: {g.target}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
              <span>Progress</span><span>{g.progress}%</span>
            </div>
            <input type="range" min={0} max={100} value={g.progress} onChange={e => updateGoal(g.id, "progress", parseInt(e.target.value))}
              style={{ width: "100%", accentColor: catColor[g.category] || C.accent }} />
            <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${g.progress}%`, background: catColor[g.category] || C.accent, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>Completed 🎯</div>
          {done.map(g => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ color: C.subtext, textDecoration: "line-through", fontSize: 14 }}>{g.title}</span>
              <Btn onClick={() => updateGoal(g.id, "status", "active")} variant="ghost" small>Reopen</Btn>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════
function Analytics() {
  const logs = store.get(KEYS.logs);
  const workouts = store.get(KEYS.workouts);
  const [range, setRange] = useState("30");

  const data = (range === "7" ? last7(logs) : last30(logs)).map(l => ({
    date: l.date,
    weight: parseFloat(l.weight) || null,
    energy: l.energy,
    mood: l.mood,
    sleep: l.sleep,
    stress: l.stress,
    protein: parseFloat(l.protein) || null,
    calories: l.protein && l.carbs && l.fat ? Math.round(l.protein * 4 + l.carbs * 4 + l.fat * 9) : null,
  }));

  const workoutsByDay = {};
  workouts.forEach(w => {
    const vol = w.sets?.reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0) * (parseFloat(s.sets) || 1), 0) || 0;
    workoutsByDay[w.date] = (workoutsByDay[w.date] || 0) + vol;
  });

  const volData = data.map(d => ({ date: d.date, volume: workoutsByDay[d.date] || 0 }));

  const avgE = avg(data.filter(d => d.energy).map(d => d.energy));
  const avgM = avg(data.filter(d => d.mood).map(d => d.mood));
  const avgS = avg(data.filter(d => d.sleep).map(d => d.sleep));
  const workoutCount = workouts.filter(w => data.some(d => d.date === w.date)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SectionHeader title="Analytics" subtitle="Your trends at a glance" />
        <div style={{ display: "flex", gap: 8 }}>
          {["7", "30"].map(r => (
            <Btn key={r} onClick={() => setRange(r)} variant={range === r ? "primary" : "ghost"} small>{r}D</Btn>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          <Stat label="Avg Energy" value={avgE} unit="/10" color={C.accent} />
          <Stat label="Avg Mood" value={avgM} unit="/10" color={C.purple} />
          <Stat label="Avg Sleep" value={avgS} unit="hrs" color={C.blue} />
          <Stat label="Workouts" value={workoutCount} color={C.amber} />
        </div>
      </Card>

      {/* Energy + Mood */}
      {data.length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Energy & Mood</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="energy" name="Energy" stroke={C.accent} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mood" name="Mood" stroke={C.purple} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sleep" name="Sleep" stroke={C.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Weight */}
      {data.filter(d => d.weight).length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Weight</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.filter(d => d.weight)}>
              <defs>
                <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="weight" name="Weight" stroke={C.blue} fill="url(#wg2)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Volume */}
      {volData.some(d => d.volume > 0) && (
        <Card>
          <div style={{ fontSize: 12, color: C.amber, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Lifting Volume</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={volData}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="volume" name="Volume (lbs)" fill={C.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Protein */}
      {data.filter(d => d.protein).length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Protein Intake</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={data.filter(d => d.protein)}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="protein" name="Protein (g)" fill={C.red} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {data.length === 0 && (
        <Card>
          <p style={{ color: C.muted, textAlign: "center", padding: 40 }}>Start logging daily to see your analytics appear here.</p>
        </Card>
      )}

      {/* Export */}
      <Btn variant="ghost" onClick={() => {
        const all = { logs: store.get(KEYS.logs), workouts: store.get(KEYS.workouts), goals: store.get(KEYS.goals), measurements: store.get(KEYS.measurements) };
        const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `lifeos-export-${today()}.json`;
        a.click();
      }}>↓ Export All Data</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const logs = store.get(KEYS.logs);
  const workouts = store.get(KEYS.workouts);
  const goals = store.get(KEYS.goals);
  const todayLog = logs.find(l => l.date === today());
  const last7logs = last7(logs);

  const streak = (() => {
    let s = 0;
    const d = new Date();
    while (true) {
      const ds = d.toISOString().slice(0, 10);
      if (logs.find(l => l.date === ds)) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();

  const weekWorkouts = workouts.filter(w => {
    const diff = (new Date() - new Date(w.date + "T12:00:00")) / 86400000;
    return diff <= 7;
  }).length;

  const activeGoals = goals.filter(g => g.status === "active");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 4 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.03em" }}>
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
        </h1>
      </div>

      {/* Today status */}
      <Card style={{ border: todayLog ? `1px solid ${C.accent}44` : `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Today's Log</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: todayLog ? C.accent : C.amber }}>
              {todayLog ? "✓ Logged" : "⚠ Not logged yet"}
            </div>
          </div>
          {todayLog && (
            <div style={{ display: "flex", gap: 20 }}>
              {todayLog.weight && <Stat label="Weight" value={todayLog.weight} unit="lbs" color={C.text} />}
              {todayLog.energy && <Stat label="Energy" value={todayLog.energy} unit="/10" color={C.accent} />}
              {todayLog.sleep && <Stat label="Sleep" value={todayLog.sleep} unit="hrs" color={C.blue} />}
            </div>
          )}
        </div>
      </Card>

      {/* Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Card>
          <Stat label="Log Streak" value={streak} unit="days" color={C.amber} sub="Keep it up!" />
        </Card>
        <Card>
          <Stat label="This Week" value={weekWorkouts} unit="workouts" color={C.blue} />
        </Card>
        <Card>
          <Stat label="Active Goals" value={activeGoals.length} color={C.purple} />
        </Card>
      </div>

      {/* 7-day energy + mood */}
      {last7logs.length > 1 && (
        <Card>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>7-Day Wellbeing</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={last7logs}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="energy" name="Energy" stroke={C.accent} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mood" name="Mood" stroke={C.purple} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Active goals preview */}
      {activeGoals.length > 0 && (
        <Card>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 800, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Active Goals</div>
          {activeGoals.slice(0, 4).map(g => (
            <div key={g.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{g.title}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{g.progress}%</span>
              </div>
              <div style={{ height: 4, background: C.surface, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${g.progress}%`, background: C.purple, borderRadius: 2, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function LifeOS() {
  const [tab, setTab] = useState("dashboard");

  const pages = { dashboard: Dashboard, daily: DailyLog, lifting: Lifting, body: Body, goals: Goals, analytics: Analytics };
  const Page = pages[tab];

  return (
    <div style={{ width: "100vw", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; background: ${C.bg}; }
        body { overflow-x: hidden; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input[type=range] { -webkit-appearance: none; height: 4px; background: ${C.border}; border-radius: 2px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; cursor: pointer; }
      `}</style>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: C.bg + "ee", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000" }}>L</div>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>LifeOS</span>
        </div>
        <Tag color={C.accent}>v1.0</Tag>
      </div>

      <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
        {/* Sidebar */}
        <nav style={{ width: 180, padding: "24px 12px", borderRight: `1px solid ${C.border}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: tab === n.id ? C.accentDim : "transparent",
              border: tab === n.id ? `1px solid ${C.accentMid}` : "1px solid transparent",
              borderRadius: 8, color: tab === n.id ? C.accent : C.subtext,
              cursor: "pointer", fontSize: 14, fontWeight: tab === n.id ? 700 : 500,
              textAlign: "left", transition: "all 0.15s", fontFamily: "inherit"
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
          <Page />
        </main>
      </div>
    </div>
  );
}
