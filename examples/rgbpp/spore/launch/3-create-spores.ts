import { BtcAssetsApiError, genCreateSporeCkbVirtualTx, sendRgbppUtxos } from 'rgbpp';
import {
  isMainnet,
  collector,
  btcDataSource,
  btcService,
  CKB_PRIVATE_KEY,
  ckbAddress,
  btcAccount,
  BTC_TESTNET_TYPE,
} from '../../env';
import {
  Hex,
  appendCkbTxWitnesses,
  appendIssuerCellToSporesCreate,
  buildRgbppLockArgs,
  generateSporeCreateCoBuild,
  sendCkbTx,
  updateCkbTxWithRealBtcTxId,
  RawSporeData,
  remove0x,
  SporeCreateVirtualTxResult,
} from 'rgbpp/ckb';
import { saveCkbVirtualTxResult } from '../../shared/utils';
import { signAndSendPsbt } from '../../shared/btc-account';
import { serializeRawTransaction } from '@nervosnetwork/ckb-sdk-utils';

import { ccc } from '@ckb-ccc/shell';
import { generateSimpleDNA } from '../../shared/dob';

const RECOMMENDED_MAX_CKB_TX_SIZE = 60 * 1024;

interface SporeCreateParams {
  clusterRgbppLockArgs: Hex;
  receivers: {
    toBtcAddress: string;
    sporeData: RawSporeData;
  }[];
}

const estimateCkbTxSize = (ckbVirtualTxResult: SporeCreateVirtualTxResult) => {
  const { ckbRawTx, clusterCell } = ckbVirtualTxResult;
  const rawTxSize = remove0x(serializeRawTransaction(ckbRawTx)).length / 2;

  const coBuild = generateSporeCreateCoBuild({
    // The first output is cluster cell and the rest of the outputs are spore cells
    sporeOutputs: ckbRawTx.outputs.slice(1),
    sporeOutputsData: ckbRawTx.outputsData.slice(1),
    clusterCell,
    clusterOutputCell: ckbRawTx.outputs[0],
  });
  const coBuildSize = remove0x(coBuild).length / 2;
  return rawTxSize + coBuildSize;
};

