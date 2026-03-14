import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LineChart, Line } from "recharts";

const g0 = 9.80665;
const AU = 1.496e11;
const muSun = 1.327e20;
const rEarth = 1.0 * AU;
const rMars = 1.524 * AU;

// ─── THRUSTER DATABASE ───
// VERIFIED = data from primary sources (SpaceX, NASA, manufacturer specs)
// ESTIMATED = derived/interpolated from published papers, not exact flight data
// PROJECTED = paper study, no hardware at this performance level
const THRUSTER_DB = [
  // Chemical — VERIFIED
  { id: "raptor3_sl", name: "Raptor 3 (Sea Level)", category: "Chemical", isp: 350, thrust: 2747000, power: 0, mass: 1525,
    massBkdn: { engine: 1525, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "VERIFIED: SpaceX official (Aug 2024): 280tf, 350s vac Isp for SL variant, 1525 kg engine mass. LOX/CH4. Full-flow staged combustion.", trl: 7 },
  { id: "raptor2_vac", name: "Raptor 2 Vacuum", category: "Chemical", isp: 363, thrust: 2530000, power: 0, mass: 1670,
    massBkdn: { engine: 1670, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "VERIFIED: SpaceX (Apr 2024): RVac2 258tf, ~363s Isp. Mass ~1670 kg (est from R2 SL 1630 kg + nozzle). Currently flying on Starship.", trl: 8 },
  { id: "raptor_vac_future", name: "Raptor 3/4 Vacuum (Proj)", category: "Chemical", isp: 380, thrust: 3000000, power: 0, mass: 1600,
    massBkdn: { engine: 1600, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "PROJECTED: Musk target for R3/R4 RVac 'giant nozzle' — 380s Isp. Not yet built. Mass estimated.", trl: 3 },
  { id: "rl10b2", name: "RL-10B-2", category: "Chemical", isp: 465, thrust: 110000, power: 0, mass: 277,
    massBkdn: { engine: 277, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "VERIFIED: L3Harris/NASA — 24,750 lbf (110 kN), 465.5s Isp. Extensible carbon-carbon nozzle. Flew on ICPS/Artemis I. LOX/LH2.", trl: 9 },
  { id: "ssme", name: "RS-25D (SSME)", category: "Chemical", isp: 452, thrust: 2279000, power: 0, mass: 3177,
    massBkdn: { engine: 3177, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "VERIFIED: L3Harris spec sheet — 512,300 lbf vac at 109%, 452.3s Isp, ~3,177 kg dry. LOX/LH2 staged combustion. SLS core stage.", trl: 9 },
  { id: "merlin_vac", name: "Merlin 1D Vacuum", category: "Chemical", isp: 348, thrust: 981000, power: 0, mass: 550,
    massBkdn: { engine: 550, tanks: 0, radiators: 0, powerSource: 0, pmad: 0, structure: 0 },
    description: "VERIFIED: Wikipedia/SpaceX — 220,500 lbf (981 kN), 348s Isp, ~550 kg (incl nozzle ext). LOX/RP-1 gas-generator. Falcon 9 S2.", trl: 9 },

  // Nuclear Thermal — VERIFIED (historical) / PROJECTED (DRACO)
  { id: "nerva", name: "NERVA XE-Prime", category: "NTP", isp: 841, thrust: 334000, power: 0, mass: 10200,
    massBkdn: { engine: 3400, tanks: 0, radiators: 500, powerSource: 5500, pmad: 300, structure: 500 },
    description: "VERIFIED: Historic ground test (1969) — 75,000 lbf, 841s Isp. LH2 propellant. System mass ~10.2t incl shielding. Program cancelled 1973.", trl: 5 },
  { id: "draco_ntp", name: "DRACO NTP (Concept)", category: "NTP", isp: 900, thrust: 111200, power: 0, mass: 6000,
    massBkdn: { engine: 1500, tanks: 0, radiators: 400, powerSource: 3200, pmad: 400, structure: 500 },
    description: "PROJECTED: NASA/DARPA demonstration concept — target 25,000 lbf, ≥900s Isp. LEU fuel. Mass est. Flight demo was targeted ~2027.", trl: 3 },

  // Hall Effect — VERIFIED (SPT-140) / ESTIMATED (X3, BHT-600)
  { id: "spt140", name: "SPT-140", category: "Hall EP", isp: 1820, thrust: 0.281, power: 4500, mass: 8.5,
    massBkdn: { engine: 3.5, tanks: 0, radiators: 0, powerSource: 0, pmad: 2, structure: 3 },
    description: "VERIFIED: NASA/Fakel AIAA papers — 281 mN at 300V/15A (4.5 kW), 1820s Isp, 55% eff. Flew on Psyche (2023). Thruster+cathode ~5 kg, system ~8.5 kg.", trl: 9 },
  { id: "x3_hall", name: "X3 Nested Hall", category: "Hall EP", isp: 2340, thrust: 5.4, power: 100000, mass: 230,
    massBkdn: { engine: 50, tanks: 0, radiators: 20, powerSource: 0, pmad: 100, structure: 60 },
    description: "ESTIMATED: UM/NASA — demonstrated ~5.4 N at 100 kW, ~2340s Isp. Highest power Hall tested. System mass est. PPU mass dominates.", trl: 4 },
  { id: "bht600", name: "BHT-600", category: "Hall EP", isp: 1500, thrust: 0.039, power: 600, mass: 3.5,
    massBkdn: { engine: 1.5, tanks: 0, radiators: 0, powerSource: 0, pmad: 1, structure: 1 },
    description: "ESTIMATED: Busek — 600W class, ~39 mN, ~1500s Isp. Small-sat Hall thruster. Mass approximate.", trl: 7 },

  // Ion (Gridded) — VERIFIED
  { id: "nstar", name: "NSTAR", category: "Ion EP", isp: 3100, thrust: 0.092, power: 2300, mass: 26,
    massBkdn: { engine: 8.2, tanks: 0, radiators: 0, powerSource: 0, pmad: 14.8, structure: 3 },
    description: "VERIFIED: NASA GRC — 92 mN, 3100s at 2.3 kW. Flight masses: thruster 8.2 kg, PPU 14.77 kg, DCIU 2.51 kg = 25.5 kg. DS1 & Dawn.", trl: 9 },
  { id: "next_c", name: "NEXT-C", category: "Ion EP", isp: 4100, thrust: 0.236, power: 7400, mass: 52,
    massBkdn: { engine: 13.5, tanks: 0, radiators: 0, powerSource: 0, pmad: 30, structure: 8.5 },
    description: "VERIFIED: NASA GRC/Aerojet — 236 mN max, >4100s Isp, 7.4 kW max. Thruster 13.5 kg. PPU est ~30 kg. Flew on DART (2021).", trl: 9 },

  // VASIMR — VERIFIED (performance) / ESTIMATED (system mass)
  { id: "vasimr_200", name: "VASIMR VX-200SS", category: "Plasma EP", isp: 4900, thrust: 5.8, power: 200000, mass: 620,
    massBkdn: { engine: 150, tanks: 0, radiators: 100, powerSource: 0, pmad: 200, structure: 170 },
    description: "VERIFIED perf: Ad Astra — 5.8 N, 4900s, 72% eff at 200 kW (argon). 88-hr endurance at 80 kW. System mass 620 kg ESTIMATED.", trl: 5 },

  // Fission NEP — PROJECTED (system-level concepts from NASA studies)
  { id: "fission_nep_1mw", name: "Fission NEP 1MW", category: "Fission NEP", isp: 2500, thrust: 50, power: 1000000, mass: 30000,
    massBkdn: { engine: 500, tanks: 0, radiators: 10000, powerSource: 12000, pmad: 4500, structure: 3000 },
    description: "PROJECTED: Conceptual 1MW fission NEP. α≈30 kg/kW per Natl Academies 2021. Hall cluster. Mass breakdown from NASA DRA 5.0 studies.", trl: 3 },
  { id: "fission_nep_2mw_adv", name: "Fission NEP 2MW (Adv)", category: "Fission NEP", isp: 2500, thrust: 100, power: 2000000, mass: 40000,
    massBkdn: { engine: 1000, tanks: 0, radiators: 14000, powerSource: 16000, pmad: 5000, structure: 4000 },
    description: "PROJECTED: Advanced 2MW fission NEP. α≈20 kg/kW. Brayton conversion. Mass from NASA technology roadmaps.", trl: 2 },

  // Fusion — PROJECTED (all paper studies)
  { id: "dfd_1mw", name: "DFD 1MW", category: "Fusion", isp: 10000, thrust: 8, power: 1000000, mass: 4000,
    massBkdn: { engine: 800, tanks: 0, radiators: 800, powerSource: 1200, pmad: 600, structure: 600 },
    description: "PROJECTED: Princeton Satellite Systems / PPPL — D-³He PFRC. α≈4 kg/kW. From NIAC Phase I/II studies. No hardware at this scale.", trl: 2 },
  { id: "dfd_2mw", name: "DFD 2MW", category: "Fusion", isp: 10000, thrust: 16, power: 2000000, mass: 8000,
    massBkdn: { engine: 1600, tanks: 0, radiators: 1600, powerSource: 2400, pmad: 1200, structure: 1200 },
    description: "PROJECTED: Scaled DFD concept. 2MW class. Numbers from Princeton NIAC scaling studies.", trl: 2 },
  { id: "fdr_msnw", name: "Fusion Driven Rocket", category: "Fusion", isp: 3000, thrust: 40000, power: 0, mass: 5000,
    massBkdn: { engine: 2000, tanks: 0, radiators: 500, powerSource: 1500, pmad: 500, structure: 500 },
    description: "PROJECTED: MSNW/UW — pulsed magneto-inertial fusion. STTR funded. ve >30 km/s. All numbers from concept papers.", trl: 2 },
];

// ─── TRAJECTORY DATABASE ───
const TRAJECTORY_DB = [
  { id: "hohmann", name: "Hohmann Transfer", type: "impulsive",
    dv1: 3600, dv2: 2100, dvTotal: 5700, transferDays: 259,
    description: "Minimum energy transfer. 259 day coast. Launch windows every 26 months." },
  { id: "fast_conj_180", name: "Fast Conjunction (180d)", type: "impulsive",
    dv1: 4200, dv2: 2800, dvTotal: 7000, transferDays: 180,
    description: "Type I conjunction class. Moderate ΔV penalty for faster transit." },
  { id: "fast_120", name: "Fast Transfer (120d)", type: "impulsive",
    dv1: 6500, dv2: 5500, dvTotal: 12000, transferDays: 120,
    description: "High-energy transfer. Requires significant ΔV budget." },
  { id: "very_fast_90", name: "Sprint Transfer (90d)", type: "impulsive",
    dv1: 10000, dv2: 8000, dvTotal: 18000, transferDays: 90,
    description: "Near-minimum time. Only feasible with advanced propulsion." },
  { id: "opposition", name: "Opposition Class", type: "impulsive",
    dv1: 5000, dv2: 4000, dvTotal: 9000, transferDays: 210,
    description: "Opposition trajectory with Venus flyby return. Short Mars stay." },
  { id: "low_thrust_spiral", name: "Low-Thrust Spiral", type: "continuous",
    dv1: 0, dv2: 0, dvTotal: 8500, transferDays: null,
    description: "Continuous thrust spiral. Transit time depends on T/W ratio. ΔV ~1.5× Hohmann." },
  { id: "low_thrust_fast", name: "Low-Thrust Fast", type: "continuous",
    dv1: 0, dv2: 0, dvTotal: 15000, transferDays: null,
    description: "Aggressive continuous thrust. Higher ΔV budget for faster transit." },
  { id: "low_thrust_optimal", name: "Low-Thrust Optimal", type: "continuous",
    dv1: 0, dv2: 0, dvTotal: 12000, transferDays: null,
    description: "Optimized continuous thrust profile balancing time and propellant." },
];

// ─── CATEGORY COLORS ───
const CAT_COLORS = {
  "Chemical": "#f97316",
  "NTP": "#ef4444",
  "Hall EP": "#3b82f6",
  "Ion EP": "#06b6d4",
  "Plasma EP": "#8b5cf6",
  "Fission NEP": "#f59e0b",
  "Fusion": "#10b981",
};

// ─── PHYSICS HELPERS ───
function computeMission(thruster, trajectory, payloadMass, propellantMass, numThrusters = 1) {
  const F = thruster.thrust * numThrusters;
  const isp = thruster.isp;
  const ve = isp * g0;
  const thrusterDryMass = thruster.mass * numThrusters;
  const dryMass = payloadMass + thrusterDryMass;
  const m0 = dryMass + propellantMass;
  const mf = dryMass;
  const massRatio = m0 / mf;
  const dvCapability = ve * Math.log(massRatio);
  const dvRequired = trajectory.dvTotal;
  const dvMargin = dvCapability - dvRequired;

  const mdot = F / ve;
  const propUsed = dvRequired > dvCapability ? propellantMass : mf * (Math.exp(dvRequired / ve) - 1);
  const burnTimeSec = propUsed / mdot;
  const burnTimeDays = burnTimeSec / 86400;
  const propRemaining = propellantMass - propUsed;

  const a0 = F / m0;
  const aFinal = F / (m0 - propUsed);

  const jetPower = 0.5 * F * ve;
  const alpha = thruster.mass > 0 ? jetPower / (thruster.mass * numThrusters) : 0;

  // Chemical & NTP do near-instantaneous burns → transit = coast time (fixed by trajectory)
  // Everything else (EP, Fusion, etc.) → transit computed from thrust & mass (continuous burn)
  const impulsiveCats = ["Chemical", "NTP"];
  const canDoImpulsive = impulsiveCats.includes(thruster.category);

  let transitDays;
  if (trajectory.type === "impulsive" && canDoImpulsive) {
    transitDays = dvCapability >= dvRequired ? trajectory.transferDays : null;
  } else {
    if (dvCapability >= dvRequired && F > 0) {
      const avgMass = (m0 + (m0 - propUsed)) / 2;
      const avgAccel = F / avgMass;
      transitDays = dvRequired / avgAccel / 86400;
      transitDays = Math.max(transitDays, burnTimeDays);
    } else {
      transitDays = null;
    }
  }

  const feasible = dvCapability >= dvRequired;

  return {
    feasible, dvCapability, dvRequired, dvMargin,
    massRatio, m0, mf: dryMass, dryMass, thrusterDryMass,
    propUsed: Math.min(propUsed, propellantMass), propRemaining: Math.max(propRemaining, 0),
    burnTimeDays, transitDays,
    a0, aFinal, jetPower, alpha,
    F, isp: thruster.isp, ve, mdot,
  };
}

function formatNum(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(digits) + " G";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(digits) + " M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(digits) + "k";
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(digits);
  return n.toFixed(digits);
}

function formatDays(d) {
  if (d === null || d === undefined) return "N/A";
  if (d > 365) return `${(d/365).toFixed(1)}y (${Math.round(d)}d)`;
  return `${Math.round(d)}d`;
}

// Estimate total impulsive ΔV for Earth-Mars transfer at a given transit time
// Interpolates from known conjunction-class data points (Lambert-problem solutions)
function estimateDv(transitDays) {
  const pts = [[90, 18000], [120, 12000], [180, 7000], [259, 5700]];
  if (transitDays >= 259) return 5700; // Can't beat Hohmann
  if (transitDays <= 60) return pts[0][1] * Math.pow(pts[0][0] / transitDays, 1.8);
  if (transitDays <= pts[0][0]) {
    const ratio = pts[0][0] / transitDays;
    return pts[0][1] * Math.pow(ratio, 1.8);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (transitDays >= pts[i][0] && transitDays <= pts[i + 1][0]) {
      const f = (transitDays - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + f * (pts[i + 1][1] - pts[i][1]);
    }
  }
  return 5700;
}

// ─── STYLES ───
const FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";
const DISPLAY = "'Space Grotesk', 'DM Sans', sans-serif";

// nah, let me use something more distinctive per the skill instructions
const S = {
  bg: "#0a0e17",
  surface: "#111827",
  surfaceHi: "#1a2236",
  border: "#1e2d4a",
  borderHi: "#2a3f6a",
  text: "#e2e8f0",
  textDim: "#7a8ba8",
  textMuted: "#4a5568",
  accent: "#10b981",
  accentDim: "#065f46",
  warn: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

// ─── COMPONENTS ───

function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${S.border}`, padding: "0 16px" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          padding: "10px 18px", background: active === t.id ? S.surfaceHi : "transparent",
          color: active === t.id ? S.accent : S.textDim, border: "none",
          borderBottom: active === t.id ? `2px solid ${S.accent}` : "2px solid transparent",
          cursor: "pointer", fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
          transition: "all 0.15s",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function Card({ title, children, style, headerRight }) {
  return (
    <div style={{
      background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8,
      overflow: "hidden", ...style,
    }}>
      {title && (
        <div style={{
          padding: "10px 16px", borderBottom: `1px solid ${S.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: S.surfaceHi,
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: S.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
          {headerRight}
        </div>
      )}
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Stat({ label, value, unit, color, small }) {
  return (
    <div style={{ marginBottom: small ? 4 : 8 }}>
      <div style={{ fontSize: 10, color: S.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color || S.text, lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 400, color: S.textDim, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, unit, min, max, step, type = "number", style: sx }) {
  return (
    <div style={{ marginBottom: 8, ...sx }}>
      <label style={{ fontSize: 10, color: S.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type={type} value={value} onChange={e => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
          min={min} max={max} step={step}
          style={{
            background: S.surfaceHi, border: `1px solid ${S.border}`, borderRadius: 4,
            padding: "6px 10px", color: S.text, fontSize: 13, width: "100%", outline: "none",
          }}
        />
        {unit && <span style={{ fontSize: 11, color: S.textDim, whiteSpace: "nowrap" }}>{unit}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ fontSize: 10, color: S.textDim, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 3 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: S.surfaceHi, border: `1px solid ${S.border}`, borderRadius: 4,
        padding: "6px 10px", color: S.text, fontSize: 13, width: "100%", outline: "none",
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      background: (color || S.accent) + "22", color: color || S.accent,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
    }}>{text}</span>
  );
}

function MassBreakdownBar({ massBkdn, total }) {
  const parts = [
    { key: "engine", label: "Engine/Core", color: "#ef4444" },
    { key: "powerSource", label: "Power Source", color: "#f59e0b" },
    { key: "radiators", label: "Radiators", color: "#06b6d4" },
    { key: "pmad", label: "PMAD/PPU", color: "#8b5cf6" },
    { key: "structure", label: "Structure", color: "#6b7280" },
    { key: "tanks", label: "Tanks", color: "#84cc16" },
  ];
  const t = total || Object.values(massBkdn).reduce((a, b) => a + b, 0);
  if (t === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 6 }}>
        {parts.map(p => {
          const w = (massBkdn[p.key] / t) * 100;
          return w > 0 ? <div key={p.key} style={{ width: `${w}%`, background: p.color, minWidth: w > 0 ? 2 : 0 }} title={`${p.label}: ${massBkdn[p.key]} kg`} /> : null;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
        {parts.map(p => massBkdn[p.key] > 0 ? (
          <span key={p.key} style={{ fontSize: 10, color: S.textDim }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 4 }} />
            {p.label}: {formatNum(massBkdn[p.key], 0)} kg
          </span>
        ) : null)}
      </div>
    </div>
  );
}

// ─── THRUSTER CARD ───
function ThrusterCard({ t, selected, onSelect, compact, feasible }) {
  const col = CAT_COLORS[t.category] || S.accent;
  return (
    <div onClick={onSelect} style={{
      background: selected ? col + "15" : S.surface,
      border: `1px solid ${selected ? col : S.border}`,
      borderRadius: 8, padding: compact ? "8px 12px" : "12px 16px", cursor: "pointer",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>
          {feasible !== undefined && (
            <span style={{ color: feasible ? S.accent : S.danger, marginRight: 6, fontSize: 12 }}>
              {feasible ? "✓" : "✗"}
            </span>
          )}
          {t.name}
        </span>
        <Badge text={t.category} color={col} />
      </div>
      {!compact && <p style={{ fontSize: 11, color: S.textDim, margin: "4px 0 8px" }}>{t.description}</p>}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: S.textDim }}>Isp: <b style={{ color: S.text }}>{formatNum(t.isp, 0)}s</b></span>
        <span style={{ fontSize: 11, color: S.textDim }}>Thrust: <b style={{ color: S.text }}>{t.thrust >= 1000 ? formatNum(t.thrust, 1) + "N" : t.thrust >= 1 ? t.thrust.toFixed(1) + " N" : (t.thrust * 1000).toFixed(1) + " mN"}</b></span>
        <span style={{ fontSize: 11, color: S.textDim }}>Mass: <b style={{ color: S.text }}>{formatNum(t.mass, 0)} kg</b></span>
        {t.power > 0 && <span style={{ fontSize: 11, color: S.textDim }}>Power: <b style={{ color: S.text }}>{formatNum(t.power, 0)}W</b></span>}
        <span style={{ fontSize: 11, color: S.textDim }}>TRL: <b style={{ color: S.text }}>{t.trl}</b></span>
      </div>
    </div>
  );
}

// ─── ORBITAL VISUALIZATION ───
function OrbitalView({ trajectory, missionResult, thruster }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;
    const cx = W / 2, cy = H / 2;
    const scale = H / 3.4;

    const stars = Array.from({ length: 80 }, (_, i) => ({
      x: (Math.sin(i * 137.5) * 0.5 + 0.5) * W,
      y: (Math.cos(i * 97.3) * 0.5 + 0.5) * H,
      b: 0.15 + (i % 5) * 0.06,
    }));

    const impulsiveCategories = ["Chemical", "NTP"];
    const isImpulsive = trajectory && trajectory.type === "impulsive"
      && thruster && impulsiveCategories.includes(thruster.category);
    const isSpiral = trajectory && trajectory.id === "low_thrust_spiral"
      && thruster && !impulsiveCategories.includes(thruster.category);
    // isContinuousEllipse: continuous trajectory but not spiral (e.g. low_thrust_fast, low_thrust_optimal, or impulsive traj with EP thruster)
    const isContinuousEllipse = !isImpulsive && !isSpiral;

    const transitDays = (missionResult && missionResult.transitDays) || (trajectory && trajectory.transferDays) || 259;
    const earthPeriod = 365.25;
    const marsPeriod = 687;
    const earthSweep = (transitDays / earthPeriod) * 2 * Math.PI;
    const marsSweep = (transitDays / marsPeriod) * 2 * Math.PI;

    const earthDepart = 0;

    // burn duration as fraction of transit (for visualizing burn arcs)
    const burnFrac = missionResult ? Math.min(missionResult.burnTimeDays / transitDays, 1) : 0;

    const TRANSIT_FRAMES = 360;
    const HOLD_FRAMES = 120;
    const TOTAL_FRAMES = TRANSIT_FRAMES + HOLD_FRAMES;

    // ── Ellipse helpers (for impulsive + continuous-ellipse modes) ──
    const rA = scale;
    const rB = scale * 1.524;
    const sma = (rA + rB) / 2;
    const c2 = sma - rA;
    const ecc = c2 / sma;
    function ellipseR(theta) {
      return (sma * (1 - ecc * ecc)) / (1 + ecc * Math.cos(theta));
    }
    function ellipseXY(theta) {
      const r = ellipseR(theta);
      return [cx + Math.cos(earthDepart + theta) * r, cy + Math.sin(earthDepart + theta) * r];
    }

    // ── Spiral helpers (for low-thrust spiral mode) ──
    // Archimedean spiral from Earth orbit radius to Mars orbit radius
    const avgOrbitalPeriodDays = (earthPeriod + marsPeriod) / 2;
    const numTurns = isSpiral ? Math.max(3, Math.round(transitDays / avgOrbitalPeriodDays)) : 0;
    const totalSpiralAngle = numTurns * 2 * Math.PI + Math.PI; // +π so endpoint is visually opposite start
    const spiralStartAngle = earthDepart; // start at Earth's departure position
    function spiralXY(frac) {
      // frac: 0 = Earth orbit, 1 = Mars orbit
      const r = rA + (rB - rA) * frac;
      const angle = spiralStartAngle + frac * totalSpiralAngle;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, angle];
    }
    // Mars arrival angle for spiral: where the spiral ends
    const spiralEndAngle = spiralStartAngle + totalSpiralAngle;
    const spiralMarsDepart = spiralEndAngle - marsSweep;

    // For non-spiral modes
    const arrivalAngle = earthDepart + Math.PI;
    const marsDepart = isSpiral ? spiralMarsDepart : arrivalAngle - marsSweep;

    let t = 0;
    function draw() {
      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        ctx.fillStyle = `rgba(255,255,255,${s.b})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      }

      // Sun
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
      grad.addColorStop(0, "#fde68a");
      grad.addColorStop(0.5, "#f59e0b");
      grad.addColorStop(1, "#f59e0b00");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();

      // orbits
      ctx.strokeStyle = "#3b82f622";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, scale, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ef444422";
      ctx.beginPath(); ctx.arc(cx, cy, scale * 1.524, 0, Math.PI * 2); ctx.stroke();

      const frame = t % TOTAL_FRAMES;
      const progress = Math.min(frame / TRANSIT_FRAMES, 1);

      const eAngle = earthDepart + progress * earthSweep;
      const mAngle = (isSpiral ? spiralMarsDepart : marsDepart) + progress * marsSweep;

      // Earth
      const ex = cx + Math.cos(eAngle) * scale;
      const ey = cy + Math.sin(eAngle) * scale;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#93c5fd";
      ctx.font = "10px monospace";
      ctx.fillText("Earth", ex + 8, ey + 3);

      // Mars
      const mx = cx + Math.cos(mAngle) * scale * 1.524;
      const my = cy + Math.sin(mAngle) * scale * 1.524;
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fca5a5";
      ctx.fillText("Mars", mx + 7, my + 3);

      if (trajectory) {

        if (isSpiral) {
          // ═══ SPIRAL MODE ═══
          // full dashed spiral path
          ctx.strokeStyle = "#10b98133";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          const spiralSteps = 200;
          for (let i = 0; i <= spiralSteps; i++) {
            const [px, py] = spiralXY(i / spiralSteps);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // amber burn arc along spiral (up to burnFrac of the path)
          ctx.strokeStyle = "#f59e0b88";
          ctx.lineWidth = 3;
          ctx.beginPath();
          const burnSteps = 120;
          const burnEnd = Math.min(burnFrac, 1);
          for (let i = 0; i <= burnSteps; i++) {
            const frac = (i / burnSteps) * burnEnd;
            const [px, py] = spiralXY(frac);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();

          // thrust arrows along the burn arc
          const numArrows = 8;
          for (let i = 0; i < numArrows; i++) {
            const frac = (i + 0.5) / numArrows;
            if (frac > burnEnd) break;
            const [ax, ay, angle] = spiralXY(frac);
            const tangent = angle + Math.PI / 2;
            ctx.strokeStyle = "#f59e0b66";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + Math.cos(tangent) * 8, ay + Math.sin(tangent) * 8);
            ctx.stroke();
          }

          // labels
          const [depX, depY] = spiralXY(0);
          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 10px monospace";
          ctx.fillText("spiral start", depX + 12, depY - 8);

          const [arrX2, arrY2] = spiralXY(1);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "9px monospace";
          ctx.fillText("arrival", arrX2 + 12, arrY2 - 8);

          // spacecraft position along spiral
          const [scX, scY, scAngle] = spiralXY(progress);

          // solid trail
          ctx.strokeStyle = "#10b98166";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const [tx, ty] = spiralXY((i / 60) * progress);
            if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
          }
          ctx.stroke();

          // spacecraft dot
          ctx.fillStyle = "#10b981";
          ctx.beginPath(); ctx.arc(scX, scY, 3.5, 0, Math.PI * 2); ctx.fill();
          const g2 = ctx.createRadialGradient(scX, scY, 0, scX, scY, 12);
          g2.addColorStop(0, "#10b98144");
          g2.addColorStop(1, "#10b98100");
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(scX, scY, 12, 0, Math.PI * 2); ctx.fill();

          // engine flame (while burning)
          if (progress < burnEnd) {
            const flameDir = scAngle - Math.PI / 2;
            const flameG = ctx.createRadialGradient(
              scX - Math.cos(flameDir) * 4, scY - Math.sin(flameDir) * 4, 0,
              scX - Math.cos(flameDir) * 4, scY - Math.sin(flameDir) * 4, 8
            );
            flameG.addColorStop(0, "#f59e0baa");
            flameG.addColorStop(0.5, "#ef444466");
            flameG.addColorStop(1, "#ef444400");
            ctx.fillStyle = flameG;
            ctx.beginPath();
            ctx.arc(scX - Math.cos(flameDir) * 6, scY - Math.sin(flameDir) * 6, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // day counter
          const day = Math.round(progress * transitDays);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "10px monospace";
          ctx.fillText(`Day ${day} / ${Math.round(transitDays)}`, scX + 14, scY + 4);

          // total ΔV label
          ctx.fillStyle = "#f59e0b";
          ctx.font = "bold 10px monospace";
          ctx.fillText(`ΔV ${(trajectory.dvTotal / 1000).toFixed(1)} km/s`, 16, H - 16);

        } else {
          // ═══ ELLIPSE-BASED MODES (impulsive + continuous-ellipse) ═══
          // full dashed transfer arc
          ctx.strokeStyle = "#10b98133";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          for (let i = 0; i <= 80; i++) {
            const [px, py] = ellipseXY((i / 80) * Math.PI);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          if (isImpulsive) {
            // ═══ IMPULSIVE MODE ═══
            // departure burn marker (TLI)
            const [depX, depY] = ellipseXY(0);
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(depX, depY, 9, 0, Math.PI * 2); ctx.stroke();
            const burnDir = earthDepart + 0.15;
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(depX, depY);
            ctx.lineTo(depX + Math.cos(burnDir) * 22, depY + Math.sin(burnDir) * 22);
            ctx.stroke();
            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 10px monospace";
            ctx.fillText(`ΔV₁ ${(trajectory.dv1 / 1000).toFixed(1)} km/s`, depX + 14, depY - 12);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "9px monospace";
            ctx.fillText("TLI burn", depX + 14, depY - 1);

            // arrival burn marker (MOI)
            const [arrX, arrY] = ellipseXY(Math.PI);
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(arrX, arrY, 9, 0, Math.PI * 2); ctx.stroke();
            const arrBurnDir = earthDepart + Math.PI - 0.15;
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(arrX, arrY);
            ctx.lineTo(arrX - Math.cos(arrBurnDir) * 22, arrY - Math.sin(arrBurnDir) * 22);
            ctx.stroke();
            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 10px monospace";
            ctx.fillText(`ΔV₂ ${(trajectory.dv2 / 1000).toFixed(1)} km/s`, arrX + 14, arrY - 12);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "9px monospace";
            ctx.fillText("MOI burn", arrX + 14, arrY - 1);

            const [midX, midY] = ellipseXY(Math.PI / 2);
            ctx.fillStyle = "#475569";
            ctx.font = "9px monospace";
            ctx.fillText("coast phase", midX + 10, midY);

          } else {
            // ═══ CONTINUOUS THRUST (ELLIPSE) MODE ═══
            ctx.strokeStyle = "#f59e0b88";
            ctx.lineWidth = 4;
            ctx.beginPath();
            const thrustArcEnd = Math.min(burnFrac, 1) * Math.PI;
            for (let i = 0; i <= 60; i++) {
              const theta = (i / 60) * thrustArcEnd;
              const [px, py] = ellipseXY(theta);
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.stroke();

            const numArrows = 6;
            for (let i = 0; i < numArrows; i++) {
              const frac = (i + 0.5) / numArrows;
              if (frac > burnFrac) break;
              const theta = frac * Math.PI;
              const [ax, ay] = ellipseXY(theta);
              const tangent = earthDepart + theta + Math.PI / 2;
              ctx.strokeStyle = "#f59e0b66";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(ax, ay);
              ctx.lineTo(ax + Math.cos(tangent) * 8, ay + Math.sin(tangent) * 8);
              ctx.stroke();
            }

            const [depX, depY] = ellipseXY(0);
            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 10px monospace";
            ctx.fillText("thrust start", depX + 12, depY - 8);

            if (burnFrac < 0.95) {
              const cutTheta = burnFrac * Math.PI;
              const [cutX, cutY] = ellipseXY(cutTheta);
              ctx.strokeStyle = "#ef4444";
              ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.arc(cutX, cutY, 6, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = "#ef4444";
              ctx.font = "9px monospace";
              ctx.fillText("cutoff", cutX + 10, cutY - 4);
              ctx.fillText(`${Math.round(missionResult?.burnTimeDays || 0)}d burn`, cutX + 10, cutY + 8);
            } else {
              ctx.fillStyle = "#f59e0b";
              ctx.font = "9px monospace";
              const [midX, midY] = ellipseXY(Math.PI / 2);
              ctx.fillText("continuous burn", midX + 10, midY - 4);
              ctx.fillText(`${Math.round(missionResult?.burnTimeDays || 0)}d`, midX + 10, midY + 8);
            }

            const [arrX, arrY] = ellipseXY(Math.PI);
            ctx.fillStyle = "#94a3b8";
            ctx.font = "9px monospace";
            ctx.fillText("arrival", arrX + 12, arrY - 8);

            ctx.fillStyle = "#f59e0b";
            ctx.font = "bold 10px monospace";
            ctx.fillText(`ΔV ${(trajectory.dvTotal / 1000).toFixed(1)} km/s`, 16, H - 16);
          }

          // spacecraft position on ellipse
          const scTheta = progress * Math.PI;
          const [scX, scY] = ellipseXY(scTheta);

          // solid trail
          ctx.strokeStyle = "#10b98166";
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const [tx, ty] = ellipseXY((i / 60) * scTheta);
            if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
          }
          ctx.stroke();

          // spacecraft dot
          ctx.fillStyle = "#10b981";
          ctx.beginPath(); ctx.arc(scX, scY, 3.5, 0, Math.PI * 2); ctx.fill();
          const g2 = ctx.createRadialGradient(scX, scY, 0, scX, scY, 12);
          g2.addColorStop(0, "#10b98144");
          g2.addColorStop(1, "#10b98100");
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(scX, scY, 12, 0, Math.PI * 2); ctx.fill();

          // engine flame for continuous thrust (when still burning)
          if (!isImpulsive && progress < burnFrac) {
            const flameDir = earthDepart + scTheta - Math.PI / 2;
            const flameG = ctx.createRadialGradient(
              scX - Math.cos(flameDir) * 4, scY - Math.sin(flameDir) * 4, 0,
              scX - Math.cos(flameDir) * 4, scY - Math.sin(flameDir) * 4, 8
            );
            flameG.addColorStop(0, "#f59e0baa");
            flameG.addColorStop(0.5, "#ef444466");
            flameG.addColorStop(1, "#ef444400");
            ctx.fillStyle = flameG;
            ctx.beginPath();
            ctx.arc(scX - Math.cos(flameDir) * 6, scY - Math.sin(flameDir) * 6, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // day counter
          const day = Math.round(progress * transitDays);
          ctx.fillStyle = "#94a3b8";
          ctx.font = "10px monospace";
          ctx.fillText(`Day ${day} / ${Math.round(transitDays)}`, scX + 14, scY + 4);
        }

        // info overlay (3-way label)
        const modeLabel = isImpulsive ? "Impulsive burns" : isSpiral ? "Low-thrust spiral" : "Continuous thrust";
        const modeColor = isImpulsive ? "#f59e0b" : isSpiral ? "#8b5cf6" : "#06b6d4";
        const overlayH = isImpulsive ? 96 : 82;
        ctx.fillStyle = "#0a0e17cc";
        ctx.fillRect(8, 8, 210, overlayH);
        ctx.strokeStyle = S.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(8, 8, 210, overlayH);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 11px monospace";
        ctx.fillText(trajectory.name, 16, 26);
        ctx.fillStyle = modeColor;
        ctx.font = "9px monospace";
        ctx.fillText(`▸ ${modeLabel}`, 16, 40);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        const y0 = 54;
        ctx.fillText(`ΔV: ${(trajectory.dvTotal / 1000).toFixed(1)} km/s`, 16, y0);
        if (missionResult) {
          ctx.fillText(`Transit: ${missionResult.transitDays ? Math.round(missionResult.transitDays) + "d" : "N/A"}`, 16, y0 + 14);
          ctx.fillText(`Prop: ${formatNum(missionResult.propUsed, 0)} kg`, 16, y0 + 28);
          ctx.fillStyle = missionResult.feasible ? "#10b981" : "#ef4444";
          ctx.fillText(missionResult.feasible ? "FEASIBLE" : "INFEASIBLE", 16, y0 + 42);
        }
      }

      t++;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [trajectory, missionResult, thruster]);

  return <canvas ref={canvasRef} width={700} height={500} style={{ width: "100%", height: 500, borderRadius: 8, border: `1px solid ${S.border}` }} />;
}

// ─── MAIN APP ───
export default function App() {
  const [tab, setTab] = useState("mission");
  const [thrusters, setThrusters] = useState(THRUSTER_DB);

  // Lab state
  const [selectedThruster, setSelectedThruster] = useState(THRUSTER_DB[0].id);
  const [catFilter, setCatFilter] = useState("All");
  const [customThruster, setCustomThruster] = useState({
    id: "custom_1", name: "My Custom Thruster", category: "Fusion", isp: 5000, thrust: 20, power: 500000, mass: 5000,
    massBkdn: { engine: 1500, tanks: 200, radiators: 1000, powerSource: 1200, pmad: 600, structure: 500 },
    description: "Custom thruster configuration", trl: 1,
  });

  // Mission state
  const [missionThrusterId, setMissionThrusterId] = useState("dfd_1mw");
  const [missionTrajId, setMissionTrajId] = useState("hohmann");
  const [customTrajDays, setCustomTrajDays] = useState(150);
  const [payloadMass, setPayloadMass] = useState(50000);
  const [propellantMass, setPropellantMass] = useState(20000);
  const [numThrusters, setNumThrusters] = useState(1);

  // Comparator state
  const [compareItems, setCompareItems] = useState([
    { thrusterId: "raptor2_vac", trajId: "hohmann", payload: 50000, propellant: 200000, num: 6 },
    { thrusterId: "dfd_1mw", trajId: "low_thrust_spiral", payload: 50000, propellant: 20000, num: 1 },
    { thrusterId: "fission_nep_1mw", trajId: "low_thrust_spiral", payload: 50000, propellant: 20000, num: 1 },
    { thrusterId: "nerva", trajId: "hohmann", payload: 50000, propellant: 80000, num: 1 },
  ]);

  const categories = useMemo(() => ["All", ...new Set(THRUSTER_DB.map(t => t.category))], []);
  const filteredThrusters = useMemo(() =>
    catFilter === "All" ? thrusters : thrusters.filter(t => t.category === catFilter), [thrusters, catFilter]);

  const selectedT = thrusters.find(t => t.id === selectedThruster) || thrusters[0];
  const missionThruster = thrusters.find(t => t.id === missionThrusterId) || thrusters[0];
  const missionTrajectory = missionTrajId === "custom"
    ? (() => {
        const dvTotal = Math.round(estimateDv(customTrajDays));
        const dv1 = Math.round(dvTotal * 0.58);
        const dv2 = dvTotal - dv1;
        return {
          id: "custom", name: `Custom (${customTrajDays}d)`, type: "impulsive",
          dv1, dv2, dvTotal, transferDays: customTrajDays,
          description: `Custom ${customTrajDays}-day conjunction-class transfer. ΔV estimated from Lambert-problem interpolation.`,
        };
      })()
    : TRAJECTORY_DB.find(t => t.id === missionTrajId) || TRAJECTORY_DB[0];
  const missionResult = computeMission(missionThruster, missionTrajectory, payloadMass, propellantMass, numThrusters);

  const compareResults = compareItems.map(item => {
    const thr = thrusters.find(t => t.id === item.thrusterId) || thrusters[0];
    const traj = TRAJECTORY_DB.find(t => t.id === item.trajId) || TRAJECTORY_DB[0];
    return { ...item, thruster: thr, trajectory: traj, result: computeMission(thr, traj, item.payload, item.propellant, item.num) };
  });

  const thrusterFeasibility = useMemo(() => {
    const map = {};
    thrusters.forEach(t => {
      const r = computeMission(t, missionTrajectory, payloadMass, propellantMass, numThrusters);
      map[t.id] = r.feasible;
    });
    return map;
  }, [thrusters, missionTrajectory, payloadMass, propellantMass, numThrusters]);

  function addCustomThruster() {
    const newT = { ...customThruster, id: `custom_${Date.now()}` };
    setThrusters(prev => [...prev, newT]);
    setCustomThruster({ ...customThruster, name: "My Custom Thruster " + (thrusters.length + 1) });
  }

  function addCompareItem() {
    setCompareItems(prev => [...prev, { thrusterId: "raptor2_vac", trajId: "hohmann", payload: 50000, propellant: 50000, num: 1 }]);
  }

  function updateCompareItem(idx, field, val) {
    setCompareItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  }

  function removeCompareItem(idx) {
    setCompareItems(prev => prev.filter((_, i) => i !== idx));
  }

  const tabs = [
    { id: "mission", label: "Mission Planner" },
    { id: "lab", label: "Thruster Lab" },
    { id: "compare", label: "Comparator" },
    { id: "orbit", label: "Orbital View" },
  ];

  // ─── SCATTER DATA for comparator ───
  const scatterData = thrusters.map(t => ({
    name: t.name, isp: t.isp,
    thrustN: t.thrust,
    alpha: t.mass > 0 ? (0.5 * t.thrust * t.isp * g0) / t.mass : 0,
    category: t.category,
    color: CAT_COLORS[t.category] || S.accent,
  }));

  return (
    <div style={{ background: S.bg, color: S.text, minHeight: "100vh", fontFamily: "'IBM Plex Sans', 'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: S.accent }}>◆</span> Mars Propulsion Simulator
          </div>
          <div style={{ fontSize: 11, color: S.textDim }}>Comparative analysis · Trajectory planning · Mission design</div>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onSelect={setTab} />

      <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>

        {/* ═══ THRUSTER LAB ═══ */}
        {tab === "lab" && (
          <div>
            {/* Mission context bar */}
            <div style={{
              display: "flex", gap: 24, alignItems: "center", padding: "10px 16px", marginBottom: 16,
              background: S.surfaceHi, border: `1px solid ${S.border}`, borderRadius: 8,
              fontSize: 12, color: S.textDim,
            }}>
              <span style={{ fontWeight: 700, color: S.accent, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em" }}>Active Mission</span>
              <span>Trajectory: <b style={{ color: S.text }}>{missionTrajectory.name}</b></span>
              <span>ΔV required: <b style={{ color: S.text }}>{(missionTrajectory.dvTotal / 1000).toFixed(1)} km/s</b></span>
              <span>Payload: <b style={{ color: S.text }}>{formatNum(payloadMass, 0)} kg</b></span>
              <span>Propellant: <b style={{ color: S.text }}>{formatNum(propellantMass, 0)} kg</b></span>
              <span style={{ fontSize: 10, color: S.textMuted }}>✓/✗ = feasibility with current mission params</span>
            </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Left: Browse */}
            <div>
              <Card title="Thruster Database" headerRight={
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {categories.map(c => (
                    <button key={c} onClick={() => setCatFilter(c)} style={{
                      padding: "2px 8px", borderRadius: 4, border: "none", cursor: "pointer",
                      background: catFilter === c ? (CAT_COLORS[c] || S.accent) + "33" : "transparent",
                      color: catFilter === c ? (CAT_COLORS[c] || S.accent) : S.textDim, fontSize: 10, fontWeight: 600,
                    }}>{c}</button>
                  ))}
                </div>
              }>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 500, overflowY: "auto" }}>
                  {filteredThrusters.map(t => (
                    <ThrusterCard key={t.id} t={t} selected={selectedThruster === t.id}
                      onSelect={() => setSelectedThruster(t.id)} compact
                      feasible={thrusterFeasibility[t.id]} />
                  ))}
                </div>
              </Card>

              {/* Custom Thruster Builder */}
              <Card title="Custom Thruster Builder" style={{ marginTop: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <Input label="Name" value={customThruster.name} onChange={v => setCustomThruster({ ...customThruster, name: v })} type="text" />
                  <Select label="Category" value={customThruster.category} onChange={v => setCustomThruster({ ...customThruster, category: v })}
                    options={Object.keys(CAT_COLORS).map(c => ({ value: c, label: c }))} />
                  <Input label="Isp" value={customThruster.isp} onChange={v => setCustomThruster({ ...customThruster, isp: v })} unit="s" min={100} step={10} />
                  <Input label="Thrust" value={customThruster.thrust} onChange={v => setCustomThruster({ ...customThruster, thrust: v })} unit="N" min={0} step={0.1} />
                  <Input label="Input Power" value={customThruster.power} onChange={v => setCustomThruster({ ...customThruster, power: v })} unit="W" min={0} />
                  <Input label="TRL" value={customThruster.trl} onChange={v => setCustomThruster({ ...customThruster, trl: v })} min={1} max={9} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: S.textDim, margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mass Breakdown (kg)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 8px" }}>
                  {Object.keys(customThruster.massBkdn).map(k => (
                    <Input key={k} label={k} value={customThruster.massBkdn[k]}
                      onChange={v => setCustomThruster({ ...customThruster, massBkdn: { ...customThruster.massBkdn, [k]: v } })} unit="kg" min={0} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: S.textDim, marginBottom: 8 }}>
                  Total mass: <b style={{ color: S.text }}>{Object.values(customThruster.massBkdn).reduce((a, b) => a + b, 0)} kg</b>
                </div>
                <button onClick={() => {
                  const total = Object.values(customThruster.massBkdn).reduce((a, b) => a + b, 0);
                  addCustomThruster();
                  setCustomThruster(prev => ({ ...prev, mass: total }));
                }} style={{
                  padding: "8px 20px", background: S.accent, color: "#000", border: "none",
                  borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}>Add to Database</button>
              </Card>
            </div>

            {/* Right: Selected detail */}
            <div>
              <Card title={`Detail: ${selectedT.name}`}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                  <Badge text={selectedT.category} color={CAT_COLORS[selectedT.category]} />
                  <Badge text={`TRL ${selectedT.trl}`} color={S.info} />
                </div>
                <p style={{ fontSize: 13, color: S.textDim, marginBottom: 16, lineHeight: 1.5 }}>{selectedT.description}</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <Stat label="Specific Impulse" value={formatNum(selectedT.isp, 0)} unit="s" color={S.accent} />
                  <Stat label="Thrust" value={selectedT.thrust >= 1000 ? formatNum(selectedT.thrust, 1) : selectedT.thrust >= 1 ? selectedT.thrust.toFixed(2) : (selectedT.thrust * 1000).toFixed(1)} unit={selectedT.thrust >= 1 ? "N" : "mN"} />
                  <Stat label="Dry Mass" value={formatNum(selectedT.mass, 0)} unit="kg" />
                  <Stat label="Exhaust Velocity" value={formatNum(selectedT.isp * g0 / 1000, 1)} unit="km/s" />
                  <Stat label="Jet Power" value={formatNum(0.5 * selectedT.thrust * selectedT.isp * g0, 1)} unit="W" />
                  <Stat label="Specific Power (α)" value={selectedT.mass > 0 ? formatNum(0.5 * selectedT.thrust * selectedT.isp * g0 / selectedT.mass, 1) : "∞"} unit="W/kg" />
                  {selectedT.power > 0 && <Stat label="Input Power" value={formatNum(selectedT.power, 1)} unit="W" />}
                  {selectedT.power > 0 && <Stat label="Efficiency" value={formatNum(100 * 0.5 * selectedT.thrust * selectedT.isp * g0 / selectedT.power, 1)} unit="%" />}
                  <Stat label="ṁ (mass flow)" value={formatNum(selectedT.thrust / (selectedT.isp * g0) * 1000, 3)} unit="g/s" />
                </div>

                <div style={{ marginBottom: 12, fontSize: 11, fontWeight: 700, color: S.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>Mass Breakdown</div>
                <MassBreakdownBar massBkdn={selectedT.massBkdn} total={selectedT.mass} />
              </Card>

              {/* Mission Performance card */}
              {(() => {
                const r = computeMission(selectedT, missionTrajectory, payloadMass, propellantMass, numThrusters);
                return (
                  <Card title="Mission Performance" style={{ marginTop: 16 }}>
                    <div style={{
                      padding: "8px 12px", borderRadius: 6, marginBottom: 12,
                      background: r.feasible ? S.accentDim + "33" : "#7f1d1d33",
                      border: `1px solid ${r.feasible ? S.accent + "44" : S.danger + "44"}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: r.feasible ? S.accent : S.danger }}>
                        {r.feasible ? "✓ Feasible" : "✗ Insufficient ΔV"}
                      </span>
                      <span style={{ fontSize: 11, color: S.textDim, marginLeft: 8 }}>
                        for {missionTrajectory.name}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Stat label="ΔV Capability" value={formatNum(r.dvCapability / 1000, 2)} unit="km/s" color={r.feasible ? S.accent : S.danger} small />
                      <Stat label="ΔV Margin" value={formatNum(r.dvMargin / 1000, 2)} unit="km/s" color={r.dvMargin >= 0 ? S.accent : S.danger} small />
                      <Stat label="Transit Time" value={r.transitDays ? formatDays(r.transitDays) : "N/A"} small />
                      <Stat label="Burn Time" value={formatDays(r.burnTimeDays)} small />
                      <Stat label="Prop Used" value={formatNum(r.propUsed / 1000, 1)} unit="t" small />
                      <Stat label="Mass Ratio" value={r.massRatio.toFixed(2)} small />
                    </div>
                    <button onClick={() => { setMissionThrusterId(selectedT.id); setTab("mission"); }} style={{
                      marginTop: 12, padding: "8px 16px", background: S.accent, color: "#000", border: "none",
                      borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", width: "100%",
                    }}>Use for Mission →</button>
                  </Card>
                );
              })()}

              {/* Isp vs Thrust landscape */}
              <Card title="Propulsion Landscape: Isp vs Thrust" style={{ marginTop: 16 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="isp" name="Isp" type="number" scale="log" domain={['auto', 'auto']}
                      tick={{ fill: S.textDim, fontSize: 10 }} label={{ value: "Isp (s)", position: "bottom", fill: S.textDim, fontSize: 10 }} />
                    <YAxis dataKey="thrustN" name="Thrust" type="number" scale="log" domain={['auto', 'auto']}
                      tick={{ fill: S.textDim, fontSize: 10 }} label={{ value: "Thrust (N)", angle: -90, position: "left", fill: S.textDim, fontSize: 10 }} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        if (!payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: S.surfaceHi, border: `1px solid ${S.border}`, padding: 8, borderRadius: 4, fontSize: 11 }}>
                            <div style={{ fontWeight: 700, color: d.color }}>{d.name}</div>
                            <div>Isp: {d.isp}s | Thrust: {d.thrustN >= 1 ? formatNum(d.thrustN, 1) + " N" : (d.thrustN * 1000).toFixed(1) + " mN"}</div>
                            <div>α: {formatNum(d.alpha, 1)} W/kg</div>
                          </div>
                        );
                      }} />
                    {Object.keys(CAT_COLORS).map(cat => (
                      <Scatter key={cat} name={cat} data={scatterData.filter(d => d.category === cat)} fill={CAT_COLORS[cat]}>
                      </Scatter>
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10, color: S.textDim }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
          </div>
        )}

        {/* ═══ MISSION PLANNER ═══ */}
        {tab === "mission" && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
            {/* Config panel */}
            <div>
              <Card title="Mission Configuration">
                <Select label="Thruster" value={missionThrusterId} onChange={setMissionThrusterId}
                  options={thrusters.map(t => ({ value: t.id, label: `${t.name} (${t.category})` }))} />
                <Select label="Trajectory" value={missionTrajId} onChange={setMissionTrajId}
                  options={[
                    ...TRAJECTORY_DB.map(t => ({ value: t.id, label: `${t.name} — ΔV ${(t.dvTotal/1000).toFixed(1)} km/s` })),
                    { value: "custom", label: "Custom Trajectory — specify transit time" },
                  ]} />
                {missionTrajId === "custom" && (
                  <Input label="Desired Transit Time" value={customTrajDays} onChange={setCustomTrajDays} unit="days" min={30} max={600} step={5} />
                )}
                <Input label="Payload Mass" value={payloadMass} onChange={setPayloadMass} unit="kg" min={100} step={1000} />
                <Input label="Propellant Mass" value={propellantMass} onChange={setPropellantMass} unit="kg" min={100} step={1000} />
                <Input label="Number of Thrusters" value={numThrusters} onChange={setNumThrusters} unit="×" min={1} max={100} />
              </Card>

              <Card title="Trajectory Info" style={{ marginTop: 16 }}>
                <p style={{ fontSize: 12, color: S.textDim, lineHeight: 1.5, margin: 0 }}>{missionTrajectory.description}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <Stat label="ΔV Required" value={formatNum(missionTrajectory.dvTotal / 1000, 1)} unit="km/s" small />
                  <Stat label="Type" value={missionTrajectory.type} small />
                  {missionTrajectory.transferDays && <Stat label="Transfer Time" value={missionTrajectory.transferDays} unit="days" small />}
                </div>
              </Card>

              <Card title="Thruster: Mass Breakdown" style={{ marginTop: 16 }}>
                <MassBreakdownBar massBkdn={missionThruster.massBkdn} total={missionThruster.mass} />
                {numThrusters > 1 && (
                  <div style={{ fontSize: 11, color: S.textDim, marginTop: 8 }}>
                    × {numThrusters} thrusters = <b style={{ color: S.text }}>{formatNum(missionThruster.mass * numThrusters, 0)} kg</b> total propulsion mass
                  </div>
                )}
              </Card>
            </div>

            {/* Results */}
            <div>
              {/* Feasibility banner */}
              <div style={{
                padding: "12px 20px", borderRadius: 8, marginBottom: 16,
                background: missionResult.feasible ? S.accentDim + "33" : "#7f1d1d33",
                border: `1px solid ${missionResult.feasible ? S.accent + "66" : S.danger + "66"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: missionResult.feasible ? S.accent : S.danger }}>
                    {missionResult.feasible ? "✓ MISSION FEASIBLE" : "✗ INSUFFICIENT ΔV"}
                  </span>
                  <span style={{ fontSize: 12, color: S.textDim, marginLeft: 12 }}>
                    {missionThruster.name} + {missionTrajectory.name}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>
                    {missionResult.transitDays ? formatDays(missionResult.transitDays) : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: S.textDim }}>TRANSIT TIME</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Card title="ΔV Budget">
                  <Stat label="Capability" value={formatNum(missionResult.dvCapability / 1000, 2)} unit="km/s" color={S.accent} />
                  <Stat label="Required" value={formatNum(missionResult.dvRequired / 1000, 2)} unit="km/s" small />
                  <Stat label="Margin" value={formatNum(missionResult.dvMargin / 1000, 2)} unit="km/s"
                    color={missionResult.dvMargin >= 0 ? S.accent : S.danger} small />
                  <div style={{ height: 8, borderRadius: 4, background: S.surfaceHi, marginTop: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 4,
                      width: `${Math.min(100, (missionResult.dvRequired / missionResult.dvCapability) * 100)}%`,
                      background: missionResult.feasible ? S.accent : S.danger,
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: S.textDim, marginTop: 4 }}>
                    {formatNum(100 * missionResult.dvRequired / missionResult.dvCapability, 1)}% of budget used
                  </div>
                </Card>

                <Card title="Mass Budget">
                  <Stat label="Initial Mass (m₀)" value={formatNum(missionResult.m0, 0)} unit="kg" />
                  <Stat label="Mass Ratio" value={missionResult.massRatio.toFixed(2)} unit="m₀/mf" small />
                  <Stat label="Propellant Used" value={formatNum(missionResult.propUsed, 0)} unit="kg" small />
                  <Stat label="Propellant Remaining" value={formatNum(missionResult.propRemaining, 0)} unit="kg"
                    color={missionResult.propRemaining > 0 ? S.accent : S.warn} small />
                  <div style={{ height: 8, borderRadius: 4, background: S.surfaceHi, marginTop: 8, overflow: "hidden", display: "flex" }}>
                    <div style={{ height: "100%", width: `${(payloadMass / missionResult.m0) * 100}%`, background: S.info }} />
                    <div style={{ height: "100%", width: `${(missionResult.thrusterDryMass / missionResult.m0) * 100}%`, background: S.warn }} />
                    <div style={{ height: "100%", width: `${(missionResult.propUsed / missionResult.m0) * 100}%`, background: S.accent }} />
                    <div style={{ height: "100%", width: `${(missionResult.propRemaining / missionResult.m0) * 100}%`, background: S.textMuted }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 9, color: S.textDim }}>
                    <span><span style={{ color: S.info }}>■</span> Payload</span>
                    <span><span style={{ color: S.warn }}>■</span> Propulsion</span>
                    <span><span style={{ color: S.accent }}>■</span> Prop Used</span>
                    <span><span style={{ color: S.textMuted }}>■</span> Prop Left</span>
                  </div>
                </Card>

                <Card title="Performance">
                  <Stat label="Thrust (total)" value={missionResult.F >= 1000 ? formatNum(missionResult.F, 1) : missionResult.F >= 1 ? missionResult.F.toFixed(2) : (missionResult.F * 1000).toFixed(1)} unit={missionResult.F >= 1 ? "N" : "mN"} />
                  <Stat label="Initial Accel" value={formatNum(missionResult.a0 * 1000, 3)} unit="mm/s²" small />
                  <Stat label="Final Accel" value={formatNum(missionResult.aFinal * 1000, 3)} unit="mm/s²" small />
                  <Stat label="Burn Time" value={formatDays(missionResult.burnTimeDays)} small />
                  <Stat label="Jet Power" value={formatNum(missionResult.jetPower, 1)} unit="W" small />
                  <Stat label="Specific Power (α)" value={formatNum(missionResult.alpha, 1)} unit="W/kg" small />
                </Card>
              </div>

              {/* Burn Profile: propellant remaining vs mission day */}
              <Card title="Burn Profile: Propellant Remaining vs Time">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={(() => {
                    const pts = [];
                    const tDays = missionResult.transitDays || missionResult.burnTimeDays || 100;
                    const bDays = missionResult.burnTimeDays || 0;
                    const pUsed = missionResult.propUsed || 0;
                    const steps = 60;
                    for (let i = 0; i <= steps; i++) {
                      const day = (i / steps) * tDays;
                      const propRemain = day <= bDays && bDays > 0
                        ? propellantMass - (pUsed * day / bDays)
                        : propellantMass - pUsed;
                      pts.push({ day: Math.round(day), propellant: +(propRemain / 1000).toFixed(2) });
                    }
                    return pts;
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="day" tick={{ fill: S.textDim, fontSize: 10 }}
                      label={{ value: "Mission Day", position: "bottom", fill: S.textDim, fontSize: 10 }} />
                    <YAxis tick={{ fill: S.textDim, fontSize: 10 }}
                      label={{ value: "Propellant (tonnes)", angle: -90, position: "left", fill: S.textDim, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: S.surfaceHi, border: `1px solid ${S.border}`, fontSize: 11, borderRadius: 4 }}
                      formatter={(v) => [`${v} t`, "Propellant"]} labelFormatter={(d) => `Day ${d}`} />
                    <Line type="monotone" dataKey="propellant" stroke={S.accent} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: S.textDim, marginTop: 4 }}>
                  Burn phase: {formatDays(missionResult.burnTimeDays)} | Coast: {missionResult.transitDays && missionResult.burnTimeDays ? formatDays(missionResult.transitDays - missionResult.burnTimeDays) : "—"}
                </div>
              </Card>

              {/* Mission Closure: which thrusters can fly this trajectory? */}
              <Card title="Mission Closure Check" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: S.textDim, marginBottom: 12 }}>
                  Which thrusters can close <b style={{ color: S.text }}>{missionTrajectory.name}</b> with {formatNum(payloadMass / 1000, 0)}t payload + {formatNum(propellantMass / 1000, 0)}t propellant?
                </div>
                {(() => {
                  const cats = Object.keys(CAT_COLORS);
                  const results = cats.map(cat => {
                    const catThrusters = thrusters.filter(t => t.category === cat);
                    const checked = catThrusters.map(t => {
                      const r = computeMission(t, missionTrajectory, payloadMass, propellantMass, numThrusters);
                      return { thruster: t, result: r };
                    });
                    const feasibleOnes = checked.filter(c => c.result.feasible);
                    const best = feasibleOnes.length > 0
                      ? feasibleOnes.reduce((a, b) => (a.result.transitDays || Infinity) < (b.result.transitDays || Infinity) ? a : b)
                      : null;
                    return { cat, total: catThrusters.length, feasible: feasibleOnes.length, best };
                  });
                  const totalFeasible = results.reduce((s, r) => s + r.feasible, 0);
                  const totalThrusters = results.reduce((s, r) => s + r.total, 0);
                  return (
                    <>
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 12,
                      }}>
                        {results.map(r => (
                          <div key={r.cat} style={{
                            padding: "8px 10px", borderRadius: 6,
                            background: r.feasible > 0 ? (CAT_COLORS[r.cat] || S.accent) + "11" : S.surfaceHi,
                            border: `1px solid ${r.feasible > 0 ? (CAT_COLORS[r.cat] || S.accent) + "44" : S.border}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: CAT_COLORS[r.cat] || S.text, marginBottom: 2 }}>{r.cat}</div>
                            <div style={{ fontSize: 10, color: r.feasible > 0 ? S.accent : S.textDim }}>
                              {r.feasible}/{r.total} feasible
                            </div>
                            {r.best && (
                              <div style={{ fontSize: 10, color: S.textDim, marginTop: 2 }}>
                                Best: {r.best.thruster.name} — {r.best.result.transitDays ? formatDays(r.best.result.transitDays) : "N/A"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {totalFeasible === 0 && (
                        <div style={{
                          padding: "10px 14px", borderRadius: 6, background: "#7f1d1d33",
                          border: `1px solid ${S.danger}44`, fontSize: 12, color: S.danger, fontWeight: 600,
                        }}>
                          No thruster in the database can close this trajectory with the current mass budget. Try increasing propellant, reducing payload, or choosing a less aggressive trajectory.
                        </div>
                      )}
                      {totalFeasible > 0 && (
                        <div style={{ fontSize: 11, color: S.textDim }}>
                          {totalFeasible}/{totalThrusters} thrusters across {results.filter(r => r.feasible > 0).length}/{results.length} categories can close this mission.
                        </div>
                      )}
                    </>
                  );
                })()}
              </Card>
            </div>
          </div>
        )}

        {/* ═══ COMPARATOR ═══ */}
        {tab === "compare" && (
          <div>
            {/* Config rows */}
            <Card title="Mission Pairings" headerRight={
              <button onClick={addCompareItem} style={{
                padding: "3px 12px", background: S.accent, color: "#000", border: "none",
                borderRadius: 4, fontWeight: 700, fontSize: 11, cursor: "pointer",
              }}>+ Add</button>
            }>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {compareItems.map((item, idx) => (
                  <div key={idx} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 60px 32px", gap: 8, alignItems: "end",
                    padding: "8px 0", borderBottom: idx < compareItems.length - 1 ? `1px solid ${S.border}` : "none",
                  }}>
                    <Select label={idx === 0 ? "Thruster" : ""} value={item.thrusterId} onChange={v => updateCompareItem(idx, "thrusterId", v)}
                      options={thrusters.map(t => ({ value: t.id, label: t.name }))} />
                    <Select label={idx === 0 ? "Trajectory" : ""} value={item.trajId} onChange={v => updateCompareItem(idx, "trajId", v)}
                      options={TRAJECTORY_DB.map(t => ({ value: t.id, label: t.name }))} />
                    <Input label={idx === 0 ? "Payload (kg)" : ""} value={item.payload} onChange={v => updateCompareItem(idx, "payload", v)} min={100} />
                    <Input label={idx === 0 ? "Propellant (kg)" : ""} value={item.propellant} onChange={v => updateCompareItem(idx, "propellant", v)} min={100} />
                    <Input label={idx === 0 ? "# Eng" : ""} value={item.num} onChange={v => updateCompareItem(idx, "num", v)} min={1} />
                    <button onClick={() => removeCompareItem(idx)} style={{
                      padding: 4, background: "transparent", border: `1px solid ${S.border}`,
                      borderRadius: 4, color: S.danger, cursor: "pointer", fontSize: 14, marginBottom: 8,
                    }}>×</button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Comparison table */}
            <Card title="Results Comparison" style={{ marginTop: 16 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${S.border}` }}>
                      {["Config", "Feasible", "ΔV Cap (km/s)", "ΔV Req (km/s)", "Margin", "Transit", "Burn", "m₀ (t)", "Mass Ratio", "Prop Used (t)", "Prop Left (t)", "Accel₀ (mm/s²)", "α (W/kg)"].map(h => (
                        <th key={h} style={{ padding: "8px 6px", textAlign: "left", color: S.textDim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareResults.map((cr, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${S.border}`, background: idx % 2 === 0 ? "transparent" : S.surfaceHi + "44" }}>
                        <td style={{ padding: "8px 6px" }}>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{cr.thruster.name}</div>
                          <div style={{ fontSize: 10, color: S.textDim }}>{cr.trajectory.name}</div>
                        </td>
                        <td style={{ padding: "8px 6px", color: cr.result.feasible ? S.accent : S.danger, fontWeight: 700 }}>
                          {cr.result.feasible ? "YES" : "NO"}
                        </td>
                        <td style={{ padding: "8px 6px" }}>{(cr.result.dvCapability / 1000).toFixed(1)}</td>
                        <td style={{ padding: "8px 6px" }}>{(cr.result.dvRequired / 1000).toFixed(1)}</td>
                        <td style={{ padding: "8px 6px", color: cr.result.dvMargin >= 0 ? S.accent : S.danger }}>
                          {(cr.result.dvMargin / 1000).toFixed(1)}
                        </td>
                        <td style={{ padding: "8px 6px", fontWeight: 700 }}>{cr.result.transitDays ? formatDays(cr.result.transitDays) : "—"}</td>
                        <td style={{ padding: "8px 6px" }}>{formatDays(cr.result.burnTimeDays)}</td>
                        <td style={{ padding: "8px 6px" }}>{(cr.result.m0 / 1000).toFixed(1)}</td>
                        <td style={{ padding: "8px 6px" }}>{cr.result.massRatio.toFixed(2)}</td>
                        <td style={{ padding: "8px 6px" }}>{(cr.result.propUsed / 1000).toFixed(1)}</td>
                        <td style={{ padding: "8px 6px", color: cr.result.propRemaining > 0 ? S.accent : S.warn }}>
                          {(cr.result.propRemaining / 1000).toFixed(1)}
                        </td>
                        <td style={{ padding: "8px 6px" }}>{(cr.result.a0 * 1000).toFixed(3)}</td>
                        <td style={{ padding: "8px 6px" }}>{formatNum(cr.result.alpha, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Visual comparisons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <Card title="Transit Time Comparison">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={compareResults.map(cr => ({
                    name: cr.thruster.name.substring(0, 12),
                    transit: cr.result.transitDays || 0,
                    burn: cr.result.burnTimeDays || 0,
                    color: CAT_COLORS[cr.thruster.category],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="name" tick={{ fill: S.textDim, fontSize: 9 }} angle={-20} />
                    <YAxis tick={{ fill: S.textDim, fontSize: 10 }}
                      label={{ value: "Days", angle: -90, position: "left", fill: S.textDim, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: S.surfaceHi, border: `1px solid ${S.border}`, fontSize: 11, borderRadius: 4 }} />
                    <Bar dataKey="transit" name="Transit" fill={S.accent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="burn" name="Burn" fill={S.info} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="ΔV Budget Comparison">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={compareResults.map(cr => ({
                    name: cr.thruster.name.substring(0, 12),
                    capability: cr.result.dvCapability / 1000,
                    required: cr.result.dvRequired / 1000,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="name" tick={{ fill: S.textDim, fontSize: 9 }} angle={-20} />
                    <YAxis tick={{ fill: S.textDim, fontSize: 10 }}
                      label={{ value: "km/s", angle: -90, position: "left", fill: S.textDim, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: S.surfaceHi, border: `1px solid ${S.border}`, fontSize: 11, borderRadius: 4 }} />
                    <Bar dataKey="capability" name="ΔV Capability" fill={S.accent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="required" name="ΔV Required" fill={S.danger} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Mass Ratio Comparison">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={compareResults.map(cr => ({
                    name: cr.thruster.name.substring(0, 12),
                    massRatio: cr.result.massRatio,
                    propFraction: (cr.result.propUsed / cr.result.m0) * 100,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <XAxis dataKey="name" tick={{ fill: S.textDim, fontSize: 9 }} angle={-20} />
                    <YAxis tick={{ fill: S.textDim, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: S.surfaceHi, border: `1px solid ${S.border}`, fontSize: 11, borderRadius: 4 }} />
                    <Bar dataKey="massRatio" name="Mass Ratio (m₀/mf)" fill={S.warn} radius={[4, 4, 0, 0]} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Specific Power (α) Comparison">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={compareResults.map(cr => ({
                    name: cr.thruster.name.substring(0, 12),
                    alpha: cr.result.alpha,
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
                    <YAxis type="category" dataKey="name" tick={{ fill: S.textDim, fontSize: 9 }} width={90} />
                    <XAxis type="number" tick={{ fill: S.textDim, fontSize: 10 }} scale="log" domain={['auto', 'auto']}
                      label={{ value: "W/kg (log)", position: "bottom", fill: S.textDim, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: S.surfaceHi, border: `1px solid ${S.border}`, fontSize: 11, borderRadius: 4 }} />
                    <Bar dataKey="alpha" name="α (W/kg)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ ORBITAL VIEW ═══ */}
        {tab === "orbit" && (
          !missionResult.feasible ? (
            <Card title="Orbital View Unavailable">
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✗</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: S.danger, marginBottom: 8 }}>Mission Not Feasible</div>
                <p style={{ fontSize: 13, color: S.textDim, marginBottom: 24, maxWidth: 420, margin: "0 auto 24px" }}>
                  <b>{missionThruster.name}</b> on <b>{missionTrajectory.name}</b> does not have enough ΔV
                  ({formatNum(missionResult.dvCapability / 1000, 1)} km/s capability vs {formatNum(missionResult.dvRequired / 1000, 1)} km/s required).
                  Adjust your mission parameters to view the orbital transfer.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={() => setTab("mission")} style={{
                    padding: "10px 20px", background: S.accent, color: "#000", border: "none",
                    borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>Go to Mission Planner</button>
                  <button onClick={() => setTab("lab")} style={{
                    padding: "10px 20px", background: "transparent", color: S.accent, border: `1px solid ${S.accent}`,
                    borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>Browse Thruster Lab</button>
                </div>
              </div>
            </Card>
          ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            <Card title="Earth–Mars Transfer Visualization">
              <OrbitalView trajectory={missionTrajectory} missionResult={missionResult} thruster={missionThruster} />
              <p style={{ fontSize: 11, color: S.textDim, marginTop: 8 }}>
                Animated transfer orbit. Green dot = spacecraft. Orbit sizes to scale (1 AU : 1.524 AU).
                Configured in Mission Planner: <b style={{ color: S.accent }}>{missionThruster.name}</b> on <b>{missionTrajectory.name}</b>.
              </p>
            </Card>

            <div>
              <Card title="Active Mission Summary">
                <Stat label="Thruster" value={missionThruster.name} />
                <Stat label="Trajectory" value={missionTrajectory.name} small />
                <hr style={{ border: "none", borderTop: `1px solid ${S.border}`, margin: "12px 0" }} />
                <Stat label="Transit Time" value={missionResult.transitDays ? formatDays(missionResult.transitDays) : "N/A"}
                  color={missionResult.feasible ? S.accent : S.danger} />
                <Stat label="ΔV Budget" value={formatNum(missionResult.dvCapability / 1000, 2)} unit="km/s" small />
                <Stat label="ΔV Margin" value={formatNum(missionResult.dvMargin / 1000, 2)} unit="km/s"
                  color={missionResult.dvMargin >= 0 ? S.accent : S.danger} small />
                <hr style={{ border: "none", borderTop: `1px solid ${S.border}`, margin: "12px 0" }} />
                <Stat label="m₀" value={formatNum(missionResult.m0 / 1000, 1)} unit="tonnes" small />
                <Stat label="Mass Ratio" value={missionResult.massRatio.toFixed(2)} small />
                <Stat label="Prop Used" value={formatNum(missionResult.propUsed / 1000, 1)} unit="t" small />
                <Stat label="Prop Left" value={formatNum(missionResult.propRemaining / 1000, 1)} unit="t" small />
                <Stat label="Burn Time" value={formatDays(missionResult.burnTimeDays)} small />
                <Stat label="Initial Accel" value={formatNum(missionResult.a0 * 1000, 3)} unit="mm/s²" small />
              </Card>

              <Card title="Quick Comparison" style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: S.textDim, marginBottom: 8 }}>Same trajectory, different thrusters:</div>
                {["raptor2_vac", "nerva", "dfd_1mw", "fission_nep_1mw"].map(tid => {
                  const thr = thrusters.find(t => t.id === tid);
                  if (!thr) return null;
                  const r = computeMission(thr, missionTrajectory, payloadMass, propellantMass, tid === "raptor2_vac" ? 6 : 1);
                  return (
                    <div key={tid} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "6px 0", borderBottom: `1px solid ${S.border}`,
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: CAT_COLORS[thr.category] }}>{thr.name}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: r.feasible ? S.accent : S.danger }}>
                          {r.transitDays ? formatDays(r.transitDays) : "N/A"}
                        </span>
                        <span style={{ fontSize: 10, color: S.textDim, marginLeft: 8 }}>
                          {(r.dvCapability / 1000).toFixed(1)} km/s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </div>
          )
        )}
      </div>
    </div>
  );
}
