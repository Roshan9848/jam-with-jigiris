const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const isVercel = process.env.VERCEL === '1';
const kvUrl = process.env.KV_REST_API_URL || process.env.KV_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.KV_TOKEN;

// Configure local paths (fallback write folder on Vercel is /tmp)
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '../data');
if (!isVercel && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

const CREATORS_FILE = path.join(DATA_DIR, 'creators.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const CREATORS_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019fbeea-6ac1-7413-b09a-ccc496117c32';
const SETTINGS_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019fbeea-6ab4-7e5c-b47e-e78720a7d840';

// Helper to read data (from Vercel KV REST, JSONBlob, or local file fallback)
async function readData(key, filePath, defaultData = []) {
  // 1. Try Vercel KV first if connected by user
  if (kvUrl && kvToken) {
    try {
      const response = await fetch(`${kvUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.hasOwnProperty('result')) {
          if (data.result === null) {
            return defaultData;
          }
          return JSON.parse(data.result);
        }
      }
    } catch (e) {
      console.error(`KV Read Error for ${key}:`, e);
    }
  }

  // 2. Try anonymous JSONBlob online DB for instant zero-setup cloud storage
  const blobUrl = key === 'creators' ? CREATORS_BLOB_URL : SETTINGS_BLOB_URL;
  try {
    const response = await fetch(blobUrl, {
      headers: { 'Accept': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (e) {
    console.warn(`Online JSONBlob fetch failed for ${key}, falling back to local file.`, e);
  }

  // 3. Fall back to local file database (ideal for offline local hotspot router runs)
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return defaultData;
  }
}

// Helper to write data (to Vercel KV REST, JSONBlob, or local file fallback)
async function writeData(key, filePath, data) {
  // 1. Try Vercel KV first if connected by user
  if (kvUrl && kvToken) {
    try {
      const response = await fetch(kvUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', key, JSON.stringify(data)])
      });
      if (response.ok) {
        return true;
      }
    } catch (e) {
      console.error(`KV Write Error for ${key}:`, e);
    }
  }

  // 2. Try anonymous JSONBlob online DB update
  const blobUrl = key === 'creators' ? CREATORS_BLOB_URL : SETTINGS_BLOB_URL;
  try {
    const response = await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (response.ok) {
      // Write locally as a silent backup if running local server
      if (!isVercel) {
        try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch (err) {}
      }
      return true;
    }
  } catch (e) {
    console.warn(`Online JSONBlob write failed for ${key}, falling back to local file.`, e);
  }

  // 3. Fall back to local file database
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
}

// Default settings object
const defaultSettings = {
  eventTitle: "Jam with Jigris",
  venue: "Jigris Jam Room",
  date: "2026-08-03",
  time: "06:00 PM",
  accentColor: "#ff3b30",
  instructions: "1. Show this QR code to the bouncer at the entrance.\n2. Entry valid only for the count specified above.\n3. Ticket is non-transferable and single-use."
};

// API Routes

// Admin Login Check
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'checkin@a19.com' && password === '12345') {
    res.json({ success: true, token: 'jigris-jam-secret-admin-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
  }
});

// Get Settings
app.get('/api/settings', async (req, res) => {
  const settings = await readData('settings', SETTINGS_FILE, defaultSettings);
  res.json(settings);
});

// Update Settings
app.post('/api/settings', async (req, res) => {
  const settings = req.body;
  await writeData('settings', SETTINGS_FILE, settings);
  res.json({ success: true, settings });
});

// Get Creators
app.get('/api/creators', async (req, res) => {
  const creators = await readData('creators', CREATORS_FILE);
  res.json(creators);
});

// Add Creator
app.post('/api/creators', async (req, res) => {
  const { instagram, tickets } = req.body;
  if (!instagram || !tickets) {
    return res.status(400).json({ success: false, message: 'Instagram and ticket count are required.' });
  }

  const creators = await readData('creators', CREATORS_FILE);
  const cleanInstagram = instagram.trim().replace(/^@/, '');

  const newCreator = {
    id: 'creator_' + Math.random().toString(36).substr(2, 9),
    instagram: cleanInstagram,
    tickets: parseInt(tickets, 10),
    status: 'Pending',
    checkinTime: null
  };

  creators.push(newCreator);
  await writeData('creators', CREATORS_FILE, creators);
  res.json({ success: true, creator: newCreator });
});

// Get Creator details (Scan route)
app.get('/api/creators/:id', async (req, res) => {
  const creators = await readData('creators', CREATORS_FILE);
  const creator = creators.find(c => c.id === req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found.' });
  }
  res.json(creator);
});

// Check-in Creator (Gate scan verification)
app.post('/api/creators/:id/checkin', async (req, res) => {
  const creators = await readData('creators', CREATORS_FILE);
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
  await writeData('creators', CREATORS_FILE, creators);

  res.json({ success: true, creator: creators[index] });
});

// Delete Creator
app.delete('/api/creators/:id', async (req, res) => {
  let creators = await readData('creators', CREATORS_FILE);
  const creatorExists = creators.some(c => c.id === req.params.id);

  if (!creatorExists) {
    return res.status(404).json({ success: false, message: 'Creator not found.' });
  }

  creators = creators.filter(c => c.id !== req.params.id);
  await writeData('creators', CREATORS_FILE, creators);
  res.json({ success: true, message: 'Creator deleted.' });
});

// Reset Scans
app.post('/api/admin/reset', async (req, res) => {
  let creators = await readData('creators', CREATORS_FILE);
  creators = creators.map(c => ({
    ...c,
    status: 'Pending',
    checkinTime: null
  }));
  await writeData('creators', CREATORS_FILE, creators);
  res.json({ success: true, message: 'All check-ins reset successfully.' });
});

// Serve frontend routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = app;
