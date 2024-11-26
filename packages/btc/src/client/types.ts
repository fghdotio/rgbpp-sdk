export type BtcNetwork = 'Mainnet' | 'Testnet3' | 'Signet';

export type BtcAssetsApiConfig = {
  url: string;
  token: string;
  origin?: string;
};

export type BtcAccountConfig = {
  privateKey: string;
  addressType: string;
  networkType: string;
};

export class BtcTxHash {
  constructor(
    private readonly txHash: string,
    private readonly explorerBaseUrl: string,
  ) {}

  raw() {
    return this.txHash;
  }

  explorerUrl(): string {
    return `${this.explorerBaseUrl}/tx/${this.txHash}`;
  }

  toString(): string {
    return this.explorerUrl();
  }
}
