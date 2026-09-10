import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'surya_studio.sqlite');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for performance & foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      studio_name TEXT NOT NULL,
      tagline TEXT,
      gstin TEXT NOT NULL,
      pan TEXT,
      address TEXT,
      city TEXT,
      state_name TEXT,
      state_code TEXT,
      pincode TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      bank_name TEXT,
      account_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      branch TEXT,
      upi_id TEXT,
      terms_and_conditions TEXT,
      main_vault_balance REAL DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      groom_name TEXT,
      bride_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      wedding_start_date TEXT,
      wedding_end_date TEXT,
      duration_days TEXT,
      venue TEXT,
      events TEXT,
      package_title TEXT,
      contract_total REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      pending_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      assigned_crew TEXT,
      physical_gifts TEXT,
      deliverables_list TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS client_programs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      day_number INTEGER DEFAULT 1,
      date TEXT,
      title TEXT,
      time TEXT,
      venue TEXT,
      dress_code TEXT,
      team_assigned TEXT,
      coverage_type TEXT,
      status TEXT DEFAULT 'Upcoming',
      notes TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      client_address TEXT,
      invoice_date TEXT,
      due_date TEXT,
      wedding_date TEXT,
      venue TEXT,
      events TEXT,
      status TEXT DEFAULT 'Pending',
      payment_mode TEXT,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      cgst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_rate REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_rate REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      pending_balance REAL DEFAULT 0,
      items_json TEXT,
      milestones_json TEXT,
      physical_gifts_json TEXT,
      notes TEXT,
      terms TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_mode TEXT,
      notes TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS crew_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      email TEXT,
      day_rate REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      skills TEXT
    );

    CREATE TABLE IF NOT EXISTS gear_inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      serial_number TEXT,
      condition TEXT,
      daily_cost REAL DEFAULT 0,
      status TEXT DEFAULT 'Available'
    );

    CREATE TABLE IF NOT EXISTS crew_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      team_leader TEXT,
      members_json TEXT
    );

    CREATE TABLE IF NOT EXISTS gear_packages (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      items_json TEXT
    );
  `);

  // Seed default official studio profile if empty
  const studioCountStmt = db.prepare('SELECT COUNT(*) as count FROM studio_settings');
  const count = studioCountStmt.get().count;
  if (count === 0) {
    const insertStudio = db.prepare(`
      INSERT INTO studio_settings (
        id, studio_name, tagline, gstin, pan, address, city,
        state_name, state_code, pincode, phone, email, website,
        bank_name, account_name, account_number, ifsc_code, branch, upi_id,
        terms_and_conditions, main_vault_balance, updated_at
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    insertStudio.run(
      "SURYA STUDIO",
      "Cinematic Luxury Wedding Films & High-End Photography",
      "08BRZPJ6764R1ZB",
      "BRZPJ6764R",
      "Plot No. 12, Maharani Farm, Durgapura, Tonk Road",
      "Jaipur",
      "Rajasthan",
      "08",
      "302018",
      "+91 98290 12345 / +91 94140 54321",
      "contact@suryastudio.in",
      "www.suryastudio.in",
      "Kotak Mahindra Bank",
      "Surya Studio LLP",
      "1548454652",
      "KKBK0000271",
      "Tonk Road, Jaipur",
      "surya.studio@kotak",
      "1. All deliverables timelines start after selection of photos.\n2. Raw footage backup guaranteed for 90 days after delivery.\n3. GST 18% (SAC 998381) applicable as per Indian Tax rules.\n4. Dispute jurisdiction subject to Jaipur Courts only.",
      0,
      new Date().toISOString()
    );
  }
}

export default db;
