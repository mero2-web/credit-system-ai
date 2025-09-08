import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, CartesianGrid, Tooltip, Legend, BarChart, Bar
} from "recharts";
import { Search, Menu, Star, FileText, User, Home } from "lucide-react";

const API = "http://localhost:8000";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [statistics, setStatistics] = useState(null);

  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const isLoading = !overview || !statistics;

  const loadOverview = async () => {
    const r = await fetch(`${API}/analytics/overview`);
    setOverview(await r.json());
  };

  const loadStatistics = async () => {
    const r = await fetch(`${API}/customers/statistics`);
    setStatistics(await r.json());
  };

  const loadApplications = async (p = 1, q = "") => {
    const params = new URLSearchParams({ page: String(p), page_size: String(pageSize) });
    if (q.trim()) params.set("search", q.trim());
    const r = await fetch(`${API}/customer-applications?${params.toString()}`);
    const data = await r.json();
    setApps(data.results || []);
    setTotal(data.total || 0);
    setPage(data.page || p);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadOverview(), loadStatistics(), loadApplications(1, "")]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadApplications(1, search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    loadApplications(page, search);
  }, [page]);

  const cleanDist = (obj) =>
    Object.entries(obj || {}).filter(([k, v]) => k && k.toLowerCase() !== "string" && v > 0);

  const totalCustomers = overview?.total_customers || 0;
  const avgDSR = ((overview?.avg_dsr || 0) * 100).toFixed(1) + "%";
  const decisionsClean = Object.fromEntries(cleanDist(overview?.decisions_breakdown || {}));
  const accepted = decisionsClean.Accepted || 0;
  const totalDec = Object.values(decisionsClean).reduce((a, b) => a + b, 0);
  const acceptanceRate = totalDec > 0 ? ((accepted / totalDec) * 100).toFixed(1) + "%" : "0%";
  const highRiskPct =
    overview?.dsr_histogram && overview.dsr_histogram[">0.60"]
      ? ((overview.dsr_histogram[">0.60"] / (totalCustomers || 1)) * 100).toFixed(1) + "%"
      : "0%";

  const statusChartData = Object.entries(decisionsClean).map(([name, value]) => ({
    name,
    value,
    color: name === "Accepted" ? "#4ade80" : name === "Review" ? "#fbbf24" : "#ef4444",
  }));

  const genderBarData = useMemo(() => {
    const rows = cleanDist(overview?.gender_distribution || {}).map(([name, value]) => ({
      name,
      value,
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [overview]);

  const finTypeBarData = useMemo(() => {
    const rows = cleanDist(overview?.financing_type_distribution || {}).map(([name, value]) => ({
      name,
      value,
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [overview]);

  const dsrHistData = useMemo(() => {
    return Object.entries(overview?.dsr_histogram || {}).map(([name, value]) => ({ name, value }));
  }, [overview]);

  const decisionColor = (d) => {
    const s = String(d || "").toLowerCase();
    if (s.includes("accept")) return "#4ade80";
    if (s.includes("review")) return "#fbbf24";
    return "#ef4444";
  };

  const scatterGroups = useMemo(() => {
    const groups = { Accepted: [], Review: [], Rejected: [] };
    (apps || []).slice(0, 300).forEach((c) => {
      const age = Number(c.age) || 25 + Math.random() * 30;
      const dsrPct = Math.min(100, Math.max(0, (Number(c.dsr) || Math.random()) * 100));
      const decision =
        c.ai_decision || c.final_display_decision || c.ml_final_decision || c.decision || "Rejected";
      const key = decision.toLowerCase().includes("accept")
        ? "Accepted"
        : decision.toLowerCase().includes("review")
        ? "Review"
        : "Rejected";
      groups[key].push({ x: age, y: dsrPct, name: c.name || c.customer_id || "-", decision });
    });
    return groups;
  }, [apps]);

  const riskBins = ["<0.45", "0.45-0.60", ">0.60"];
  const matrixData = useMemo(() => {
    const data = riskBins.map((bin) => ({ bin, Accepted: 0, Review: 0, Rejected: 0 }));
    (apps || []).forEach((c) => {
      const v = Number(c.dsr) || 0;
      const decision =
        c.ai_decision || c.final_display_decision || c.ml_final_decision || c.decision || "Rejected";
      const key = decision.toLowerCase().includes("accept")
        ? "Accepted"
        : decision.toLowerCase().includes("review")
        ? "Review"
        : "Rejected";
      const idx = v < 0.45 ? 0 : v <= 0.6 ? 1 : 2;
      data[idx][key] += 1;
    });
    return data;
  }, [apps]);

  const trendsData = useMemo(() => {
    const map = new Map();
    (apps || []).forEach((c) => {
      const dt = c.updated_at || c.created_at || new Date().toISOString();
      const day = new Date(dt);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      const decision =
        c.ai_decision || c.final_display_decision || c.ml_final_decision || c.decision || "Rejected";
      const bucket = decision.toLowerCase().includes("accept")
        ? "Accepted"
        : decision.toLowerCase().includes("review")
        ? "Review"
        : "Rejected";
      if (!map.has(key)) map.set(key, { day: key, Accepted: 0, Review: 0, Rejected: 0 });
      map.get(key)[bucket] += 1;
    });
    return Array.from(map.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-14);
  }, [apps]);

  const KPICard = ({ label, value, change, positive = true, children }) => (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg p-4 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-green-500" />
      <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mb-1 text-white">{value}</div>
      <div className={`text-xs flex items-center gap-1 ${positive ? "text-green-400" : "text-red-400"}`}>
        <span>{positive ? "▲" : "▼"} {change}</span>
      </div>
      {children && <div className="mt-2 h-12">{children}</div>}
    </div>
  );

  const getStatusBadgeClass = (decision) => {
    if (!decision) return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
    const lower = String(decision).toLowerCase();
    if (lower.includes("accept")) return "bg-green-500/20 text-green-400 border border-green-500/30";
    if (lower.includes("review")) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border border-red-500/30";
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Stars */}
        {[...Array(80)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-40 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
        
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-2xl animate-pulse" 
             style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-xl animate-pulse"
             style={{ animationDelay: "2s" }} />
      </div>

      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-16 h-full bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur-lg border-r border-gray-700/50 z-50 flex flex-col items-center py-6">
       
        <button 
          onClick={() => window.location.href = "/data"}
          className="mb-6 p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-300"
          title="Data Management"
        >
          <FileText className="w-6 h-6 text-blue-400 hover:text-blue-300" />
        </button>
        
        <button 
          onClick={() => window.location.href = "/auth"}
          className="mb-6 p-2 rounded-lg hover:bg-gray-700/50 transition-all duration-300"
        >
          <User className="w-6 h-6 text-green-400 hover:text-green-300" />
        </button>
      </div>

      <div className="ml-16 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-gray-900/60 backdrop-blur-lg border-b border-gray-700/50">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C3</span>
            </div>
            <h1 className="text-white text-lg font-semibold">AI Smart Lending Dashboard</h1>
          </div>
          <button
            onClick={() => window.location.href = "/auth"}
            className="bg-gradient-to-r from-blue-500/80 to-cyan-500/80 hover:from-blue-500 hover:to-cyan-500 text-white text-sm px-6 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-blue-500/30"
          >
            Login
          </button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
              <div className="text-white text-lg">Loading Dashboard...</div>
              <div className="text-gray-400 text-sm">Fetching analytics data</div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 p-6">
              <KPICard label="Total Customers" value={totalCustomers.toLocaleString()} change="5.2% increase">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>

              <KPICard label="Avg DSR" value={avgDSR} change="2.3% lower">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 4 }, { v: 3 }, { v: 2 }, { v: 1 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>

              <KPICard label="Acceptance Rate" value={acceptanceRate} change="8.7% increase">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 2 }, { v: 3 }, { v: 4 }, { v: 5 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>

              <KPICard label="Total Approved" value={accepted.toLocaleString()} change="12% increase">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 1 }, { v: 2 }, { v: 2 }, { v: 3 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>

              <KPICard label="High Risk (%)" value={highRiskPct} change="12% decrease">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 5 }, { v: 4 }, { v: 3 }, { v: 2 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>

              <KPICard label="Processing Time" value="2.1s" change="15% faster">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[{ v: 3 }, { v: 3 }, { v: 2 }, { v: 1 }]}>
                    <Line type="monotone" dataKey="v" stroke="#4ade80" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KPICard>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 mb-6">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">Application Status Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

             <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5"> 
  <h3 className="text-base font-semibold mb-4 text-white">Gender Distribution</h3>
  <ResponsiveContainer width="100%" height={240}>
    <BarChart data={genderBarData} layout="vertical" margin={{ left: 40 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis type="number" tick={{ fill: "#e693e4ff", fontSize: 12 }} />
      <YAxis type="category" dataKey="name" width={80} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
      <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #d69ec5ff", borderRadius: "8px" }} />
      <Legend />
      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
        {genderBarData.map((entry, index) => (
          <Cell 
            key={`cell-${index}`} 
            fill={entry.name === "Male" ? "#60a5fa" : "#e693e4ff"} 
          />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>

            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 mb-6">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">Financing Type Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={finTypeBarData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="value" name="Count" fill="#34d399" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">DSR vs Age (by Decision)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" dataKey="x" name="Age" domain={[18, 75]} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis type="number" dataKey="y" name="DSR %" domain={[0, 100]} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                      formatter={(value, name) => [
                        name === "y" ? `${value.toFixed(1)}%` : Math.round(value),
                        name === "y" ? "DSR" : "Age",
                      ]}
                    />
                    <Legend />
                    <Scatter name="Accepted" data={scatterGroups.Accepted} fill={decisionColor("Accepted")} />
                    <Scatter name="Review" data={scatterGroups.Review} fill={decisionColor("Review")} />
                    <Scatter name="Rejected" data={scatterGroups.Rejected} fill={decisionColor("Rejected")} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-6 mb-6">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">DSR Risk Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dsrHistData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="value" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">Risk vs Decision Matrix</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={matrixData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="bin" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                    <Bar dataKey="Accepted" stackId="dec" fill="#4ade80" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Review" stackId="dec" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Rejected" stackId="dec" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trends Chart */}
            <div className="px-6 mb-6">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl p-5">
                <h3 className="text-base font-semibold mb-4 text-white">Decision Trends Over Time</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }} />
                    <Legend />
                    <Line type="monotone" dataKey="Accepted" stroke="#4ade80" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Review" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Rejected" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Customer Applications Table */}
            <div className="mx-6 mb-6">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-lg border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="border-b border-gray-700/50 p-6 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Customer Applications</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by Customer ID or Name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 w-80 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-300 backdrop-blur-sm"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50 backdrop-blur-sm">
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Customer ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Financing Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Asset Type
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Asset Value
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Total Cost
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          AI Decision
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                              <span>Loading customer data...</span>
                            </div>
                          </td>
                        </tr>
                      ) : apps.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                            {search ? "No customers found matching your search." : "No customer data available"}
                          </td>
                        </tr>
                      ) : (
                        apps.map((c) => {
                          const decision = c.ai_decision || "Pending";
                          const createdAt = c.created_at ? new Date(c.created_at).toLocaleDateString() : "N/A";
                          return (
                            <tr key={c.id || c.customer_id} className="hover:bg-gray-800/30 transition-colors backdrop-blur-sm">
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => window.location.href = `/customers/${c.id}`}
                                  className="text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors"
                                >
                                  {c.customer_id}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-white">{c.name || "-"}</td>
                              <td className="px-6 py-4 text-gray-300">{c.financing_type || "-"}</td>
                              <td className="px-6 py-4 text-gray-300">{c.asset_type || "-"}</td>
                              <td className="px-6 py-4 text-gray-300">
                                {c.asset_value != null ? `${Number(c.asset_value).toLocaleString()}` : "-"}
                              </td>
                              <td className="px-6 py-4 text-gray-300">
                                {c.total_cost != null ? `${Number(c.total_cost).toLocaleString()}` : "-"}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold uppercase backdrop-blur-sm ${getStatusBadgeClass(
                                    decision
                                  )}`}
                                >
                                  {decision}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-300">{createdAt}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 border-t border-gray-700/50 flex items-center justify-between text-sm text-gray-300 bg-gray-800/20 backdrop-blur-sm">
                  <div>
                    Page {page} of {Math.max(1, Math.ceil(total / pageSize))} • Showing{" "}
                    {apps.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-600/50 hover:bg-gray-700/50 disabled:opacity-50 disabled:hover:bg-gray-800/50 transition-all duration-300 backdrop-blur-sm"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
                      disabled={page * pageSize >= total}
                      className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-600/50 hover:bg-gray-700/50 disabled:opacity-50 disabled:hover:bg-gray-800/50 transition-all duration-300 backdrop-blur-sm"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="ml-16 bg-gray-900/60 backdrop-blur-lg border-t border-gray-700/50 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            
          </div>
          <div className="text-sm text-gray-400">
            © 2025 C3 AI Smart Lending Dashboard
          </div>
        </div>
      </footer>
    </div>
  );
}