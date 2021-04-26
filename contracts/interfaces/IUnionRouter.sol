//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------


pragma solidity >=0.6.2 <0.8.0;

interface IUnionRouter{
    function collateralProtection(address token) external view returns (address, address); //returns (IOCProtections,IPool)
    function uunnToken() external view returns (address); //returns IUUNNRegistry
}