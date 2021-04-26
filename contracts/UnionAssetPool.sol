//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "./chainlink/AggregatorV3Interface.sol";
import "./UnionERC20Pool.sol";
import "./interfaces/IPool.sol";

contract UnionAssetPool is UnionERC20Pool, IAssetPool {

    //version 1002001
    uint32 public storageversion;
    AggregatorV3Interface public priceFeed;
    bool public priceFeedReverse;
    IOCProtectionStorage internal ocProtectionStorage;
    //version 1002002
    uint256 public lockupPeriod;
    mapping(address => uint256) private lastProvideTimestamp;
    //version 1002004
    address private assetToken;

    function version() public override view returns (uint32){
        //version in format aaa.bbb.ccc => aaa*1E6+bbb*1E3+ccc;
        return uint32(1010000);
    }

     /**
    * returns the data of the Writer:
    *    1) current amount of pUNN liquidity tokens that User has on the balance.
    *    2) last deposit timestamp (sec)
    *    3) timestamp that withdrawal will be unlocked (sec)
    * @param _writer - address of the Writer's wallet. 
     */
    function getWriterDataExtended(address _writer) public override view returns (uint256, uint256, uint256) {
        return (balanceOf(_writer), lastProvideTimestamp[_writer], lastProvideTimestamp[_writer].add(lockupPeriod));
    }

    function getAssetToken() public override view returns(address){
        return assetToken;
    }

    function getAssetTokenDecimals() public override view returns (uint256){
        return 10**uint256(IERC20Token(assetToken).decimals());
    }
    
    function initialize(address admin, address _basicToken, address _assetToken, address _ocProtections, address _priceFeed, bool _priceFeedReverse, string memory _description) public initializer{
        require(admin != address(0), "Incorrect admin address");
        require(_basicToken != address(0), "Incorrect _basicToken address");
        require(_assetToken != address(0), "Incorrect _assetToken address");
        require(_ocProtections != address(0), "Incorrect _ocProtections address");
        require(_priceFeed != address(0), "Incorrect _priceFeed address");

        __UnionERC20Pool_init(admin,_basicToken,_description);
        storageversion = uint32(version());

        priceFeed = AggregatorV3Interface(_priceFeed);
        priceFeedReverse = _priceFeedReverse;
 
        ocProtectionStorage = IOCProtectionStorage(_ocProtections);

        lockupPeriod = 1 days;

        assetToken = _assetToken;
    }

    function setLockupPeriod(uint256 value) external onlyAdmin {
        lockupPeriod = value;
    }

    modifier onlyOCProtection() {
        require(msg.sender == address(ocProtectionStorage), "Caller is not the OCProtections");
        _;
    }

    function onProtectionPremium(address buyer,  uint256[7] memory data) public override onlyOCProtection {
        //data =[uint256 _id, uint256 _premium, uint256 _coverage, uint64 _validTo, uint256 newMCR, uint256 newMCRBlockNumber, uint256 mcrIncrement]
        uint256 _id = data[0];
        require (data[2] > 0, "Invalid coverage");
        require (data[1] > 0, "Invalid premium");
        require (data[3] > block.timestamp, "Invalid _validto parameter");
        //update MCR before issuing protection
        _updateMCR(data[4], data[5], data[6]);

        basicToken.safeTransferFrom(buyer, address(this), data[1]); 
        lockedPremium = lockedPremium.add(data[1]);
        emit PoolProtectionIssued(_id, data[1], data[2], uint64(data[3]));
    }

    function unlockPremium(uint256[] calldata _ids) public override {
        uint256 totalPremiumMatured = 0;        

        for(uint i=0;i<_ids.length;i++){
            // (address pool, uint256 amount, uint256 strike, uint256 premium, uint64 issuedOn, uint64 validTo) = ocProtectionStorage.getProtectionData(_ids[i]);
            (, , , uint256 premium, , uint validTo) = ocProtectionStorage.getProtectionData(_ids[i]);
            if(validTo < block.timestamp && premium > 0){
                ocProtectionStorage.withdrawPremium(_ids[i], premium);
                totalPremiumMatured = totalPremiumMatured.add(premium);
                emit PoolProtectionPremiumUnlocked(_ids[i],premium);
                // delete protections[_ids[i]];
            }
        }

        require(lockedPremium >= totalPremiumMatured, "Pool Error: trying to unlock too much. Something went very wrong...");
        lockedPremium = lockedPremium.sub(totalPremiumMatured);

        _distributeProfit(totalPremiumMatured);
    }

    function onPayoutCoverage(uint256 _id, uint256 _premiumToUnlock, uint256 _coverageToPay, address _beneficiary) external override onlyOCProtection returns (bool){
        lockedPremium = lockedPremium.sub(_premiumToUnlock);
        totalCap = totalCap.add(_premiumToUnlock);
        emit PoolProtectionPremiumUnlocked(_id,_premiumToUnlock);

        totalCap = totalCap.sub(_coverageToPay);
        basicToken.safeTransfer(_beneficiary, _coverageToPay);
        emit PoolProtectionCoveragePaid(_id, _coverageToPay, _beneficiary);
        //decrease pool capital
        return true;
    }

    /**
    * converts spefied amount of Liquidity tokens to Basic Token and returns to user (withdraw). The balance of the User (msg.sender) is decreased by specified amount of 
    * Liquidity tokens. Resulted amount of tokens are transferred to msg.sender
    * @param _requestID - request ID generated on the backend (for reference)
    * @param _amount - amount of liquidity to be withdrawn
    * @param _data - data package with withdraw quotation. The package structure provided below: 
    *       _data[0] = requestID - request ID generated on the backend (for reference)
    *       _data[1] = amount - amount of liquidity to be withdrawn
    *       _data[2] = minPrice - minimum asset price qutation is valid until (i.e. current asset price as of transaction execution to be greater than minPrice)
    *       _data[3] = mcr - MCR value as of mcrBlockNumber
    *       _data[4] = mcrBlockNumber - a block number MCR was calculated for
    *       _data[5] = deadline - operation deadline, timestamp in seconds
    * @param _signature - _data package signature that will be validated against whitelisted key.
    */
    function withdrawWithData(uint256 _requestID, uint256 _amount, uint256[6] memory _data, bytes memory _signature) external{
        require(lastProvideTimestamp[msg.sender].add(lockupPeriod) <= now, "Withdrawal is locked up");
        uint256 newMCR;
        uint64 newMCRBlockNumber;
        {
     
            // let requestID = data[0]; //withdrawal requestID, generated randomly by the backend. 
            // let amount = data[1]; //amount that user attempts to withdraw, provided by front-end.
            // let minPrice = data[2]; //min price that withdraw request is still valid;
            // let MCR = data[3]; // pool MCR as of "mcrBlockNumber"
            // let mcrBlockNumber = data[4];// a block number MCR was calculated at. 
            // let deadline = data[5]; // timestamp that withdraw request is valid until, in seconds. 
            
            address recovered = recoverSigner(keccak256(abi.encodePacked(_data[0], _data[1], _data[2], _data[3], _data[4], _data[5])), _signature);
            require (hasRole(MCR_PROVIDER, recovered),"Data Signature invalid");
            require (_requestID == _data[0], "Incorrect data package (_requestID)");
            require (_amount == _data[1], "Incorrect data package (_amount)");
            require (getLatestPrice() >= _data[2], "Asset current spot price went below minimum price allowed. Withdraw quotaion is no longer valid. Please try again in a while");
            require (block.timestamp <= _data[5], "quotation expired");

            newMCR = _data[3];
            newMCRBlockNumber = uint64(_data[4]);
        }

        //MCR & update MCR
        _updateMCR(newMCR,newMCRBlockNumber,0);

        _withdraw(_amount, msg.sender);
    }

    function getLatestPrice() public override view returns (uint256) {
        (
            uint80 roundID, 
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        uint currentPrice = uint(price);
        if(priceFeedReverse){
            currentPrice = (10**uint256(priceFeed.decimals())).mul(1E8).div(currentPrice);
        }
        return currentPrice;
    }

    // uint256 internal constant PRICE_DECIMALS = 1e8;
    function getPriceDecimals() public override view returns (uint256){
        return priceFeedReverse?1E8:10**uint256(priceFeed.decimals());
    }

    function _beforeTokenTransfer(address from, address, uint256) internal override {
        require(lastProvideTimestamp[from].add(lockupPeriod) <= now, "Withdrawal is locked up");
    }

    function _afterDeposit(uint256 amountTokenSent, uint256 amountLiquidityGot, address sender, address holder) internal override {
        super._afterDeposit(amountTokenSent, amountLiquidityGot, sender, holder);
        lastProvideTimestamp[holder] = now;
    }

}
