import { ccc } from '@ckb-ccc/shell';

const cccClient = new ccc.ClientPublicTestnet();

// https://github.com/CKBFansDAO/dob-cookbook/blob/main/examples/dob0/3.btcfs-i0-png.md
export function generateClusterDescriptionUnderDobProtocol() {
  const clusterDescription =
    'Omiga is excited to announce that RGB++ DOB transactions are now supported. This collection will be featured in Omiga’s upcoming BTC Chain Trading Competition.';

  const dob0Pattern: ccc.spore.dob.PatternElementDob0[] = [
    {
      traitName: 'prev.type',
      dobType: 'String',
      dnaOffset: 0,
      dnaLength: 1,
      patternType: 'options',
      traitArgs: ['image'],
    },
    {
      traitName: 'prev.bg',
      dobType: 'String',
      dnaOffset: 1,
      dnaLength: 1,
      patternType: 'options',
      traitArgs: [
        'btcfs://545b94cb1ecf2175b81c601346e4a7e05149cafc6f235330c9918e35f920e109i0',
        'btcfs://11b6303eb7d887d7ade459ac27959754cd55f9f9e50345ced8e1e8f47f4581fai0',
        'btcfs://f2397b35ea2d050458bc7ec98dcd3d9c3021aa9d44b9ca1cb44673c4eb7c8efai0',
        'btcfs://5895004e95c8a4b80f05f5314d310067a703134515d82effc2ec6eba0dda3fc9i0',
        'btcfs://eb3910b3e32a5ed9460bd0d75168c01ba1b8f00cc0faf83e4d8b67b48ea79676i0',
        'btcfs://b01755a141dd65ee2a0b3bd4aa64a1e3e994a3c82b42271dc5d701c48c67f6d5i0',
        'btcfs://f1dce09bbb61961b3c61efbfa263a38511cf89dbdeed206f6ecc001a52c1fb01i0',
      ],
    },
    {
      traitName: 'prev.bgcolor',
      dobType: 'String',
      dnaOffset: 2,
      dnaLength: 1,
      patternType: 'options',
      traitArgs: ['#E0E1E2'],
    },
    {
      traitName: 'Type',
      dobType: 'Number',
      dnaOffset: 3,
      dnaLength: 1,
      patternType: 'range',
      traitArgs: [10, 50],
    },
    {
      traitName: 'Timestamp',
      dobType: 'Number',
      dnaOffset: 4,
      dnaLength: 4,
      patternType: 'rawNumber',
    },
  ];

  const dob0: ccc.spore.dob.Dob0 = {
    description: clusterDescription,
    dob: {
      ver: 0,
      decoder: ccc.spore.dob.getDecoder(cccClient, 'dob0'),
      pattern: dob0Pattern,
    },
  };

  return ccc.spore.dob.encodeClusterDescriptionForDob0(dob0);
}

export const clusterData = {
  name: 'Nervape-Omiga Test',
  description: generateClusterDescriptionUnderDobProtocol(),
};

export function generateSimpleDNA(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
