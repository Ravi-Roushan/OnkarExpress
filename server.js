require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { sendBookingNotification, sendCustomerConfirmation } = require('./mailer');
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------
// Helper: rate calculation (same logic as frontend)
// ---------------------------------------------
const FAR_CITIES = ['Bhagalpur','Kahalgaon','Naugachia','Banka','Sultanganj','Sahebganj','Pirpanti','Godda'];
function calculateRate(weight, toCity) {
  const w = Number(weight) || 0;
  const dist = FAR_CITIES.includes(toCity) ? 1.5 : 1;
  return Math.round((60 + w * 20) * dist);
}

// ---------------------------------------------
// Admin auth middleware (simple header-based)
// ---------------------------------------------
function requireAdmin(req, res, next) {
  const user = req.headers['x-admin-username'];
  const pass = req.headers['x-admin-password'];
  if (
    user === (process.env.ADMIN_USERNAME || 'admin') &&
    pass === (process.env.ADMIN_PASSWORD || 'ChangeThisPassword123')
  ) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---------------------------------------------
// PUBLIC API: Create Booking
// ---------------------------------------------
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      senderName, senderPhone, senderEmail,
      fromCity, toCity, parcelType, weight, address,
      paymentMethod
    } = req.body;

    if (!senderName || !senderPhone || !fromCity || !toCity || !address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rate = calculateRate(weight, toCity);
    const awb = db.generateAWB();
    const now = new Date();

    const booking = {
      awb,
      senderName,
      senderPhone,
      senderEmail: senderEmail || null,
      fromCity,
      toCity,
      parcelType: parcelType || 'Parcel',
      weight: Number(weight) || 0,
      address,
      rate,
      paymentMethod: paymentMethod || 'COD',
      paymentStatus: paymentMethod === 'online' ? 'pending' : 'cash_on_delivery',
      razorpayOrderId: null,
      status: 'Booking Confirmed',
      createdAt: now.toISOString(),
      history: [
        { label: 'Booking Confirmed', time: now.toISOString(), done: true }
      ]
    };

    db.addBooking(booking);

    // Fire-and-forget email notifications (won't block response)
    sendBookingNotification(booking).catch(() => {});
    if (senderEmail) sendCustomerConfirmation(booking, senderEmail).catch(() => {});

    res.json({ success: true, awb, rate, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating booking' });
  }
});

// ---------------------------------------------
// PUBLIC API: Track Shipment
// ---------------------------------------------
app.get('/api/track/:awb', (req, res) => {
  const booking = db.getBookingByAWB(req.params.awb);
  if (!booking) {
    return res.status(404).json({ error: 'No shipment found with this tracking number' });
  }
  res.json({ success: true, booking });
});

// ---------------------------------------------
// PUBLIC API: Rate estimate (optional standalone endpoint)
// ---------------------------------------------
app.post('/api/estimate', (req, res) => {
  const { weight, toCity } = req.body;
  const rate = calculateRate(weight, toCity);
  res.json({ rate });
});

// ---------------------------------------------
// PAYMENT: Create Razorpay order
// ---------------------------------------------
app.post('/api/payment/create-order', async (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET ||
        process.env.RAZORPAY_KEY_ID.includes('xxxx')) {
      return res.status(400).json({
        error: 'Online payments are not configured yet. Please choose Cash on Pickup/Delivery, or contact the site admin.'
      });
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const { amount, awb } = req.body; // amount in INR
    if (!amount || !awb) return res.status(400).json({ error: 'amount and awb required' });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: awb,
      notes: { awb }
    });

    // Save order id against booking
    db.updateBooking(awb, { razorpayOrderId: order.id });

    res.json({ success: true, order, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ---------------------------------------------
// PAYMENT: Verify Razorpay payment (called after checkout success)
// ---------------------------------------------
app.post('/api/payment/verify', (req, res) => {
  try {
    const crypto = require('crypto');
    const { order_id, payment_id, signature, awb } = req.body;

    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === signature) {
      db.updateBooking(awb, { paymentStatus: 'paid' });
      db.addStatusUpdate(awb, {
        label: 'Payment Received',
        time: new Date().toISOString(),
        done: true
      });
      return res.json({ success: true });
    }
    res.status(400).json({ success: false, error: 'Signature verification failed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification error' });
  }
});

// ---------------------------------------------
// ADMIN API: Login check
// ---------------------------------------------
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === (process.env.ADMIN_USERNAME || 'admin') &&
    password === (process.env.ADMIN_PASSWORD || 'ChangeThisPassword123')
  ) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// ---------------------------------------------
// ADMIN API: Get all bookings
// ---------------------------------------------
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  res.json({ bookings: db.getAllBookings() });
});

// ---------------------------------------------
// ADMIN API: Update shipment status (adds tracking step)
// ---------------------------------------------
app.post('/api/admin/bookings/:awb/status', requireAdmin, (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });

  const updated = db.addStatusUpdate(req.params.awb, {
    label,
    time: new Date().toISOString(),
    done: true
  });

  if (!updated) return res.status(404).json({ error: 'Booking not found' });
  res.json({ success: true, booking: updated });
});

