const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { networkInterfaces } = require('os');

const server = http.createServer((request, response) => {
  // Add CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('okay');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', setupWSConnection);

const PORT = 1234;
const HOST = '0.0.0.0';  // This allows connections from any IP

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  
  // Get and display local IP addresses
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  
  if (results.length > 0) {
    console.log('\nIMPORTANT SETUP INSTRUCTIONS:');
    console.log('1. Start Next.js with: npm run dev -- -H 0.0.0.0');
    console.log('2. Share these URLs with collaborators on your WiFi:\n');
    
    results.forEach(ip => {
      console.log(`Application URL: http://${ip}:3000`);
    });
  }
});