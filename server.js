require('dotenv').config();
const app = require('./app');
const config = require('./src/config');

app.listen(config.port, () => {
  console.log(`🏨 Hotel Management API running on port ${config.port}`);
  console.log(`📡 CORS enabled for: ${config.clientUrl}`);
});
