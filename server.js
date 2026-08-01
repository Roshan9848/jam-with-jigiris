const app = require('./api/index');
const os = require('os');
const PORT = process.env.PORT || 3000;

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
