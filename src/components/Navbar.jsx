import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const Navbar = () => {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { name: "Dashboard", path: "/", icon: <LayoutDashboard size={22} /> },
    { name: "Products", path: "/products", icon: <Package size={22} /> },
    { name: "Workers", path: "/workers", icon: <Users size={22} /> },
    { name: "Sales", path: "/sales", icon: <ShoppingCart size={22} /> },
  ];

  return (
    <div
      className={`h-screen bg-primary text-secondary flex flex-col justify-between shadow-lg transition-all duration-300 rounded-r-3xl ${
        collapsed ? "w-20" : "w-80"
      }`}
    >
      <div>
        <div className="flex items-center justify-between p-4">
          {!collapsed && (
            <h1 className="text-lg font-extrabold tracking-wide">MyStore</h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-white rounded-full"
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        <nav className="mt-12 flex flex-col justify-center gap-2">
          {menuItems.map((item, idx) => (
            <NavLink
              key={idx}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-secondary text-primary font-semibold shadow-md"
                    : "text-secondary hover:bg-yellow-200/20"
                }`
              }
            >
              {item.icon}
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Navbar;
