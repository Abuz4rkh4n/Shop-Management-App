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
                <div className="flex">
                  <Navbar />
                  <div className="flex justify-center w-full bg-gray-200 rounded-3xl h-screen">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/workers" element={<Workers />} />
                      <Route path="/sales" element={<Sales />} />
                      <Route path="/returns" element={<Returns />} />
                      <Route path="/admins" element={<Admins />} />
                    </Routes>
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