// Delete Booking
app.delete('/api/admin/bookings/:awb', requireAdmin, (req, res) => {
  const deleted = db.deleteBooking(req.params.awb);

  if (!deleted) {
    return res.status(404).json({ error: "Booking not found" });
  }

  res.json({
    success: true,
    message: "Booking deleted successfully"
  });
});

app.get("/api/admin/bookings/:awb/pdf", requireAdmin, (req, res) => {

    const booking = db.getBookingByAWB(req.params.awb);

    if (!booking) {
        return res.status(404).json({
            error: "Booking not found"
        });
    }

    const doc = new PDFDocument({
        margin: 50
    });

    res.setHeader(
        "Content-Type",
        "application/pdf"
    );

    res.setHeader(
        "Content-Disposition",
        `attachment; filename=${booking.awb}.pdf`
    );

    doc.pipe(res);

    doc
        .fontSize(24)
        .fillColor("#D32F2F")
        .text("ONKAR EXPRESS", {
            align: "center"
        });

    doc
        .fontSize(14)
        .fillColor("black")
        .text("Courier & Cargo Service", {
            align: "center"
        });

    doc.moveDown();

    doc.fontSize(18).text("Booking Receipt");

    doc.moveDown();

    doc.fontSize(12);

    doc.text(`Tracking No : ${booking.awb}`);
    doc.text(`Sender      : ${booking.senderName}`);
    doc.text(`Phone       : ${booking.senderPhone}`);
    doc.text(`Email       : ${booking.senderEmail || "-"}`);

    doc.moveDown();

    doc.text(`From        : ${booking.fromCity}`);
    doc.text(`To          : ${booking.toCity}`);

    doc.moveDown();

    doc.text(`Parcel      : ${booking.parcelType}`);
    doc.text(`Weight      : ${booking.weight} KG`);

    doc.moveDown();

    doc.text(`Amount      : ₹${booking.rate}`);
    doc.text(`Payment     : ${booking.paymentStatus}`);
    doc.text(`Status      : ${booking.status}`);

    doc.moveDown();

    doc.text(
        `Booked At   : ${new Date(
            booking.createdAt
        ).toLocaleString()}`
    );

    doc.moveDown(2);

    doc.fontSize(13).text(
        "Thank you for choosing Onkar Express.",
        {
            align: "center"
        }
    );

    doc.end();

});

// =============================================
// DISPATCH VEHICLE
// =============================================
app.post("/api/admin/dispatch", requireAdmin, (req, res) => {

    try {

        const { vehicleNo, driverName, awbs } = req.body;

        if (
            !vehicleNo ||
            !driverName ||
            !Array.isArray(awbs) ||
            awbs.length === 0
        ) {
            return res.status(400).json({
                error: "Missing dispatch data"
            });
        }
        const dispatch = {
            dispatchId:
                "DSP" + Date.now(),
            vehicleNo,
            driverName,
            date:
                new Date().toISOString(),
            awbs
        };
        db.addDispatch(dispatch);

        // Update booking status
        awbs.forEach(awb => {
            db.addStatusUpdate(awb, {
                label: "Loaded in Vehicle",
                time: new Date().toISOString(),
                done: true
            });
        });
        res.json({
            success: true,
            dispatch
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: "Dispatch Failed"
        });
    }
});
// ---------------------------------------------
// Serve admin dashboard
// ---------------------------------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------------------------------------------
// Fallback to index.html for root
// ---------------------------------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get("/api/admin/export", requireAdmin, async (req, res) => {
    try {

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Bookings");

        sheet.columns = [
            { header: "AWB", key: "awb", width: 18 },
            { header: "Sender", key: "senderName", width: 25 },
            { header: "Phone", key: "senderPhone", width: 18 },
            { header: "Email", key: "senderEmail", width: 30 },
            { header: "From", key: "fromCity", width: 18 },
            { header: "To", key: "toCity", width: 18 },
            { header: "Parcel", key: "parcelType", width: 18 },
            { header: "Weight", key: "weight", width: 12 },
            { header: "Amount", key: "rate", width: 12 },
            { header: "Payment", key: "paymentStatus", width: 18 },
            { header: "Status", key: "status", width: 28 },
            { header: "Booked At", key: "createdAt", width: 24 }
        ];

        sheet.getRow(1).font = { bold: true };

        db.getAllBookings().forEach(b => {
            sheet.addRow({
                awb: b.awb,
                senderName: b.senderName,
                senderPhone: b.senderPhone,
                senderEmail: b.senderEmail || "",
                fromCity: b.fromCity,
                toCity: b.toCity,
                parcelType: b.parcelType,
                weight: b.weight,
                rate: b.rate,
                paymentStatus: b.paymentStatus,
                status: b.status,
                createdAt: new Date(b.createdAt).toLocaleString()
            });
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=OnkarExpressBookings.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("EXPORT ERROR:", err);
        res.status(500).json({
            error: err.message
        });
    }
});

app.listen(PORT, () => {
  console.log(`\n  Onkar Express server running!`);
  console.log(`  Website:  http://localhost:${PORT}`);
  console.log(`  Admin:    http://localhost:${PORT}/admin\n`);
});
