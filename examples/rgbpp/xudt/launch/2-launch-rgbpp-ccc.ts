/* eslint-disable */
import { BtcAssetsApiError } from 'rgbpp';

import {
  buildRgbppLockArgs,
  RgbppTokenInfo,
  appendCkbTxWitnessesCCC,
  updateCkbTxWithRealBtcTxIdCCC,
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
  isMainnet,
  CKB_PRIVATE_KEY,
  ckbAddress,
} from '../../env';
import { saveCkbVirtualTxResult } from '../../shared/utils';
import { signAndSendPsbt } from '../../shared/btc-account';

// Warning: Before runing this file, please run 2-prepare-launch.ts
const launchRgppAsset = async ({
  susBtcTxId,
  susBtcOutIndexStr,
  launchAmountStr,
}: {
  susBtcTxId: string;
  susBtcOutIndexStr: string;
  launchAmountStr: string | undefined;
}) => {
  const susBtcOutIndex = parseInt(susBtcOutIndexStr);
  if (isNaN(susBtcOutIndex)) {
    throw new Error('RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX is not a number');
  }
  let launchAmount: bigint;
  if (launchAmountStr !== undefined) {
    try {
      launchAmount = BigInt(launchAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
    } catch (error) {
      throw new Error('RGBPP_XUDT_LAUNCH_AMOUNT is not a number');
    }
  } else {
    launchAmount = BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
  }
  let btcFeeRate: number | undefined;
  if (process.env.RGBPP_BTC_FEE_RATE !== undefined) {
    btcFeeRate = parseInt(process.env.RGBPP_BTC_FEE_RATE);
    if (isNaN(btcFeeRate)) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  }

  const ownerRgbppLockArgs = buildRgbppLockArgs(susBtcOutIndex, susBtcTxId);

  const ckbSigner = newCkbSignerCCC(CKB_PRIVATE_KEY, ckbNetwork(ckbAddress));
  const { commitment, partialCkbTx, needPaymasterCell } = await genPartialRgbppCkbTx({
    signer: ckbSigner,
    ownerRgbppLockArgs,
    rgbppTokenInfo: RGBPP_TOKEN_INFO,
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
    feeRate: btcFeeRate,
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
      console.log(`Execute the following command to distribute the RGB++ asset:\n`);
      console.log(
        `RGBPP_XUDT_TRANSFER_SUS_BTC_TX_ID=${btcTxId} RGBPP_XUDT_TRANSFER_SUS_BTC_OUT_INDEX=1 RGBPP_XUDT_TYPE_ARGS=${partialCkbTx.outputs[0].type?.args} RGBPP_XUDT_TRANSFER_RECEIVERS=<btc_address_1:amount_1;btc_address_2:amount_2;...> npx tsx xudt/launch/3-distribute-rgbpp.ts`,
      );
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
launchRgppAsset({
  susBtcTxId: process.env.RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID!,
  susBtcOutIndexStr: process.env.RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX!,
  // The total issuance amount of RGBPP Token, the decimal is determined by RGBPP Token info
  launchAmountStr: process.env.RGBPP_XUDT_LAUNCH_AMOUNT,
});

/* 
Usage:
RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX=<btc_out_index> [RGBPP_XUDT_LAUNCH_AMOUNT=<launch_amount>] [RGBPP_BTC_FEE_RATE=<fee_rate>] npx tsx xudt/launch/2-launch-rgbpp-ccc.ts

Example:
RGBPP_XUDT_LAUNCH_SUS_BTC_TX_ID=abc123... RGBPP_XUDT_LAUNCH_SUS_BTC_OUT_INDEX=0 npx tsx xudt/launch/2-launch-rgbpp-ccc.ts

Note:
- RGBPP_XUDT_LAUNCH_AMOUNT is optional, defaults to 2100_0000. The value should be the raw amount without decimals 
  (e.g., use 2100_0000 for 21M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
*/
