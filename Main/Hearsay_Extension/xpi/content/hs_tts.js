function hsCreateTTS(listener)
{
	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	function log(msg) {
		//consoleService.logStringMessage(msg);
	}

	var current_text_id= "";
	var tts_obj = 
	{		
			cancel: function(text_id)
			{
				try{
					if(text_id!=current_text_id)	// not current text, ignore
						return;
					//put it in try catch block and ignore
					var mediator = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
					var docTab = mediator.getMostRecentWindow("navigator:browser").document;
					CleanTheAudio(docTab);
					log('audio stopped by user');
				}
				catch(e){
					log("Cancelled");
				}
			},
			speak: function(text, text_id)
			{
				this.cancel(current_text_id);	// cancel previous
				current_text_id = text_id;
				speak(text,{ noWorker:true});
				log('audio started by user' + text_id);
				//TODO : Use onEndSpeak listener ?? 
				//listener.onEndSpeak(tts_obj, current_text_id);
			},
			release: function()
			{
				this.cancel(current_text_id); // cancel current text
				log('Release all objects');
				// TODO: release internal objects
			}
	};

	//Speak is non-modified original function for webTts
	function speak(text, args) {
		var PROFILE = 1;

		function parseWav(wav) {
			var start = new Date().getTime();

			function readInt(i, bytes) {
				var ret = 0;
				var shft = 0;
				while (bytes) {
					ret += wav[i] << shft;
					shft += 8;
					i++;
					bytes--;
				}
				var end = new Date().getTime();
				var time = end - start;
				return ret;
			}
			if (readInt(20, 2) != 1) throw 'Invalid compression code, not PCM';
			if (readInt(22, 2) != 1) throw 'Invalid number of channels, not 1';
			return {
				sampleRate: readInt(24, 4),
				bitsPerSample: readInt(34, 2),
				samples: wav.subarray(44)
			};
		}

		function playHTMLAudioElement(wav) {
			function encode64(data) {
				var start = new Date().getTime();
				var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
				var PAD = '=';
				var ret = '';
				var leftchar = 0;
				var leftbits = 0;
				for (var i = 0; i < data.length; i++) {
					leftchar = (leftchar << 8) | data[i];
					leftbits += 8;
					while (leftbits >= 6) {
						var curr = (leftchar >> (leftbits-6)) & 0x3f;
						leftbits -= 6;
						ret += BASE[curr];
					}
				}
				if (leftbits == 2) {
					ret += BASE[(leftchar&3) << 4];
					ret += PAD + PAD;
				} else if (leftbits == 4) {
					ret += BASE[(leftchar&0xf) << 2];
					ret += PAD;
				}
				var end = new Date().getTime();
				var time = end - start;
				return ret;
			}

			var start = new Date().getTime();
			addAudioToTab(encode64(wav));
			var end = new Date().getTime();
			var time = end - start;
		}

		function playAudioDataAPI(data) {
			try {
				var start = new Date().getTime();	
				var output = new Audio();
				output.mozSetup(1, data.sampleRate);
				var num = data.samples.length;
				var buffer = data.samples;
				var f32Buffer = new Float32Array(num);
				for (var i = 0; i < num; i++) {
					var value = buffer[i<<1] + (buffer[(i<<1)+1]<<8);
					if (value >= 0x8000) value |= ~0x7FFF;
					f32Buffer[i] = value / 0x8000;
				}
				output.mozWriteAudio(f32Buffer);
				var end = new Date().getTime();
				var time = end - start;
				return true;
			} catch(e) {
				return false;
			}
		}

		function handleWav(wav) {
			var startTime = Date.now();
			var data = parseWav(wav); // validate the data and parse it
			// TODO: try playAudioDataAPI(data), and fallback if failed
			playHTMLAudioElement(wav);
			if (PROFILE) log('speak.js: wav processing took ' + (Date.now()-startTime).toFixed(2) + ' ms');
		}

		if (args && args.noWorker) {
			// Do everything right now. speakGenerator.js must have been loaded.
			var startTime = Date.now();
			var wav = generateSpeech(text, args);
			if (PROFILE) log('speak.js: processing took ' + (Date.now()-startTime).toFixed(2) + ' ms');
			handleWav(wav);
		} else {
			log('error in generating speech');
		}
	}// End of Speak

	/* 
	 * AudioEndedDoc is called when the speak function is completed.
	 * It removes audio tag to the Mozilla Add-On bar Interface.
	 */
	function CleanTheAudio(docTab)
	{
		var ele = docTab.getElementById("player");
		if(ele==null)
			return;
		ele.removeEventListener('ended', AudioEndedDoc, false);
		var elem = docTab.getElementById('audio');
		while (elem.firstChild)
			elem.removeChild(elem.firstChild);
	}
	
	function AudioEndedDoc(docTab) 
	{
		CleanTheAudio(docTab);
		log("speaking completed");

		//clean up to done bith in cancel
		listener.onEndSpeak(tts_obj, current_text_id);
	}

	/*
	 * addAudioToTab is called when wav is encoded in the speak function.
	 * It adds audio tag to the Mozilla Add-On bar Interface.
	 */
	function addAudioToTab(encoded){

		try{
			var mediator = Components.classes['@mozilla.org/appshell/window-mediator;1']
			.getService(Components.interfaces.nsIWindowMediator);
			var docTab = mediator.getMostRecentWindow("navigator:browser").document;
			var addonBar = docTab.getElementById("addon-bar");

			const doc = gBrowser.contentDocument;

			const input = doc.createElement( "div" );
			if(doc.getElementById("audio")==null)
			{
				input.setAttribute( "id", "audio" );
			}
			addonBar.appendChild(input);
			docTab.getElementById("audio").innerHTML=("<audio id=\"player\" src=\"data:audio/x-wav;base64,"+encoded+"\"/>");
			docTab.getElementById("player").addEventListener('ended',function() {AudioEndedDoc(docTab);},false);
			docTab.getElementById("player").play();
		}
		catch(e)
		{
			log("addAudioToTab exception.");
		}
	}			

	return tts_obj;
};


