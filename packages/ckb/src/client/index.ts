import { ccc } from '@ckb-ccc/core';

import { CkbNetwork } from '../utils/ccc';
import { buildRgbppLockArgs } from '../utils/rgbpp';
import { getRgbppScriptInfo } from '../constants';

export class CkbClient {
  network: CkbNetwork;
  private client: ccc.ClientPublicMainnet | ccc.ClientPublicTestnet;
  rgbppScriptInfo: ccc.ScriptInfo;

  constructor(ckbNetwork: CkbNetwork) {
    this.network = ckbNetwork;
    this.client = this.initClient(ckbNetwork);
    this.rgbppScriptInfo = getRgbppScriptInfo(ckbNetwork);
  }

  private initClient(ckbNetwork: CkbNetwork): ccc.ClientPublicMainnet | ccc.ClientPublicTestnet {
    return ckbNetwork === 'mainnet' ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
  }

  getClient() {
    return this.client;
  }

  genRgbppLockScript(btcTxId: string, btcOutIndex: number) {
    const rgbppLockArgs = buildRgbppLockArgs(btcOutIndex, btcTxId);
    return ccc.Script.from({
      codeHash: this.rgbppScriptInfo.codeHash,
      hashType: this.rgbppScriptInfo.hashType,
      args: rgbppLockArgs,
    });
  }
}
