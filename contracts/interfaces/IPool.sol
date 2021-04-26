//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------


pragma solidity >=0.6.2 <0.8.0;

interface IPool{
    function unlockPremium(uint256[] calldata _ids) external;
    function getBasicToken() external view returns (address);
    function getBasicTokenDecimals() external view returns (uint256);
    function getPoolStat() external view returns (uint256, uint256, uint256,uint256, uint256, uint64, uint256);
    function version() external view returns (uint32);
}

interface IAssetPool is IPool{
    function onPayoutCoverage(uint256 _id, uint256 _premiumToUnlock, uint256 _coverageToPay, address _beneficiary) external returns (bool);
    function onProtectionPremium(address buyer,  uint256[7] memory data)  external; 
    function getLatestPrice() external view returns (uint256);
    function getPriceDecimals() external view returns (uint256);
    function getAssetToken() external view returns(address);
    function getAssetTokenDecimals() external view returns (uint256);
    function getWriterDataExtended(address _writer) external view returns (uint256, uint256, uint256);
}