import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { FaPlus, FaFilePdf, FaTimes } from "react-icons/fa";

const Products = () => {
  const api = import.meta.env.VITE_API_URL;
  const [tab, setTab] = useState("products"); // products | vendors | receipts

  // products
  const [products, setProducts] = useState([]);
  const [searchProd, setSearchProd] = useState("");

  // vendors
  const [vendors, setVendors] = useState([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    phone: "",
    contact: "",
    address: "",
  });

  // receipts
  const [receipts, setReceipts] = useState([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    vendor_id: "",
    invoice_no: "",
    items: [],
  });

  // product add modal (manual)
  const [showProductModal, setShowProductModal] = useState(false);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    retail_price: "",
    sell_price: "",
    quantity: 0,
  });

  const receiptPrintRef = useRef();

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadProducts(), loadVendors(), loadReceipts()]);
  }

  async function loadProducts() {
    try {
      const res = await axios.get(`${api}/products`);
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadVendors() {
    try {
      const res = await axios.get(`${api}/vendors`);
      setVendors(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadReceipts() {
    try {
      const res = await axios.get(`${api}/receipts`);
      setReceipts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  // ---------------- Vendor ----------------
  async function addVendor(e) {
    e.preventDefault();
    try {
      await axios.post(`${api}/vendors`, vendorForm);
      setShowVendorModal(false);
      setVendorForm({ name: "", phone: "", contact: "", address: "" });
      loadVendors();
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteVendor(id) {
    if (!confirm("Remove vendor?")) return;
    try {
      await axios.delete(`${api}/vendors/${id}`);
      loadVendors();
    } catch (err) {
      console.error(err);
    }
  }

  // ---------------- Products ----------------
  async function addProductManual(e) {
    e.preventDefault();
    try {
      await axios.post(`${api}/products`, productForm);
      setShowProductModal(false);
      setProductForm({
        name: "",
        description: "",
        retail_price: "",
        sell_price: "",
        quantity: 0,
      });
      loadProducts();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error adding product");
    }
  }

  // ---------------- Receipts ----------------
  function openReceiptModal() {
    setReceiptForm({
      vendor_id: vendors.length ? vendors[0].id : "",
      invoice_no: "",
      items: [],
    });
    setShowReceiptModal(true);
  }

  function addReceiptItemRow() {
    setReceiptForm((r) => ({
      ...r,
      items: [
        ...r.items,
        {
          product_id: "",
          name: "",
          description: "",
          cost_price: 0,
          sell_price: 0,
          quantity: 1,
        },
      ],
    }));
  }

  function removeReceiptItemRow(idx) {
    setReceiptForm((r) => {
      const copy = [...r.items];
      copy.splice(idx, 1);
      return { ...r, items: copy };
    });
  }

  function updateReceiptItem(idx, field, value) {
    setReceiptForm((r) => {
      const next = { ...r, items: [...r.items] };

      if (field === "product_id") {
        const prod = products.find((p) => p.id === parseInt(value));
        if (prod) {
          next.items[idx] = {
            ...next.items[idx],
            product_id: prod.id,
            name: prod.name,
            description: prod.description,
            cost_price: prod.retail_price,
            sell_price: prod.sell_price,
          };
        } else {
          next.items[idx] = { ...next.items[idx], product_id: value };
        }
      } else {
        next.items[idx] = { ...next.items[idx], [field]: value };
      }

      return next;
    });
  }

  async function submitReceipt(e) {
    e.preventDefault();
    try {
      if (!receiptForm.vendor_id) {
        alert("Select vendor");
        return;
      }
      if (!receiptForm.items.length) {
        alert("Add at least one item");
        return;
      }

      const payload = {
        vendor_id: receiptForm.vendor_id,
        invoice_no: receiptForm.invoice_no || null,
        items: receiptForm.items.map((it) => {
          const prod = products.find((p) => p.id === parseInt(it.product_id));
          return {
            product_id: prod ? prod.id : null,
            name: prod ? prod.name : it.name, // always has a name
            description: prod ? prod.description : it.description,
            cost_price: parseFloat(it.cost_price || (prod?.retail_price ?? 0)),
            sell_price: parseFloat(it.sell_price || (prod?.sell_price ?? 0)),
            quantity: parseInt(it.quantity || 0, 10),
          };
        }),
      };

      await axios.post(`${api}/receipts`, payload);
      setShowReceiptModal(false);
      loadProducts();
      loadReceipts();
      alert("Receipt created");
    } catch (err) {
      console.error("Receipt error:", err);
      alert(err.response?.data?.message || "Error creating receipt");
    }
  }

  async function viewReceipt(r) {
    try {
      const res = await axios.get(`${api}/receipts/${r.id}`);
      const receipt = res.data;

      let itemsText = receipt.items
        .map(
          (it, i) =>
            `${i + 1}. ${it.product_name || it.name} - Qty: ${
              it.quantity
            }, Cost: Rs.${it.cost_price}, Sell: Rs.${it.sell_price}`
        )
        .join("\n");

      alert(`
    Vendor: ${receipt.vendor_name}
    Invoice: ${receipt.invoice_no || "-"}
    Items:
    ${itemsText}

    Total: Rs. ${Number(receipt.total_amount).toFixed(2)}
    Date: ${new Date(receipt.created_at).toLocaleString()}
    `);
    } catch (err) {
      console.error(err);
      alert("Failed to load receipt");
    }
  }

  async function downloadReceipt(r) {
    try {
      const res = await axios.get(`${api}/receipts/${r.id}`);
      const receipt = res.data;

      let itemsText = receipt.items
        .map(
          (it, i) =>
            `${i + 1}. ${it.product_name || it.name} - Qty: ${
              it.quantity
            }, Cost: Rs.${it.cost_price}, Sell: Rs.${it.sell_price}`
        )
        .join("\n");

      const content = `
Receipt #${receipt.id}

Vendor: ${receipt.vendor_name}
Invoice: ${receipt.invoice_no || "-"}
Items:
${itemsText}

Total: Rs. ${Number(receipt.total_amount).toFixed(2)}
Date: ${new Date(receipt.created_at).toLocaleString()}
    `;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receipt.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download receipt");
    }
  }

  // ---------------- UI helpers ----------------
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="h-screen w-full p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-primary">
            Products & Receipts
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowProductModal(true)}
              className="bg-primary text-secondary px-4 py-2 rounded-lg shadow hover:opacity-90 transition"
            >
              + Product
            </button>
            <button
              onClick={() => setShowVendorModal(true)}
              className="bg-secondary text-primary px-4 py-2 rounded-lg shadow hover:opacity-90 transition"
            >
              + Vendor
            </button>
            <button
              onClick={openReceiptModal}
              className="bg-primary text-secondary px-4 py-2 rounded-lg shadow hover:opacity-90 transition"
            >
              + Receipt
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-4">
          {["products", "vendors", "receipts"].map((t) => (
            <button
              key={t}
              className={`px-5 py-2 rounded-lg shadow-sm font-medium transition ${
                tab === t
                  ? "bg-primary text-secondary"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "products" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <input
                placeholder="Search products..."
                className="border p-2 rounded-lg flex-1"
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-primary text-secondary text-left">
                    <th className="p-3">ID</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Retail</th>
                    <th className="p-3">Sell</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{p.id}</td>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td
                        className={`p-3 ${
                          p.quantity <= 0
                            ? "text-red-600 font-semibold"
                            : "text-green-600"
                        }`}
                      >
                        {p.quantity <= 0 ? "Out of stock" : p.quantity}
                      </td>
                      <td className="p-3">
                        Rs. {Number(p.retail_price).toFixed(2)}
                      </td>
                      <td className="p-3 font-semibold">
                        Rs. {Number(p.sell_price).toFixed(2)}
                      </td>
                      <td className="p-3">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "vendors" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary text-secondary text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{v.id}</td>
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3">{v.phone}</td>
                    <td className="p-3">{v.contact}</td>
                    <td className="p-3">
                      <button
                        onClick={() => deleteVendor(v.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:opacity-90"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Receipts Table */}
        {tab === "receipts" && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary text-secondary text-left">
                  <th className="p-3">ID</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Invoice</th>
                  <th className="p-3">Items</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{r.id}</td>
                    <td className="p-3 font-medium">{r.vendor_name}</td>
                    <td className="p-3">{r.invoice_no || "-"}</td>
                    <td className="p-3">{r.items_count} items</td>
                    <td className="p-3">
                      Rs. {Number(r.total_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 flex gap-2">
                      <button
                        onClick={() => viewReceipt(r)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:opacity-90"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadReceipt(r)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:opacity-90"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <form
            onSubmit={addVendor}
            className="bg-white p-6 rounded-xl shadow w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={() => setShowVendorModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <FaTimes />
            </button>
            <h3 className="text-lg font-semibold mb-3">Add Vendor</h3>
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Name"
              value={vendorForm.name}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, name: e.target.value })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Phone"
              value={vendorForm.phone}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, phone: e.target.value })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Contact"
              value={vendorForm.contact}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, contact: e.target.value })
              }
            />
            <textarea
              className="border p-2 rounded w-full mb-2"
              placeholder="Address"
              value={vendorForm.address}
              onChange={(e) =>
                setVendorForm({ ...vendorForm, address: e.target.value })
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-secondary rounded"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <form
            onSubmit={addProductManual}
            className="bg-white p-6 rounded-xl shadow w-full max-w-md relative"
          >
            <button
              type="button"
              onClick={() => setShowProductModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <FaTimes />
            </button>
            <h3 className="text-lg font-semibold mb-3">Add Product</h3>
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Name"
              value={productForm.name}
              onChange={(e) =>
                setProductForm({ ...productForm, name: e.target.value })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Description"
              value={productForm.description}
              onChange={(e) =>
                setProductForm({ ...productForm, description: e.target.value })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Cost / Retail Price"
              value={productForm.retail_price}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  retail_price: e.target.value,
                })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Sell Price"
              value={productForm.sell_price}
              onChange={(e) =>
                setProductForm({ ...productForm, sell_price: e.target.value })
              }
            />
            <input
              className="border p-2 rounded w-full mb-2"
              placeholder="Quantity"
              type="number"
              value={productForm.quantity}
              onChange={(e) =>
                setProductForm({ ...productForm, quantity: e.target.value })
              }
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-secondary rounded"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-center z-50 overflow-auto py-10">
          <form
            onSubmit={submitReceipt}
            className="bg-white p-6 rounded-xl shadow w-full max-w-4xl relative max-h-screen overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500"
            >
              <FaTimes />
            </button>
            <h3 className="text-lg font-semibold mb-4">Add Receipt</h3>

            {/* Vendor + Invoice */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor</label>
                <select
                  className="border p-2 rounded w-full"
                  value={receiptForm.vendor_id}
                  onChange={(e) =>
                    setReceiptForm({
                      ...receiptForm,
                      vendor_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Invoice No
                </label>
                <input
                  className="border p-2 rounded w-full"
                  placeholder="Invoice No (optional)"
                  value={receiptForm.invoice_no}
                  onChange={(e) =>
                    setReceiptForm({
                      ...receiptForm,
                      invoice_no: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Items */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="font-medium">Items</div>
                <button
                  type="button"
                  onClick={addReceiptItemRow}
                  className="px-3 py-1 bg-primary text-secondary rounded flex items-center gap-1"
                >
                  <FaPlus /> Add Item
                </button>
              </div>

              <div className="space-y-4">
                {receiptForm.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="border p-4 rounded-lg bg-gray-50 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeReceiptItemRow(idx)}
                      className="absolute top-3 right-3 text-red-500 hover:text-red-700"
                    >
                      <FaTimes />
                    </button>

                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-sm block mb-1">Product</label>
                        <select
                          value={it.product_id || ""}
                          onChange={(e) =>
                            updateReceiptItem(idx, "product_id", e.target.value)
                          }
                          className="border p-2 rounded w-full"
                        >
                          <option value="">-- Select product --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (stock: {p.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm block mb-1">Cost Price</label>
                        <input
                          className="border p-2 rounded w-full"
                          placeholder="Cost"
                          value={it.cost_price}
                          onChange={(e) =>
                            updateReceiptItem(idx, "cost_price", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm block mb-1">Sell Price</label>
                        <input
                          className="border p-2 rounded w-full"
                          placeholder="Sell Price"
                          value={it.sell_price}
                          onChange={(e) =>
                            updateReceiptItem(idx, "sell_price", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm block mb-1">Quantity</label>
                        <input
                          className="border p-2 rounded w-full"
                          type="number"
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) =>
                            updateReceiptItem(idx, "quantity", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm block mb-1">
                          Product Name (if new)
                        </label>
                        <input
                          className="border p-2 rounded w-full"
                          value={it.name}
                          onChange={(e) =>
                            updateReceiptItem(idx, "name", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm block mb-1">
                          Description
                        </label>
                        <input
                          className="border p-2 rounded w-full"
                          value={it.description}
                          onChange={(e) =>
                            updateReceiptItem(
                              idx,
                              "description",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-secondary rounded"
              >
                Save Receipt
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Products;
