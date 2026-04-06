import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Database connection will be passed from server.js
let db;

// Function to set database connection
export const setDayManagementDb = (databaseConnection) => {
  db = databaseConnection;
};

// Get all day management records
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT dm.*, 
             u1.name as opening_user_name,
             u2.name as closing_user_name
      FROM day_management dm
      LEFT JOIN admin_users u1 ON dm.opening_user_id = u1.id
      LEFT JOIN admin_users u2 ON dm.closing_user_id = u2.id
      ORDER BY dm.day_date DESC
    `;
    
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching day management records:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current day (most recent open day)
router.get('/current', async (req, res) => {
  try {
    const sql = `
      SELECT dm.*, 
             u1.name as opening_user_name,
             u2.name as closing_user_name
      FROM day_management dm
      LEFT JOIN admin_users u1 ON dm.opening_user_id = u1.id
      LEFT JOIN admin_users u2 ON dm.closing_user_id = u2.id
      WHERE dm.status = 'open'
      ORDER BY dm.day_date DESC
      LIMIT 1
    `;
    
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching current day:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results[0] || null);
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start a new day
router.post('/start', async (req, res) => {
  try {
    const { opening_cash = 0, notes = '' } = req.body;
    const user_id = req.user?.id; // From auth middleware
    
    // Check if there's already an open day
    const checkSql = 'SELECT id FROM day_management WHERE status = "open"';
    db.query(checkSql, (err, results) => {
      if (err) {
        console.error('Error checking existing day:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      
      if (results.length > 0) {
        return res.status(400).json({ message: 'There is already an open day. Please close it first.' });
      }
      
      // Create new day record
      const insertSql = `
        INSERT INTO day_management 
        (day_date, opening_time, opening_user_id, opening_cash, status, notes)
        VALUES (CURDATE(), NOW(), ?, ?, 'open', ?)
      `;
      
      db.query(insertSql, [user_id, opening_cash, notes], (err, result) => {
        if (err) {
          console.error('Error starting day:', err);
          return res.status(500).json({ message: 'Database error' });
        }
        
        res.json({ 
          message: 'Day started successfully',
          day_id: result.insertId
        });
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close a day
router.post('/close/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { closing_cash = 0, notes = '' } = req.body;
    const user_id = req.user?.id; // From auth middleware
    
    // Get day sales data including returns
    const salesSql = `
      SELECT 
        COUNT(DISTINCT sr.id) as total_receipts,
        SUM(CASE 
          WHEN sr.payment_status = 'refunded' THEN 0
          ELSE sr.total_amount 
        END) as total_sales,
        COUNT(DISTINCT sr.customer_name) as total_customers,
        SUM(CASE
          WHEN sr.payment_status = 'refunded' THEN 0
          ELSE sri.quantity
        END) as total_products_sold,
        COALESCE((
          SELECT SUM(r.returned_amount)
          FROM returns r
          WHERE DATE(r.created_at) = (
            SELECT day_date FROM day_management WHERE id = ?
          )
        ), 0) as total_returns
      FROM sales_receipts sr
      LEFT JOIN sales_receipt_items sri ON sr.id = sri.receipt_id
      WHERE DATE(sr.created_at) = (
        SELECT day_date FROM day_management WHERE id = ?
      )
    `;
    
    db.query(salesSql, [id], (err, salesResults) => {
      if (err) {
        console.error('Error fetching sales data:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      
      const salesData = salesResults[0] || {
        total_receipts: 0,
        total_sales: 0,
        total_customers: 0,
        total_products_sold: 0,
        total_returns: 0
      };
      
      // Get top selling products for the day
      const topProductsSql = `
        SELECT 
          p.name,
          SUM(sri.quantity) as total_sold,
          SUM(sri.quantity * sri.sold_price) as total_revenue
        FROM sales_receipt_items sri
        JOIN sales_receipts sr ON sri.receipt_id = sr.id
        JOIN products p ON sri.product_id = p.id
        WHERE DATE(sr.created_at) = (
          SELECT day_date FROM day_management WHERE id = ?
        )
        AND sr.payment_status != 'refunded'
        GROUP BY p.id, p.name
        ORDER BY total_sold DESC
        LIMIT 10
      `;
      
      db.query(topProductsSql, [id], (err, topProducts) => {
        if (err) {
          console.error('Error fetching top products:', err);
          return res.status(500).json({ message: 'Database error' });
        }
        
        // Get worker performance for the day
        const workerPerformanceSql = `
          SELECT 
            w.name as worker_name,
            COUNT(DISTINCT sr.id) as receipts_count,
            SUM(CASE 
              WHEN sr.payment_status = 'refunded' THEN 0
              ELSE sr.total_amount 
            END) as total_sales
          FROM sales_receipts sr
          JOIN workers w ON sr.worker_id = w.id
          WHERE DATE(sr.created_at) = (
            SELECT day_date FROM day_management WHERE id = ?
          )
          GROUP BY w.id, w.name
          ORDER BY total_sales DESC
        `;
        
        db.query(workerPerformanceSql, [id], (err, workerPerformance) => {
          if (err) {
            console.error('Error fetching worker performance:', err);
            return res.status(500).json({ message: 'Database error' });
          }
          
          // Update day management record
          const updateSql = `
            UPDATE day_management 
            SET closing_time = NOW(),
                closing_user_id = ?,
                closing_cash = ?,
                total_sales = ?,
                total_receipts = ?,
                status = 'closed',
                notes = ?
            WHERE id = ?
          `;
          
          db.query(updateSql, [
            user_id, 
            closing_cash, 
            salesData.total_sales, 
            salesData.total_receipts, 
            notes, 
            id
          ], (err, updateResult) => {
            if (err) {
              console.error('Error closing day:', err);
              return res.status(500).json({ message: 'Database error' });
            }
            
            if (updateResult.affectedRows === 0) {
              return res.status(404).json({ message: 'Day not found' });
            }
            
            // Create day summary record
            const summarySql = `
              INSERT INTO day_summary 
              (day_management_id, total_products_sold, total_customers, 
               cash_sales, credit_sales, pending_sales,
               top_selling_products, worker_performance)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.query(summarySql, [
              id,
              salesData.total_products_sold,
              salesData.total_customers,
              salesData.total_sales, // cash_sales
              0, // credit_sales
              0, // pending_sales
              JSON.stringify(topProducts),
              JSON.stringify(workerPerformance)
            ], (err, summaryResult) => {
              if (err) {
                console.error('Error creating day summary:', err);
                // Don't fail the request, just log the error
              }
              
              res.json({
                message: 'Day closed successfully',
                sales_data: salesData,
                top_products: topProducts,
                worker_performance: workerPerformance
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get day summary
router.get('/summary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT dm.*, ds.total_products_sold, ds.total_customers, 
             ds.cash_sales, ds.credit_sales, ds.pending_sales,
             ds.total_profit, ds.top_selling_products, ds.worker_performance
      FROM day_management dm
      LEFT JOIN day_summary ds ON dm.id = ds.day_management_id
      WHERE dm.id = ?
    `;
    
    db.query(sql, [id], (err, results) => {
      if (err) {
        console.error('Error fetching day summary:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      
      if (results.length === 0) {
        return res.status(404).json({ message: 'Day not found' });
      }
      
      const result = results[0];
      // Parse JSON fields
      if (result.top_selling_products) {
        result.top_selling_products = JSON.parse(result.top_selling_products);
      }
      if (result.worker_performance) {
        result.worker_performance = JSON.parse(result.worker_performance);
      }
      
      res.json(result);
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
