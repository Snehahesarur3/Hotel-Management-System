-- Sample data loaded at startup
INSERT INTO rooms (room_number, room_type, price_per_night, capacity, active) VALUES
('101', 'SINGLE', 1500.00, 1, true),
('102', 'SINGLE', 1500.00, 1, true),
('201', 'DOUBLE', 2500.00, 2, true),
('202', 'DOUBLE', 2500.00, 2, true),
('301', 'DELUXE', 4000.00, 3, true),
('401', 'SUITE',  7000.00, 4, true);

INSERT INTO customers (name, email, phone) VALUES
('Rahul Sharma', 'rahul@example.com', '9876543210'),
('Priya Patil',  'priya@example.com', '9123456780');
