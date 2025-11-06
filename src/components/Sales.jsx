import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const Sales = () => {
  const [products, setProducts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [popup, setPopup] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [quickQty, setQuickQty] = useState(1);
  const [quickPrice, setQuickPrice] = useState("");
  const [quickWorkerId, setQuickWorkerId] = useState(null);

  const [cart, setCart] = useState([]);
  const [sales, setSales] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const salesPerPage = 8;
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // receipts
  const [receipts, setReceipts] = useState([]);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [showReceiptView, setShowReceiptView] = useState(false);

  // single worker per receipt
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);

  // barcode scan
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const hiddenInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  const api = import.meta.env.VITE_API_URL;
  const { updateSalePaymentStatus } = useAuth();

  useEffect(() => {
    loadProducts();
    loadWorkers();
    loadSales();
    loadSalesReceipts();
  }, []);

  async function loadProducts() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data || []);
    } catch {
      setPopup("❌ Error loading products");
    }
  }

  function receiptStatusClasses(status) {
    if (status === 'paid') return 'bg-green-100 text-green-700 border border-green-200';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    if (status === 'all product got removed') return 'bg-red-100 text-red-700 border border-red-200';
    return 'bg-gray-100 text-gray-700 border border-gray-200';
  }

  async function updateReceiptStatus(id, payment_status) {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${api}/sales/receipts/${id}/status`, { payment_status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceipts((prev) => prev.map((r) => r.id === id ? { ...r, payment_status } : r));
      setPopup('✅ Receipt status updated');
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to update receipt status';
      setPopup(`❌ Update error${status ? ' (' + status + ')' : ''}: ${msg}`);
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
      // silent
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

  async function loadSales(page = 1) {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${api}/sales?page=${page}&limit=${salesPerPage}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setSales(res.data || []);
    } catch {
      setPopup("❌ Error loading sales");
    }
  }

  // open quick add modal
  function openQuickAdd(product) {
    setSelectedProduct(product);
    setQuickQty(1);
    setQuickPrice(product.sell_price);
    setQuickWorkerId(null);
    setShowQuickAdd(true);
  }

  function addToCartFromQuick() {
    if (!selectedProduct || quickQty <= 0) {
      setPopup("⚠️ Enter valid quantity");
      return;
    }
    const existing = cart.find(
      (c) => c.product_id === selectedProduct.id && c.sold_price === Number(quickPrice)
    );
    if (existing) {
      setCart((prev) =>
        prev.map((c) =>
          c === existing ? { ...c, quantity: c.quantity + Number(quickQty) } : c
        )
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: Number(quickQty),
          sold_price: Number(quickPrice),
        },
      ]);
    }
    setShowQuickAdd(false);
  }

  function updateCartRow(index, field, value) {
    setCart((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]:
          field === "quantity"
            ? Number(value)
            : value,
      };
      return next;
    });
  }

  function removeCartRow(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  async function checkout() {
    if (cart.length === 0) {
      setPopup("⚠️ Cart is empty");
      return;
    }
    if (!selectedWorkerId) {
      setPopup("⚠️ Select worker");
      return;
    }
    if (!customerName || customerName.trim() === "") {
      setPopup("⚠️ Customer name is required");
      return;
    }
    const items = cart.map((c) => ({
      product_id: c.product_id,
      quantity: c.quantity,
      sold_price: c.sold_price,
    }));

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${api}/sales/receipts`, {
        worker_id: Number(selectedWorkerId),
        items,
        paymentStatus,
        customerName,
        customerPhone
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPopup("✅ Receipt created");
      setCart([]);
      setShowCheckout(false);
      setPaymentStatus('paid');
      setCustomerName('');
      setCustomerPhone('');
      setSelectedWorkerId(null);
      loadProducts();
      loadSales(salesPage);
      loadSalesReceipts();
      // open receipt view for printing
      try {
        const receiptId = res.data?.receiptId;
        if (receiptId) {
          const r = await axios.get(`${api}/sales/receipts/${receiptId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setActiveReceipt(r.data);
          setShowReceiptView(true);
        }
      } catch {}
    } catch (err) {
      setPopup("❌ Error during checkout");
    }
  }

  // barcode: listen to key events when enabled (auto-submit after short pause)
  useEffect(() => {
    if (!scannerEnabled) return;
    const handler = (e) => {
      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        setBarcodeBuffer((prev) => {
          const next = (prev + key).slice(0, 32);
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = setTimeout(() => {
            const code = next.trim();
            setBarcodeBuffer("");
            if (code) addProductByBarcode(code);
          }, 150); // small delay matches typical scanner burst
          return next;
        });
      } else if (key === 'Enter') {
        const code = (barcodeBuffer || "").trim();
        setBarcodeBuffer("");
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        if (code) addProductByBarcode(code);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, [scannerEnabled]);

  async function addProductByBarcode(code) {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/products/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const p = res.data;
      if (!p || p.quantity <= 0) {
        setPopup("⚠️ Product not found or out of stock");
        return;
      }
      let added = false;
      setCart((prev) => {
        const existing = prev.find((c) => c.product_id === p.id && c.sold_price === Number(p.sell_price));
        if (existing) {
          const nextQty = existing.quantity + 1;
          if (nextQty > Number(p.quantity)) {
            setPopup("⚠️ Not enough stock to add more of this product");
            return prev;
          }
          added = true;
          return prev.map((c) => c === existing ? { ...c, quantity: nextQty } : c);
        }
        added = true;
        return [
          ...prev,
          {
            product_id: p.id,
            product_name: p.name,
            quantity: 1,
            sold_price: Number(p.sell_price),
          },
        ];
      });
      if (added) setPopup(`✅ Added: ${p.name}`);
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to fetch product';
      setPopup(`❌ Fetch error${status ? ' (' + status + ')' : ''}: ${msg}`);
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // receipts filters & pagination
  const [receiptsSearchWorker, setReceiptsSearchWorker] = useState("");
  const [receiptsSearchCustomer, setReceiptsSearchCustomer] = useState("");
  const [receiptsDateFrom, setReceiptsDateFrom] = useState(""); // yyyy-mm-dd
  const [receiptsDateTo, setReceiptsDateTo] = useState(""); // yyyy-mm-dd
  const [receiptsPage, setReceiptsPage] = useState(1);
  const receiptsPerPage = 10;

  const filteredReceipts = receipts.filter((r) => {
    const workerMatch = receiptsSearchWorker
      ? (r.worker_name || "").toLowerCase().includes(receiptsSearchWorker.toLowerCase())
      : true;
    const customerMatch = receiptsSearchCustomer
      ? (r.customer_name || "").toLowerCase().includes(receiptsSearchCustomer.toLowerCase())
      : true;
    const createdAt = r.created_at ? new Date(r.created_at) : null;
    const fromOk = receiptsDateFrom ? (createdAt && createdAt >= new Date(receiptsDateFrom)) : true;
    const toOk = receiptsDateTo ? (createdAt && createdAt <= new Date(receiptsDateTo + 'T23:59:59')) : true;
    return workerMatch && customerMatch && fromOk && toOk;
  });

  const receiptsTotalPages = Math.max(1, Math.ceil(filteredReceipts.length / receiptsPerPage));
  const receiptsStart = (receiptsPage - 1) * receiptsPerPage;
  const paginatedReceipts = filteredReceipts.slice(receiptsStart, receiptsStart + receiptsPerPage);

  function changeReceiptsPage(next) {
    setReceiptsPage((p) => Math.min(receiptsTotalPages, Math.max(1, next)));
  }

  async function handleDeleteReceipt(id) {
    const yes = window.confirm(`Delete receipt #${id}? This action cannot be undone.`);
    if (!yes) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${api}/sales/receipts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPopup("✅ Receipt deleted");
      await loadSalesReceipts();
      // keep current filters; reset page if empty
      setReceiptsPage((p) => {
        const newLen = filteredReceipts.length - 1;
        const pages = Math.max(1, Math.ceil(newLen / receiptsPerPage));
        return Math.min(p, pages);
      });
    } catch {
      setPopup("❌ Failed to delete receipt");
    }
  }

  return (
    <div className="h-screen w-full p-10">
      <div className="w-full mx-auto bg-white p-8 rounded-xl shadow-lg border">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Sales POS</h1>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setScannerEnabled((v) => !v)}
              className={`px-4 py-2 rounded-lg font-semibold border ${scannerEnabled ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {scannerEnabled ? 'Scanner: On' : 'Scanner: Off'}
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              className="w-72 border p-2 rounded-lg focus:ring-2 focus:ring-primary"
            />
            <select
              value={selectedWorkerId ?? ''}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="border p-2 rounded-lg"
            >
              <option value="">Select worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowCheckout(true)}
              className="bg-primary text-secondary px-5 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition"
            >
              Checkout ({cart.length})
            </button>
          </div>
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

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Product list */}
          <div className="col-span-2">
            <div className="grid gap-3">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center border rounded-lg p-3 hover:shadow-md transition bg-gray-50"
                >
                  <div>
                    <div className="font-semibold text-gray-800">{p.name}</div>
                    <div className="text-sm text-gray-600">
                      Rs. {p.sell_price} • Stock: {p.quantity}
                    </div>
                    <div
                      className={` font-semibold text-[14px] rounded-md text-center py-1 mt-2 ${
                        p.quantity == 0
                          ? " bg-red-300 text-red-700"
                          : " bg-green-300 text-green-700"
                      }`}
                    >
                      {p.quantity == 0 ? "Out of Stock" : "Available"}
                    </div>
                  </div>
                  <button
                    disabled={p.quantity <= 0}
                    onClick={() => openQuickAdd(p)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      p.quantity > 0
                        ? "bg-primary text-secondary hover:bg-opacity-90"
                        : "bg-gray-300 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    ➕ Quick Add
                  </button>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No products found
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart */}
          <div className="col-span-1 border rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-lg mb-3 text-primary">Cart</h3>
            {scannerEnabled && (
              <div className="mb-2 text-xs text-gray-600">Scanner active. Type or scan product ID. Buffer: {barcodeBuffer}</div>
            )}
            <div className="max-h-96 overflow-auto">
              {cart.map((c, idx) => (
                <div
                  key={idx}
                  className="mb-3 border-b pb-2 bg-white p-2 rounded-lg shadow-sm"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-medium text-gray-700">
                      {c.product_name}
                    </div>
                    <div className="text-primary font-bold">
                      Rs. {c.sold_price * c.quantity}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="w-20 border p-1 rounded"
                      value={c.quantity}
                      onChange={(e) =>
                        updateCartRow(
                          idx,
                          "quantity",
                          Math.max(1, Number(e.target.value))
                        )
                      }
                    />
                    <input
                      type="number"
                      className="w-24 border p-1 rounded"
                      value={c.sold_price}
                      onChange={(e) =>
                        updateCartRow(idx, "sold_price", Number(e.target.value))
                      }
                    />
                    <button
                      onClick={() => removeCartRow(idx)}
                      className="px-2 bg-red-500 text-white rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="text-primary">
                  Rs.{" "}
                  {cart
                    .reduce((s, c) => s + c.quantity * c.sold_price, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Receipts */}
        <div className="mt-10">
          <h3 className="text-xl font-semibold text-primary mb-4">Sales Receipts</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
            <input
              value={receiptsSearchWorker}
              onChange={(e) => { setReceiptsSearchWorker(e.target.value); setReceiptsPage(1); }}
              placeholder="Filter by worker"
              className="border p-2 rounded"
            />
            <input
              value={receiptsSearchCustomer}
              onChange={(e) => { setReceiptsSearchCustomer(e.target.value); setReceiptsPage(1); }}
              placeholder="Filter by customer"
              className="border p-2 rounded"
            />
            <input
              type="date"
              value={receiptsDateFrom}
              onChange={(e) => { setReceiptsDateFrom(e.target.value); setReceiptsPage(1); }}
              className="border p-2 rounded"
              placeholder="From"
            />
            <input
              type="date"
              value={receiptsDateTo}
              onChange={(e) => { setReceiptsDateTo(e.target.value); setReceiptsPage(1); }}
              className="border p-2 rounded"
              placeholder="To"
            />
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 border rounded"
                onClick={() => { setReceiptsSearchWorker(""); setReceiptsSearchCustomer(""); setReceiptsDateFrom(""); setReceiptsDateTo(""); setReceiptsPage(1); }}
              >Clear</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-secondary">
                  <th className="p-2">Receipt #</th>
                  <th className="p-2">Worker</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Items</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">When</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReceipts.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-100 transition">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2">{r.worker_name}</td>
                    <td className="p-2">{r.customer_name || 'N/A'}</td>
                    <td className="p-2">{r.items_count}</td>
                    <td className="p-2">Rs. {Number(r.total_amount).toFixed(2)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs inline-block ${receiptStatusClasses(r.payment_status)}`}>
                        {r.payment_status}
                      </span>
                    </td>
                    <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="p-2">
                      <select
                        className="px-2 py-1 border rounded mr-2 text-sm"
                        value={r.payment_status}
                        onChange={(e) => updateReceiptStatus(r.id, e.target.value)}
                      >
                        <option value="paid">paid</option>
                        <option value="pending">pending</option>
                        <option value="all product got removed">all product got removed</option>
                      </select>
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded mr-2"
                        onClick={async () => {
                          try {
                            const token = localStorage.getItem('token');
                            const res = await axios.get(`${api}/sales/receipts/${r.id}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            setActiveReceipt(res.data);
                            setShowReceiptView(true);
                          } catch {}
                        }}
                      >
                        View/Print
                      </button>
                      <button
                        className="px-3 py-1 bg-red-600 text-white rounded"
                        onClick={() => handleDeleteReceipt(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-3">
            <div className="text-sm text-gray-600">
              Showing {filteredReceipts.length === 0 ? 0 : receiptsStart + 1}–{Math.min(filteredReceipts.length, receiptsStart + receiptsPerPage)} of {filteredReceipts.length}
            </div>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => changeReceiptsPage(1)}
                disabled={receiptsPage === 1}
              >First</button>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => changeReceiptsPage(receiptsPage - 1)}
                disabled={receiptsPage === 1}
              >Prev</button>
              <div className="px-2 py-1">Page {receiptsPage} / {receiptsTotalPages}</div>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => changeReceiptsPage(receiptsPage + 1)}
                disabled={receiptsPage === receiptsTotalPages}
              >Next</button>
              <button
                className="px-3 py-1 border rounded disabled:opacity-50"
                onClick={() => changeReceiptsPage(receiptsTotalPages)}
                disabled={receiptsPage === receiptsTotalPages}
              >Last</button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 text-primary">
              Add — {selectedProduct.name}
            </h3>

            <div className="grid gap-3">
              <label className="text-sm">
                Quantity (Available: {selectedProduct.quantity})
              </label>
              <input
                type="number"
                className="border p-2 rounded"
                value={quickQty}
                min={1}
                max={selectedProduct.quantity}
                onChange={(e) =>
                  setQuickQty(Math.max(1, Number(e.target.value)))
                }
              />

              <label className="text-sm">Price (Rs.)</label>
              <input
                type="number"
                className="border p-2 rounded"
                value={quickPrice}
                onChange={(e) => setQuickPrice(Number(e.target.value))}
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={addToCartFromQuick}
                className="bg-primary text-secondary px-4 py-2 rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-3 text-primary">
              Confirm Checkout
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Worker</label>
                <select
                  value={selectedWorkerId ?? ''}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select worker</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-primary"
                >
                  <option value="paid">Paid Now</option>
                  <option value="pending">Pay Later</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name (Required)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-primary"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Phone (Optional)
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-primary"
                  placeholder="Enter customer phone"
                />
              </div>

              <div className="bg-gray-50 p-3 rounded">
                <div className="flex justify-between text-sm">
                  <span>Total Items:</span>
                  <span className="font-semibold">{cart.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Amount:</span>
                  <span className="font-semibold text-primary">
                    Rs. {cart.reduce((s, c) => s + c.quantity * c.sold_price, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCheckout(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={checkout}
                className="bg-primary text-secondary px-4 py-2 rounded hover:bg-opacity-90"
              >
                Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt View / Print Modal */}
      {showReceiptView && activeReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-sm">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">Receipt #{activeReceipt.id}</h4>
              <button onClick={() => setShowReceiptView(false)} className="text-red-600">✕</button>
            </div>
            <div className="text-sm">
              <div>Worker: <b>{activeReceipt.worker_name}</b></div>
              <div>Customer: <b>{activeReceipt.customer_name || 'N/A'}</b></div>
              <div>Date: {new Date(activeReceipt.created_at).toLocaleString()}</div>
              <div className="my-2 border-t" />
              <div className="max-h-72 overflow-auto">
                {activeReceipt.items?.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <div className="pr-2 flex-1">{it.product_name} × {it.quantity}</div>
                    <div>Rs. {(Number(it.sold_price) * Number(it.quantity)).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="my-2 border-t" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>Rs. {Number(activeReceipt.total_amount).toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button className="px-3 py-1 border rounded" onClick={() => setShowReceiptView(false)}>Close</button>
              <button className="px-3 py-1 bg-primary text-secondary rounded" onClick={() => printThermalReceipt(activeReceipt)}>Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Thermal receipt print template sized for ~A7 width (74mm)
function printThermalReceipt(receipt) {
  const widthMm = 74; // adjust to your printer paper width
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${widthMm}mm auto; margin: 0; }
    body { margin: 0; font-family: Arial, sans-serif; }
    .ticket { width: ${widthMm}mm; padding: 6mm 4mm; box-sizing: border-box; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; font-size: 12px; }
    .title { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
    .muted { color: #555; font-size: 11px; }
    .line { border-top: 1px dashed #333; margin: 6px 0; }
    .item { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center title">Sales Receipt #${receipt.id}</div>
    <div class="center muted">${new Date(receipt.created_at).toLocaleString()}</div>
    <div class="line"></div>
    <div class="row"><div>Worker</div><div><b>${receipt.worker_name || ''}</b></div></div>
    <div class="row"><div>Customer</div><div><b>${receipt.customer_name || 'N/A'}</b></div></div>
    <div class="line"></div>
    ${(receipt.items || []).map(it => {
      const total = (Number(it.quantity) * Number(it.sold_price)).toFixed(2);
      return `<div class="item"><div>${it.product_name} × ${it.quantity}</div><div>Rs. ${total}</div></div>`;
    }).join('')}
    <div class="line"></div>
    <div class="row" style="font-weight:700"><div>Total</div><div>Rs. ${Number(receipt.total_amount).toFixed(2)}</div></div>
    <div class="center muted" style="margin-top:8px;">Thanks for your purchase!</div>
  </div>
  <script>
    window.addEventListener('load', () => setTimeout(() => window.print(), 100));
  </script>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export default Sales;
