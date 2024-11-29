import { BtcClient2 } from 'rgbpp/btc';
import { ckbNetwork, CkbClient2 } from 'rgbpp/ckb';

import {
  CKB_PRIVATE_KEY,
  ckbAddress,
  BTC_TESTNET_TYPE,
  BTC_SERVICE_URL,
  BTC_SERVICE_TOKEN,
  BTC_SERVICE_ORIGIN,
} from '../env';

const unlockBtcTimeLock = async ({ btcTimeLockScriptArgs }: { btcTimeLockScriptArgs: string }) => {
  const ckbClient = CkbClient2.create(ckbNetwork(ckbAddress), CKB_PRIVATE_KEY);

  const ckbFinalTx = await ckbClient.assembleXudtBtcTimeLockUnlockTx(
    await ckbClient.xudtBtcTimeLockUnlockTx(
      btcTimeLockScriptArgs,
      BtcClient2.createAssetsApiService({ url: BTC_SERVICE_URL, token: BTC_SERVICE_TOKEN, origin: BTC_SERVICE_ORIGIN }),
      BTC_TESTNET_TYPE,
    ),
  );

  const txHash = await ckbClient.sendTransaction(ckbFinalTx);
  console.log(`BTC time lock script cell has been unlocked: ${txHash}`);
};

unlockBtcTimeLock({
  btcTimeLockScriptArgs: process.env.RGBPP_BTC_TIME_LOCK_SCRIPT_ARGS!,
});

/* 
Usage:

RGBPP_BTC_TIME_LOCK_SCRIPT_ARGS=<btc_time_lock_script_args> npx tsx xudt/4-unlock-btc-time-cell-rfc.ts

Note:
- RGBPP_BTC_TIME_LOCK_SCRIPT_ARGS is `outputs[0].lock.args` from the CKB transaction of 3-btc-leap-ckb-rfc.ts
*/