// Warning: Before running this file for the first time, please run 2-prepare-cluster.ts
const createSpores = async ({ clusterRgbppLockArgs, receivers }: SporeCreateParams) => {
  const ckbVirtualTxResult = await genCreateSporeCkbVirtualTx({
    collector,
    sporeDataList: receivers.map((receiver) => receiver.sporeData),
    clusterRgbppLockArgs,
    isMainnet,
    btcTestnetType: BTC_TESTNET_TYPE,
  });

  const ckbTxSize = estimateCkbTxSize(ckbVirtualTxResult);
  if (ckbTxSize > RECOMMENDED_MAX_CKB_TX_SIZE) {
    throw new Error(
      `The estimated size(${ckbTxSize} bytes) of the CKB transaction is too large, which may cause the transaction to fail to be properly submitted to the blockchain. It is strongly recommended to reduce the number of Spore receivers to reduce the size of the CKB transaction to below 60K bytes.`,
    );
  }

  // Save ckbVirtualTxResult
  saveCkbVirtualTxResult(ckbVirtualTxResult, '3-create-spores');

  const { commitment, ckbRawTx, sumInputsCapacity, clusterCell, needPaymasterCell } = ckbVirtualTxResult;

  // Send BTC tx
  // The first btc address is the owner of the cluster cell and the rest btc addresses are spore receivers
  const btcTos = [btcAccount.from, ...receivers.map((receiver) => receiver.toBtcAddress)];
  const psbt = await sendRgbppUtxos({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: btcTos,
    needPaymaster: needPaymasterCell,
    ckbCollector: collector,
    from: btcAccount.from,
    fromPubkey: btcAccount.fromPubkey,
    source: btcDataSource,
    feeRate: 28,
  });

  const { txId: btcTxId, rawTxHex: btcTxBytes } = await signAndSendPsbt(psbt, btcAccount, btcService);
  console.log('BTC TxId: ', btcTxId);

  const interval = setInterval(async () => {
    try {
      console.log('Waiting for BTC tx and proof to be ready');
      const rgbppApiSpvProof = await btcService.getRgbppSpvProof(btcTxId, 0);
      clearInterval(interval);
      // Update CKB transaction with the real BTC txId
      const newCkbRawTx = updateCkbTxWithRealBtcTxId({ ckbRawTx, btcTxId, isMainnet });
      console.log('The new cluster rgbpp lock args: ', newCkbRawTx.outputs[0].lock.args);
      console.log('The new cluster rgbpp lock args -- btc tx id: ', btcTxId);
      console.log('The new cluster rgbpp lock args -- btc tx out index: 1');

      const ckbTx = await appendCkbTxWitnesses({
        ckbRawTx: newCkbRawTx,
        btcTxBytes,
        rgbppApiSpvProof,
      });

      // The outputs[1..] are spore cells from which you can find spore type scripts,
      // and the spore type scripts will be used to transfer and leap spores
      console.log('Spore type scripts: ', JSON.stringify(ckbTx.outputs.slice(1).map((output) => output.type)));

      // Replace cobuild witness with the final rgbpp lock script
      ckbTx.witnesses[ckbTx.witnesses.length - 1] = generateSporeCreateCoBuild({
        // The first output is cluster cell and the rest of the outputs are spore cells
        sporeOutputs: ckbTx.outputs.slice(1),
        sporeOutputsData: ckbTx.outputsData.slice(1),
        clusterCell,
        clusterOutputCell: ckbTx.outputs[0],
      });

      // console.log('ckbTx: ', JSON.stringify(ckbTx));

      const signedTx = await appendIssuerCellToSporesCreate({
        secp256k1PrivateKey: CKB_PRIVATE_KEY,
        issuerAddress: ckbAddress,
        ckbRawTx: ckbTx,
        collector,
        sumInputsCapacity,
        isMainnet,
      });

      const txHash = await sendCkbTx({ collector, signedTx });
      console.info(`RGB++ Spore has been created and tx hash is ${txHash}`);
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 30 * 1000);
};

// Please use your real BTC UTXO information on the BTC Testnet
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet

const clusterId = '0xd808bf6aad33b51ceb00bb5f64f0f08ca5eab79e1b458d2b7e7f6af7e0daf0bf';

// rgbppLockArgs: outIndexU32 + btcTxId
createSpores({
  // The cluster cell will be spent and the new cluster cell will be created in each spore creation tx,
  // so the cluster rgbpp lock args should be updated after each spore creation tx is completed.
  // The first cluster rgbpp lock args is from 2-create-cluster.ts and the new cluster rgbpp lock args can be found from the log in the line 71 of this file
  clusterRgbppLockArgs: buildRgbppLockArgs(1, 'b6fda2bb1f8c3895ea0e340c772932e7019579ba18d6fe05d77157b638622044'),
  receivers: Array(70)
    .fill(null)
    .map(() => ({
      toBtcAddress: 'tb1qx00uz6cgxvxgr3k7gs93enh6j8vrljqwu7nv2f',
      sporeData: {
        contentType: 'dob/0',
        content: ccc.bytesFrom(`{ "dna": "${generateSimpleDNA(16)}" }`, 'utf8'),
        clusterId,
      },
    })),
});

/* 
create spore (3rd batch):
- [BTC tx](https://mempool.space/testnet/tx/032e1f31f66b07e4aedcabd26968e5bddb5bdc4a2846cac19415534fcbff16b8)
- [CKB tx](https://testnet.explorer.nervos.org/transaction/0x3cabd1a94c1b73147e27fa7dafe7e5cd7ab7e486a1db64fee5e84a9d1285b30a)
*/
