import { ccc } from '@ckb-ccc/core';
import { cccA as cccAdv } from '@ckb-ccc/core/advanced';

/** Network type for CKB blockchain - either mainnet or testnet */
type CkbNetwork = 'mainnet' | 'testnet';

const cccClients = {
  mainnet: new ccc.ClientPublicMainnet(),
  testnet: new ccc.ClientPublicTestnet(),
};

export const getClientsCCC = () => {
  return cccClients;
};

export const updateMainnetClientCCC = (config: {
  url: string;
  timeout?: number;
  scripts?: typeof cccAdv.MAINNET_SCRIPTS;
  cache?: ccc.ClientCache;
}) => {
  cccClients.mainnet = new ccc.ClientPublicMainnet(config);
};

export const updateTestnetClientCCC = (config: {
  url: string;
  timeout?: number;
  scripts?: typeof cccAdv.TESTNET_SCRIPTS;
  cache?: ccc.ClientCache;
}) => {
  cccClients.testnet = new ccc.ClientPublicTestnet(config);
};

// * suggestion: Constant-ize address prefixes
const selectClientCCC = (network: CkbNetwork) => {
  switch (network) {
    case 'mainnet':
      return cccClients.mainnet;
    case 'testnet':
      return cccClients.testnet;
    default:
      throw new Error('Invalid address');
  }
};
export const ckbNetwork = (address: string): CkbNetwork => {
  if (address.startsWith('ckb')) {
    return 'mainnet';
  } else if (address.startsWith('ckt')) {
    return 'testnet';
  } else {
    throw new Error('Invalid address');
  }
};

export const addressToScriptCCC = async (address: string): Promise<ccc.Script> => {
  return (await ccc.Address.fromString(address, selectClientCCC(ckbNetwork(address)))).script;
};

export const privateKeyToAddressCCC = async (privateKey: string, network: CkbNetwork) => {
  const priv = new ccc.SignerCkbPrivateKey(selectClientCCC(network), privateKey);
  return priv.getRecommendedAddress();
};

export const newCkbSignerCCC = (privateKey: string, network: CkbNetwork) => {
  return new ccc.SignerCkbPrivateKey(selectClientCCC(network), privateKey);
};
