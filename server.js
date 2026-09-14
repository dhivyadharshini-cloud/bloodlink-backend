const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bloodlink')
  .then(() => console.log('MongoDB Database Connected Successfully!'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// 1. User Schema (Hospital or Donor)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: String,
  role: { type: String, enum: ['hospital', 'donor'], required: true },
  bloodGroup: String, // For donors
  city: String
});

const User = mongoose.model('User', UserSchema);

// 2. Request Schema
const RequestSchema = new mongoose.Schema({
  hospitalName: String,
  bloodGroup: String,
  units: Number,
  location: String,
  targetWard: String,
  status: { type: String, default: 'Broadcasting Notification' },
  acceptedDonor: { type: Object, default: null },
  timestamp: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', RequestSchema);

// Blood Compatibility Engine
const checkCompatibility = (donorBg, recipientBg) => {
  const map = {
    'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'O+': ['A+', 'B+', 'AB+', 'O+'],
    'A-': ['A+', 'A-', 'AB+', 'AB-'],
    'A+': ['A+', 'AB+'],
    'B-': ['B+', 'B-', 'AB+', 'AB-'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB+', 'AB-'],
    'AB+': ['AB+']
  };
  return map[donorBg] ? map[donorBg].includes(recipientBg) : donorBg === recipientBg;
};

// API: Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered!' });

    const newUser = new User(req.body);
    await newUser.save();
    res.json({ success: true, message: 'Registration Successful! Please Login.', user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid Email or Password!' });

    res.json({ success: true, message: 'Login Successful!', user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Dispatch Request
app.post('/api/dispatch', async (req, res) => {
  try {
    const newRequest = new Request(req.body);
    await newRequest.save();
    res.json({ success: true, message: 'Broadcasted to all nearby compatible donors!', data: newRequest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get Requests
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await Request.find().sort({ timestamp: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Accept Request by Donor
app.post('/api/accept-request', async (req, res) => {
  const { requestId, donor } = req.body;
  try {
    const reqData = await Request.findById(requestId);
    if (!reqData) return res.status(404).json({ success: false, message: 'Request not found' });

    const isCompatible = checkCompatibility(donor.bloodGroup, reqData.bloodGroup);

    if (isCompatible) {
      reqData.status = 'Donor Matched & En Route';
      reqData.acceptedDonor = donor;
      await reqData.save();
      res.json({ 
        success: true, 
        compatible: true, 
        message: `Match Confirmed! Proceed to ${reqData.hospitalName} - ${reqData.targetWard}`,
        data: reqData 
      });
    } else {
      res.json({ 
        success: false, 
        compatible: false, 
        message: `Incompatible! Donor (${donor.bloodGroup}) cannot donate to Recipient (${reqData.bloodGroup}).` 
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));