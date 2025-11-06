# Shop Management System - Setup Instructions

## Overview
This is a comprehensive shop management system built with React.js, Node.js, Express.js, and MySQL. It includes authentication, inventory management, sales tracking, payment options, and item returns.

## Features
- ✅ Admin authentication with email verification
- ✅ Inventory management (products, vendors, receipts)
- ✅ Worker management
- ✅ Sales tracking with payment options (paid/pending/hold)
- ✅ Item return system
- ✅ Dashboard with analytics
- ✅ Secure API endpoints

## Prerequisites
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## Database Setup

### 1. Create Database
Run the following SQL commands in MySQL Workbench or your preferred MySQL client:

```sql
CREATE DATABASE shopdb;
USE shopdb;
```

### 2. Run Database Updates
Execute the SQL commands from `database_updates.sql`:

```sql
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
INSERT INTO admin_users (name, email, password, is_verified) 
VALUES ('Super Admin', 'admin@shop.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', TRUE);

-- 6. Add indexes for better performance
CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_returns_sale_id ON returns(sale_id);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
```

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the backend directory:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=shopdb

# JWT Secret (use a strong secret key)
JWT_SECRET=your_jwt_secret_key_here

# Email Configuration (for sending verification codes)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server Port
PORT=5000
```

### 3. Email Configuration (Optional)
For email verification to work, you need to configure email settings:

1. For Gmail:
   - Enable 2-factor authentication
   - Generate an App Password
   - Use your Gmail address and the app password in the .env file

2. For other email providers:
   - Update the email configuration in `backend/utils/email.js`

### 4. Start Backend Server
```bash
npm start
# or
node server.js
```

## Frontend Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000
```

### 3. Start Development Server
```bash
npm run dev
```

## First Admin Setup

### Option 1: Use Pre-inserted Admin
The database already includes a super admin:
- Email: `admin@shop.com`
- Password: `admin123`

### Option 2: Create New Admin via Invitation
1. Go to `/invite` route
2. Send invitation to admin email
3. Admin receives email with invitation code
4. Go to `/signup` route
5. Complete signup with invitation code

## Usage Guide

### Authentication
- **Login**: `/login` - Sign in with admin credentials
- **Signup**: `/signup` - Create new admin account (requires invitation code)
- **Invite**: `/invite` - Send invitation to new admin

### Main Features
- **Dashboard**: Overview of sales, products, workers, and analytics
- **Products**: Manage inventory, add products, handle vendors and receipts
- **Workers**: Manage staff members and their information
- **Sales**: Process sales with payment options (paid/pending/hold)
- **Returns**: Process item returns and track return history

### Sales Features
- **Payment Options**:
  - Paid Now: Immediate payment
  - Pay Later: Customer will pay later
  - Hold: Hold the sale temporarily
- **Customer Information**: Optional customer name and phone
- **Return Processing**: Process returns with reason tracking

## API Endpoints

### Authentication
- `POST /auth/login` - Admin login
- `POST /auth/signup` - Admin signup
- `POST /auth/send-invite` - Send admin invitation
- `GET /auth/verify` - Verify JWT token

### Products
- `GET /products` - Get all products
- `POST /products` - Add product
- `PUT /products/:id/restock` - Restock product
- `DELETE /products/:id` - Delete product

### Sales
- `GET /sales` - Get sales with pagination
- `POST /sales` - Record sales
- `PUT /sales/:id/payment` - Update payment status

### Returns
- `GET /returns` - Get return history
- `POST /returns` - Process item return

### Workers
- `GET /workers` - Get all workers
- `POST /workers` - Add worker
- `PUT /workers/:id` - Update worker
- `DELETE /workers/:id` - Delete worker

## Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Email verification for admin accounts
- Protected routes and API endpoints
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL service is running
   - Verify database credentials in .env
   - Ensure database exists

2. **Email Not Sending**
   - Check email configuration in .env
   - For Gmail, ensure app password is used
   - Check internet connection

3. **Authentication Issues**
   - Verify JWT_SECRET is set
   - Check token expiration (24 hours)
   - Clear browser localStorage if needed

4. **CORS Issues**
   - Ensure frontend URL is correct
   - Check backend CORS configuration

### Support
For issues or questions, check the console logs and ensure all dependencies are properly installed.

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Use a process manager like PM2
3. Set up proper database credentials
4. Configure HTTPS

### Frontend
1. Run `npm run build`
2. Serve the `dist` folder with a web server
3. Configure environment variables for production API URL

## License
This project is for educational and commercial use.



