import { useState, useEffect, useCallback, useRef } from "react";
import {
  Clock, LogIn, LogOut, Users, FileText, BarChart2, Shield,
  Coffee, Plus, Trash2, Edit3, Download, X, Check, AlertCircle,
  Menu, Eye, EyeOff, Lock, Wifi, WifiOff, User,
  Calendar, ClipboardList, ChevronRight, Key, Bell, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Search, Filter
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const genId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));

const fmtDate = (ts) =>
  new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtDT = (ts) => `${fmtDate(ts)} ${fmtTime(ts)}`;

const fmtDuration = (ms) => {
  if (!ms || ms < 0) return "0h 00m";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

async function sha256(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return Math.random().toString(36).substr(2, 64);
  }
}

const DEMO_2FA = "123456";

const initials = (name) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substr(0, 2)
    .toUpperCase();

// ─────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────
const SEED_USERS = [
  {
    id: "u_admin",
    name: "María García",
    email: "admin@orchateria.es",
    password: "Admin123!",
    role: "admin",
    active: true,
    position: "Gerente",
    department: "Dirección",
    tfa: true,
    createdAt: Date.now() - 45 * 86400000,
  },
  {
    id: "u_emp1",
    name: "Carlos Martínez",
    email: "carlos@orchateria.es",
    password: "Carlos123!",
    role: "employee",
    active: true,
    position: "Barista",
    department: "Servicio",
    tfa: true,
    createdAt: Date.now() - 30 * 86400000,
  },
  {
    id: "u_emp2",
    name: "Ana López",
    email: "ana@orchateria.es",
    password: "Ana123!",
    role: "employee",
    active: true,
    position: "Encargada",
    department: "Servicio",
    tfa: false,
    createdAt: Date.now() - 20 * 86400000,
  },
];

function buildSeedRecords(users) {
  const records = [];
  const empUsers = users.filter((u) => u.role === "employee");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  empUsers.forEach((u) => {
    // 5 days of history
    for (let d = 5; d >= 1; d--) {
      const base = today.getTime() - d * 86400000;
      if (new Date(base).getDay() === 0 || new Date(base).getDay() === 6) continue;
      const inTs = base + (8 + Math.random()) * 3600000;
      const outTs = base + (16 + Math.random() * 2) * 3600000;
      records.push({ id: genId(), userId: u.id, type: "in", ts: Math.floor(inTs), ip: "192.168.1.15", hash: "", edited: false, edits: [] });
      records.push({ id: genId(), userId: u.id, type: "out", ts: Math.floor(outTs), ip: "192.168.1.15", hash: "", edited: false, edits: [] });
    }
    // Today - clocked in only
    records.push({
      id: genId(),
      userId: u.id,
      type: "in",
      ts: today.getTime() + 8 * 3600000 + Math.floor(Math.random() * 30) * 60000,
      ip: "192.168.1.15",
      hash: "",
      edited: false,
      edits: [],
    });
  });
  return records;
}

