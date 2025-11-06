import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated";
import Navbar from "./components/Navbar";
import Products from "./components/Products";
import Workers from "./components/Workers";
import Sales from "./components/Sales";
import Dashboard from "./components/Dashboard";
import Returns from "./components/Returns";
import Login from "./components/auth/Login";
import Admins from "./components/admin/Admins";
import BackupRestore from "./components/BackupRestore";

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <Login />
              </RedirectIfAuthenticated>
            }
          />
          {null}

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="flex h-screen overflow-hidden">
                  <Navbar />
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
                      <div className="max-w-7xl mx-auto">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/workers" element={<Workers />} />
                          <Route path="/sales" element={<Sales />} />
                          <Route path="/returns" element={<Returns />} />
                          <Route path="/admins" element={<Admins />} />
                          <Route path="/backup" element={<BackupRestore />} />
                        </Routes>
                      </div>
                    </div>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
