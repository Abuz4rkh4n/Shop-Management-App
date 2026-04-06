import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";

const Sales = ({ onSaleCompleted }) => {
  const [products, setProducts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchId, setSearchId] = useState("");
  const [popup, setPopup] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCustomAdd, setShowCustomAdd] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Pagination for products
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [quickQty, setQuickQty] = useState(1);
  const [quickPrice, setQuickPrice] = useState("");
  const [quickWorkerId, setQuickWorkerId] = useState(null);

  const [customName, setCustomName] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customCost, setCustomCost] = useState("");
  const [customPrice, setCustomPrice] = useState("");

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

  // Day management state
  const [currentDay, setCurrentDay] = useState(null);

  // barcode scan
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [scannedProduct, setScannedProduct] = useState(null); // Store scanned product for Quick Add
  const hiddenInputRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  const api = import.meta.env.VITE_API_URL;
  const { updateSalePaymentStatus } = useAuth();

  useEffect(() => {
    loadProducts();
    loadWorkers();
    loadSales();
    loadSalesReceipts();
    checkCurrentDay();
  }, []);

  // Check if day is open
  async function checkCurrentDay() {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${api}/day-management/current`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentDay(res.data);
    } catch (error) {
      setCurrentDay(null);
    }
  }

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
    if (status === 'hold') return 'bg-orange-100 text-orange-700 border border-orange-200';
    if (status === 'refunded') return 'bg-gray-100 text-gray-600 border border-gray-300';
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
      )
      setSales(res.data || []);
    }catch {
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
    const productToAdd = selectedProduct;
    
    if (!productToAdd || quickQty <= 0) {
      setPopup("⚠️ Enter valid quantity");
      return;
    }
    const existing = cart.find(
      (c) => c.product_id === productToAdd.id && c.sold_price === Number(quickPrice)
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
          product_id: productToAdd.id,
          product_name: productToAdd.name,
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

  function addCustomItem() {
    const name = (customName || '').trim();
    const qty = Number(customQty);
    const cost = Number(customCost);
    const price = Number(customPrice);
    if (!name) {
      setPopup("⚠️ Enter item name");
      return;
    }
    if (!(qty > 0)) {
      setPopup("⚠️ Enter valid quantity");
      return;
    }
    if (!(cost >= 0)) {
      setPopup("⚠️ Enter valid cost");
      return;
    }
    if (!(price > 0)) {
      setPopup("⚠️ Enter valid price");
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        is_custom: true,
        product_id: null,
        product_name: name,
        quantity: qty,
        sold_price: price,
        custom_cost_price: cost,
      },
    ]);
    setShowCustomAdd(false);
    setCustomName("");
    setCustomQty(1);
    setCustomCost("");
    setCustomPrice("");
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
    if (!currentDay) {
      setPopup("⚠️ Please open a day first before making sales");
      return;
    }
    const items = cart.map((c) => (
      c.is_custom
        ? { custom_name: c.product_name, custom_cost_price: c.custom_cost_price ?? 0, quantity: c.quantity, sold_price: c.sold_price }
        : { product_id: c.product_id, quantity: c.quantity, sold_price: c.sold_price }
    ));

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
      // Refresh all data
      await Promise.all([
        loadProducts(),
        loadSales(salesPage),
        loadSalesReceipts()
      ]);
      // Notify app to refresh dashboard
      if (onSaleCompleted) onSaleCompleted();
      // Open receipt view for printing
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

  // Handle barcode scanning from input field
  function handleBarcodeScan(e) {
    const value = e.target.value;
    setBarcodeBuffer(value);
    
    // Check if Enter key is pressed (complete barcode submission)
    if (e.key === 'Enter') {
      const completeBarcode = value.trim();
      if (completeBarcode.length >= 8) { // Minimum barcode length
        e.preventDefault(); // Prevent form submission
        setBarcodeBuffer(""); // Clear input immediately
        searchAndAddProductByBarcode(completeBarcode);
      }
    }
  }

  // Search for product by barcode and automatically add to cart
  async function searchAndAddProductByBarcode(code) {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Searching for barcode:', code);
      setPopup('🔍 Searching for product...');
      
      const res = await axios.get(`${api}/products/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const p = res.data;
      console.log('✅ Found product:', p);
      
      if (!p) {
        setPopup("❌ Product not found");
        return;
      }
      
      if (p.quantity <= 0) {
        setPopup("⚠️ Product out of stock");
        return;
      }
      
      // Automatically add to cart
      const newItem = {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        sold_price: Number(p.sell_price),
      };
      
      console.log('🆕 Adding item to cart:', newItem);
      
      setCart((prev) => {
        const existing = prev.find((c) => c.product_id === p.id && c.sold_price === Number(p.sell_price));
        
        if (existing) {
          const nextQty = existing.quantity + 1;
          if (nextQty > Number(p.quantity)) {
            setPopup("⚠️ Not enough stock to add more of this product");
            return prev;
          }
          const updatedCart = prev.map((c) => c === existing ? { ...c, quantity: nextQty } : c);
          setPopup(`✅ Added another ${p.name} to cart`);
          return updatedCart;
        }
        
        const newCart = [...prev, newItem];
        setPopup(`✅ ${p.name} added to cart`);
        return newCart;
      });
      
      // Flash the cart to draw attention
      const cartElement = document.getElementById('cart-section');
      if (cartElement) {
        cartElement.classList.add('ring-2', 'ring-green-500', 'ring-opacity-75');
        setTimeout(() => {
          cartElement.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-75');
        }, 1000);
      }
      
    } catch (err) {
      console.error('❌ Error searching product:', err);
      if (err.response?.status === 404) {
        setPopup(`❌ Product not found: ${code}`);
      } else if (err.response?.status === 401) {
        setPopup(`❌ Authentication error. Please log in again.`);
      } else {
        setPopup(`❌ Error searching product: ${code}`);
      }
    }
  }

  // barcode: listen to key events when enabled (global scanner fallback)
  useEffect(() => {
    if (!scannerEnabled) return;
    const handler = (e) => {
      // Don't handle global barcode events if the input field is focused
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement?.type === 'text') {
        return;
      }
      
      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        // Only build buffer, don't auto-submit
        setBarcodeBuffer((prev) => {
          const next = (prev + key).slice(0, 32); // Max 32 chars
          return next;
        });
      } else if (key === 'Enter') {
        // On Enter, search for product
        const code = (barcodeBuffer || "").trim();
        setBarcodeBuffer("");
        if (code && code.length >= 8) {
          searchAndAddProductByBarcode(code);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [scannerEnabled, barcodeBuffer]);

  // Search for product by code (barcode or ID)
  async function searchProductByCode(code) {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Searching for barcode:', code); // Debug log
      const res = await axios.get(`${api}/products/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const p = res.data;
      console.log('✅ Found product:', p); // Debug log
      
      if (!p || p.quantity <= 0) {
        setPopup("⚠️ Product not found or out of stock");
        return;
      }
      
      // Show product found message instead of adding to cart
      setPopup(`📦 Found: ${p.name} - Click "Quick Add" to add to cart`);
      setScannedProduct(p); // Store scanned product for Quick Add button
      
    } catch (err) {
      console.error('❌ Error searching product:', err);
      setPopup(`❌ Error finding product: ${err.message}`);
    }
  }

  async function addProductByBarcode(code) {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Searching for barcode:', code); // Debug log
      const res = await axios.get(`${api}/products/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const p = res.data;
      console.log('✅ Found product:', p); // Debug log
      
      if (!p || p.quantity <= 0) {
        setPopup("⚠️ Product not found or out of stock");
        return;
      }
      
      // Force cart update with timeout to ensure state change
      const newItem = {
        product_id: p.id,
        product_name: p.name,
        quantity: 1,
        sold_price: Number(p.sell_price),
      };
      
      console.log('🆕 Adding new item to cart:', newItem); // Debug log
      
      setCart((prev) => {
        const existing = prev.find((c) => c.product_id === p.id && c.sold_price === Number(p.sell_price));
        console.log('🔍 Existing item check:', existing); // Debug log
        
        if (existing) {
          const nextQty = existing.quantity + 1;
          if (nextQty > Number(p.quantity)) {
            setPopup("⚠️ Not enough stock to add more of this product");
            return prev;
          }
          console.log('📦 Updating existing item quantity to:', nextQty); // Debug log
          const updatedCart = prev.map((c) => c === existing ? { ...c, quantity: nextQty } : c);
          console.log('✅ Product automatically added to cart (existing item updated):', p.name);
          return updatedCart;
        }
        
        const newCart = [...prev, newItem];
        console.log('✅ Product automatically added to cart (new item):', p.name); // Debug log
        console.log('🛒 New cart state:', newCart); // Debug log
        return newCart;
      });
      
      // Force popup after state update
      setTimeout(() => {
        setPopup(`✅ Auto-added: ${p.name}`);
      }, 100);
      
      // Flash the cart to draw attention
      const cartElement = document.getElementById('cart-section');
      if (cartElement) {
        cartElement.classList.add('ring-2', 'ring-green-500', 'ring-opacity-75');
        setTimeout(() => {
          cartElement.classList.remove('ring-2', 'ring-green-500', 'ring-opacity-75');
        }, 1000);
      }
    } catch (err) {
      console.error('❌ Error adding product to cart:', err);
      setPopup(`❌ Error adding product: ${err.message}`);
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    // Search by both ID and barcode field for better barcode support
    const matchesId = searchId ? (
      p.id.toString().includes(searchId) || 
      (p.barcode && p.barcode.toString().includes(searchId))
    ) : true;
    return matchesSearch && matchesId;
  });
  
  // Pagination logic for products
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
  
  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, searchId]);
  
  // Pagination controls
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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
            {/* Day Status Indicator */}
            <div className="flex items-center gap-2">
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
            <button
              onClick={() => setScannerEnabled((v) => !v)}
              className={`px-4 py-2 rounded-lg font-semibold border ${scannerEnabled ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {scannerEnabled ? 'Scanner: On' : 'Scanner: Off'}
            </button>
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
              onClick={() => setShowCustomAdd(true)}
              className="px-5 py-2 rounded-lg font-semibold border bg-white hover:bg-gray-50 transition"
            >
              + Custom Item
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
            {/* Search and Pagination Controls */}
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="input input-bordered flex-1"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Search by ID..."
                  className="input input-bordered w-1/2"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
              </div>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border p-2 rounded-lg"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
            
            {/* Product List */}
            <div className="h-[400px] overflow-y-scroll">
              <div className="grid gap-3">
                {paginatedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center border rounded-lg p-3 hover:shadow-md transition bg-gray-50"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">{p.name} <span className="text-xs font-semibold">(ID: {p.id})</span></div>
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
                      onClick={() => openQuickAdd(p)}
                      disabled={p.quantity <= 0}
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
                {paginatedProducts.length === 0 && (
                  <div className="p-4 text-center text-gray-500">
                    {filteredProducts.length === 0 ? "No products found" : "No products on this page"}
                  </div>
                )}
              </div>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {paginatedProducts.length} of {filteredProducts.length} products (Page {currentPage} of {totalPages})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-1 border rounded ${
                            currentPage === pageNum
                              ? 'bg-primary text-secondary'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Cart - Modernized */}
          <div id="cart-section" className="col-span-1 border rounded-xl p-4 bg-gradient-to-br from-gray-50 to-gray-100 shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Cart
                {cart.length > 0 && (
                  <span className="bg-primary text-secondary text-xs px-2 py-1 rounded-full font-bold">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </h3>
              {scannerEnabled && (
                <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Scanner Active
                </div>
              )}
            </div>
            
            {/* Barcode Scanner Input */}
            {scannerEnabled && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-3 py-2 rounded-lg mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Scanner Active - Scan barcode to add product
                </div>
                <input
                  type="text"
                  placeholder="📷 Scan barcode here..."
                  className="w-full border-2 border-green-300 rounded-lg px-3 py-2 text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={barcodeBuffer}
                  onChange={(e) => setBarcodeBuffer(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  autoFocus
                />
                {barcodeBuffer && (
                  <div className="mt-1 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                    Scanning: <span className="font-mono font-bold text-blue-700">{barcodeBuffer}</span>
                  </div>
                )}
              </div>
            )}
            <div className="max-h-80 overflow-auto space-y-2">
              {cart.map((c, idx) => (
                <div
                  key={idx}
                  className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 hover:border-primary"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-gray-800 text-sm flex-1">
                      {c.product_name}
                    </div>
                    <div className="text-primary font-bold text-sm">
                      Rs. {c.sold_price * c.quantity}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const newQty = Math.max(1, c.quantity - 1);
                          updateCartRow(idx, "quantity", newQty);
                        }}
                        className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="w-12 border p-1 rounded text-center text-sm"
                        value={c.quantity}
                        onChange={(e) =>
                          updateCartRow(
                            idx,
                            "quantity",
                            Math.max(1, Number(e.target.value))
                          )
                        }
                      />
                      <button
                        onClick={() => {
                          const newQty = c.quantity + 1;
                          updateCartRow(idx, "quantity", newQty);
                        }}
                        className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <input
                      type="number"
                      className="w-20 border p-1 rounded text-sm"
                      value={c.sold_price}
                      onChange={(e) =>
                        updateCartRow(idx, "sold_price", Number(e.target.value))
                      }
                    />
                    <button
                      onClick={() => removeCartRow(idx)}
                      className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs mt-1">Scan or add items to get started</p>
                </div>
              )}
            </div>

            {/* Total - Modernized */}
            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Total</span>
                  <span className="text-xl font-bold text-primary">
                    Rs. {cart.reduce((s, c) => s + c.quantity * c.sold_price, 0).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full mt-3 bg-primary text-secondary py-3 rounded-lg font-semibold hover:bg-opacity-90 transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
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
                      {r.payment_status === 'refunded' ? (
                        <span className="px-2 py-1 border rounded mr-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed">
                          refunded (locked)
                        </span>
                      ) : (
                        <select
                          className="px-2 py-1 border rounded mr-2 text-sm"
                          value={r.payment_status}
                          onChange={(e) => updateReceiptStatus(r.id, e.target.value)}
                        >
                          <option value="paid">paid</option>
                          <option value="pending">pending</option>
                          <option value="hold">hold</option>
                          <option value="all product got removed">all product got removed</option>
                        </select>
                      )}
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

      {showCustomAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3 text-primary">Add Custom Item</h3>
            <div className="grid gap-3">
              <div>
                <label className="text-sm">Item Name</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm">Quantity</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={customQty}
                    min={1}
                    onChange={(e) => setCustomQty(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <label className="text-sm">Cost (Rs.)</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={customCost}
                    onChange={(e) => setCustomCost(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm">Sell Price (Rs.)</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(Number(e.target.value))}
                />
              </div>
              <div className="text-sm text-gray-600">
                Line Profit: Rs. {Math.max(0, Number(customPrice || 0) - Number(customCost || 0)) * Number(customQty || 0)}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCustomAdd(false)} className="px-4 py-2 border rounded">Cancel</button>
              <button onClick={addCustomItem} className="bg-primary text-secondary px-4 py-2 rounded">Add</button>
            </div>
          </div>
        </div>
      )
    }

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
                  <option value="hold">Hold</option>
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
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-lg text-primary">Sales Receipt #{activeReceipt.id}</h4>
              <button onClick={() => setShowReceiptView(false)} className="text-red-600 hover:text-red-800 text-xl font-bold">✕</button>
            </div>
            
            {/* Shop Header */}
            <div className="text-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-primary">Al Madina Shopping Centre</h3>
              <p className="text-sm text-gray-600">Churi Gali</p>
              <p className="text-sm font-semibold">Owner: Haji Murtaza</p>
              <p className="text-sm">Phone: 0332 7840742</p>
            </div>
            
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Worker:</span>
                <span className="font-semibold">{activeReceipt.worker_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold">{activeReceipt.customer_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-semibold">{new Date(activeReceipt.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`px-2 py-1 rounded text-xs ${receiptStatusClasses(activeReceipt.payment_status)}`}>
                  {activeReceipt.payment_status}
                </span>
              </div>
              <div className="border-t pt-2 mt-2"></div>
              <div className="max-h-64 overflow-auto">
                {activeReceipt.items?.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="font-medium">{it.product_name}</div>
                      <div className="text-xs text-gray-500">Rs. {it.sold_price} × {it.quantity}</div>
                    </div>
                    <div className="font-semibold text-right">
                      Rs. {(Number(it.sold_price) * Number(it.quantity)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2 mt-2"></div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span className="text-primary">Rs. {Number(activeReceipt.total_amount).toFixed(2)}</span>
              </div>
            </div>
            
            {/* Footer */}
            <div className="text-center mt-4 pt-3 border-t text-xs text-gray-500">
              <p>Thank you for your purchase!</p>
              <p className="mt-1">Al Madina Shopping Centre</p>
            </div>
            
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 border rounded hover:bg-gray-50" onClick={() => setShowReceiptView(false)}>Close</button>
              <button className="px-4 py-2 bg-primary text-secondary rounded hover:bg-opacity-90" onClick={() => printThermalReceipt(activeReceipt)}>Print Receipt</button>
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
    body { margin: 0; font-family: 'Courier New', monospace; }
    .ticket { width: ${widthMm}mm; padding: 8mm 5mm; box-sizing: border-box; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .title { font-weight: bold; font-size: 14px; margin-bottom: 4px; text-align: center; }
    .subtitle { font-size: 10px; text-align: center; margin-bottom: 6px; }
    .muted { color: #555; font-size: 9px; }
    .line { border-top: 1px dashed #333; margin: 4px 0; }
    .item { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .total { font-weight: bold; font-size: 12px; }
    .footer { text-align: center; font-size: 8px; margin-top: 6px; }
    .contact { font-size: 9px; text-align: center; margin: 2px 0; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="title">AL MADINA SHOPPING CENTRE</div>
    <div class="subtitle">CHURI GALI</div>
    <div class="subtitle">Owner: Haji Murtaza</div>
    <div class="contact">0332 7840742</div>
    <div class="contact">Huzaifa: 0319 0189227</div>
    <div class="contact">081 2827853</div>
    <div class="line"></div>
    <div class="center">SALES RECEIPT #${receipt.id}</div>
    <div class="center muted">${new Date(receipt.created_at).toLocaleString()}</div>
    <div class="line"></div>
    <div class="row"><div>Worker:</div><div>${receipt.worker_name || ''}</div></div>
    <div class="row"><div>Customer:</div><div>${receipt.customer_name || 'N/A'}</div></div>
    <div class="row"><div>Status:</div><div>${receipt.payment_status}</div></div>
    <div class="line"></div>
    ${(receipt.items || []).map(it => {
      const total = (Number(it.quantity) * Number(it.sold_price)).toFixed(2);
      const name = it.product_name.length > 20 ? it.product_name.substring(0, 20) + '...' : it.product_name;
      return `<div class="item"><div>${name} ×${it.quantity}</div><div>Rs.${total}</div></div>`;
    }).join('')}
    <div class="line"></div>
    <div class="row total"><div>TOTAL:</div><div>Rs.${Number(receipt.total_amount).toFixed(2)}</div></div>
    <div class="line"></div>
    <div class="footer">Thank you for shopping with us!</div>
    <div class="footer">Al Madina Shopping Centre</div>
    <div class="footer">Churi Gali</div>
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
