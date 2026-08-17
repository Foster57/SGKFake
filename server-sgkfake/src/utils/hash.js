const crypto = require('crypto');

let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  try {
    bcrypt = require('bcrypt');
  } catch (e) {
    bcrypt = null;
  }
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function hashPasswordSHA256(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function hashPassword(password) {
  if (bcrypt) {
    return await bcrypt.hash(password, 10);
  }
  return hashPasswordSHA256(password);
}

async function comparePassword(password, storedHash) {
  if (isBcryptHash(storedHash)) {
    if (bcrypt) {
      return await bcrypt.compare(password, storedHash);
    }
    return false;
  }
  const hashed = hashPasswordSHA256(password);
  return storedHash === hashed;
}

async function needsRehash(storedHash) {
  if (!isBcryptHash(storedHash)) return true;
  return false;
}

module.exports = {
  bcrypt,
  hashPasswordSHA256,
  hashPassword,
  comparePassword,
  needsRehash
};
