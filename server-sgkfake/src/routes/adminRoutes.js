const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middlewares/authMiddleware');
const upload = require('../../middleware/upload');

router.use(authenticate, requireAdmin);

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File quá 5MB' });
    }
    return res.status(400).json({ error: `Lỗi upload: ${err.code}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Lỗi upload file' });
  }
  next();
}

// Sách
router.get('/books', adminController.getBooks);
router.post('/books', upload.single('cover_image'), handleUploadError, adminController.createBook);
router.put('/books/:id', upload.single('cover_image'), handleUploadError, adminController.updateBook);
router.delete('/books/:id', adminController.deleteBook);

// Môn học
router.get('/subjects', adminController.getSubjects);
router.post('/subjects', adminController.createSubject);
router.put('/subjects/:id', adminController.updateSubject);
router.delete('/subjects/:id', adminController.deleteSubject);

module.exports = router;
