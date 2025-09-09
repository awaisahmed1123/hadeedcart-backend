const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false // Security ke liye, password queries mein nahi aayega
    },
    permissions: [{
        type: String,
        enum: [
            'view_dashboard',
            'manage_products',
            'manage_categories',
            'manage_brands',
            'manage_vendors',
            'manage_orders',
            'manage_employees'
        ]
    }],
    role: {
        type: String,
        enum: ['Admin', 'Employee'],
        default: 'Employee'
    },
    status: {
        type: String,
        enum: ['Active', 'Suspended'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Employee', EmployeeSchema);