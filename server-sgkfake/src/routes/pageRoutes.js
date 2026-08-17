const express = require('express');
const path = require('path');
const { requireAuthPage, requireAdminPage } = require('../middlewares/pageGuard');

const router = express.Router();
const clientDir = path.join(__dirname, '..', '..', '..', 'client-sgkfake');

// Cache-Control header cho protected pages: không cho browser cache
function noCacheHeaders(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
}

// ==================== PUBLIC ROUTES ====================

router.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'index.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'sign-in.html'));
});

router.get('/signup', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'sign-up.html'));
});

router.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'forget-password.html'));
});

router.get('/verify-otp', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'verify-otp.html'));
});

router.get('/auth/callback', (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'auth', 'callback.html'));
});

// ==================== PROTECTED USER ROUTES ====================

router.get('/user', noCacheHeaders, requireAuthPage, (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'user-pages', 'user.html'));
});

router.get('/user/profile', noCacheHeaders, requireAuthPage, (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'user-pages', 'user-profile.html'));
});

router.get('/user/books', noCacheHeaders, requireAuthPage, (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'user-pages', 'book-store.html'));
});

router.get('/user/reset-password', noCacheHeaders, requireAuthPage, (req, res) => {
    res.sendFile(path.join(clientDir, 'pages', 'user-pages', 'user-resetpassword.html'));
});

// ==================== PROTECTED ADMIN ROUTES ====================

router.get('/admin', noCacheHeaders, requireAdminPage, (req, res) => {
    res.sendFile(path.join(clientDir, 'src', 'admin', 'admin.html'));
});

// ==================== ERROR PAGES ====================

router.get('/403', (req, res) => {
    res.status(403).sendFile(path.join(clientDir, 'pages', '403.html'));
});

module.exports = router;
