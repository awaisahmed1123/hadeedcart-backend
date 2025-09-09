const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Tamam Models ko import karein
const Category = require('../models/Category');
const Vendor = require('../models/Vendor');
const Brand = require('../models/Brand');
const Product = require('../models/Product');
const Employee = require('../models/Employee'); // Employee model ko import karein
const User = require('../models/User');

// @route   POST /api/seed
// @desc    Database ko saaf karke naya sample data aur ADMIN banayein
router.post('/', async (req, res) => {
    
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ msg: 'Yeh operation sirf development mode mein mumkin hai' });
    }

    try {
        // Step 1: Purana tamam data saaf karein
        await Product.deleteMany({});
        await Category.deleteMany({});
        await Vendor.deleteMany({});
        await Brand.deleteMany({});
        await Employee.deleteMany({}); // Employees ko bhi saaf karein
        await User.deleteMany({});

        // Step 2: Pehla Admin User Banayein
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('123456', salt);

        const mainAdmin = new Employee({
            name: 'Main Admin',
            email: 'admin@hadeedcart.com',
            password: hashedPassword,
            role: 'Admin',
            // Admin ke paas tamam permissions hongi
            permissions: [
                'view_dashboard', 'manage_products', 'manage_categories', 
                'manage_brands', 'manage_vendors', 'manage_orders', 'manage_employees'
            ]
        });
        await mainAdmin.save();
        
        // (Optional) Baaqi sample data bhi bana sakte hain
        // ...

        res.status(201).json({
            message: "Database saaf karke Admin account bana diya gaya hai!",
            adminEmail: 'admin@hadeedcart.com',
            adminPassword: '123456'
        });

    } catch (err) {
        console.error('Seeding Error:', err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

module.exports = router;