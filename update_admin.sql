-- Update existing admin user email and ensure proper setup
USE shopdb;

-- Update the admin user email to the new one
UPDATE admin_users 
SET email = 'abuzarkhan95123@gmail.com', 
    name = 'Super Admin',
    is_verified = TRUE
WHERE email = 'admin@shop.com' OR email = 'abuzarkhan95123@gmail.com';

-- If no admin exists, insert one
INSERT IGNORE INTO admin_users (name, email, password, is_verified) 
VALUES ('Super Admin', 'abuzarkhan95123@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', TRUE);

-- Verify the admin user exists
SELECT id, name, email, is_verified, created_at FROM admin_users WHERE email = 'abuzarkhan95123@gmail.com';



