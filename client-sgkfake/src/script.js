// Page-BookGrid Logic & UI Interactions

const bookGrid = document.getElementById('bookGrid');
let currentGrade = 1;
let currentSubjects = [];
let currentBookType = 'sgk';

// Helper function to build image path
function getCoverImageUrl(book) {
    if (!book.cover_image_url) {
        return '/images/lop1/SGK-Toan1.1.png';
    }
    if (book.cover_image_url.startsWith('http') || book.cover_image_url.startsWith('/')) {
        return book.cover_image_url;
    }
    return `/images/${book.cover_image_url}`;
}

// Fetch and render books
async function loadBooks(grade = currentGrade, subjects = currentSubjects, type = currentBookType) {
    if (!bookGrid) return;

    try {
        currentGrade = grade;
        currentSubjects = subjects;
        currentBookType = type;

        let url = `/api/books?grade=${encodeURIComponent(grade)}`;

        if (Array.isArray(subjects) && subjects.length > 0) {
            url += `&subject=${encodeURIComponent(subjects.join(','))}`;
        } else if (typeof subjects === 'string' && subjects.trim()) {
            url += `&subject=${encodeURIComponent(subjects.trim())}`;
        }

        if (type) {
            url += `&type=${encodeURIComponent(type)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Server error ${response.status}`);
        }

        const books = await response.json();

        if (books && books.length > 0) {
            bookGrid.innerHTML = books.map(book => {
                const src = getCoverImageUrl(book);
                return `
                    <a href="#" class="book-item">
                        <div class="book-img-wrapper">
                            <img src="${src}" alt="${book.name}" loading="lazy" onerror="this.onerror=null; this.src='/images/SGK-Toan1.1.png';">
                        </div>
                        <div class="book-title-pill">
                            <p class="book-item-title">${book.name}</p>
                        </div>
                    </a>
                `;
            }).join('');
        } else {
            bookGrid.innerHTML = '<p class="empty-state">Không có sách cần tìm.</p>';
        }
    } catch (error) {
        console.error('Failed to load books:', error);
        bookGrid.innerHTML = '<p class="empty-state">Lỗi khi tải sách. Vui lòng thử lại sau.</p>';
    }
}

// Grade Selection Handler
document.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();

        // Update active grade styling
        document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.menu-item-wrapper').forEach(w => w.classList.remove('active'));

        link.classList.add('active');
        if (link.parentElement) {
            link.parentElement.classList.add('active');
        }

        const selectedGrade = link.dataset.grade;
        loadBooks(selectedGrade, currentSubjects, currentBookType);
    });
});

// Book Type Selection Handler (Sách giáo khoa / Sách giáo viên)
document.querySelectorAll('.book-type-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.book-type-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const type = link.dataset.type || '';
        loadBooks(currentGrade, currentSubjects, type);
    });
});

// Subject Checkboxes Handler
const subjectCheckboxes = document.querySelectorAll('.subject-checkbox');
subjectCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        const checkedValues = Array.from(subjectCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        loadBooks(currentGrade, checkedValues, currentBookType);
    });
});

// Initial Load
if (bookGrid) {
    loadBooks(1, [], 'sgk');
}

// User Profile Dropdown Handler
const userMenu = document.querySelector('.user-menu-wrapper');
const userDropdown = document.querySelector('.user-dropdown');

if (userMenu && userDropdown) {
    let timeoutID;
    userMenu.addEventListener('mouseenter', () => {
        clearTimeout(timeoutID);
        userDropdown.style.display = 'block';
    });
    userMenu.addEventListener('mouseleave', () => {
        timeoutID = setTimeout(() => {
            userDropdown.style.display = 'none';
        }, 200);
    });

    // Also support click toggle for touch devices
    const userAvatarBtn = userMenu.querySelector('.user-avatar-btn');
    if (userAvatarBtn) {
        userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = userDropdown.style.display === 'block';
            userDropdown.style.display = isVisible ? 'none' : 'block';
        });
    }

    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target)) {
            userDropdown.style.display = 'none';
        }
    });
}

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (window.SGKAuth) {
            await SGKAuth.logout();
        } else {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userData');
            sessionStorage.removeItem('resetEmail');
        }
        window.location.href = logoutBtn.getAttribute('href') || '/pages/index.html';
    });
}
