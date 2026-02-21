import { useEffect, useState } from "react";
import axios from "axios";

const DayManagement = () => {
  const [days, setDays] = useState([]);
  const [currentDay, setCurrentDay] = useState(null);
  const [showDayReport, setShowDayReport] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");

  // Calculate expected closing cash
  const expectedClosingCash = currentDay ? 
    (parseFloat(currentDay.opening_cash || 0) + parseFloat(currentDay.total_sales || 0)).toFixed(2) 
    : "";

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    loadDays();
    checkCurrentDay();
  }, []);

  async function loadDays() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/day-management`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDays(res.data || []);
    } catch (error) {
      console.error('Error loading days:', error);
      setPopup("❌ Error loading day management data");
    }
  }

  async function checkCurrentDay() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/day-management/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentDay(res.data);
    } catch (error) {
      // No current day open
      setCurrentDay(null);
    }
  }

  async function startDay() {
    if (!openingCash || openingCash <= 0) {
      setPopup("⚠️ Please enter opening cash amount");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${api}/day-management/start`, {
        opening_cash: Number(openingCash),
        notes: notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPopup("✅ Day started successfully");
      setOpeningCash("");
      setNotes("");
      await loadDays();
      await checkCurrentDay();
    } catch (error) {
      setPopup("❌ Error starting day");
    } finally {
      setLoading(false);
    }
  }

  async function closeDay() {
    if (!closingCash || closingCash < 0) {
      setPopup("⚠️ Please enter closing cash amount");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`${api}/day-management/close/${currentDay.id}`, {
        closing_cash: Number(closingCash),
        notes: notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPopup("✅ Day closed successfully");
      setClosingCash("");
      setNotes("");
      await loadDays();
      await checkCurrentDay();
    } catch (error) {
      setPopup("❌ Error closing day");
    } finally {
      setLoading(false);
    }
  }

  async function viewDayReport(day) {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/day-management/summary/${day.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedDay({
        day: day,
        summary: res.data
      });
      setShowDayReport(true);
    } catch (error) {
      setPopup("❌ Error loading day report");
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-PK');
  }

  return (
    <div className="h-screen w-full p-10">
      <div className="w-full mx-auto bg-white p-8 rounded-xl shadow-lg border">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Day Management</h1>
          <div className="flex items-center gap-3">
            {currentDay ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-600 font-semibold">
                  Day Open: {new Date(currentDay.day_date).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-red-600 font-semibold">No Day Open</span>
              </div>
            )}
          </div>
        </div>

        {/* Popup */}
        {popup && (
          <div className="bg-secondary text-primary p-3 rounded mb-4 flex justify-between items-center shadow">
            <div>{popup}</div>
            <button
              onClick={() => setPopup("")}
              className="text-red-600 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Current Day Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Start Day */}
          {!currentDay && (
            <div className="border rounded-xl p-6 bg-gradient-to-br from-blue-50 to-blue-100">
              <h3 className="text-xl font-bold text-primary mb-4">Start New Day</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Cash (Rs.)
                  </label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="Enter opening cash amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes for the day"
                    rows="3"
                  />
                </div>
                <button
                  onClick={startDay}
                  disabled={loading}
                  className="w-full bg-primary text-secondary py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Starting..." : "Start Day"}
                </button>
              </div>
            </div>
          )}

          {/* Close Day */}
          {currentDay && (
            <div className="border rounded-xl p-6 bg-gradient-to-br from-red-50 to-red-100">
              <h3 className="text-xl font-bold text-primary mb-4">Close Current Day</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closing Cash (Rs.)
                  </label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder={expectedClosingCash ? `Expected: Rs. ${expectedClosingCash}` : "Enter closing cash amount"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes for the day"
                    rows="3"
                  />
                </div>
                <button
                  onClick={closeDay}
                  disabled={loading}
                  className="w-full bg-primary text-secondary py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50"
                >
                  {loading ? "Closing..." : "Close Day"}
                </button>
              </div>
            </div>
          )}

          {/* Current Day Summary */}
          {currentDay && (
            <div className="border rounded-xl p-6 bg-gradient-to-br from-green-50 to-green-100">
              <h3 className="text-xl font-bold text-primary mb-4">Current Day Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">Date:</span>
                  <span className="font-semibold">{new Date(currentDay.day_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Opened At:</span>
                  <span className="font-semibold">{formatTime(currentDay.opening_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Opening Cash:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(currentDay.opening_cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Sales:</span>
                  <span className="font-semibold text-primary">{formatCurrency(currentDay.total_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Receipts:</span>
                  <span className="font-semibold">{currentDay.total_receipts}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Day History */}
        <div>
          <h3 className="text-xl font-semibold text-primary mb-4">Day History</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-secondary">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Opening Time</th>
                  <th className="p-3 text-left">Closing Time</th>
                  <th className="p-3 text-right">Opening Cash</th>
                  <th className="p-3 text-right">Closing Cash</th>
                  <th className="p-3 text-right">Total Sales</th>
                  <th className="p-3 text-center">Receipts</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-3 font-medium">{new Date(day.day_date).toLocaleDateString()}</td>
                    <td className="p-3">{day.opening_time ? formatTime(day.opening_time) : 'N/A'}</td>
                    <td className="p-3">{day.closing_time ? formatTime(day.closing_time) : 'N/A'}</td>
                    <td className="p-3 text-right">{formatCurrency(day.opening_cash)}</td>
                    <td className="p-3 text-right">{formatCurrency(day.closing_cash)}</td>
                    <td className="p-3 text-right font-semibold text-primary">{formatCurrency(day.total_sales)}</td>
                    <td className="p-3 text-center">{day.total_receipts}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        day.status === 'open' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {day.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => viewDayReport(day)}
                        className="px-3 py-1 bg-primary text-secondary rounded hover:bg-opacity-90 transition-colors"
                      >
                        View Report
                      </button>
                    </td>
                  </tr>
                ))}
                {days.length === 0 && (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-500">
                      No day records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Day Report Modal */}
      {showDayReport && selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-primary">
                Day Report - {new Date(selectedDay.day.day_date).toLocaleDateString()}
              </h2>
              <button
                onClick={() => setShowDayReport(false)}
                className="text-red-600 hover:text-red-800 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-center mb-6 border-b pb-4">
              <h3 className="font-bold text-xl text-primary">Al Madina Shopping Centre</h3>
              <p className="text-gray-600">Churi Gali</p>
              <p className="text-sm font-semibold">Owner: Haji Murtaza</p>
              <p className="text-sm">Phone: [Your Phone Number]</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Total Sales</h4>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedDay.day.total_sales)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-800 mb-1">Total Receipts</h4>
                <p className="text-2xl font-bold text-green-600">{selectedDay.day.total_receipts}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h4 className="text-sm font-medium text-purple-800 mb-1">Products Sold</h4>
                <p className="text-2xl font-bold text-purple-600">{selectedDay.total_products_sold || 0}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="text-sm font-medium text-orange-800 mb-1">Customers</h4>
                <p className="text-2xl font-bold text-orange-600">{selectedDay.total_customers || 0}</p>
              </div>
            </div>

            {/* Detailed Information */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Day Details */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Day Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span>Opening Time:</span>
                    <span className="font-semibold">{formatTime(selectedDay.day.opening_time)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Closing Time:</span>
                    <span className="font-semibold">{selectedDay.day.closing_time ? formatTime(selectedDay.day.closing_time) : 'Still Open'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Opening Cash:</span>
                    <span className="font-semibold">{formatCurrency(selectedDay.day.opening_cash)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Closing Cash:</span>
                    <span className="font-semibold">{formatCurrency(selectedDay.day.closing_cash)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Cash Sales:</span>
                    <span className="font-semibold">{formatCurrency(selectedDay.summary?.cash_sales || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Credit Sales:</span>
                    <span className="font-semibold">{formatCurrency(selectedDay.credit_sales || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span>Pending Sales:</span>
                    <span className="font-semibold">{formatCurrency(selectedDay.pending_sales || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Top Products */}
              <div>
                <h3 className="font-semibold text-lg mb-3">Top Selling Products</h3>
                <div className="space-y-2">
                  {selectedDay.top_selling_products?.length > 0 ? (
                    selectedDay.top_selling_products.slice(0, 5).map((product, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                          <span className="font-medium">{product.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{product.total_sold} units</div>
                          <div className="text-sm text-gray-500">{formatCurrency(product.total_revenue)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No sales data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Worker Performance */}
            {selectedDay.worker_performance && Object.keys(selectedDay.worker_performance).length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">Worker Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(selectedDay.worker_performance).map(([workerName, performance]) => (
                    <div key={workerName} className="border rounded-lg p-4 bg-gray-50">
                      <h4 className="font-semibold text-primary mb-2">{workerName}</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Receipts:</span>
                          <span className="font-semibold">{performance.receipts_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span className="font-semibold">{formatCurrency(performance.total_sales)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedDay.day.notes && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">Notes</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">{selectedDay.day.notes}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowDayReport(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-primary text-secondary rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayManagement;
