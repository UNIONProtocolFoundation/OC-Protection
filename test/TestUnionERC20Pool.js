const UnionAssetPool = artifacts.require('UnionAssetPool');
const UpgradeableBeacon = artifacts.require('UpgradeableBeacon');
const BeaconProxy = artifacts.require('BeaconProxy');
const uUNNToken = artifacts.require('uUNNToken');
const ParamStorage = artifacts.require('ParamStorage');
const UnionRouter = artifacts.require('UnionRouter');
const TestToken = artifacts.require('TestToken');
const OCProtections = artifacts.require('OCProtections');
const UniswapUtil = artifacts.require('UniswapUtil');
const EthCrypto = require("eth-crypto");
const {
    expectRevert
} = require('openzeppelin-test-helpers');
const {
    assert,
    expect
} = require('chai');
const { MAX_UINT256 } = require("openzeppelin-test-helpers/src/constants");

const daiEthChainlinkFeed = '0x773616E4d11A78F511299002da57A0a94577F1f4';
const btcUsdChainlinkFeed = '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c';
const uniswapFactoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const uniTokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984';
const daiTokenAddress = '0x6b175474e89094c44da98b954eedeac495271d0f';
const wBTCtoken = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599';
const wETHtoken = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const maxUint = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

function toBN(number) {
    return web3.utils.toBN(number);
}

const decimals = toBN('10').pow(toBN('18'));

async function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

function printEvents(txResult, strdata) {
    console.log(strdata, " events:", txResult.logs.length);
    for (var i = 0; i < txResult.logs.length; i++) {
        let argsLength = Object.keys(txResult.logs[i].args).length;
        console.log("Event ", txResult.logs[i].event, "  length:", argsLength);
        for (var j = 0; j < argsLength; j++) {
            if (!(typeof txResult.logs[i].args[j] === 'undefined') && txResult.logs[i].args[j].toString().length > 0)
                console.log(">", i, ">", j, " ", txResult.logs[i].args[j].toString());
        }
    }
}

const buyDAI = async (uniswapUtil, account) => {
    await uniswapUtil.buyExactTokenWithEth.sendTransaction(daiTokenAddress, account, {
        from: account,
        value: toBN(2).mul(decimals)
    });
    let balanceDAI = await daiToken.balanceOf.call(account);
    console.log("DAI", balanceDAI.toString());
}

const approveToken = async (token, owner, spender) => {
    await token.approve.sendTransaction(spender, MAX_UINT256, {
        from: owner
    });
}

const buyProtection = async (
    ocProtectionSeller, 
    pool, validTo, amount, 
    strike, deadline, 
    ardata, signature, account) => {
    let buyRes = await ocProtectionSeller.create.sendTransaction(pool, validTo, amount, strike, deadline, ardata, signature, {
        from: account
    });
    return buyRes;
}

const withdrawData = async (pool, requestID, amount, ardata, signature, account) => {
    let withdrawRes = await pool.withdrawWithData.sendTransaction(requestID, amount, ardata, signature, {
        from: account
    });
    return withdrawRes
}
const signMessage = async (message, privateKey) => {

    const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
    const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);

    const signerIdentity = {
        privateKey: privateKey,
        publicKey: publicKeySigner,
        address: signerAddress
    }

    const publicKey = EthCrypto.publicKeyByPrivateKey(signerIdentity.privateKey);
    const magicAddress = EthCrypto.publicKey.toAddress(publicKey);
    console.log("Magic address: ", magicAddress);
    const messageHash = EthCrypto.hash.keccak256(message);
    const signature = EthCrypto.sign(signerIdentity.privateKey, messageHash);
    return signature;
}

async function printPoolStat(pool) {
    let poolStat = await pool.getPoolStat.call();
    console.log("Pool stat: ");
    console.log("totalCap: ", poolStat[0].toString());
    console.log("totalSupply: ", poolStat[1].toString());
    console.log("lockedPremium: ", poolStat[2].toString());
    console.log("mcr: ", poolStat[3].toString());
    console.log("totalMcrPending: ", poolStat[4].toString());
    console.log("mcrUpdatedBlockNumber: ", poolStat[5].toString());
    console.log("mcrPendingsList.sizeOF(): ", poolStat[6].toString());
}

let accounts;
let daiToken;
let ocProtections;
let signatureWallet = '0x84a5B4B863610989197C957c8816cF6a3B91adD2';
let uunnToken;
let uUNNTokenInstance;
let unionDAIPoolETH;
let unionDAIPoolETHRevenueTest;
let unionDAIPoolBTC;
let paramStorage;
let uniswapUtil;

const depoyNewPool = async () => {
    const unionAssetPool = await UnionAssetPool.new();
    const unionAssetPoolBeacon = await UpgradeableBeacon.new(unionAssetPool.address);
    const beaconProxy = await BeaconProxy.new(unionAssetPoolBeacon.address, web3.utils.hexToBytes('0x'));
    const newPool = await UnionAssetPool.at(beaconProxy.address);
    return newPool;
}

