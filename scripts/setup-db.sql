-- Database setup script for development
-- Run this script to create the initial database schema

-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS ewsdb4_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ewsdb4_dev;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add more tables as needed for your project

-- Example: Sessions table (if you implement authentication)
-- CREATE TABLE IF NOT EXISTS sessions (
--   id VARCHAR(255) PRIMARY KEY,
--   user_id INT NOT NULL,
--   expires_at TIMESTAMP NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--   INDEX idx_user_id (user_id),
--   INDEX idx_expires_at (expires_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for development (optional)
-- INSERT INTO users (email, name, password) VALUES
--   ('admin@example.com', 'Admin User', '$2b$10$...'),
--   ('user@example.com', 'Regular User', '$2b$10$...');
