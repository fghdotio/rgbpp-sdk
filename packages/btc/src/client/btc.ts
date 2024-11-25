import { IBtcClient } from './interfaces';
import { BtcNetwork } from './types';

import { BTCTestnetType } from '@rgbpp-sdk/ckb';

export class BtcClient2 implements IBtcClient {
  constructor(private network: BtcNetwork) {}

  static create(network: BtcNetwork): BtcClient2 {
    return new BtcClient2(network);
  }

  getTestnetType(): BTCTestnetType | undefined {
    const networkMap: Record<BtcNetwork, BTCTestnetType | undefined> = {
      Testnet3: 'Testnet3',
      Signet: 'Signet',
      Mainnet: undefined,
    };
    return networkMap[this.network];
  }
}
