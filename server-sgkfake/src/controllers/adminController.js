const pool = require('../config/db');

// ==================== SÁCH ====================

async function getBooks(req, res) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.name, b.grade, b.subject_id, b.book_type, b.cover_image_url, b.created_at,
              s.slug AS subject_slug
       FROM books b
       LEFT JOIN subject s ON b.subject_id = s.id
       ORDER BY b.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function createBook(req, res) {
  const { name, grade, subject_id, book_type } = req.body;
  const cover_image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    if (!name || !grade || !subject_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await pool.query(
      'INSERT INTO books (name, grade, subject_id, book_type, cover_image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, grade, subject_id, book_type || 'sgk', cover_image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function updateBook(req, res) {
  const bookId = req.params.id;
  const { name, grade, subject_id, book_type } = req.body;
  const cover_image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const existing = await pool.query('SELECT * FROM books WHERE id = $1', [bookId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }
    const result = await pool.query(
      `UPDATE books SET
         name = COALESCE($1, name),
         grade = COALESCE($2, grade),
         subject_id = COALESCE($3, subject_id),
         book_type = COALESCE($4, book_type),
         cover_image_url = COALESCE($5, cover_image_url)
       WHERE id = $6 RETURNING *`,
      [name || null, grade || null, subject_id || null, book_type || null, cover_image_url, bookId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function deleteBook(req, res) {
  const bookId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING id', [bookId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sách' });
    }
    res.json({ message: 'Xóa sách thành công' });
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// ==================== MÔN HỌC ====================

async function getSubjects(req, res) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.slug, COUNT(b.id) AS book_count
       FROM subject s
       LEFT JOIN books b ON s.id = b.subject_id
       GROUP BY s.id, s.slug
       ORDER BY s.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function createSubject(req, res) {
  const { slug } = req.body;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Missing required field: slug' });
    }
    const result = await pool.query(
      'INSERT INTO subject (slug) VALUES ($1) RETURNING *',
      [slug]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function updateSubject(req, res) {
  const { slug } = req.body;
  const subjectId = req.params.id;
  try {
    if (!slug) {
      return res.status(400).json({ error: 'Missing required field: slug' });
    }
    const existing = await pool.query('SELECT * FROM subject WHERE id = $1', [subjectId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy môn học' });
    }
    const result = await pool.query(
      'UPDATE subject SET slug = $1 WHERE id = $2 RETURNING *',
      [slug, subjectId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug môn học đã tồn tại' });
    }
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function deleteSubject(req, res) {
  const subjectId = req.params.id;
  try {
    const result = await pool.query('DELETE FROM subject WHERE id = $1 RETURNING id', [subjectId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy môn học' });
    }
    res.json({ message: 'Xóa môn học thành công' });
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

// ==================== NGƯỜI DÙNG ====================

async function listUsers(req, res) {
  try {
    const result = await pool.query(
      'SELECT user_id, user_account, email, role, is_active FROM users ORDER BY user_id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function updateUserRole(req, res) {
  const userId = req.params.id;
  const { role } = req.body;
  try {
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role không hợp lệ (chỉ chấp nhận user hoặc admin)' });
    }
    const existing = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id, user_account, email, role',
      [role, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

async function deleteUser(req, res) {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE user_id = $1 AND is_active = true RETURNING user_id',
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    res.json({ message: 'Xóa người dùng thành công' });
  } catch (err) {
    console.error('DB query error:', err);
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
  deleteSubject,
  listUsers,
  updateUserRole,
  deleteUser
};
