const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');

// @route   POST api/auth/login
// @desc    Login employee & get token
router.post(
    '/login',
    [
        body('email', 'Sahi email address dein').isEmail(),
        body('password', 'Password zaroori hai').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const employee = await Employee.findOne({ email }).select('+password');
            if (!employee) {
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }

            const isMatch = await bcrypt.compare(password, employee.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Invalid Credentials' });
            }

            // JWT Payload banayein
            const payload = {
                user: {
                    id: employee.id,
                    name: employee.name,
                    role: employee.role,
                    permissions: employee.permissions
                }
            };

            jwt.sign(
                payload,
                process.env.JWT_SECRET, // Yeh humein .env file mein add karna hoga
                { expiresIn: '8h' }, // Token 8 ghante ke liye valid hoga
                (err, token) => {
                    if (err) throw err;
                    res.json({ token });
                }
            );

        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

module.exports = router;