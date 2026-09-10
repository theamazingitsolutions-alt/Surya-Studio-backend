import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { initDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '../dist');

// Initialize tables and default studio config
initDB();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper to format client with programs
function getClientWithPrograms(clientRow) {
  if (!clientRow) return null;
  const programsStmt = db.prepare('SELECT * FROM client_programs WHERE client_id = ? ORDER BY day_number ASC, date ASC');
  const programRows = programsStmt.all(clientRow.id);

  return {
    id: clientRow.id,
    groomName: clientRow.groom_name || '',
    brideName: clientRow.bride_name || '',
    clientName: clientRow.bride_name ? `${clientRow.groom_name} & ${clientRow.bride_name}` : clientRow.groom_name,
    phone: clientRow.phone || '',
    email: clientRow.email || '',
    address: clientRow.address || '',
    weddingStartDate: clientRow.wedding_start_date || '',
    weddingEndDate: clientRow.wedding_end_date || '',
    weddingDate: clientRow.wedding_start_date || '',
    durationDays: clientRow.duration_days || '1 Day',
    venue: clientRow.venue || '',
    events: clientRow.events || 'Wedding Shoot',
    packageTitle: clientRow.package_title || '',
    contractTotal: Number(clientRow.contract_total) || 0,
    paidAmount: Number(clientRow.paid_amount) || 0,
    pendingBalance: Number(clientRow.pending_balance) || 0,
    status: clientRow.status || 'Pending',
    assignedCrew: clientRow.assigned_crew || 'Main Team',
    physicalGifts: clientRow.physical_gifts ? JSON.parse(clientRow.physical_gifts) : [],
    deliverablesList: clientRow.deliverables_list ? JSON.parse(clientRow.deliverables_list) : [],
    createdAt: clientRow.created_at || '',
    programs: programRows.map(p => ({
      id: p.id,
      dayNumber: p.day_number,
      date: p.date,
      title: p.title,
      time: p.time,
      venue: p.venue,
      dressCode: p.dress_code,
      teamAssigned: p.team_assigned,
      coverageType: p.coverage_type,
      status: p.status,
      notes: p.notes
    }))
  };
}

// Helper to format invoice
function formatInvoice(invRow) {
  if (!invRow) return null;
  return {
    id: invRow.id,
    invoiceNumber: invRow.invoice_number || invRow.id,
    clientId: invRow.client_id,
    clientName: invRow.client_name,
    clientPhone: invRow.client_phone,
    clientEmail: invRow.client_email,
    clientAddress: invRow.client_address,
    invoiceDate: invRow.invoice_date,
    dueDate: invRow.due_date,
    weddingDate: invRow.wedding_date,
    venue: invRow.venue,
    events: invRow.events,
    status: invRow.status,
    paymentMode: invRow.payment_mode,
    subtotal: Number(invRow.subtotal) || 0,
    discount: Number(invRow.discount) || 0,
    taxableAmount: Number(invRow.taxable_amount) || 0,
    cgstRate: Number(invRow.cgst_rate) || 0,
    cgstAmount: Number(invRow.cgst_amount) || 0,
    sgstRate: Number(invRow.sgst_rate) || 0,
    sgstAmount: Number(invRow.sgst_amount) || 0,
    igstRate: Number(invRow.igst_rate) || 0,
    igstAmount: Number(invRow.igst_amount) || 0,
    grandTotal: Number(invRow.grand_total) || 0,
    paidAmount: Number(invRow.paid_amount) || 0,
    pendingBalance: Number(invRow.pending_balance) || 0,
    items: invRow.items_json ? JSON.parse(invRow.items_json) : [],
    milestones: invRow.milestones_json ? JSON.parse(invRow.milestones_json) : [],
    physicalGifts: invRow.physical_gifts_json ? JSON.parse(invRow.physical_gifts_json) : [],
    notes: invRow.notes,
    terms: invRow.terms,
    createdAt: invRow.created_at
  };
}

