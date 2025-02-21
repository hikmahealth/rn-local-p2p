import Aes from 'react-native-aes-crypto';

export type Encryption = {
  /**
   * Generate Encryption Key
   * @param password
   * @param salt
   * @param cost
   * @param length
   * @returns The encryption key
   */
  generateKey(
    password: string,
    salt: string,
    cost: number,
    length: number
  ): Promise<string>;

  /**
   * Encrypts data using AES-256-GCM.
   * @param data The data to encrypt.
   * @param key The encryption key.
   * @returns The encrypted data, including the prepended IV (initialization vector).
   */
  encrypt(data: string, key: string): Promise<{ cipher: string; iv: string }>;

  /**
   * Decrypts data using AES-256-GCM.
   * @param cipher The encrypted data , including the prepended IV.
   * @param iv The initialization vector.
   * @param key The decryption key.
   * @returns The decrypted data.
   */
  decrypt(cipher: string, iv: string, key: string): Promise<string>;
};

// const IV_LENGTH = 12; // FOR AES-256-GCM
const IV_LENGTH = 16;

export const createEncryption = (): Encryption => {
  const generateKey = async (
    password: string,
    salt: string,
    cost: number,
    length: number
  ) => {
    try {
      // if (!AesModule.pbkdf2) {
      // throw new Error('pbkdf2 method not available');
      // }
      return await Aes.pbkdf2(password, salt, cost, length, 'sha256');
    } catch (error) {
      console.error('Error in generateKey:', error);
      throw error;
    }
  };

  const encrypt = async (
    text: string,
    key: string
  ): Promise<{ cipher: string; iv: string }> => {
    const iv = await Aes.randomKey(IV_LENGTH);
    const cipher = await Aes.encrypt(text, key, iv, 'aes-256-cbc');

    return {
      cipher,
      iv,
    };
  };

  const decrypt = (cipher: string, iv: string, key: string) => {
    console.log('decrypt: ', cipher, typeof cipher);
    return Aes.decrypt(cipher, key, iv, 'aes-256-cbc');
  };

  return {
    generateKey,
    encrypt,
    decrypt,
  };
};
