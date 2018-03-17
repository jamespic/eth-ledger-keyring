const fs = require('fs')
const path = require('path')
const {expect} = require('chai')
const ethUtil = require('ethereumjs-util')
const sigUtil = require('eth-sig-util')
const EthereumTx = require('ethereumjs-tx')
const {default: TransportHID} = require('@ledgerhq/hw-transport-node-hid')
const {RecordStore, createTransportRecorder, createTransportReplayer} = require('@ledgerhq/hw-transport-mocker')

const LedgerKeyring = require('../')

const testnetPath = `m/44'/1'/0'`

const expectedAccounts = [  // Change these if re-recording with a different device
  '0x86852EB424cA6E58920462729627Ee490B67df8d',
  '0x4d495554Ceaba671bA56f435cAC3306d85035E30',
  '0xc3e27eed716C0236F5634631EE2b72a113A120F7'
]

const badAccount = '0x1234567890123456789012345678901234567890'

const txParams = {
  nonce: '0x00',
  gasPrice: '0x09184e72a000',
  gasLimit: '0x2710',
  to: '0x0000000000000000000000000000000000000000',
  value: '0x00',
  data: '0x7f7465737432000000000000000000000000000000000000000000000000000000600057',
  // EIP 155 chainId - mainnet: 1, ropsten: 3
  chainId: 3
}

describe('LedgerKeyring', function () {
  var transport, recordStore, recordingFileName

  beforeEach(async function () {
    let recordingName = this.currentTest.fullTitle().replace(/[^\w]/g, '_')
    recordingFileName = path.join(path.dirname(__filename), 'recordings', recordingName + '.json')
    if (process.env.RECORD_LEDGER_TESTS === 'true') {
      recordStore = new RecordStore()
      let Transport = createTransportRecorder(TransportHID, recordStore)
      transport = await Transport.open((await Transport.list())[0])
    } else {
      let recording = JSON.parse(fs.readFileSync(recordingFileName, 'utf-8'))
      recordStore = RecordStore.fromObject(recording)
      let Transport = createTransportReplayer(recordStore)
      transport = await Transport.open()
    }
    instance = new LedgerKeyring({
      hdPath: testnetPath,
      transport
    })
  })

  afterEach(async function () {
    if (process.env.RECORD_LEDGER_TESTS === 'true') {
      let recording = recordStore.toObject()
      fs.writeFileSync(recordingFileName, JSON.stringify(recording, null, 2))
    }
    await transport.close()
  })

  it('can add accounts', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      transport
    })
    let accounts = await instance.addAccounts(2)
    expect(accounts).to.deep.equal(expectedAccounts.slice(0,2))
    let moreAccounts = await instance.addAccounts(1)
    expect(moreAccounts).to.deep.equal(expectedAccounts.slice(2,3))
    let allAccounts = await instance.getAccounts()
    expect(allAccounts).to.deep.equal(expectedAccounts)
  })

  it('adds same accounts after serialization', async function() {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      transport
    })
    await instance.addAccounts(1)
    let dehydrated = instance.serialize()
    let rehydrated = new LedgerKeyring({transport})
    rehydrated.deserialize(dehydrated)
    expect(await rehydrated.addAccounts(1)).to.deep.equal([expectedAccounts[1]])
  })

  it('can sign personal messages', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: expectedAccounts,
      transport
    })
    let message = '0xdeadbeefface'
    let signature = await instance.signPersonalMessage(expectedAccounts[1], message)
    let signatureForAccount = sigUtil.recoverPersonalSignature({data: message, sig: signature})
    expect(signatureForAccount.toLowerCase()).to.equal(expectedAccounts[1].toLowerCase())
  })

  it('throws an exception if the wrong device is attached when signing personal messages', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: [badAccount],
      transport
    })
    let message = '0xdeadbeefface'
    try {
      await instance.signPersonalMessage(badAccount, message)
    } catch (e) {
      expect(e.message).to.equal(
        `Incorrect Ledger device attached - expected device containg account ${badAccount}, but found ${expectedAccounts[0]}`
      )
    }
  })

  it('throws an exception if a ledger device generates a personal signature for a different device than expected', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: [expectedAccounts[0], badAccount],
      transport
    })
    let message = '0xdeadbeefface'
    try {
      await instance.signPersonalMessage(badAccount, message)
    } catch (e) {
      expect(e.message).to.equal(
        `Signature is for ${expectedAccounts[1].toLowerCase()} but expected ${badAccount} - is the correct Ledger device attached?`
      )
    }
  })

  it('can sign transactions', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: expectedAccounts,
      transport
    })
    var tx = new EthereumTx(txParams)
    await instance.signTransaction(expectedAccounts[2], tx)
    let signatureForAccount = ethUtil.bufferToHex(tx.getSenderAddress())
    expect(signatureForAccount.toLowerCase()).to.equal(expectedAccounts[2].toLowerCase())
  })

  it('throws an exception if the wrong device is attached when signing transactions', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: [badAccount],
      transport
    })
    var tx = new EthereumTx(txParams)
    try {
      await instance.signTransaction(badAccount, tx)
    } catch (e) {
      expect(e.message).to.equal(
        `Incorrect Ledger device attached - expected device containg account ${badAccount}, but found ${expectedAccounts[0]}`
      )
    }
  })

  it('throws an exception if a ledger device generates a transaction signature for a different device than expected', async function () {
    let instance = new LedgerKeyring({
      hdPath: testnetPath,
      accounts: [expectedAccounts[0], badAccount],
      transport
    })
    var tx = new EthereumTx(txParams)
    try {
      await instance.signTransaction(badAccount, tx)
    } catch (e) {
      expect(e.message).to.equal(
        `Signature is for ${expectedAccounts[1].toLowerCase()} but expected ${badAccount} - is the correct Ledger device attached?`
      )
    }
  })
})
