import { CkbNetwork, CkbClient } from '@rgbpp-sdk/ckb';

export class RgbppClient {
  private ckbClient: CkbClient;

  constructor(config: RgbppClientConfig) {
    this.ckbClient = new CkbClient(config.ckbNetwork, config.ckbPrivateKey);
  }

  getCkbClient() {
    return this.ckbClient;
  }

  getCkbSigner() {
    return this.ckbClient.getSigner();
  }
}

type RgbppClientConfig = {
  ckbNetwork: CkbNetwork;
  // btcNetwork: BTCNetwork;
  ckbPrivateKey?: string;
};
