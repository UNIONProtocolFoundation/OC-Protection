pragma solidity >=0.6.6;


contract TestSign {

    event TestSign(uint256 a, uint256 b,uint256 c, uint256 d,uint256 e, uint256 f, address or, bytes32 message);
    

   function createTo(uint256 validTo, uint256 amount, uint256 strike, uint256[6] memory data, bytes memory signature) public {
        //tokenID, premium, validTo, amount, strike
        uint256[5] memory ocdata = [0,0,validTo,amount,strike];
        
        {
            uint256 minPrice;
            uint256 strikeData;
            uint256 validToData= data[0];
            uint256 amountData = data[1];
            // ocdata[0] = uunn.totalSupply().add(1);
            // ocdata[1] = (uint256(50)).mul(1E18);


            // (ocdata[0], ocdata[1], minPrice, strikeData, validToData, amountData) = abi.decode(bodata, (uint256, uint256,uint256, uint256,uint256, uint256));

            bytes32 message = keccak256(abi.encodePacked(data[0], data[1], data[2], data[3], data[4], data[5]));

            address recovered = recoverSigner(message, signature);
            // address recovered = address(0);

            emit TestSign(ocdata[0], ocdata[1],minPrice,strikeData,validToData,amountData, recovered,message);


        }
    }

    function recoverSigner(bytes32 message, bytes memory sig)
       public
       pure
       returns (address)
    {
       uint8 v;
       bytes32 r;
       bytes32 s;

       (v, r, s) = splitSignature(sig);
       return ecrecover(message, v, r, s);
    }

    function splitSignature(bytes memory sig)
       public
       pure
       returns (uint8, bytes32, bytes32)
     {
       require(sig.length == 65,"Incorrect signature length");
       
       bytes32 r;
       bytes32 s;
       uint8 v;

       assembly {
           // first 32 bytes, after the length prefix
           r := mload(add(sig, 32))
           // second 32 bytes
           s := mload(add(sig, 64))
           // final byte (first byte of the next 32 bytes)
           v := byte(0, mload(add(sig, 96)))
       }

       return (v, r, s);
     }

        
    

}