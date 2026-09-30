CREATE DATABASE IF NOT EXISTS controle_financeiro
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE controle_financeiro;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(160) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  category VARCHAR(80) NOT NULL,
  transaction_date DATE NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transactions_date (transaction_date),
  INDEX idx_transactions_type_date (type, transaction_date)
);
