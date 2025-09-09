const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');

// @route   GET api/vendors
// @desc    Get all vendors
router.get('/', async (req, res) => {
    try {
        const vendors = await Vendor.find().select('-password').sort({ createdAt: -1 });
        res.json(vendors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/vendors
// @desc    Admin creates a new vendor
router.post(
    '/',
    [
        body('name', 'Owner Name zaroori hai').not().isEmpty(),
        body('shopName', 'Shop Name zaroori hai').not().isEmpty(),
        body('email', 'Sahi email address dein').isEmail(),
        body('phone', 'Mobile Number zaroori hai').not().isEmpty(),
        body('address', 'Shop Address zaroori hai').not().isEmpty(),
        body('password', 'Password kam se kam 6 characters ka hona chahiye').isLength({ min: 6 }),
        body('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords match nahi ho rahe');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, shopName, email, phone, address, cnic, password } = req.body;
        try {
            let vendor = await Vendor.findOne({ email });
            if (vendor) {
                return res.status(400).json({ msg: 'Is email par vendor pehle se mojood hai' });
            }

            vendor = new Vendor({ name, shopName, email, phone, address, cnic, password, accountStatus: 'Approved' });
            
            const salt = await bcrypt.genSalt(10);
            vendor.password = await bcrypt.hash(password, salt);
            
            await vendor.save();
            const newVendor = vendor.toObject();
            delete newVendor.password;
            res.status(201).json(newVendor);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   PUT api/vendors/:id/status
// @desc    Update a vendor's account status
router.put('/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['Pending', 'Approved', 'Suspended'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
    }

    try {
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { accountStatus: status },
            { new: true }
        ).select('-password');

        if (!vendor) {
            return res.status(404).json({ msg: 'Vendor nahi mila' });
        }
        res.json(vendor);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/vendors/:id
// @desc    Delete a vendor
router.delete('/:id', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) {
            return res.status(404).json({ msg: 'Vendor nahi mila' });
        }

        const products = await Product.find({ vendorId: req.params.id });
        if (products.length > 0) {
            return res.status(400).json({ msg: 'Is vendor ko delete nahi kar sakte. Pehle iske products delete karein.' });
        }

        await Vendor.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Vendor delete ho gaya' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;