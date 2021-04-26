//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------


pragma solidity >=0.6.2 <0.8.0;

interface IParamStorage{
    function getAddress(uint16 key) external view returns (address);
    function getUInt256(uint16 key) external view returns (uint256);
}