function getInitialData() {
  try {
    const raw = localStorage.getItem("orchateria_v2");
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    users: SEED_USERS,
    records: buildSeedRecords(SEED_USERS),
    logs: [],
  };
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(getInitialData);
  const [page, setPage] = useState("login"); // login | tfa | employee | admin
  const [me, setMe] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const [netOk, setNetOk] = useState(null);
  const [myIp, setMyIp] = useState("");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [clock, setClock] = useState(Date.now());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem("orchateria_v2", JSON.stringify(data));
  }, [data]);

  // Network check on entering dashboard
  useEffect(() => {
    if (page === "employee" || page === "admin") {
      setNetOk(null);
      const t = setTimeout(() => {
        const ip = `192.168.1.${Math.floor(Math.random() * 50 + 10)}`;
        setMyIp(ip);
        setNetOk(true); // In production: server validates IP range server-side
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [page]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const addLog = useCallback(async (action, by, target, prev, next, reason = "") => {
    const entry = { id: genId(), action, by, target, ts: Date.now(), prev, next, reason, hash: "" };
    entry.hash = await sha256(JSON.stringify(entry));
    setData((d) => ({ ...d, logs: [entry, ...d.logs] }));
  }, []);

  // ── AUTH ──
  const handleLogin = (user) => {
    if (user.tfa) {
      setPendingUser(user);
      setPage("tfa");
    } else {
      finalLogin(user);
    }
  };

  const finalLogin = useCallback(
    (user) => {
      setMe(user);
      setPage(user.role === "admin" ? "admin" : "employee");
      addLog("LOGIN", user.id, user.id, null, null, "");
      setPendingUser(null);
    },
    [addLog]
  );

  const handleLogout = useCallback(() => {
    addLog("LOGOUT", me.id, me.id, null, null, "");
    setMe(null);
    setPage("login");
    setSidebarOpen(false);
  }, [me, addLog]);

  // ── CLOCK HELPERS ──
  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const todayRecordsFor = useCallback(
    (userId) =>
      data.records
        .filter((r) => r.userId === userId && r.ts >= todayStart())
        .sort((a, b) => a.ts - b.ts),
    [data.records]
  );

  const isClockedIn = useCallback(
    (userId) => {
      const recs = todayRecordsFor(userId);
      return recs.length > 0 && recs[recs.length - 1].type === "in";
    },
    [todayRecordsFor]
  );

  const clockInOut = useCallback(
    async (userId, type) => {
      if (!netOk) {
        showToast("No estás en la red WiFi de la orchatería", "error");
        return;
      }
      const record = { id: genId(), userId, type, ts: Date.now(), ip: myIp, hash: "", edited: false, edits: [] };
      record.hash = await sha256(JSON.stringify(record));
      setData((d) => ({ ...d, records: [...d.records, record] }));
      await addLog(type === "in" ? "CLOCK_IN" : "CLOCK_OUT", userId, userId, null, record, "");
      showToast(type === "in" ? "✅ Entrada registrada correctamente" : "✅ Salida registrada correctamente");
    },
    [netOk, myIp, addLog, showToast]
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", background: "#faf7f2" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; }
        input, select, textarea, button { font-family: inherit; }
        .mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d4a96a; border-radius: 4px; }
        .btn-primary {
          background: linear-gradient(135deg, #c17d2e 0%, #7c3a0e 100%);
          color: #fff; border: none; cursor: pointer;
          transition: opacity .15s, transform .1s;
        }
        .btn-primary:hover { opacity: .9; }
        .btn-primary:active { transform: scale(.97); }
        .btn-primary:disabled { opacity: .4; cursor: not-allowed; transform: none; }
        .btn-ghost { background: transparent; border: 1.5px solid #e0d5c5; color: #7a6a50; cursor: pointer; transition: background .15s; }
        .btn-ghost:hover { background: #f5ede0; }
        .card { background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,.07); }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .slide-in { animation: slideIn .2s ease; }
        @keyframes slideIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, padding: "12px 20px", borderRadius: 12,
            background: toast.type === "error" ? "#c0392b" : "#1a7a4a",
            color: "#fff", fontWeight: 600, fontSize: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,.2)", whiteSpace: "nowrap",
          }}
        >
          {toast.msg}
        </div>
      )}

      {page === "login" && <LoginScreen users={data.users} onLogin={handleLogin} />}
      {page === "tfa" && (
        <TFAScreen user={pendingUser} onVerify={() => finalLogin(pendingUser)} onBack={() => setPage("login")} />
      )}
      {page === "employee" && (
        <EmployeeView
          me={me} data={data} netOk={netOk} myIp={myIp}
          todayRecords={todayRecordsFor(me.id)} isClockedIn={isClockedIn(me.id)}
          onClockInOut={clockInOut} onLogout={handleLogout} clock={clock}
        />
      )}
      {page === "admin" && (
        <AdminView
          me={me} data={data} setData={setData} netOk={netOk} myIp={myIp}
          addLog={addLog} isClockedIn={isClockedIn} todayRecordsFor={todayRecordsFor}
          onClockInOut={clockInOut} onLogout={handleLogout}
          tab={adminTab} setTab={setAdminTab}
          sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
          showToast={showToast} clock={clock}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NETWORK BADGE
// ─────────────────────────────────────────────────────────────
function NetworkBadge({ netOk, ip, small }) {
  const sz = small ? 11 : 13;
  if (netOk === null)
    return (
      <span className="badge" style={{ background: "#fef9ec", color: "#a07010" }}>
        <RefreshCw size={sz} className="spin" /> Verificando red…
      </span>
    );
  if (netOk)
    return (
      <span className="badge" style={{ background: "#ecfdf5", color: "#166534" }}>
        <Wifi size={sz} /> Red local · {ip}
      </span>
    );
  return (
    <span className="badge" style={{ background: "#fef2f2", color: "#b91c1c" }}>
      <WifiOff size={sz} /> Fuera de red local
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────
function LoginScreen({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !pass) { setError("Por favor, completa todos los campos"); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const user = users.find((u) => u.email === email && u.password === pass && u.active);
    setLoading(false);
    if (!user) { setError("Credenciales incorrectas o usuario inactivo"); return; }
    setError("");
    onLogin(user);
  };

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        background: "radial-gradient(ellipse at 60% 0%, #f5c97a 0%, #c47e26 40%, #5c2b0e 100%)",
      }}
    >
      <div className="slide-in" style={{ width: "100%", maxWidth: 400 }}>
        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 24, padding: "40px 36px", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
              background: "linear-gradient(135deg,#f5c97a,#8b3a0e)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(139,58,14,.4)",
            }}>
              <Coffee size={36} color="#fff" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a0a00", letterSpacing: -.5 }}>Orchatería</h1>
            <p style={{ fontSize: 13, color: "#9c7a50", marginTop: 4 }}>Control horario · Acceso seguro</p>
          </div>

          {/* Demo info */}
          <div style={{ background: "#fdf8f0", border: "1px solid #e8d5b0", borderRadius: 12, padding: "12px 14px", marginBottom: 24, fontSize: 12, color: "#8b5e2e" }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>🧪 Credenciales de demo</p>
            <p><span style={{ fontWeight: 600 }}>Admin:</span> admin@orchateria.es / Admin123!</p>
            <p><span style={{ fontWeight: 600 }}>Empleado:</span> carlos@orchateria.es / Carlos123!</p>
            <p style={{ marginTop: 4, color: "#c17d2e", fontWeight: 600 }}>Código 2FA: 123456</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Correo electrónico">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@orchateria.es"
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </Field>
            <Field label="Contraseña">
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"} value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button onClick={() => setShowPass(!showPass)} style={iconBtnStyle}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#b91c1c", display: "flex", gap: 8, alignItems: "center" }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={submit}
              disabled={loading}
              style={{ padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              {loading ? <RefreshCw size={18} className="spin" /> : <LogIn size={18} />}
              {loading ? "Verificando…" : "Iniciar sesión"}
            </button>
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "#b0967a" }}>
            <Shield size={12} />
            <span>RGPD · LOPDGDD · RD-L 8/2019 · 2FA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2FA SCREEN
// ─────────────────────────────────────────────────────────────
function TFAScreen({ user, onVerify, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const verify = () => {
    if (code === DEMO_2FA) onVerify();
    else setError("Código incorrecto. (Demo: 123456)");
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      background: "radial-gradient(ellipse at 60% 0%, #f5c97a 0%, #c47e26 40%, #5c2b0e 100%)",
    }}>
      <div className="slide-in" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ background: "#fff", borderRadius: 24, padding: "40px 32px", boxShadow: "0 24px 80px rgba(0,0,0,.25)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: "#fef3e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Key size={28} color="#c17d2e" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a0a00" }}>Verificación en dos pasos</h2>
            <p style={{ fontSize: 13, color: "#9c7a50", marginTop: 6 }}>Introduce el código de tu aplicación autenticadora</p>
          </div>

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#1e40af", textAlign: "center" }}>
            🔐 Código demo: <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700 }}>123456</span>
          </div>

          <input
            ref={inputRef}
            type="text" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            style={{ width: "100%", border: "2px solid #e0d5c5", borderRadius: 12, padding: "16px", fontSize: 28, fontFamily: "monospace", letterSpacing: 16, textAlign: "center", outline: "none", transition: "border .2s" }}
            onFocus={(e) => (e.target.style.borderColor = "#c17d2e")}
            onBlur={(e) => (e.target.style.borderColor = "#e0d5c5")}
            onKeyDown={(e) => e.key === "Enter" && verify()}
          />

          {error && <p style={{ color: "#b91c1c", fontSize: 13, textAlign: "center", marginTop: 10 }}>{error}</p>}

          <button className="btn-primary" onClick={verify} style={{ width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle size={18} /> Verificar código
          </button>
          <button className="btn-ghost" onClick={onBack} style={{ width: "100%", padding: 12, borderRadius: 12, fontSize: 14, marginTop: 10 }}>
            ← Volver al login
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPLOYEE VIEW
// ─────────────────────────────────────────────────────────────
function EmployeeView({ me, data, netOk, myIp, todayRecords, isClockedIn, onClockInOut, onLogout, clock }) {
  const [tab, setTab] = useState("clock");

  const myRecords = data.records.filter((r) => r.userId === me.id).sort((a, b) => b.ts - a.ts);

  const byDay = {};
  myRecords.forEach((r) => {
    const d = fmtDate(r.ts);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(r);
  });

  const calcDayHours = (recs) => {
    const sorted = [...recs].sort((a, b) => a.ts - b.ts);
    let total = 0, lastIn = null;
    sorted.forEach((r) => {
      if (r.type === "in") lastIn = r.ts;
      else if (r.type === "out" && lastIn) { total += r.ts - lastIn; lastIn = null; }
    });
    if (lastIn) total += Date.now() - lastIn;
    return total;
  };

  const todayHours = calcDayHours(todayRecords);
  const lastIn = todayRecords.filter((r) => r.type === "in").pop();

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2" }}>
      {/* HEADER */}
      <div style={{ background: "#fff", borderBottom: "1px solid #ede5d8", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={me.name} size={36} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a0a00" }}>{me.name}</p>
            <p style={{ fontSize: 12, color: "#9c7a50" }}>{me.position}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NetworkBadge netOk={netOk} ip={myIp} small />
          <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "#9c7a50", padding: 6 }}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: "#fff", borderBottom: "1px solid #ede5d8", display: "flex" }}>
        {[["clock", <Clock size={14} />, "Fichar"], ["history", <Calendar size={14} />, "Mi historial"]].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "12px 0", fontSize: 13, fontWeight: 600,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === id ? "2.5px solid #c17d2e" : "2.5px solid transparent",
              color: tab === id ? "#c17d2e" : "#9c7a50",
              transition: "all .2s",
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        {tab === "clock" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Status card */}
            <div style={{
              borderRadius: 20, padding: 28, textAlign: "center", color: "#fff",
              background: isClockedIn
                ? "linear-gradient(135deg,#059669,#047857)"
                : "linear-gradient(135deg,#c17d2e,#7c3a0e)",
              boxShadow: isClockedIn ? "0 8px 32px rgba(5,150,105,.3)" : "0 8px 32px rgba(193,125,46,.3)",
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{isClockedIn ? "🟢" : "⚪"}</div>
              <p style={{ fontSize: 20, fontWeight: 700 }}>{isClockedIn ? "Trabajando" : "Sin fichar"}</p>
              <p style={{ fontSize: 13, opacity: .8, marginTop: 4 }}>
                {new Date(clock).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p style={{ fontSize: 22, fontFamily: "monospace", fontWeight: 700, marginTop: 8, letterSpacing: 2 }}>
                {new Date(clock).toLocaleTimeString("es-ES")}
              </p>
              {isClockedIn && lastIn && (
                <div style={{ marginTop: 12, background: "rgba(255,255,255,.2)", borderRadius: 10, padding: "6px 16px", display: "inline-block" }}>
                  <p style={{ fontSize: 12 }}>Entrada: {fmtTime(lastIn.ts)} · {fmtDuration(todayHours)}</p>
                </div>
              )}
            </div>

            {/* Clock button */}
            <button
              className="btn-primary"
              onClick={() => onClockInOut(me.id, isClockedIn ? "out" : "in")}
              disabled={netOk !== true}
              style={{
                width: "100%", padding: "18px", borderRadius: 16, fontSize: 16, fontWeight: 700,
                background: isClockedIn
                  ? "linear-gradient(135deg,#dc2626,#9b1c1c)"
                  : "linear-gradient(135deg,#16a34a,#14532d)",
              }}
            >
              {isClockedIn ? "🔴 Registrar Salida" : "🟢 Registrar Entrada"}
            </button>

            {netOk === false && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14, display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "#b91c1c" }}>
                <WifiOff size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontWeight: 700 }}>Fuera de la red de la orchatería</p>
                  <p style={{ marginTop: 2, opacity: .8 }}>Solo puedes fichar desde la red WiFi del establecimiento.</p>
                </div>
              </div>
            )}

            {/* Today records */}
            {todayRecords.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#7a6a50", marginBottom: 12 }}>REGISTROS DE HOY</p>
                {todayRecords.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5ede0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.type === "in" ? "#16a34a" : "#dc2626" }} />
                      <span style={{ fontSize: 14, color: "#1a0a00", fontWeight: 500 }}>{r.type === "in" ? "Entrada" : "Salida"}</span>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 15, color: "#1a0a00", fontWeight: 600 }}>{fmtTime(r.ts)}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f5ede0", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9c7a50" }}>
                  <span>Total hoy</span>
                  <span style={{ fontWeight: 700, color: "#c17d2e" }}>{fmtDuration(todayHours)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fef8ec", border: "1px solid #f5d98e", borderRadius: 12, padding: 12, fontSize: 12, color: "#92680a", display: "flex", gap: 8 }}>
              <Shield size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Registros con firma digital SHA-256 · Conservados mínimo 4 años (RGPD / RD-L 8/2019)</span>
            </div>
            {Object.entries(byDay).map(([day, recs]) => {
              const sorted = [...recs].sort((a, b) => a.ts - b.ts);
              const hours = calcDayHours(recs);
              return (
                <div key={day} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1a0a00" }}>{day}</span>
                    <span className="badge" style={{ background: "#fef3e2", color: "#c17d2e" }}>{fmtDuration(hours)}</span>
                  </div>
                  {sorted.map((r) => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f9f3ec" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: r.type === "in" ? "#16a34a" : "#dc2626" }} />
                        <span style={{ fontSize: 13, color: "#5a4a38" }}>{r.type === "in" ? "Entrada" : "Salida"}</span>
                        {r.edited && <span className="badge" style={{ background: "#fef9c3", color: "#854d0e", fontSize: 10 }}>editado</span>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 14, color: "#1a0a00", fontWeight: 600 }}>{fmtTime(r.ts)}</span>
                        <p style={{ fontFamily: "monospace", fontSize: 9, color: "#ccc", marginTop: 2 }}>{r.hash.substr(0, 12)}…</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {myRecords.length === 0 && (
              <div style={{ textAlign: "center", padding: 48, color: "#c4b09a" }}>
                <Clock size={40} style={{ margin: "0 auto 12px", opacity: .3 }} />
                <p>Sin registros todavía</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────────────────────────
function AdminView({ me, data, setData, netOk, myIp, addLog, isClockedIn, todayRecordsFor, onClockInOut, onLogout, tab, setTab, sidebarOpen, setSidebarOpen, showToast, clock }) {
  const tabs = [
    { id: "dashboard", icon: <BarChart2 size={18} />, label: "Panel" },
    { id: "clock", icon: <Clock size={18} />, label: "Mi fichaje" },
    { id: "employees", icon: <Users size={18} />, label: "Empleados" },
    { id: "records", icon: <ClipboardList size={18} />, label: "Registros" },
    { id: "audit", icon: <Shield size={18} />, label: "Auditoría" },
  ];

  const SidebarContent = () => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, padding: "4px 0" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Coffee size={20} color="#fde68a" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Orchatería</p>
          <p style={{ fontSize: 11, color: "#f5c97a" }}>Administración</p>
        </div>
      </div>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => { setTab(t.id); setSidebarOpen(false); }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 12, marginBottom: 4,
            background: tab === t.id ? "rgba(255,255,255,.18)" : "transparent",
            border: "none", cursor: "pointer", color: tab === t.id ? "#fff" : "rgba(255,255,255,.65)",
            fontSize: 14, fontWeight: tab === t.id ? 600 : 400, transition: "all .15s",
            textAlign: "left",
          }}
        >
          {t.icon}{t.label}
        </button>
      ))}
      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <div style={{ marginBottom: 12 }}><NetworkBadge netOk={netOk} ip={myIp} small /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Avatar name={me.name} size={30} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{me.name}</p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)" }}>Admin</p>
          </div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.6)", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 220, background: "linear-gradient(180deg,#7c3a0e 0%,#5c2b0e 100%)",
        padding: "24px 16px", display: "none", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", flexShrink: 0,
      }} className="desktop-sidebar">
        <style>{`.desktop-sidebar { display: flex !important; } @media(max-width:768px){ .desktop-sidebar { display: none !important; } }`}</style>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} onClick={() => setSidebarOpen(false)} />
          <div style={{ position: "relative", width: 240, background: "linear-gradient(180deg,#7c3a0e,#5c2b0e)", padding: "24px 16px", display: "flex", flexDirection: "column", zIndex: 1 }}>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.6)", alignSelf: "flex-end", marginBottom: 16 }}>
              <X size={20} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile top bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #ede5d8", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }} className="mobile-topbar">
          <style>{`.mobile-topbar { display: flex !important; } @media(min-width:769px){ .mobile-topbar { display: none !important; } }`}</style>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <Menu size={22} color="#7a6a50" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Coffee size={18} color="#c17d2e" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1a0a00" }}>Orchatería Admin</span>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <LogOut size={18} color="#9c7a50" />
          </button>
        </div>

        <div style={{ flex: 1, padding: "20px 16px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
          {tab === "dashboard" && <AdminDashboard data={data} isClockedIn={isClockedIn} todayRecordsFor={todayRecordsFor} />}
          {tab === "clock" && (
            <AdminClock me={me} netOk={netOk} myIp={myIp}
              todayRecords={todayRecordsFor(me.id)} isClockedIn={isClockedIn(me.id)}
              onClockInOut={onClockInOut} clock={clock} />
          )}
          {tab === "employees" && (
            <EmployeesPanel data={data} setData={setData} addLog={addLog} showToast={showToast} me={me} />
          )}
          {tab === "records" && (
            <RecordsPanel data={data} setData={setData} addLog={addLog} showToast={showToast} me={me} />
          )}
          {tab === "audit" && <AuditPanel logs={data.logs} users={data.users} />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────
function AdminDashboard({ data, isClockedIn, todayRecordsFor }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const employees = data.users.filter((u) => u.active && u.role === "employee");
  const clockedIn = employees.filter((u) => isClockedIn(u.id));
  const todayRecs = data.records.filter((r) => r.ts >= today.getTime());
  const editedRecs = data.records.filter((r) => r.edited);

  const stats = [
    { label: "Empleados activos", value: employees.length, icon: <Users size={20} />, color: "#3b82f6", bg: "#eff6ff" },
    { label: "Fichados ahora", value: clockedIn.length, icon: <Clock size={20} />, color: "#16a34a", bg: "#f0fdf4" },
    { label: "Fichajes hoy", value: todayRecs.length, icon: <ClipboardList size={20} />, color: "#c17d2e", bg: "#fef3e2" },
    { label: "Registros editados", value: editedRecs.length, icon: <Edit3 size={20} />, color: "#7c3aed", bg: "#f5f3ff" },
  ];

  const calcDayHours = (recs) => {
    const sorted = [...recs].sort((a, b) => a.ts - b.ts);
    let total = 0, lastIn = null;
    sorted.forEach((r) => {
      if (r.type === "in") lastIn = r.ts;
      else if (r.type === "out" && lastIn) { total += r.ts - lastIn; lastIn = null; }
    });
    if (lastIn) total += Date.now() - lastIn;
    return total;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a0a00" }}>Panel de control</h1>
        <p style={{ fontSize: 13, color: "#9c7a50", marginTop: 4 }}>
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: s.color }}>
              {s.icon}
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: "#1a0a00" }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "#9c7a50", marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Team status */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a0a00", marginBottom: 16 }}>Estado del equipo ahora</h2>
        {employees.map((u) => {
          const isIn = isClockedIn(u.id);
          const tr = todayRecordsFor(u.id);
          const lastIn = tr.filter((r) => r.type === "in").pop();
          const hours = calcDayHours(tr);
          return (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f5ede0" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar name={u.name} size={36} />
                <div style={{ position: "absolute", bottom: -1, right: -1, width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff", background: isIn ? "#16a34a" : "#d1d5db" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a0a00" }}>{u.name}</p>
                <p style={{ fontSize: 12, color: "#9c7a50" }}>{u.position}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                {isIn ? (
                  <>
                    <span className="badge" style={{ background: "#f0fdf4", color: "#166534" }}>Trabajando</span>
                    {lastIn && <p style={{ fontSize: 11, color: "#9c7a50", marginTop: 3 }}>desde {fmtTime(lastIn.ts)} · {fmtDuration(hours)}</p>}
                  </>
                ) : (
                  <span className="badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>Fuera</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent logs */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1a0a00", marginBottom: 16 }}>Actividad reciente</h2>
        {data.logs.slice(0, 6).map((l) => {
          const by = data.users.find((u) => u.id === l.by);
          const actionColors = { CLOCK_IN: "#16a34a", CLOCK_OUT: "#dc2626", LOGIN: "#3b82f6", LOGOUT: "#6b7280", EDIT_RECORD: "#d97706", CREATE_USER: "#7c3aed", DEACTIVATE_USER: "#dc2626", ACTIVATE_USER: "#16a34a", EDIT_USER: "#d97706" };
          const actionLabels = { CLOCK_IN: "Entrada", CLOCK_OUT: "Salida", LOGIN: "Login", LOGOUT: "Logout", EDIT_RECORD: "Edición registro", CREATE_USER: "Alta empleado", DEACTIVATE_USER: "Baja empleado", ACTIVATE_USER: "Reactivación", EDIT_USER: "Edición empleado" };
          return (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5ede0", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: actionColors[l.action] || "#9c7a50", flexShrink: 0 }} />
                <span style={{ color: "#5a4a38" }}>{by?.name || l.by}</span>
                <span style={{ color: "#c4b09a" }}>·</span>
                <span style={{ color: actionColors[l.action], fontWeight: 600 }}>{actionLabels[l.action] || l.action}</span>
              </div>
              <span style={{ color: "#c4b09a", fontSize: 11, flexShrink: 0 }}>{fmtTime(l.ts)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN CLOCK
// ─────────────────────────────────────────────────────────────
function AdminClock({ me, netOk, myIp, todayRecords, isClockedIn, onClockInOut, clock }) {
  const calcHours = () => {
    const sorted = [...todayRecords].sort((a, b) => a.ts - b.ts);
    let total = 0, lastIn = null;
    sorted.forEach((r) => {
      if (r.type === "in") lastIn = r.ts;
      else if (r.type === "out" && lastIn) { total += r.ts - lastIn; lastIn = null; }
    });
    if (lastIn) total += Date.now() - lastIn;
    return total;
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a0a00" }}>Mi fichaje</h1>
      <div style={{
        borderRadius: 20, padding: 28, textAlign: "center", color: "#fff",
        background: isClockedIn ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,#c17d2e,#7c3a0e)",
      }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>{isClockedIn ? "🟢" : "⚪"}</div>
        <p style={{ fontSize: 20, fontWeight: 700 }}>{isClockedIn ? "Trabajando" : "Sin fichar"}</p>
        <p style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 700, marginTop: 8, letterSpacing: 3 }}>
          {new Date(clock).toLocaleTimeString("es-ES")}
        </p>
        {isClockedIn && <p style={{ fontSize: 13, marginTop: 6, opacity: .8 }}>Hoy: {fmtDuration(calcHours())}</p>}
      </div>
      <button
        className="btn-primary"
        onClick={() => onClockInOut(me.id, isClockedIn ? "out" : "in")}
        disabled={netOk !== true}
        style={{ width: "100%", padding: 18, borderRadius: 16, fontSize: 16, fontWeight: 700, background: isClockedIn ? "linear-gradient(135deg,#dc2626,#9b1c1c)" : "linear-gradient(135deg,#16a34a,#14532d)" }}
      >
        {isClockedIn ? "🔴 Registrar Salida" : "🟢 Registrar Entrada"}
      </button>
      <NetworkBadge netOk={netOk} ip={myIp} />
      {todayRecords.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          {todayRecords.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f5ede0", fontSize: 14 }}>
              <span style={{ color: r.type === "in" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{r.type === "in" ? "Entrada" : "Salida"}</span>
              <span style={{ fontFamily: "monospace", color: "#1a0a00" }}>{fmtTime(r.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPLOYEES PANEL
// ─────────────────────────────────────────────────────────────
function EmployeesPanel({ data, setData, addLog, showToast, me }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [reason, setReason] = useState("");
  const blankForm = { name: "", email: "", password: "", position: "", department: "", role: "employee", tfa: false };
  const [form, setForm] = useState(blankForm);

  const openNew = () => { setForm(blankForm); setEditingId(null); setShowForm(true); };
  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: u.password, position: u.position || "", department: u.department || "", role: u.role, tfa: u.tfa });
    setEditingId(u.id);
    setShowForm(true);
  };

  const saveEmployee = async () => {
    if (!form.name || !form.email || !form.password) { showToast("Nombre, email y contraseña son obligatorios", "error"); return; }
    if (!reason) { showToast("Indica el motivo del cambio para el registro de auditoría", "error"); return; }
    if (editingId) {
      const prev = data.users.find((u) => u.id === editingId);
      setData((d) => ({ ...d, users: d.users.map((u) => (u.id === editingId ? { ...u, ...form } : u)) }));
      await addLog("EDIT_USER", me.id, editingId, prev, form, reason);
      showToast("Empleado actualizado");
    } else {
      const nu = { id: genId(), ...form, active: true, avatar: initials(form.name), createdAt: Date.now() };
      setData((d) => ({ ...d, users: [...d.users, nu] }));
      await addLog("CREATE_USER", me.id, nu.id, null, nu, reason);
      showToast("Empleado dado de alta");
    }
    setShowForm(false); setEditingId(null); setForm(blankForm); setReason("");
  };

  const confirmToggle = async () => {
    if (!reason) { showToast("El motivo es obligatorio", "error"); return; }
    const u = confirmModal;
    setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x)) }));
    await addLog(u.active ? "DEACTIVATE_USER" : "ACTIVATE_USER", me.id, u.id, { active: u.active }, { active: !u.active }, reason);
    showToast(u.active ? "Empleado dado de baja" : "Empleado reactivado");
    setConfirmModal(null); setReason("");
  };

  const inp = (key, label, type = "text") => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a0a00" }}>Empleados</h1>
        <button className="btn-primary" onClick={openNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> Nuevo empleado
        </button>
      </div>

      {showForm && (
        <div className="card slide-in" style={{ padding: 20, border: "1.5px solid #f5d98e" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#1a0a00" }}>{editingId ? "Editar empleado" : "Nuevo empleado"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}>{inp("name", "Nombre completo *")}</div>
            <div style={{ gridColumn: "1/-1" }}>{inp("email", "Correo electrónico *", "email")}</div>
            <div style={{ gridColumn: "1/-1" }}>{inp("password", "Contraseña *", "password")}</div>
            {inp("position", "Puesto")}
            {inp("department", "Departamento")}
            <div>
              <label style={labelStyle}>Rol</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="employee">Empleado</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22 }}>
              <input type="checkbox" id="tfa_cb" checked={form.tfa} onChange={(e) => setForm((f) => ({ ...f, tfa: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
              <label htmlFor="tfa_cb" style={{ fontSize: 14, color: "#5a4a38", cursor: "pointer" }}>Activar 2FA</label>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Motivo (obligatorio para auditoría) *</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} placeholder="Ej: Contrato indefinido a partir del 01/06/2026" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={saveEmployee} style={{ flex: 1, padding: 12, borderRadius: 10, fontWeight: 600 }}>Guardar</button>
            <button className="btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); setReason(""); }} style={{ flex: 1, padding: 12, borderRadius: 10 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.users.map((u) => (
          <div key={u.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, opacity: u.active ? 1 : .55 }}>
            <Avatar name={u.name} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1a0a00" }}>{u.name}</span>
                <span className="badge" style={{ background: u.role === "admin" ? "#f5f3ff" : "#eff6ff", color: u.role === "admin" ? "#5b21b6" : "#1d4ed8" }}>{u.role === "admin" ? "Admin" : "Empleado"}</span>
                {u.tfa && <span className="badge" style={{ background: "#f0fdf4", color: "#166534" }}>2FA</span>}
                {!u.active && <span className="badge" style={{ background: "#fef2f2", color: "#b91c1c" }}>Baja</span>}
              </div>
              <p style={{ fontSize: 12, color: "#9c7a50", marginTop: 3 }}>{u.email} · {u.position || "Sin puesto"}</p>
              <p style={{ fontSize: 11, color: "#c4b09a" }}>Alta: {fmtDate(u.createdAt)}</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => openEdit(u)} style={{ background: "none", border: "1.5px solid #e0d5c5", borderRadius: 8, padding: 7, cursor: "pointer", color: "#9c7a50" }}>
                <Edit3 size={14} />
              </button>
              {u.id !== me.id && (
                <button onClick={() => setConfirmModal(u)} style={{ background: "none", border: "1.5px solid #e0d5c5", borderRadius: 8, padding: 7, cursor: "pointer", color: u.active ? "#b91c1c" : "#16a34a" }}>
                  {u.active ? <Trash2 size={14} /> : <Check size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <Modal onClose={() => { setConfirmModal(null); setReason(""); }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{confirmModal.active ? "Dar de baja" : "Reactivar"} empleado</h3>
          <p style={{ fontSize: 14, color: "#7a6a50", marginBottom: 16 }}><strong>{confirmModal.name}</strong>. Esta acción quedará registrada con firma digital en el log de auditoría.</p>
          <label style={labelStyle}>Motivo (obligatorio) *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} placeholder="Ej: Fin de contrato temporal 31/05/2026…" />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={confirmToggle} disabled={!reason} style={{ flex: 1, padding: 12, borderRadius: 10, background: confirmModal.active ? "#dc2626" : "#16a34a", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", opacity: reason ? 1 : .4 }}>Confirmar</button>
            <button className="btn-ghost" onClick={() => { setConfirmModal(null); setReason(""); }} style={{ flex: 1, padding: 12, borderRadius: 10 }}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RECORDS PANEL
// ─────────────────────────────────────────────────────────────
function RecordsPanel({ data, setData, addLog, showToast, me }) {
  const [filters, setFilters] = useState({ userId: "", date: "" });
  const [editModal, setEditModal] = useState(null);
  const [editTime, setEditTime] = useState("");
  const [editReason, setEditReason] = useState("");

  const calcDayHours = (userId, dateStr) => {
    const recs = data.records.filter((r) => r.userId === userId && fmtDate(r.ts) === dateStr).sort((a, b) => a.ts - b.ts);
    let total = 0, lastIn = null;
    recs.forEach((r) => {
      if (r.type === "in") lastIn = r.ts;
      else if (r.type === "out" && lastIn) { total += r.ts - lastIn; lastIn = null; }
    });
    return total;
  };

  const filtered = data.records
    .filter((r) => {
      if (filters.userId && r.userId !== filters.userId) return false;
      if (filters.date) {
        const d = new Date(filters.date);
        const rDate = new Date(r.ts); rDate.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
        if (rDate.getTime() !== d.getTime()) return false;
      }
      return true;
    })
    .sort((a, b) => b.ts - a.ts);

  const exportPDF = () => {
    const rows = filtered.map((r) => {
      const u = data.users.find((x) => x.id === r.userId);
      const dayH = calcDayHours(r.userId, fmtDate(r.ts));
      return `<tr><td>${fmtDT(r.ts)}</td><td>${u?.name || r.userId}</td><td style="color:${r.type === "in" ? "#16a34a" : "#dc2626"};font-weight:700">${r.type === "in" ? "ENTRADA" : "SALIDA"}</td><td>${dayH ? fmtDuration(dayH) : "—"}</td><td>${r.ip}</td><td style="font-family:monospace;font-size:10px">${r.hash.substr(0, 20)}…</td><td>${r.edited ? "⚠️ Sí" : "—"}</td></tr>`;
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Registros Control Horario</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#1a0a00}h1{color:#7c3a0e;display:flex;align-items:center;gap:8px}p.meta{color:#888;font-size:11px;margin:4px 0 20px}table{width:100%;border-collapse:collapse}th{background:#fef3e2;color:#7c3a0e;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}td{padding:8px;border-bottom:1px solid #f5ede0}tr:nth-child(even) td{background:#fdfaf5}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5d9c5;font-size:10px;color:#aaa}</style></head>
    <body><h1>☕ Orchatería — Registro de Control Horario</h1>
    <p class="meta">Generado: ${new Date().toLocaleString("es-ES")} · Por: ${me.name} · Total registros: ${filtered.length}<br>
    Conforme al RD-L 8/2019 (actualización 2026) · LOPDGDD · RGPD. Firma digital SHA-256. Conservación mínima 4 años.</p>
    <table><thead><tr><th>Fecha y hora</th><th>Empleado</th><th>Tipo</th><th>Horas día</th><th>IP</th><th>Hash SHA-256</th><th>Editado</th></tr></thead><tbody>${rows.join("")}</tbody></table>
    <div class="footer">Sistema de fichaje digital · Registro inalterable con sellado criptográfico · © Orchatería ${new Date().getFullYear()}</div></body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400);
  };

  const openEdit = (r) => {
    setEditModal(r);
    const d = new Date(r.ts);
    setEditTime(`${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`);
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editReason) { showToast("El motivo es obligatorio para editar un registro", "error"); return; }
    const r = editModal;
    const [h, m] = editTime.split(":").map(Number);
    const newTs = new Date(r.ts); newTs.setHours(h, m, 0, 0);
    setData((d) => ({
      ...d,
      records: d.records.map((x) =>
        x.id === r.id ? { ...x, ts: newTs.getTime(), edited: true, edits: [...(x.edits || []), { by: me.id, byName: me.name, at: Date.now(), reason: editReason, prev: r.ts, next: newTs.getTime() }] } : x
      ),
    }));
    await addLog("EDIT_RECORD", me.id, r.userId, { ts: r.ts }, { ts: newTs.getTime() }, editReason);
    setEditModal(null); setEditReason("");
    showToast("Registro modificado. Cambio guardado en auditoría.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a0a00" }}>Registros horarios</h1>
        <button className="btn-primary" onClick={exportPDF} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600 }}>
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))} style={{ ...inputStyle, width: "auto", minWidth: 160 }}>
          <option value="">Todos los empleados</option>
          {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input type="date" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))} style={{ ...inputStyle, width: "auto" }} />
        <button onClick={() => setFilters({ userId: "", date: "" })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#9c7a50" }}>
          Limpiar filtros
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#c4b09a" }}>{filtered.length} registros</span>
      </div>

      <div style={{ background: "#fef9ec", border: "1px solid #f5d98e", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#92680a", display: "flex", gap: 8 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Las ediciones quedan registradas en el log de auditoría con firma digital SHA-256. No se pueden eliminar registros (inmutabilidad RD-L 8/2019).</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((r) => {
          const user = data.users.find((u) => u.id === r.userId);
          return (
            <div key={r.id} className="card" style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", borderLeft: r.edited ? "4px solid #f59e0b" : "4px solid transparent" }}>
              <div style={{ width: 8, height: 32, borderRadius: 4, background: r.type === "in" ? "#16a34a" : "#dc2626", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a0a00" }}>{user?.name}</span>
                  <span className="badge" style={{ background: r.type === "in" ? "#f0fdf4" : "#fef2f2", color: r.type === "in" ? "#166534" : "#b91c1c" }}>
                    {r.type === "in" ? "ENTRADA" : "SALIDA"}
                  </span>
                  {r.edited && <span className="badge" style={{ background: "#fef9c3", color: "#854d0e" }}>✏️ Editado</span>}
                </div>
                <p style={{ fontSize: 12, color: "#9c7a50", marginTop: 3 }}>{fmtDT(r.ts)} · {r.ip}</p>
                <p style={{ fontFamily: "monospace", fontSize: 10, color: "#ddd", marginTop: 2 }}>{r.hash.substr(0, 24)}…</p>
                {r.edits?.length > 0 && r.edits.map((ed, i) => (
                  <p key={i} style={{ fontSize: 11, color: "#d97706", marginTop: 2 }}>✏️ Editado por {ed.byName} · {fmtDT(ed.at)} · "{ed.reason}"</p>
                ))}
              </div>
              <button onClick={() => openEdit(r)} style={{ background: "none", border: "1.5px solid #e0d5c5", borderRadius: 8, padding: 7, cursor: "pointer", color: "#9c7a50", flexShrink: 0 }}>
                <Edit3 size={14} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#c4b09a" }}>
            <ClipboardList size={40} style={{ margin: "0 auto 12px", opacity: .3 }} />
            <p>No hay registros con los filtros actuales</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <Modal onClose={() => { setEditModal(null); setEditReason(""); }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Editar registro</h3>
          <p style={{ fontSize: 13, color: "#9c7a50", marginBottom: 16 }}>El cambio queda registrado de forma inalterable en el log de auditoría (RGPD).</p>
          <div style={{ background: "#f5ede0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
            <p><strong>Empleado:</strong> {data.users.find((u) => u.id === editModal.userId)?.name}</p>
            <p><strong>Tipo:</strong> {editModal.type === "in" ? "ENTRADA" : "SALIDA"}</p>
            <p><strong>Hora original:</strong> {fmtTime(editModal.ts)}</p>
          </div>
          <label style={labelStyle}>Nueva hora</label>
          <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} style={{ ...inputStyle, fontSize: 18, fontFamily: "monospace", marginBottom: 12 }} />
          <label style={labelStyle}>Motivo de la corrección (obligatorio) *</label>
          <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 72, marginBottom: 0 }} placeholder="Ej: El empleado olvidó registrar la salida. Confirmado por supervisor." />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={saveEdit} disabled={!editReason} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 10, fontWeight: 700, opacity: editReason ? 1 : .4 }}>Guardar cambio</button>
            <button className="btn-ghost" onClick={() => { setEditModal(null); setEditReason(""); }} style={{ flex: 1, padding: 12, borderRadius: 10 }}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AUDIT PANEL
// ─────────────────────────────────────────────────────────────
function AuditPanel({ logs, users }) {
  const [search, setSearch] = useState("");

  const ACTION_META = {
    LOGIN: { label: "Inicio de sesión", color: "#3b82f6", bg: "#eff6ff" },
    LOGOUT: { label: "Cierre de sesión", color: "#6b7280", bg: "#f3f4f6" },
    CLOCK_IN: { label: "Registro de entrada", color: "#16a34a", bg: "#f0fdf4" },
    CLOCK_OUT: { label: "Registro de salida", color: "#dc2626", bg: "#fef2f2" },
    EDIT_RECORD: { label: "Edición de registro", color: "#d97706", bg: "#fffbeb" },
    CREATE_USER: { label: "Alta de empleado", color: "#7c3aed", bg: "#f5f3ff" },
    EDIT_USER: { label: "Edición de empleado", color: "#c17d2e", bg: "#fef3e2" },
    ACTIVATE_USER: { label: "Reactivación de empleado", color: "#16a34a", bg: "#f0fdf4" },
    DEACTIVATE_USER: { label: "Baja de empleado", color: "#dc2626", bg: "#fef2f2" },
  };

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const by = users.find((u) => u.id === l.by);
    const target = users.find((u) => u.id === l.target);
    return (by?.name + target?.name + l.action + l.reason).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a0a00" }}>Log de auditoría</h1>
        <p style={{ fontSize: 13, color: "#9c7a50", marginTop: 4 }}>Registro inalterable e inmutable de todas las acciones</p>
      </div>

      <div style={{ background: "#fef9ec", border: "1.5px solid #f5d98e", borderRadius: 14, padding: "14px 16px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#7c3a0e", marginBottom: 4 }}>🔒 Integridad criptográfica garantizada</p>
        <p style={{ fontSize: 12, color: "#92680a" }}>Cada entrada tiene firma digital SHA-256. Cualquier manipulación del registro invalida el hash.</p>
        <p style={{ fontSize: 12, color: "#92680a", marginTop: 4 }}>Conforme a: <strong>RD-L 8/2019 (2026)</strong> · <strong>LOPDGDD</strong> · <strong>RGPD</strong> · Conservación mínima <strong>4 años</strong></p>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#c4b09a" }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por empleado, acción, motivo…" style={{ ...inputStyle, paddingLeft: 38 }} />
      </div>

      <p style={{ fontSize: 12, color: "#c4b09a" }}>{filtered.length} eventos registrados</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((log) => {
          const by = users.find((u) => u.id === log.by);
          const target = users.find((u) => u.id === log.target);
          const meta = ACTION_META[log.action] || { label: log.action, color: "#6b7280", bg: "#f3f4f6" };
          return (
            <div key={log.id} className="card" style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span className="badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    {log.reason && (
                      <span style={{ fontSize: 12, color: "#7a6a50", fontStyle: "italic" }}>"{log.reason}"</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#9c7a50" }}>
                    Por: <span style={{ fontWeight: 600, color: "#5a4a38" }}>{by?.name || log.by}</span>
                    {target && log.target !== log.by && (
                      <> → <span style={{ fontWeight: 600, color: "#5a4a38" }}>{target.name}</span></>
                    )}
                  </p>
                  <p style={{ fontFamily: "monospace", fontSize: 10, color: "#ddd", marginTop: 4 }}>SHA-256: {log.hash.substr(0, 32)}…</p>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "#c4b09a" }}>{fmtDate(log.ts)}</p>
                  <p style={{ fontSize: 11, color: "#c4b09a" }}>{fmtTime(log.ts)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#c4b09a" }}>
            <Shield size={40} style={{ margin: "0 auto 12px", opacity: .3 }} />
            <p>Sin eventos en el log</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const colors = ["#7c3a0e", "#3b82f6", "#059669", "#7c3aed", "#dc2626", "#d97706"];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.max(8, size * .25),
      background: colors[idx], display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * .35, flexShrink: 0,
    }}>
      {initials(name || "?")}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.4)" }} onClick={onClose} />
      <div className="card slide-in" style={{ position: "relative", width: "100%", maxWidth: 420, padding: 24, zIndex: 1 }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "#c4b09a" }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", border: "1.5px solid #e0d5c5", borderRadius: 10,
  padding: "10px 12px", fontSize: 14, outline: "none",
  background: "#fff", color: "#1a0a00", transition: "border .2s",
};

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "#9c7a50", marginBottom: 5, textTransform: "uppercase", letterSpacing: .5,
};

const iconBtnStyle = {
  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", color: "#c4b09a", padding: 4,
};