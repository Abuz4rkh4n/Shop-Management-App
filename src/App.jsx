import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Products from "./components/Products";
import Workers from "./components/Workers";
import Sales from "./components/Sales";
import Dashboard from "./components/Dashboard";

const App = () => {
  return (
    <Router>
      <div className="flex">
        <Navbar />

        <div className="flex justify-center w-full bg-gray-200 rounded-3xl h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/workers" element={<Workers />} />
            <Route path="/sales" element={<Sales />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
