"use strict";
const { infuraApiKey, mnemonic } = require('./network_keys/secrets.json');
const HDWalletProvider = require("@truffle/hdwallet-provider");
// const ApiKey = process.env.INFURA_API_KEY || require('./network_keys/api/infura');
const Infura = {
  Mainnet: "https://mainnet.infura.io/v3/" + infuraApiKey,
  Ropsten: "https://ropsten.infura.io/v3/" + infuraApiKey,
  Rinkeby: "https://rinkeby.infura.io/v3/" + infuraApiKey,
  Kovan: "https://kovan.infura.io/v3/" + infuraApiKey
};
// const Wallets = require('./network_keys/private/wallets');
// const Provider = require('truffle-privatekey-provider');

module.exports = {
  networks: {
    test: {
      host: "127.0.0.1",
      port: 8545,
      network_id: 5777, // Match Ganache(Truffle) network id
      gas: 6500000,
    },
    rinkeby: {
      network_id: 4,
      provider: () => new HDWalletProvider(mnemonic, Infura.Rinkeby),
      gas: 8000000,
      gasPrice: '1000000000',
      skipDryRun: true
    },
    mainnet: {
      network_id: 1,
      provider: () => new HDWalletProvider(mnemonic, Infura.Mainnet),
      gas: 5000000,
      gasPrice: '8000000000'
    },
    ropsten: {
      network_id: 3,
      provider: () => new HDWalletProvider(mnemonic, Infura.Ropsten),
      gas: 5000000,
      gasPrice: '6000000000'
    },
    kovan: {
      network_id: 42,
      provider: () => new HDWalletProvider(mnemonic, Infura.Kovan),
      gasPrice: '15000000000',
      gas: 8000000
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // reporter: 'eth-gas-reporter',
    //     reporterOptions : {
    //         currency: 'USD',
    //         gasPrice: 5
    //     }
  },
  compilers: {
    solc: {
      version: "0.6.12",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         runs: 200
       },
      //  evmVersion: "byzantium"
      }
    },
  },
};
