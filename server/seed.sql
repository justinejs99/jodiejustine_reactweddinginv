USE wedding_db;

-- Couple info
INSERT INTO couple (groom_name, groom_last_name, groom_parents, bride_name, bride_last_name, bride_parents, hashtag, verse)
VALUES (
  'Jodie', 'Setiawan', 'SON OF MR. HARLY SETIAWAN & MRS. SUSAN DARMANTO',
  'Justine', 'Joy', 'DAUGHTER OF MR. RONY SUTRISNO & MRS. VIVI ISWANTI',
  '#JODohnyaJJ',
  'Matthew 19:6\n"Therefore what God has joined together,\nlet no one separate."'
);

-- Wedding date
INSERT INTO wedding_date (date_text, weekday)
VALUES ('10.10.26', 'Saturday, ');

-- Schedule
INSERT INTO schedule (time, title, subtitle, venue, location, sort_order)
VALUES
  ('09:00 WITA', 'Holy Matrimony', NULL, 'Hotel Mercure Samarinda', 'Crystal Ballroom 5 - Lt. 5', 1),
  ('11:00 WITA', 'Tea Pai Ceremony & Lunch', NULL, 'Hotel Mercure Samarinda', 'Crystal Ballroom 5 - Lt. 5', 2),
  ('18:30 WITA', 'Wedding Reception', 'Followed by After Party', 'Hotel Mercure Samarinda', 'Crystal Ballroom - Lt. 3', 3);

-- RSVP config
INSERT INTO rsvp_config (deadline)
VALUES ('Sat, 26/09/26');

-- Contact
INSERT INTO contact (display, whatsapp_url)
VALUES ('wa.me/6281389834762', 'https://wa.me/6281389834762');

-- Responses
INSERT INTO responses (type, title, body)
VALUES
  ('accepted', 'Thank you for your response!', 'We can''t wait to see you there.'),
  ('declined', 'We will miss celebrating with you!', 'We truly appreciate your love and support, even from afar.');

-- QR config
INSERT INTO qr_config (message)
VALUES ('Please screenshot this QR code for check-in at the venue.');

-- Guest groups
INSERT INTO guest_groups (group_name, phone_no, invited_by) VALUES
  ('Mrs. Megawati Kwan', '12345678', 'Groom'),
  ('Gany Family', '448899034', 'Groom'),
  ('Mr. Adi & Mrs. Natasya', '999000', 'Groom'),
  ('Mr. Kevin & Mrs. Melissa', '11112222', 'Groom'),
  ('Mr. Michael & Mrs. Jenniven', '33334444', 'Groom');

-- Guests
INSERT INTO guests (group_id, designation, first_name, last_name, attendance, table_no, seat_no) VALUES
  -- Group 1: Mrs. Megawati Kwan
  (1, 'Mrs.', 'Megawati', 'Kwan', 'Yes', 3, 1),

  -- Group 2: Gany Family
  (2, 'Mr.', 'Sinaga', 'Gany', 'Yes', 4, 1),
  (2, 'Mrs.', 'Yuliani', 'Thio', 'Yes', 4, 2),
  (2, 'Mr.', 'Henry', 'Gany', 'Yes', 5, 3),

  -- Group 3: Mr. Adi & Mrs. Natasya
  (3, 'Mr.', 'Adi Nugroho', 'Tantry', 'Yes', 6, 1),
  (3, 'Mrs.', 'Natasya', 'Gany', 'Yes', 6, 2),

  -- Group 4: Mr. Kevin & Mrs. Melissa
  (4, 'Mr.', 'Kevin', 'Kevin', 'Yes', 6, 3),
  (4, 'Mrs.', 'Melissa', 'Gany', 'Yes', 6, 5),

  -- Group 5: Mr. Michael & Mrs. Jenniven
  (5, 'Mr.', 'Michael', 'Gany', 'Yes', 6, 5),
  (5, 'Mrs.', 'Jenniven', 'Cyrena', 'Yes', 6, 6);
