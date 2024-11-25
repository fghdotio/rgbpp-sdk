import { CkbNetwork } from '@rgbpp-sdk/ckb';

import { BtcNetwork, BtcAssetsApiConfig, BtcAccountConfig } from '@rgbpp-sdk/btc';

export type RgbppClientConfig = {
  ckbNetwork: CkbNetwork;
  ckbPrivateKey: string;

  ckbJsonRpcUrl?: string;

  btcNetwork: BtcNetwork;
  btcAssetsApiConfig: BtcAssetsApiConfig;
  btcAccountConfig: BtcAccountConfig;
};
