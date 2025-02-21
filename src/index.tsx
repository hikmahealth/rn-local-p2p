import RnLocalP2p from './NativeRnLocalP2p';

export * from './RequestResponse';
export * from './Encryption';
export * from './QRCodePairing';
export * from './PeerNetwork';
export * from './Router';

export * from './hooks/useP2PCommunication';

export function multiply(a: number, b: number): number {
  return RnLocalP2p.multiply(a, b);
}
