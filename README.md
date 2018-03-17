eth-ledger-keyring
==================
An implementation of MetaMask's [Keyring interface](https://github.com/MetaMask/eth-simple-keyring#the-keyring-class-protocol), that uses a ledger hardware
wallet for all cryptographic operations.

In most regards, it works in the same way as
[eth-hd-keyring](https://github.com/MetaMask/eth-hd-keyring), but using a Ledger
device. However there are a number of differences:
- Because the keys are stored in the device, operations that rely on the device
  will fail if there is no Ledger device attached, or a different Ledger device
  is attached. A LedgerKeyring instance is bound to the attached Ledger device
  when the first account is created.
- The default HD derivation path differs from
  [eth-hd-keyring](https://github.com/MetaMask/eth-hd-keyring), (which uses
  `m/44'/60'/0'/0/x`). For compatibility with existing Ledger clients,
  it uses `m/44'/60'/0'/x` by default.
- It does not support the `signMessage`, `signTypedData` or `exportAccount`
  methods, because Ledger devices do not support these operations.

Using
-----

As per the keyring interface, its constructor accepts an object with options. The options it supports are:
- **hdPath:** The base path to use for derivations. If not provided, defaults to `m/44'/60'/0'`.
- **accounts:** The accounts that are expected to be found on the device. If not provided, this will be initialised when the first account is created.
- **transport:** An transport object, implementing the interface given in Ledger's [hw-transport](https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-transport) module, used to interface with the physical device. If not provided, will be initialised with a U2F transport.

Testing
-------

```
npm test
```

The tests use [hw-transport-mocker](https://github.com/LedgerHQ/ledgerjs/tree/master/packages/hw-transport)
to allow test to be re-run without a physical device. If you run tests with
`RECORD_LEDGER_TESTS=true`, then it will use a physical device, and record the
interaction, to use as an oracle when the tests are re-run.
