import { CkbNetwork, CkbClient } from '@rgbpp-sdk/ckb';

export class RgbppClient {
  private ckbClient: CkbClient;

  constructor(config: RgbppClientConfig) {
    this.ckbClient = new CkbClient(config.ckbNetwork);
  }

  getCkbClient() {
    return this.ckbClient;
  }
}

type RgbppClientConfig = {
  ckbNetwork: CkbNetwork;
  // btcNetwork: BTCNetwork;
};
