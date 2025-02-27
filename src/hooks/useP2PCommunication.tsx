import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import {
  createPeerNetwork,
  createEncryption,
  createQRCode,
  createRequestResponse,
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

export type Device<T> = {
  id: string;
  name: string;
  pairingInfo: PairingInfo;
  data: T;
};

export type P2PCommunicationState<T> = {
  myIpAddress: string;
  qrCode: string | null;
  pairedDevices: Device<T>[];
};

export type P2PCommunicationActions<T> = {
  generateQRCode: (extraData?: Record<string, any>) => Promise<void>;
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

export function useP2PCommunication<T>(
  config: P2PCommunicationConfig = {}
): [P2PCommunicationState<T>, P2PCommunicationActions<T>] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const [peerNetwork, setPeerNetwork] = useState<PeerNetwork | null>(null);
  const [encryption, setEncryption] = useState<Encryption | null>(null);
  const [qrCodePairing, setQRCodePairing] = useState<QRCodePairing | null>(
    null
  );
  const [requestResponse, setRequestResponse] =
    useState<RequestResponse | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  const [state, setState] = useState<P2PCommunicationState<T>>({
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
        setState((prev) => ({ ...prev, myIpAddress: ipAddress }));
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    init();
    return () => {
      peerNetwork?.stop();
    };
  }, []);

  const actions: P2PCommunicationActions<T> = {
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
        await qrCodePairing.savePairingInfo(finalConfig.storage, pairingInfo);

        const newDevice: Device<T> = {
          id: `${pairingInfo.ipAddress}:${pairingInfo.port}`,
          name: pairingInfo.extraData?.deviceName || 'Unknown Device',
          pairingInfo,
          data: {} as T,
        };

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
        setState((prev) => ({
          ...prev,
          pairedDevices: prev.pairedDevices.filter((d) => d.id !== deviceId),
        }));

        const key = `${finalConfig.pairingInfoKeyPrefix}-${deviceId}`;
        await finalConfig.storage?.removeItem(key);
      } catch (error: any) {
        console.error('Error removing paired device:', error.message);
      }
    },
  };

  return [state, actions];
}
