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

  explorerUrl(): string | undefined {
    return this.explorerBaseUrl ? `${this.explorerBaseUrl}/transaction/${this.txHash}` : undefined;
  }

  toString(): string {
    return this.explorerUrl() ?? this.txHash;
  }
}
