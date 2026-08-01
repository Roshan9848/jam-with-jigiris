let html5Qrcode = null;
let currentCameraId = null;
let isScanning = false;
let scannedCreatorId = null;

// HTML Elements
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsPanel = document.getElementById('settings-panel');
const cameraSelect = document.getElementById('camera-select');
const toggleScanBtn = document.getElementById('toggle-scan-btn');
const statusGlow = document.getElementById('status-glow');

const bottomSheetOverlay = document.getElementById('bottom-sheet-overlay');
const sheetUsername = document.getElementById('sheet-username');
const sheetTickets = document.getElementById('sheet-tickets');
const sheetInfoBox = document.getElementById('sheet-info-box');
const sheetCheckinBtn = document.getElementById('sheet-checkin-btn');
const sheetCloseBtn = document.getElementById('sheet-close-btn');

document.addEventListener('DOMContentLoaded', () => {
  initScanner();
  setupEventListeners();
});

function initScanner() {
  html5Qrcode = new Html5Qrcode("reader");
  
  // Query camera devices
  Html5Qrcode.getCameras().then(devices => {
    cameraSelect.innerHTML = '';
    if (devices && devices.length > 0) {
      // Prioritize environment/back facing cameras for barcode scanner
      let backCamera = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('rear')
      );
      
      devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.text = device.label || `Camera ${cameraSelect.length + 1}`;
        if (backCamera && device.id === backCamera.id) {
          option.selected = true;
        }
        cameraSelect.appendChild(option);
      });
      
      currentCameraId = cameraSelect.value;
      
      // Auto-start scanning instantly on mobile load
      startScanning();
    } else {
      cameraSelect.innerHTML = '<option value="">No cameras detected</option>';
      toggleScanBtn.classList.add('btn-disabled');
      toggleScanBtn.disabled = true;
    }
  }).catch(err => {
    console.error("Camera detection error:", err);
    cameraSelect.innerHTML = '<option value="">Camera permission denied</option>';
    toggleScanBtn.classList.add('btn-disabled');
    toggleScanBtn.disabled = true;
  });
}

function setupEventListeners() {
  // Toggle Settings Panel Drawer
  settingsToggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('active');
  });

  // Manual Scan Pause/Play button (inside settings)
  toggleScanBtn.addEventListener('click', () => {
    if (isScanning) {
      stopScanning();
    } else {
      startScanning();
    }
  });

  // Switch camera source on dropdown change
  cameraSelect.addEventListener('change', () => {
    currentCameraId = cameraSelect.value;
    if (isScanning) {
      stopScanning().then(() => {
        startScanning();
      });
    }
  });

  // Close sheet options
  sheetCloseBtn.addEventListener('click', closeBottomSheet);
  
  // Close drawer if user clicks on backdrop overlay
  bottomSheetOverlay.addEventListener('click', (e) => {
    if (e.target === bottomSheetOverlay) {
      closeBottomSheet();
    }
  });

  sheetCheckinBtn.addEventListener('click', performCheckIn);
}

function startScanning() {
  if (!currentCameraId) return;

  isScanning = true;
  toggleScanBtn.textContent = 'Pause Scanner';
  toggleScanBtn.classList.replace('btn-primary', 'btn-secondary');
  
  // Reset border glow feedback back to neutral scanning
  statusGlow.className = 'status-feedback-glow scanning';

  const config = {
    fps: 15, // Higher frame rate for snappier mobile capture
    qrbox: (width, height) => {
      // Return square bounding box matching design corners
      const size = Math.floor(Math.min(width, height) * 0.7);
      return { width: size, height: size };
    },
    aspectRatio: 1.0
  };

  html5Qrcode.start(
    currentCameraId, 
    config, 
    onScanSuccess, 
    onScanError
  ).catch(err => {
    console.error("Camera startup error:", err);
    isScanning = false;
    toggleScanBtn.textContent = 'Start Scanner';
  });
}

function stopScanning() {
  if (!html5Qrcode || !isScanning) return Promise.resolve();
  
  isScanning = false;
  toggleScanBtn.textContent = 'Start Scanner';
  
  return html5Qrcode.stop().catch(err => {
    console.warn("Error stopping scanner:", err);
  });
}

function onScanSuccess(decodedText) {
  // Short haptic rumble on success
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }

  let creatorId = decodedText;
  try {
    // If QR code contains link path, extract final segment
    if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      creatorId = pathParts[pathParts.length - 1];
    }
  } catch (e) {
    console.warn("Parse segment failed, using raw code", e);
  }

  // Freeze scanner immediately
  stopScanning();
  
  openBottomSheet(creatorId);
}

