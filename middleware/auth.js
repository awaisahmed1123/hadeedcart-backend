// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Header se token hasil karein
    const token = req.header('x-auth-token');

    // Check karein ke token mojood hai ya nahi
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Token ko verify karein
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // Request mein user ki details add kar dein
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};