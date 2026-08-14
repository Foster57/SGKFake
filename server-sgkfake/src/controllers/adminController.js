const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function removeUploadedCover(coverUrl) {
  if (coverUrl && coverUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(coverUrl));
    fs.unlink(filePath, () => {});
  }
}

// GET /api/admin/books — lấy toàn bộ sách cho bảng admin
async function getBooks(req, res) {
  try {
    const result = await pool.query(`
      SELECT b.id, b.name, b.grade, b.subject_id, s.slug AS subject_slug,
             b.book_type, b.cover_image_url, b.pdf_url
      FROM books b
      LEFT JOIN subject s ON b.subject_id = s.id
      ORDER BY b.grade, b.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get books error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// POST /api/admin/books — thêm sách mới
async function createBook(req, res) {
  const { name, grade, subject_id, book_type, pdf_url } = req.body;
  const cover_image_url = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !grade || !subject_id) {
    return res.status(400).json({ error: 'Thiếu tên sách, lớp hoặc môn học' });
  }

  const gradeNum = parseInt(grade, 10);
  const subjectNum = parseInt(subject_id, 10);
  if (Number.isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
    return res.status(400).json({ error: 'Lớp không hợp lệ (phải từ 1 đến 12)' });
  }
  if (Number.isNaN(subjectNum)) {
    return res.status(400).json({ error: 'Môn học không hợp lệ' });
  }

  try {
    const subjectCheck = await pool.query('SELECT id FROM subject WHERE id = $1', [subjectNum]);
    if (subjectCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Môn học không tồn tại' });
    }

    const result = await pool.query(
      `INSERT INTO books (name, grade, subject_id, book_type, cover_image_url, pdf_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, grade, subject_id, book_type, cover_image_url, pdf_url`,
      [name.trim(), gradeNum, subjectNum, book_type || 'sgk', cover_image_url, pdf_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create book error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// PUT /api/admin/books/:id — cập nhật sách (chỉ sửa các field gửi lên)
async function updateBook(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Thiếu id sách' });
  }

  const { name, grade, subject_id, book_type, pdf_url } = req.body;
  const newCover = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const existing = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    const current = existing.rows[0];
    const newName = name !== undefined ? name.trim() : current.name;
    const newGrade = grade !== undefined ? parseInt(grade, 10) : current.grade;
    const newSubject = subject_id !== undefined ? parseInt(subject_id, 10) : current.subject_id;
    const newType = book_type !== undefined ? book_type : current.book_type;
    const newPdfUrl = pdf_url !== undefined ? pdf_url : current.pdf_url;
    const finalCover = newCover !== undefined ? newCover : current.cover_image_url;

    if (Number.isNaN(newGrade) || Number.isNaN(newSubject)) {
      return res.status(400).json({ error: 'Lớp hoặc môn học không hợp lệ' });
    }
    if (!newName) {
      return res.status(400).json({ error: 'Tên sách không được để trống' });
    }

    if (newSubject !== current.subject_id) {
      const subjectCheck = await pool.query('SELECT id FROM subject WHERE id = $1', [newSubject]);
      if (subjectCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Môn học không tồn tại' });
      }
    }

    const result = await pool.query(
      `UPDATE books
       SET name = $1, grade = $2, subject_id = $3, book_type = $4,
           cover_image_url = $5, pdf_url = $6
       WHERE id = $7
       RETURNING id, name, grade, subject_id, book_type, cover_image_url, pdf_url`,
      [newName, newGrade, newSubject, newType, finalCover, newPdfUrl, id]
    );

    if (newCover !== undefined) {
      removeUploadedCover(current.cover_image_url);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update book error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// DELETE /api/admin/books/:id — xóa sách
async function deleteBook(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Thiếu id sách' });
  }

  try {
    const existing = await pool.query('SELECT cover_image_url FROM books WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }

    await pool.query('DELETE FROM books WHERE id = $1', [id]);
    removeUploadedCover(existing.rows[0].cover_image_url);

    res.json({ message: 'Xóa sách thành công' });
  } catch (err) {
    console.error('Delete book error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// GET /api/admin/subjects — danh sách môn học kèm số sách
async function getSubjects(req, res) {
  try {
    const result = await pool.query(`
      SELECT s.id, s.slug, COUNT(b.id)::int AS book_count
      FROM subject s
      LEFT JOIN books b ON s.id = b.subject_id
      GROUP BY s.id, s.slug
      ORDER BY s.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// POST /api/admin/subjects — thêm môn học
async function createSubject(req, res) {
  const slug = (req.body.slug || '').trim().toLowerCase();

  if (!slug) {
    return res.status(400).json({ error: 'Tên môn học (slug) là bắt buộc' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO subject (slug) VALUES ($1) RETURNING id, slug',
      [slug]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Môn học này đã tồn tại' });
    }
    console.error('Create subject error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// PUT /api/admin/subjects/:id — sửa tên môn học
async function updateSubject(req, res) {
  const id = parseInt(req.params.id, 10);
  const slug = (req.body.slug || '').trim().toLowerCase();

  if (!id || !slug) {
    return res.status(400).json({ error: 'Thiếu id hoặc tên môn học' });
  }

  try {
    const result = await pool.query(
      'UPDATE subject SET slug = $1 WHERE id = $2 RETURNING id, slug',
      [slug, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy môn học' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tên môn học đã tồn tại' });
    }
    console.error('Update subject error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// DELETE /api/admin/subjects/:id — xóa môn học (chặn nếu đang có sách)
async function deleteSubject(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Thiếu id môn học' });
  }

  try {
    const used = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM books WHERE subject_id = $1',
      [id]
    );
    if (used.rows[0].cnt > 0) {
      return res.status(400).json({
        error: `Không thể xóa môn học này vì có ${used.rows[0].cnt} sách đang thuộc môn học`
      });
    }

    const result = await pool.query('DELETE FROM subject WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy môn học' });
    }
    res.json({ message: 'Xóa môn học thành công' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

module.exports = {
  getBooks,
  createBook,
  updateBook,
  deleteBook,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject
};
