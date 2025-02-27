import { PAIRING_INFO_KEY_PREFIX } from './constants';
import type { Device } from './hooks/useP2PCommunication';
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
): Promise<string> => {
  const { ipAddress, port } = pairingInfo;
  const key = createPairingInfoKey(PAIRING_INFO_KEY_PREFIX, ipAddress, port);
  await storage.setItem(key, JSON.stringify(pairingInfo));
  return key;
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

/**
 * Gets all the paired devices from storage.
 * @param storage The storage layer to use.
 * @returns An array of paired devices stored in storage.
 */
export const getAllPairedDevices = async (
  storage: StorageLayer
): Promise<Device[]> => {
  // Get all keys from storage
  const allKeys = await storage.getAllKeys();
  if (!allKeys) return [];

  // Filter keys that start with the pairing info prefix
  const keys = allKeys.filter((key: string) =>
    key.startsWith(PAIRING_INFO_KEY_PREFIX)
  );

  const pairedDevices: Device[] = [];

  // Process each key to get the pairing info
  for (const key of keys) {
    const storedValue = await storage.getItem(key);
    if (storedValue) {
      const pairingInfo = JSON.parse(storedValue) as PairingInfo;

      // Only include non-expired pairings
      if (pairingInfo.expiry > Date.now()) {
        const device = createDeviceFromPairingInfo(pairingInfo);
        pairedDevices.push(device);
      } else {
        // Remove expired pairings
        await storage.removeItem(key);
      }
    }
  }

  return pairedDevices;
};

/**
 * Given pairing info create and return a Device object
 * @param pairingInfo The pairing information
 * @returns A Device object created from the pairing information
 */
export const createDeviceFromPairingInfo = (
  pairingInfo: PairingInfo
): Device => {
  const { name, deviceName } = pairingInfo.extraData || {};
  return {
    id: `${pairingInfo.ipAddress}:${pairingInfo.port}`,
    name: name || deviceName || 'Unknown Device',
    pairingInfo,
    data: pairingInfo.extraData || {},
  };
};
