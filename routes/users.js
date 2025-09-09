const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

// @route   POST api/users/register
// @desc    Register a new user
router.post(
    '/register',
    [
        body('name', 'Naam zaroori hai').not().isEmpty(),
        body('email', 'Sahi email address dein').isEmail(),
        body('phone', 'Phone number zaroori hai').not().isEmpty(),
        body('password', 'Password kam se kam 6 characters ka hona chahiye').isLength({ min: 6 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, phone } = req.body;

        try {
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ msg: 'Is email par user pehle se mojood hai' });
            }

            user = new User({ name, email, password, phone });
            
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);

            await user.save();
            res.status(201).json({ msg: 'User kamyabi se register ho gaya' });

        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   GET api/users
// @desc    Get all users (for Admin)
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;