//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "../openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import "./chainlink/AggregatorV3Interface.sol";
import "./interfaces/IPool.sol";
import "./pool/PoolUpgradable.sol";
import "./libraries/SignLib.sol";
import "./datatypes/StructuredLinkedList.sol";
import "./interfaces/IOCProtectionStorage.sol";

abstract contract UnionERC20Pool 
    is 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    PoolUpgradable,
    SignLib,
    IPool
    {

    using StructuredLinkedList for StructuredLinkedList.List;    

    //ACL
    //Manager is the person allowed to manage funds
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MCR_PROVIDER = keccak256("MCR_PROVIDER");

    address public poolReserveAddress;
    uint256 public poolReserveBalance;

    address public foundationReserveAddress;
    uint256 public foundationReserveBalance;

    uint8 public poolReservePremiumPercentNom;
    uint8 public poolReservePremiumPercentDenom;

    uint8 public foundationReservePremiumPercentNom;
    uint8 public foundationReservePremiumPercentDenom;

    address public excessLiquidityManagerAddress;

    uint8 public poolReserveExcessLiquidityPercentNom;
    uint8 public poolReserveExcessLiquidityPercentDenom;

    uint8 public foundationReserveExcessLiquidityPercentNom;
    uint8 public foundationReserveExcessLiquidityPercentDenom;

    uint256 public lockedPremium;
    uint256 public mcr;
    uint256 public totalMcrPending;
   
    uint64 public  mcrUpdatedBlockNumber;
    StructuredLinkedList.List mcrPendingsList;

    event PoolProtectionIssued(uint256 indexed id, uint256 premium, uint256 coverage, uint64 validTo);
    event PoolProtectionPremiumUnlocked(uint256 indexed id, uint256 premium);
    event PoolProtectionCoveragePaid(uint256 indexed id, uint256 coverage, address beneficiary);

    function __UnionERC20Pool_init(address admin, address _basicToken, string memory _description) internal initializer {
         __Pool_init(_basicToken,_description);
        __AccessControl_init_unchained();
        __Pausable_init_unchained();
        __UnionERC20Pool_init_unchained(admin);
    }

    function __UnionERC20Pool_init_unchained(address admin) internal initializer {

        //access control initial setup
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(OPERATOR_ROLE, admin);

        //default initial settings
        //Premium Distribution: PoolReserve-10%, FoundationReserve-10%, Writers-80%
        //10%
        poolReservePremiumPercentNom = 1;
        poolReservePremiumPercentDenom = 10;
        //10%
        foundationReservePremiumPercentNom = 1;
        foundationReservePremiumPercentDenom = 10;

        //Excess Liquidity Distribution: PoolReserve-40%, FoundationReserve-10%, Writers-50%
        //40%
        poolReserveExcessLiquidityPercentNom = 4;
        poolReserveExcessLiquidityPercentDenom = 10;
        //10%
        foundationReserveExcessLiquidityPercentNom = 1;
        foundationReserveExcessLiquidityPercentDenom = 10;
    }

    /**
    * @dev Throws if called by any account other than the one with the Operator role granted.
    */
    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Caller is not the Operator");
        _;
    }

    /**
    * @dev Throws if called by any account other than the one with the Admin role granted.
    */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
        _;
    }
    
    //admin operations:
    function setPoolReserveAddress (address _poolReserveAddress) public onlyAdmin {
        require(_poolReserveAddress != address(0), "Invalid address");
        poolReserveAddress = _poolReserveAddress;
    }

    function setFoundationReserveAddress (address _foundationReserveAddress) public onlyAdmin {
        require(_foundationReserveAddress != address(0), "Invalid address");
        foundationReserveAddress = _foundationReserveAddress;
    }

    function setPoolReservePremiumCommission (uint8 _nom, uint8 _denom) public onlyAdmin{
        require(_denom > 0,"Invalid denom");
        poolReservePremiumPercentNom = _nom;
        poolReservePremiumPercentDenom = _denom;
    }

    function setFoundationReservePremiumCommission (uint8 _nom, uint8 _denom) public onlyAdmin{
        require(_denom > 0,"Invalid denom");
        foundationReservePremiumPercentNom = _nom;
        foundationReservePremiumPercentDenom = _denom;
    }

    function setPoolReserveExcessLiquidityCommission (uint8 _nom, uint8 _denom) public onlyAdmin{
        require(_denom > 0,"Invalid denom");
        poolReserveExcessLiquidityPercentNom = _nom;
        poolReserveExcessLiquidityPercentDenom = _denom;
    }

    function setFoundationReserveExcessLiquidityCommission (uint8 _nom, uint8 _denom) public onlyAdmin{
        require(_denom > 0,"Invalid denom");
        foundationReserveExcessLiquidityPercentNom = _nom;
        foundationReserveExcessLiquidityPercentDenom = _denom;
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

    // public functions
    function withdrawPoolReserveCommission(uint256 amount) public onlyOperator {
        require(amount <= poolReserveBalance, "Amount to be less then external commission available to withdraw");
        poolReserveBalance = poolReserveBalance.sub(amount);
        basicToken.safeTransfer(poolReserveAddress, amount);
        
    }

    function withdrawFoundationReserveCommission(uint256 amount) public onlyOperator {
        require(amount <= foundationReserveBalance, "Amount to be less then external commission available to withdraw");
        foundationReserveBalance = foundationReserveBalance.sub(amount);
        basicToken.safeTransfer(foundationReserveAddress, amount);
        
    }

    function _distributeProfit(uint256 totalPremiumMatured) internal {

         //distribute unlocked premium
        uint256 poolReserveCommission = totalPremiumMatured.mul(poolReservePremiumPercentNom).div(poolReservePremiumPercentDenom);
        poolReserveBalance = poolReserveBalance.add(poolReserveCommission);

        uint256 foundationReserveCommission = totalPremiumMatured.mul(foundationReservePremiumPercentNom).div(foundationReservePremiumPercentDenom);
        foundationReserveBalance = foundationReserveBalance.add(foundationReserveCommission);

        totalCap = totalCap.add(totalPremiumMatured.sub(poolReserveCommission).sub(foundationReserveCommission));
    }

    function withdraw(uint256 _amount) external override{
        require(false, "standard withdraw method disabled. Please use another one");
    }

    function flushMCRPendingQueue(uint256 cycleAmount, uint256[2] memory data, bytes memory signature) public {
        address recovered = recoverSigner(keccak256(abi.encodePacked(data[0], data[1])), signature);
        require (hasRole(MCR_PROVIDER, recovered),"Data Signature invalid");
        uint256 newMCR = data[0];
        uint256 newMCRBlockNumber = uint64(data[1]);

        uint256 camt = cycleAmount>0?(cycleAmount<=mcrPendingsList.sizeOf()?cycleAmount:mcrPendingsList.sizeOf()):mcrPendingsList.sizeOf();

        _unloadMCRPendingQueue(camt, newMCRBlockNumber);

        if(newMCRBlockNumber > mcrUpdatedBlockNumber){
            mcrUpdatedBlockNumber = uint64(newMCRBlockNumber);
            mcr = newMCR;
        }

    }

    function getBasicToken() public override view returns (address){
        return address(basicToken);
    }
 
    // uint256 internal constant PRICE_DECIMALS = 1e8;
    function getBasicTokenDecimals() public override view returns (uint256){
        return 10**uint256(basicToken.decimals());
    }

    /**
    * returns total cap values for this contract: 
    * 1) totalCap value - total capitalization, including profits and losses, denominated in BasicTokens. i.e. total amount of BasicTokens that porfolio is worhs of.
    * 2) totalSupply of the TraderPool liquidity tokens (or total amount of trader tokens sold to Users). 
    * Trader token current price = totalCap/totalSupply;
    */
    function getTotalValueLocked() public view returns (uint256, uint256, uint256){
        return (totalCap, totalSupply(), lockedPremium);
    }

    function getPoolStat() public override view returns (uint256, uint256, uint256,uint256, uint256, uint64, uint256){
        return (totalCap,
                totalSupply(),
                lockedPremium,
                mcr,
                totalMcrPending,
                mcrUpdatedBlockNumber,
                mcrPendingsList.sizeOf());
    }

    function _updateMCR(uint256 newMCR, uint256 newMCRBlockNumber, uint256 mcrIncrement) internal {

        //unload mcrPendings
       _unloadMCRPendingQueue(mcrPendingsList.sizeOf(),newMCRBlockNumber);

        if(newMCRBlockNumber > mcrUpdatedBlockNumber){
        //   emit MCRUpdated(mcr,mcrUpdatedBlockNumber,newMCR,uint64(newMCRBlockNumber));
            mcrUpdatedBlockNumber = uint64(newMCRBlockNumber);
            mcr = newMCR;
            
        }

        //add new mcrPending
        if(mcrIncrement > 0){
            uint256 item = (mcrIncrement<<64).add(block.number & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF);
            mcrPendingsList.pushBack(item);
            totalMcrPending = totalMcrPending.add(mcrIncrement);
            // emit TestEvent(item, mcrIncrement, uint64(block.number), "Added");
        }

        require(mcr.add(totalMcrPending) < totalCap, "MCR exceeded totalCap, cannot issue protections or withdraw capital");

    }

    function _unloadMCRPendingQueue(uint cyclesAmount, uint256 newMCRBlockNumber) private {
        for (uint i=0;i<cyclesAmount;i++){
            uint256 item = mcrPendingsList.head();
            uint64 blockNumber = uint64(item & 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF);
            if(blockNumber <= newMCRBlockNumber){
                //delete item, subtract from totalMCRPending;
                uint256 mcrPending = item >> 64;
                totalMcrPending = totalMcrPending.sub(mcrPending);
                mcrPendingsList.remove(item);
            }else {
                break;
            }
        }
    }

    function _beforeDeposit(uint256 amountTokenSent, address sender, address holder) internal virtual override {
        require(!paused(), "Cannot deposit when paused");
    }

    function _beforeWithdraw(uint256 amountLiquidity, address holder, address receiver) internal virtual override {
        require(!paused(), "Cannot withdraw when paused");
        uint256 revenue = totalSupply() > 0 ? amountLiquidity.mul(totalCap).div(totalSupply()) : 0;
        require (totalCap.sub(revenue) > mcr.add(totalMcrPending), "Cannot withdraw due to MCR level required");
    }

    uint256[10] private __gap; 

}
