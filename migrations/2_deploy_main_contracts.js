// migrations/2_deploy_box.js
const UnionAssetPool = artifacts.require('UnionAssetPool');
const UpgradeableBeacon = artifacts.require('UpgradeableBeacon');
const BeaconProxy = artifacts.require('BeaconProxy');
const uUNNToken = artifacts.require('uUNNToken');
const ParamStorage = artifacts.require('ParamStorage');
const UnionRouter = artifacts.require('UnionRouter');
const OCProtections = artifacts.require('OCProtections');

function toBN(number) {
  return web3.utils.toBN(number);
}

const decimals = toBN('10').pow(toBN('18'));

const { deployProxy } = require('@openzeppelin/truffle-upgrades');
 
module.exports = async function (deployer, network, accounts) {
  let signatureWallet = '0x84a5B4B863610989197C957c8816cF6a3B91adD2';
  let daiTokenAddress;
  let daiEthChainlinkFeed;
  let btcUsdChainlinkFeed;
  let usdcETHPriceFeed;
  let wETHtoken;
  let wBTCtoken;
  let usdcAddress;
  if(network == 'rinkeby'){
    let uniswapRouterAddress = '0x7D8AB70Da03ef8695c38C4AE3942015c540e2439';
    wBTCtoken = '0x19cDab1A0b017dc97f733FC2304Dc7aEC678a5E9';
    wETHtoken = '0xc778417e063141139fce010982780140aa0cd5ab';
    usdcAddress = '0x3813a8Ba69371e6DF3A89b78bf18fC72Dd5B43c5';
    let unnAddress = '0xc2b2602344d5Ca808F888954f30fCb2B5E13A08F';
    daiTokenAddress = '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea';
    daiEthChainlinkFeed = '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D';
    btcUsdChainlinkFeed = '0xECe365B379E1dD183B20fc5f022230C044d51404';
    usdcETHPriceFeed = '0xdCA36F27cbC4E38aE16C4E9f99D39b42337F6dcf';

  } else if(network == 'kovan' || network == 'kovan-fork'){
    let uniswapRouterAddress = '0x7D8AB70Da03ef8695c38C4AE3942015c540e2439';
    wBTCtoken = '0xd1b98b6607330172f1d991521145a22bce793277';
    wETHtoken = '0xd0a1e359811322d97991e03f863a0c30c2cf029c';
    usdcAddress = '0xe22da380ee6b445bb8273c81944adeb6e8450422';
    // let unnAddress = '0xc2b2602344d5Ca808F888954f30fCb2B5E13A08F';
    daiTokenAddress = '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd';
    daiEthChainlinkFeed = '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541';
    btcUsdChainlinkFeed = '0x6135b13325bfC4B00278B4abC5e20bbce2D6580e';
    usdcETHPriceFeed = '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541';
  }
  else if(network == 'ropsten'){
    let uniswapRouterAddress = '0x7D8AB70Da03ef8695c38C4AE3942015c540e2439';
    daiEthChainlinkFeed = '0x74825DbC8BF76CC4e9494d0ecB210f676Efa001D';
    btcUsdChainlinkFeed = '0xECe365B379E1dD183B20fc5f022230C044d51404';
  }
  else if(network == 'test' || network =='mainnet'){
    wBTCtoken = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
    wETHtoken = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    daiTokenAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
    // daiTokenAddress = usdcAddress;
    daiEthChainlinkFeed = '0x773616E4d11A78F511299002da57A0a94577F1f4';
    btcUsdChainlinkFeed = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c';
  }

  let UnionERC20PoolBeaconAddress;

  await deployer.deploy(UnionAssetPool).then(function(){
    return UpgradeableBeacon.new(UnionAssetPool.address);
  }).then(function (Beacon){
    console.log ("UnionAssetPool Beacon:", Beacon.address);
    UnionERC20PoolBeaconAddress = Beacon.address;
  });
  
  let uUNNTokenInstance;
  await deployer.deploy(uUNNToken).then(function(){
    return UpgradeableBeacon.new(uUNNToken.address);
  }).then(function (Beacon){
    console.log ("uUNNToken Beacon:", Beacon.address);
    return BeaconProxy.new(Beacon.address, web3.utils.hexToBytes('0x'));
  }).then (function(BeaconProxy){
    return uUNNToken.at(BeaconProxy.address);
  }).then(function (instance){
    uUNNTokenInstance = instance;
  });
  console.log ("uUNNToken Proxy Instance:", uUNNTokenInstance.address);
  await uUNNTokenInstance.initialize.sendTransaction(accounts[0]);
  await uUNNTokenInstance.setBaseURI.sendTransaction("https://dev-api.cyberunit.tech/v1/asset/token/", {from:accounts[0]});

  let paramStorageInstance;
  await deployer.deploy(ParamStorage).then(function(){
    return UpgradeableBeacon.new(ParamStorage.address);
  }).then(function (Beacon){
    console.log ("ParamStorage Beacon:", Beacon.address);
    return BeaconProxy.new(Beacon.address, web3.utils.hexToBytes('0x'));
  }).then (function(BeaconProxy){
    return ParamStorage.at(BeaconProxy.address);
  }).then(function (instance){
    paramStorageInstance = instance;
  });
  console.log ("paramStorage Proxy Instance:", paramStorageInstance.address);
  await paramStorageInstance.initialize.sendTransaction(accounts[0]);

  let ocProtectionsInstance;
  await deployer.deploy(OCProtections).then(function(){
    return UpgradeableBeacon.new(OCProtections.address);
  }).then(function (Beacon){
    console.log ("OCProtections Beacon:", Beacon.address);
    return BeaconProxy.new(Beacon.address, web3.utils.hexToBytes('0x'));
  }).then (function(BeaconProxy){
    return OCProtections.at(BeaconProxy.address);
  }).then(function (instance){
    ocProtectionsInstance = instance;
  });

  console.log ("ocProtectionsInstance Proxy Instance:", ocProtectionsInstance.address);
  await uUNNTokenInstance.grantRole.sendTransaction(web3.utils.keccak256('PROTECTION_FACTORY_ROLE'), ocProtectionsInstance.address, {from:accounts[0]});
  await ocProtectionsInstance.initialize.sendTransaction(accounts[0], uUNNTokenInstance.address, {from:accounts[0]});
  await ocProtectionsInstance.grantRole.sendTransaction(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signatureWallet, {from:accounts[0]});

  //create UnionRouter
  await deployer.deploy(UnionRouter).then(function(instance){
    unionRouter = instance;
  });
  console.log ("unionRouter Instance:", unionRouter.address);
  await unionRouter.initialize.sendTransaction(accounts[0]);
  await unionRouter.setUUNNToken.sendTransaction(uUNNTokenInstance.address, {from:accounts[0]});

// create pool instances for DAI/ETH and DAI/BTC
console.log("Deploying DAI/ETH and DAI/BTC pools");
let unionDAIPoolETH;
let unionUSDCPoolETH;
let unionDAIPoolBTC;
  await BeaconProxy.new(UnionERC20PoolBeaconAddress, web3.utils.hexToBytes('0x')).then(function(BeaconProxy){
    return UnionAssetPool.at(BeaconProxy.address);
  }).then(function (instance){
    unionDAIPoolETH = instance;
  });

  await BeaconProxy.new(UnionERC20PoolBeaconAddress, web3.utils.hexToBytes('0x')).then(function(BeaconProxy){
    return UnionAssetPool.at(BeaconProxy.address);
  }).then(function (instance){
    unionDAIPoolBTC = instance;
  });

  await BeaconProxy.new(UnionERC20PoolBeaconAddress, web3.utils.hexToBytes('0x')).then(function(BeaconProxy){
    return UnionAssetPool.at(BeaconProxy.address);
  }).then(function (instance){
    unionUSDCPoolETH = instance;
  });

console.log ("UnionAssetPool Proxy Instance (DAI POOL) for ETH:", unionDAIPoolETH.address);
await unionDAIPoolETH.initialize.sendTransaction(accounts[0], daiTokenAddress, wETHtoken, ocProtectionsInstance.address, daiEthChainlinkFeed,true,'Union DAI/ETH Asset Pool', {from:accounts[0]});
console.log ("UnionAssetPool Proxy Instance (DAI POOL) for BTC:", unionDAIPoolBTC.address);
await unionDAIPoolBTC.initialize.sendTransaction(accounts[0], daiTokenAddress, wBTCtoken, ocProtectionsInstance.address, btcUsdChainlinkFeed,false,'Union DAI/BTC Asset Pool', {from:accounts[0]});
console.log ("UnionAssetPool Proxy Instance (USDC POOL) for ETH:", unionUSDCPoolETH.address);
await unionUSDCPoolETH.initialize.sendTransaction(accounts[0], usdcAddress, wETHtoken, ocProtectionsInstance.address, usdcETHPriceFeed,true,'Union USDC/ETH Asset Pool', {from:accounts[0]});
await unionDAIPoolETH.grantRole.sendTransaction(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet, {from:accounts[0]});
await unionDAIPoolBTC.grantRole.sendTransaction(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet, {from:accounts[0]});
await unionUSDCPoolETH.grantRole.sendTransaction(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet, {from:accounts[0]});
console.log("enabling OC protection for tokens: ",wETHtoken," ",wBTCtoken);
await unionRouter.addCollateralProtection.sendTransaction(wETHtoken,unionDAIPoolETH.address,ocProtectionsInstance.address, {from:accounts[0]});
await unionRouter.addCollateralProtection.sendTransaction(wBTCtoken,unionDAIPoolBTC.address,ocProtectionsInstance.address, {from:accounts[0]});
  
};