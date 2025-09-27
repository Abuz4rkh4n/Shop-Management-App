import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("DB connection failed:", err);
    return;
  }
  console.log("Connected to MySQL");
});

/* ------------------------
   PRODUCTS
   ------------------------ */

// Get all products
app.get("/products", (req, res) => {
  const sql = "SELECT * FROM products ORDER BY created_at DESC";
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// Add single product
app.post("/products", (req, res) => {
  const {
    name,
    description = "",
    retail_price = 0,
    sell_price = 0,
    quantity = 0,
  } = req.body;

  const sql =
    "INSERT INTO products (name, description, retail_price, sell_price, quantity) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [name, description, retail_price, sell_price, quantity],
    (err, result) => {
      if (err) {
        console.error("Error adding product:", err);
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "Product already exists" });
        }
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ message: "Product added", id: result.insertId });
    }
  );
});

// Restock product
app.put("/products/:id/restock", (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  const sql = "UPDATE products SET quantity = quantity + ? WHERE id = ?";
  db.query(sql, [quantity, id], (err) => {
    if (err) {
      console.error("Error restocking:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ message: "Product restocked" });
  });
});

// Delete product
app.delete("/products/:id", (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM products WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error deleting product:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ message: "Product deleted" });
  });
});

/* ------------------------
   VENDORS
   ------------------------ */

// List vendors
app.get("/vendors", (req, res) => {
  const sql = "SELECT * FROM vendors ORDER BY name";
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching vendors:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// Add vendor
app.post("/vendors", (req, res) => {
  const { name, contact = "", phone = "", address = "" } = req.body;

  const sql =
    "INSERT INTO vendors (name, contact, phone, address) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, contact, phone, address], (err, result) => {
    if (err) {
      console.error("Error adding vendor:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ message: "Vendor added", id: result.insertId });
  });
});

// Delete vendor
app.delete("/vendors/:id", (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM vendors WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error deleting vendor:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json({ message: "Vendor removed" });
  });
});

/* ------------------------
   RECEIPTS
   ------------------------ */

