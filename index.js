const {EventEmitter} = require('events')
const ethUtil = require('ethereumjs-util')
const sigUtil = require('eth-sig-util')
const {default: Eth} = require('@ledgerhq/hw-app-eth')

// HD path differs from eth-hd-keyring - MEW, Parity, Geth and Official Ledger clients use same unusual derivation for Ledger
const hdPathString = `m/44'/60'/0'`
const type = 'Ledger Hardware Keyring'

class LedgerKeyring extends EventEmitter {
  constructor (opts) {
    super()
    this.type = type
    if (opts.transport) {
      this.transport = opts.transport
    }
    this.deserialize(opts)
  }

  serialize () {
    return {hdPath: this.hdPath, accounts: this.accounts}
  }

  deserialize (opts) {
    this.hdPath = opts.hdPath || hdPathString
    this.accounts = opts.accounts || []
  }

  async addAccounts (n = 1) {
    let eth = await this._getEth()
    let l = this.accounts.length
    for (let i = l; i < l + n; i++) {
      this.accounts[i] = (await eth.getAddress(this._derivePath(i))).address
    }
    return this.accounts.slice(l, l + n)
  }

  async getAccounts () {
    return this.accounts.slice()
  }

  // tx is an instance of the ethereumjs-transaction class.
  async signTransaction (address, tx) {
    let accountId = await this._findAddressId(address)
    let eth = await this._getEth()
    tx.v = tx._chainId
    let ledgerSig = await eth.signTransaction(this._derivePath(accountId), tx.serialize().toString('hex'))
    tx.v = parseInt(ledgerSig.v, 16)
    tx.r = '0x' + ledgerSig.r
    tx.s = '0x' + ledgerSig.s
    let addressSignedWith = ethUtil.bufferToHex(tx.getSenderAddress())
    if (addressSignedWith.toLowerCase() !== address.toLowerCase()) {
      throw new Error(`Signature is for ${addressSignedWith} but expected ${address} - is the correct Ledger device attached?`)
    }
    return tx
  }

  async signMessage (withAccount, data) {
    throw new Error('Not supported on this device')
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage (withAccount, message) {
    let accountId = await this._findAddressId(withAccount)
    let eth = await this._getEth()
    let msgHex = ethUtil.stripHexPrefix(message)
    let ledgerSig = await eth.signPersonalMessage(this._derivePath(accountId), msgHex)
    let signature = this._personalToRawSig(ledgerSig)
    let addressSignedWith = sigUtil.recoverPersonalSignature({data: message, sig: signature})
    if (addressSignedWith.toLowerCase() !== withAccount.toLowerCase()) {
      throw new Error(`Signature is for ${addressSignedWith} but expected ${withAccount} - is the correct Ledger device attached?`)
    }
    return signature
  }

  async signTypedData (withAccount, typedData) {
    throw new Error('Not supported on this device')
  }

  async exportAccount (address) {
    throw new Error('Not supported on this device')
  }

  async _getEth () {
    if (!this._eth) {
      if (!this.transport) {
        this.transport = await require('@ledgerhq/hw-transport-u2f').default.create()
      }
      this._eth = new Eth(this.transport)
    }
    return this._eth
  }

  async _findAddressId (addr) {
    let result = this.accounts.indexOf(addr)
    if (result === -1) throw new Error('Unknown address')
    else return result
  }

  // async _addressFromId (i) {
  //   return (await eth.getAddress(this._derivePath(i))).address
  // }

  _derivePath (i) {
    return this.hdPath + '/' + i
  }

  _personalToRawSig (ledgerSig) {
    var v = ledgerSig['v'] - 27;
    v = v.toString(16);
    if (v.length < 2) {
      v = "0" + v;
    }
    return "0x" + ledgerSig['r'] + ledgerSig['s'] + v
  }

}

LedgerKeyring.type = type
module.exports = LedgerKeyring