const deployContract = async () => {
    unionDAIPoolETH = await depoyNewPool();
    unionDAIPoolBTC = await depoyNewPool();
    unionDAIPoolETHRevenueTest = await depoyNewPool();
    uunnToken = await uUNNToken.new();
    unnnTokenBeacon = await UpgradeableBeacon.new(uunnToken.address);
    console.log("uUNNToken Beacon:", unnnTokenBeacon.address);
    const unnnTokenBeaconProxy = await BeaconProxy.new(unnnTokenBeacon.address, web3.utils.hexToBytes('0x'));
    uUNNTokenInstance = await uUNNToken.at(unnnTokenBeaconProxy.address);
    console.log("uUNNToken Proxy Instance:", unnnTokenBeaconProxy.address);
    await uUNNTokenInstance.initialize(accounts[0]);
    let paramStorageInstance;
    paramStorage = await ParamStorage.new();
    const paramStorageBeacon = await UpgradeableBeacon.new(paramStorage.address);
    console.log("ParamStorage Beacon:", paramStorageBeacon.address);
    const paramBeaconProxy = await BeaconProxy.new(paramStorageBeacon.address, web3.utils.hexToBytes('0x'));
    paramStorageInstance = await ParamStorage.at(paramBeaconProxy.address);
    console.log("paramStorage Proxy Instance:", paramBeaconProxy.address);
    await paramStorageInstance.initialize(accounts[0]);
    let OCProtectionsBeaconProxy;
    let ocProtectionsInstance;
    ocProtections = await OCProtections.new();
    const ocProtectionsBeacon = await UpgradeableBeacon.new(ocProtections.address);
    console.log("OCProtections Beacon:", ocProtectionsBeacon.address);
    OCProtectionsBeaconProxy = await BeaconProxy.new(ocProtectionsBeacon.address, web3.utils.hexToBytes('0x'));
    ocProtectionsInstance = await OCProtections.at(OCProtectionsBeaconProxy.address);
    console.log("ocProtectionsInstance Proxy Instance:", OCProtectionsBeaconProxy.address);
    await ocProtectionsInstance.initialize(accounts[0], unnnTokenBeaconProxy.address);
    console.log("UnionAssetPool Proxy Instance (DAI POOL) for ETH:", unionDAIPoolETH.address);
    await unionDAIPoolETH.initialize(accounts[0], daiTokenAddress, wETHtoken, OCProtectionsBeaconProxy.address, daiEthChainlinkFeed, true, 'Union DAI/ETH Asset Pool');
    console.log("UnionAssetPool Proxy Instance (DAI POOL) for BTC:", unionDAIPoolBTC.address);
    await unionDAIPoolBTC.initialize(accounts[0], daiTokenAddress, wBTCtoken, OCProtectionsBeaconProxy.address, btcUsdChainlinkFeed, false, 'Union DAI/BTC Asset Pool');
    console.log("UnionAssetPool Proxy Instance (DAI POOL) for ETH:", unionDAIPoolETHRevenueTest.address);
    await unionDAIPoolETHRevenueTest.initialize(accounts[0], daiTokenAddress, wETHtoken, OCProtectionsBeaconProxy.address, daiEthChainlinkFeed, true, 'Union DAI/ETH Asset Pool');
    unionRouter = await UnionRouter.new();
    console.log("unionRouter Instance:", unionRouter.address);
    await unionRouter.initialize(accounts[0]);
    console.log("enabling OC protection for tokens: ", wETHtoken, " ", wBTCtoken);
    await unionRouter.addCollateralProtection(wETHtoken, unionDAIPoolETH.address, OCProtectionsBeaconProxy.address, {
        from: accounts[0]
    });
    await unionRouter.addCollateralProtection(wBTCtoken, unionDAIPoolBTC.address, OCProtectionsBeaconProxy.address);
    await unionRouter.setUUNNToken(unnnTokenBeaconProxy.address);
    await uUNNTokenInstance.grantRole(web3.utils.keccak256('PROTECTION_FACTORY_ROLE'), OCProtectionsBeaconProxy.address);
    await uUNNTokenInstance.setBaseURI("https://test.unn.token.com/");
    await ocProtectionsInstance.grantRole(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signatureWallet);
    await unionDAIPoolETH.grantRole(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet);
    await unionDAIPoolETHRevenueTest.grantRole(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet);
    await unionDAIPoolBTC.grantRole(web3.utils.keccak256('MCR_PROVIDER'), signatureWallet);
    await paramStorageInstance.setParamAddress(toBN(1), unionRouter.address);
    await paramStorageInstance.setParamAddress(toBN(1000), uUNNTokenInstance.address);
    await paramStorageInstance.setParamAddress(toBN(1001), unionDAIPoolETH.address);
    await paramStorageInstance.setParamAddress(toBN(1002), unionDAIPoolBTC.address);
    await paramStorageInstance.setParamAddress(toBN(1003), OCProtectionsBeaconProxy.address);
}

