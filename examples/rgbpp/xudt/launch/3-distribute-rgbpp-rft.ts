import { RgbppClient2 } from 'rgbpp';

import { BtcAssetsApiError } from 'rgbpp';

import { ckbNetwork } from 'rgbpp/ckb';

import { saveCkbVirtualTxResult } from '../../shared/utils';

import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import {
  BTC_TESTNET_TYPE,
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../../env';

const distributeRgbppXudtOnBtc = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  rgbppXudtUniqueId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const { btcTxId, btcOutIndex, rgbppXudtUniqueId, rgbppXudtReceivers, btcFeeRate } = parseArgs(args);

  const rgbppClient = RgbppClient2.create({
    ckbNetwork: ckbNetwork(ckbAddress),
    ckbPrivateKey: CKB_PRIVATE_KEY,
    btcNetwork: BTC_TESTNET_TYPE,
    btcAssetsApiConfig: {
      url: BTC_SERVICE_URL,
      token: BTC_SERVICE_TOKEN,
      origin: BTC_SERVICE_ORIGIN,
    },
    btcAccountConfig: {
      privateKey: BTC_PRIVATE_KEY,
      addressType: BTC_ADDRESS_TYPE,
      networkType: BTC_TESTNET_TYPE,
    },
  });

  const batchTransferVirtualTx = await rgbppClient.xudtBatchTransferCkbTx(
    rgbppXudtUniqueId,
    [{ btcTxId, btcOutIdx: btcOutIndex }],
    rgbppXudtReceivers,
  );

  saveCkbVirtualTxResult(batchTransferVirtualTx, '3-distribute-rgbpp-rft');

  const { commitment, ckbRawTx, sumInputsCapacity, rgbppChangeOutIndex, needPaymasterCell } = batchTransferVirtualTx;
  console.log('RGB++ asset change utxo out index: ', rgbppChangeOutIndex);

  const psbt = await rgbppClient.buildBtcPsbt({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: rgbppXudtReceivers.map((receiver) => receiver.toBtcAddress),
    needPaymaster: needPaymasterCell,
    feeRate: btcFeeRate,
  });
  const { txId: susBtcTxId, rawTxHex: btcTxBytes } = await rgbppClient.signAndSendBtcPsbt(psbt);

  console.log(`RGB++ xUDT batch transfer BTC tx id: ${susBtcTxId}`);

  let attempt = 0;
  const interval = setInterval(async () => {
    try {
      console.log(`Waiting for BTC tx and proof to be ready: attempt ${++attempt}`);
      const rgbppApiSpvProof = await rgbppClient.getRgbppSpvProof(susBtcTxId);
      clearInterval(interval);

      const ckbFinalTx = await rgbppClient.assembleXudtBatchTransferTx(
        ckbRawTx,
        susBtcTxId,
        btcTxBytes,
        rgbppApiSpvProof,
        sumInputsCapacity,
      );

      const txHash = await rgbppClient.sendCkbTransaction(ckbFinalTx);
      console.info(
        `RGB++ xUDT token (name: ${RGBPP_TOKEN_INFO.name}, symbol: ${RGBPP_TOKEN_INFO.symbol}, decimal: ${RGBPP_TOKEN_INFO.decimal}) has been distributed: ${txHash}`,
      );
    } catch (error) {
      if (!(error instanceof BtcAssetsApiError)) {
        console.error(error);
      }
    }
  }, 20 * 1000);
};

const parseArgs = ({
  btcTxId,
  btcOutIndexStr,
  rgbppXudtUniqueId,
  receivers,
  btcFeeRateStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  rgbppXudtUniqueId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutIndex = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX is not a number');
  }
  const rgbppXudtReceivers = receivers.split(';').map((receiver) => {
    const [btcAddress, amountStr] = receiver.split(':');
    if (!btcAddress || !amountStr) {
      throw new Error('Invalid receiver format');
    }
    let amount: bigint;
    try {
      amount = BigInt(amountStr);
    } catch (error) {
      throw new Error('RGBPP_XUDT_LAUNCH_AMOUNT is not a number');
    }
    return { toBtcAddress: btcAddress, transferAmount: BigInt(amount) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal) };
  });

  if (btcFeeRateStr) {
    try {
      const btcFeeRate = parseInt(btcFeeRateStr);
      return { btcTxId, btcOutIndex, rgbppXudtUniqueId, rgbppXudtReceivers, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcTxId, btcOutIndex, rgbppXudtUniqueId, rgbppXudtReceivers };
  }
};

distributeRgbppXudtOnBtc({
  // Warning: If rgbpp assets are distributed continuously, then the position of the current rgbpp asset utxo depends on the position of the previous change utxo distributed
  btcTxId: process.env.RGBPP_XUDT_TRANSFER_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  receivers: process.env.RGBPP_XUDT_TRANSFER_RECEIVERS!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:
RGBPP_XUDT_TRANSFER_BTC_TX_ID=<btc_tx_id> RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX=<btc_out_index> RGBPP_XUDT_TYPE_ARGS=<xudt_type_args> RGBPP_XUDT_TRANSFER_RECEIVERS=<btc_address_1:amount_1;btc_address_2:amount_2;...> [RGBPP_BTC_FEE_RATE=<fee_rate>] npx tsx xudt/launch/3-distribute-rgbpp.ts

Example:
RGBPP_XUDT_TRANSFER_BTC_TX_ID=abc123... RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX=0 RGBPP_XUDT_TYPE_ARGS=0x12fa123b8a4516ec31ea2871da29a66f4d6d8fbb9e1693f15ad416c1e89eb237 RGBPP_XUDT_TRANSFER_RECEIVERS=tb1qeq...nm85:1000;tb1qeq...nm86:2000 npx tsx xudt/launch/3-distribute-rgbpp-rft.ts 

Note:
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
*/
