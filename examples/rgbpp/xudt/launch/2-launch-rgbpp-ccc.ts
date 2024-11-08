/* eslint-disable */
import { sendRgbppUtxos, BtcAssetsApiError } from 'rgbpp';

import {
  buildRgbppLockArgs,
  RgbppTokenInfo,
  appendCkbTxWitnessesCCC,
  updateCkbTxWithRealBtcTxIdCCC,
  sendCkbTx,
  genPartialRgbppCkbTx,
  newCkbSignerCCC,
  ckbNetwork,
} from 'rgbpp/ckb';

import { buildRgbppUtxos } from 'rgbpp/btc';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import {
  BTC_TESTNET_TYPE,
  btcAccount,
  btcDataSource,
  btcService,
  collector,
  isMainnet,
  CKB_PRIVATE_KEY,
  ckbAddress,
} from '../../env';
import { saveCkbVirtualTxResult } from '../../shared/utils';
import { signAndSendPsbt } from '../../shared/btc-account';

interface Params {
  ownerRgbppLockArgs: string;
  launchAmount: bigint;
  rgbppTokenInfo: RgbppTokenInfo;
}

// Warning: Before runing this file, please run 2-prepare-launch.ts
const launchRgppAsset = async ({ ownerRgbppLockArgs, launchAmount, rgbppTokenInfo }: Params) => {
  const ckbSigner = newCkbSignerCCC(CKB_PRIVATE_KEY, ckbNetwork(ckbAddress));
  const { commitment, partialCkbTx, needPaymasterCell } = await genPartialRgbppCkbTx({
    signer: ckbSigner,
    ownerRgbppLockArgs,
    rgbppTokenInfo,
    launchAmount,
    isMainnet,
    btcTestnetType: BTC_TESTNET_TYPE,
  });

  console.log('RGB++ Asset type script args: ', partialCkbTx.outputs[0].type?.args);

  const rgbppPsbt = await buildRgbppUtxos({
    partialCkbTx,
    commitment,
    tos: [btcAccount.from],
    needPaymaster: needPaymasterCell,
    ckbSigner,
    from: btcAccount.from,
    fromPubkey: btcAccount.fromPubkey,
    source: btcDataSource,
    feeRate: 525,
  });

  const { txId: btcTxId, rawTxHex: btcTxBytes } = await signAndSendPsbt(rgbppPsbt, btcAccount, btcService);
  console.log(`BTC ${BTC_TESTNET_TYPE} TxId: ${btcTxId}`);

  const interval = setInterval(async () => {
    try {
      console.log('Waiting for BTC tx and proof to be ready');
      const rgbppApiSpvProof = await btcService.getRgbppSpvProof(btcTxId, 0);
      clearInterval(interval);
      // Update CKB transaction with the real BTC txId
      const updateCkbTx = updateCkbTxWithRealBtcTxIdCCC({ ckbPartialTx: partialCkbTx, btcTxId, isMainnet });
      const ckbTx = await appendCkbTxWitnessesCCC({
        ckbTx: updateCkbTx,
        btcTxBytes,
        rgbppApiSpvProof,
      });

      await ckbTx.completeFeeBy(ckbSigner);
      const txHash = await ckbSigner.sendTransaction(ckbTx);
      await ckbSigner.client.waitTransaction(txHash, 0, 60000);

      console.info(`RGB++ Asset has been launched and CKB tx hash is ${txHash}`);
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 30 * 1000);
};

// Please use your real BTC UTXO information on the BTC Testnet which should be same as the 1-prepare-launch.ts
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet

// rgbppLockArgs: outIndexU32 + btcTxId
launchRgppAsset({
  ownerRgbppLockArgs: buildRgbppLockArgs(2, '27be61caf5424dbcd8756556fc0376bed55575042168149908ab68a0de28a932'),
  rgbppTokenInfo: RGBPP_TOKEN_INFO,
  // The total issuance amount of RGBPP Token, the decimal is determined by RGBPP Token info
  launchAmount: BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal),
});

/* 
npx tsx xudt/launch/2-launch-rgbpp-ccc.ts
*/

/*
rgbppAssetOwnerLock {
  codeHash: '0x61ca7a4796a4eb19ca4f0d065cb9b10ddcf002f10f7cbb810c706cb6bb5c3248',
  hashType: 'type',
  args: '0x0200000032a928dea068ab0899146821047555d5be7603fc566575d8bc4d42f5ca61be27'
}

1 cells found
 [
  Cell {
    outPoint: OutPoint {
      txHash: '0x0518822b8300098df87cbbc596ab29738c4a450c7dd3f6cd610a6220f193db5f',
      index: 0n
    },
    cellOutput: CellOutput {
      capacity: 47400000000n,
      lock: [Script],
      type: undefined
    },
    outputData: '0x'
  }
]
gatheredCapacity: 47400000000, input count: 1
RGB++ Asset type script args:  0xdf31616c6d8e386d882ecd360c74c3d19d3ae83b9e6a8958cd5f909b77b08532
BTC Testnet3 TxId: 5b2fe20cc0ed651f94eef306def3695f78d28bc17c8112a3cf69736c9c765e55
RGB++ Asset has been launched and CKB tx hash is 0x3f26c3ef58163452873b730d48817f1b90f8d515c9562c1f4274a6ca7a9f22eb
*/
