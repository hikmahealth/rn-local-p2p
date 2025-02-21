import dgram from 'react-native-udp';

export type PeerNetwork = {
  /**
  Starts listening for incoming UDP packets on a specified port.
  @param port: The port to listen on. If 0, the OS will assign a random available port.
  @returns The port number that was bound to.
  */
  start(port: number): Promise<number>;

  /**
   * Stops listening for incoming UDP packets
   */
  stop(): Promise<void>;

  /**
   * Sends a UDP packet to a specific IP address and port.
   * @param data: The data to send
   * @param ipAddress: The destination IP address
   * @param port: The destination port.
   */
  send(data: string, ipAddress: string, port: number): Promise<void>;

  /**
   * Sets a callback function to be called when data is received.
   * @param callback: The callback function. Receives the data , the sender's IP address, and the sender's Port.
   */
  onReceive(
    callback: (
      data: Buffer,
      senderIpAddress: string,
      senderPort: number
    ) => void
  ): void;

  /**
   * Get the bound port number. Returns null if the socket is not started.
   */
  getPort(): number | null;
};

/**
 * Initialize a new peer network over udp4
 */
export const createPeerNetwork = (): PeerNetwork => {
  // @ts-expect-error socket is not defined
  let socket: dgram.Socket | null = null;
  let receiveCallback:
    | ((data: Buffer, senderIpAddress: string, senderPort: number) => void)
    | null = null;
  let boundPort: number | null = null;

  const start = async (port: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (socket) {
        reject(new Error('Socket already started.'));
        return;
      }

      socket = dgram.createSocket({ type: 'udp4' });

      socket.on('listening', () => {
        const address = socket?.address();
        if (address && typeof address === 'object') {
          boundPort = address.port;
          resolve(address.port);
        } else {
          // This should not happen!
          reject(new Error('Could not determine bound port'));
        }
      });

      socket.on(
        'message',
        (msg: Buffer, rinfo: { address: string; port: number }) => {
          if (receiveCallback) {
            receiveCallback(msg, rinfo.address, rinfo.port);
          }
        }
      );

      socket.on('error', (err: any) => {
        reject(err);
        socket = null; // Clear the socket.
        boundPort = null;
      });

      socket.on('close', () => {
        socket = null;
        boundPort = null;
      });

      socket.bind(port, (err?: Error) => {
        // The react-native-udp typings state an error can be returned
        if (err) {
          reject(err);
          socket = null;
          boundPort = null;
        }
      });
    });
  };

  const stop = async (): Promise<void> => {
    return new Promise((resolve, _reject) => {
      if (!socket) {
        resolve(); // Stopped already
        return;
      }

      socket.close(() => {
        socket = null;
        boundPort = null;
        resolve();
      });
    });
  };

  const send = async (
    data: string,
    ipAddress: string,
    port: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not starte. Call start() first.'));
        return;
      }

      socket.send(data, 0, data.length, port, ipAddress, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  const onReceive = (
    callback: (
      data: Buffer,
      senderIpAddress: string,
      senderPort: number
    ) => void
  ): void => {
    receiveCallback = callback;
  };

  const getPort = (): number | null => {
    return boundPort;
  };

  return {
    start,
    stop,
    send,
    onReceive,
    getPort,
  };
};
