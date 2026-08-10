// Page-BookGrid

const bookGrid = document.getElementById('bookGrid');
let currentGrade = 1;
let currentSubject = '';

async function loadBooks(grade = currentGrade, subject = currentSubject) {
  try {
    currentGrade = grade;
    currentSubject = subject;
    console.log(currentGrade, currentSubject);
    let url = `/api/books?grade=${encodeURIComponent(grade)}`;
    if (subject) {
      url += `&subject=${encodeURIComponent(subject)}`;
    }

    const response = await fetch(url);
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
      : '<p class="empty-state">Không có sách cần tìm.</p>';
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
    loadBooks(link.dataset.grade, currentSubject);
  });
});

document.querySelectorAll('.subject-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const selectedSubject = link.dataset.subject;
    if (link.classList.contains('active')) {
      link.classList.remove('active');
      loadBooks(currentGrade, '');
    } else {
      document.querySelectorAll('.subject-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadBooks(currentGrade, selectedSubject);
    }
  });
});

loadBooks(1, '');

// User-ProfileDropdown
const userMenu = document.querySelector('.user-menu-wrapper');
const userDropdown = document.querySelector('.user-dropdown');

let timeoutID;
userMenu.addEventListener('mouseenter', () => {
  clearTimeout(timeoutID);
  userDropdown.style.display = 'block';
});
userMenu.addEventListener('mouseleave', () => {
  timeoutID = setTimeout(() => {
    userDropdown.style.display = 'none';
  }, 150);
});
