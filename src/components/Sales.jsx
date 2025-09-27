import { useEffect, useState } from "react";
import axios from "axios";

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

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    loadProducts();
    loadWorkers();
    loadSales();
  }, []);

  async function loadProducts() {
    try {
      const res = await axios.get(`${api}/products`);
      setProducts(res.data || []);
    } catch {
      setPopup("❌ Error loading products");
    }
  }

  async function loadWorkers() {
    try {
      const res = await axios.get(`${api}/workers`);
      setWorkers(res.data || []);
    } catch {
      setPopup("❌ Error loading workers");
    }
  }

  async function loadSales(page = 1) {
    try {
      const res = await axios.get(
        `${api}/sales?page=${page}&limit=${salesPerPage}`
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
    setQuickWorkerId(workers.length ? workers[0].id : null);
    setShowQuickAdd(true);
  }

  function addToCartFromQuick() {
    if (!selectedProduct || !quickWorkerId || quickQty <= 0) {
      setPopup("⚠️ Please select worker and valid quantity");
      return;
    }
    const worker = workers.find((w) => w.id === Number(quickWorkerId));
    const existing = cart.find(
      (c) =>
        c.product_id === selectedProduct.id &&
        c.worker_id === Number(quickWorkerId) &&
        c.sold_price === Number(quickPrice)
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
          worker_id: Number(quickWorkerId),
          worker_name: worker ? worker.name : "",
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
          field === "worker_id"
            ? Number(value)
            : field === "quantity"
            ? Number(value)
            : value,
      };
      if (field === "worker_id") {
        const w = workers.find((x) => x.id === Number(value));
        if (w) next[index].worker_name = w.name;
      }
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
    const items = cart.map((c) => ({
      product_id: c.product_id,
      worker_id: c.worker_id,
      quantity: c.quantity,
      sold_price: c.sold_price,
    }));

    try {
      const res = await axios.post(`${api}/sales`, { items });
      setPopup("✅ Sales recorded");
      setCart([]);
      setShowCheckout(false);
      loadProducts();
      loadSales(salesPage);
    } catch (err) {
      setPopup("❌ Error during checkout");
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-screen w-full p-10">
      <div className="w-full mx-auto bg-white p-8 rounded-xl shadow-lg border">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-primary">Sales POS</h1>
          <div className="flex gap-3 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              className="w-72 border p-2 rounded-lg focus:ring-2 focus:ring-primary"
            />
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
                    <select
                      value={c.worker_id}
                      onChange={(e) =>
                        updateCartRow(idx, "worker_id", e.target.value)
                      }
                      className="flex-1 border p-1 rounded"
                    >
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
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

        {/* Recent sales */}
        <div className="mt-10">
          <h3 className="text-xl font-semibold text-primary mb-4">
            Recent Sales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-primary text-secondary">
                  <th className="p-2">ID</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Worker</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Sold Price</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">When</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-gray-100 transition"
                  >
                    <td className="p-2">{s.id}</td>
                    <td className="p-2">{s.product_name}</td>
                    <td className="p-2">{s.worker_name}</td>
                    <td className="p-2">{s.quantity}</td>
                    <td className="p-2">
                      Rs. {Number(s.sold_price).toFixed(2)}
                    </td>
                    <td className="p-2">
                      Rs. {Number(s.total_amount).toFixed(2)}
                    </td>
                    <td className="p-2">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div>
              <button
                onClick={() => {
                  const p = Math.max(1, salesPage - 1);
                  setSalesPage(p);
                  loadSales(p);
                }}
                className="px-3 py-1 border rounded mr-2"
              >
                Prev
              </button>
              <button
                onClick={() => {
                  const p = salesPage + 1;
                  setSalesPage(p);
                  loadSales(p);
                }}
                className="px-3 py-1 border rounded"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Showing page {salesPage}
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
              <label className="text-sm">Worker</label>
              <select
                className="border p-2 rounded"
                value={quickWorkerId ?? ""}
                onChange={(e) => setQuickWorkerId(e.target.value)}
              >
                <option value="">Select worker</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

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
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 text-primary">
              Confirm Checkout
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to record <strong>{cart.length}</strong>{" "}
              sale(s)?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCheckout(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={checkout}
                className="bg-primary text-secondary px-4 py-2 rounded"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
