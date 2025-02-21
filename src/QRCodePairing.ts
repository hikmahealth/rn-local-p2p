import type { PairingInfo } from './RequestResponse';

export type StorageLayer = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type QRCodePairing = {
  /**
   * Generates a QR code containing the pairing information.
   * @param port The port the PeerNetwork module is listening on
   * @param encryptionKey The key to use. If not provided, one will be generated
   * @param expiryInMilliseconds The pairing expiry time (in milliseconds from now). Defaults to 8 hours.
   * @returns A string representing the QR code data (e.g. SVG data URL)
   */
  generateQRCode(
    port: number,
    encryptionKey: String,
    expiryInMilliseconds?: number,
    extraData?: Record<string, any>
  ): Promise<string>;

  /**
   * Scans a QR code and extracts the pairing information.
   * @param qrCodeData The data from the scanned QR code.
   * @returns The pairing information, or null if the QR code is invalid.
   * @throws Error if QR code data is invalid or pairing informarion is corrupted or expired
   */
  processQRCode(qrCodeData: string): Promise<PairingInfo>;

  /**
   * Saves pairing information to storage.
   * @param pairingInfo The pairing information to save.
   */
  savePairingInfo(pairingInfo: PairingInfo): Promise<void>;

  /**
   * Retrieves pairing information from storage using IP and Port.
   * @param ipAddress
   * @param port
   */
  getPairingInfo(ipAddress: string, port: number): Promise<PairingInfo | null>;

  /**
   * Removes all expired pairings from storage.
   */
  removeExpiredPairings(): Promise<void>;
};

const DEFAULT_EXPIRY = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
export const PAIRING_INFO_KEY_PREFIX = 'pairingInfo:';

export const createQRCode = (
  storage: StorageLayer,
  getIpAddress: () => Promise<string>
): QRCodePairing => {
  // FIXME: update code generation
  const generateQRCode = async (
    port: number,
    encryptionKey: string,
    expiryInMilliseconds: number = DEFAULT_EXPIRY,
    extraData?: Record<string, any>
  ): Promise<string> => {
    const key = encryptionKey;
    const expiry = Date.now() + expiryInMilliseconds;
    const ipAddress = await getIpAddress();

    const pairingInfo: Omit<PairingInfo, 'key'> & { key: string } = {
      ipAddress,
      port,
      key: key, // Store key as base64 string in QR code
      expiry,
      extraData,
    };

    const qrCodeData = JSON.stringify(pairingInfo);
    return qrCodeData;

    // return new Promise((resolve, reject) => {
    // returning the string version of the qrCode and it gets rendered as a qr code elsewhere
    // resolve(qrCodeData);
    // Using react-native-qrcode-svg, we can just pass in the value
    // TODO: This could be done outside the library
    // QRCode.svg(qrCodeData, (svg: string) => {
    // if (!svg) {
    // reject(new Error("Could not generate QR code"))
    // }
    // resolve(svg)
    // })
    // });
  };

  const processQRCode = async (qrCodeData: string): Promise<PairingInfo> => {
    try {
      const pairingInfo: Omit<PairingInfo, 'key'> & { key: string } =
        JSON.parse(qrCodeData);

      // Validate the structure
      if (
        !pairingInfo.ipAddress ||
        !pairingInfo.port ||
        !pairingInfo.key ||
        !pairingInfo.expiry
      ) {
        throw new Error('Invalid pairing information in QR code.');
      }

      const keyString = pairingInfo.key;
      // if (keyString.length !== 32) {
      //   throw new Error('Invalid encryption key length in QR code.');
      // }

      // FIXME: the date call function makes this function stateful
      if (pairingInfo.expiry <= Date.now()) {
        throw new Error('Pairing information has expired.');
      }

      return {
        ...pairingInfo,
        key: keyString,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error processing QR code: ${error.message}`);
      } else {
        throw new Error(`Error processing QR code`);
      }
    }
  };

  const savePairingInfo = async (pairingInfo: PairingInfo): Promise<void> => {
    const { ipAddress, port } = pairingInfo;
    const key = createPairingInfoKey(PAIRING_INFO_KEY_PREFIX, ipAddress, port);
    await storage.setItem(key, JSON.stringify(pairingInfo));
  };

  const getPairingInfo = async (
    ipAddress: string,
    port: number
  ): Promise<PairingInfo | null> => {
    const key = createPairingInfoKey(PAIRING_INFO_KEY_PREFIX, ipAddress, port);
    const storedValue = await storage.getItem(key);
    if (storedValue) {
      const pairingInfo = JSON.parse(storedValue) as PairingInfo;
      if (pairingInfo.expiry > Date.now()) {
        return pairingInfo;
      } else {
        // Expired, so move it
        await storage.removeItem(key);
        return null;
      }
    }
    return null;
  };

  const removeExpiredPairings = async (): Promise<void> => {
    // This could be inneficient with AsyncStorage if there are many keys
    //
    // With async storage: we get all keys then loop through them all
    const allKeys = await storage.getItem('');
    if (!allKeys) return;

    const keys = (allKeys as any).filter((key: string) =>
      key.startsWith(PAIRING_INFO_KEY_PREFIX)
    );

    for (const key of keys) {
      const storedValue = await storage.getItem(key);
      if (storedValue) {
        const pairingInfo = JSON.parse(storedValue) as PairingInfo;
        if (pairingInfo.expiry <= Date.now()) {
          await storage.removeItem(key);
        }
      }
    }
  };

  return {
    generateQRCode,
    processQRCode,
    savePairingInfo,
    getPairingInfo,
    removeExpiredPairings,
  };
};

export function createPairingInfoKey(
  prefix: string,
  ipAddress: string,
  port: number
): string {
  return `${prefix}:${ipAddress}:${port}`;
}
