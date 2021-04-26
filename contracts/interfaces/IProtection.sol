//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------


pragma solidity >=0.6.2 <0.8.0;

interface IProtection{
    function getPool(uint256 _index) external view returns (address, uint16);
    function getPoolsLength() external view returns (uint256);
    function getPoolsTotalShare() external view returns (uint32);
    function version() external view returns (uint256);
}