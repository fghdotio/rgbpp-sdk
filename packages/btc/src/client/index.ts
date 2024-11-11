export type BtcNetwork = 'Mainnet' | 'Testnet3' | 'Signet';

export class BtcClient {
  private network: BtcNetwork;

  constructor(network: BtcNetwork) {
    this.network = network;
  }

  getNetwork() {
    return this.network;
  }

  isOnMainnet() {
    return this.network === 'Mainnet';
  }
}
