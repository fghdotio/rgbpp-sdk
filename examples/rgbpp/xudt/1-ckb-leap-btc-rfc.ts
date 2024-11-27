import { RgbppClient2 } from 'rgbpp';
import { ckbNetwork } from 'rgbpp/ckb';

import { RGBPP_TOKEN_INFO } from './launch/0-rgbpp-token-info';

import {
  BTC_TESTNET_TYPE,
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
  BTC_PRIVATE_KEY,
  BTC_ADDRESS_TYPE,
} from '../env';

const leapXudtFromCkbToBtc = async (args: {
  btcTxId: string;
  btcOutIndexStr: string;
  rgbppXudtUniqueId: string;
  leapAmountStr: string;
}) => {
  const { btcTxId, btcOutIndex, rgbppXudtUniqueId, leapAmount } = parseArgs(args);

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

  const ckbRawTx = await rgbppClient.xudtLeapFromCkbToBtcCkbTx(rgbppXudtUniqueId, leapAmount, btcTxId, btcOutIndex);

  const ckbFinalTx = await rgbppClient.assembleXudtLeapFromCkbToBtcCkbTx(ckbRawTx);

  const txHash = await rgbppClient.sendCkbTransaction(ckbFinalTx);
  console.log(
    `RGB++ xUDT token (name: ${RGBPP_TOKEN_INFO.name}, symbol: ${RGBPP_TOKEN_INFO.symbol}, decimal: ${RGBPP_TOKEN_INFO.decimal}) has been leaped from CKB to BTC: ${txHash}`,
  );
};

const parseArgs = ({
  btcTxId,
  btcOutIndexStr,
  rgbppXudtUniqueId,
  leapAmountStr,
}: {
  btcTxId: string;
  btcOutIndexStr: string;
  rgbppXudtUniqueId: string;
  leapAmountStr: string;
}) => {
  const btcOutIndex = parseInt(btcOutIndexStr);
  if (isNaN(btcOutIndex)) {
    throw new Error('RGBPP_XUDT_ISSUANCE_BTC_OUT_INDEX is not a number');
  }
  try {
    const leapAmount = BigInt(leapAmountStr) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal);
    return { btcTxId, btcOutIndex, rgbppXudtUniqueId, leapAmount };
  } catch (error) {
    throw new Error('RGBPP_XUDT_CKB_TO_BTC_LEAP_AMOUNT is not a number');
  }
};

leapXudtFromCkbToBtc({
  btcTxId: process.env.RGBPP_XUDT_TRANSFER_BTC_TX_ID!,
  btcOutIndexStr: process.env.RGBPP_XUDT_TRANSFER_BTC_OUT_INDEX!,
  rgbppXudtUniqueId: process.env.RGBPP_XUDT_UNIQUE_ID!,
  leapAmountStr: process.env.RGBPP_XUDT_CKB_TO_BTC_LEAP_AMOUNT!,
});
