import { useEffect, useState } from "react";
import axios from "axios";

const Workers = () => {
  const [workers, setWorkers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    father_name: "",
    phone: "",
    cnic: "",
    salary: "",
    position: "",
    benefits: "",
    date_joined: "",
  });

  const [popup, setPopup] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editWorker, setEditWorker] = useState(null);

  // Search filters
  const [searchName, setSearchName] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  // Sales Report
  const [salesReport, setSalesReport] = useState({
    day: [],
    week: [],
    month: [],
    year: [],
    all: [],
  });
  const [salesSearch, setSalesSearch] = useState("");

  const api = import.meta.env.VITE_API_URL;

  const fetchWorkers = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${api}/workers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setWorkers(res.data);
    setFiltered(res.data);
  };

  const fetchSalesReport = async () => {
    const periods = ["day", "week", "month", "year", "all"];
    const results = {};
    for (const p of periods) {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/workers/sales?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      results[p] = res.data;
    }
    setSalesReport(results);
  };

  useEffect(() => {
    fetchWorkers();
    fetchSalesReport();
  }, []);

  const addWorker = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${api}/workers`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPopup("Worker added successfully");
      setFormData({
        name: "",
        father_name: "",
        phone: "",
        cnic: "",
        salary: "",
        position: "",
        benefits: "",
        date_joined: "",
      });
      setShowForm(false);
      fetchWorkers();
    } catch (err) {
      setPopup(err.response?.data?.message || "Error adding worker");
    }
  };

  const deleteWorker = async (id) => {
    const token = localStorage.getItem('token');
    await axios.delete(`${api}/workers/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPopup("🗑️ Worker removed");
    fetchWorkers();
  };

  // Filtering logic
  useEffect(() => {
    let data = [...workers];

    if (searchName) {
      data = data.filter((w) =>
        w.name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    setFiltered(data);
    setPage(1);
  }, [searchName, workers]);

  // Pagination slice
  const paginated = filtered.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  // Filtered sales report
  const filterReport = (arr) =>
    arr.filter((w) => w.name.toLowerCase().includes(salesSearch.toLowerCase()));

  return (
    <div className="h-screen w-full p-10">
      {/* Workers Management Section */}
      <div className="w-full mx-auto bg-white p-6 rounded-2xl shadow-lg border">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#101820]">Manage Workers</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-secondary px-5 py-2 rounded-lg hover:opacity-90 transition shadow-sm"
          >
            + Add Worker
          </button>
        </div>

        {/* Popup message */}
        {popup && (
          <div className="bg-secondary text-primary p-3 rounded mb-4 flex justify-between items-center shadow">
            <span>{popup}</span>
            <button
              onClick={() => setPopup("")}
              className="text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            className="border w-full md:w-1/3 p-2 rounded-lg shadow-sm"
            placeholder="Search by Name"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
        </div>

        {/* Workers Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-base">
            <thead>
              <tr className="bg-primary text-secondary">
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Father Name</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">CNIC</th>
                <th className="p-3 text-left">Salary</th>
                <th className="p-3 text-left">Bonus</th>
                <th className="p-3 text-left">Position</th>
                <th className="p-3 text-left">Date Joined</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((w) => (
                <tr key={w.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-3">{w.id}</td>
                  <td className="p-3 font-medium">{w.name}</td>
                  <td className="p-3">{w.father_name}</td>
                  <td className="p-3">{w.phone}</td>
                  <td className="p-3">{w.cnic}</td>
                  <td className="p-3">Rs. {w.salary}</td>
                  <td className="p-3 text-green-600 font-semibold">
                    Rs. {w.benefits}
                  </td>
                  <td className="p-3">{w.role}</td>
                  <td className="p-3">
                    {new Date(w.joining_date).toLocaleDateString()}
                  </td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => setEditWorker(w)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded-lg hover:opacity-90"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteWorker(w.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg hover:opacity-90"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-6 text-center text-gray-500">
                    No workers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded-lg border ${
                page === i + 1
                  ? "bg-primary text-secondary"
                  : "bg-white text-primary"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Worker Sales Report Section */}
      <div className="w-full mx-auto bg-white p-6 rounded-2xl shadow-lg border mt-10">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-[#101820]">
            Worker Sales Report
          </h2>
          <input
            className="border p-2 rounded-lg shadow-sm"
            placeholder="Search Worker"
            value={salesSearch}
            onChange={(e) => setSalesSearch(e.target.value)}
          />
        </div>

        {/* Sales Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm md:text-base">
            <thead>
              <tr className="bg-primary text-secondary">
                <th className="p-3 text-left">Worker</th>
                <th className="p-3 text-left">Last Day</th>
                <th className="p-3 text-left">Last Week</th>
                <th className="p-3 text-left">Last Month</th>
                <th className="p-3 text-left">Last Year</th>
                <th className="p-3 text-left">All Time</th>
              </tr>
            </thead>
            <tbody>
              {filterReport(salesReport.all).map((w) => {
                const day = salesReport.day.find((x) => x.id === w.id) || {};
                const week = salesReport.week.find((x) => x.id === w.id) || {};
                const month =
                  salesReport.month.find((x) => x.id === w.id) || {};
                const year = salesReport.year.find((x) => x.id === w.id) || {};
                const all = salesReport.all.find((x) => x.id === w.id) || {};

                return (
                  <tr
                    key={w.id}
                    className="border-b hover:bg-gray-50 transition"
                  >
                    <td className="p-3 font-medium">{w.name}</td>
                    <td className="p-3 text-green-600">
                      Rs. {day.total_amount || 0}
                    </td>
                    <td className="p-3 text-green-600">
                      Rs. {week.total_amount || 0}
                    </td>
                    <td className="p-3 text-green-600">
                      Rs. {month.total_amount || 0}
                    </td>
                    <td className="p-3 text-green-600">
                      Rs. {year.total_amount || 0}
                    </td>
                    <td className="p-3 font-bold text-primary">
                      Rs. {all.total_amount || 0}
                    </td>
                  </tr>
                );
              })}
              {filterReport(salesReport.all).length === 0 && (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-gray-500">
                    No sales data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Worker</h2>
            <div className="grid gap-3">
              {[
                { key: "name", label: "Name" },
                { key: "father_name", label: "Father Name" },
                { key: "phone", label: "Phone Number" },
                { key: "cnic", label: "CNIC" },
                { key: "salary", label: "Salary (PKR)" },
                { key: "position", label: "Position" },
                { key: "benefits", label: "Benefits (PKR)" },
              ].map((f) => (
                <input
                  key={f.key}
                  className="border p-2 rounded shadow-sm"
                  placeholder={f.label}
                  value={formData[f.key]}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: e.target.value })
                  }
                />
              ))}
              <input
                type="date"
                className="border p-2 rounded shadow-sm"
                value={formData.date_joined}
                onChange={(e) =>
                  setFormData({ ...formData, date_joined: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={addWorker}
                className="bg-primary text-secondary px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {editWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Update Worker</h2>
            <div className="grid gap-3">
              {[
                { key: "name", label: "Name" },
                { key: "father_name", label: "Father Name" },
                { key: "phone", label: "Phone" },
                { key: "cnic", label: "CNIC" },
                { key: "salary", label: "Salary (PKR)" },
                { key: "role", label: "Position" },
                { key: "benefits", label: "Benefits (PKR)" },
              ].map((f) => (
                <input
                  key={f.key}
                  className="border p-2 rounded shadow-sm"
                  placeholder={f.label}
                  value={editWorker[f.key] || ""}
                  onChange={(e) =>
                    setEditWorker({ ...editWorker, [f.key]: e.target.value })
                  }
                />
              ))}
              <input
                type="date"
                className="border p-2 rounded shadow-sm"
                value={editWorker.date_joined?.split("T")[0] || ""}
                onChange={(e) =>
                  setEditWorker({ ...editWorker, date_joined: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditWorker(null)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const token = localStorage.getItem('token');
                  await axios.put(
                    `${api}/workers/${editWorker.id}`,
                    editWorker, {
                      headers: { Authorization: `Bearer ${token}` }
                    }
                  );
                  setPopup("Worker updated successfully");
                  setEditWorker(null);
                  fetchWorkers();
                }}
                className="bg-yellow-600 text-white px-4 py-2 rounded"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workers;
