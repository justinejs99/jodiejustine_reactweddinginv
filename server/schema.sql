CREATE DATABASE IF NOT EXISTS wedding_db;
USE wedding_db;

CREATE TABLE IF NOT EXISTS couple (
  id INT PRIMARY KEY AUTO_INCREMENT,
  groom_name VARCHAR(100) NOT NULL,
  groom_last_name VARCHAR(100) NOT NULL,
  groom_parents VARCHAR(255) NOT NULL,
  bride_name VARCHAR(100) NOT NULL,
  bride_last_name VARCHAR(100) NOT NULL,
  bride_parents VARCHAR(255) NOT NULL,
  hashtag VARCHAR(100),
  verse TEXT
);

CREATE TABLE IF NOT EXISTS wedding_date (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date_text VARCHAR(50) NOT NULL,
  weekday VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule (
  id INT PRIMARY KEY AUTO_INCREMENT,
  time VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  subtitle VARCHAR(100),
  venue VARCHAR(200) NOT NULL,
  location VARCHAR(200) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rsvp_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  deadline VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS contact (
  id INT PRIMARY KEY AUTO_INCREMENT,
  display VARCHAR(200) NOT NULL,
  whatsapp_url VARCHAR(500) NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('accepted', 'declined') NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qr_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_name VARCHAR(200) NOT NULL,
  phone_no VARCHAR(50) NOT NULL,
  invited_by ENUM('Groom', 'Bride') NOT NULL
);

CREATE TABLE IF NOT EXISTS guests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  designation ENUM('Mr.', 'Mrs.', 'Ms.', 'Child') NOT NULL DEFAULT 'Mr.',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  attendance ENUM('Yes', 'No', 'Pending') NOT NULL DEFAULT 'Pending',
  table_no INT CHECK (table_no BETWEEN 1 AND 60),
  seat_no INT CHECK (seat_no BETWEEN 1 AND 10),
  FOREIGN KEY (group_id) REFERENCES guest_groups(id) ON DELETE CASCADE
);
