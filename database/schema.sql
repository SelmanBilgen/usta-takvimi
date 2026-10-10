-- UstaTakvimi MySQL Schema
-- MySQL 8+

CREATE TABLE IF NOT EXISTS expertises (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_expertises_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS workers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  expertise_id BIGINT UNSIGNED NOT NULL,
  daily_status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_workers_expertise
    FOREIGN KEY (expertise_id) REFERENCES expertises(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_workers_expertise_status (expertise_id, daily_status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_or_name VARCHAR(180) NOT NULL,
  contact_info JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_accounts_client (client_id),
  UNIQUE KEY uq_customer_accounts_email (email),
  CONSTRAINT fk_customer_accounts_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  expertise_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('PENDING','ASSIGNED','COMPLETED','CANCELED') NOT NULL DEFAULT 'PENDING',
  description TEXT NULL,
  estimated_worker_count INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_requests_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_requests_estimated_count CHECK (estimated_worker_count >= 1),
  CONSTRAINT fk_requests_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_requests_expertise
    FOREIGN KEY (expertise_id) REFERENCES expertises(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_requests_status (status),
  KEY idx_requests_expertise_dates (expertise_id, start_date, end_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  worker_id BIGINT UNSIGNED NOT NULL,
  assignment_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_assignments_request
    FOREIGN KEY (request_id) REFERENCES requests(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_assignments_worker
    FOREIGN KEY (worker_id) REFERENCES workers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  UNIQUE KEY uq_worker_assignment_date (worker_id, assignment_date),
  KEY idx_assignments_request (request_id),
  KEY idx_assignments_date (assignment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS expertise_profiles (
  expertise_id BIGINT UNSIGNED PRIMARY KEY,
  description TEXT NULL,
  image_url VARCHAR(1000) NULL,
  CONSTRAINT fk_expertise_profiles_expertise
    FOREIGN KEY (expertise_id) REFERENCES expertises(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS worker_profiles (
  worker_id BIGINT UNSIGNED PRIMARY KEY,
  phone VARCHAR(40) NULL,
  email VARCHAR(254) NULL,
  bio TEXT NULL,
  image_url VARCHAR(1000) NULL,
  CONSTRAINT fk_worker_profiles_worker
    FOREIGN KEY (worker_id) REFERENCES workers(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS worker_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  worker_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_worker_accounts_worker (worker_id),
  UNIQUE KEY uq_worker_accounts_email (email),
  CONSTRAINT fk_worker_accounts_worker
    FOREIGN KEY (worker_id) REFERENCES workers(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignment_work_updates (
  assignment_id BIGINT UNSIGNED PRIMARY KEY,
  status ENUM('IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'IN_PROGRESS',
  work_description TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  CONSTRAINT fk_assignment_work_updates_assignment
    FOREIGN KEY (assignment_id) REFERENCES assignments(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_request_reviews_request (request_id),
  CONSTRAINT chk_request_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_request_reviews_request
    FOREIGN KEY (request_id) REFERENCES requests(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_request_reviews_client
    FOREIGN KEY (client_id) REFERENCES clients(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS site_images (
  image_key VARCHAR(80) PRIMARY KEY,
  image_url VARCHAR(500) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Optional helper view for daily capacity by expertise.
CREATE OR REPLACE VIEW v_expertise_daily_usage AS
SELECT
  e.id AS expertise_id,
  d.assignment_date,
  COUNT(DISTINCT w.id) AS used_capacity
FROM assignments d
JOIN workers w ON w.id = d.worker_id
JOIN expertises e ON e.id = w.expertise_id
GROUP BY e.id, d.assignment_date;
