const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected Successfully...');
  } catch (err) {
    console.error(`Database Connection Error: ${err.message}`);
    process.exit(1);
  }
};
connectDB();

// --- Import Routes ---
const productRoutes = require('./routes/products');
const brandRoutes = require('./routes/brands');
const vendorRoutes = require('./routes/vendors');
const categoryRoutes = require('./routes/categories');
const seedRoutes = require('./routes/seed');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const dashboardRoutes = require('./routes/dashboard');
const systemRoutes = require('./routes/system');

// --- API Routes ---
app.get('/', (req, res) => {
  res.send('HadeedCart Backend API is running!');
});

app.use('/api/products', productRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/banners', require('./routes/banners'));
app.use('/api/media', require('./routes/media'));

// Seed route ko sirf development mein istemal karein
if (process.env.NODE_ENV === 'development') {
    app.use('/api/seed', seedRoutes);
    console.log('Development Mode: Seeder route is active at /api/seed');
}

// --- Server Listening ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});