-- Database Updates for Shop Management App
-- Run these updates to add authentication and payment features

USE shopdb;

-- 1. Create admin_users table for authentication
CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_code VARCHAR(6),
  code_expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Add payment status to sales table
ALTER TABLE sales 
ADD COLUMN payment_status ENUM('paid', 'pending', 'hold') DEFAULT 'paid' AFTER total_amount,
ADD COLUMN customer_name VARCHAR(255) NULL AFTER payment_status,
ADD COLUMN customer_phone VARCHAR(20) NULL AFTER customer_name;

-- 3. Create returns table for item returns
CREATE TABLE returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  worker_id INT NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  returned_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. Create email verification table for temporary storage
CREATE TABLE email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert first admin (password: admin123)
-- Password: admin123 (hashed with bcrypt)
INSERT INTO admin_users (name, email, password, is_verified) 
VALUES ('Super Admin', 'abuzarkhan95123@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', TRUE);

-- 6. Add indexes for better performance
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_returns_sale_id ON returns(sale_id);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