// Create receipt
app.post("/receipts", (req, res) => {
  const { vendor_id, invoice_no = null, items } = req.body;
  if (!vendor_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction start error:", err);
      return res.status(500).json({ message: "DB error" });
    }

    const sqlReceipt =
      "INSERT INTO receipts (vendor_id, invoice_no, total_amount) VALUES (?, ?, ?)";
    db.query(sqlReceipt, [vendor_id, invoice_no, 0], (err, result) => {
      if (err) {
        console.error("Error inserting receipt:", err);
        return db.rollback(() => res.status(500).json({ message: "DB error" }));
      }

      const receiptId = result.insertId;
      let totalAmount = 0;

      const processItems = (i) => {
        if (i >= items.length) {
          // Update receipt total
          db.query(
            "UPDATE receipts SET total_amount = ? WHERE id = ?",
            [totalAmount, receiptId],
            (err) => {
              if (err) {
                console.error("Error updating total:", err);
                return db.rollback(() =>
                  res.status(500).json({ message: "DB error" })
                );
              }
              db.commit((err) => {
                if (err) {
                  console.error("Commit error:", err);
                  return db.rollback(() =>
                    res.status(500).json({ message: "DB error" })
                  );
                }
                res.json({ message: "Receipt created", receiptId });
              });
            }
          );
          return;
        }

        const it = items[i];
        const name = (it.name || "").trim();
        const desc = it.description || "";
        const qty = parseInt(it.quantity || 0, 10);
        const cost_price = parseFloat(it.cost_price || it.retail_price || 0);
        const sell_price = parseFloat(it.sell_price || 0);

        if (!name || qty <= 0) {
          return db.rollback(() =>
            res.status(400).json({ message: "Invalid item in receipt" })
          );
        }

        const insertProduct = () => {
          db.query(
            "INSERT INTO products (name, description, retail_price, sell_price, quantity) VALUES (?, ?, ?, ?, ?)",
            [name, desc, cost_price, sell_price, qty],
            (err, prodRes) => {
              if (err) {
                console.error("Error inserting product:", err);
                return db.rollback(() =>
                  res.status(500).json({ message: "DB error" })
                );
              }
              const productId = prodRes.insertId;
              insertReceiptItem(productId);
            }
          );
        };

        const insertReceiptItem = (productId) => {
          db.query(
            `INSERT INTO receipt_items (receipt_id, product_id, product_name, quantity, cost_price, sell_price)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [receiptId, productId, name, qty, cost_price, sell_price],
            (err) => {
              if (err) {
                console.error("Error inserting receipt item:", err);
                return db.rollback(() =>
                  res.status(500).json({ message: "DB error" })
                );
              }
              totalAmount += qty * cost_price;
              processItems(i + 1);
            }
          );
        };

        if (it.product_id) {
          // If product exists
          db.query(
            "SELECT id FROM products WHERE id = ?",
            [it.product_id],
            (err, rows) => {
              if (err) {
                console.error("Error checking product:", err);
                return db.rollback(() =>
                  res.status(500).json({ message: "DB error" })
                );
              }
              if (rows.length === 0) {
                return db.rollback(() =>
                  res
                    .status(404)
                    .json({ message: `Product id ${it.product_id} not found` })
                );
              }
              db.query(
                "UPDATE products SET quantity = quantity + ? WHERE id = ?",
                [qty, it.product_id],
                (err) => {
                  if (err) {
                    console.error("Error updating product:", err);
                    return db.rollback(() =>
                      res.status(500).json({ message: "DB error" })
                    );
                  }
                  insertReceiptItem(it.product_id);
                }
              );
            }
          );
        } else {
          // Check by name
          db.query(
            "SELECT id FROM products WHERE name = ?",
            [name],
            (err, rows) => {
              if (err) {
                console.error("Error searching product:", err);
                return db.rollback(() =>
                  res.status(500).json({ message: "DB error" })
                );
              }
              if (rows.length > 0) {
                const productId = rows[0].id;
                db.query(
                  "UPDATE products SET quantity = quantity + ? WHERE id = ?",
                  [qty, productId],
                  (err) => {
                    if (err) {
                      console.error("Error updating product:", err);
                      return db.rollback(() =>
                        res.status(500).json({ message: "DB error" })
                      );
                    }
                    insertReceiptItem(productId);
                  }
                );
              } else {
                insertProduct();
              }
            }
          );
        }
      };

      processItems(0);
    });
  });
});

// Get receipts (with items)
// List receipts with vendor + items
app.get("/receipts", (req, res) => {
  const sql = `
    SELECT r.id, r.vendor_id, v.name AS vendor_name, r.invoice_no,
           r.total_amount, r.created_at,
           COUNT(ri.id) AS items_count
    FROM receipts r
    JOIN vendors v ON r.vendor_id = v.id
    LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching receipts:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// Get single receipt with full items
app.get("/receipts/:id", (req, res) => {
  const { id } = req.params;

  const sqlReceipt = `
    SELECT r.id, r.vendor_id, v.name AS vendor_name, r.invoice_no,
           r.total_amount, r.created_at
    FROM receipts r
    JOIN vendors v ON r.vendor_id = v.id
    WHERE r.id = ?
  `;
  const sqlItems = `
    SELECT ri.*, p.name AS product_name
    FROM receipt_items ri
    LEFT JOIN products p ON ri.product_id = p.id
    WHERE ri.receipt_id = ?
  `;

  db.query(sqlReceipt, [id], (err, receiptRows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!receiptRows.length)
      return res.status(404).json({ message: "Not found" });

    db.query(sqlItems, [id], (err, itemRows) => {
      if (err) return res.status(500).json({ message: "DB error" });

      const receipt = receiptRows[0];
      receipt.items = itemRows;
      res.json(receipt);
    });
  });
});

// Get single receipt
app.get("/receipts/:id", (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT r.*, v.name AS vendor_name 
    FROM receipts r 
    LEFT JOIN vendors v ON v.id = r.vendor_id 
    WHERE r.id = ?
  `;
  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching receipt:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }

    const receipt = rows[0];
    db.query(
      "SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY id",
      [id],
      (err, items) => {
        if (err) {
          console.error("Error fetching receipt items:", err);
          return res.status(500).json({ message: "DB error" });
        }
        res.json({ ...receipt, items });
      }
    );
  });
});

// Quick search products
app.get("/products/search", (req, res) => {
  const q = req.query.q || "";
  const sql =
    "SELECT id, name, quantity, sell_price FROM products WHERE name LIKE ? LIMIT 30";
  db.query(sql, [`%${q}%`], (err, rows) => {
    if (err) {
      console.error("Product search error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// ========== WORKERS API ==========

// Get all workers
app.get("/workers", (req, res) => {
  db.query("SELECT * FROM workers", (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results);
  });
});

// Add a worker
app.post("/workers", (req, res) => {
  const {
    name,
    father_name,
    phone,
    cnic,
    salary,
    role,
    joining_date,
    benefits,
  } = req.body;
  const sql = `INSERT INTO workers (name, father_name, phone, cnic, salary, role, joining_date, benefits) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(
    sql,
    [name, father_name, phone, cnic, salary, role, joining_date, benefits],
    (err, result) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ id: result.insertId, message: "Worker added successfully" });
    }
  );
});

// Delete worker
app.delete("/workers/:id", (req, res) => {
  db.query(
    "DELETE FROM workers WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ message: "Worker removed successfully" });
    }
  );
});

// Update full worker
function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // MySQL DATE format
}

app.put("/workers/:id", (req, res) => {
  const { id } = req.params;
  const {
    name,
    father_name,
    phone,
    salary,
    cnic,
    role,
    joining_date,
    benefits,
    bonus,
  } = req.body;

  const formattedDate = formatDate(joining_date);

  const sql = `
    UPDATE workers 
    SET name = ?, father_name = ?, phone = ?, salary = ?, cnic = ?, role = ?, joining_date = ?, benefits = ?, bonus = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      name,
      father_name,
      phone,
      salary,
      cnic,
      role,
      formattedDate,
      benefits,
      bonus,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Error updating worker:", err);
        return res.status(500).json({ message: "Error updating worker" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Worker not found" });
      }
      res.json({ message: "Worker updated successfully", workerId: id });
    }
  );
});

// Worker Sales Report
// Worker Sales Report
app.get("/workers/sales", (req, res) => {
  const { period } = req.query; // "day", "week", "month", "year", "all"
  let where = "";

  if (period === "day") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 DAY";
  } else if (period === "week") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 WEEK";
  } else if (period === "month") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 MONTH";
  } else if (period === "year") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 YEAR";
  }

  const sql = `
    SELECT w.id, w.name, 
           COUNT(s.id) AS total_sales,
           IFNULL(SUM(s.total_amount), 0) AS total_amount
    FROM workers w
    LEFT JOIN sales s ON w.id = s.worker_id
    ${where}
    GROUP BY w.id, w.name
    ORDER BY total_amount DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching worker sales:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// ---------------------- SALES API ----------------------

// Record sales (with stock decrement in one transaction)
app.post("/sales", (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "No sale items provided" });
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Transaction begin error:", err);
      return res.status(500).json({ message: "DB transaction error" });
    }

    try {
      for (const it of items) {
        const { product_id, worker_id, quantity, sold_price } = it;
        const qty = parseInt(quantity || 0, 10);
        if (!product_id || !worker_id || qty <= 0 || !sold_price) {
          throw { status: 400, message: "Invalid item data" };
        }

        // 1) Check stock
        const rows = await new Promise((resolve, reject) => {
          db.query(
            "SELECT id, quantity FROM products WHERE id = ? FOR UPDATE",
            [product_id],
            (err, result) => (err ? reject(err) : resolve(result))
          );
        });

        if (!rows || rows.length === 0) {
          throw { status: 404, message: `Product ${product_id} not found` };
        }
        const product = rows[0];
        if (product.quantity < qty) {
          throw {
            status: 400,
            message: `Insufficient stock for product id ${product_id}`,
          };
        }

        // 2) Insert sale
        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO sales (product_id, worker_id, quantity, sold_price, total_amount) VALUES (?, ?, ?, ?, ?)",
            [product_id, worker_id, qty, sold_price, qty * sold_price],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // 3) Update stock
        await new Promise((resolve, reject) => {
          db.query(
            "UPDATE products SET quantity = quantity - ? WHERE id = ?",
            [qty, product_id],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      // commit transaction
      db.commit((err) => {
        if (err) {
          db.rollback(() => {
            console.error("Commit error:", err);
            return res.status(500).json({ message: "Commit failed" });
          });
        } else {
          res.json({ message: "Sales recorded successfully" });
        }
      });
    } catch (error) {
      // rollback on any error
      db.rollback(() => {
        console.error("Sale transaction error:", error);
        if (error && error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        return res.status(500).json({ message: "Error processing sales" });
      });
    }
  });
});

// GET sales with product + worker info
app.get("/sales", (req, res) => {
  const page = parseInt(req.query.page || "1", 10);
  const limit = parseInt(req.query.limit || "10", 10);
  const offset = (page - 1) * limit;

  const sql = `
    SELECT s.id, s.product_id, p.name AS product_name, s.worker_id, w.name AS worker_name,
           s.quantity, s.sold_price, s.total_amount, s.created_at
    FROM sales s
    LEFT JOIN products p ON p.id = s.product_id
    LEFT JOIN workers w ON w.id = s.worker_id
    ORDER BY s.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [limit, offset], (err, rows) => {
    if (err) {
      console.error("Error fetching sales:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// -------- DASHBOARD / ANALYTICS ROUTES --------
// Helper to build WHERE clause from query (period or from/to)
function buildWhereFromQuery(q) {
  const { period, from, to } = q || {};
  let where = "";
  if (from && to) {
    where = `WHERE s.created_at BETWEEN '${from}' AND '${to}'`;
  } else if (period === "day") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 DAY";
  } else if (period === "week") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 WEEK";
  } else if (period === "month") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 MONTH";
  } else if (period === "year") {
    where = "WHERE s.created_at >= NOW() - INTERVAL 1 YEAR";
  } // else all => no where
  return where;
}

// GET /dashboard/summary?period=week       or ?from=2025-01-01&to=2025-01-31
app.get("/dashboard/summary", (req, res) => {
  try {
    const where = buildWhereFromQuery(req.query);

    // total sales count, amount, profit, total workers, total products
    const sql = `
      SELECT
        IFNULL(SUM(s.quantity),0) AS total_items_sold,
        IFNULL(SUM(s.quantity * s.sold_price),0) AS total_sales_amount,
        IFNULL(SUM(s.quantity * (s.sold_price - IFNULL(p.retail_price,0))),0) AS total_profit
      FROM sales s
      LEFT JOIN products p ON p.id = s.product_id
      ${where};
    `;
    db.query(sql, (err, rows) => {
      if (err) {
        console.error("Error dashboard summary (sales):", err);
        return res.status(500).json({ message: "DB error" });
      }
      const salesRow = rows[0] || {
        total_items_sold: 0,
        total_sales_amount: 0,
        total_profit: 0,
      };

      // total workers & products (counts - not filtered by period)
      db.query(
        "SELECT COUNT(*) AS total_workers FROM workers",
        (err2, rows2) => {
          if (err2) {
            console.error("Error counting workers:", err2);
            return res.status(500).json({ message: "DB error" });
          }
          db.query(
            "SELECT COUNT(*) AS total_products FROM products",
            (err3, rows3) => {
              if (err3) {
                console.error("Error counting products:", err3);
                return res.status(500).json({ message: "DB error" });
              }
              res.json({
                total_items_sold: Number(salesRow.total_items_sold || 0),
                total_sales_amount: Number(salesRow.total_sales_amount || 0),
                total_profit: Number(salesRow.total_profit || 0),
                total_workers: rows2[0].total_workers || 0,
                total_products: rows3[0].total_products || 0,
              });
            }
          );
        }
      );
    });
  } catch (err) {
    console.error("Error /dashboard/summary:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /dashboard/leaderboard?period=month&limit=5
// returns workers ranked by total_amount and count
app.get("/dashboard/leaderboard", (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const where = buildWhereFromQuery(req.query);

    const sql = `
      SELECT w.id, w.name,
             COUNT(s.id) AS sales_count,
             IFNULL(SUM(s.quantity * s.sold_price),0) AS sales_amount,
             IFNULL(SUM(s.quantity * (s.sold_price - IFNULL(p.retail_price,0))),0) AS profit
      FROM workers w
      LEFT JOIN sales s ON s.worker_id = w.id
      LEFT JOIN products p ON p.id = s.product_id
      ${where}
      GROUP BY w.id, w.name
      ORDER BY sales_amount DESC
      LIMIT ?
    `;
    db.query(sql, [limit], (err, rows) => {
      if (err) {
        console.error("Error dashboard leaderboard:", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json(rows);
    });
  } catch (err) {
    console.error("Error /dashboard/leaderboard:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /dashboard/top-products?period=month&limit=10
// two metrics: units sold and profit
app.get("/dashboard/top-products", (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const where = buildWhereFromQuery(req.query);

    const sql = `
      SELECT p.id, p.name,
             IFNULL(SUM(s.quantity),0) AS units_sold,
             IFNULL(SUM(s.quantity * s.sold_price),0) AS total_sales_amount,
             IFNULL(SUM(s.quantity * (s.sold_price - IFNULL(p.retail_price,0))),0) AS total_profit
      FROM products p
      LEFT JOIN sales s ON s.product_id = p.id
      ${where}
      GROUP BY p.id, p.name
      ORDER BY units_sold DESC
      LIMIT ?
    `;
    db.query(sql, [limit], (err, rows) => {
      if (err) {
        console.error("Error top-products:", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json(rows);
    });
  } catch (err) {
    console.error("Error /dashboard/top-products:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /dashboard/recent-sales?limit=10
app.get("/dashboard/recent-sales", (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const sql = `
      SELECT s.id, s.product_id, p.name AS product_name, s.worker_id, w.name AS worker_name,
             s.quantity, s.sold_price, (s.quantity * s.sold_price) AS total_amount, s.created_at
      FROM sales s
      LEFT JOIN products p ON p.id = s.product_id
      LEFT JOIN workers w ON w.id = s.worker_id
      ORDER BY s.created_at DESC
      LIMIT ?
    `;
    db.query(sql, [limit], (err, rows) => {
      if (err) {
        console.error("Error recent-sales:", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json(rows);
    });
  } catch (err) {
    console.error("Error /dashboard/recent-sales:", err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
