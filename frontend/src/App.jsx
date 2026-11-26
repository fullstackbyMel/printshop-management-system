import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API || "http://localhost:8000/api";
const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || Object.values(data).flat().join(" ") || "Something went wrong.");
  return data;
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem("auth") || "null"));
  const save = (a) => { a ? localStorage.setItem("auth", JSON.stringify(a)) : localStorage.removeItem("auth"); setAuth(a); };
  return (
    <>
      <style>{css}</style>
      {auth ? <Shell auth={auth} onLogout={() => save(null)} /> : <Login onDone={save} />}
    </>
  );
}

function Login({ onDone }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { onDone(await api("/login/", { method: "POST", body: f })); } catch (x) { setErr(x.message); }
  };
  return (
    <main className="login">
      <div className="reg"><i /><i /><i /><i /></div>
      <h1>Print shop sales</h1>
      <form onSubmit={submit}>
        <label>Username<input autoFocus value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></label>
        <label>Password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <button className="primary">Log in</button>
      </form>
    </main>
  );
}

function Shell({ auth, onLogout }) {
  const [tab, setTab] = useState("sales");
  const tabs = auth.is_admin ? [["sales", "Record a sale"], ["report", "Profit"], ["services", "Services"]] : [["sales", "Record a sale"]];
  return (
    <div className="shell">
      <header>
        <b>Print shop</b>
        <nav>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</nav>
        <span>{auth.username} <button className="link" onClick={onLogout}>Log out</button></span>
      </header>
      {tab === "sales" && <Sales auth={auth} />}
      {tab === "report" && <Report auth={auth} />}
      {tab === "services" && <Services auth={auth} />}
    </div>
  );
}

function Sales({ auth }) {
  const [services, setServices] = useState([]);
  const [sales, setSales] = useState([]);
  const [f, setF] = useState({ service: "", quantity: 1, unit_price: "", customer: "" });
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const [s, r] = await Promise.all([api("/services/", { token: auth.token }), api("/sales/", { token: auth.token })]);
    setServices(s.filter((x) => x.is_active)); setSales(r);
  }, [auth.token]);
  useEffect(() => { load(); }, [load]);

  const pick = (id) => {
    const s = services.find((x) => String(x.id) === id);
    setF({ ...f, service: id, unit_price: s ? s.price : "" });
  };
  const submit = async (e) => {
    e.preventDefault(); setMsg("");
    try {
      await api("/sales/", { method: "POST", token: auth.token, body: { ...f, service: Number(f.service) } });
      setF({ service: "", quantity: 1, unit_price: "", customer: "" });
      setMsg("Sale saved."); load();
    } catch (x) { setMsg(x.message); }
  };
  const total = (Number(f.quantity) || 0) * (Number(f.unit_price) || 0);
  const del = async (id) => { if (confirm("Delete this sale?")) { await api(`/sales/${id}/`, { method: "DELETE", token: auth.token }); load(); } };

  return (
    <section className="two">
      <form onSubmit={submit} className="panel">
        <h2>Record a sale</h2>
        <label>Service
          <select required value={f.service} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose a service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({peso(s.price)} / {s.unit})</option>)}
          </select>
        </label>
        <div className="row">
          <label>Quantity<input type="number" min="1" required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></label>
          <label>Price each<input type="number" step="0.01" min="0" required value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></label>
        </div>
        <label>Customer name (optional)<input value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} /></label>
        <p className="total">Customer pays <b>{peso(total)}</b></p>
        {msg && <p className={msg === "Sale saved." ? "ok" : "err"}>{msg}</p>}
        <button className="primary">Save sale</button>
      </form>
      <div className="panel">
        <h2>{auth.is_admin ? "Latest sales" : "Your latest sales"}</h2>
        {sales.length === 0 ? <p className="muted">No sales yet. Record the first one on the left.</p> : (
          <table><thead><tr><th>When</th><th>Service</th><th>Qty</th><th className="r">Paid</th>{auth.is_admin && <><th>By</th><th /></>}</tr></thead>
            <tbody>{sales.slice(0, 30).map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td>{s.service_name}{s.customer && <small> · {s.customer}</small>}</td><td>{s.quantity}</td><td className="r">{peso(s.total)}</td>
                {auth.is_admin && <><td>{s.handled_by_name}</td><td><button className="link" onClick={() => del(s.id)}>Delete</button></td></>}
              </tr>))}</tbody></table>
        )}
      </div>
    </section>
  );
}

function Report({ auth }) {
  const [range, setRange] = useState({ start: "", end: "" });
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    const q = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();
    api("/report/" + (q ? "?" + q : ""), { token: auth.token }).then(setData);
  }, [range, auth.token]);
  useEffect(() => { load(); }, [load]);
  const max = data ? Math.max(1, ...data.rows.map((r) => Number(r.revenue))) : 1;
  const t = data?.totals;
  return (
    <section className="panel wide">
      <div className="row between">
        <h2>Profit by service</h2>
        <div className="row">
          <label>From<input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></label>
          <label>To<input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></label>
        </div>
      </div>
      {t && (
        <div className="strip">
          <div><small>Orders</small><b>{t.orders}</b></div>
          <div><small>Sales</small><b>{peso(t.revenue)}</b></div>
          <div><small>Cost</small><b>{peso(t.cost)}</b></div>
          <div className="profit"><small>Profit</small><b>{peso(t.profit)}</b></div>
        </div>
      )}
      {data && data.rows.length === 0 && <p className="muted">No sales in this period.</p>}
      {data && data.rows.length > 0 && (
        <table><thead><tr><th>Service</th><th className="r">Orders</th><th className="r">Qty</th><th className="r">Sales</th><th className="r">Cost</th><th className="r">Profit</th><th /></tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.service}><td>{r.service}</td><td className="r">{r.orders}</td><td className="r">{r.quantity}</td>
              <td className="r">{peso(r.revenue)}</td><td className="r">{peso(r.cost)}</td><td className="r"><b>{peso(r.profit)}</b></td>
              <td className="bar"><span style={{ width: `${(Number(r.revenue) / max) * 100}%` }}><em style={{ width: `${Math.max(0, (Number(r.profit) / Math.max(1, Number(r.revenue))) * 100)}%` }} /></span></td></tr>))}</tbody></table>
      )}
      <p className="muted">Bar = sales; the magenta part is profit.</p>
    </section>
  );
}