function onScanError(errorMessage) {
  // Suppress logs to keep mobile debugger console clean
}

function openBottomSheet(creatorId) {
  scannedCreatorId = creatorId;
  
  // Reset sheet UI states
  sheetUsername.textContent = "Validating...";
  sheetTickets.textContent = "-";
  sheetInfoBox.className = "result-info-box";
  sheetInfoBox.innerHTML = `Connecting to verification gateway...`;
  sheetCheckinBtn.style.display = "none";
  
  // Slide up bottom sheet drawer
  bottomSheetOverlay.classList.add('active');

  fetch(`/api/creators/${creatorId}`)
    .then(response => {
      if (response.status === 404) {
        throw new Error("NOT_FOUND");
      }
      return response.json();
    })
    .then(creator => {
      sheetUsername.textContent = `@${creator.instagram}`;
      sheetTickets.textContent = creator.tickets;

      if (creator.status === 'Checked In') {
        // Change scanning frame glow to warning orange
        statusGlow.className = 'status-feedback-glow error';
        
        const checkinTime = new Date(creator.checkinTime);
        const timeStr = checkinTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        sheetInfoBox.innerHTML = `
          <strong style="color: var(--accent-amber); display: block; font-size: 1.05rem; margin-bottom: 0.25rem;">
            ALREADY CHECKED IN
          </strong>
          This ticket was verified today at <strong>${timeStr}</strong>. Entry is denied.
        `;
        sheetCheckinBtn.style.display = "none";
      } else {
        // Change scanning frame glow to success green
        statusGlow.className = 'status-feedback-glow success';
        
        sheetInfoBox.innerHTML = `
          <strong style="color: var(--accent-green); display: block; font-size: 1.05rem; margin-bottom: 0.25rem;">
            VALID ENTRY TICKET
          </strong>
          Influencer entry package verified. Ready to clear gate.
        `;
        
        sheetCheckinBtn.style.display = "block";
        sheetCheckinBtn.disabled = false;
        sheetCheckinBtn.textContent = "Confirm Entry & Check In";
      }
    })
    .catch(err => {
      statusGlow.className = 'status-feedback-glow error';
      
      sheetUsername.textContent = "Unrecognized Ticket";
      sheetTickets.textContent = "0";
      
      if (err.message === "NOT_FOUND") {
        sheetInfoBox.innerHTML = `
          <strong style="color: var(--accent-red); display: block; font-size: 1.05rem; margin-bottom: 0.25rem;">
            INVALID QR CODE
          </strong>
          This QR code does not match any creators. Deny access.
        `;
      } else {
        sheetInfoBox.innerHTML = `
          <strong style="color: var(--accent-red); display: block; font-size: 1.05rem; margin-bottom: 0.25rem;">
            GATEWAY ERROR
          </strong>
          Failed to contact local network server. Check hotspot connections.
        `;
      }
      sheetCheckinBtn.style.display = "none";
    });
}

function performCheckIn() {
  if (!scannedCreatorId) return;

  sheetCheckinBtn.disabled = true;
  sheetCheckinBtn.textContent = "Checking in guest...";

  fetch(`/api/creators/${scannedCreatorId}/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      // Dynamic vibration pattern for success confirmation
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      statusGlow.className = 'status-feedback-glow success';
      
      const checkinTime = new Date(data.creator.checkinTime);
      const timeStr = checkinTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      sheetInfoBox.innerHTML = `
        <strong style="color: var(--accent-green); display: block; font-size: 1.1rem; margin-bottom: 0.25rem;">
          ENTRY APPROVED
        </strong>
        Checked in successfully at <strong>${timeStr}</strong>. Clear ${data.creator.tickets} guests.
      `;
      
      sheetCheckinBtn.style.display = "none";
    } else {
      alert("Verification error: " + data.message);
      sheetCheckinBtn.disabled = false;
      sheetCheckinBtn.textContent = "Confirm Entry & Check In";
    }
  })
  .catch(err => {
    console.error("Check-in request failed:", err);
    alert("Connection timeout occurred.");
    sheetCheckinBtn.disabled = false;
    sheetCheckinBtn.textContent = "Confirm Entry & Check In";
  });
}

function closeBottomSheet() {
  bottomSheetOverlay.classList.remove('active');
  scannedCreatorId = null;
  
  // Collapse settings panel automatically on resume to maintain clean scan view
  settingsPanel.classList.remove('active');
  
  // Resume camera scanning loop
  setTimeout(() => {
    if (!isScanning) {
      startScanning();
    }
  }, 300);
}
