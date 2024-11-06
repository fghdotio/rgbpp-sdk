/* eslint-disable */
import {
  AddressPrefix,
  addressToScript,
  getTransactionSize,
  privateKeyToAddress,
  AddressType,
} from '@nervosnetwork/ckb-sdk-utils';

import { addressToScriptCCC, privateKeyToAddressCCC } from '../utils/ccc';

const address = 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqw6vjzy9kahx3lyvlgap8dp8ewd8g80pcgcexzrj';

// ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvarm0tahu0qfkq6ktuf3wd8azaas0h24c9myfz6
const CKB_SECP256K1_PRIVATE_KEY = '0x59ddda57ba06d6e9c5fa9040bdb98b4b098c2fce6520d39f51bc5e825364697a';

async function main() {
  // 3. privateKeyToAddress
  console.log(
    addressToScript(
      privateKeyToAddress(CKB_SECP256K1_PRIVATE_KEY, {
        prefix: AddressPrefix.Testnet,
        type: AddressType.HashIdx, // default
      }),
    ),
  );
  // ! AddressType.FullVersion: ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvarm0tahu0qfkq6ktuf3wd8azaas0h24cs8598c

  console.log(await addressToScriptCCC(await privateKeyToAddressCCC(CKB_SECP256K1_PRIVATE_KEY, 'testnet')));

  // 2. AddressPrefix

  // 1. addressToScript
  const script = addressToScript(address);
  // console.log(script);
  /* const codeHashIndices = [
      SECP256K1_BLAKE160,
      SECP256K1_MULTISIG,
      address.startsWith(AddressPrefix.Mainnet) ? ANYONE_CAN_PAY_MAINNET : ANYONE_CAN_PAY_TESTNET,
    ] */

  // const script = [
  //     KnownScript.Secp256k1Blake160,
  //     KnownScript.Secp256k1Multisig,
  //     KnownScript.AnyoneCanPay,
  //   ][payload[0]];

  // const { prefix, format, payload } = cccAdv.addressPayloadFromString(address);
  // const scriptCCC = {
  //   codeHash: ccc.numToHex(payload.slice(0, 32)),
  //   hashType: ccc.hashTypeFromBytes(payload.slice(32, 33)),
  //   args: ccc.numToHex(payload.slice(33)),
  // };
  // console.log((await addressToScriptCCC(address)).script);
}

main();
