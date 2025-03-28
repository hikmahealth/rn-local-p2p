import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import {
  createPeerNetwork,
  createEncryption,
  createQRCode,
  createRequestResponse,
  createDeviceFromPairingInfo,
  createPairingInfoKey,
} from '../index';

import type {
  PeerNetwork,
  Encryption,
  QRCodePairing,
  RequestResponse,
  PairingInfo,
  Router,
  StorageLayer,
} from '../index';
import { PAIRING_INFO_KEY_PREFIX } from '../constants';

type DeviceData = {
  name?: string;
  [key: string]: any;
};

export type Device = {
  id: string;
  name: string;
  pairingInfo: PairingInfo;
  data: DeviceData;
};

export type P2PCommunicationState = {
  myIpAddress: string;
  qrCode: string | null;
  pairedDevices: Device[];
};

export type P2PCommunicationActions = {
  generateQRCode: (extraData?: DeviceData) => Promise<void>;
  scanQRCode: (data: string) => Promise<void>;
  sendRequest: <TReq = any, TRes = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    deviceId: string,
    body?: TReq
  ) => Promise<TRes>;
  removePairedDevice: (deviceId: string) => Promise<void>;
};

export type P2PCommunicationConfig = {
  router?: Router | undefined;
  storage?: StorageLayer | undefined;
  password?: string;
  salt?: string;
  port?: number;
  pairingInfoKeyPrefix?: string;
};

const DEFAULT_CONFIG: Required<P2PCommunicationConfig> = {
  // @ts-expect-error router is not defined
  router: undefined,
  // @ts-expect-error storage is not defined
  storage: undefined,
  password: 'password',
  salt: 'salt',
  port: 12345,
  pairingInfoKeyPrefix: 'pairing-info',
};

export function useP2PCommunication<T extends DeviceData>(
  config: P2PCommunicationConfig = {}
): [P2PCommunicationState, P2PCommunicationActions] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const [peerNetwork, setPeerNetwork] = useState<PeerNetwork | null>(null);
  const [encryption, setEncryption] = useState<Encryption | null>(null);
  const [qrCodePairing, setQRCodePairing] = useState<QRCodePairing | null>(
    null
  );
  const [requestResponse, setRequestResponse] =
    useState<RequestResponse | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  const [state, setState] = useState<P2PCommunicationState>({
    myIpAddress: '',
    qrCode: null,
    pairedDevices: [],
  });

  const getIpAddress = async (): Promise<string> => {
    const netState = await NetInfo.fetch();
    if (netState.type === 'wifi' && netState.details?.ipAddress) {
      return netState.details.ipAddress;
    }
    throw new Error('Not connected to Wi-Fi or could not get the IP address');
  };

  useEffect(() => {
    const init = async () => {
      try {
        const newPeerNetwork = createPeerNetwork();
        const newEncryption = createEncryption();
        const newQRCodePairing = createQRCode(
          finalConfig.storage,
          getIpAddress
        );
        const newRequestResponse = createRequestResponse(
          finalConfig.storage,
          newPeerNetwork,
          newEncryption,
          newQRCodePairing.getPairingInfo
        );

        // Initialize router if provided
        if (finalConfig.router) {
          finalConfig.router.initialize(newRequestResponse);
        }

        setPeerNetwork(newPeerNetwork);
        setEncryption(newEncryption);
        setQRCodePairing(newQRCodePairing);
        setRequestResponse(newRequestResponse);

        const key = await newEncryption.generateKey(
          finalConfig.password,
          finalConfig.salt,
          5000,
          256
        );
        setEncryptionKey(key);

        const port = await newPeerNetwork.start(finalConfig.port);
        const ipAddress = await getIpAddress();

        const code = await newQRCodePairing.generateQRCode(
          port,
          key,
          undefined,
          { deviceName: 'Device: ' + ipAddress, extraData: {} }
        );

        const pairedDevices = await newQRCodePairing.getAllPairedDevices(
          finalConfig.storage
        );

        setState((prev) => ({
          ...prev,
          myIpAddress: ipAddress,
          qrCode: code,
          pairedDevices: pairedDevices,
        }));
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    init();
    return () => {
      peerNetwork?.stop();
    };
  }, []);

  const actions: P2PCommunicationActions = {
    generateQRCode: async (extraData?: Record<string, any>) => {
      if (!peerNetwork || !qrCodePairing || !encryptionKey) return;

      try {
        const port = peerNetwork.getPort();
        if (!port) throw new Error('Peer network not started');

        const ipAddress = await getIpAddress();
        const code = await qrCodePairing.generateQRCode(
          port,
          encryptionKey,
          undefined,
          { deviceName: 'Device: ' + ipAddress, ...extraData }
        );
        setState((prev) => ({ ...prev, qrCode: code }));
      } catch (error: any) {
        console.error('Error generating QR code:', error.message);
      }
    },

    scanQRCode: async (data: string) => {
      if (!qrCodePairing) return;

      try {
        const pairingInfo = await qrCodePairing.processQRCode(data);
        const key = await qrCodePairing.savePairingInfo(
          finalConfig.storage,
          pairingInfo
        );

        const existingDeviceIndex = state.pairedDevices.findIndex(
          (d) =>
            d.pairingInfo.ipAddress === pairingInfo.ipAddress &&
            d.pairingInfo.port === pairingInfo.port
        );

        if (existingDeviceIndex !== -1) {
          setState((prev) => ({
            ...prev,
            pairedDevices: prev.pairedDevices.map((device, index) =>
              index === existingDeviceIndex
                ? { ...device, pairingInfo }
                : device
            ),
          }));
          return;
        }

        const newDevice: Device = createDeviceFromPairingInfo(pairingInfo);

        setState((prev) => ({
          ...prev,
          pairedDevices: [...prev.pairedDevices, newDevice],
        }));
      } catch (error: any) {
        console.error('Error scanning QR code:', error.message);
      }
    },

    sendRequest: async <TReq = any, TRes = any>(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      deviceId: string,
      body?: TReq
    ): Promise<TRes> => {
      if (!requestResponse) throw new Error('Request/Response not initialized');

      const device = state.pairedDevices.find((d) => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found: ' + deviceId);
      }

      try {
        const response = await requestResponse.request<TReq, TRes>(
          { method, path, body },
          device.pairingInfo
        );

        if (response.status !== 200) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        return response.body as TRes;
      } catch (error: any) {
        console.error('Error sending request:', error.message);
        throw error;
      }
    },

    removePairedDevice: async (deviceId: string) => {
      try {
        // Update state to remove device from UI
        setState((prev) => ({
          ...prev,
          pairedDevices: prev.pairedDevices.filter((d) => d.id !== deviceId),
        }));

        // Parse the deviceId to get ipAddress and port
        const [ipAddress, portStr] = deviceId.split(':');
        if (!ipAddress || !portStr) {
          throw new Error('Invalid device id: ' + deviceId);
        }
        const port = parseInt(portStr, 10);

        // Create the key using the same format as when it was stored
        const key = createPairingInfoKey(
          PAIRING_INFO_KEY_PREFIX,
          ipAddress,
          port
        );
        await finalConfig.storage?.removeItem(key);
      } catch (error: any) {
        console.error('Error removing paired device:', error.message);
      }
    },
  };

  return [state, actions];
}
