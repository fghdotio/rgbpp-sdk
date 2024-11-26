export type BtcNetwork = 'Mainnet' | 'Testnet3' | 'Signet';

export type BtcAssetsApiConfig = {
  url: string;
  token: string;
  origin?: string;
};

export type BtcAccountConfig = {
  privateKey: string;
  addressType: string;
  networkType: string;
};
