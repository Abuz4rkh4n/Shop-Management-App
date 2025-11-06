import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Navbar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const permissions = user?.permissions || {};
  const isSuper = user?.role === 'superadmin';
  const menuItems = [
    { key: 'dashboard', name: "Dashboard", path: "/", icon: <LayoutDashboard size={22} />, show: true },
    { key: 'products', name: "Products", path: "/products", icon: <Package size={22} />, show: isSuper || !!permissions.products },
    { key: 'workers', name: "Workers", path: "/workers", icon: <Users size={22} />, show: isSuper || !!permissions.workers },
    { key: 'sales', name: "Sales", path: "/sales", icon: <ShoppingCart size={22} />, show: isSuper || !!permissions.sales },
    { key: 'returns', name: "Returns", path: "/returns", icon: <RotateCcw size={22} />, show: isSuper || !!permissions.returns },
    { key: 'admins', name: "Admins", path: "/admins", icon: <Users size={22} />, show: isSuper },
  ].filter(m => m.show);

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

      {/* User Info and Logout */}
      <div className="p-4 border-t border-yellow-300/20">
        {!collapsed && user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-yellow-200">{user.email}</div>
            </div>
          </div>
        )}
        
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 text-secondary hover:bg-red-500/20 hover:text-red-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={22} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Navbar;
