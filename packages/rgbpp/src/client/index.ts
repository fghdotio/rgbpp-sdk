import {
  CkbNetwork,
  CkbClient,
  RgbppTokenInfo,
  calculateRgbppTokenInfoCellCapacity,
  MAGIC_NUMBER_LAUNCH_RGBPP_BTC_OUT_INDEX,
  u128ToLe,
  genBtcTimeLockScript,
  UNLOCKABLE_LOCK_SCRIPT,
  BTCTestnetType,
  getUniqueTypeScript,
  generateUniqueTypeArgs,
  encodeRgbppTokenInfo,
  fetchTypeIdCellDeps,
  RGBPP_WITNESS_PLACEHOLDER,
  calculateCommitment,
  CkbWaitTransactionConfig,
} from '@rgbpp-sdk/ckb';
import { BtcClient, BtcNetwork, BtcAssetsApiConfig, BtcAccountConfig, bitcoin } from '@rgbpp-sdk/btc';

import { ccc } from '@ckb-ccc/core';

export class RgbppClient {
  private ckbClient: CkbClient;
  private btcClient: BtcClient;

  constructor(config: RgbppClientConfig) {
    this.ckbClient = new CkbClient(config.ckbNetwork, config.ckbPrivateKey);
    this.btcClient = new BtcClient(config.btcNetwork, config.btcAssetsApiConfig, config.btcAccountConfig);
  }

  static newCkbTransaction(tx: ccc.TransactionLike = {}) {
    return CkbClient.newTransaction(tx);
  }

  static calculateCommitment() {
    return CkbClient.calculateCommitment();
  }

  getCkbClient() {
    return this.ckbClient;
  }

  getCkbSigner() {
    return this.ckbClient.getSigner();
  }

  getBtcClient() {
    return this.btcClient;
  }

  async getRgbppSpvProof(btcTxId: string, confirmations: number) {
    return await this.btcClient.getRgbppSpvProof(btcTxId, confirmations);
  }

  async sendCkbTransaction(tx: ccc.TransactionLike, config?: CkbWaitTransactionConfig) {
    return this.ckbClient.sendTransaction(tx, config);
  }

  async sendBtcTransaction(psbt: bitcoin.Psbt) {
    return this.btcClient.sendTransaction(psbt);
  }

  async generateBtcPsbt() {
    return this.btcClient.generatePbst();
  }

  async buildXudtIssuanceTx(
    tokenInfo: RgbppTokenInfo,
    launchAmount: bigint,
    susBtcTxId: string,
    susBtcOutIndex: number,
  ) {
    const assetOwnerLockScript = this.ckbClient.generateRgbppLockScript(susBtcOutIndex, susBtcTxId);
    console.log('assetOwnerLockScript', assetOwnerLockScript);

    const rgbppLaunchCells: ccc.Cell[] = [];
    // * TODO FIXME: there is a default limit of 10,
    for await (const cell of this.ckbClient.getRpcClient().findCells({
      script: assetOwnerLockScript,
      scriptType: 'lock',
      scriptSearchMode: 'exact',
      filter: {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
    })) {
      rgbppLaunchCells.push(cell);
    }

    if (rgbppLaunchCells.length === 0) {
      throw new Error('The owner address has no certain live cells available');
    }
    console.log(`${rgbppLaunchCells.length} cells found\n`, rgbppLaunchCells);
    const inputs = rgbppLaunchCells.map(({ outPoint, cellOutput, outputData }) => ({
      previousOutput: outPoint,
      cellOutput,
      outputData: outputData,
    }));

    const tx = ccc.Transaction.from({ inputs });
    const inputCapacity = tx.inputs.reduce((sum, input) => sum + input.cellOutput!.capacity, BigInt(0));
    console.log(`gatheredCapacity: ${inputCapacity}, input count: ${tx.inputs.length}`);

    const infoCellCapacity = this.calculateRgbppTokenInfoCellCapacity(tokenInfo);
    tx.addOutput({
      lock: this.ckbClient.generateRgbppLockScript(MAGIC_NUMBER_LAUNCH_RGBPP_BTC_OUT_INDEX),
      type: {
        ...this.ckbClient.getScriptInfo('XUDTType'),
        args: assetOwnerLockScript.hash(),
      },
      capacity: BigInt(inputCapacity) - infoCellCapacity,
    });
    tx.setOutputDataAt(0, `0x${u128ToLe(launchAmount)}`);

    tx.addOutput({
      lock: genBtcTimeLockScript(
        UNLOCKABLE_LOCK_SCRIPT,
        this.btcClient.isOnMainnet(),
        this.btcClient.getNetwork() as BTCTestnetType,
      ),
      type: {
        ...getUniqueTypeScript(this.btcClient.isOnMainnet()),
        // ! TODO: TMP WORKAROUND, FIXME
        // * hardcoded: use inputs[0] to generate TypeID args
        args: generateUniqueTypeArgs(
          {
            previousOutput: {
              txHash: tx.inputs[0].previousOutput.txHash,
              index: `0x${tx.inputs[0].previousOutput.index.toString(16)}`,
            },
            since: `0x${tx.inputs[0].since.toString(16)}`,
          },
          1,
        ),
      },
      capacity: infoCellCapacity,
    });
    tx.setOutputDataAt(1, encodeRgbppTokenInfo(tokenInfo));

    tx.addCellDeps(
      (
        await fetchTypeIdCellDeps(
          this.btcClient.isOnMainnet(),
          { rgbpp: true, xudt: true, unique: true },
          this.btcClient.getNetwork() as BTCTestnetType,
        )
      ).map((dep) => {
        if (dep.outPoint === null || dep.outPoint === undefined) {
          throw new Error('dep.outPoint is required');
        }
        return {
          outPoint: dep.outPoint,
          depType: dep.depType,
        };
      }),
    );

    tx.witnesses = Array(tx.inputs.length).fill('0x');
    tx.witnesses[0] = RGBPP_WITNESS_PLACEHOLDER;

    // * supply fee after real witnesses are set
    // await tx.completeFeeBy(signer, ckbFeeRate);

    // ! TODO: TMP WORKAROUND
    const commitment = calculateCommitment({
      inputs: tx.inputs.map((input) => ({
        ...input,
        previousOutput: {
          ...input.previousOutput,
          index: `0x${input.previousOutput.index.toString(16)}`,
        },
        since: `0x${input.since.toString(16)}`,
      })),
      outputs: tx.outputs.map((output) => ({
        ...output,
        capacity: `0x${output.capacity.toString(16)}`,
      })),
      outputsData: tx.outputsData,
    });

    return {
      partialCkbTx: tx,
      commitment,
    };
  }

  calculateRgbppTokenInfoCellCapacity(tokenInfo: RgbppTokenInfo): bigint {
    return calculateRgbppTokenInfoCellCapacity(tokenInfo, this.ckbClient.isOnMainnet());
  }
}

export type RgbppClientConfig = {
  ckbNetwork: CkbNetwork;
  ckbPrivateKey: string;
  btcNetwork: BtcNetwork;
  btcAssetsApiConfig: BtcAssetsApiConfig;
  btcAccountConfig: BtcAccountConfig;
};
