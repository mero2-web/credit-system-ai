import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./App";
import CustomerDetail from "./CustomerDetail";
import AuthPage from "./AuthenticationPage";
import DataManagementPage from "./DataManagementPage";
import "./index.css";

const container = document.getElementById("root");
createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/data" element={<DataManagementPage />} />
        <Route path="*" element={<div style={{color:"#fff",background:"#000",minHeight:"100vh",padding:24}}>Not Found</div>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);