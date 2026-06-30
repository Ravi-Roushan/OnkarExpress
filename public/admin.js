// ============================================
// ONKAR EXPRESS - Admin Dashboard Logic
// ============================================
let allBookings = [];
const STATUS_OPTIONS = [
  'Picked Up from Sender',
  'Dispatched from Patna Hub',
  'In Transit',
  'Reached Destination Hub',
  'Out for Delivery',
  'Delivered Successfully',
  'Delayed',
  'Cancelled'
];

function getCreds() {
  return {
    user: sessionStorage.getItem('oe_admin_user'),
    pass: sessionStorage.getItem('oe_admin_pass')
  };
}

window.addEventListener('DOMContentLoaded', () => {
  const { user, pass } = getCreds();
  if (user && pass) {
    showDashboard();
  }
});

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      sessionStorage.setItem('oe_admin_user', username);
      sessionStorage.setItem('oe_admin_pass', password);
      errorEl.style.display = 'none';
      showDashboard();
    } else {
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Could not connect to server.';
    errorEl.style.display = 'block';
  }
}

function logout() {
  sessionStorage.removeItem('oe_admin_user');
  sessionStorage.removeItem('oe_admin_pass');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadBookings();
}

async function loadBookings() {
  const { user, pass } = getCreds();
  const tableWrap = document.getElementById('tableWrap');
  tableWrap.innerHTML = '<p style="text-align:center;padding:2rem;color:#757575">Loading...</p>';

  try {
    const res = await fetch('/api/admin/bookings', {
      headers: {
        'x-admin-username': user,
        'x-admin-password': pass
      }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    const data = await res.json();
    allBookings = data.bookings;
    renderStats(data.bookings);
    renderTable(data.bookings);
    renderCharts(data.bookings);
  } catch (err) {
    tableWrap.innerHTML = '<p class="empty">Could not connect to server.</p>';
  }
}

function renderStats(bookings) {
  const total = bookings.length;
  const delivered = bookings.filter(b => b.status.toLowerCase().includes('delivered')).length;
  const inTransit = bookings.filter(b => b.status.toLowerCase().includes('transit') || b.status.toLowerCase().includes('dispatch')).length;
  const pendingPayment = bookings.filter(b => b.paymentStatus === 'pending').length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.paymentStatus === 'paid' ? b.rate : 0), 0);

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="label">Total Bookings</div></div>
    <div class="stat-card"><div class="num">${inTransit}</div><div class="label">In Transit</div></div>
    <div class="stat-card"><div class="num">${delivered}</div><div class="label">Delivered</div></div>
    <div class="stat-card"><div class="num">${pendingPayment}</div><div class="label">Pending Online Payments</div></div>
    <div class="stat-card"><div class="num">₹${totalRevenue}</div><div class="label">Revenue Collected (Online)</div></div>
  `;
}

function statusBadgeClass(status) {
  const s = status.toLowerCase();
  if (s.includes('delivered')) return 'badge-delivered';
  if (s.includes('transit') || s.includes('dispatch') || s.includes('out for')) return 'badge-transit';
  return 'badge-booked';
}

function paymentBadgeClass(status) {
  if (status === 'paid') return 'badge-paid';
  if (status === 'pending') return 'badge-pending';
  return 'badge-cod';
}

function renderTable(bookings) {
  const tableWrap = document.getElementById('tableWrap');
  if (!bookings.length) {
    tableWrap.innerHTML = '<p class="empty">No bookings yet. New bookings from the website will appear here.</p>';
    return;
  }
  const statusOptionsHtml = (current)=>STATUS_OPTIONS.map(s=>`<option value="${s}"${s===current?"selected":""}>${s}</option>`).join("");

  let html = `<table>
    <thead>
      <tr>
        <th>AWB</th>
        <th>Sender</th>
        <th>Phone</th>
        <th>Route</th>
        <th>Parcel</th>
        <th>Rate</th>
        <th>Payment</th>
        <th>Status</th>
        <th>Booked At</th>
        <th>Update Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>`;

  bookings.forEach(b => {
    const bookedAt = new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    html += `<tr>
      <td><strong>${b.awb}</strong></td>
      <td>${b.senderName}</td>
      <td>${b.senderPhone}</td>
      <td>${b.fromCity} → ${b.toCity}</td>
      <td>${b.parcelType} (${b.weight}kg)</td>
      <td>₹${b.rate}</td>
      <td><span class="badge ${paymentBadgeClass(b.paymentStatus)}">${b.paymentStatus}</span></td>
      <td><span class="badge ${statusBadgeClass(b.status)}">${b.status}</span></td>
      <td>${bookedAt}</td>
      <td>
  <div class="action-row">
    <select id="status-${b.awb}">
    ${statusOptionsHtml(b.status)}
  </select>

    <button onclick="updateStatus('${b.awb}')">
      Update
    </button>
  </div>
</td>

<td>
  <div class="action-row">
   <button
style="background:#1976D2"
onclick="viewBooking('${b.awb}')">
View
</button>

<button
style="background:#2E7D32"
onclick="downloadPDF('${b.awb}')">
PDF
</button>

<button
style="background:#C62828"
onclick="deleteBooking('${b.awb}')">
Delete
</button>

  </div>
</td>
    </tr>`;
  });

  html += '</tbody></table>';
  tableWrap.innerHTML = html;
}

async function updateStatus(awb) {
  const { user, pass } = getCreds();
  const select = document.getElementById(`status-${awb}`);
  const label = select.value;

  try {
    const res = await fetch(`/api/admin/bookings/${awb}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-username': user,
        'x-admin-password': pass
      },
      body: JSON.stringify({ label })
    });

    if (res.ok) {
      loadBookings();
    } else if (res.status === 401) {
      logout();
    } else {
      alert('Failed to update status.');
    }
  } catch (err) {
    alert('Could not connect to server.');
  }
}
async function exportBookings() {

    const { user, pass } = getCreds();

    try {

        const res = await fetch("/api/admin/export", {
            headers: {
                "x-admin-username": user,
                "x-admin-password": pass
            }
        });

        if (!res.ok) {
            alert("Export Failed");
            return;
        }

        const blob = await res.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = "OnkarExpressBookings.xlsx";

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("Export Failed");
    }

}

