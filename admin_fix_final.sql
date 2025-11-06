-- Final fix for admin login issue
-- Run this in MySQL Workbench to fix the password hash

USE shopdb;

-- Delete any existing admin with this email to avoid conflicts
DELETE FROM admin_users WHERE email = 'abuzarkhan95123@gmail.com';

-- Insert the admin with a correct bcrypt hash for password "admin123"
INSERT INTO admin_users (name, email, password, is_verified) 
VALUES (
    'Super Admin', 
    'abuzarkhan95123@gmail.com', 
    '$2a$10$NLERi7/PdERHFawFkN.k3exwQcnRdxr/ob4Q276vRhmvgXY11jegm', 
    TRUE
);

-- Verify the admin was created successfully
SELECT id, name, email, is_verified, created_at FROM admin_users WHERE email = 'abuzarkhan95123@gmail.com';

-- Now you can login with:
-- Email: abuzarkhan95123@gmail.com
-- Password: admin123



