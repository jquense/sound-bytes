'use strict';

exports.bufferEqual = function ( a, b ){
    if ( !Buffer.isBuffer(a) || !Buffer.isBuffer(b) ) return false 
    if ( a.length !== b.length ) return false 
    var i = 0;

    for(; i < a.length; ++i)
        if ( a[i] !== b[i] ) return false

    return true
}

exports.indexOf = function (buf, sub, fromIndex){
    var idx = fromIndex || 0
      , len = buf.length
      , chnkSize = sub.length;

    for (; idx < len; idx++ ){
        if ( exports.bufferEqual(buf.slice(idx, idx + chnkSize), sub) )
            return idx;    
    }

    return -1;
}
