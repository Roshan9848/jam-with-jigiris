const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const CREATORS_FILE = path.join(DATA_DIR, 'creators.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Helper functions for file I/O
const readData = (filePath, defaultData = []) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return defaultData;
  }
};

const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
    return false;
  }
};

// Initialize settings if they don't exist
const defaultSettings = {
  eventTitle: "Jam with Jigris",
  venue: "Jigris Jam Room",
  date: "2026-08-03",
  time: "06:00 PM",
  accentColor: "#ff3b30",
  instructions: "1. Show this QR code to the bouncer at the entrance.\n2. Entry valid only for the count specified above.\n3. Ticket is non-transferable and single-use."
};
readData(SETTINGS_FILE, defaultSettings);

// API Routes

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'checkin@a19.com' && password === '12345') {
    res.json({ success: true, token: 'jigris-jam-secret-admin-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  const settings = readData(SETTINGS_FILE, defaultSettings);
  res.json(settings);
});

// Update settings
app.post('/api/settings', (req, res) => {
  const settings = req.body;
  writeData(SETTINGS_FILE, settings);
  res.json({ success: true, settings });
});

// Get creators
app.get('/api/creators', (req, res) => {
  const creators = readData(CREATORS_FILE);
  res.json(creators);
});

// Add creator
app.post('/api/creators', (req, res) => {
  const { instagram, tickets } = req.body;
  if (!instagram || !tickets) {
    return res.status(400).json({ success: false, message: 'Instagram and ticket count are required.' });
  }

  const creators = readData(CREATORS_FILE);
  const cleanInstagram = instagram.trim().replace(/^@/, '');
  
  const newCreator = {
    id: 'creator_' + Math.random().toString(36).substr(2, 9),
    instagram: cleanInstagram,
    tickets: parseInt(tickets, 10),
    status: 'Pending',
    checkinTime: null
  };

  creators.push(newCreator);
  writeData(CREATORS_FILE, creators);
  res.json({ success: true, creator: newCreator });
});

// Get creator details by ID (Used by scanner)
app.get('/api/creators/:id', (req, res) => {
  const creators = readData(CREATORS_FILE);
  const creator = creators.find(c => c.id === req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found.' });
  }
  res.json(creator);
});

// Check-in creator (Used by scanner/admin override)
app.post('/api/creators/:id/checkin', (req, res) => {
  const creators = readData(CREATORS_FILE);
  const index = creators.findIndex(c => c.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Creator not found.' });
  }

  if (creators[index].status === 'Checked In') {
    return res.status(400).json({
      success: false, 
      message: 'Already checked in.', 
      creator: creators[index] 
    });
  }

  creators[index].status = 'Checked In';
  creators[index].checkinTime = new Date().toISOString();
  writeData(CREATORS_FILE, creators);

  res.json({ success: true, creator: creators[index] });
});

// Delete creator
app.delete('/api/creators/:id', (req, res) => {
  let creators = readData(CREATORS_FILE);
  const creatorExists = creators.some(c => c.id === req.params.id);
  
  if (!creatorExists) {
    return res.status(404).json({ success: false, message: 'Creator not found.' });
  }

  creators = creators.filter(c => c.id !== req.params.id);
  writeData(CREATORS_FILE, creators);
  res.json({ success: true, message: 'Creator deleted.' });
});

// Reset all check-in statuses
app.post('/api/admin/reset', (req, res) => {
  let creators = readData(CREATORS_FILE);
  creators = creators.map(c => ({
    ...c,
    status: 'Pending',
    checkinTime: null
  }));
  writeData(CREATORS_FILE, creators);
  res.json({ success: true, message: 'All check-ins reset successfully.' });
});

// Fallback to index.html for undefined routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`  Jigris Jam Session QR Manager Server Started     `);
  console.log(`==================================================`);
  console.log(`Local Access: http://localhost:${PORT}`);
  
  // Find local IP address
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Network Access: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`==================================================`);
});
