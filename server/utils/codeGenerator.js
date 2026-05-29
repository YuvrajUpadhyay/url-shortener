const { customAlphabet } = require('nanoid');

// Base62: digits + uppercase + lowercase = 62^7 = ~3.5 trillion combinations
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// 7 characters gives enough entropy for billions of URLs before collision probability matters
const generateCode = customAlphabet(BASE62, 7);

module.exports = { generateCode };
