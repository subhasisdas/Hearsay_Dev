/*
 * Keyboard event handler
 * 
 * listener
 * {
 * 	[void] onKeyPress: function([hsKeyboardHandler] handler, [String] pressed_button);
 * }
 * 
 */

/*hsKeyboardHandler*/ function hsCreateKeyboardHandler(/*Listener*/ listener)
{

	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	function log(msg) {	consoleService.logStringMessage(msg);	}

	var ALT_KEY = "Alt"; //"ALT";
	var CTRL_KEY = "Ctrl"; //"CTRL";
	var SHIFT_KEY = "Shift"; //"SHIFT";
	var INS_KEY = "Insert"; //"INS";
	var iflag= new Boolean(false);//"Insert - play/pause flag"
	
	//adopted from echoing.js
	//**
	// This object defines the text to be spoken out on echoing
	//*
	var echoingMessages = {};  // TODO: externalize the textual content for language support
	echoingMessages[KeyEvent.DOM_VK_F1]='F1';
	echoingMessages[KeyEvent.DOM_VK_F2]='F2';
	echoingMessages[KeyEvent.DOM_VK_F3]='F3';
	echoingMessages[KeyEvent.DOM_VK_F4]='F4';
	echoingMessages[KeyEvent.DOM_VK_F5]='F5';
	echoingMessages[KeyEvent.DOM_VK_F6]='F6';
	echoingMessages[KeyEvent.DOM_VK_F7]='F7';
	echoingMessages[KeyEvent.DOM_VK_F8]='F8';
	echoingMessages[KeyEvent.DOM_VK_F9]='F9';
	echoingMessages[KeyEvent.DOM_VK_F10]='F10';
	echoingMessages[KeyEvent.DOM_VK_F11]='F11';
	echoingMessages[KeyEvent.DOM_VK_F12]='F12';
	echoingMessages[KeyEvent.DOM_VK_END]='End';
	echoingMessages[KeyEvent.DOM_VK_HOME]='Home';
	echoingMessages[KeyEvent.DOM_VK_LEFT]='Left';
	echoingMessages[KeyEvent.DOM_VK_UP]='Up';
	echoingMessages[KeyEvent.DOM_VK_RIGHT]='Right';
	echoingMessages[KeyEvent.DOM_VK_DOWN]='Down';
	echoingMessages[KeyEvent.DOM_VK_DELETE]='Delete';
	echoingMessages[KeyEvent.DOM_VK_COMMA]='Comma'; 			//This is not the ASCII for , but still firefox throws this ASCII. (temp)
	echoingMessages[KeyEvent.DOM_VK_PERIOD]='Period'; 			//This is not the ASCII for . but still firefox throws this ASCII. (temp)
	echoingMessages[KeyEvent.DOM_VK_ESCAPE]='Escape';
	echoingMessages[KeyEvent.DOM_VK_BACK_SPACE]='Backspace';
	echoingMessages[KeyEvent.DOM_VK_TAB]='Tab';
	echoingMessages[KeyEvent.DOM_VK_SPACE]='Space';
	echoingMessages[KeyEvent.DOM_VK_PAUSE]='Pause';
	echoingMessages[KeyEvent.DOM_VK_RETURN]='Enter';
	//removed the statement for insert as its not required now.
	echoingMessages[KeyEvent.DOM_VK_SUBTRACT]='Underscore';
	echoingMessages[KeyEvent.DOM_VK_PAGE_UP]='PageUp';
	echoingMessages[KeyEvent.DOM_VK_PAGE_DOWN]='PageDown';
	echoingMessages[KeyEvent.DOM_VK_SHIFT]='Shift';
	echoingMessages[KeyEvent.DOM_VK_CONTROL]='Control';
	echoingMessages[KeyEvent.DOM_VK_ALT]='Alt';
	echoingMessages[KeyEvent.DOM_VK_ENTER]='Enter';    
	echoingMessages[KeyEvent.DOM_VK_INSERT]='Insert';
	//the combination of C+S+A was not being sent
	//properly because there was not a case for the keycodes of CSA in the hash for echoing messages
	//now the key presses are properly being sent.

	/* 
	 * Gets the keycode of the keys pressed.
	 * @param {Object} event     Event Type
	 * @return toSpeak           Returns the keycode of the pressed Key
	 */
	function getHumanReadableKey(/*String*/ event)
	{

		var tempSpeak = "";

		if (event.ctrlKey == true)
			tempSpeak += CTRL_KEY;
		if (event.shiftKey == true)
			tempSpeak += SHIFT_KEY;
		if (event.altKey == true)
			tempSpeak += ALT_KEY;
	
		switch (event.keyCode) {
		case KeyEvent.DOM_VK_SUBTRACT: //case for underscore
			if(tempSpeak == SHIFT_KEY + "+")
				tempSpeak = echoingMessages[event.keyCode];
			break;
		case KeyEvent.DOM_VK_INSERT:			
				tempSpeak = INS_KEY ;
			break;
		default:
			var keyDescription = echoingMessages[event.keyCode];
			//this break causes error, so commented
			//break;
		if(keyDescription == null) {
			//tempSpeak += String.fromCharCode(event.keyCode);
		}
		else
			tempSpeak += keyDescription;
		}

		return tempSpeak;
	}


	var keyBdListener =	 /*void*/function(event)
	{			
		// TODO: add Event listeners for keyboard "press" event
		var tempSpeak="keyPressed ";
		tempSpeak += getHumanReadableKey(event);


		if (echoingMessages[event.keyCode] == 'Enter' || echoingMessages[event.keyCode] == 'Left' || echoingMessages[event.keyCode] == 'Up' ||
				echoingMessages[event.keyCode] == 'Down' || echoingMessages[event.keyCode] == 'Backspace' || echoingMessages[event.keyCode] == 'Right'|| 
				echoingMessages[event.keyCode] == 'Delete'||echoingMessages[event.keyCode] == 'Home' || echoingMessages[event.keyCode] == 'End' ||
				echoingMessages[event.keyCode] == 'Insert')
		{
			//log("Special Key");
		}
		else 
		{
			var code = event.charCode || event.keyCode;
			tempSpeak += String.fromCharCode(code);
		}
		
		//tempSpeak = tempSpeak.replace(/\s+/g, '');
		//log("key pressed! "+tempSpeak);
		listener.onKeyPress(keyBHandle,tempSpeak);

	};

	log(" Registering the keyboard listener ");
	//registering the keyboard listener
	window.addEventListener("keypress", keyBdListener, false);

	var keyBHandle =
	{
			release: /*void*/ function()
			{
				// TODO: release listeners
				log("release listeners");
				window.removeEventListener("keypress", keyBdListener ,false);
			}
	};
	return keyBHandle;
}
