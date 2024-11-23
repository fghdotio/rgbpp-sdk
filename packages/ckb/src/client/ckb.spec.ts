import { describe, it, expect } from 'vitest';

import { createCkbClient } from '.';

import { scriptToHash } from '@nervosnetwork/ckb-sdk-utils';
import { genRgbppLockScript, buildRgbppLockArgs, buildPreLockArgs } from '../utils';
import { BTCTestnetType } from '../types';

describe('ckb', () => {
  const verifyRgbppLockScript = (
    client: ReturnType<typeof createCkbClient>,
    btcOutIndex: number,
    btcTxId?: string,
    btcNetworkType?: BTCTestnetType,
  ) => {
    const rgbppLockScript = client.generateRgbppLockScript(btcOutIndex, btcTxId, btcNetworkType);
    expect(rgbppLockScript.hash()).toBe(
      scriptToHash(
        genRgbppLockScript(
          btcTxId ? buildRgbppLockArgs(btcOutIndex, btcTxId) : buildPreLockArgs(btcOutIndex),
          client.isOnMainnet(),
          btcNetworkType,
        ),
      ),
    );
  };

  describe('generateRgbppLockScript', () => {
    const TEST_PRIVATE_KEY = '934346483b232488e1783495426246434245464738393a3b3c3d3e3f40414243';
    const TEST_BTC_TX_ID = '326e306e9cdad2ed464b52bac6943a11ce3d3bc82535359a30f03b0a75904f67';
    const BTC_OUT_INDEX = 1;

    describe('testnet', () => {
      const clientTestnet = createCkbClient('testnet', TEST_PRIVATE_KEY);

      it('should generate correct lock script for BTC Testnet3', () => {
        verifyRgbppLockScript(clientTestnet, BTC_OUT_INDEX, TEST_BTC_TX_ID, 'Testnet3');
      });

      it('should generate correct lock script for BTC Testnet3 without btc tx id', () => {
        verifyRgbppLockScript(clientTestnet, BTC_OUT_INDEX, undefined, 'Testnet3');
      });

      it('should generate correct lock script for BTC Signet', () => {
        verifyRgbppLockScript(clientTestnet, BTC_OUT_INDEX, TEST_BTC_TX_ID, 'Signet');
      });

      it('should generate correct lock script for BTC Signet without btc tx id', () => {
        verifyRgbppLockScript(clientTestnet, BTC_OUT_INDEX, undefined, 'Signet');
      });
    });

    describe('mainnet', () => {
      const clientMainnet = createCkbClient('mainnet', TEST_PRIVATE_KEY);

      it('should generate correct lock script for BTC Mainnet', () => {
        verifyRgbppLockScript(clientMainnet, BTC_OUT_INDEX, TEST_BTC_TX_ID);
      });

      it('should generate correct lock script for BTC Mainnet without btc tx id', () => {
        verifyRgbppLockScript(clientMainnet, BTC_OUT_INDEX, undefined);
      });
    });
  });
});
