const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');

// @route   POST api/employees
// @desc    Create a new employee
// @access  Private
router.post(
    '/',
    auth,
    [
        body('name', 'Naam zaroori hai').not().isEmpty(),
        body('email', 'Sahi email dein').isEmail(),
        body('password', 'Password kam se kam 6 characters ka ho').isLength({ min: 6 }),
        body('permissions', 'Kam se kam ek permission zaroori hai').isArray({ min: 1 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { name, email, password, permissions, role } = req.body;
        try {
            let employee = await Employee.findOne({ email });
            if (employee) return res.status(400).json({ msg: 'Is email par employee pehle se mojood hai' });

            employee = new Employee({ name, email, password, permissions, role });
            
            const salt = await bcrypt.genSalt(10);
            employee.password = await bcrypt.hash(password, salt);
            
            await employee.save();
            res.status(201).json({ msg: 'Employee kamyabi se ban gaya' });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   GET api/employees
// @desc    Get all employees
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const employees = await Employee.find().select('-password');
        res.json(employees);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/employees/profile
// @desc    Update logged-in employee's name and email
// @access  Private
router.put(
    '/profile',
    auth,
    [
        body('name', 'Naam zaroori hai').not().isEmpty(),
        body('email', 'Sahi email dein').isEmail(),
        body('password', 'Aapka current password zaroori hai').not().isEmpty(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const { name, email, password } = req.body;
            const employee = await Employee.findById(req.user.id).select('+password');

            const isMatch = await bcrypt.compare(password, employee.password);
            if (!isMatch) return res.status(400).json({ msg: 'Aapka current password ghalat hai' });
            
            if (email.toLowerCase() !== employee.email) {
                const emailExists = await Employee.findOne({ email });
                if (emailExists) return res.status(400).json({ msg: 'Yeh email pehle se register hai' });
            }

            employee.name = name;
            employee.email = email;
            await employee.save();
            res.json({ msg: 'Profile kamyabi se update ho gaya' });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   PUT /api/employees/change-password
// @desc    Change logged-in employee's password
// @access  Private
router.put('/change-password', auth,
    [
        body('oldPassword', 'Purana password zaroori hai').not().isEmpty(),
        body('newPassword', 'Naya password kam se kam 6 characters ka ho').isLength({ min: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { oldPassword, newPassword } = req.body;
        try {
            const employee = await Employee.findById(req.user.id).select('+password');
            if (!employee) return res.status(404).json({ msg: 'Employee nahi mila' });

            const isMatch = await bcrypt.compare(oldPassword, employee.password);
            if (!isMatch) return res.status(400).json({ msg: 'Purana password ghalat hai' });

            const salt = await bcrypt.genSalt(10);
            employee.password = await bcrypt.hash(newPassword, salt);
            await employee.save();

            res.json({ msg: 'Password kamyabi se tabdeel ho gaya' });
        } catch (err) { 
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    }
);

// @route   PUT /api/employees/:id/status
// @desc    Suspend or Re-activate an employee
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Active', 'Suspended'].includes(status)) {
            return res.status(400).json({ msg: 'Invalid status' });
        }
        const employee = await Employee.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
        if (!employee) return res.status(404).json({ msg: 'Employee nahi mila' });
        res.json(employee);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/employees/:id
// @desc    Delete an employee
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) return res.status(404).json({ msg: 'Employee nahi mila' });
        res.json({ msg: 'Employee delete ho gaya' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;