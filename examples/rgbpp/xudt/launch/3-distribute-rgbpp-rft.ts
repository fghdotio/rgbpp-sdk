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
  btcOutpoints: string;
  rgbppXudtUniqueId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const { btcOutpointList, rgbppXudtUniqueId, rgbppXudtReceivers, btcFeeRate } = parseArgs(args);

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
    btcOutpointList,
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

      const ckbFinalTx = await rgbppClient.assembleXudtBatchTransferCkbTx(
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
  btcOutpoints,
  rgbppXudtUniqueId,
  receivers,
  btcFeeRateStr,
}: {
  btcOutpoints: string;
  rgbppXudtUniqueId: string;
  receivers: string;
  btcFeeRateStr?: string;
}) => {
  const btcOutpointList = btcOutpoints.split(';').map((outpoint) => {
    const [btcTxId, btcOutIndexStr] = outpoint.split(':');
    if (!btcTxId || !btcOutIndexStr) {
      throw new Error('Invalid btc outpoint format');
    }
    try {
      const btcOutIndex = parseInt(btcOutIndexStr);
      return { btcTxId, btcOutIdx: btcOutIndex };
    } catch (error) {
      throw new Error('index in BTC outpoint is not a number');
    }
  });
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
      return { btcOutpointList, rgbppXudtUniqueId, rgbppXudtReceivers, btcFeeRate };
    } catch (error) {
      throw new Error('RGBPP_BTC_FEE_RATE is not a number');
    }
  } else {
    return { btcOutpointList, rgbppXudtUniqueId, rgbppXudtReceivers };
  }
};

distributeRgbppXudtOnBtc({
  // Warning: If rgbpp assets are distributed continuously, then the position of the current rgbpp asset utxo depends on the position of the previous change utxo distributed
  btcOutpoints: process.env.RGBPP_XUDT_BTC_OUT_POINTS!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  receivers: process.env.RGBPP_XUDT_TRANSFER_RECEIVERS!,
  btcFeeRateStr: process.env.RGBPP_BTC_FEE_RATE,
});

/* 
Usage:
RGBPP_XUDT_BTC_OUT_POINTS=<btc_tx_id_1:btc_out_index_1;btc_tx_id_2:btc_out_index_2;...> RGBPP_XUDT_UNIQUE_ID=<xudt_type_args> RGBPP_XUDT_TRANSFER_RECEIVERS=<btc_address_1:amount_1;btc_address_2:amount_2;...> [RGBPP_BTC_FEE_RATE=<fee_rate>] npx tsx xudt/launch/3-distribute-rgbpp-rft.ts

Note:
- RGBPP_BTC_FEE_RATE is optional, uses default network fee rate if not specified
- Transfer amount should be the raw amount without decimals (e.g., use 100_0000 for 1M tokens, the decimal places will be automatically applied based on RGBPP_TOKEN_INFO.decimal)
*/
