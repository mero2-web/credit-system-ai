import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./App";                  // App.js exports the Dashboard component
import CustomerDetail from "./CustomerDetail";
import AuthPage from "./AuthenticationPage";    // file is AuthenticationPage.jsx
import DataManagementPage from "./DataManagementPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/App" element={<Dashboard />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="*" element={<div style={{color:"#fff",background:"#000",minHeight:"100vh",padding:24}}>Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}