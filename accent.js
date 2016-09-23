function accent(){

  waitForLoadAndMedia(function(media, context) {
    document.body.parentElement.onclick = function() {
      var startTime = Date.now();
      console.log('playing...');
      playClip(context, function() {
        var endTime = Date.now();

        console.log('recording...');
        recordClip(
          media, context, (endTime - startTime)/1000,
          function(sourceBuf) {
            console.log('replaying recording...');
            playRecordingClip(context, sourceBuf, function() {
              console.log('finished now');
            });
          });
      });

    };
  }, function(error) {
    console.error(error);
    alert(error);
  });

  function waitForLoadAndMedia(callback, errorCallback) {
    var loaded = typeof therain!=='undefined' && !!therain,
        media, context;

    if (!loaded) {
      window.addEventListener('load', function() {
        loaded = true;
        if (loaded && media && context) {
          callback(media, context);
        }
      }, false);
    }

    withMedia(function (_media, _context) {
      media = _media;
      context = _context;
      if (loaded && media && context) {
        callback(media, context);
      }
    }, errorCallback);
  }

  function createAudioContext() {
    var context =
      window.AudioContext ? new AudioContext() :
      window.webkitAudioContext ? new webkitAudioContext() :
      window.msAudioContext ? new msAudioContext() :
      window.oAudioContext ? new oAudioContext() :
      window.mozAudioContext ? new mozAudioContext() :
      null;
    return context;
  }

  function withMedia(successCallback, errorCallback) {
    function callback(media) {
      var context = createAudioContext();
      successCallback(media, context);
    }

    navigator.getUserMedia ? navigator.getUserMedia({audio: true}, callback, errorCallback) :
    navigator.webkitGetUserMedia ? navigator.webkitGetUserMedia({audio: true}, callback, errorCallback) :
    navigator.msGetUserMedia ? navigator.msGetUserMedia({audio: true}, callback, errorCallback) :
    navigator.oGetUserMedia ? navigator.oGetUserMedia({audio: true}, callback, errorCallback) :
    navigator.mozGetUserMedia ? navigator.mozGetUserMedia({audio: true}, callback, errorCallback)
    : null;
  }

  var stopPlaying;

  function playClip(context, completeCallback) {
    var mp3buf = getClipArrayBuffer();
    context.decodeAudioData(
      mp3buf,
      function (decodedBuf) {
        var source = context.createBufferSource();
        source.buffer = decodedBuf; 
        source.connect(context.destination);
        source.onended = completeCallback;
        source.start(0); 
      });
  }

  function recordClip(media, context, recordingTimeSec, completeCallback) {
    var microphone = context.createMediaStreamSource(media);

    var node = context.createScriptProcessor ?
      context.createScriptProcessor(4096, 2, 2) :
      context.createJavaScriptNode(4096, 2, 2);

    var recBuffersL = [];
    var recBuffersR = [];
    var llen =0, rlen =0;
    var sampleRate;

    var disconnected;

    node.onaudioprocess = function(e){
      if (disconnected) return;
      var bleft = e.inputBuffer.getChannelData(0);
      var bright = e.inputBuffer.getChannelData(1);
      llen += bleft.length;
      rlen += bright.length;
      sampleRate = e.inputBuffer.sampleRate;

      var bleftClone = new Float32Array(bleft.length);
      bleftClone.set(bleft);
      var brightClone = new Float32Array(bright.length);
      brightClone.set(bleft);

      recBuffersL.push(bleftClone);
      recBuffersR.push(brightClone);
    };

    microphone.connect(node);
    node.connect(context.destination);

    setTimeout(function() {
      microphone.disconnect(node);
      node.disconnect(context.destination);
      disconnected = true;

      var p = 0;
      var sourceBuf = context.createBuffer(2, Math.max(llen, rlen), sampleRate);
      var leftSourceBufArr = sourceBuf.getChannelData(0);
      for (var i = 0; i < recBuffersL.length; i++) {
        leftSourceBufArr.set(recBuffersL[i], p);
        p += recBuffersL[i].length;
      }
      p= 0;
      var rightSourceBufArr = sourceBuf.getChannelData(1);
      for (var i = 0; i < recBuffersR.length; i++) {
        rightSourceBufArr.set(recBuffersR[i], p);
        p += recBuffersR[i].length;
      }

      completeCallback(sourceBuf);
    }, recordingTimeSec*1000);

  }

  function playRecordingClip(context, sourceBuf, completeCallback) {
    var source = context.createBufferSource();
    source.buffer = sourceBuf;
    source.connect(context.destination);
    source.start(0);
    source.onended = completeCallback;
  }

  function getClipArrayBuffer() {
    var base64 = therain();
    var binary_string =  window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  var oldRecordClick = function() {
    withMedia(function (med) {
      console.log('withMedia ', med);

      var context = createAudioContext();

      console.log('AudioContext ', context);

      var microphone = context.createMediaStreamSource(med);
      console.log('microphone ', microphone);

      var node = context.createScriptProcessor ?
        context.createScriptProcessor(4096, 2, 2) :
        context.createJavaScriptNode(4096, 2, 2);

      var recBuffersL = [];
      var recBuffersR = [];
      var sampleRate;
      var divsLeft, divsRight;
      var maxBufferCount = 20;

      var createDivs = function(right) {
        var bg = document.createElement('div');
        bg.style.cssText =
          'height: 250px; '+
          'width: 550px; '+
          'display: inline-block; '+
          'border: solid 2px '+(right ? 'cornflowerblue':'tomato')+';';
        document.body.appendChild(bg);
        var divs = [];
        var count = 500;
        for (var i = 0; i < count; i++) {
          var d = document.createElement('div');
          var varChan = Math.round(i*250/200);
          d.style.cssText =
            'display: inline-block; background: rgb('+(right ? '0,40,'+varChan : varChan+',40,0')+'); width: 1px;';
          bg.appendChild(d);
          divs.push(d);
        }
        return divs;
      };

      var updateDivs = function(divs, bchan) {
        for (var i = 0; i <divs.length; i++) {
          var offs = (i * bchan.length/divs.length)|0;
          var len = (((i+1) * bchan.length/divs.length)|0) - offs;

          var chunkStart = (i * bchan.length/divs.length)|0;
          var chunkLen = (((i+1) * bchan.length/divs.length)|0) - chunkStart;

          var min = bchan[chunkStart];
          var max = bchan[chunkStart];
          for (var ib=chunkStart+1; ib<chunkStart + chunkLen; ib++) {
            min = Math.min(min, bchan[ib]);
            max = Math.max(max, bchan[ib]);
          }

          var minPx = (min + 1)*50;
          var maxPx = (max + 1)*50;

          divs[i].style.marginTop = minPx+'px';
          divs[i].style.height = (maxPx-minPx)+'px';
          divs[i].style.marginBottom = (100 - minPx - maxPx)+'px';

        }

      };

      node.onaudioprocess = function(e){
        var bleft = e.inputBuffer.getChannelData(0);
        var bright = e.inputBuffer.getChannelData(1);

        var bleftClone = new Float32Array(bleft.length);
        bleftClone.set(bleft);
        var brightClone = new Float32Array(bright.length);
        brightClone.set(bleft);

        recBuffersL.push(bleftClone);
        recBuffersR.push(brightClone);
        if (recBuffersL.length > maxBufferCount) recBuffersL.shift();
        if (recBuffersR.length > maxBufferCount) recBuffersR.shift();

        sampleRate = e.inputBuffer.sampleRate;


        if (!divsLeft) divsLeft = createDivs(false);
        if (!divsRight) divsRight = createDivs(true/*right*/);

        updateDivs(divsLeft, bleft);
        updateDivs(divsRight, bright);

        //record.textContent = 'Record ['+recBuffersL.length+' at '+sampleRate+']';
      }

      microphone.connect(node);
      node.connect(context.destination);

      var playButton = document.createElement('button');
      playButton.textContent = 'Play';
      playButton.onclick = function() {
        var playContext = context;//createAudioContext();
        //if (playButton.parentElement) playButton.parentElement.removeChild(playButton);
        var leftSize = 0;
        for (var i = 0; i < recBuffersL.length; i++) {
          leftSize += recBuffersL[i].length;
        }

        var p = 0;
        var sourceBuf = playContext.createBuffer(2, leftSize, sampleRate);
        var leftSourceBufArr = sourceBuf.getChannelData(0);
        for (var i = 0; i < recBuffersL.length; i++) {
          leftSourceBufArr.set(recBuffersL[i], p);
          p += recBuffersL[i].length;
        }
        p= 0;
        var rightSourceBufArr = sourceBuf.getChannelData(1);
        for (var i = 0; i < recBuffersR.length; i++) {
          rightSourceBufArr.set(recBuffersR[i], p);
          p += recBuffersR[i].length;
        }

        //sourceBuf.getChannelData(0).set(leftBufferArr);
        //sourceBuf.copyToChannel(leftBufferArr, 0);

        var source = playContext.createBufferSource();
        source.buffer = sourceBuf;
        source.connect(playContext.destination);
        source.start(0);
      };
      document.body.appendChild(playButton);
      document.body.appendChild(document.createElement('hr'));

      //var filter = context.createBiquadFilter();
      //console.log('filter ', filter);

      // microphone -> filter -> destination.
      //microphone.connect(filter);
      //filter.connect(context.destination);

    }, function(err) {
      console.error(err);
    });
  };
  //record.textContent = 'Record';
  //document.body.appendChild(record);

}

accent();
