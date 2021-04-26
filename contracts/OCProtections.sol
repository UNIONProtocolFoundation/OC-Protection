//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "../openzeppelin-contracts-upgradeable/contracts/proxy/Initializable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/math/SafeMathUpgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/token/ERC20/IERC20Upgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/token/ERC20/SafeERC20Upgradeable.sol";

import "./interfaces/IUUNNRegistry.sol";
import "./interfaces/IPool.sol";
import "./interfaces/IOCProtectionSeller.sol";
import "./interfaces/IOCProtectionStorage.sol";
import "./libraries/SignLib.sol";


contract OCProtections is Initializable, AccessControlUpgradeable, PausableUpgradeable, SignLib, IOCProtectionSeller, IOCProtectionStorage{

    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IUUNNRegistry private uunn;

    bytes32 public constant PROTECTION_PREMIUM_DATA_PROVIDER = keccak256("PROTECTION_PREMIUM_DATA_PROVIDER");//premium provider
    uint32 storageVersion;

    struct OCProtectionData {
        IAssetPool pool;
        uint256 timelimits; //IssuedOn_ValidTo
        uint256 amount;
        uint256 strike;
        uint256 premium;
        uint256 coveragePaid;
    }

    mapping(uint256 => OCProtectionData) internal protections;

    event OCProtectionCreated(address indexed receiver, uint256 tokenId, address pool, uint256 amount, uint256 strike, uint issuedOn, uint validTo, uint256 premium, uint256 currentPrice);
    event Exercised(uint256 indexed id, uint256 amount, uint256 profit);
    
    function version() public override view returns (uint32){
        //version in format aaa.bbb.ccc => aaa*1E6+bbb*1E3+ccc;
        return uint32(1010000);
    }

    function initialize(address _admin, address _uunn) public initializer{
        __AccessControl_init();
        __Pausable_init_unchained();
        uunn = IUUNNRegistry(_uunn);
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        storageVersion = version();
    }

    /**
    * @dev Throws if called by any account other than the one with the Admin role granted.
    */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
        _;
    }

    /**
    * set contract on hold. Paused contract doesn't accepts Deposits but allows to withdraw funds. 
     */
    function pause() onlyAdmin public {
        super._pause();
    }
    /**
    * unpause the contract (enable deposit operations)
     */
    function unpause() onlyAdmin public {
        super._unpause();
    }

    /** buy protection function. Creates protection ERC721 token and funds appropriate pool with premium. 
    * @param pool - pool that will be used for backing protection
    * @param validTo - the protection requested validTo timestamp in seconds
    * @param amount - the underlying protected asset amount (with appropriate decimals)
    * @param strike - requsted asset strike price
    * @param deadline - operation deadline in seconds
    * @param data - data package with withdraw quotation. The package structure provided below: 
    *       data[0] = tokenid - protection ERC721 token identifier (UUID)
    *       data[1] = premium - amount of premium tokens to be transferred to pool (protection cost)
    *       data[2] = minPrice - minimum asset price qutation is valid until (i.e. current asset price as of transaction execution to be greater than minPrice)
    *       data[3] = validTo - protection validTo parameter, timestamp (protection will be valid until this timestamp)
    *       data[4] = amount - the underlying protected asset amount (with appropriate decimals)
    *       data[5] = strike - protection asset strike price
    *       data[6] = poolAdress - address of the underlying pool, that will be backing the protection
    *       data[7] = mcr - MCR value as of mcrBlockNumber
    *       data[8] = mcrBlockNumber - a block number MCR was calculated for
    *       data[9] = mcrIncrement - an MCR increment. The amount of capital has to be reserved under MCR to cover this individual protection (that will be issued within transaction)
    *       data[10] = deadline - operation deadline, timestamp in seconds
    * @param signature - data package signature that will be validated against whitelisted key.
    */
    function create(address pool, uint256 validTo, uint256 amount, uint256 strike, uint256 deadline, uint256[11] memory data, bytes memory signature) public override whenNotPaused returns (address){
        return createTo(pool, validTo, amount, strike,deadline, data, signature, msg.sender);
    }


    /** buy protection function. Creates protection ERC721 token and funds appropriate pool with premium. Protection token is assigned in address of erc721Receiver
    * @param pool - pool that will be used for backing protection
    * @param validTo - the protection requested validTo timestamp in seconds
    * @param amount - the underlying protected asset amount (with appropriate decimals)
    * @param strike - requsted asset strike price
    * @param deadline - operation deadline in seconds
    * @param data - data package with withdraw quotation. The package structure provided below: 
    *       data[0] = tokenid - protection ERC721 token identifier (UUID)
    *       data[1] = premium - amount of premium tokens to be transferred to pool (protection cost)
    *       data[2] = minPrice - minimum asset price qutation is valid until (i.e. current asset price as of transaction execution to be greater than minPrice)
    *       data[3] = validTo - protection validTo parameter, timestamp (protection will be valid until this timestamp)
    *       data[4] = amount - the underlying protected asset amount (with appropriate decimals)
    *       data[5] = strike - protection asset strike price
    *       data[6] = poolAdress - address of the underlying pool, that will be backing the protection
    *       data[7] = mcr - MCR value as of mcrBlockNumber
    *       data[8] = mcrBlockNumber - a block number MCR was calculated for
    *       data[9] = mcrIncrement - an MCR increment. The amount of capital has to be reserved under MCR to cover this individual protection (that will be issued within transaction)
    *       data[10] = deadline - operation deadline, timestamp in seconds
    * @param signature - data package signature that will be validated against whitelisted key.
    * @param erc721Receiver - address of the Protection ERC721 token receiver. 
    */
    function createTo(address pool, uint256 validTo, uint256 amount, uint256 strike, uint256 deadline, uint256[11] memory data, bytes memory signature, address erc721Receiver) public override whenNotPaused returns (address){
        
        address recovered = recoverSigner(keccak256(abi.encodePacked(data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7], data[8], data[9], data[10])), signature);
        //tokenID, premium, validTo, amount, strike, current price
        uint256[6] memory ocdata = [data[0],data[1],validTo,amount,strike, IAssetPool(pool).getLatestPrice()];
        {
            
            require (hasRole(PROTECTION_PREMIUM_DATA_PROVIDER, recovered),"Data Signature invalid");
            require (ocdata[2] == data[3], "Incorrect data package (period)");
            require (ocdata[3] == data[4], "Incorrect data package (amount)");
            require (ocdata[4] == data[5], "Incorrect data package (strike)");
            require (uint256(uint160(pool)) == data[6], "Incorrect data package (pool)");
            require (ocdata[5] >= data[2], "Asset current spot price went below minimum price allowed. Buy quotaion is no longer valid. Please try again in a while");
            require (block.timestamp <= data[10], "quotation expired");
            
            // send premium to the pool contract
            IERC20Upgradeable(IPool(pool).getBasicToken()).safeTransferFrom(msg.sender, address(this), ocdata[1]);
            IERC20Upgradeable(IPool(pool).getBasicToken()).safeApprove(pool, ocdata[1]);
            uint256 coverage = ocdata[4].mul(ocdata[3]).div(IAssetPool(pool).getPriceDecimals());
            //register protection in pool
            IAssetPool(pool).onProtectionPremium(address(this), [data[0],data[1],coverage,data[3],data[7],data[8],data[9]]);
        }

        {
            uint256 timelimits = (block.timestamp << 64).add(ocdata[2]);
            protections[ocdata[0]] = OCProtectionData(IAssetPool(pool),timelimits,ocdata[3],ocdata[4], ocdata[1], 0);
            uunn.mint(ocdata[0], address(this), erc721Receiver);

        }

        emit OCProtectionCreated(erc721Receiver, ocdata[0], pool, ocdata[3], ocdata[4], now, ocdata[2], ocdata[1], ocdata[5]);

        return address(this);

    }

    function withdrawPremium(uint256 _id, uint256 _premium) external override {
        require (msg.sender == address(protections[_id].pool) && msg.sender != address(0),"Premium can be withdrawn by backed pool only");
        require (protections[_id].premium >= _premium, "Not enough premium left");
        protections[_id].premium = protections[_id].premium.sub(_premium);
    }

    function exercise(uint256 _id, uint256 _amount) public {
        require(msg.sender == uunn.ownerOf(_id), "Caller is not the Owner of Protection");
        uint256 validTo = protections[_id].timelimits & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF;
        require (now <= validTo,"Protection expired");
        require(_amount <= protections[_id].amount,"Amount too high");
        // uint priceDecimals = protections[_id].pool.getPriceDecimals();
        // uint256 basicTokenDecimals = protections[_id].pool.getBasicTokenDecimals();
        // uint256 assetTokenDecimals = protections[_id].pool.getAssetTokenDecimals();
        uint currentPrice = protections[_id].pool.getLatestPrice(); 

        require(protections[_id].strike >= currentPrice, "Current price is too high");
        uint256 profit = protections[_id].strike.sub(currentPrice).mul(_amount).div(protections[_id].pool.getPriceDecimals());
        profit = profit.mul(protections[_id].pool.getBasicTokenDecimals()).div(protections[_id].pool.getAssetTokenDecimals());


        uint256 premiumToUnlock = profit < protections[_id].premium ? profit : protections[_id].premium;
        protections[_id].premium = protections[_id].premium.sub(premiumToUnlock);
        
        require(protections[_id].pool.onPayoutCoverage(_id, premiumToUnlock, profit, msg.sender), "Error doing coverage payout");

        protections[_id].amount = protections[_id].amount.sub(_amount);
        emit Exercised(_id, _amount, profit);
    }

    /** returns individual C-OP data for the protection specified by id
    * @param id - protection tokenID
    * @return tuple 
    *  (
    *   [0] = protection underlying pool address,    
    *   [1] = protected asset amount
    *   [2] = asset strike price
    *   [3] = protection premium 
    *   [4] = protection issuedOn timestamp
    *   [5] = protection validTo timestamp
    *  )
    */
    function getProtectionData(uint256 id) public override view returns (address, uint256, uint256, uint256, uint, uint){
        return (
            address(protections[id].pool),
            protections[id].amount,
            protections[id].strike,
            protections[id].premium,
            (protections[id].timelimits >> 64) & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF,
            protections[id].timelimits & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF
        );
    }
  
}
