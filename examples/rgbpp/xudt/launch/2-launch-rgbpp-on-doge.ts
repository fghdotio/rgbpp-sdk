import { genRgbppLaunchCkbVirtualTx, sendRgbppDogeUtxos } from 'rgbpp';
import { buildRgbppLockArgs, RgbppTokenInfo } from 'rgbpp/ckb';
import { RGBPP_TOKEN_INFO } from './0-rgbpp-token-info';
import { BTC_TESTNET_TYPE, btcAccount, dogeDataSource, assetsApi, collector, isMainnet } from '../../env';
import { saveCkbVirtualTxResult } from '../../shared/utils';
import { signAndSendPsbt } from '../../shared/btc-account';

interface Params {
  ownerRgbppLockArgs: string;
  launchAmount: bigint;
  rgbppTokenInfo: RgbppTokenInfo;
}

// Warning: Before runing this file, please run 2-prepare-launch.ts
const launchRgppAsset = async ({ ownerRgbppLockArgs, launchAmount, rgbppTokenInfo }: Params) => {
  const ckbVirtualTxResult = await genRgbppLaunchCkbVirtualTx({
    collector,
    ownerRgbppLockArgs,
    rgbppTokenInfo,
    launchAmount,
    isMainnet,
    btcTestnetType: BTC_TESTNET_TYPE,
  });

  // Save ckbVirtualTxResult
  saveCkbVirtualTxResult(ckbVirtualTxResult, '2-launch-rgbpp');

  const { commitment, ckbRawTx, needPaymasterCell } = ckbVirtualTxResult;

  console.log('RGB++ Asset type script args: ', ckbRawTx.outputs[0].type?.args);

  // Send BTC tx
  const psbt = await sendRgbppDogeUtxos({
    ckbVirtualTx: ckbRawTx,
    commitment,
    tos: [btcAccount.from],
    needPaymaster: needPaymasterCell,
    ckbCollector: collector,
    from: btcAccount.from,
    fromPubkey: btcAccount.fromPubkey,
    source: dogeDataSource,
  });

  const { txId: btcTxId } = await signAndSendPsbt(psbt, btcAccount, assetsApi);
  console.log(`Doge TxId: ${btcTxId}`);
};

// Please use your real BTC UTXO information on the BTC Testnet which should be same as the 1-prepare-launch.ts
// BTC Testnet3: https://mempool.space/testnet
// BTC Signet: https://mempool.space/signet

// rgbppLockArgs: outIndexU32 + btcTxId
launchRgppAsset({
  ownerRgbppLockArgs: buildRgbppLockArgs(1, '5802d2395172f80a18e8637f8c4c91ff213bc60fab0aeeef839f1ea3b95b0177'),
  rgbppTokenInfo: RGBPP_TOKEN_INFO,
  // The total issuance amount of RGBPP Token, the decimal is determined by RGBPP Token info
  launchAmount: BigInt(2100_0000) * BigInt(10 ** RGBPP_TOKEN_INFO.decimal),
});
