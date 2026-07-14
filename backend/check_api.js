const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/dashboard/influencer',
  method: 'GET',
  headers: {
    // Need a valid token. I'll just check if the route throws an error by looking at the logs.
  }
};

// Actually, I can just check the backend terminal output if it crashed!
