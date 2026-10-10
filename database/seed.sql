USE `usta_takvimi`;

INSERT INTO expertises (name)
VALUES
  ('Boyaci'),
  ('Tesisatci'),
  ('Elektrikci')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO clients (company_or_name, contact_info)
VALUES
  ('Akar Yapi', JSON_OBJECT('phone', '+90 555 111 2233', 'email', 'info@akaryapi.com')),
  ('Deniz Insaat', JSON_OBJECT('phone', '+90 555 444 5566', 'email', 'iletisim@denizinsaat.com')),
  ('Gulbahar Proje', JSON_OBJECT('phone', '+90 555 777 8899', 'email', 'yapi@gulbaharproje.com'))
ON DUPLICATE KEY UPDATE company_or_name = VALUES(company_or_name);

INSERT INTO workers (name, expertise_id, daily_status)
VALUES
  ('Murat K.', 1, 'ACTIVE'),
  ('Ali T.', 1, 'ACTIVE'),
  ('Caner Y.', 2, 'ACTIVE'),
  ('Emre S.', 2, 'INACTIVE'),
  ('Baran D.', 3, 'ACTIVE'),
  ('Kubilay C.', 3, 'ACTIVE')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO requests (client_id, expertise_id, start_date, end_date, status, description, estimated_worker_count)
VALUES
  (1, 3, '2026-10-15', '2026-10-18', 'PENDING', 'Konut projesinde elektrik kurulumu ihtiyacı.', 2),
  (2, 2, '2026-10-16', '2026-10-17', 'PENDING', 'Su tesisatı bakım ve tadilat çalışması.', 1),
  (3, 1, '2026-10-20', '2026-10-22', 'PENDING', 'Fasat duvar ve iç cephe boyama', 3)
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO assignments (request_id, worker_id, assignment_date)
VALUES
  (1, 5, '2026-10-15'),
  (1, 6, '2026-10-17')
ON DUPLICATE KEY UPDATE assignment_date = VALUES(assignment_date);
