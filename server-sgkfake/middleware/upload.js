const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../client-sgkfake/uploads');

//Ensure the upload files directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${unique}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
        return cb(new Error('Chỉ cho phép tải lên các tệp hình ảnh(jpg, jpeg, png, gif, webp)'));
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;