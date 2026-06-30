// ============================================
// ONKAR EXPRESS - Frontend Logic (connects to backend API)
// ============================================

const API_BASE = ''; // same origin (server.js serves this file too)

// ---------------------------------------------
// LIVE SHIPMENT TRACKING (real API)
// ---------------------------------------------
async function trackShipment() {
  const id = document.getElementById('trackInput').value.trim().toUpperCase();
  const result = document.getElementById('trackResult');
  const steps = document.getElementById('trackSteps');

  if (!id) {
    steps.innerHTML = '<p style="color:rgba(255,100,100,.8);font-size:13px">Please enter a tracking number.</p>';
    result.classList.add('show');
    return;
  }

  steps.innerHTML = '<p style="color:rgba(255,255,255,.6);font-size:13px">Searching...</p>';
  result.classList.add('show');

  try {
    const res = await fetch(`${API_BASE}/api/track/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!res.ok) {
      steps.innerHTML = `<p style="color:rgba(255,100,100,.8);font-size:13px">${data.error || 'Shipment not found.'}</p>`;
      return;
    }

    const s = data.booking;
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div><strong style="color:#fff;font-size:15px">${s.awb}</strong><br>
      <span style="color:rgba(255,255,255,.5);font-size:12px">${s.fromCity} → ${s.toCity}</span></div>
      <span style="background:rgba(253,216,53,.2);color:#FDD835;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">${s.status}</span>
    </div>`;

    s.history.forEach((st, idx) => {
      const isLast = idx === s.history.length - 1;
      const cls = isLast ? 'dot-active' : 'dot-done';
      const time = new Date(st.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      html += `<div class="track-step">
        <div class="step-dot ${cls}"></div>
        <div class="step-info"><strong>${st.label}</strong><span>${time}</span></div>
      </div>`;
    });

    steps.innerHTML = html;
  } catch (err) {
    steps.innerHTML = '<p style="color:rgba(255,100,100,.8);font-size:13px">Could not connect to server. Please try again.</p>';
  }
}

document.getElementById('trackInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') trackShipment();
});

// ---------------------------------------------
// RATE ESTIMATE
// ---------------------------------------------
document.getElementById('weight').addEventListener('input', estimateRate);
document.getElementById('toCity').addEventListener('change', estimateRate);

function estimateRate() {
  const w = parseFloat(document.getElementById('weight').value) || 0;
  const city = document.getElementById('toCity').value;
  if (!w || !city) {
    document.getElementById('rateEstimate').style.display = 'none';
    return;
  }
  const farCities = ['Bhagalpur','Kahalgaon','Naugachia','Banka','Sultanganj','Sahebganj','Pirpanti','Godda'];
  const dist = farCities.includes(city) ? 1.5 : 1;
  const rate = Math.round((60 + w * 20) * dist);
  document.getElementById('rateValue').textContent = '₹' + rate;
  document.getElementById('rateEstimate').style.display = 'block';
}

// ---------------------------------------------
// BOOKING SUBMISSION (real API + payment)
// ---------------------------------------------
async function submitBooking() {
  const senderName = document.getElementById('senderName').value.trim();
  const senderPhone = document.getElementById('senderPhone').value.trim();
  const senderEmail = document.getElementById('senderEmail').value.trim();
  const fromCity = document.getElementById('fromCity').value;
  const toCity = document.getElementById('toCity').value;
  const parcelType = document.getElementById('parcelType').value;
  const weight = document.getElementById('weight').value;
  const address = document.getElementById('address').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;

  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  if (!senderName || !senderPhone || !fromCity || !toCity || !address) {
    errorMsg.textContent = 'Please fill in all required fields (Name, Phone, From, To, Address).';
    errorMsg.style.display = 'block';
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName, senderPhone, senderEmail,
        fromCity, toCity, parcelType, weight, address,
        paymentMethod
      })
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || 'Something went wrong. Please try again.';
      errorMsg.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Booking Request';
      return;
    }

    // If user chose online payment, launch Razorpay checkout
    if (paymentMethod === 'online') {
      await launchPayment(data.awb, data.rate, senderName, senderPhone, senderEmail);
    } else {
      showBookingSuccess(data.awb, data.rate, 'Cash on Pickup/Delivery');
    }

  } catch (err) {
    errorMsg.textContent = 'Could not connect to server. Please check your connection and try again.';
    errorMsg.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Booking Request';
  }
}

function showBookingSuccess(awb, rate, paymentNote) {
  const successMsg = document.getElementById('successMsg');
  successMsg.style.display = 'block';
  successMsg.innerHTML = `
    <i class="ti ti-circle-check"></i> Booking confirmed!<br>
    <strong style="font-size:16px">Tracking Number: ${awb}</strong><br>
    Estimated Rate: ₹${rate} (${paymentNote})<br>
    <span style="font-size:12px">Save this number to track your shipment. We'll call you within 30 minutes.</span>
  `;
  document.getElementById('submitBtn').textContent = 'Booking Submitted!';
  document.getElementById('submitBtn').style.background = '#2E7D32';
}

// ---------------------------------------------
// RAZORPAY ONLINE PAYMENT
// ---------------------------------------------
async function launchPayment(awb, rate, name, phone, email) {
  const errorMsg = document.getElementById('errorMsg');

  try {
    const orderRes = await fetch(`${API_BASE}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: rate, awb })
    });
    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      // Online payment not configured - fall back to COD info
      errorMsg.innerHTML = `${orderData.error}<br><strong>Your booking ${awb} is saved as Cash on Pickup/Delivery.</strong>`;
      errorMsg.style.display = 'block';
      showBookingSuccess(awb, rate, 'Cash on Pickup/Delivery - online payment unavailable');
      return;
    }

    const options = {
      key: orderData.key_id,
      amount: orderData.order.amount,
      currency: orderData.order.currency,
      name: 'Onkar Express',
      description: `Courier Booking ${awb}`,
      order_id: orderData.order.id,
      prefill: { name, contact: phone, email },
      theme: { color: '#D32F2F' },
      handler: async function (response) {
        // Verify payment on backend
        await fetch(`${API_BASE}/api/payment/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            awb
          })
        });
        showBookingSuccess(awb, rate, 'Paid Online ✓');
      },
      modal: {
        ondismiss: function () {
          showBookingSuccess(awb, rate, 'Payment not completed - Cash on Pickup/Delivery');
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();

  } catch (err) {
    showBookingSuccess(awb, rate, 'Cash on Pickup/Delivery');
  }
}