const deposit = async (pool, account, amount) => {
    const res = await pool.deposit.sendTransaction(amount, {
        from: account
    });
    return res
}

describe('UnionAssetPool', () => {

    before(async () => {
        accounts = await web3.eth.getAccounts();
        assert.isAtLeast(accounts.length, 10, 'User accounts must be at least 10');
        daiToken = await TestToken.at(daiTokenAddress);
        await deployContract();
        let ethResult = await unionRouter.collateralProtection.call(wETHtoken);
        console.log("ethResult ", ethResult[0].toString(), ethResult[1].toString());
        unionDAIPoolETH = await UnionAssetPool.at(ethResult[1]);
        let btcResult = await unionRouter.collateralProtection.call(wBTCtoken);
        console.log("btcResult ", btcResult[0].toString(), btcResult[1].toString());
        unionDAIPoolBTC = await UnionAssetPool.at(btcResult[1]);
        ocProtectionSeller = await OCProtections.at(ethResult[0])
        console.log("unionRouter.address ", unionRouter.address);
        console.log("uunnToken.address ", uunnToken.address);
        console.log("unionDAIPoolETH.address ", unionDAIPoolETH.address);
        console.log("unionDAIPoolBTC.address ", unionDAIPoolBTC.address);
        adminAddress = accounts[0];
        await UniswapUtil.new(uniswapRouterAddress, {
            from: accounts[0]
        }).then(instance => uniswapUtil = instance);

    });

    it('should get some DAI', async () => {
        for (let i = 1; i < 10; i++) {
            await buyDAI(uniswapUtil, accounts[i]);
        }
    });

    it('should push liquidity into Pools', async () => {

        for (let i = 4; i < 7; i++) {
            let balanceDAI = await daiToken.balanceOf.call(accounts[i]);
            await approveToken(daiToken, accounts[i], unionDAIPoolETH.address);
            const depositRes = await deposit(unionDAIPoolETH, accounts[i], balanceDAI);
            console.log(`depositRes GasUsed: ${depositRes.receipt.gasUsed} `);
            var res = await unionDAIPoolETH.getWriterDataExtended.call(accounts[i]);
            console.log("User stat", res[0].toString(), res[1].toString(), res[2].toString());
        }
        for (let i = 7; i < 10; i++) {
            let balanceDAI = await daiToken.balanceOf.call(accounts[i]);
            await approveToken(daiToken, accounts[i], unionDAIPoolBTC.address);
            await deposit(unionDAIPoolBTC, accounts[i], balanceDAI);
        }
        let resEth = await unionDAIPoolETH.getTotalValueLocked.call();
        console.log("unionDAIPoolETH balance ", resEth[0].toString(), " ", resEth[1].toString());
        let resBtc = await unionDAIPoolBTC.getTotalValueLocked.call();
        console.log("unionDAIPoolBTC balance ", resBtc[0].toString(), " ", resBtc[1].toString());
    });

    it('should buy protection', async () => {
        let buyerAccount = accounts[1];
        // function create(address pool, uint256 validTo, uint256 amount, uint256 strike, uint256 deadline, bytes memory data, bytes memory signature) public whenNotPaused returns (address){
        let validTo = new Date().getTime() + (2 * 24 * 60 * 60 * 1000);
        let currentPrice = await unionDAIPoolETH.getLatestPrice.call();
        strike = currentPrice.add(toBN(80).mul(toBN(1e8)));
        console.log("Strike ", strike.toString());
        let amount = toBN(1).mul(decimals);
        let tokenId = toBN(1);
        let premium = toBN(50).mul(decimals);
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(1000000));
        let mcr = toBN(1000).mul(decimals);
        let mcrIncrement = toBN(200).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let poolAddress = toBN(unionDAIPoolETH.address);
        console.log("PoolAddr num ", poolAddress.toString());

        let ardata = [tokenId, premium, minPrice, validTo, amount, strike, poolAddress, mcr, mcrBlockNumber, mcrIncrement, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        let message = [{
                type: "uint256",
                value: tokenId.toString()
            },
            {
                type: "uint256",
                value: premium.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: validTo.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: strike.toString()
            },
            {
                type: "uint256",
                value: poolAddress.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: mcrIncrement.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            },
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await ocProtectionSeller.hasRole(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);

        await approveToken(daiToken, buyerAccount, ocProtectionSeller.address);
        let daiBlanceBefore = await daiToken.balanceOf.call(buyerAccount);
        let poolBalanceBefore = await daiToken.balanceOf.call(unionDAIPoolETH.address);
        let buyRes = await buyProtection(ocProtectionSeller, unionDAIPoolETH.address, validTo, amount, strike, deadline, ardata, signature, buyerAccount);
        console.log(`create GasUsed: ${buyRes.receipt.gasUsed} `);
        let poolBalanceAfter = await daiToken.balanceOf.call(unionDAIPoolETH.address);
        let daiBlanceAfter = await daiToken.balanceOf.call(buyerAccount);
        assert.equal(daiBlanceBefore.sub(daiBlanceAfter).toString(), premium.toString(), 'Premium is not sent from buyers account');
        assert.equal(poolBalanceAfter.sub(poolBalanceBefore).toString(), premium.toString(), 'Premium has not arrived to pool account');
        assert.equal((await unionDAIPoolETH.lockedPremium.call()).toString(), premium.toString(), 'Premium is not locked');

        console.log("DAI Spent ", daiBlanceBefore.sub(daiBlanceAfter).toString());

        let bal = await uUNNTokenInstance.balanceOf.call(buyerAccount);
        console.log("uUNN balance = ", bal.toString());
        let tokenID = await uUNNTokenInstance.tokenOfOwnerByIndex.call(buyerAccount, toBN(0));
        console.log("uUNN tokenID = ", tokenID.toString());
        let address = await uUNNTokenInstance.protectionContract.call(tokenID);
        console.log("uUNN tokenID address = ", address.toString());

        let ocProtectionContract = await OCProtections.at(address);

        let protectionData = await ocProtectionContract.getProtectionData.call(tokenID);
        console.log("id ,", tokenID.toString());
        console.log("strike ,", protectionData[2].toString());
        console.log("amount ,", protectionData[1].toString());
        console.log("premium ,", protectionData[3].toString());
        console.log("issedOn ,", protectionData[4].toString());
        console.log("validTo ,", protectionData[5].toString());
        console.log("poolAddress ,", protectionData[0].toString());

        let daiBalanceBeforeEx = await daiToken.balanceOf.call(buyerAccount);
        let excerciseRes = await ocProtectionContract.exercise.sendTransaction(tokenID, toBN(1).mul(decimals), {
            from: buyerAccount
        });
        console.log(`excerciseRes GasUsed: ${excerciseRes.receipt.gasUsed} `);
        let daiBalanceAfterEx = await daiToken.balanceOf.call(buyerAccount);
        console.log("DAI Received ", daiBalanceAfterEx.sub(daiBalanceBeforeEx).toString());
    });

    it('should unloadMCRQueue', async () => {

        await printPoolStat(unionDAIPoolETH);
        let mcr = toBN(2000).mul(decimals);
        let mcrBlockNumber;
        await web3.eth.getBlock("latest").then(block => mcrBlockNumber = block.number);

        let ardata = [mcr, mcrBlockNumber];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        let message = [{
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            }
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);

        let flushQueue = await unionDAIPoolETH.flushMCRPendingQueue.sendTransaction(toBN('10'), ardata, signature);
        console.log(`flushQueue GasUsed: ${flushQueue.receipt.gasUsed} `);

        await printPoolStat(unionDAIPoolETH);

    });

    it('should withdraw', async () => {

        let withdrawAccount = accounts[4];
        let withdrawAccountBalanceBefore = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceBefore = ", withdrawAccountBalanceBefore.toString());
        let requestID = toBN(1);
        let amount = toBN(1000).mul(decimals);
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(10000000000));
        let mcr = toBN(1000).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let ardata = [requestID, amount, minPrice, mcr, mcrBlockNumber, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';

        let message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        let daiBlanceBefore = await daiToken.balanceOf.call(withdrawAccount);
        let poolBalanceBefore = await daiToken.balanceOf.call(unionDAIPoolETH.address);
        
        await expectRevert(
            unionDAIPoolETH.withdrawWithData.sendTransaction(requestID, amount, ardata , signature, {from: withdrawAccount}),
            'revert'
        ); //reverted due to timelock

        //update timelock period and attempt withdraw
        await unionDAIPoolETH.setLockupPeriod.sendTransaction(toBN(1), {from: adminAddress});

        let withdrawRes = await unionDAIPoolETH.withdrawWithData.sendTransaction(requestID, amount, ardata , signature, {from: withdrawAccount});
        console.log(`withdraw GasUsed: ${withdrawRes.receipt.gasUsed} `);
        //set timelock back
        await unionDAIPoolETH.setLockupPeriod.sendTransaction(toBN(7*24*3600), {from: adminAddress});

        let daiBlanceAfter = await daiToken.balanceOf.call(withdrawAccount);
        let poolBalanceAfter = await daiToken.balanceOf.call(unionDAIPoolETH.address);

        console.log("DAI from Pool ", poolBalanceBefore.sub(poolBalanceAfter).toString());
        console.log("DAI to withdrawAccount ", daiBlanceAfter.sub(daiBlanceBefore).toString());

        let withdrawAccountBalanceAfter = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceAfter = ", withdrawAccountBalanceAfter.toString());
        // for (let i=0;i<2;i++){

    });

    it('should get baseURI', async () => {
        let tokenURI = await uUNNTokenInstance.tokenURI.call(toBN(1));
        console.log("TokenURI = ", tokenURI.toString());

    });

    it('should revert withdraw: Wrong amount', async () => {

        let withdrawAccount = accounts[5];
        let withdrawAccountBalanceBefore = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceBefore = ", withdrawAccountBalanceBefore.toString());


        let requestID = toBN(1);
        let amount = withdrawAccountBalanceBefore + 1000;
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(10000000000));
        let mcr = toBN(1000).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let ardata = [requestID, amount, minPrice, mcr, mcrBlockNumber, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';

        let message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);


        await approveToken(unionDAIPoolETH, withdrawAccount,  unionDAIPoolETH.address);
        await expectRevert.unspecified(
            unionDAIPoolETH.withdrawWithData.sendTransaction(requestID, amount, ardata, signature, {
                from: withdrawAccount
            })
        );
    });

    it('should revert withdraw: Invalid signature', async () => {

        let withdrawAccount = accounts[5];
        let withdrawAccountBalanceBefore = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceBefore = ", withdrawAccountBalanceBefore.toString());
        let requestID = toBN(1);
        let amount = withdrawAccountBalanceBefore;
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(10000000000));
        let mcr = toBN(1000).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let ardata = [requestID, amount, minPrice, mcr, mcrBlockNumber, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5190'; // wrong private key
        let message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        await approveToken(unionDAIPoolETH, withdrawAccount,  unionDAIPoolETH.address);
        await expectRevert.unspecified(
            unionDAIPoolETH.withdrawWithData.sendTransaction(requestID, amount, ardata, signature, {
                from: withdrawAccount
            })
        );
    });

    it('should unlock', async () => {
        await printPoolStat(unionDAIPoolETH);
        const poolReserveBalanceBeforeUnlock = await unionDAIPoolETH.poolReserveBalance.call();
        const foundationReserveBalanceBeforeUnlock = await unionDAIPoolETH.foundationReserveBalance.call();
        console.log('poolReserveBalance, foundationReserveBalance before unlock', poolReserveBalanceBeforeUnlock.toString(), foundationReserveBalanceBeforeUnlock.toString())
        let buyerAccount = accounts[2];
        let validTo = Math.round((new Date().getTime() + 20000) / 1000);
        console.log(validTo, 'xxxx valid to')
        let currentPrice = await unionDAIPoolETH.getLatestPrice.call();
        strike = currentPrice.add(toBN(80).mul(toBN(1e8)));
        console.log("Strike ", strike.toString());
        let amount = toBN(10).mul(decimals);
        let tokenId = toBN(2);
        let premium = toBN(5).mul(decimals);
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(1000000));
        let mcr = toBN(1000).mul(decimals);
        let mcrIncrement = toBN(200).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let poolAddress = toBN(unionDAIPoolETH.address);
        console.log("PoolAddr num ", poolAddress.toString());

        let ardata = [tokenId, premium, minPrice, validTo, amount, strike, poolAddress, mcr, mcrBlockNumber, mcrIncrement, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        let message = [{
                type: "uint256",
                value: tokenId.toString()
            },
            {
                type: "uint256",
                value: premium.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: validTo.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: strike.toString()
            },
            {
                type: "uint256",
                value: poolAddress.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: mcrIncrement.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            },
        ];

        const signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await ocProtectionSeller.hasRole(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);


        // let premium= toBN(50).mul(decimals);
        await approveToken(daiToken, buyerAccount, ocProtectionSeller.address);
        let daiBlanceBefore = await daiToken.balanceOf.call(buyerAccount);
        let poolBalanceBefore = await daiToken.balanceOf.call(unionDAIPoolETH.address);
        await buyProtection(ocProtectionSeller, unionDAIPoolETH.address, validTo, amount, strike, deadline, ardata, signature, buyerAccount);
        let poolBalanceAfter = await daiToken.balanceOf.call(unionDAIPoolETH.address);
        let daiBlanceAfter = await daiToken.balanceOf.call(buyerAccount);
        assert.equal(daiBlanceBefore.sub(daiBlanceAfter).toString(), premium.toString(), 'Premium is not sent from buyers account');
        assert.equal(poolBalanceAfter.sub(poolBalanceBefore).toString(), premium.toString(), 'Premium has not arrived to pool account');
        assert.equal((await unionDAIPoolETH.lockedPremium.call()).toString(), premium.toString(), 'Premium is not locked');

        console.log("DAI Spent ", daiBlanceBefore.sub(daiBlanceAfter).toString());

        let bal = await uUNNTokenInstance.balanceOf.call(buyerAccount);
        console.log("uUNN balance = ", bal.toString());
        let tokenID = await uUNNTokenInstance.tokenOfOwnerByIndex.call(buyerAccount, toBN(0));
        console.log("uUNN tokenID = ", tokenID.toString());
        let address = await uUNNTokenInstance.protectionContract.call(tokenID);
        console.log("uUNN tokenID address = ", address.toString());

        let ocProtectionContract = await OCProtections.at(address);

        let protectionData = await ocProtectionContract.getProtectionData.call(tokenID);
        console.log("id ,", tokenID.toString());
        console.log("strike ,", protectionData[2].toString());
        console.log("amount ,", protectionData[1].toString());
        console.log("premium ,", protectionData[3].toString());
        console.log("issedOn ,", protectionData[4].toString());
        console.log("validTo ,", protectionData[5].toString());
        console.log("poolAddress ,", protectionData[0].toString());

        await wait(20000);
        let res = await unionDAIPoolETH.unlockPremium.sendTransaction([tokenID], {
            from: buyerAccount
        });
        printEvents(res, "Unlock events");

        await printPoolStat(unionDAIPoolETH);
        const poolReserveBalanceAfterUnlock = await unionDAIPoolETH.poolReserveBalance.call();
        const foundationReserveBalanceAfterUnlock = await unionDAIPoolETH.foundationReserveBalance.call();

        console.log('foundationReserveBalanceAfterUnlock, poolReserveBalance after unlock', foundationReserveBalanceAfterUnlock.toString(), poolReserveBalanceAfterUnlock.toString())

        const poolReservePremiumPercentDenom = await unionDAIPoolETH.poolReservePremiumPercentDenom.call();
        const poolReservePremiumPercentNom = await unionDAIPoolETH.poolReservePremiumPercentNom.call();
        const foundationReservePremiumPercentNom = await unionDAIPoolETH.foundationReservePremiumPercentNom.call();
        const foundationReservePremiumPercentDenom = await unionDAIPoolETH.foundationReservePremiumPercentDenom.call();

        // uint256 poolReserveCommission = totalPremiumMatured.mul(poolReservePremiumPercentNom).div(poolReservePremiumPercentDenom);
        const totalPremiumMatured = premium;

        const poolReserveCommissionm = totalPremiumMatured * poolReservePremiumPercentNom / poolReservePremiumPercentDenom;
        console.log(poolReserveCommissionm)
        const correctPoolReserve = Number(poolReserveCommissionm) + Number(poolReserveBalanceBeforeUnlock);
        // uint256 foundationReserveCommission = totalPremiumMatured.mul(foundationReservePremiumPercentNom).div(foundationReservePremiumPercentDenom);
        const foundationReserveCommission = totalPremiumMatured * foundationReservePremiumPercentNom / foundationReservePremiumPercentDenom;
        const correctFoundationReserver = Number(foundationReserveCommission) + Number(foundationReserveBalanceBeforeUnlock);
        console.log(correctPoolReserve);
        console.log(poolReserveBalanceAfterUnlock);
        assert.equal(poolReserveBalanceAfterUnlock.toString(), correctPoolReserve.toString(), 'Invalid pool reverse balance');
        assert.equal(foundationReserveBalanceAfterUnlock.toString(), correctFoundationReserver.toString(), 'Invalid foundation reverse balance');
    });

    it('should withdraw fail amount 200 DAI', async () => {

        // Buy DAI from ETH
        await uniswapUtil.buyExactTokenWithEth.sendTransaction(daiTokenAddress, accounts[9], {
            from: accounts[9],
            value: toBN(2).mul(decimals)
        });

        const balanceDAI = await daiToken.balanceOf.call(accounts[9]);
        console.log(balanceDAI.toString(), 'xxxx balance')

        const daiDepositAmount = toBN(1000).mul(decimals);
        ///you deposit 1000 DAI into pool
        await approveToken(daiToken, accounts[9], unionDAIPoolETH.address);
        let depositRes = await deposit(unionDAIPoolETH, accounts[9], daiDepositAmount);
        console.log(`depositRes GasUsed: ${depositRes.receipt.gasUsed} `);

        /// you buy protection via OCProtections.create() and within this call you set MCR to 800 DAI. You can set mcrIncrement to 101, this way total MCR will reach 900 DAI.

        let validTo = Math.round((new Date().getTime() + 20000) / 1000);
        console.log(validTo, 'xxxx valid to')
        let currentPrice = await unionDAIPoolETH.getLatestPrice.call();
        strike = currentPrice.add(toBN(80).mul(toBN(1e8)));
        console.log("Strike ", strike.toString());
        let amount = toBN(10).mul(decimals);
        let tokenId = toBN(3);
        let premium = toBN(5).mul(decimals);
        let minPrice = currentPrice.sub(toBN(1000000));
        let mcr = toBN(800).mul(decimals); //  800 dai
        let mcrIncrement = toBN(101).mul(decimals); // 101
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let poolAddress = toBN(unionDAIPoolETH.address);


        let ardata = [tokenId, premium, minPrice, validTo, amount, strike, poolAddress, mcr, mcrBlockNumber, mcrIncrement, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);

        const signerIdentity = {
            privateKey: privateKey,
            publicKey: publicKeySigner,
            address: signerAddress
        }

        const publicKey = EthCrypto.publicKeyByPrivateKey(signerIdentity.privateKey);
        const magicAddress = EthCrypto.publicKey.toAddress(publicKey);
        console.log("Magic address: ", magicAddress);

        let message = [{
                type: "uint256",
                value: tokenId.toString()
            },
            {
                type: "uint256",
                value: premium.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: validTo.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: strike.toString()
            },
            {
                type: "uint256",
                value: poolAddress.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: mcrIncrement.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            },
        ];


        let messageHash = EthCrypto.hash.keccak256(message);
        let signature = EthCrypto.sign(signerIdentity.privateKey, messageHash);

        // const messageHash = EthCrypto.hash.keccak256(message);
        // const signature = EthCrypto.sign(signerIdentity.privateKey, messageHash);
        let allowed = await ocProtectionSeller.hasRole(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        await approveToken(daiToken, accounts[9], ocProtectionSeller.address);
        await buyProtection(ocProtectionSeller, unionDAIPoolETH.address, validTo, amount, strike, deadline, ardata, signature, accounts[9]);
        let withdrawAccount = accounts[9];
        let withdrawAccountBalanceBefore = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceBefore = ", withdrawAccountBalanceBefore.toString());

        let requestID = toBN(3);
        let wAmount = toBN(200).mul(decimals);
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        minPrice = currentPrice2.sub(toBN(10000000000));
        mcr = toBN(901).mul(decimals);
        block = await web3.eth.getBlock("latest");
        mcrBlockNumber = block.number;
        deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);


        //    [“29750700350367189057108846238”, “0", “166082777114”, “499772647804833900000", “8037341”, “1612828800"]
        // let requestID = toBN('29750700350367189057108846238');
        // let amount = toBN(0);
        // let minPrice = toBN('156082777114');
        // let mcr = toBN('499772647804833900000');
        // let mcrBlockNumber = toBN(8037341);
        // let deadline = toBN('1612828800');


        ardata = [requestID, wAmount, minPrice, mcr, mcrBlockNumber, deadline];

        // let requestID = data[0]; //withdrawal requestID, generated randomly by the backend. 
        // let amount = data[1]; //amount that user attempts to withdraw, provided by front-end.
        // let minPrice = data[2]; //min price that withdraw request is still valid;
        // let MCR = data[3]; // pool MCR as of "mcrBlockNumber"
        // let mcrBlockNumber = data[4];// a block number MCR was calculated at. 
        // let deadline = data[5]; // timestamp that withdraw request is valid until, in seconds. 


        message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: wAmount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];


        messageHash = EthCrypto.hash.keccak256(message);
        signature = EthCrypto.sign(signerIdentity.privateKey, messageHash);

        // const messageHash = EthCrypto.hash.keccak256(message);
        // const signature = EthCrypto.sign(signerIdentity.privateKey, messageHash);
        allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        await unionDAIPoolETH.setLockupPeriod.sendTransaction(toBN(1), {from: adminAddress});

        await withdrawData(unionDAIPoolETH, requestID, wAmount, ardata, signature, withdrawAccount);
    });

    it('should withdraw success amount 90 DAI', async () => {


        let withdrawAccount = accounts[9];
        let withdrawAccountBalanceBefore = await unionDAIPoolETH.balanceOf.call(withdrawAccount);
        console.log("withdrawAccountBalanceBefore = ", withdrawAccountBalanceBefore.toString());

        let requestID = toBN(3);
        let wAmount = toBN(90).mul(decimals);
        let currentPrice2 = await unionDAIPoolETH.getLatestPrice.call();
        let minPrice = currentPrice2.sub(toBN(10000000000));
        let mcr = toBN(901).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);

        let ardata = [requestID, wAmount, minPrice, mcr, mcrBlockNumber, deadline];

        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        let message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: wAmount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];
        
        let signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await unionDAIPoolETH.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        await unionDAIPoolETH.setLockupPeriod.sendTransaction(toBN(1), {from: adminAddress});
        let withdrawRes = await withdrawData(unionDAIPoolETH, requestID, wAmount, ardata, signature, withdrawAccount);
    });

    it('should get revenue', async () => {

        let depositor1 = accounts[6];
        let depositor2 = accounts[7];
        let daiDepositAmount = toBN(1000).mul(decimals);
        await uniswapUtil.buyExactTokenWithEth.sendTransaction(daiTokenAddress, depositor1, {
            from: depositor1,
            value: toBN(2).mul(decimals)
        });

        await uniswapUtil.buyExactTokenWithEth.sendTransaction(daiTokenAddress, depositor2, {
            from: depositor2,
            value: toBN(2).mul(decimals)
        });

        let depositor1DAIBalance = await daiToken.balanceOf.call(depositor1);
        console.log("Depositor1 = ", depositor1DAIBalance.toString());
        let depositor2DAIBalance = await daiToken.balanceOf.call(depositor2);
        console.log("Depositor2 = ", depositor2DAIBalance.toString());
        await approveToken(daiToken, depositor1, unionDAIPoolETHRevenueTest.address);
        await approveToken(daiToken, depositor2, unionDAIPoolETHRevenueTest.address);
        await deposit(unionDAIPoolETHRevenueTest, depositor1, daiDepositAmount);
        await deposit(unionDAIPoolETHRevenueTest, depositor2, daiDepositAmount);
        // function create(address pool, uint256 validTo, uint256 amount, uint256 strike, uint256 deadline, bytes memory data, bytes memory signature) public whenNotPaused returns (address){
        let validTo = Math.round((new Date().getTime() + 20000) / 1000);
        let currentPrice = await unionDAIPoolETHRevenueTest.getLatestPrice.call();
        strike = currentPrice.add(toBN(80).mul(toBN(1e8)));
        console.log("Strike ", strike.toString());
        let amount = toBN(1).mul(decimals);
        let tokenId = toBN(5);
        let premium = toBN(100).mul(decimals);
        let minPrice = currentPrice.sub(toBN(1000000));
        let mcr = toBN(500).mul(decimals);
        let mcrIncrement = toBN(200).mul(decimals);
        let block = await web3.eth.getBlock("latest");
        let mcrBlockNumber = block.number;
        let deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);
        let poolAddress = toBN(unionDAIPoolETHRevenueTest.address);
        console.log("PoolAddr num ", poolAddress.toString());

        let ardata = [tokenId, premium, minPrice, validTo, amount, strike, poolAddress, mcr, mcrBlockNumber, mcrIncrement, deadline];
        const privateKey = 'e3ad95aa7e9678e96fb3d867c789e765db97f9d2018fca4068979df0832a5178';
        let message = [{
                type: "uint256",
                value: tokenId.toString()
            },
            {
                type: "uint256",
                value: premium.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: validTo.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: strike.toString()
            },
            {
                type: "uint256",
                value: poolAddress.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: mcrIncrement.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            },
        ];

        let signature = await signMessage(message, privateKey);
        const publicKeySigner = EthCrypto.publicKeyByPrivateKey(privateKey);
        const signerAddress = EthCrypto.publicKey.toAddress(publicKeySigner);
        let allowed = await ocProtectionSeller.hasRole(web3.utils.keccak256('PROTECTION_PREMIUM_DATA_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        await approveToken(daiToken, depositor1, ocProtectionSeller.address);
        await buyProtection(ocProtectionSeller, unionDAIPoolETHRevenueTest.address, validTo, amount, strike, deadline, ardata, signature, depositor1);
        await wait(20000);
        const daiBalanceBeforeUnlock = await daiToken.balanceOf.call(depositor1);
        console.log("daiBalanceBeforeUnlock = ", daiBalanceBeforeUnlock.toString());
        let tokenID = await uUNNTokenInstance.tokenOfOwnerByIndex.call(depositor1, toBN(0));
        console.log("uUNN tokenID = ", tokenID.toString());
        let res = await unionDAIPoolETHRevenueTest.unlockPremium.sendTransaction([tokenID], {
            from: depositor1
        });
        printEvents(res, "Unlock events");
        let requestID = toBN(10);
        amount = toBN(1000).mul(decimals);
        currentPrice2 = await unionDAIPoolETHRevenueTest.getLatestPrice.call();
        minPrice = currentPrice2.sub(toBN(10000000000));
        mcr = toBN(500).mul(decimals);
        block = await web3.eth.getBlock("latest");
        mcrBlockNumber = block.number;
        deadline = Math.round((new Date().getTime() + (1 * 24 * 60 * 60 * 1000)) / 1000);

        ardata = [requestID, amount, minPrice, mcr, mcrBlockNumber, deadline];
        message = [{
                type: "uint256",
                value: requestID.toString()
            },
            {
                type: "uint256",
                value: amount.toString()
            },
            {
                type: "uint256",
                value: minPrice.toString()
            },
            {
                type: "uint256",
                value: mcr.toString()
            },
            {
                type: "uint256",
                value: mcrBlockNumber.toString()
            },
            {
                type: "uint256",
                value: deadline.toString()
            }
        ];
       
        signature = await signMessage(message, privateKey);
        const daiBalanceBeforeWithdraw = await daiToken.balanceOf.call(depositor1);
        allowed = await unionDAIPoolETHRevenueTest.hasRole(web3.utils.keccak256('MCR_PROVIDER'), signerAddress);
        console.log("allowed signature ", signerAddress, " ", allowed);
        //set timelock to 1 sec
        await unionDAIPoolETHRevenueTest.setLockupPeriod.sendTransaction(toBN(1), {from: adminAddress});
        let withdrawRes = await withdrawData(unionDAIPoolETHRevenueTest, requestID, amount, ardata, signature, depositor1);
        console.log(`withdraw GasUsed: ${withdrawRes.receipt.gasUsed} `);

        const daiBalanceAfterWithdraw = await daiToken.balanceOf.call(depositor1);

        console.log("daiBalanceAfterUnlock = ", daiBalanceAfterWithdraw.toString());
        console.log("diff = ", daiBalanceAfterWithdraw.sub(daiBalanceBeforeWithdraw).div(decimals).toString());
    });
});