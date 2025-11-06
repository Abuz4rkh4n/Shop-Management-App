import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, Package, User, Calendar } from "lucide-react";

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [popup, setPopup] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [receiptItems, setReceiptItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");

  const [returnData, setReturnData] = useState({
    quantity: 1,
    reason: ""
  });

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    loadReturns();
    loadSalesReceipts();
    loadWorkers();
  }, []);

  async function loadReturns() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturns(res.data || []);
    } catch {
      setPopup("❌ Error loading returns");
    }
  }

  async function loadSalesReceipts() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/sales/receipts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceipts(res.data || []);
    } catch {
      setPopup("❌ Error loading receipts");
    }
  }

  async function loadReceiptItems(receiptId) {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/sales/receipts/${receiptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceiptItems(res.data?.items || []);
    } catch {
      setReceiptItems([]);
    }
  }

  async function loadWorkers() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/workers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkers(res.data || []);
    } catch {
      setPopup("❌ Error loading workers");
    }
  }

  function openReturnForm(receipt) {
    setSelectedReceiptId(String(receipt.id));
    setSelectedItemId("");
    setReturnData({ quantity: 1, reason: "" });
    loadReceiptItems(receipt.id);
    setShowReturnForm(true);
  }

  async function processReturn() {
    if (!selectedReceiptId || !selectedItemId || returnData.quantity <= 0) {
      setPopup("⚠️ Please select receipt, item and valid quantity");
      return;
    }
    const chosen = receiptItems.find(it => String(it.id) === String(selectedItemId));
    if (!chosen) {
      setPopup("⚠️ Selected item not found");
      return;
    }
    if (returnData.quantity > Number(chosen.quantity)) {
      setPopup("⚠️ Return quantity cannot exceed item quantity in receipt");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${api}/sales/receipts/${selectedReceiptId}/return`, {
        item_id: Number(selectedItemId),
        quantity: Number(returnData.quantity),
        reason: returnData.reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPopup("✅ Return processed successfully");
      setShowReturnForm(false);
      loadReturns();
      loadSalesReceipts();
    } catch (err) {
      setPopup("❌ Error processing return");
    }
  }

  const filteredReceipts = receipts.filter(r => {
    const q = receiptSearch.toLowerCase();
    if (!q) return true;
    return (
      String(r.id).includes(q) ||
      (r.worker_name || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-screen w-full p-10">
      <div className="w-full mx-auto bg-white p-8 rounded-xl shadow-lg border">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold text-primary">Item Returns</h1>
          </div>
          <button
            onClick={() => setShowReturnForm(true)}
            className="bg-primary text-secondary px-5 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition"
          >
            Process Return
          </button>
        </div>

        {/* Popup */}
        {popup && (
          <div className="bg-secondary text-primary p-3 rounded mb-4 flex justify-between items-center shadow">
            <div>{popup}</div>
            <button
              onClick={() => setPopup("")}
              className="text-red-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Available Sales for Return */}
          <div>
            <h3 className="text-xl font-semibold text-primary mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Sales Receipts
            </h3>
            <div className="mb-3">
              <input
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder="Search by receipt id, worker, or customer..."
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="max-h-96 overflow-auto border rounded-lg">
              {filteredReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex justify-between items-center border-b p-3 hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="font-semibold text-gray-800">Receipt #{receipt.id}</div>
                    <div className="text-sm text-gray-600">
                      Worker: {receipt.worker_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Items: {receipt.items_count} • Total: Rs. {Number(receipt.total_amount).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Customer: {receipt.customer_name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(receipt.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => openReturnForm(receipt)}
                    className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition"
                  >
                    Return Item
                  </button>
                </div>
              ))}
              {filteredReceipts.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No receipts found
                </div>
              )}
            </div>
          </div>

          {/* Right: Return History */}
          <div>
            <h3 className="text-xl font-semibold text-primary mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Return History
            </h3>
            <div className="max-h-96 overflow-auto border rounded-lg">
              {returns.map((returnItem) => (
                <div
                  key={returnItem.id}
                  className="border-b p-3 hover:bg-gray-50 transition"
                >
                  <div className="font-semibold text-gray-800">{returnItem.product_name}</div>
                  <div className="text-sm text-gray-600">
                    Sale ID: {returnItem.sale_id} • Worker: {returnItem.worker_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    Returned: {returnItem.quantity} • Amount: Rs. {Number(returnItem.returned_amount).toFixed(2)}
                  </div>
                  {returnItem.reason && (
                    <div className="text-sm text-gray-600">
                      Reason: {returnItem.reason}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    {new Date(returnItem.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {returns.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No returns processed yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Return Form Modal */}
      {showReturnForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 text-primary">
              Process Return
            </h3>

            {!!selectedReceiptId && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">Receipt #{selectedReceiptId}</div>
                <div className="text-sm text-gray-600">Select an item to return</div>
              </div>
            )}

            <div className="grid gap-3">
              <div>
                <label className="text-sm">Select Receipt</label>
                <select
                  className="w-full border p-2 rounded"
                  value={selectedReceiptId}
                  onChange={async (e) => {
                    const rid = e.target.value;
                    setSelectedReceiptId(rid);
                    setSelectedItemId("");
                    if (rid) await loadReceiptItems(rid);
                  }}
                >
                  <option value="">Select a receipt</option>
                  {filteredReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.id} — {r.worker_name} — {r.customer_name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Select Item</label>
                <select
                  className="w-full border p-2 rounded"
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setReturnData((d) => ({ ...d, quantity: 1 }));
                  }}
                  disabled={!selectedReceiptId}
                >
                  <option value="">Select an item</option>
                  {receiptItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.product_name} (Qty: {it.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">
                  Return Quantity (Max: {receiptItems.find(it => String(it.id) === String(selectedItemId))?.quantity || 0})
                </label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={returnData.quantity}
                  min={1}
                  max={receiptItems.find(it => String(it.id) === String(selectedItemId))?.quantity || 0}
                  onChange={(e) =>
                    setReturnData({
                      ...returnData,
                      quantity: Math.max(1, Number(e.target.value))
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Reason (Optional)</label>
                <textarea
                  className="w-full border p-2 rounded"
                  rows={3}
                  value={returnData.reason}
                  onChange={(e) =>
                    setReturnData({...returnData, reason: e.target.value})
                  }
                  placeholder="Enter return reason..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowReturnForm(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={processReturn}
                className="bg-primary text-secondary px-4 py-2 rounded"
                disabled={!selectedReceiptId || !selectedItemId}
              >
                Process Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;