document.addEventListener("input",(e)=>{

if(e.target.id!="searchBooking")
return;
const value=e.target.value.toLowerCase();
const filtered=allBookings.filter(b=>{
return(

b.awb.toLowerCase().includes(value)
||
b.senderName.toLowerCase().includes(value)
||
b.senderPhone.includes(value)
);
});
renderTable(filtered);
renderCharts(filtered);
renderStats(filtered);
});

async function deleteBooking(awb){
if(!confirm("Delete this booking?"))
return;
const {user,pass}=getCreds();
const res=await fetch(`/api/admin/bookings/${awb}`,{
method:"DELETE",
headers:{
"x-admin-username":user,
"x-admin-password":pass
}
});
if(res.ok){
alert("Booking Deleted");
loadBookings();
}else{
alert("Delete Failed");
}
}

function viewBooking(awb){
const booking=allBookings.find(b=>b.awb===awb);
if(!booking)return;
document.getElementById("modalContent").innerHTML=`
<p><b>Tracking No:</b> ${booking.awb}</p>
<p><b>Sender:</b> ${booking.senderName}</p>
<p><b>Phone:</b> ${booking.senderPhone}</p>
<p><b>Email:</b> ${booking.senderEmail || "-"}</p>
<p><b>From:</b> ${booking.fromCity}</p>
<p><b>To:</b> ${booking.toCity}</p>
<p><b>Parcel:</b> ${booking.parcelType}</p>
<p><b>Weight:</b> ${booking.weight} KG</p>
<p><b>Amount:</b> ₹${booking.rate}</p>
<p><b>Payment:</b> ${booking.paymentStatus}</p>
<p><b>Status:</b> ${booking.status}</p>
<p><b>Booked:</b> ${new Date(booking.createdAt).toLocaleString()}</p>
`;
document.getElementById("bookingModal").style.display="flex";
}
function closeModal(){
document.getElementById("bookingModal").style.display="none";
}

function printReceipt(){

    const content = document.getElementById("modalContent").innerHTML;

    const win = window.open("", "", "width=800,height=700");

    win.document.write(`
        <html>
        <head>
            <title>Onkar Express Receipt</title>
            <style>
                body{
                    font-family:Arial,sans-serif;
                    padding:30px;
                }
                h2{
                    color:#D32F2F;
                    text-align:center;
                }
                p{
                    margin:10px 0;
                    font-size:15px;
                }
                hr{
                    margin:20px 0;
                }
            </style>
        </head>
        <body>
            <h2>ONKAR EXPRESS</h2>
            <hr>
            ${content}
        </body>
        </html>
    `);
    win.document.close();
    win.focus();
    win.print();
}

let bookingChart, revenueChart, paymentChart, statusChart;

