const multer = require('multer');

// Hum file ko server ki disk par save karne ke bajaye memory mein store karenge
// taake usay seedha Cloudinary par bhej sakein.
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

module.exports = upload;