import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import AuthPage from "./AuthPage";
import CustomerDetail from "./CustomerDetail";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="*" element={<div style={{color:"#fff",background:"#000",minHeight:"100vh",padding:24}}>Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}