/**
 * Guest CSV Import Script
 * Usage: node import-guests.js guests.csv
 *
 * Expected CSV format (with header row):
 * group_name,phone_no,invited_by,designation,first_name,last_name,table_no,seat_no
 *
 * - invited_by: Groom or Bride
 * - designation: Mr. | Mrs. | Ms. | Child
 * - table_no and seat_no are optional (leave blank if unknown)
 *
 * Example rows:
 * Gany Family,448899034,Groom,Mr.,Sinaga,Gany,4,1
 * Gany Family,448899034,Groom,Mrs.,Yuliani,Thio,4,2
 * Mrs. Megawati Kwan,12345678,Groom,Mrs.,Megawati,Kwan,3,1
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import pool from './db.js';

const csvFile = process.argv[2];

if (!csvFile) {
  console.error('Usage: node import-guests.js <path-to-csv>');
  process.exit(1);
}

const filePath = path.resolve(csvFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

async function importGuests() {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const rows = [];
  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue; // skip header
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    rows.push(trimmed.split(',').map(v => v.trim()));
  }

  if (rows.length === 0) {
    console.log('No data rows found in CSV.');
    process.exit(0);
  }

  // Cache group_name -> id to avoid duplicate inserts
  const groupCache = {};

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const [group_name, phone_no, invited_by, designation, first_name, last_name, table_no, seat_no] of rows) {
      if (!group_name || !designation || !first_name || !last_name) {
        console.warn(`Skipping incomplete row: ${[group_name, designation, first_name, last_name].join(',')}`);
        continue;
      }

      // Insert group if not seen yet in this import run
      if (!groupCache[group_name]) {
        // Check if group already exists in DB
        const [existing] = await connection.query(
          'SELECT id FROM guest_groups WHERE group_name = ?',
          [group_name]
        );
        if (existing.length > 0) {
          groupCache[group_name] = existing[0].id;
        } else {
          const [result] = await connection.query(
            'INSERT INTO guest_groups (group_name, phone_no, invited_by) VALUES (?, ?, ?)',
            [group_name, phone_no || '', invited_by || 'Groom']
          );
          groupCache[group_name] = result.insertId;
          console.log(`Created group: ${group_name} (id=${result.insertId})`);
        }
      }

      const groupId = groupCache[group_name];
      const tableVal = table_no ? Number(table_no) : null;
      const seatVal = seat_no ? Number(seat_no) : null;

      await connection.query(
        'INSERT INTO guests (group_id, designation, first_name, last_name, attendance, table_no, seat_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [groupId, designation, first_name, last_name, 'Pending', tableVal, seatVal]
      );
      console.log(`  Added guest: ${designation} ${first_name} ${last_name} -> group "${group_name}"`);
    }

    await connection.commit();
    console.log(`\nImport complete. ${rows.length} guest row(s) processed.`);
  } catch (err) {
    await connection.rollback();
    console.error('Import failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

importGuests();
