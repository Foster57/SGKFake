const pool = require('../config/db');

// GET /api/books?grade=1&subject=toan&type=sgk
async function getBooks(req, res) {
  const { grade, subject, type } = req.query;

  if (!grade) {
    return res.status(400).json({ error: 'Missing required query parameter: grade' });
  }

  const gradeNum = parseInt(grade, 10);
  if (Number.isNaN(gradeNum)) {
    return res.status(400).json({ error: 'Invalid grade value; must be an integer' });
  }

  let query = `
    SELECT b.id, b.name, b.cover_image_url
    FROM books b
    LEFT JOIN subject s ON b.subject_id = s.id
    WHERE b.grade = $1 AND b.is_active = true
  `;
  const params = [gradeNum];

  if (subject) {
    const rawSubjects = String(subject).split(',').map(s => s.trim()).filter(Boolean);
    const numericSubjects = rawSubjects.map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    const stringSubjects = rawSubjects.filter(s => Number.isNaN(parseInt(s, 10)));

    if (numericSubjects.length > 0) {
      if (numericSubjects.length === 1) {
        params.push(numericSubjects[0]);
        query += ` AND b.subject_id = $${params.length}`;
      } else {
        params.push(numericSubjects);
        query += ` AND b.subject_id = ANY($${params.length}::int[])`;
      }
    } else if (stringSubjects.length > 0) {
      if (stringSubjects.length === 1) {
        params.push(stringSubjects[0]);
        query += ` AND s.slug = $${params.length}`;
      } else {
        params.push(stringSubjects);
        query += ` AND s.slug = ANY($${params.length}::text[])`;
      }
    }
  }
  if (type) {
    params.push(type);
    query += ` AND b.book_type = $${params.length}`;
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Database error' });
  }
}

module.exports = {
  getBooks
};
