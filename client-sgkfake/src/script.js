const bookGrid = document.getElementById('bookGrid');

async function loadBooks(grade = 1) {
  try {
    const response = await fetch(`/api/books?grade=${encodeURIComponent(grade)}`);
    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }

    const books = await response.json();
    bookGrid.innerHTML = books.length
      ? books.map(book => {
        const src = book.cover_image_url
          ? (book.cover_image_url.startsWith('http') ? book.cover_image_url : `/images/${book.cover_image_url}`)
          : '/images/SGK-Toan1.png';
        return `
            <a href="#" class="book-item">
              <img src="${src}" alt="${book.name}">
              <p class="book-item-title">${book.name}</p>
            </a>
          `;
      }).join('')
      : '<p class="empty-state">Không tìm thấy sách cho lớp này.</p>';
  } catch (error) {
    console.error('Failed to load books:', error);
    bookGrid.innerHTML = '<p class="empty-state">Lỗi khi tải sách. Vui lòng thử lại sau.</p>';
  }
}

document.querySelectorAll('.menu-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    loadBooks(link.dataset.grade);
  });
});

loadBooks(1);
