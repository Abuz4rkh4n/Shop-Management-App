import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken } from "./middleware/auth.js";
import { sendVerificationEmail, sendAdminInviteEmail } from "./utils/email.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== AUTHENTICATION ROUTES (public) ==========

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

// Helper function to generate verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Safely parse permissions from DB (JSON string or object)
function toPerms(val) {
  try {
    if (!val) return {};
    if (typeof val === 'object') return val;
    if (typeof val === 'string') return JSON.parse(val);
    return {};
  } catch {
    return {};
  }
}

// Helper function to check if admin exists
const checkAdminExists = () => {
  return new Promise((resolve, reject) => {
    db.query("SELECT COUNT(*) as count FROM admin_users", (err, result) => {
      if (err) return reject(err);
      resolve(result[0].count > 0);
    });
  });
};

// Send admin invitation code (protected: only logged-in admin can invite)
app.post("/auth/send-invite", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if admin already exists
    const admin = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM admin_users WHERE email = ?", [email], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
      });
    });

    if (admin) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists" });
    }

    // Generate invitation code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store in email_verifications table
    await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)",
        [email, code, expiresAt],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    // Send email
    const emailSent = await sendAdminInviteEmail(email, code);

    if (emailSent) {
      res.json({ message: "Invitation code sent to email" });
    } else {
      res.status(500).json({ message: "Failed to send email" });
    }
  } catch (error) {
    console.error("Send invite error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin signup
app.post("/auth/signup", async (req, res) => {
  try {
    const { name, email, password, invitationCode } = req.body;

    if (!name || !email || !password || !invitationCode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if admin already exists
    const admin = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM admin_users WHERE email = ?",
        [email],
        (err, result) => {
          if (err) return reject(err);
          resolve(result[0]);
        }
      );
    });

    if (admin) {
      return res
        .status(400)
        .json({ message: "Admin with this email already exists" });
    }

    // Verify invitation code
    const verificationResult = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > NOW()",
        [email, invitationCode],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (verificationResult.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or expired invitation code" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const result = await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO admin_users (name, email, password, is_verified) VALUES (?, ?, ?, TRUE)",
        [name, email, hashedPassword],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    // Clean up verification code
    await new Promise((resolve, reject) => {
      db.query(
        "DELETE FROM email_verifications WHERE email = ?",
        [email],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    res.json({
      message: "Admin created successfully",
      adminId: result.insertId,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Find admin
    const admin = await new Promise((resolve, reject) => {
      db.query(
        "SELECT id, name, email, password, is_verified, role, address, permissions FROM admin_users WHERE email = ?",
        [email],
        (err, result) => {
          if (err) return reject(err);
          resolve(result[0]);
        }
      );
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!admin.is_verified) {
      return res.status(401).json({ message: "Account not verified" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        address: admin.address,
        permissions: toPerms(admin.permissions),
      },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "24h" }
    );

    res.json({
      message: "Login successful",
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        address: admin.address,
        permissions: toPerms(admin.permissions),
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify token
app.get("/auth/verify", authenticateToken, async (req, res) => {
  try {
    const admin = await new Promise((resolve, reject) => {
      db.query("SELECT id, name, email, role, address, permissions FROM admin_users WHERE id = ?", [req.user.id], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
      });
    });
    // normalize permissions
    const perms = toPerms(admin?.permissions);
    res.json({ valid: true, admin: { ...admin, permissions: perms } });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

// Admin management (superadmin only)
app.get("/admins", authenticateToken, async (req, res) => {
  try {
    const me = await new Promise((resolve, reject) => {
      db.query("SELECT role FROM admin_users WHERE id = ?", [req.user.id], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
      });
    });
    if (!me || me.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const rows = await new Promise((resolve, reject) => {
      db.query("SELECT id, name, email, role, address, permissions, created_at FROM admin_users ORDER BY id DESC", (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
    const data = rows.map(r => ({ ...r, permissions: toPerms(r.permissions) }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post("/admins", authenticateToken, async (req, res) => {
  try {
    const me = await new Promise((resolve, reject) => {
      db.query("SELECT role FROM admin_users WHERE id = ?", [req.user.id], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
      });
    });
    if (!me || me.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const { name, email, password, address = null, permissions = {}, role = 'admin' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
    const hashed = await bcrypt.hash(password, 10);
    const permsStr = JSON.stringify(permissions || {});
    await new Promise((resolve, reject) => {
      db.query("INSERT INTO admin_users (name, email, password, role, address, permissions, is_verified) VALUES (?, ?, ?, ?, ?, ?, TRUE)",
        [name, email, hashed, role, address, permsStr], (err) => {
          if (err) return reject(err);
          resolve();
        });
    });
    res.json({ message: 'Admin created' });
  } catch (e) {
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }
    console.error('Create admin error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put("/admins/:id", authenticateToken, async (req, res) => {
  try {
    const me = await new Promise((resolve, reject) => {
      db.query("SELECT role FROM admin_users WHERE id = ?", [req.user.id], (err, result) => {
        if (err) return reject(err);
        resolve(result[0]);
      });
    });
    if (!me || me.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });

    const { id } = req.params;
    const { name, address, password, permissions, role } = req.body;
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (role !== undefined) { fields.push('role = ?'); values.push(role); }
    if (permissions !== undefined) { fields.push('permissions = ?'); values.push(JSON.stringify(permissions || {})); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      values.push(hashed);
    }
    if (!fields.length) return res.json({ message: 'No changes' });
    const sql = `UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);
    await new Promise((resolve, reject) => {
      db.query(sql, values, (err) => err ? reject(err) : resolve());
    });
    res.json({ message: 'Admin updated' });
  } catch (e) {
    console.error('Update admin error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ========== PROTECTED ROUTES (require authentication) ==========

// Apply authentication middleware to all routes below
app.use(authenticateToken);

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

// Delete a sales receipt and its items
app.delete("/sales/receipts/:id", (req, res) => {
  const { id } = req.params;
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction start error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    db.query("DELETE FROM sales_receipt_items WHERE receipt_id = ?", [id], (err) => {
      if (err) {
        return db.rollback(() => {
          console.error("Error deleting receipt items:", err);
          res.status(500).json({ message: "DB error" });
        });
      }
      db.query("DELETE FROM sales_receipts WHERE id = ?", [id], (err, result) => {
        if (err) {
          return db.rollback(() => {
            console.error("Error deleting receipt:", err);
            res.status(500).json({ message: "DB error" });
          });
        }
        if (result.affectedRows === 0) {
          return db.rollback(() => res.status(404).json({ message: "Receipt not found" }));
        }
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              console.error("Commit error:", err);
              res.status(500).json({ message: "DB error" });
            });
          }
          res.json({ message: "Receipt deleted" });
        });
      });
    });
  });
});

// Update a sales receipt payment status
app.put("/sales/receipts/:id/status", (req, res) => {
  const { id } = req.params;
  const { payment_status } = req.body;
  const allowed = ["paid", "pending", "all product got removed"]; // allowed statuses
  if (!allowed.includes(payment_status)) {
    return res.status(400).json({ message: "Invalid payment status" });
  }
  db.query(
    "UPDATE sales_receipts SET payment_status = ? WHERE id = ?",
    [payment_status, id],
    (err, result) => {
      if (err) {
        console.error("Error updating sales receipt status:", err);
        return res.status(500).json({ message: "DB error" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.json({ message: "Receipt status updated" });
    }
  );
});

// Return items from a sales receipt
// Body: { item_id, quantity, reason }
app.post("/sales/receipts/:id/return", (req, res) => {
  const { id } = req.params;
  const { item_id, quantity, reason } = req.body;
  const qty = parseInt(quantity || 0, 10);
  if (!item_id || !qty || qty <= 0) {
    return res.status(400).json({ message: "Invalid return data" });
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Transaction start error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    try {
      // Load item
      const items = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM sales_receipt_items WHERE id = ? AND receipt_id = ? FOR UPDATE",
          [item_id, id],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      if (!items || items.length === 0) {
        throw { status: 404, message: "Receipt item not found" };
      }
      const it = items[0];
      if (qty > it.quantity) {
        throw { status: 400, message: "Return quantity exceeds item quantity" };
      }

      // Update or delete the item row
      if (qty === it.quantity) {
        await new Promise((resolve, reject) => {
          db.query(
            "DELETE FROM sales_receipt_items WHERE id = ?",
            [item_id],
            (err) => (err ? reject(err) : resolve())
          );
        });
      } else {
        await new Promise((resolve, reject) => {
          db.query(
            "UPDATE sales_receipt_items SET quantity = quantity - ? WHERE id = ?",
            [qty, item_id],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      // Restore product stock
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE products SET quantity = quantity + ? WHERE id = ?",
          [qty, it.product_id],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Recalculate receipt total and items count
      const rows = await new Promise((resolve, reject) => {
        db.query(
          `SELECT IFNULL(SUM(quantity * sold_price), 0) AS total, COUNT(*) AS cnt FROM sales_receipt_items WHERE receipt_id = ?`,
          [id],
          (err, rows) => (err ? reject(err) : resolve(rows))
        );
      });
      const total = Number(rows[0]?.total || 0);
      const cnt = Number(rows[0]?.cnt || 0);

      // Update receipt total
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE sales_receipts SET total_amount = ? WHERE id = ?",
          [total, id],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // If no items remain, mark status accordingly
      if (cnt === 0) {
        await new Promise((resolve, reject) => {
          db.query(
            "UPDATE sales_receipts SET payment_status = 'all product got removed' WHERE id = ?",
            [id],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      db.commit((err) => {
        if (err) {
          return db.rollback(() => res.status(500).json({ message: "Commit failed" }));
        }
        res.json({ message: "Return processed", receipt_updated_total: total, items_remaining: cnt });
      });
    } catch (e) {
      db.rollback(() => {
        console.error("Receipt return error:", e);
        if (e && e.status) return res.status(e.status).json({ message: e.message });
        return res.status(500).json({ message: "Error processing return" });
      });
    }
  });
});

// Get product by ID (useful for barcode scanners that emit product ID)
app.get("/products/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM products WHERE id = ?", [id], (err, rows) => {
    if (err) {
      console.error("Error fetching product by id:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(rows[0]);
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
  const {
    items,
    paymentStatus = "paid",
    customerName = "",
    customerPhone = "",
  } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "No sale items provided" });
  }

  // Only allow 'paid' or 'pending'
  const allowedStatuses = ["paid", "pending"];
  const normalizedStatus = allowedStatuses.includes(paymentStatus) ? paymentStatus : "paid";

  // Customer name is compulsory
  if (!customerName || String(customerName).trim() === "") {
    return res.status(400).json({ message: "Customer name is required" });
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
            "INSERT INTO sales (product_id, worker_id, quantity, sold_price, total_amount, payment_status, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              product_id,
              worker_id,
              qty,
              sold_price,
              qty * sold_price,
              normalizedStatus,
              customerName,
              customerPhone,
            ],
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
           s.quantity, s.sold_price, s.total_amount, s.payment_status, s.customer_name, s.customer_phone, s.created_at
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

// ---------------------- SALES RECEIPTS API ----------------------
// Expected schema (run in DB separately):
// CREATE TABLE IF NOT EXISTS sales_receipts (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   worker_id INT NOT NULL,
//   payment_status ENUM('paid','pending','hold') DEFAULT 'paid',
//   customer_name VARCHAR(255) NULL,
//   customer_phone VARCHAR(20) NULL,
//   total_amount DECIMAL(15,2) DEFAULT 0,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT ON UPDATE CASCADE
// );
// CREATE TABLE IF NOT EXISTS sales_receipt_items (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   receipt_id INT NOT NULL,
//   product_id INT NOT NULL,
//   quantity INT NOT NULL,
//   sold_price DECIMAL(13,2) NOT NULL,
//   line_total DECIMAL(15,2) AS (quantity * sold_price) STORED,
//   FOREIGN KEY (receipt_id) REFERENCES sales_receipts(id) ON DELETE CASCADE,
//   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
// );

// Create a sales receipt with multiple items and decrement stock, also mirror rows in `sales` table
app.post("/sales/receipts", (req, res) => {
  const {
    worker_id,
    items,
    paymentStatus = "paid",
    customerName = "",
    customerPhone = "",
  } = req.body;

  if (!worker_id) return res.status(400).json({ message: "Worker is required" });
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "No receipt items provided" });
  }

  const allowedStatuses = ["paid", "pending", "hold"]; // align with DB enum
  const normalizedStatus = allowedStatuses.includes(paymentStatus) ? paymentStatus : "paid";

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Transaction begin error:", err);
      return res.status(500).json({ message: "DB transaction error" });
    }

    try {
      // Insert receipt header
      const receiptId = await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO sales_receipts (worker_id, payment_status, customer_name, customer_phone, total_amount) VALUES (?, ?, ?, ?, 0)",
          [worker_id, normalizedStatus, customerName || null, customerPhone || null],
          (err, result) => (err ? reject(err) : resolve(result.insertId))
        );
      });

      let totalAmount = 0;

      for (const it of items) {
        const { product_id, quantity, sold_price } = it;
        const qty = parseInt(quantity || 0, 10);
        const price = parseFloat(sold_price || 0);
        if (!product_id || qty <= 0 || !price) {
          throw { status: 400, message: "Invalid item data" };
        }

        // Lock and check stock
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
          throw { status: 400, message: `Insufficient stock for product id ${product_id}` };
        }

        // Insert receipt item
        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO sales_receipt_items (receipt_id, product_id, quantity, sold_price) VALUES (?, ?, ?, ?)",
            [receiptId, product_id, qty, price],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // Mirror into sales table for reporting
        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO sales (product_id, worker_id, quantity, sold_price, total_amount, payment_status, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [product_id, worker_id, qty, price, qty * price, normalizedStatus, customerName || null, customerPhone || null],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // Decrement stock
        await new Promise((resolve, reject) => {
          db.query(
            "UPDATE products SET quantity = quantity - ? WHERE id = ?",
            [qty, product_id],
            (err) => (err ? reject(err) : resolve())
          );
        });

        totalAmount += qty * price;
      }

      // Update header total
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE sales_receipts SET total_amount = ? WHERE id = ?",
          [totalAmount, receiptId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      db.commit((err) => {
        if (err) {
          db.rollback(() => {
            console.error("Commit error:", err);
            return res.status(500).json({ message: "Commit failed" });
          });
        } else {
          res.json({ message: "Receipt created", receiptId, total_amount: totalAmount });
        }
      });
    } catch (error) {
      db.rollback(() => {
        console.error("Sales receipt transaction error:", error);
        if (error && error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        return res.status(500).json({ message: "Error creating sales receipt" });
      });
    }
  });
});

// List sales receipts
app.get("/sales/receipts", (req, res) => {
  const sql = `
    SELECT sr.id, sr.worker_id, w.name AS worker_name,
           sr.payment_status, sr.customer_name, sr.customer_phone,
           sr.total_amount, sr.created_at,
           COUNT(sri.id) AS items_count
    FROM sales_receipts sr
    LEFT JOIN workers w ON w.id = sr.worker_id
    LEFT JOIN sales_receipt_items sri ON sri.receipt_id = sr.id
    GROUP BY sr.id
    ORDER BY sr.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching sales receipts:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// Get a single sales receipt with items
app.get("/sales/receipts/:id", (req, res) => {
  const { id } = req.params;
  const sqlHeader = `
    SELECT sr.id, sr.worker_id, w.name AS worker_name,
           sr.payment_status, sr.customer_name, sr.customer_phone,
           sr.total_amount, sr.created_at
    FROM sales_receipts sr
    LEFT JOIN workers w ON w.id = sr.worker_id
    WHERE sr.id = ?
  `;
  const sqlItems = `
    SELECT sri.*, p.name AS product_name
    FROM sales_receipt_items sri
    LEFT JOIN products p ON p.id = sri.product_id
    WHERE sri.receipt_id = ?
    ORDER BY sri.id
  `;
  db.query(sqlHeader, [id], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!rows || rows.length === 0) return res.status(404).json({ message: "Not found" });
    const header = rows[0];
    db.query(sqlItems, [id], (err2, items) => {
      if (err2) return res.status(500).json({ message: "DB error" });
      res.json({ ...header, items });
    });
  });
});

// ========== RETURNS API ==========

// Get all returns
app.get("/returns", (req, res) => {
  const sql = `
    SELECT r.id, r.sale_id, r.product_id, p.name AS product_name, r.worker_id, w.name AS worker_name,
           r.quantity, r.reason, r.returned_amount, r.created_at
    FROM returns r
    LEFT JOIN products p ON p.id = r.product_id
    LEFT JOIN workers w ON w.id = r.worker_id
    ORDER BY r.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching returns:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows);
  });
});

// Process item return
app.post("/returns", async (req, res) => {
  const { saleId, productId, workerId, quantity, reason } = req.body;

  if (!saleId || !productId || !workerId || !quantity || quantity <= 0) {
    return res.status(400).json({ message: "Invalid return data" });
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Transaction begin error:", err);
      return res.status(500).json({ message: "DB transaction error" });
    }

    try {
      // 1) Get sale details to calculate return amount
      const sale = await new Promise((resolve, reject) => {
        db.query("SELECT * FROM sales WHERE id = ?", [saleId], (err, result) =>
          err ? reject(err) : resolve(result)
        );
      });

      if (!sale || sale.length === 0) {
        throw { status: 404, message: "Sale not found" };
      }

      const saleData = sale[0];
      const returnAmount = saleData.sold_price * quantity;

      // 2) Insert return record
      await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO returns (sale_id, product_id, worker_id, quantity, reason, returned_amount) VALUES (?, ?, ?, ?, ?, ?)",
          [saleId, productId, workerId, quantity, reason || "", returnAmount],
          (err, result) => (err ? reject(err) : resolve(result))
        );
      });

      // 3) Update product stock (add back the returned items)
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE products SET quantity = quantity + ? WHERE id = ?",
          [quantity, productId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // 4) Update sale payment status to 'returned' if fully returned
      const remainingQuantity = saleData.quantity - quantity;
      if (remainingQuantity <= 0) {
        await new Promise((resolve, reject) => {
          db.query(
            "UPDATE sales SET payment_status = 'returned' WHERE id = ?",
            [saleId],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      db.commit((err) => {
        if (err) {
          db.rollback(() => {
            console.error("Commit error:", err);
            return res.status(500).json({ message: "Commit failed" });
          });
        } else {
          res.json({ message: "Return processed successfully" });
        }
      });
    } catch (error) {
      db.rollback(() => {
        console.error("Return transaction error:", error);
        if (error && error.status) {
          return res.status(error.status).json({ message: error.message });
        }
        return res.status(500).json({ message: "Error processing return" });
      });
    }
  });
});

// Update payment status for a sale
app.put("/sales/:id/payment", (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!["paid", "pending"].includes(paymentStatus)) {
    return res.status(400).json({ message: "Invalid payment status" });
  }

  const sql = "UPDATE sales SET payment_status = ? WHERE id = ?";
  db.query(sql, [paymentStatus, id], (err, result) => {
    if (err) {
      console.error("Error updating payment status:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Sale not found" });
    }
    res.json({ message: "Payment status updated successfully" });
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