// Helper to format studio
function getStudioSettings() {
  const row = db.prepare('SELECT * FROM studio_settings WHERE id = 1').get();
  if (!row) return null;
  return {
    studio: {
      name: row.studio_name,
      tagline: row.tagline,
      gstNumber: row.gstin,
      panNumber: row.pan,
      address: row.address,
      city: row.city,
      stateName: row.state_name,
      stateCode: row.state_code,
      pincode: row.pincode,
      phone: row.phone,
      email: row.email,
      website: row.website,
      bankDetails: {
        bankName: row.bank_name,
        accountName: row.account_name,
        accountNumber: row.account_number,
        ifscCode: row.ifsc_code,
        branch: row.branch,
        upiId: row.upi_id
      },
      termsAndConditions: row.terms_and_conditions
    },
    accounts: {
      mainVaultBalance: Number(row.main_vault_balance) || 0,
      monthlyOperatingBudget: 250000,
      emergencyReserve: 500000
    }
  };
}

// ----------------------
// API ROUTES
// ----------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), database: 'SQLite (surya_studio.sqlite)' });
});

// Bootstrap / Full initial data load
app.get('/api/bootstrap', (req, res) => {
  try {
    const studioConfig = getStudioSettings();
    const clientsRows = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    const clients = clientsRows.map(getClientWithPrograms);

    const invoicesRows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
    const invoices = invoicesRows.map(formatInvoice);

    const expensesRows = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
    const expenses = expensesRows.map(e => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: Number(e.amount) || 0,
      date: e.date,
      paymentMode: e.payment_mode,
      notes: e.notes,
      createdAt: e.created_at
    }));

    const crewRows = db.prepare('SELECT * FROM crew_members').all();
    const gearRows = db.prepare('SELECT * FROM gear_inventory').all();
    const presetRows = db.prepare('SELECT * FROM crew_presets').all();
    const pkgRows = db.prepare('SELECT * FROM gear_packages').all();

    res.json({
      success: true,
      studio: studioConfig.studio,
      accounts: studioConfig.accounts,
      clients,
      invoices,
      expenses,
      crewMembers: crewRows.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email,
        dayRate: Number(c.day_rate) || 0,
        status: c.status,
        skills: c.skills ? c.skills.split(',') : []
      })),
      gearInventory: gearRows.map(g => ({
        id: g.id,
        name: g.name,
        category: g.category,
        serialNumber: g.serial_number,
        condition: g.condition,
        dailyCost: Number(g.daily_cost) || 0,
        status: g.status
      })),
      crewPresets: presetRows.map(p => ({
        id: p.id,
        name: p.name,
        teamLeader: p.team_leader,
        members: p.members_json ? JSON.parse(p.members_json) : []
      })),
      gearPackages: pkgRows.map(pkg => ({
        id: pkg.id,
        category: pkg.category,
        items: pkg.items_json ? JSON.parse(pkg.items_json) : []
      }))
    });
  } catch (err) {
    console.error('Error fetching bootstrap data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/invoices
app.get('/api/invoices', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
    res.json(rows.map(formatInvoice));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoices
app.post('/api/invoices', (req, res) => {
  try {
    const inv = req.body;
    const invId = inv.id || `INV-${Date.now()}`;
    const invoiceNumber = inv.invoiceNumber || inv.id;

    // Check if client exists, if not insert or update
    const clientId = inv.clientId || `cli-${Date.now()}`;
    const existingClient = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);

    const groom = inv.groomName || inv.clientName?.split('&')[0]?.trim() || inv.clientName || 'Client';
    const bride = inv.brideName || inv.clientName?.split('&')[1]?.trim() || '';
    const pending = inv.pendingBalance !== undefined ? inv.pendingBalance : (inv.grandTotal - (inv.paidAmount || 0));
    const status = (pending === 0 || inv.paidAmount >= inv.grandTotal) ? 'Paid in Full' : 'Pending Balance';

    if (existingClient) {
      const updateClientStmt = db.prepare(`
        UPDATE clients SET
          contract_total = ?,
          paid_amount = ?,
          pending_balance = ?,
          status = ?,
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address = COALESCE(?, address),
          wedding_start_date = COALESCE(?, wedding_start_date),
          venue = COALESCE(?, venue)
        WHERE id = ?
      `);
      updateClientStmt.run(
        inv.grandTotal || 0,
        inv.paidAmount || 0,
        pending,
        status,
        inv.clientPhone || null,
        inv.clientEmail || null,
        inv.clientAddress || null,
        inv.weddingDate || null,
        inv.venue || null,
        clientId
      );
    } else {
      const insertClientStmt = db.prepare(`
        INSERT INTO clients (
          id, groom_name, bride_name, phone, email, address,
          wedding_start_date, wedding_end_date, duration_days,
          venue, events, package_title, contract_total,
          paid_amount, pending_balance, status, assigned_crew,
          physical_gifts, deliverables_list, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `);
      insertClientStmt.run(
        clientId,
        groom,
        bride,
        inv.clientPhone || '',
        inv.clientEmail || '',
        inv.clientAddress || '',
        inv.weddingDate || new Date().toISOString().split('T')[0],
        inv.weddingDate || new Date().toISOString().split('T')[0],
        '3 Days',
        inv.venue || 'Jaipur',
        inv.events || 'Wedding Photography & Cinema',
        `Invoice #${invId}`,
        inv.grandTotal || 0,
        inv.paidAmount || 0,
        pending,
        status,
        'Lead Cine & Candid Team',
        JSON.stringify(inv.physicalGifts || []),
        JSON.stringify([]),
        new Date().toISOString()
      );
    }

    // Insert or replace Invoice
    const insertInvoiceStmt = db.prepare(`
      INSERT OR REPLACE INTO invoices (
        id, invoice_number, client_id, client_name, client_phone, client_email, client_address,
        invoice_date, due_date, wedding_date, venue, events, status, payment_mode,
        subtotal, discount, taxable_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
        igst_rate, igst_amount, grand_total, paid_amount, pending_balance,
        items_json, milestones_json, physical_gifts_json, notes, terms, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    insertInvoiceStmt.run(
      invId,
      invoiceNumber,
      clientId,
      inv.clientName || `${groom} & ${bride}`,
      inv.clientPhone || '',
      inv.clientEmail || '',
      inv.clientAddress || '',
      inv.invoiceDate || new Date().toISOString().split('T')[0],
      inv.dueDate || '',
      inv.weddingDate || '',
      inv.venue || '',
      inv.events || '',
      inv.status || (pending === 0 ? 'Paid' : 'Pending'),
      inv.paymentMode || 'Bank Transfer',
      inv.subtotal || 0,
      inv.discount || 0,
      inv.taxableAmount || 0,
      inv.cgstRate || 0,
      inv.cgstAmount || 0,
      inv.sgstRate || 0,
      inv.sgstAmount || 0,
      inv.igstRate || 0,
      inv.igstAmount || 0,
      inv.grandTotal || 0,
      inv.paidAmount || 0,
      pending,
      JSON.stringify(inv.items || []),
      JSON.stringify(inv.milestones || []),
      JSON.stringify(inv.physicalGifts || []),
      inv.notes || '',
      inv.terms || '',
      inv.createdAt || new Date().toISOString()
    );

    const saved = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    res.json({ success: true, invoice: formatInvoice(saved) });
  } catch (err) {
    console.error('Error saving invoice:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/invoices/:id
app.put('/api/invoices/:id', (req, res) => {
  try {
    const invId = req.params.id;
    const inv = req.body;
    const pending = inv.pendingBalance !== undefined ? inv.pendingBalance : (inv.grandTotal - (inv.paidAmount || 0));

    const updateInvoiceStmt = db.prepare(`
      UPDATE invoices SET
        client_name = ?,
        client_phone = ?,
        client_email = ?,
        client_address = ?,
        invoice_date = ?,
        due_date = ?,
        wedding_date = ?,
        venue = ?,
        events = ?,
        status = ?,
        payment_mode = ?,
        subtotal = ?,
        discount = ?,
        taxable_amount = ?,
        cgst_rate = ?,
        cgst_amount = ?,
        sgst_rate = ?,
        sgst_amount = ?,
        igst_rate = ?,
        igst_amount = ?,
        grand_total = ?,
        paid_amount = ?,
        pending_balance = ?,
        items_json = ?,
        milestones_json = ?,
        physical_gifts_json = ?,
        notes = ?,
        terms = ?
      WHERE id = ?
    `);

    updateInvoiceStmt.run(
      inv.clientName || '',
      inv.clientPhone || '',
      inv.clientEmail || '',
      inv.clientAddress || '',
      inv.invoiceDate || '',
      inv.dueDate || '',
      inv.weddingDate || '',
      inv.venue || '',
      inv.events || '',
      inv.status || 'Pending',
      inv.paymentMode || 'Bank Transfer',
      inv.subtotal || 0,
      inv.discount || 0,
      inv.taxableAmount || 0,
      inv.cgstRate || 0,
      inv.cgstAmount || 0,
      inv.sgstRate || 0,
      inv.sgstAmount || 0,
      inv.igstRate || 0,
      inv.igstAmount || 0,
      inv.grandTotal || 0,
      inv.paidAmount || 0,
      pending,
      JSON.stringify(inv.items || []),
      JSON.stringify(inv.milestones || []),
      JSON.stringify(inv.physicalGifts || []),
      inv.notes || '',
      inv.terms || '',
      invId
    );

    // Also update matching client if clientId exists
    if (inv.clientId) {
      db.prepare(`
        UPDATE clients SET
          contract_total = ?,
          paid_amount = ?,
          pending_balance = ?,
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          venue = COALESCE(?, venue),
          wedding_start_date = COALESCE(?, wedding_start_date)
        WHERE id = ?
      `).run(
        inv.grandTotal || 0,
        inv.paidAmount || 0,
        pending,
        inv.clientPhone || null,
        inv.clientEmail || null,
        inv.venue || null,
        inv.weddingDate || null,
        inv.clientId
      );
    }

    const saved = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    res.json({ success: true, invoice: formatInvoice(saved) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/invoices/:id
app.delete('/api/invoices/:id', (req, res) => {
  try {
    const invId = req.params.id;
    const inv = db.prepare('SELECT client_id FROM invoices WHERE id = ?').get(invId);
    db.prepare('DELETE FROM invoices WHERE id = ?').run(invId);

    // If client has no remaining invoices, clean client too
    if (inv && inv.client_id) {
      const other = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE client_id = ?').get(inv.client_id);
      if (other.count === 0) {
        db.prepare('DELETE FROM clients WHERE id = ?').run(inv.client_id);
      }
    }

    res.json({ success: true, id: invId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clients
app.get('/api/clients', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    res.json(rows.map(getClientWithPrograms));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
app.post('/api/clients', (req, res) => {
  try {
    const c = req.body;
    const id = c.id || `cli-${Date.now()}`;
    const groom = c.groomName || c.clientName?.split('&')[0]?.trim() || c.clientName || 'Client';
    const bride = c.brideName || c.clientName?.split('&')[1]?.trim() || '';

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO clients (
        id, groom_name, bride_name, phone, email, address,
        wedding_start_date, wedding_end_date, duration_days,
        venue, events, package_title, contract_total,
        paid_amount, pending_balance, status, assigned_crew,
        physical_gifts, deliverables_list, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      id,
      groom,
      bride,
      c.phone || '',
      c.email || '',
      c.address || '',
      c.weddingStartDate || c.weddingDate || new Date().toISOString().split('T')[0],
      c.weddingEndDate || c.weddingDate || new Date().toISOString().split('T')[0],
      c.durationDays || '1 Day',
      c.venue || 'Jaipur',
      c.events || 'Wedding Photography',
      c.packageTitle || 'Custom Package',
      Number(c.contractTotal) || 0,
      Number(c.paidAmount) || 0,
      Number(c.pendingBalance) || 0,
      c.status || 'Pending',
      c.assignedCrew || 'Main Team',
      JSON.stringify(c.physicalGifts || []),
      JSON.stringify(c.deliverablesList || []),
      c.createdAt || new Date().toISOString()
    );

    const saved = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json({ success: true, client: getClientWithPrograms(saved) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/clients/:id
app.put('/api/clients/:id', (req, res) => {
  try {
    const id = req.params.id;
    const c = req.body;

    const stmt = db.prepare(`
      UPDATE clients SET
        groom_name = COALESCE(?, groom_name),
        bride_name = COALESCE(?, bride_name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        wedding_start_date = COALESCE(?, wedding_start_date),
        wedding_end_date = COALESCE(?, wedding_end_date),
        duration_days = COALESCE(?, duration_days),
        venue = COALESCE(?, venue),
        events = COALESCE(?, events),
        package_title = COALESCE(?, package_title),
        contract_total = COALESCE(?, contract_total),
        paid_amount = COALESCE(?, paid_amount),
        pending_balance = COALESCE(?, pending_balance),
        status = COALESCE(?, status),
        assigned_crew = COALESCE(?, assigned_crew),
        physical_gifts = COALESCE(?, physical_gifts),
        deliverables_list = COALESCE(?, deliverables_list)
      WHERE id = ?
    `);

    stmt.run(
      c.groomName || null,
      c.brideName || null,
      c.phone || null,
      c.email || null,
      c.address || null,
      c.weddingStartDate || null,
      c.weddingEndDate || null,
      c.durationDays || null,
      c.venue || null,
      c.events || null,
      c.packageTitle || null,
      c.contractTotal !== undefined ? Number(c.contractTotal) : null,
      c.paidAmount !== undefined ? Number(c.paidAmount) : null,
      c.pendingBalance !== undefined ? Number(c.pendingBalance) : null,
      c.status || null,
      c.assignedCrew || null,
      c.physicalGifts ? JSON.stringify(c.physicalGifts) : null,
      c.deliverablesList ? JSON.stringify(c.deliverablesList) : null,
      id
    );

    const saved = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json({ success: true, client: getClientWithPrograms(saved) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/clients/:id
app.delete('/api/clients/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM client_programs WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM invoices WHERE client_id = ?').run(id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Record Payment for client & invoice
app.post('/api/clients/:id/payment', (req, res) => {
  try {
    const clientId = req.params.id;
    const { amount, paymentMode: _paymentMode = 'Bank Transfer', note: _note = '' } = req.body;
    const numAmount = Number(amount) || 0;

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const newPaid = (Number(client.paid_amount) || 0) + numAmount;
    const newPending = Math.max(0, (Number(client.contract_total) || 0) - newPaid);
    const newStatus = newPending === 0 ? 'Paid in Full' : 'In Progress';

    db.prepare(`
      UPDATE clients SET
        paid_amount = ?,
        pending_balance = ?,
        status = ?
      WHERE id = ?
    `).run(newPaid, newPending, newStatus, clientId);

    // Also update invoices for this client
    const invoices = db.prepare('SELECT * FROM invoices WHERE client_id = ?').all(clientId);
    for (const inv of invoices) {
      const invPaid = (Number(inv.paid_amount) || 0) + numAmount;
      const invPending = Math.max(0, (Number(inv.grand_total) || 0) - invPaid);
      const invStatus = invPending === 0 ? 'Paid' : 'Partial';

      db.prepare(`
        UPDATE invoices SET
          paid_amount = ?,
          pending_balance = ?,
          status = ?
        WHERE id = ?
      `).run(invPaid, invPending, invStatus, inv.id);
    }

    // Add to studio vault balance
    db.prepare('UPDATE studio_settings SET main_vault_balance = main_vault_balance + ? WHERE id = 1').run(numAmount);

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    res.json({ success: true, client: getClientWithPrograms(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Programs for client
app.post('/api/clients/:id/programs', (req, res) => {
  try {
    const clientId = req.params.id;
    const p = req.body;
    const programId = p.id || `prg-${Date.now()}`;

    const stmt = db.prepare(`
      INSERT INTO client_programs (
        id, client_id, day_number, date, title, time, venue,
        dress_code, team_assigned, coverage_type, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      programId,
      clientId,
      Number(p.dayNumber) || 1,
      p.date || new Date().toISOString().split('T')[0],
      p.title || 'Wedding Function',
      p.time || '06:00 PM - 10:00 PM',
      p.venue || 'Main Lawn',
      p.dressCode || 'Festive',
      p.teamAssigned || 'Photo + Video Team',
      p.coverageType || 'Candid + Cinema',
      p.status || 'Upcoming',
      p.notes || ''
    );

    const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    res.json({ success: true, client: getClientWithPrograms(updatedClient) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete program
app.delete('/api/clients/:id/programs/:programId', (req, res) => {
  try {
    const { id, programId } = req.params;
    db.prepare('DELETE FROM client_programs WHERE id = ? AND client_id = ?').run(programId, id);
    const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json({ success: true, client: getClientWithPrograms(updatedClient) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/expenses
app.get('/api/expenses', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
    res.json(rows.map(e => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: Number(e.amount) || 0,
      date: e.date,
      paymentMode: e.payment_mode,
      notes: e.notes,
      createdAt: e.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses
app.post('/api/expenses', (req, res) => {
  try {
    const exp = req.body;
    const id = exp.id || `exp-${Date.now()}`;
    const amount = Number(exp.amount) || 0;

    const stmt = db.prepare(`
      INSERT INTO expenses (id, title, category, amount, date, payment_mode, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      exp.title || 'Expense',
      exp.category || 'General',
      amount,
      exp.date || new Date().toISOString().split('T')[0],
      exp.paymentMode || 'Online',
      exp.notes || '',
      new Date().toISOString()
    );

    // Deduct from studio vault balance
    db.prepare('UPDATE studio_settings SET main_vault_balance = MAX(0, main_vault_balance - ?) WHERE id = 1').run(amount);

    res.json({
      success: true,
      expense: {
        id,
        title: exp.title,
        category: exp.category,
        amount,
        date: exp.date,
        paymentMode: exp.paymentMode,
        notes: exp.notes
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', (req, res) => {
  try {
    const id = req.params.id;
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/studio
app.get('/api/studio', (req, res) => {
  try {
    const data = getStudioSettings();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/studio
app.put('/api/studio', (req, res) => {
  try {
    const { studio, accounts } = req.body;
    if (studio) {
      db.prepare(`
        UPDATE studio_settings SET
          studio_name = COALESCE(?, studio_name),
          tagline = COALESCE(?, tagline),
          gstin = COALESCE(?, gstin),
          pan = COALESCE(?, pan),
          address = COALESCE(?, address),
          city = COALESCE(?, city),
          state_name = COALESCE(?, state_name),
          state_code = COALESCE(?, state_code),
          pincode = COALESCE(?, pincode),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          website = COALESCE(?, website),
          bank_name = COALESCE(?, bank_name),
          account_name = COALESCE(?, account_name),
          account_number = COALESCE(?, account_number),
          ifsc_code = COALESCE(?, ifsc_code),
          branch = COALESCE(?, branch),
          upi_id = COALESCE(?, upi_id),
          terms_and_conditions = COALESCE(?, terms_and_conditions),
          updated_at = ?
        WHERE id = 1
      `).run(
        studio.name || null,
        studio.tagline || null,
        studio.gstNumber || null,
        studio.panNumber || null,
        studio.address || null,
        studio.city || null,
        studio.stateName || null,
        studio.stateCode || null,
        studio.pincode || null,
        studio.phone || null,
        studio.email || null,
        studio.website || null,
        studio.bankDetails?.bankName || null,
        studio.bankDetails?.accountName || null,
        studio.bankDetails?.accountNumber || null,
        studio.bankDetails?.ifscCode || null,
        studio.bankDetails?.branch || null,
        studio.bankDetails?.upiId || null,
        studio.termsAndConditions || null,
        new Date().toISOString()
      );
    }
    if (accounts && accounts.mainVaultBalance !== undefined) {
      db.prepare('UPDATE studio_settings SET main_vault_balance = ? WHERE id = 1').run(Number(accounts.mainVaultBalance) || 0);
    }
    res.json({ success: true, ...getStudioSettings() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve static React build in production
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Surya Studio Backend] SQL API Server running on port ${PORT}`);
});
