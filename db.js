const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'bookings.json');

// Ensure data file exists
function ensureDB() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ bookings: [] }, null, 2)
    );
  }

  // Dispatch database create karega
  if (!fs.existsSync(DISPATCH_FILE)) {
    fs.writeFileSync(
      DISPATCH_FILE,
      JSON.stringify({ dispatches: [] }, null, 2)
    );
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { bookings: [] };
  }
}

function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getAllBookings() {
  return readDB().bookings;
}

function getBookingByAWB(awb) {
  const db = readDB();
  return db.bookings.find(b => b.awb.toUpperCase() === awb.toUpperCase());
}

function addBooking(booking) {
  const db = readDB();
  db.bookings.unshift(booking); // newest first
  writeDB(db);
  return booking;
}

function updateBooking(awb, updates) {
  const db = readDB();
  const idx = db.bookings.findIndex(b => b.awb.toUpperCase() === awb.toUpperCase());
  if (idx === -1) return null;
  db.bookings[idx] = { ...db.bookings[idx], ...updates };
  writeDB(db);
  return db.bookings[idx];
}

function addStatusUpdate(awb, statusEntry) {
  const db = readDB();
  const idx = db.bookings.findIndex(b => b.awb.toUpperCase() === awb.toUpperCase());
  if (idx === -1) return null;
  db.bookings[idx].history.push(statusEntry);
  db.bookings[idx].status = statusEntry.label;
  writeDB(db);
  return db.bookings[idx];
}

// Generate a unique AWB / tracking number e.g. OE25061312345
function deleteBooking(awb) {
  const db = readDB();
  const index = db.bookings.findIndex(
    b => b.awb.toUpperCase() === awb.toUpperCase()
  );
  if (index === -1) {
    return false;
  }
  db.bookings.splice(index, 1);
  writeDB(db);
  return true;
}

function generateAWB() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OE${yy}${mm}${dd}${rand}`;
}

module.exports = {
  getAllBookings,
  getBookingByAWB,
  addBooking,
  updateBooking,
  addStatusUpdate,
  deleteBooking,
  generateAWB
};

const DISPATCH_FILE = path.join(__dirname, 'data', 'dispatches.json');