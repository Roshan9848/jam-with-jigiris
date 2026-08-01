// Global State
let creatorsList = [];
let templateSettings = {};
let logoBase64 = null;
let logoA19Base64 = null;

// Auth Check on Startup
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

function checkAuth() {
  const token = localStorage.getItem('jigris_admin_token');
  const authOverlay = document.getElementById('auth-overlay');
  const dashboardWrapper = document.getElementById('dashboard-wrapper');

  if (token === 'jigris-jam-secret-admin-token') {
    authOverlay.style.display = 'none';
    dashboardWrapper.style.display = 'block';
    loadDashboard();
  } else {
    authOverlay.style.display = 'flex';
    dashboardWrapper.style.display = 'none';
  }
}

function loadDashboard() {
  // Pre-load both logo images as Base64 to prevent html2canvas loading issues
  toBase64('/logo.png', (base64) => {
    logoBase64 = base64;
    toBase64('/logo_a19.jpg', (base64_a19) => {
      logoA19Base64 = base64_a19;
      fetchSettings().then(() => {
        fetchCreators();
        // Auto refresh list and stats every 5 seconds for live feedback
        setInterval(fetchCreators, 5000);
      });
    });
  });
}

// Convert image url to base64
function toBase64(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.onload = function() {
    const reader = new FileReader();
    reader.onloadend = function() {
      callback(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}

function fetchSettings() {
  return fetch('/api/settings')
    .then(res => res.json())
    .then(settings => {
      templateSettings = settings;
      
      // Populate settings form inputs
      document.getElementById('tpl-title').value = settings.eventTitle;
      document.getElementById('tpl-venue').value = settings.venue;
      document.getElementById('tpl-date').value = settings.date;
      document.getElementById('tpl-time').value = settings.time;
      document.getElementById('tpl-accent').value = settings.accentColor;
      document.getElementById('tpl-instructions').value = settings.instructions;

      updateLivePreview();
    });
}

function fetchCreators() {
  return fetch('/api/creators')
    .then(res => res.json())
    .then(creators => {
      creatorsList = creators;
      updateStats();
      renderCreatorsTable();
      renderCheckInLogs();
    })
    .catch(err => console.error("Error fetching creators:", err));
}

function updateStats() {
  const totalCreators = creatorsList.length;
  const totalTickets = creatorsList.reduce((sum, c) => sum + c.tickets, 0);
  const checkedInCreators = creatorsList.filter(c => c.status === 'Checked In');
  const checkedInTickets = checkedInCreators.reduce((sum, c) => sum + c.tickets, 0);

  document.getElementById('stat-creators').textContent = totalCreators;
  document.getElementById('stat-tickets').textContent = totalTickets;
  document.getElementById('stat-checkedin').textContent = `${checkedInCreators.length} / ${totalCreators}`;

  // Progress bar calculation
  const percentage = totalCreators > 0 ? (checkedInCreators.length / totalCreators) * 100 : 0;
  document.getElementById('stat-progress-fill').style.width = `${percentage}%`;
}

function renderCreatorsTable() {
  const tableBody = document.getElementById('creators-list');
  const emptyState = document.getElementById('table-empty-state');
  const searchValue = document.getElementById('creator-search').value.toLowerCase();
  const filterValue = document.getElementById('status-filter').value;

  tableBody.innerHTML = '';

  // Filter list
  const filtered = creatorsList.filter(creator => {
    const matchesSearch = creator.instagram.toLowerCase().includes(searchValue);
    const matchesFilter = filterValue === 'all' || creator.status === filterValue;
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';

  filtered.forEach(creator => {
    const row = document.createElement('tr');
    
    // Status Badge Markup
    const badgeClass = creator.status === 'Checked In' ? 'badge-checkedin' : 'badge-pending';
    const statusText = creator.status;

    // Check-in Timestamp Formatting
    let timeText = '-';
    if (creator.checkinTime) {
      const time = new Date(creator.checkinTime);
      timeText = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    row.innerHTML = `
      <td style="font-weight: 600;">@${creator.instagram}</td>
      <td>
        <span style="background: rgba(255,255,255,0.06); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500;">
          ${creator.tickets}
        </span>
      </td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
      <td style="color: var(--text-secondary); font-size: 0.85rem;">${timeText}</td>
      <td style="text-align: right;">
        <div class="table-actions" style="justify-content: flex-end;">
          ${creator.status === 'Pending' ? `
            <button class="btn btn-secondary btn-icon" style="padding: 0.35rem 0.6rem; border-color: rgba(52, 199, 89, 0.4); color: var(--accent-green);" onclick="overrideCheckin('${creator.id}', '${creator.instagram}')">
              Check In
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-icon" style="padding: 0.35rem 0.6rem;" onclick="downloadTicketPDF('${creator.id}')">
            Ticket PDF
          </button>
          <button class="btn btn-danger btn-icon" style="padding: 0.35rem 0.6rem;" onclick="deleteCreator('${creator.id}', '${creator.instagram}')">
            Delete
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function renderCheckInLogs() {
  const container = document.getElementById('logs-container');
  
  // Get all checked-in creators sorted by check-in time desc
  const checkedIn = creatorsList
    .filter(c => c.status === 'Checked In' && c.checkinTime)
    .sort((a, b) => new Date(b.checkinTime) - new Date(a.checkinTime));

  if (checkedIn.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-muted); text-align: center; padding: 2rem 0; font-size: 0.9rem;">
        No check-ins logged yet. Ready to scan at the gate!
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  checkedIn.forEach(creator => {
    const time = new Date(creator.checkinTime);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
      <div class="log-info">
        <span class="log-user">@${creator.instagram}</span>
        <span class="log-time">${timeStr}</span>
      </div>
      <span class="log-tickets">+${creator.tickets} guests</span>
    `;
    container.appendChild(div);
  });
}

function setupEventListeners() {
  // Login Form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const loginError = document.getElementById('login-error');

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('jigris_admin_token', data.token);
        checkAuth();
      } else {
        loginError.style.display = 'block';
      }
    })
    .catch(err => {
      console.error("Login error:", err);
      loginError.textContent = "Server error connection failed.";
      loginError.style.display = 'block';
    });
  });

  // Logout Button
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('jigris_admin_token');
    checkAuth();
  });

  // Tabs Switcher
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Add Creator Form
  document.getElementById('add-creator-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const instagramInput = document.getElementById('creator-insta');
    const ticketsInput = document.getElementById('creator-tickets');

    fetch('/api/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instagram: instagramInput.value,
        tickets: parseInt(ticketsInput.value, 10)
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        instagramInput.value = '';
        ticketsInput.value = '1';
        fetchCreators();
      } else {
        alert("Error adding creator: " + data.message);
      }
    })
    .catch(err => console.error("Error:", err));
  });

  // Template Inputs (Live Preview Bindings)
  const templateInputs = ['tpl-title', 'tpl-venue', 'tpl-date', 'tpl-time', 'tpl-accent', 'tpl-instructions'];
  templateInputs.forEach(id => {
    const element = document.getElementById(id);
    const eventType = element.type === 'color' ? 'input' : 'keyup';
    element.addEventListener(eventType, updateLivePreview);
    if (element.type === 'color') {
      element.addEventListener('change', updateLivePreview);
    }
  });

  // Save Settings Button
  document.getElementById('save-settings-btn').addEventListener('click', () => {
    const settings = {
      eventTitle: document.getElementById('tpl-title').value,
      venue: document.getElementById('tpl-venue').value,
      date: document.getElementById('tpl-date').value,
      time: document.getElementById('tpl-time').value,
      accentColor: document.getElementById('tpl-accent').value,
      instructions: document.getElementById('tpl-instructions').value
    };

    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        templateSettings = data.settings;
        alert("Ticket template settings saved successfully!");
      }
    })
    .catch(err => console.error("Error saving settings:", err));
  });

  // Table Search and Filters
  document.getElementById('creator-search').addEventListener('input', renderCreatorsTable);
  document.getElementById('status-filter').addEventListener('change', renderCreatorsTable);

  // Bulk PDF Downloader
  document.getElementById('download-all-pdf-btn').addEventListener('click', downloadAllTickets);

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

  // Reset Scans
  document.getElementById('reset-all-btn').addEventListener('click', () => {
    if (confirm("WARNING: This will reset the check-in status of ALL influencers back to 'Pending'. Do you want to continue?")) {
      fetch('/api/admin/reset', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            fetchCreators();
            alert("All scans have been reset successfully.");
          }
        });
    }
  });
}

function updateLivePreview() {
  const titleVal = document.getElementById('tpl-title').value;
  const venueVal = document.getElementById('tpl-venue').value;
  const dateVal = document.getElementById('tpl-date').value;
  const timeVal = document.getElementById('tpl-time').value;
  const accentVal = document.getElementById('tpl-accent').value;
  const instructionsVal = document.getElementById('tpl-instructions').value;

  // Format Date (e.g. "2026-08-03" -> "03 Aug")
  let dateFormatted = dateVal;
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleString('en-US', { month: 'short' });
      dateFormatted = `${day} ${month}`;
    }
  } catch (e) {}

  // Update text elements in card
  document.getElementById('preview-ticket-title').textContent = titleVal.toUpperCase();
  document.getElementById('preview-ticket-datetime').textContent = `${dateFormatted} • ${timeVal}`;
  document.getElementById('preview-ticket-venue').textContent = venueVal;
  document.getElementById('preview-ticket-instructions').textContent = instructionsVal;

  // Set card color accent variables
  const cardElement = document.getElementById('preview-ticket-element');
  cardElement.style.borderTop = `4px solid ${accentVal}`;
  document.getElementById('preview-ticket-guests').style.color = accentVal;

  // Re-draw dummy preview QR Code
  const qrCanvas = document.getElementById('preview-qr-canvas');
  QRCode.toCanvas(qrCanvas, 'http://dummy-scan-preview', {
    width: 140,
    margin: 1,
    color: {
      dark: '#111216',
      light: '#ffffff'
    }
  }, function(error) {
    if (error) console.error(error);
  });
}

// Override Creator Checkin (Manual)
window.overrideCheckin = function(id, instagram) {
  if (confirm(`Check-in influencer @${instagram} manually?`)) {
    fetch(`/api/creators/${id}/checkin`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          fetchCreators();
          alert(`@${instagram} has been successfully checked in.`);
        } else {
          alert("Check-in override failed: " + data.message);
        }
      });
  }
};

// Delete Creator Record
window.deleteCreator = function(id, instagram) {
  if (confirm(`Are you sure you want to delete @${instagram}? This will invalidate their QR code entry.`)) {
    fetch(`/api/creators/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          fetchCreators();
        }
      });
  }
};

// Export CSV attendee sheet
function exportCSV() {
  if (creatorsList.length === 0) {
    alert("No influencers in directory to export.");
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Instagram Handle,Ticket Count,Checkin Status,Checkin Time\n";

  creatorsList.forEach(c => {
    const timeStr = c.checkinTime ? new Date(c.checkinTime).toLocaleString() : 'N/A';
    csvContent += `@${c.instagram},${c.tickets},${c.status},"${timeStr}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "jigris_jam_attendees.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate single PDF Ticket helper
window.downloadTicketPDF = function(creatorId) {
  const creator = creatorsList.find(c => c.id === creatorId);
  if (!creator) return;

  generatePDF(creator);
};

// Generate and trigger download for a creator ticket PDF
function generatePDF(creator) {
  return new Promise((resolve) => {
    const stage = document.getElementById('pdf-render-stage');
    
    // Create the ticket card clone with explicit print sizes
    const ticket = document.createElement('div');
    ticket.className = 'ticket-card';
    ticket.style.width = '350px';
    ticket.style.background = '#111216';
    ticket.style.borderTop = `4px solid ${templateSettings.accentColor}`;
    ticket.style.borderLeft = `1px solid rgba(255,255,255,0.08)`;
    ticket.style.borderRight = `1px solid rgba(255,255,255,0.08)`;
    ticket.style.borderBottom = `1px solid rgba(255,255,255,0.08)`;
    ticket.style.borderRadius = '12px';
    ticket.style.overflow = 'hidden';
    ticket.style.color = '#ffffff';
    ticket.style.fontFamily = "'Inter', sans-serif";
    ticket.style.padding = '0';
    ticket.style.boxShadow = 'none';

    // Format Date (e.g. "2026-08-03" -> "03 Aug")
    let dateFormatted = templateSettings.date;
    try {
      const d = new Date(templateSettings.date);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' });
        dateFormatted = `${day} ${month}`;
      }
    } catch (e) {}

    // HTML interior structure containing the dual logo configuration
    ticket.innerHTML = `
      <div class="ticket-header" style="padding: 1.5rem 1.5rem 0.5rem; display: flex; flex-direction: column; align-items: center; text-align: center;">
        
        <!-- Dual Logo Header -->
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-bottom: 0.75rem; width: 100%;">
          <img src="${logoBase64 || '/logo.png'}" alt="Jam Logo" style="max-height: 48px; width: auto;">
          <span style="font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 800; color: rgba(255,255,255,0.4);">x</span>
          <img src="${logoA19Base64 || '/logo_a19.jpg'}" alt="A19 Logo" style="max-height: 48px; width: auto; border-radius: 50%;">
        </div>

        <div style="font-family: 'Outfit', sans-serif; font-size: 1.25rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
          ${templateSettings.eventTitle.toUpperCase()}
        </div>
      </div>
      <div class="ticket-divider" style="height: 1px; border-top: 2px dashed rgba(255, 255, 255, 0.15); margin: 1.25rem 0; position: relative;"></div>
      <div class="ticket-body" style="padding: 0 1.5rem; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem;">@${creator.instagram}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.25rem;">Special Guest Entry</div>
        
        <div style="background: #ffffff; padding: 0.75rem; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; width: 150px; height: 150px;">
          <canvas id="pdf-qr-canvas-${creator.id}" style="width: 100%; height: 100%;"></canvas>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; width: 100%; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid rgba(255,255,255,0.04); text-align: left;">
          <div class="ticket-meta-item">
            <span class="ticket-meta-label" style="font-size: 0.65rem; color: #606470; text-transform: uppercase; font-weight: 600;">Date & Time</span>
            <span style="font-size: 0.8rem; font-weight: 600; color: #ffffff;">${dateFormatted} • ${templateSettings.time}</span>
          </div>
          <div class="ticket-meta-item">
            <span class="ticket-meta-label" style="font-size: 0.65rem; color: #606470; text-transform: uppercase; font-weight: 600;">Venue</span>
            <span style="font-size: 0.8rem; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${templateSettings.venue}</span>
          </div>
          <div style="grid-column: span 2; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.2rem; display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.65rem; color: #606470; text-transform: uppercase; font-weight: 600;">Total Guests allowed</span>
            <span style="color: ${templateSettings.accentColor}; font-size: 0.95rem; font-weight: 600;">${creator.tickets} ${creator.tickets > 1 ? 'Guests' : 'Guest'}</span>
          </div>
        </div>
      </div>
      <div style="padding: 1.25rem; font-size: 0.65rem; color: #606470; line-height: 1.4; white-space: pre-line; border-top: 1px solid rgba(255,255,255,0.03);">
        ${templateSettings.instructions}
      </div>
    `;

    stage.appendChild(ticket);

    // Draw the QR Code using creator.id as content value
    const canvas = document.getElementById(`pdf-qr-canvas-${creator.id}`);
    
    // We encode the creator ID as the QR payload.
    // The scanner will read it, extract the ID, and query "/api/creators/:id"
    QRCode.toCanvas(canvas, creator.id, {
      width: 150,
      margin: 1,
      color: {
        dark: '#111216',
        light: '#ffffff'
      }
    }, function(error) {
      if (error) {
        console.error(error);
        stage.removeChild(ticket);
        resolve();
        return;
      }

      // Small timeout to allow canvas rendering
      setTimeout(() => {
        html2canvas(ticket, {
          scale: 2.5, // Enhances text crispness
          backgroundColor: '#0a0b0d', // Ensures canvas background renders correctly
          useCORS: true
        }).then(capturedCanvas => {
          const imgData = capturedCanvas.toDataURL('image/png');
          
          const { jsPDF } = window.jspdf;
          const pdfWidth = capturedCanvas.width / 2.5; // Rescale back to CSS pixels
          const pdfHeight = capturedCanvas.height / 2.5;

          const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [pdfWidth, pdfHeight]
          });

          doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          doc.save(`ticket_${creator.instagram}.pdf`);
          
          // Cleanup
          stage.removeChild(ticket);
          resolve();
        }).catch(err => {
          console.error("html2canvas render error:", err);
          stage.removeChild(ticket);
          resolve();
        });
      }, 100);
    });
  });
}

// Sequence download batches to prevent browser pop-up blocks
async function downloadAllTickets() {
  if (creatorsList.length === 0) {
    alert("No influencer tickets available to download.");
    return;
  }

  const confirmBatch = confirm(`Start batch download for ${creatorsList.length} tickets? Your browser may prompt permissions for multiple file downloads.`);
  if (!confirmBatch) return;

  // Show a overlay loader or warning
  const btn = document.getElementById('download-all-pdf-btn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Downloading...';

  for (let i = 0; i < creatorsList.length; i++) {
    btn.textContent = `Progress: ${i + 1}/${creatorsList.length}`;
    await generatePDF(creatorsList[i]);
    // Sleep 600ms between downloads to avoid chrome download limits
    await new Promise(r => setTimeout(r, 600));
  }

  btn.disabled = false;
  btn.textContent = origText;
  alert("All tickets downloaded successfully!");
}