function Services({ auth }) {
  const [list, setList] = useState([]);
  const [n, setN] = useState({ name: "", unit: "piece", price: "", cost: "" });
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/services/", { token: auth.token }).then(setList), [auth.token]);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => {
    e.preventDefault(); setErr("");
    try { await api("/services/", { method: "POST", token: auth.token, body: n }); setN({ name: "", unit: "piece", price: "", cost: "" }); load(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <section className="two">
      <form onSubmit={add} className="panel">
        <h2>Add a new service</h2>
        <label>Name<input required placeholder="e.g. Tarpaulin printing" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></label>
        <label>Sold per<input required placeholder="page, piece, sq ft" value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })} /></label>
        <div className="row">
          <label>Selling price<input type="number" step="0.01" required value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} /></label>
          <label>Your cost<input type="number" step="0.01" required value={n.cost} onChange={(e) => setN({ ...n, cost: e.target.value })} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="primary">Add service</button>
      </form>
      <div className="panel">
        <h2>Your services</h2>
        {list.map((s) => <ServiceRow key={s.id} s={s} token={auth.token} onSaved={load} />)}
      </div>
    </section>
  );
}

function ServiceRow({ s, token, onSaved }) {
  const [v, setV] = useState({ price: s.price, cost: s.cost });
  const patch = (body) => api(`/services/${s.id}/`, { method: "PATCH", token, body }).then(onSaved);
  return (
    <div className={"svc" + (s.is_active ? "" : " off")}>
      <b>{s.name}</b><small>per {s.unit}</small>
      <label>Price<input type="number" step="0.01" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></label>
      <label>Cost<input type="number" step="0.01" value={v.cost} onChange={(e) => setV({ ...v, cost: e.target.value })} /></label>
      <button onClick={() => patch(v)}>Save</button>
      <button className="link" onClick={() => patch({ is_active: !s.is_active })}>{s.is_active ? "Hide" : "Show again"}</button>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');
:root{--ink:#14213d;--paper:#f2f5f9;--line:#d5dce6;--c:#00a6d6;--m:#d6246e;--y:#f5c400;--mut:#5d6b82}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 'Instrument Sans',system-ui,sans-serif}
label{display:flex;flex-direction:column;gap:4px;font-weight:500;font-size:13px;margin-bottom:12px;flex:1}
input,select{font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--ink)}
input:focus,select:focus,button:focus-visible{outline:2px solid var(--c);outline-offset:1px}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 14px;color:var(--ink)}
.primary{background:var(--ink);color:#fff;border-color:var(--ink);padding:11px 18px;font-weight:600;width:100%}
.link{border:0;background:none;color:var(--c);padding:0 4px;text-decoration:underline}
.login{max-width:360px;margin:12vh auto;padding:0 20px}.login h1{margin:14px 0 20px;font-size:28px}
.reg{display:flex;gap:6px}.reg i{width:18px;height:18px;border-radius:50%}.reg i:nth-child(1){background:var(--c)}.reg i:nth-child(2){background:var(--m)}.reg i:nth-child(3){background:var(--y)}.reg i:nth-child(4){background:var(--ink)}
.shell{max-width:1100px;margin:0 auto;padding:0 20px 40px}
header{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:16px 0;border-bottom:3px solid var(--ink);margin-bottom:24px}
header nav{display:flex;gap:6px;flex:1}header nav button{border:0;background:none;font-weight:500}header nav .on{background:var(--ink);color:#fff}
.two{display:grid;grid-template-columns:minmax(0,380px) 1fr;gap:24px}@media(max-width:800px){.two{grid-template-columns:1fr}}
.panel{background:#fff;border:1px solid var(--line);border-radius:8px;padding:20px;align-self:start}.panel h2{margin:0 0 16px;font-size:18px}
.row{display:flex;gap:12px}.between{justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
.total{font-size:17px;margin:4px 0 14px}.err{color:#b3123f}.ok{color:#0a7a4b}.muted,small{color:var(--mut)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line)}th{font-size:12px;color:var(--mut);font-weight:600}.r{text-align:right}
.strip{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:8px;margin-bottom:18px}
.strip div{padding:12px 16px;border-right:1px solid var(--line);display:flex;flex-direction:column}.strip div:last-child{border:0}.strip b{font-size:20px}
.strip .profit{background:var(--ink);color:#fff;border-radius:0 8px 8px 0}.strip .profit small{color:#c9d3e4}
.bar{width:22%}.bar span{display:block;height:10px;background:var(--c);border-radius:2px;overflow:hidden}.bar em{display:block;height:100%;background:var(--m)}
.svc{display:grid;grid-template-columns:1fr 90px 90px auto auto;gap:8px;align-items:end;padding:12px 0;border-bottom:1px solid var(--line)}
.svc small{grid-column:1;margin-top:-26px}.svc label{margin:0}.svc.off{opacity:.5}
@media(max-width:600px){.svc{grid-template-columns:1fr 1fr}.strip{grid-template-columns:1fr 1fr}}
`;
