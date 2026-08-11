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
  if (bcrypt) {
    return await bcrypt.compare(password, storedHash);
  }
  const hashed = hashPasswordSHA256(password);
  return (storedHash === hashed || storedHash === password);
}

module.exports = {
  bcrypt,
  hashPasswordSHA256,
  hashPassword,
  comparePassword
};
