import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom"; // add this
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from "recharts";
import { ArrowLeft, Edit3, Trash2, Save, CheckCircle, XCircle, Home } from "lucide-react";

const API = "http://localhost:8000";

export default function CustomerDetail() {
  const { id } = useParams(); // <-- get the numeric id from /customers/:id
  const [data, setData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [editing, setEditing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualDecision, setManualDecision] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [error, setError] = useState("");

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/customers/${id}/detail`);
      if (!r.ok) throw new Error(`Failed to load detail (${r.status})`);
      const json = await r.json();
      setData(json);
      const finalDisplay = json?.base?.final_display_decision || "";
      if (String(finalDisplay).toLowerCase().includes("review")) setManualDecision("");
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Load raw profile
  const loadProfile = async () => {
    if (!id) return;
    try {
      const r = await fetch(`${API}/customers/${id}/profile`);
      if (r.ok) {
        const p = await r.json();
        setProfile(p);
        setEditProfile(p); // seed edit form
      }
    } catch {}
  };

  useEffect(() => { loadDetail(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { loadProfile(); /* eslint-disable-next-line */ }, [id]);

  const { shapTopPos, shapTopNeg, shapBarData } = useMemo(() => {
    const contrib = data?.shap_contributions || {};
    const entries = Object.entries(contrib).filter(([k]) => k && k !== "BiasTerm");
    const sumAbs = entries.reduce((acc, [, v]) => acc + Math.abs(Number(v) || 0), 0) || 1;

    const positives = entries
      .filter(([, v]) => Number(v) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5)
      .map(([name, v]) => ({ name, value: Number(v), pct: Math.abs(Number(v)) / sumAbs * 100 }));

    const negatives = entries
      .filter(([, v]) => Number(v) < 0)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .slice(0, 5)
      .map(([name, v]) => ({ name, value: Number(v), pct: Math.abs(Number(v)) / sumAbs * 100 }));

    const bar = entries
      .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
      .slice(0, 10)
      .map(([name, v]) => ({ name, value: Number(v), pct: Math.abs(Number(v)) / sumAbs * 100 }));

    return { shapTopPos: positives, shapTopNeg: negatives, shapBarData: bar };
  }, [data]);

  const base = data?.base || {};
  const finalDisplay = base?.final_display_decision || base?.ml_final_decision || base?.decision || "-";
  const dsrPct = ((base?.dsr || 0) * 100).toFixed(1) + "%";
  const isReview = String(finalDisplay).toLowerCase().includes("review");
  const toCurrency = (v) => (v || v === 0) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";

  // Manual decision
  const handleManualSave = async () => {
    if (!manualDecision) { setError("Please choose Approved or Rejected."); return; }
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`${API}/customers/${id}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: manualDecision, note: manualNote || "" })
      });
      if (!r.ok) throw new Error(`Failed to update decision (${r.status})`);
      await loadDetail();
    } catch (e) {
      setError(e.message || "Failed to save decision");
    } finally {
      setSaving(false);
    }
  };

  // Edit profile (PUT /customers/{id})
  const onEditClick = () => {
    setEditing((e) => !e);
    setError("");
    setEditProfile(profile || editProfile);
  };

  const handleEditChange = (key, val) => {
    setEditProfile((p) => ({ ...(p || {}), [key]: val }));
  };

  // UPDATED: send clean numeric payload, re-score, then reload
  const handleEditSave = async () => {
    if (!editProfile || !id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        customer_id: String(editProfile.customer_id || "").trim(),
        name: String(editProfile.name || ""),
        gender: String(editProfile.gender || ""),
        age: Number(editProfile.age || 0),
        job_type: String(editProfile.job_type || ""),
        income: Number(editProfile.income || 0),
        expenses: Number(editProfile.expenses || 0),
        credit_history: String(editProfile.credit_history || ""),
        existing_loans: Number(editProfile.existing_loans || 0),
        financing_type: String(editProfile.financing_type || ""),
        asset_type: String(editProfile.asset_type || ""),
        asset_value: Number(editProfile.asset_value || 0),
        down_payment: Number(editProfile.down_payment || 0),
        installment_period: Number(editProfile.installment_period || 36),
      };

      // 1) Update customer record
      const r = await fetch(`${API}/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(`Failed to update profile (${r.status})`);

      // 2) Re-score and persist ML fields
      if (payload.customer_id) {
        await fetch(`${API}/predict-h2o/score-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: false, customer_ids: [payload.customer_id] })
        }).catch(() => {});
      }

      // 3) Reload to reflect new totals and model fields
      setEditing(false);
      await Promise.all([loadProfile(), loadDetail()]);
    } catch (e) {
      setError(e.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Delete (DELETE /customers/{id})
  const handleDelete = async () => {
    if (!window.confirm("Delete this customer? This cannot be undone.")) return;
    try {
      const r = await fetch(`${API}/customers/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`Failed to delete (${r.status})`);
      window.location.href = "/";
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  };

  if (loading) return <div className="text-center text-white p-10">Loading...</div>;
  if (error) return <div className="text-center text-red-400 p-10">{error}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-6 flex-1">
        {/* Actions */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-gray-800 border border-gray-700 hover:bg-gray-750">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onEditClick} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">
              <Edit3 size={16} /> {editing ? "Cancel Edit" : "Edit"}
            </button>
            <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-red-600 hover:bg-red-700">
              <Trash2 size={16} /> Delete
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase">Final Decision</div>
            <div className="text-2xl font-bold mt-1">{finalDisplay}</div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase">DSR</div>
            <div className="text-2xl font-bold mt-1">{dsrPct}</div>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={50}>
                <LineChart data={[{v: base?.dsr || 0},{v: base?.dsr || 0}]}>
                  <Line dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase">Model</div>
            <div className="text-sm mt-1">
              Label: <span className="text-gray-200">{base?.ml_label || "-"}</span><br/>
              P(Accept): <span className="text-gray-200">{typeof base?.ml_p_accept === "number" ? (base.ml_p_accept * 100).toFixed(1) + "%" : "-"}</span><br/>
              Confidence: <span className="text-gray-200">{typeof base?.ml_confidence === "number" ? (base.ml_confidence * 100).toFixed(1) + "%" : "-"}</span> ({base?.ml_confidence_band || "-"})
            </div>
          </div>
        </div>

        {/* Customer Profile (view/edit) */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-semibold">Customer Profile</div>
            {editing && (
              <button onClick={handleEditSave} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50">
                <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>

          {!editing ? (
            <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8">
              <ProfileRow label="Customer ID" value={profile?.customer_id} />
              <ProfileRow label="Name" value={profile?.name} />
              <ProfileRow label="Gender" value={profile?.gender} />
              <ProfileRow label="Age" value={profile?.age} />
              <ProfileRow label="Job Type" value={profile?.job_type} />
              <ProfileRow label="Income" value={profile?.income} isMoney />
              <ProfileRow label="Expenses" value={profile?.expenses} isMoney />
              <ProfileRow label="Credit History" value={profile?.credit_history} />
              <ProfileRow label="Existing Loans" value={profile?.existing_loans} isMoney />
              <ProfileRow label="Financing Type" value={profile?.financing_type} />
              <ProfileRow label="Asset Type" value={profile?.asset_type} />
              <ProfileRow label="Asset Value" value={profile?.asset_value} isMoney />
              <ProfileRow label="Down Payment" value={profile?.down_payment} isMoney />
              <ProfileRow label="Installment Period (months)" value={profile?.installment_period} />
            </div>
          ) : (
            <div className="text-sm grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderInput("Customer ID", "customer_id", editProfile, handleEditChange)}
              {renderInput("Name", "name", editProfile, handleEditChange)}
              {renderInput("Gender", "gender", editProfile, handleEditChange)}
              {renderNumber("Age", "age", editProfile, handleEditChange)}
              {renderInput("Job Type", "job_type", editProfile, handleEditChange)}
              {renderNumber("Income", "income", editProfile, handleEditChange)}
              {renderNumber("Expenses", "expenses", editProfile, handleEditChange)}
              {renderInput("Credit History", "credit_history", editProfile, handleEditChange)}
              {renderNumber("Existing Loans", "existing_loans", editProfile, handleEditChange)}
              {renderInput("Financing Type", "financing_type", editProfile, handleEditChange)}
              {renderInput("Asset Type", "asset_type", editProfile, handleEditChange)}
              {renderNumber("Asset Value", "asset_value", editProfile, handleEditChange)}
              {renderNumber("Down Payment", "down_payment", editProfile, handleEditChange)}
              {renderNumber("Installment Period", "installment_period", editProfile, handleEditChange)}
            </div>
          )}
        </div>

        {/* Money cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          <InfoCard label="Installment" value={toCurrency(base?.monthly_installment)} />
          <InfoCard label="Total Cost" value={toCurrency(base?.total_cost)} />
          <InfoCard label="Created" value={base?.created_at ? new Date(base.created_at).toLocaleString() : "-"} />
        </div>

        {/* SHAP */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-base font-semibold mb-2">Feature Contributions (Top 10 by |value|)</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={shapBarData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", fontSize: "12px" }}
                  formatter={(value, name, props) => {
                    const pct = props?.payload?.pct ? props.payload.pct.toFixed(1) + "%" : "";
                    return [value, `${name} (${pct})`];
                  }}
                />
                <Legend />
                <Bar dataKey="value" name="Contribution" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="text-base font-semibold mb-4">Top Drivers</div>
            
            {/* Top Negative Drivers */}
            <div className="mb-6">
              <div className="text-xs text-gray-400 uppercase mb-3">Top Negative Drivers</div>
              <div className="space-y-3">
                {(!shapTopNeg || shapTopNeg.length === 0) ? 
                  <div className="text-gray-400 text-sm">No negative drivers</div> :
                  shapTopNeg.map((item, index) => (
                    <ProgressBar 
                      key={`neg-${item.name}-${index}`}
                      rank={index + 1}
                      name={item.name}
                      percentage={item.pct}
                      status="Exceeds Average"
                      color="bg-red-500"
                    />
                  ))
                }
              </div>
            </div>

            {/* Top Positive Drivers */}
            <div>
              <div className="text-xs text-gray-400 uppercase mb-3">Top Positive Drivers</div>
              <div className="space-y-3">
                {(!shapTopPos || shapTopPos.length === 0) ? 
                  <div className="text-gray-400 text-sm">No positive drivers</div> :
                  shapTopPos.map((item, index) => (
                    <ProgressBar 
                      key={`pos-${item.name}-${index}`}
                      rank={index + 1}
                      name={item.name}
                      percentage={item.pct}
                      status="Exceeds Average"
                      color="bg-green-500"
                    />
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Manual decision */}
        {isReview && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="text-base font-semibold mb-2">Manual Decision</div>
            <div className="text-sm text-gray-400 mb-3">Choose Accept or Reject and optionally add a note.</div>
            <div className="flex items-center gap-4 mb-3">
              <label className={`inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded ${manualDecision === "Accepted" ? "bg-green-600/20" : "bg-gray-800"}`}>
                <input type="radio" name="manual" value="Accepted" checked={manualDecision === "Accepted"} onChange={(e) => setManualDecision(e.target.value)} />
                <CheckCircle size={16} className="text-green-400" /> Accept
              </label>
              <label className={`inline-flex items-center gap-2 cursor-pointer px-3 py-2 rounded ${manualDecision === "Rejected" ? "bg-red-600/20" : "bg-gray-800"}`}>
                <input type="radio" name="manual" value="Rejected" checked={manualDecision === "Rejected"} onChange={(e) => setManualDecision(e.target.value)} />
                <XCircle size={16} className="text-red-400" /> Reject
              </label>
            </div>
            <textarea value={manualNote} onChange={(e) => setManualNote(e.target.value)} rows={3}
              placeholder="Add a note (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm mb-3" />
            <div className="flex items-center gap-2">
              <button onClick={handleManualSave} disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                <Save size={16} /> Save Manual Decision
              </button>
              {error && <div className="text-red-400 text-sm">{error}</div>}
            </div>
          </div>
        )}

        {/* Explanation/Suggestions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoBlock title="Explanation" content={base?.explanation || "-"} />
          <InfoBlock title="Suggestions" content={base?.suggestions || "-"} />
        </div>
      </div>
      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
          
          </div>
          <div className="text-sm text-gray-400">
            © 2025 Customer Detail System
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProgressBar({ rank, name, percentage, status, color }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-gray-700 text-xs flex items-center justify-center text-white font-bold">
            {rank}
          </span>
          <span className="text-sm font-medium text-white">{name}</span>
        </div>
        <span className="text-sm font-bold text-white">{percentage.toFixed(0)}%</span>
      </div>
      <div className="text-xs text-gray-400">{status}</div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className={`${color} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, isMoney = false }) {
  const display = (value || value === 0) ? (isMoney ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value) : "-";
  return (
    <div className="flex items-center justify-between border-b border-gray-800 py-1">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{display}</span>
    </div>
  );
}

function renderInput(label, key, state, onChange) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-400 mb-1">{label}</label>
      <input
        className="bg-gray-800 border border-gray-700 rounded px-2 py-2"
        value={state?.[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </div>
  );
}

function renderNumber(label, key, state, onChange) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        className="bg-gray-800 border border-gray-700 rounded px-2 py-2"
        value={state?.[key] ?? ""}
        onChange={(e) => onChange(key, e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase">{label}</div>
      <div className="text-lg">{value}</div>
    </div>
  );
}

function InfoBlock({ title, content }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase mb-1">{title}</div>
      <div className="text-sm whitespace-pre-line">{content}</div>
    </div>
  );
}