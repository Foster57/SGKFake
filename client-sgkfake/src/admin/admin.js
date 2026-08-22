document.addEventListener('DOMContentLoaded', () => {

    // ==================== AUTH GUARD ====================
    // Client-side guard bổ sung (server-side page guard đã kiểm tra trước)
    // accessToken là httpOnly cookie — kiểm tra localStorage hint
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || userData.role !== 'admin') {
        localStorage.removeItem('userData');
        window.location.replace('/login');
        return;
    }

    // ==================== HELPERS ====================
    async function apiFetch(url, options = {}) {
        try {
            const res = await SGKAuth.authFetch(url, options);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Lỗi server' }));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            return res.json();
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    }

    function showToast(message, type = 'success') {
        const existing = document.querySelector('.admin-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'admin-toast';
        const bg = type === 'success'
            ? 'background:#16a34a; color:#fff;'
            : 'background:#dc2626; color:#fff;';
        const icon = type === 'success' ? 'ri-check-line' : 'ri-error-warning-line';
        toast.setAttribute('style', `
            position:fixed; bottom:32px; right:32px; z-index:2000;
            padding:14px 24px; border-radius:12px; font-size:14px; font-weight:600;
            box-shadow:0 8px 24px rgba(0,0,0,0.15); display:flex; align-items:center; gap:8px;
            animation: slideUp 0.25s ease; ${bg}
        `);
        toast.innerHTML = `<i class="${icon}"></i> ${message}`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
        setTimeout(() => toast.remove(), 3000);
    }

    // ==================== SIDEBAR NAV ====================
    const navLinks = document.querySelectorAll('.admin-nav-link');
    const sections = document.querySelectorAll('.admin-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const target = link.dataset.section;
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${target}`).classList.add('active');

            if (target === 'users') loadUsers();
            if (target === 'books') loadBooks();
        });
    });

    // ==================== DROPDOWN ====================
    const userMenu = document.querySelector('.user-menu-wrapper');
    const userDropdown = document.querySelector('.user-dropdown');
    if (userMenu && userDropdown) {
        let timeoutID;
        userMenu.addEventListener('mouseenter', () => {
            clearTimeout(timeoutID);
            userDropdown.style.display = 'block';
        });
        userMenu.addEventListener('mouseleave', () => {
            timeoutID = setTimeout(() => { userDropdown.style.display = 'none'; }, 200);
        });
        const avatar = userMenu.querySelector('.user-avatar-btn');
        if (avatar) {
            avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
            });
        }
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target)) userDropdown.style.display = 'none';
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await SGKAuth.logout();
            window.location.href = '/login';
        });
    }

    // ==================== SUBJECTS CACHE ====================
    let subjectsMap = {};

    async function loadSubjectsCache() {
        try {
            const subjects = await apiFetch('/api/admin/subjects');
            subjectsMap = {};
            subjects.forEach(s => { subjectsMap[s.id] = s.slug; });
            populateSubjectSelect(subjects);
        } catch (err) {
            console.error('Failed to load subjects:', err);
        }
    }

    function populateSubjectSelect(subjects) {
        const select = document.getElementById('bookSubject');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled selected>Chọn môn</option>';
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = formatSlug(s.slug);
            select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
    }

    function formatSlug(slug) {
        if (!slug) return '';
        return slug
            .replace(/&/g, ' & ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^./, c => c.toUpperCase());
    }

    // ==================== BOOKS ====================
    const bookTableBody = document.getElementById('bookTableBody');
    const bookEmpty = document.getElementById('bookEmpty');
    const bookSearch = document.getElementById('bookSearch');
    let allBooks = [];

    async function loadBooks() {
        try {
            allBooks = await apiFetch('/api/admin/books');
            renderBooks(allBooks);
        } catch (err) {
            if (bookTableBody) bookTableBody.innerHTML = '';
            if (bookEmpty) {
                bookEmpty.style.display = 'block';
                bookEmpty.querySelector('p').textContent = 'Lỗi khi tải danh sách sách';
            }
        }
    }

    function renderBooks(books) {
        if (!bookTableBody) return;
        if (!books.length) {
            bookTableBody.innerHTML = '';
            bookEmpty.style.display = 'block';
            return;
        }
        bookEmpty.style.display = 'none';

        bookTableBody.innerHTML = books.map(book => {
            const imgSrc = book.cover_image_url
                ? (book.cover_image_url.startsWith('/') ? book.cover_image_url : `/images/${book.cover_image_url}`)
                : '';
            const subjectLabel = formatSlug(subjectsMap[book.subject_id] || '');
            const typeBadge = book.book_type === 'sgk'
                ? '<span class="badge badge-type">SGK</span>'
                : '<span class="badge badge-type">SGV</span>';
            const imgCell = imgSrc
                ? `<img class="book-thumb" src="${imgSrc}" alt="${book.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="book-thumb-placeholder" style="display:none;"><i class="ri-image-line"></i></div>`
                : `<div class="book-thumb-placeholder"><i class="ri-image-line"></i></div>`;

            return `
                <tr>
                    <td class="id-cell">${book.id}</td>
                    <td class="image-cell">${imgCell}</td>
                    <td><strong>${escapeHtml(book.name)}</strong></td>
                    <td><span class="badge badge-grade">Lớp ${book.grade}</span></td>
                    <td><span class="badge badge-subject">${subjectLabel}</span></td>
                    <td>${typeBadge}</td>
                    <td>
                        <div class="action-group">
                            <button class="btn-icon edit" title="Chỉnh sửa" onclick="openEditBook(${book.id})">
                                <i class="ri-edit-line"></i>
                            </button>
                            <button class="btn-icon delete" title="Xóa" onclick="confirmDeleteBook(${book.id}, '${escapeHtml(book.name).replace(/'/g, "\\'")}')">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Search books
    if (bookSearch) {
        bookSearch.addEventListener('input', () => {
            const q = bookSearch.value.toLowerCase().trim();
            if (!q) return renderBooks(allBooks);
            const filtered = allBooks.filter(b =>
                b.name.toLowerCase().includes(q) ||
                (subjectsMap[b.subject_id] || '').toLowerCase().includes(q)
            );
            renderBooks(filtered);
        });
    }

    // ==================== BOOK MODAL ====================
    const bookModal = document.getElementById('bookModal');
    const bookForm = document.getElementById('bookForm');
    const bookFormId = document.getElementById('bookFormId');
    const bookModalTitle = document.getElementById('bookModalTitle');
    const bookCoverFile = document.getElementById('bookCoverFile');
    const bookCoverUpload = document.getElementById('bookCoverUpload');
    const bookCoverPreview = document.getElementById('bookCoverPreview');

    let editingBookId = null;

    function openBookModal() {
        bookModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeBookModalFn() {
        bookModal.classList.remove('open');
        document.body.style.overflow = '';
        bookForm.reset();
        editingBookId = null;
        bookFormId.value = '';
        bookModalTitle.textContent = 'Thêm sách mới';
        bookCoverPreview.style.display = 'none';
        bookCoverUpload.classList.remove('has-file');
        bookCoverUpload.querySelector('p').textContent = 'Nhấn để chọn ảnh hoặc kéo thả vào đây';
    }

    document.getElementById('btnAddBook').addEventListener('click', () => {
        closeBookModalFn();
        openBookModal();
    });

    document.getElementById('closeBookModal').addEventListener('click', closeBookModalFn);
    document.getElementById('cancelBookModal').addEventListener('click', closeBookModalFn);
    bookModal.addEventListener('click', (e) => {
        if (e.target === bookModal) closeBookModalFn();
    });

    // File upload preview
    bookCoverUpload.addEventListener('click', () => bookCoverFile.click());
    bookCoverUpload.addEventListener('dragover', (e) => { e.preventDefault(); bookCoverUpload.classList.add('has-file'); });
    bookCoverUpload.addEventListener('dragleave', () => { bookCoverUpload.classList.remove('has-file'); });
    bookCoverUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        bookCoverUpload.classList.remove('has-file');
        if (e.dataTransfer.files.length) {
            bookCoverFile.files = e.dataTransfer.files;
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    bookCoverFile.addEventListener('change', () => {
        if (bookCoverFile.files.length) handleFileSelect(bookCoverFile.files[0]);
    });

    function handleFileSelect(file) {
        if (!file) return;
        bookCoverUpload.querySelector('p').textContent = file.name;
        bookCoverUpload.classList.add('has-file');
        const reader = new FileReader();
        reader.onload = (e) => {
            bookCoverPreview.src = e.target.result;
            bookCoverPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    // Edit book - populate modal
    window.openEditBook = function (id) {
        const book = allBooks.find(b => b.id === id);
        if (!book) return;

        editingBookId = id;
        bookFormId.value = id;
        bookModalTitle.textContent = 'Chỉnh sửa sách';
        document.getElementById('bookName').value = book.name;
        document.getElementById('bookGrade').value = book.grade;
        document.getElementById('bookSubject').value = book.subject_id;
        document.getElementById('bookType').value = book.book_type || 'sgk';

        if (book.cover_image_url) {
            const src = book.cover_image_url.startsWith('/') ? book.cover_image_url : `/images/${book.cover_image_url}`;
            bookCoverPreview.src = src;
            bookCoverPreview.style.display = 'block';
            bookCoverUpload.classList.add('has-file');
            bookCoverUpload.querySelector('p').textContent = 'Ảnh hiện tại (chọn file mới để thay thế)';
        }

        openBookModal();
    };

    // Save book
    document.getElementById('saveBookModal').addEventListener('click', async () => {
        const name = document.getElementById('bookName').value.trim();
        const grade = document.getElementById('bookGrade').value;
        const subjectId = document.getElementById('bookSubject').value;
        const bookType = document.getElementById('bookType').value;
        const file = bookCoverFile.files[0];

        if (!name || !grade || !subjectId) {
            showToast('Vui lòng nhập đầy đủ tên sách, lớp và môn học', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('grade', grade);
        formData.append('subject_id', subjectId);
        formData.append('book_type', bookType);
        if (file) formData.append('cover_image', file);

        try {
            const url = editingBookId ? `/api/admin/books/${editingBookId}` : '/api/admin/books';
            const method = editingBookId ? 'PUT' : 'POST';
            const response = await SGKAuth.authFetch(url, {
                method,
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Lỗi server ${response.status}`);
            }

            showToast(editingBookId ? 'Cập nhật sách thành công' : 'Thêm sách thành công');
            closeBookModalFn();
            loadBooks();
        } catch (err) {
            showToast(err.message || 'Có lỗi xảy ra', 'error');
        }
    });

    // Delete book
    let deletingBookId = null;

    window.confirmDeleteBook = function (id, name) {
        if (deletingBookId === id) return;
        if (!confirm(`Xác nhận xóa sách "${name}"?`)) return;
        deleteBook(id);
    };

    async function deleteBook(id) {
        if (deletingBookId === id) return;
        deletingBookId = id;
        try {
            await apiFetch(`/api/admin/books/${id}`, { method: 'DELETE' });
            showToast('Xóa sách thành công');
            loadBooks();
        } catch (err) {
            showToast(err.message || 'Xóa sách thất bại', 'error');
        } finally {
            deletingBookId = null;
        }
    }

    // ==================== USERS ====================
    const userTableBody = document.getElementById('userTableBody');
    const userEmpty = document.getElementById('userEmpty');
    const userSearch = document.getElementById('userSearch');
    let allUsers = [];

    async function loadUsers() {
        try {
            allUsers = await apiFetch('/api/admin/users');
            renderUsers(allUsers);
        } catch (err) {
            if (userTableBody) userTableBody.innerHTML = '';
            if (userEmpty) {
                userEmpty.style.display = 'block';
                userEmpty.querySelector('p').textContent = 'Lỗi khi tải danh sách người dùng';
            }
        }
    }

    function renderUsers(users) {
        if (!userTableBody) return;
        if (!users.length) {
            userTableBody.innerHTML = '';
            userEmpty.style.display = 'block';
            return;
        }
        userEmpty.style.display = 'none';

        userTableBody.innerHTML = users.map(user => {
            const roleBadge = user.role === 'admin'
                ? '<span class="badge badge-role-admin">Admin</span>'
                : '<span class="badge badge-role-user">User</span>';

            return `
                <tr>
                    <td class="id-cell">${user.user_id}</td>
                    <td><strong>${user.user_account}</strong></td>
                    <td>${user.email || ''}</td>
                    <td>${roleBadge}</td>
                    <td>
                        <div class="action-group">
                            <button class="btn-icon edit" title="Đổi vai trò" onclick="openEditUser(${user.user_id}, '${user.user_account.replace(/'/g, "\\'")}', '${(user.email || '').replace(/'/g, "\\'")}', '${user.role}')">
                                <i class="ri-shield-user-line"></i>
                            </button>
                            <button class="btn-icon delete" title="Xóa" onclick="confirmDeleteUser(${user.user_id}, '${user.user_account.replace(/'/g, "\\'")}')">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Search users
    if (userSearch) {
        userSearch.addEventListener('input', () => {
            const q = userSearch.value.toLowerCase().trim();
            if (!q) return renderUsers(allUsers);
            const filtered = allUsers.filter(u =>
                (u.user_account || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q)
            );
            renderUsers(filtered);
        });
    }

    // ==================== USER MODAL ====================
    const userModal = document.getElementById('userModal');
    let editingUserId = null;

    function closeUserModalFn() {
        userModal.classList.remove('open');
        document.body.style.overflow = '';
        editingUserId = null;
        document.getElementById('userForm').reset();
    }

    document.getElementById('closeUserModal').addEventListener('click', closeUserModalFn);
    document.getElementById('cancelUserModal').addEventListener('click', closeUserModalFn);
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) closeUserModalFn();
    });

    window.openEditUser = function (id, account, email, role) {
        editingUserId = id;
        document.getElementById('userFormId').value = id;
        document.getElementById('userFormAccount').value = account;
        document.getElementById('userFormEmail').value = email;
        document.getElementById('userFormRole').value = role;
        userModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    // Save user role
    document.getElementById('saveUserModal').addEventListener('click', async () => {
        const role = document.getElementById('userFormRole').value;
        if (!editingUserId) return;

        try {
            await apiFetch(`/api/admin/users/${editingUserId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            showToast('Cập nhật vai trò thành công');
            closeUserModalFn();
            loadUsers();
        } catch (err) {
            showToast(err.message || 'Cập nhật vai trò thất bại', 'error');
        }
    });

    // Delete user
    window.confirmDeleteUser = function (id, account) {
        if (!confirm(`Xác nhận xóa người dùng "${account}"?`)) return;
        deleteUser(id);
    };

    async function deleteUser(id) {
        try {
            await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            showToast('Xóa người dùng thành công');
            loadUsers();
        } catch (err) {
            showToast(err.message || 'Xóa người dùng thất bại', 'error');
        }
    }

    // ==================== INIT ====================
    loadSubjectsCache();
    loadBooks();
});
