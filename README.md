# Onkar Express - Full Booking System

A complete courier booking website with:
- Public website (homepage, routes, services, booking form, tracking)
- Backend server (Node.js + Express) that saves bookings
- Live tracking using real booking data
- Email notifications when a new booking is placed
- Admin dashboard to view bookings and update shipment status
- Optional online payment via Razorpay (UPI/Cards/Netbanking)

---

## 1. Folder Structure

```
OnkarExpress/
├── server.js          ← main backend server
├── db.js               ← simple JSON-file database
├── mailer.js           ← email notification logic
├── package.json
├── .env.example        ← copy this to .env and fill in your details
├── data/
│   └── bookings.json    ← all bookings get saved here automatically
└── public/
    ├── index.html       ← main website
    ├── style.css
    ├── script.js
    ├── admin.html        ← admin dashboard
    └── admin.js
```

---

## 2. Requirements

- Install **Node.js** (v18 or higher) from https://nodejs.org if you don't have it.
- Check it's installed by running:
  ```
  node -v
  npm -v
  ```

---

## 3. Setup Steps

### Step 1 - Open a terminal in the project folder
```
cd OnkarExpress
```

### Step 2 - Install dependencies
```
npm install
```

### Step 3 - Create your configuration file
Copy `.env.example` to a new file called `.env`:

**Windows (PowerShell):**
```
copy .env.example .env
```

**Mac/Linux:**
```
cp .env.example .env
```

Then open `.env` in a text editor and fill in your details (see Section 5, 6, 7 below for how to get each value). At minimum, **change `ADMIN_PASSWORD`** to something only you know.

### Step 4 - Start the server
```
npm start
```

You should see:
```
  Onkar Express server running!
  Website:  http://localhost:5500
  Admin:    http://localhost:5500/admin
```

### Step 5 - Open the website
Go to **http://localhost:5500** in your browser.

### Step 6 - Open the admin dashboard
Go to **http://localhost:5500/admin**
- Username: whatever you set as `ADMIN_USERNAME` (default: `admin`)
- Password: whatever you set as `ADMIN_PASSWORD`

---

## 4. How Booking & Tracking Works Now

1. A customer fills the booking form on the website and submits.
2. The server:
   - Generates a unique tracking number (AWB), e.g. `OE26061312345`
   - Saves the booking permanently in `data/bookings.json`
   - Sends YOU an email notification (if email is configured - see Section 6)
   - Shows the customer their tracking number on screen
3. The customer (or anyone) can enter that tracking number in the "Live Shipment Tracker" box to see real status.
4. You (the admin) log into `/admin`, see all bookings, and update each shipment's status (e.g. "In Transit", "Out for Delivery", "Delivered"). This instantly updates what the customer sees when tracking.

**Your booking data is stored in `data/bookings.json`.** Back this file up regularly. If you restart the server, all bookings remain saved (they're written to disk, not memory).

---

## 5. Admin Login Setup

In your `.env` file:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePasswordHere
```

Change these to something secure before putting this online. Anyone with these credentials can see all customer data and update shipment statuses.

---

## 6. Email Notifications Setup (Get notified of new bookings)

This uses Gmail's SMTP to send you an email every time someone books a shipment.

1. Use (or create) a Gmail account.
2. Turn on **2-Step Verification**: Google Account → Security → 2-Step Verification.
3. Create an **App Password**: Google Account → Security → App Passwords → generate one for "Mail".
4. Copy that 16-character password.
5. In your `.env` file:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=youremail@gmail.com
   SMTP_PASS=the16characterapppassword
   NOTIFY_EMAIL=onkarexpress123@gmail.com
   ```

If you skip this section, the website still works fully — bookings are still saved and trackable — you just won't get email alerts. You'll see new bookings by checking the `/admin` dashboard.

**Alternative (simpler):** Instead of email, you can just check the `/admin` dashboard regularly, or refresh it — new bookings appear immediately.

---

## 7. Online Payment Setup (Razorpay)

This lets customers pay online (UPI, cards, netbanking) when booking.

1. Sign up free at https://dashboard.razorpay.com/signup
2. Complete basic KYC (or use Test Mode to try it out first without KYC).
3. Go to **Settings → API Keys** and generate a key pair.
4. In your `.env` file:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_secret_here
   ```
5. Restart the server.

**If you don't set this up:** the "Pay Online Now" option will show a message saying online payment isn't available yet, and the booking is automatically saved as "Cash on Pickup/Delivery" instead. So the website works fully either way — online payment is optional.

**Test Mode vs Live Mode:** Razorpay gives you Test keys (start with `rzp_test_`) for trying things out with fake payments, and Live keys (`rzp_live_`) for real money — switch to Live keys only once Razorpay approves your KYC.

---

## 8. Putting This Online (so customers anywhere can use it)

Right now this runs on your computer only (`localhost`). To make it a real public website:

1. **Choose a hosting provider** that supports Node.js, e.g.:
   - Render.com (has a free tier)
   - Railway.app
   - A VPS (DigitalOcean, AWS, etc.)
2. Upload this whole project folder (minus `node_modules`).
3. Set the same environment variables (`.env` values) in the hosting provider's dashboard/settings (don't upload `.env` itself — most hosts have an "Environment Variables" section).
4. The host will run `npm install` then `npm start` automatically.
5. Point your domain (e.g. onkarexpress.com) to the hosting provider.

**Important:** The current database (`data/bookings.json`) is a simple file. This works fine for a small business, but if you expect very high traffic or need multiple people editing simultaneously, consider upgrading to a real database (e.g. PostgreSQL/MongoDB) later. I can help with that migration when you're ready.

---

## 9. Quick Checklist - "Is it ready to go?"

| Feature | Status |
|---|---|
| Website (homepage, routes, services) | ✅ Ready |
| Booking form saves real data | ✅ Ready |
| Real tracking number generated per booking | ✅ Ready |
| Live tracking shows real status | ✅ Ready |
| Admin dashboard to view & update bookings | ✅ Ready |
| Email notification on new booking | ⚙️ Needs your Gmail app password (Section 6) |
| Online payments | ⚙️ Optional - needs Razorpay account (Section 7) |
| Public hosting (live on the internet) | ⚙️ Needs a hosting provider (Section 8) |
| Change admin password | ⚠️ Do this before going live |

The system is fully functional for **local use right now**. To go live for real customers, complete sections 6-8 (email is optional, payments are optional, hosting is required for a public URL).

---

## 10. Troubleshooting

- **"Cannot find module..." error** → run `npm install` again inside the project folder.
- **Port already in use** → change `PORT=5500` in `.env` to another number like `3000`.
- **Emails not sending** → double-check you used an "App Password", not your normal Gmail password, and that 2-Step Verification is enabled.
- **Admin login fails** → make sure `.env` exists (not just `.env.example`) and matches what you're typing.
- **Tracking says "not found"** → tracking numbers are case-insensitive but must match exactly what was generated at booking time.
