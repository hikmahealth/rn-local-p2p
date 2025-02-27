import { v4 as uuidv4 } from 'uuid';
import type { PeerNetwork } from './PeerNetwork';
import type { Encryption } from './Encryption';
import type { QRCodePairing, StorageLayer } from './QRCodePairing';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type HttpRequest<T = any> = {
  method: HttpMethod;
  path: string;
  body?: T;
  headers?: Record<string, string>;
};

export type HttpResponse<T = any> = {
  status: number;
  body?: T;
  headers?: Record<string, string>;
};

export type PairingInfo = {
  ipAddress: string;
  port: number;
  key: string;
  expiry: number; // Unix timestamp (milliseconds).
  extraData?: Record<string, any>;
};

export type RequestResponse = {
  /**
   * Sends an HTTP-like request to a peer
   * @param request The HTTP request object
   * @param pairingInfo The pairing information for the destination peer
   * @param timeoutMs The timeout for the request (in milliseconds)
   * @returns A promise that resolves with the response data
   */
  request<TRequest = any, TResponse = any>(
    request: HttpRequest<TRequest>,
    pairingInfo: PairingInfo,
    timeoutMs?: number
  ): Promise<HttpResponse<TResponse>>;

  /**
   * GET request helper method
   */
  get<TResponse = any>(
    path: string,
    pairingInfo: PairingInfo,
    timeoutMs?: number
  ): Promise<HttpResponse<TResponse>>;

  /**
   * POST request helper method
   */
  post<TRequest = any, TResponse = any>(
    path: string,
    body: TRequest,
    pairingInfo: PairingInfo,
    timeoutMs?: number
  ): Promise<HttpResponse<TResponse>>;

  /**
   * Sets a callback function to be called when a request is received
   */
  onRequest(
    callback: (
      request: HttpRequest,
      pairingInfo: PairingInfo,
      sendResponse: (response: HttpResponse) => Promise<void>
    ) => void
  ): void;
};

export const createRequestResponse = (
  storage: StorageLayer,
  peerNetwork: PeerNetwork,
  encryption: Encryption,
  getPairingInfo: QRCodePairing['getPairingInfo']
): RequestResponse => {
  const DEFAULT_TIMEOUT = 5000;
  const pendingRequests = new Map<
    string,
    {
      resolve: (value: HttpResponse) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  let requestCallback:
    | ((
        request: HttpRequest,
        pairingInfo: PairingInfo,
        sendResponse: (response: HttpResponse) => Promise<void>
      ) => void)
    | null = null;

  const sendEncryptedMessage = async (
    message: any,
    pairingInfo: PairingInfo
  ): Promise<void> => {
    const messageStr = JSON.stringify(message);
    const { cipher, iv } = await encryption.encrypt(
      messageStr,
      pairingInfo.key
    );
    const data = JSON.stringify({ cipher, iv });
    await peerNetwork.send(data, pairingInfo.ipAddress, pairingInfo.port);
  };

  peerNetwork.onReceive(
    async (data: Buffer, senderIpAddress: string, senderPort: number) => {
      try {
        const pairingInfo = await getPairingInfo(
          storage,
          senderIpAddress,
          senderPort
        );
        if (!pairingInfo) {
          console.error(
            `No pairing info found for ${senderIpAddress}:${senderPort}`
          );
          return;
        }

        const stringData = data.toString('utf8');
        const { cipher, iv } = JSON.parse(stringData);
        const decryptedData = await encryption.decrypt(
          cipher,
          iv,
          pairingInfo.key
        );
        const message = JSON.parse(decryptedData);

        if (message.type === 'response' && message.requestId) {
          const pendingRequest = pendingRequests.get(message.requestId);
          if (pendingRequest) {
            clearTimeout(pendingRequest.timeout);
            pendingRequests.delete(message.requestId);
            pendingRequest.resolve(message.response);
          }
        } else if (
          message.type === 'request' &&
          message.requestId &&
          message.request
        ) {
          if (requestCallback) {
            const sendResponse = async (response: HttpResponse) => {
              await sendEncryptedMessage(
                {
                  type: 'response',
                  requestId: message.requestId,
                  response,
                },
                pairingInfo
              );
            };

            await requestCallback(message.request, pairingInfo, sendResponse);
          }
        }
      } catch (error) {
        console.error('Error processing received data:', error);
      }
    }
  );

  const requestImpl = async <TRequest = any, TResponse = any>(
    request: HttpRequest<TRequest>,
    pairingInfo: PairingInfo,
    timeoutMs: number = DEFAULT_TIMEOUT
  ): Promise<HttpResponse<TResponse>> => {
    const requestId = uuidv4();

    const promise = new Promise<HttpResponse<TResponse>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('Request timed out'));
      }, timeoutMs);

      pendingRequests.set(requestId, { resolve, reject, timeout });
    });

    await sendEncryptedMessage(
      {
        type: 'request',
        requestId,
        request,
      },
      pairingInfo
    );

    return promise;
  };

  return {
    request: requestImpl,

    get: async <TResponse = any>(
      path: string,
      pairingInfo: PairingInfo,
      timeoutMs?: number
    ) => {
      return requestImpl<never, TResponse>(
        { method: 'GET', path },
        pairingInfo,
        timeoutMs
      );
    },

    post: async <TRequest = any, TResponse = any>(
      path: string,
      body: TRequest,
      pairingInfo: PairingInfo,
      timeoutMs?: number
    ) => {
      return requestImpl<TRequest, TResponse>(
        { method: 'POST', path, body },
        pairingInfo,
        timeoutMs
      );
    },

    onRequest: (callback) => {
      requestCallback = callback;
    },
  };
};
