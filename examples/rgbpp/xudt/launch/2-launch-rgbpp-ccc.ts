/* eslint-disable */
import { sendRgbppUtxos, BtcAssetsApiError } from 'rgbpp';

import {
  buildRgbppLockArgs,
  RgbppTokenInfo,
  appendCkbTxWitnesses,
  updateCkbTxWithRealBtcTxId,
  sendCkbTx,
  genPartialRgbppCkbTx,
  newCkbSignerCCC,
  ckbNetwork,
} from 'rgbpp/ckb';
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
};

// Please use your real BTC UTXO information on the BTC Testnet which should be same as the 1-prepare-launch.ts
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet

// rgbppLockArgs: outIndexU32 + btcTxId
launchRgppAsset({
  ownerRgbppLockArgs: buildRgbppLockArgs(3, '51a00dcaae4b759e64beede3f51d59e82eb94126350667f3e68b788ab27e9b88'),
  rgbppTokenInfo: RGBPP_TOKEN_INFO,
  // The total issuance amount of RGBPP Token, the decimal is determined by RGBPP Token info
  launchAmount: BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal),
})
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/* 
npx tsx xudt/launch/2-launch-rgbpp-ccc.ts
*/
