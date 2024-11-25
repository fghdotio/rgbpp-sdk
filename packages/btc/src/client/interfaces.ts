import { BTCTestnetType } from '@rgbpp-sdk/ckb';

export interface IBtcClient {
  getTestnetType(): BTCTestnetType | undefined;
}