function renderCharts(bookings){

    const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const bookingData=new Array(12).fill(0);
    const revenueData=new Array(12).fill(0);

    let paid = 0;
    let pending = 0;
    let cod = 0;
    let delivered = 0;
    let transit = 0;
    let booked = 0;

    bookings.forEach(b=>{

        const d=new Date(b.createdAt);
        const m=d.getMonth();

        bookingData[m]++;
        
        if (b.paymentStatus === "paid") {
    paid++;
    revenueData[m] += Number(b.rate);
}
else if (b.paymentStatus === "pending") {
    pending++;
}
else {
    cod++;
}
        const s=b.status.toLowerCase();
        if(s.includes("delivered"))
            delivered++;
        else if(s.includes("transit")||s.includes("dispatch"))
            transit++;
        else
            booked++;
    });
    if(bookingChart) bookingChart.destroy();
    if(revenueChart) revenueChart.destroy();
    if(paymentChart) paymentChart.destroy();
    if(statusChart) statusChart.destroy();
    bookingChart=new Chart(document.getElementById("bookingChart"),{
        type:"bar",
        data:{
            labels:months,
            datasets:[{
                label:"Bookings",
                data:bookingData
            }]
        }
    });

    revenueChart=new Chart(document.getElementById("revenueChart"),{
        type:"line",
        data:{
            labels:months,
            datasets:[{
                label:"Revenue",
                data:revenueData
            }]
        }
    });

    paymentChart = new Chart(document.getElementById("paymentChart"), {
    type: "pie",
    data: {
        labels: ["Paid", "Pending", "COD"],
        datasets: [{
            data: [paid, pending, cod]
        }]
    }
});

    statusChart=new Chart(document.getElementById("statusChart"),{
        type:"doughnut",
        data:{
            labels:["Delivered","Transit","Booked"],
            datasets:[{
                data:[delivered,transit,booked]
            }]
        }
    });

}

async function downloadPDF(awb) {

    const { user, pass } = getCreds();

    try {

        const res = await fetch(`/api/admin/bookings/${awb}/pdf`, {
            headers: {
                "x-admin-username": user,
                "x-admin-password": pass
            }
        });

        if (!res.ok) {
            alert("PDF Download Failed");
            return;
        }

        const blob = await res.blob();

        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = `${awb}.pdf`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("PDF Download Failed");
    }

}

function openDispatch() {

    document.getElementById("dispatchModal").style.display = "flex";

    let html = "";

    allBookings.forEach(b => {

        // Sirf jo deliver nahi hue hain
        if (!b.status.toLowerCase().includes("delivered")) {

            html += `
            <div style="padding:8px;border-bottom:1px solid #eee">

                <label>

                <input
                    type="checkbox"
                    class="dispatch-booking"
                    value="${b.awb}">

                <b>${b.awb}</b>

                | ${b.senderName}

                | ${b.fromCity} → ${b.toCity}

                | ${b.weight} KG

                </label>

            </div>
            `;
        }

    });

    document.getElementById("dispatchBookings").innerHTML = html;
}

function closeDispatch() {
    document.getElementById("dispatchModal").style.display = "none";
}

function generateTripSheet() {

    const vehicle =
        document.getElementById("vehicleNo").value.trim();

    const driver =
        document.getElementById("driverName").value.trim();

    if (!vehicle || !driver) {

        alert("Enter Vehicle Number & Driver Name");

        return;
    }

    const selected =
        document.querySelectorAll(".dispatch-booking:checked");

    if (selected.length === 0) {

        alert("Select at least one booking");

        return;
    }

    let totalWeight = 0;

    let html = `
        <h2 style="text-align:center">
        ONKAR EXPRESS
        </h2>

        <h3 style="text-align:center">
        Vehicle Dispatch Sheet
        </h3>

        <hr>

        <p><b>Vehicle :</b> ${vehicle}</p>

        <p><b>Driver :</b> ${driver}</p>

        <p><b>Date :</b> ${new Date().toLocaleString()}</p>

        <table
        border="1"
        cellspacing="0"
        cellpadding="8"
        width="100%">

        <tr>

        <th>AWB</th>

        <th>Customer</th>

        <th>Destination</th>

        <th>Weight</th>

        </tr>
    `;

    selected.forEach(chk => {

        const b =
            allBookings.find(x => x.awb === chk.value);

        totalWeight += Number(b.weight);

        html += `
        <tr>

        <td>${b.awb}</td>

        <td>${b.senderName}</td>

        <td>${b.toCity}</td>

        <td>${b.weight} KG</td>

        </tr>
        `;
    });

    html += `
        </table>

        <br>

        <b>Total Parcels :</b> ${selected.length}

        <br>

        <b>Total Weight :</b> ${totalWeight} KG
    `;

    const win = window.open("", "", "width=900,height=700");

    win.document.write(html);

    win.document.close();

    win.print();
}c