//---------------------------------------------------
// Copyright (c) 2020-2021 Union Protocol Foundation
// SPDX-License-Identifier: GPL-2.0-or-later
//---------------------------------------------------

pragma solidity >=0.6.12;

import "../openzeppelin-contracts-upgradeable/contracts/token/ERC721/ERC721PausableUpgradeable.sol";
import "../openzeppelin-contracts-upgradeable/contracts/access/AccessControlUpgradeable.sol";
import "./interfaces/IUUNNRegistry.sol";

contract uUNNToken is AccessControlUpgradeable, ERC721PausableUpgradeable, IUUNNRegistry
{
    bytes32 public constant PROTECTION_FACTORY_ROLE = keccak256("PROTECTION_FACTORY_ROLE");

    mapping(uint256 => address) protectionContracts;
    mapping(uint256 => bool) maturedProtections;
    
    function __uUNNToken_init(address _admin) internal initializer {
        __ERC721Pausable_init();
        __AccessControl_init_unchained();
        __ERC721_init_unchained("uUNN Token", "uUNN");
        __uUNNToken_init_unchained(_admin);
    }

    function __uUNNToken_init_unchained(address _admin) internal initializer {
        //access control initial setup
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function initialize(address _admin) public initializer {
        __uUNNToken_init(_admin);
    }

    function version() public view returns (uint32){
        //version in format aaa.bbb.ccc => aaa*1E6+bbb*1E3+ccc;
        return uint32(1010000);
    }

    /**
    * @dev Throws if called by any account other than the one with the Admin role granted.
    */
    modifier onlyAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not the Admin");
        _;
    }

    modifier onlyProtectionFactory() {
        require(hasRole(PROTECTION_FACTORY_ROLE, msg.sender), "Caller is not the protection factory");
        _;
    }

    function setBaseURI(string memory _baseURI) public onlyAdmin{
        _setBaseURI(_baseURI);
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

    function protectionContract(uint256 tokenId) public override view returns (address){
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");
        return protectionContracts[tokenId];
    }

    function mint(uint256 tokenId, address protectionContract, address to) public override onlyProtectionFactory{
        _safeMint(to, tokenId);
        protectionContracts[tokenId] = protectionContract;
    }   

    function burn(uint256 tokenId) external override {
        address protectionContract = protectionContracts[tokenId];
        require(msg.sender == protectionContract, "Only protection contract can burn it's token");
        _burn(tokenId);
        delete protectionContracts[tokenId];
    }

}
