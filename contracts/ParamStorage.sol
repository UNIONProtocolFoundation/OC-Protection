//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "../openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "./interfaces/IParamStorage.sol";

contract ParamStorage is AccessControlUpgradeable, IParamStorage{

  bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

  //address params storage
  mapping (uint16 => address) public addressParams;
  //uint params storage
  mapping (uint16 => uint256) public uintParams;
  
  function initialize(address admin) public initializer{
        __AccessControl_init();


        //access control initial setup
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(MANAGER_ROLE, admin);
  }

  /**
  * @dev Throws if called by any account other than the one with the Manager role granted.
  */
  modifier onlyManager() {
      require(hasRole(MANAGER_ROLE, msg.sender), "Caller is not the Manager");
      _;
  }

  function setParamAddress(uint16 _key, address _value) public onlyManager {
    addressParams[_key] = _value;
  }

  function setParamUInt256(uint16 _key, uint256 _value) public onlyManager {
    uintParams[_key] = _value;
  }

  function getAddress(uint16 key) external override view returns (address){
    return addressParams[key];
  }

  function getUInt256(uint16 key) external override view returns (uint256){
    return uintParams[key];
  }

}
