-- Esquema inicial Colegio San Miguel POS, MySQL 8.4 / InnoDB.
-- Ejecutar sobre base nueva. La app debe utilizar un usuario de privilegios mínimos.
CREATE DATABASE IF NOT EXISTS colegio_san_miguel_pos
 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE colegio_san_miguel_pos;

CREATE TABLE IF NOT EXISTS products (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 category VARCHAR(60) NOT NULL,
 description TEXT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 INDEX idx_products_name (name),
 INDEX idx_products_category (category)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_variants (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 product_id BIGINT UNSIGNED NOT NULL,
 size_label VARCHAR(30) NOT NULL,
 color VARCHAR(60) NOT NULL DEFAULT 'Estándar',
 sku VARCHAR(64) NOT NULL,
 unit_price_cents INT UNSIGNED NOT NULL,
 stock INT UNSIGNED NOT NULL DEFAULT 0,
 minimum_stock INT UNSIGNED NOT NULL DEFAULT 0,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_variant_sku (sku),
 UNIQUE KEY uq_product_size_color (product_id, size_label, color),
 INDEX idx_variants_stock (stock),
 CONSTRAINT fk_variant_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
 CONSTRAINT chk_variant_price CHECK (unit_price_cents > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 folio VARCHAR(40) NULL,
 idempotency_key CHAR(36) NOT NULL,
 request_fingerprint CHAR(64) NOT NULL,
 subtotal_cents INT UNSIGNED NOT NULL,
 discount_cents INT UNSIGNED NOT NULL DEFAULT 0,
 total_cents INT UNSIGNED NOT NULL,
 payment_method ENUM('CASH','CARD','TRANSFER') NOT NULL,
 amount_received_cents INT UNSIGNED NOT NULL,
 change_cents INT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_sales_folio (folio),
 UNIQUE KEY uq_sales_idempotency (idempotency_key),
 INDEX idx_sales_created (created_at),
 CONSTRAINT chk_sales_total CHECK (total_cents = subtotal_cents - discount_cents),
 CONSTRAINT chk_sales_received CHECK (amount_received_cents >= total_cents),
 CONSTRAINT chk_sales_change CHECK (change_cents = amount_received_cents - total_cents)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 sale_id BIGINT UNSIGNED NOT NULL,
 variant_id BIGINT UNSIGNED NOT NULL,
 product_name_snapshot VARCHAR(120) NOT NULL,
 size_snapshot VARCHAR(30) NOT NULL,
 color_snapshot VARCHAR(60) NOT NULL,
 sku_snapshot VARCHAR(64) NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 unit_price_cents INT UNSIGNED NOT NULL,
 line_total_cents INT UNSIGNED NOT NULL,
 INDEX idx_sale_items_sale (sale_id),
 INDEX idx_sale_items_variant (variant_id),
 CONSTRAINT fk_sale_item_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
 CONSTRAINT fk_sale_item_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
 CONSTRAINT chk_item_qty CHECK (quantity > 0),
 CONSTRAINT chk_item_total CHECK (line_total_cents = quantity * unit_price_cents)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 variant_id BIGINT UNSIGNED NOT NULL,
 sale_id BIGINT UNSIGNED NULL,
 kind ENUM('ENTRY','EXIT','ADJUSTMENT','SALE') NOT NULL,
 quantity_delta INT NOT NULL,
 stock_after INT UNSIGNED NOT NULL,
 reason VARCHAR(255) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX idx_movements_variant_date (variant_id, created_at),
 INDEX idx_movements_sale (sale_id),
 CONSTRAINT fk_movement_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
 CONSTRAINT fk_movement_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
 CONSTRAINT chk_movement_delta CHECK (quantity_delta <> 0),
 CONSTRAINT chk_movement_sign CHECK (
  (kind = 'ENTRY' AND quantity_delta > 0) OR
  (kind IN ('EXIT','SALE') AND quantity_delta < 0) OR
  (kind = 'ADJUSTMENT' AND quantity_delta <> 0)
 ),
 CONSTRAINT chk_movement_sale CHECK (
  (kind = 'SALE' AND sale_id IS NOT NULL) OR
  (kind <> 'SALE' AND sale_id IS NULL)
 )
) ENGINE=InnoDB;

-- Reglas de servicio backend (no reemplazadas por constraints):
-- * Todas las modificaciones del stock se hacen con transacciones y movimientos.
-- * Ajustar la sesión MySQL a timezone UTC (SET time_zone = '+00:00').
-- * Después de INSERT INTO sales, folio dentro de la misma transacción:
--   UPDATE sales SET folio=CONCAT('CSM-', LPAD(id, 8, '0')) WHERE id=?;
-- * idempotency_key UNIQUE + request_fingerprint previenen doble venta por retry.
