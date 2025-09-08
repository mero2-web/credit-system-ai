import React, { useState } from "react";
import { Upload, Plus, Save, FileText, Users, AlertCircle, CheckCircle, Home, Download } from "lucide-react";

const API = "http://localhost:8000";

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState("import");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [scoreAfter, setScoreAfter] = useState(true);
  const [importResult, setImportResult] = useState(null);

  // Create Customer State
  const [customerData, setCustomerData] = useState({
    customer_id: "",
    name: "",
    gender: "",
    age: "",
    job_type: "",
    income: "",
    expenses: "",
    credit_history: "",
    existing_loans: "",
    financing_type: "",
    asset_type: "",
    asset_value: "",
    down_payment: "",
    installment_period: ""
  });

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  // Handle CSV file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "text/csv") {
      setCsvFile(file);
      resetMessages();
    } else {
      setError("Please select a valid CSV file");
      setCsvFile(null);
    }
  };

  // Handle CSV import
  const handleImportCSV = async () => {
    if (!csvFile) {
      setError("Please select a CSV file first");
      return;
    }

    setLoading(true);
    resetMessages();

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("score_after", scoreAfter.toString());

    try {
      const response = await fetch(`${API}/import-csv?score_after=${scoreAfter}`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Import failed");
      }

      setImportResult(data);
      setSuccess(`Successfully imported ${data.inserted} customers, skipped ${data.skipped} duplicates`);
      setCsvFile(null);
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle customer form input changes
  const handleCustomerInputChange = (field, value) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
    resetMessages();
  };

  // Handle create customer (with re-scoring)
  const handleCreateCustomer = async () => {
    const requiredFields = ["customer_id", "name", "gender", "age", "job_type", "income", "expenses", "credit_history", "existing_loans", "financing_type", "asset_type", "asset_value", "down_payment", "installment_period"];
    const missingFields = requiredFields.filter(field => !customerData[field]);
    
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(", ")}`);
      return;
    }

    setLoading(true);
    resetMessages();

    try {
      const payload = {
        ...customerData,
        age: parseInt(customerData.age),
        income: parseFloat(customerData.income),
        expenses: parseFloat(customerData.expenses),
        existing_loans: parseFloat(customerData.existing_loans),
        asset_value: parseFloat(customerData.asset_value),
        down_payment: parseFloat(customerData.down_payment),
        installment_period: parseInt(customerData.installment_period)
      };

      const response = await fetch(`${API}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to create customer");
      }

      // Re-score and persist ML fields so Model box updates immediately elsewhere
      await fetch(`${API}/predict-h2o/score-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: false, customer_ids: [String(payload.customer_id)] })
      }).catch(() => {});

      setSuccess(`Customer "${payload.name}" created and scored. ID: ${payload.customer_id}`);

      // Reset form
      setCustomerData({
        customer_id: "",
        name: "",
        gender: "",
        age: "",
        job_type: "",
        income: "",
        expenses: "",
        credit_history: "",
        existing_loans: "",
        financing_type: "",
        asset_type: "",
        asset_value: "",
        down_payment: "",
        installment_period: ""
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download CSV template (aligned to your allowed choices)
  const downloadTemplate = () => {
    const headers = [
      "customer_id", "name", "gender", "age", "job_type", "income", "expenses",
      "credit_history", "existing_loans", "financing_type", "asset_type",
      "asset_value", "down_payment", "installment_period"
    ];
    
    const sampleData = [
      "CUST001", "John Doe", "Male", "35", "Private", "75000", "45000",
      "Good", "15000", "Murabaha", "House", "250000", "50000", "360"
    ];
    
    const csvContent = [headers.join(","), sampleData.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = "customer_template.csv";
    link.click();
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-50 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`
            }}
          />
        ))}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-green-500/10 rounded-full blur-2xl animate-pulse" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Data Management</h1>
            <p className="text-gray-400">Import customers from CSV or create individual records</p>
          </div>
          <button
            onClick={() => window.location.href = "/"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/50 rounded-lg transition-all duration-300 backdrop-blur-sm"
          >
            <Home size={16} />
            <span>Home</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-900/60 backdrop-blur-lg rounded-lg p-1 mb-8 border border-gray-700/50">
          <button
            onClick={() => setActiveTab("import")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-md transition-all duration-300 ${
              activeTab === "import"
                ? "bg-green-500/20 text-green-400 shadow-lg shadow-green-500/10"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Upload size={18} />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-md transition-all duration-300 ${
              activeTab === "create"
                ? "bg-green-500/20 text-green-400 shadow-lg shadow-green-500/10"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <Plus size={18} />
            <span>Create Customer</span>
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 backdrop-blur-sm">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 backdrop-blur-sm">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}

        {/* Content */}
        {activeTab === "import" ? (
          <div className="bg-gray-900/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block p-4 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/30 mb-4">
                <FileText size={32} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Import Customers from CSV</h2>
              <p className="text-gray-400">Upload a CSV file with customer data to bulk import records</p>
            </div>

            {/* CSV Template Download */}
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Download size={20} className="text-green-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-green-400 mb-1">Need a template?</h3>
                  <p className="text-sm text-gray-400 mb-3">Download our CSV template with sample data and proper column headers.</p>
                  <button
                    onClick={downloadTemplate}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-400 text-sm transition-all duration-300"
                  >
                    Download Template
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select CSV File
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-500/20 file:text-green-400 hover:file:bg-green-500/30 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                />
              </div>
              {csvFile && (
                <div className="mt-2 text-sm text-green-400">
                  Selected: {csvFile.name}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoreAfter}
                  onChange={(e) => setScoreAfter(e.target.checked)}
                  className="w-4 h-4 bg-gray-800 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">
                  Automatically score customers after import using H2O model
                </span>
              </label>
            </div>

            {/* Import Button */}
            <button
              onClick={handleImportCSV}
              disabled={!csvFile || loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-none backdrop-blur-sm border border-green-500/30"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Importing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload size={18} />
                  <span>Import CSV</span>
                </div>
              )}
            </button>

            {/* Import Results */}
            {importResult && (
              <div className="mt-6 p-4 bg-gray-800/50 border border-gray-600/50 rounded-lg backdrop-blur-sm">
                <h3 className="font-medium text-white mb-2">Import Results</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Imported:</span>
                    <span className="ml-2 text-green-400 font-medium">{importResult.inserted}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Skipped:</span>
                    <span className="ml-2 text-yellow-400 font-medium">{importResult.skipped}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block p-4 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/30 mb-4">
                <Users size={32} className="text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Create New Customer</h2>
              <p className="text-gray-400">Enter customer information to create a new record</p>
            </div>

            {/* Customer Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">Basic Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Customer ID</label>
                  <input
                    type="text"
                    value={customerData.customer_id}
                    onChange={(e) => handleCustomerInputChange("customer_id", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    placeholder="e.g., CUST001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={customerData.name}
                    onChange={(e) => handleCustomerInputChange("name", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    placeholder="Full name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Gender</label>
                    <select
                      value={customerData.gender}
                      onChange={(e) => handleCustomerInputChange("gender", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Age</label>
                    <input
                      type="number"
                      value={customerData.age}
                      onChange={(e) => handleCustomerInputChange("age", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                      placeholder="Age"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Job Type</label>
                  <select
                    value={customerData.job_type}
                    onChange={(e) => handleCustomerInputChange("job_type", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                  >
                    <option value="">Select</option>
                    <option value="Private">Private</option>
                    <option value="Self-employed">Self-employed</option>
                    <option value="Government">Government</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Credit History</label>
                  <select
                    value={customerData.credit_history}
                    onChange={(e) => handleCustomerInputChange("credit_history", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                  >
                    <option value="">Select</option>
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
              </div>

              {/* Financial & Loan Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">Financial Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Income</label>
                    <input
                      type="number"
                      value={customerData.income}
                      onChange={(e) => handleCustomerInputChange("income", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                      placeholder="Annual income"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Expenses</label>
                    <input
                      type="number"
                      value={customerData.expenses}
                      onChange={(e) => handleCustomerInputChange("expenses", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                      placeholder="Annual expenses"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Existing Loans</label>
                  <input
                    type="number"
                    value={customerData.existing_loans}
                    onChange={(e) => handleCustomerInputChange("existing_loans", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    placeholder="Total existing loan amount"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Financing Type</label>
                    <select
                      value={customerData.financing_type}
                      onChange={(e) => handleCustomerInputChange("financing_type", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    >
                      <option value="">Select</option>
                      <option value="Murabaha">Murabaha</option>
                      <option value="Ijarah">Ijarah</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Asset Type</label>
                    <select
                      value={customerData.asset_type}
                      onChange={(e) => handleCustomerInputChange("asset_type", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    >
                      <option value="">Select</option>
                      <option value="House">House</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Car">Car</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Asset Value</label>
                    <input
                      type="number"
                      value={customerData.asset_value}
                      onChange={(e) => handleCustomerInputChange("asset_value", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                      placeholder="Total asset value"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Down Payment</label>
                    <input
                      type="number"
                      value={customerData.down_payment}
                      onChange={(e) => handleCustomerInputChange("down_payment", e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                      placeholder="Down payment amount"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Installment Period (months)</label>
                  <input
                    type="number"
                    value={customerData.installment_period}
                    onChange={(e) => handleCustomerInputChange("installment_period", e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition-all duration-300"
                    placeholder="Loan duration in months"
                  />
                </div>
              </div>
            </div>

            {/* Create Button */}
            <div className="mt-8">
              <button
                onClick={handleCreateCustomer}
                disabled={loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-none backdrop-blur-sm border border-green-500/30"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Customer...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Save size={18} />
                    <span>Create Customer</span>
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gray-900/60 backdrop-blur-lg border-t border-gray-700/50 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="text-sm text-gray-400">
            © 2025 Customer Data Management System
          </div>
        </div>
      </footer>
    </div>
  );
}