import { useEffect, useState } from "react";
import axios from "axios";

const PERIODS = [
  { key: "day", label: "Last Day" },
  { key: "week", label: "Last Week" },
  { key: "month", label: "Last Month" },
  { key: "year", label: "Last Year" },
  { key: "all", label: "All Time" },
];

const Dashboard = () => {
  const api = import.meta.env.VITE_API_URL;

  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [summary, setSummary] = useState({
    total_items_sold: 0,
    total_sales_amount: 0,
    total_profit: 0,
    total_workers: 0,
    total_products: 0,
  });

  const [leaderboard, setLeaderboard] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);

  const [loading, setLoading] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [period, from, to]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([
      fetchSummary(),
      fetchLeaderboard(),
      fetchTopProducts(),
      fetchRecentSales(),
    ]);
    setLoading(false);
  }

  function buildQuery() {
    if (from && to) return `?from=${from}&to=${to}`;
    return `?period=${period}`;
  }

  async function fetchSummary() {
    try {
      setKpiLoading(true);
      const q = buildQuery();
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/dashboard/summary${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(res.data);
    } catch (err) {
      console.error("Summary error", err);
    } finally {
      setKpiLoading(false);
    }
  }

  async function fetchLeaderboard() {
    try {
      const q = buildQuery() + "&limit=6";
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/dashboard/leaderboard${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLeaderboard(res.data || []);
    } catch (err) {
      console.error("Leaderboard error", err);
    }
  }

  async function fetchTopProducts() {
    try {
      const q = buildQuery() + "&limit=8";
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/dashboard/top-products${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTopProducts(res.data || []);
    } catch (err) {
      console.error("Top products error", err);
    }
  }

  async function fetchRecentSales() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/dashboard/recent-sales?limit=8`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentSales(res.data || []);
    } catch (err) {
      console.error("Recent sales error", err);
    }
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString();
  }

  return (
    <div className="h-screen w-full p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header / Controls */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
              <label className="text-sm text-gray-600">Period</label>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setFrom("");
                  setTo("");
                }}
                className="ml-2 border rounded p-1"
              >
                {PERIODS.map((p) => (
                  <option value={p.key} key={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm">
              <label className="text-sm text-gray-600">Custom</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border rounded p-1"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border rounded p-1"
              />
              <button
                onClick={() => {
                  setPeriod("all");
                  fetchAll();
                }}
                className="ml-2 px-4 py-1 rounded-md bg-primary text-secondary hover:bg-secondary hover:text-primary transition font-medium shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="text-sm text-gray-500">Items Sold</div>
            <div className="text-2xl font-bold text-primary">
              {fmt(summary.total_items_sold)}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="text-sm text-gray-500">Total Sales</div>
            <div className="text-2xl font-bold text-primary">
              Rs.{" "}
              {fmt(
                summary.total_sales_amount.toFixed
                  ? summary.total_sales_amount.toFixed(2)
                  : summary.total_sales_amount
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="text-sm text-gray-500">Total Profit</div>
            <div className="text-2xl font-bold text-green-600">
              Rs.{" "}
              {fmt(
                (summary.total_profit || 0).toFixed
                  ? summary.total_profit.toFixed(2)
                  : summary.total_profit
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="text-sm text-gray-500">Workers</div>
            <div className="text-2xl font-bold text-primary">
              {fmt(summary.total_workers)}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 border">
            <div className="text-sm text-gray-500">Products</div>
            <div className="text-2xl font-bold text-primary">
              {fmt(summary.total_products)}
            </div>
          </div>
        </div>

        {/* Two-column: Leaderboard | Top Products */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Worker Leaderboard */}
          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-primary">
                Worker Leaderboard
              </h3>
              <div className="text-sm text-gray-500">
                {PERIODS.find((p) => p.key === period).label}
              </div>
            </div>

            <div className="space-y-3">
              {leaderboard.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between gap-4 p-3 rounded hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-secondary flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-gray-500">
                        {w.sales_count} sales
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      Rs.{" "}
                      {fmt(
                        w.sales_amount.toFixed
                          ? Number(w.sales_amount).toFixed(2)
                          : w.sales_amount
                      )}
                    </div>
                    <div className="text-xs text-green-600">
                      Profit Rs.{" "}
                      {fmt(
                        w.profit.toFixed
                          ? Number(w.profit).toFixed(2)
                          : w.profit
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <div className="text-gray-500 p-3">No data</div>
              )}
            </div>
          </div>

          {/* Product Leaderboard */}
          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-primary">
                Best Products Leaderboard
              </h3>
              <div className="text-sm text-gray-500">By profit & sales</div>
            </div>

            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 p-3 rounded hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary text-primary flex items-center justify-center font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.units_sold} units
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      Rs.{" "}
                      {fmt(
                        p.total_sales_amount.toFixed
                          ? Number(p.total_sales_amount).toFixed(2)
                          : p.total_sales_amount
                      )}
                    </div>
                    <div className="text-xs text-green-600">
                      Profit Rs.{" "}
                      {fmt(
                        p.total_profit.toFixed
                          ? Number(p.total_profit).toFixed(2)
                          : p.total_profit
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <div className="text-gray-500 p-3">No data</div>
              )}
            </div>
          </div>
        </div>

        {/* Product performance + recent sales */}
        <div className="grid md:grid-cols-2 gap-6 pb-6">
          <div className="bg-white rounded-2xl shadow p-6 border">
            <h3 className="text-xl font-semibold mb-4 text-primary">
              Product Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-secondary">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-right">Units Sold</th>
                    <th className="p-2 text-right">Sales Amount</th>
                    <th className="p-2 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">{fmt(p.units_sold)}</td>
                      <td className="p-2 text-right">
                        Rs.{" "}
                        {fmt(
                          p.total_sales_amount.toFixed
                            ? Number(p.total_sales_amount).toFixed(2)
                            : p.total_sales_amount
                        )}
                      </td>
                      <td className="p-2 text-right text-green-600">
                        Rs.{" "}
                        {fmt(
                          p.total_profit.toFixed
                            ? Number(p.total_profit).toFixed(2)
                            : p.total_profit
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-primary">
                Recent Sales
              </h3>
              <div className="text-sm text-gray-500">Latest transactions</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-secondary">
                    <th className="p-2 text-left">When</th>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Worker</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="p-2">{s.product_name}</td>
                      <td className="p-2 text-right">{s.quantity}</td>
                      <td className="p-2 text-right">
                        Rs. {fmt(s.total_amount)}
                      </td>
                      <td className="p-2">{s.worker_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
