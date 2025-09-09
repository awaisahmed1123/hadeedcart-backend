// routes/system.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Vendor = require('../models/Vendor');
const Order = require('../models/Order');
const User = require('../models/User');

// @route   POST api/system/factory-reset
// @desc    Delete all data except the main admin
// @access  Private (Admin Only)
router.post('/factory-reset', auth, async (req, res) => {
    try {
        const admin = await Employee.findById(req.user.id).select('+password');
        // Step 1: Sirf 'Admin' role wala user hi yeh chala sakta hai
        if (admin.role !== 'Admin') {
            return res.status(403).json({ msg: 'Aapke paas iski ijazat nahi hai' });
        }
        // Step 2: User ka password verify karein
        const { password } = req.body;
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Password ghalat hai' });
        }
        
        // Step 3: Tamam data delete karein
        await Product.deleteMany({});
        await Category.deleteMany({});
        await Brand.deleteMany({});
        await Vendor.deleteMany({});
        await Order.deleteMany({});
        await User.deleteMany({});
        // Sirf woh employees delete karein jinka role 'Admin' nahi hai
        await Employee.deleteMany({ role: { $ne: 'Admin' } });

        res.json({ msg: 'Factory Reset kamyab! Tamam data delete kar diya gaya hai.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;