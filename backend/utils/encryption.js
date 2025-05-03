const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

// Load or generate the encryption key
let encryptionKey;
try {
  // Try to load the key from an environment variable first (best practice)
  encryptionKey = process.env.ENCRYPTION_KEY;
  
  // If not found in environment variables, try to load from a key file
  if (!encryptionKey) {
    const keyPath = path.join(__dirname, '..', 'encryption-key.txt');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    } else {
      // Generate a new key if not found
      encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
      // Save the key to a file (in production, use a secure key management service)
      fs.writeFileSync(keyPath, encryptionKey);
      console.log('Generated new encryption key');
    }
  }
} catch (error) {
  console.error('Error loading/generating encryption key:', error);
  process.exit(1); // Exit if we can't set up encryption
}

/**
 * Encrypts sensitive data
 * @param {any} data - Data to encrypt (can be object, string, etc.)
 * @returns {string} - Encrypted string
 */
function encrypt(data) {
  if (data === null || data === undefined) {
    return data;
  }
  
  try {
    // Convert object to string if needed
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Encrypt the data
    return CryptoJS.AES.encrypt(dataStr, encryptionKey).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    // Return the original data instead of failing
    // This is a fallback to prevent data loss but should be investigated
    return `[ENCRYPTION_ERROR: ${typeof data}]`;
  }
}

/**
 * Decrypts encrypted data
 * @param {string} encryptedData - Encrypted string
 * @param {boolean} asObject - Whether to parse result as JSON object
 * @returns {any} - Decrypted data
 */
function decrypt(encryptedData, asObject = false) {
  if (!encryptedData) {
    return encryptedData;
  }
  
  // Check if data was previously marked as an encryption error
  if (typeof encryptedData === 'string' && encryptedData.startsWith('[ENCRYPTION_ERROR:')) {
    console.warn('Attempted to decrypt data that was not encrypted due to a previous error');
    return encryptedData;
  }
  
  try {
    // Add debugging to help diagnose encryption issues
    console.log(`[Decrypt Debug] Decrypting data type: ${typeof encryptedData}, length: ${encryptedData.length}`);
    console.log(`[Decrypt Debug] First 20 chars: ${encryptedData.substring(0, 20)}...`);
    console.log(`[Decrypt Debug] Using key length: ${encryptionKey.length}`);
    
    // Decrypt the data
    const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      console.error(`[Decrypt Debug] Decryption produced empty result for: ${encryptedData.substring(0, 30)}...`);
      throw new Error('Decryption produced empty result');
    }
    
    console.log(`[Decrypt Debug] Successfully decrypted data, length: ${decryptedText.length}`);
    
    // Return as object or string based on parameter
    if (asObject) {
      try {
        return JSON.parse(decryptedText);
      } catch (parseError) {
        console.error('Error parsing decrypted JSON:', parseError);
        return decryptedText; // Return as string if parse fails
      }
    }
    return decryptedText;
  } catch (error) {
    console.error(`[Decrypt Debug] Decryption error: ${error.message}`, error);
    console.error(`[Decrypt Debug] Failed data: ${encryptedData.substring(0, 50)}...`);
    
    // Return a placeholder to indicate error instead of null
    return `[DECRYPTION_ERROR]`;
  }
}

/**
 * Process an object to encrypt specified fields
 * @param {object} obj - Object containing data
 * @param {string[]} fields - Array of field names to encrypt
 * @returns {object} - Object with encrypted fields
 */
function encryptFields(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(result[field]);
    }
  }
  
  return result;
}

/**
 * Process an object to decrypt specified fields
 * @param {object} obj - Object containing encrypted data
 * @param {string[]} fields - Array of field names to decrypt
 * @param {object} options - Options for decryption { asObject: Map of field names to boolean }
 * @returns {object} - Object with decrypted fields
 */
function decryptFields(obj, fields, options = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      const asObject = options.asObject && options.asObject[field] === true;
      result[field] = decrypt(result[field], asObject);
    }
  }
  
  return result;
}

module.exports = {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields
}; 