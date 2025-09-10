const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Sahi header se token hasil karein
    const authHeader = req.header('Authorization');

    // Check karein ke header mojood hai aur "Bearer " se shuru hota hai
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ msg: 'No valid token, authorization denied' });
    }

    try {
        // "Bearer " wala hissa hata kar token hasil karein
        const token = authHeader.split(' ')[1];

        // Token ko verify karein
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};