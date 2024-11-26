import { RgbppLaunchVirtualTxResult } from '../types/rgbpp';

export type CkbWaitTransactionConfig = {
  confirmations?: number;
  timeout?: number;
  interval?: number;
};

export class CkbTxHash {
  constructor(
    private readonly txHash: string,
    private readonly explorerBaseUrl: string,
  ) {}

  raw() {
    return this.txHash;
  }

  explorerUrl(): string {
    return `${this.explorerBaseUrl}/transaction/${this.txHash}`;
  }

  toString(): string {
    return this.explorerUrl();
  }
}

export type RgbppXudtIssuanceResult = {
  rgbppLaunchVirtualTxResult: RgbppLaunchVirtualTxResult;
  rgbppXudtUniqueId: string;
};
