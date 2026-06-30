const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // Email not configured
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Notify business owner of a new booking
async function sendBookingNotification(booking) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log('[Email] SMTP not configured - skipping owner notification email.');
    return { sent: false, reason: 'not_configured' };
  }

  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;

  const html = `
    <h2>New Booking Received - ${booking.awb}</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">
      <tr><td><b>Tracking No (AWB)</b></td><td>${booking.awb}</td></tr>
      <tr><td><b>Sender Name</b></td><td>${booking.senderName}</td></tr>
      <tr><td><b>Sender Phone</b></td><td>${booking.senderPhone}</td></tr>
      <tr><td><b>From</b></td><td>${booking.fromCity}</td></tr>
      <tr><td><b>To</b></td><td>${booking.toCity}</td></tr>
      <tr><td><b>Parcel Type</b></td><td>${booking.parcelType}</td></tr>
      <tr><td><b>Weight</b></td><td>${booking.weight} kg</td></tr>
      <tr><td><b>Delivery Address</b></td><td>${booking.address}</td></tr>
      <tr><td><b>Estimated Rate</b></td><td>₹${booking.rate}</td></tr>
      <tr><td><b>Payment Method</b></td><td>${booking.paymentMethod}</td></tr>
      <tr><td><b>Payment Status</b></td><td>${booking.paymentStatus}</td></tr>
      <tr><td><b>Booked At</b></td><td>${booking.createdAt}</td></tr>
    </table>
  `;

  try {
    await transporter.sendMail({
      from: `"Onkar Express Website" <${process.env.SMTP_USER}>`,
      to,
      subject: `New Booking - ${booking.awb} (${booking.fromCity} -> ${booking.toCity})`,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send notification:', err.message);
    return { sent: false, reason: err.message };
  }
}

// Send confirmation to customer (optional, only if customer email provided in future)
async function sendCustomerConfirmation(booking, customerEmail) {
  const transporter = getTransporter();
  if (!transporter || !customerEmail) return { sent: false };

  try {
    await transporter.sendMail({
      from: `"Onkar Express" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Booking Confirmed - ${booking.awb}`,
      html: `<p>Hi ${booking.senderName},</p>
             <p>Your shipment from <b>${booking.fromCity}</b> to <b>${booking.toCity}</b> has been booked.</p>
             <p>Your tracking number is: <b>${booking.awb}</b></p>
             <p>Estimated rate: ₹${booking.rate}</p>
             <p>Track your shipment anytime on our website.</p>
             <p>Thank you for choosing Onkar Express!</p>`
    });
    return { sent: true };
  } catch (err) {
    console.error('[Email] Failed to send customer confirmation:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendBookingNotification, sendCustomerConfirmation };
