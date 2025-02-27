import { PAIRING_INFO_KEY_PREFIX } from './constants';
import type { StorageLayer } from './QRCodePairing';
import type { PairingInfo } from './RequestResponse';

/**
 * Creates a key for storage based on prefix, IP address, and port.
 * @param prefix The prefix to use for the key.
 * @param ipAddress The IP address to use for the key.
 * @param port The port to use for the key.
 * @returns The key for storage.
 */
export function createPairingInfoKey(
  prefix: string,
  ipAddress: string,
  port: number
): string {
  return `${prefix}:${ipAddress}:${port}`;
}

/**
 * Saves pairing information to storage.
 * @param storage The storage layer to use.
 * @param pairingInfo The pairing information to save.
 */
export const savePairingInfo = async (
  storage: StorageLayer,
  pairingInfo: PairingInfo
): Promise<void> => {
  const { ipAddress, port } = pairingInfo;
  const key = createPairingInfoKey(PAIRING_INFO_KEY_PREFIX, ipAddress, port);
  await storage.setItem(key, JSON.stringify(pairingInfo));
};

/**
 * Retrieves pairing information from storage using IP and Port.
 * @param storage The storage layer to use.
 * @param ipAddress The IP address to use for the key.
 * @param port The port to use for the key.
 * @returns The pairing information stored in storage, or null if not found.
 */
export const getPairingInfo = async (
  storage: StorageLayer,
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
