var util = require("util")
  , Transform = require('stream').Transform
  , Pipe = require('stream').PassThrough
  , binary = require('./binaryHelpers')
  , ID3v2Parser = require('id3v2-parser')
  , ID3v1Parser = require('id3v1-parser')
  , FrameParser = require('mpeg-frame-parser')
  , _ = require('lodash');

var mpegFrameKeys = [ 'bitRate', 'sampleRate', 'mode', 'channels', 'layer', 'version' ]
  , syncWord =  new Buffer('ID3');

util.inherits(MpegParser, Transform)

module.exports = MpegParser

function MpegParser(size, opts) {
    var self = this;

    Transform.call(this, _.defaults({ objectMode: true }, opts || {}))

    this.frameParser = new FrameParser();
    this.size = size;

    this.frameParser
        .on('error', this.emit.bind(this, 'error') )
        .once('readable', function(){
            var frame = self.frame = this.read();

            self.state.framesFound = true;
            self._bytesTilFirstFrame = this.bytesRead

            if ( self.size )
                self.push({
                    type: 'duration',
                    value: duration(self._bytesTilFirstFrame, frame.bitRate, self.size)
                });

            _.each( mpegFrameKeys, function(key){
                self.push({ type: key, value: frame[key] })
            });
        })
}


MpegParser.prototype._transform = function(chunk, enc, done){
    var state = this.state
      , needed = 0, finished = 0
      , idx = state.isID3v2 ? -1 : binary.indexOf(chunk, syncWord);

    if ( idx !== -1) {
        state.isID3v2 = true
        this.tagParser = this.v2parser()

        chunk = idx === 0
            ? chunk
            : chunk.slice(idx)
    }

    if ( !state.framesFound ) {
        needed++
        this.frameParser.write( chunk, enc, cont );
    }

    if ( state.isID3v2 ) {
        needed++
        this.tagParser.write(chunk , enc, cont)
    }

    state.bytesRead = (state.bytesRead || 0) + chunk.length
    state.lastChunk = chunk;

    if (needed === 0 ) done();

    function cont() {
        if ( ++finished === needed) done()
    }
}

MpegParser.prototype._flush = function(done) {
    var self = this
      , state = self.state
      , tags;

    if ( !this.size && this.frame )
        this.push({
            type: 'duration',
            value: duration(self._bytesTilFirstFrame, self.frame.bitRate, state.bytesRead)
        });

    if ( !state.isID3v2) {
        try {
            tags = ID3v1Parser.parseTags( state.lastChunk.slice( state.lastChunk.length - 128 ) );

            _.each(tags, function(tag, key){
                self.push({ type: key, value: tag })
            })

            self.push(null);
        }
        catch ( err ) {
            if ( err.type !== 'AudioInfoNotFoundError') self.emit('error', err)
        }
    }
}

MpegParser.prototype.v2parser = function() {
    var self = this
      , parser = new ID3v2Parser();

    parser.on('data', self.push.bind(self))
        .on('error',  self.emit.bind(self, 'error'))
        .on('end',  function(){
            self.state.tagsFound = true;
            self.tryFinish();
        });

    return parser;
}


MpegParser.prototype.tryFinish = function() {
    var state = this.state;

    if ( state.framesFound && state.tagsFound )
        this.push(null);
}

function duration(byteToFirstFrame, bitRate, fileSize ) {
    return Math.floor((fileSize - byteToFirstFrame) / ( bitRate / 8)) || 0;
};

