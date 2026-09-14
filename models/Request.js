const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  hospitalName: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  units: { type: Number, required: true },
  location: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', requestSchema);