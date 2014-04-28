/**
 * Re-write of transport layer
 */

function hsCreateTransport(/*String*/ host, /*uint16*/ port, /*TransportListener*/ listener)
{	
	/**
	 * Constants for host, port number and timeout values
	 */
	const hstHost = host;
	const hstPort = port;
	const hstConnectTimeout = 5000;		// connect timeout in milliseconds
	const hstReconnectInterval = 2000;	// if connect failed, trying reconnect with this interval

	var transportListener = listener;

	var _transportObject = null;
	var _OutStream = null;
	var _InStream = null;
	var _in = null;

	var CC = Components.classes;
	var CI = Components.interfaces;

	var consoleService = CC["@mozilla.org/consoleservice;1"].getService(CI.nsIConsoleService);	

	var TimerComponent 				= Components.Constructor("@mozilla.org/timer;1", Components.interfaces.nsITimer);   
	var BinaryInputStreamComponent  = Components.Constructor("@mozilla.org/binaryinputstream;1", Components.interfaces.nsIBinaryInputStream);	
	const hstThreadManager = Components.classes["@mozilla.org/thread-manager;1"].createInstance(Components.interfaces.nsIThreadManager);
	const hstTransportService = Components.classes["@mozilla.org/network/socket-transport-service;1"].getService(Components.interfaces.nsISocketTransportService);

	var _ConnectTimeOutTimer = new TimerComponent();
	var _ReConnectTimer 	  = new TimerComponent();

	function log(msg)
	{	
		consoleService.logStringMessage("transport : " + msg);
	}

	/* nsITimerCallback interface.
	 * this function invoke by both timers: timeout and reconnect.
	 * which timer and which action it will do, depend of parameter timer
	 * 
	 * @param timer The timer that invoked this function
	 */
	var initWithCallbackEvent = 
	{
			notify : function(/*in nsITimer*/ timer) {
				if(_ReConnectTimer == timer)	// is it signal from Reconnect timer?
				{	
					if(!_InitTransport())
						_ReConnectTimer.initWithCallback(initWithCallbackEvent, hstReconnectInterval, 0);	// Type: TYPE_ONE_SHOT
					return;	
				}

				if(_ConnectTimeOutTimer == timer)	// is it signal from timeout timer?
				{	
					_DestroyTransport();
					// wait some time, then try to reconnect
					_ReConnectTimer.initWithCallback(initWithCallbackEvent, hstReconnectInterval, 0);	// Type: TYPE_ONE_SHOT
					return;	
				}

				log("HearSayTransport::notify: a very wrong state.");	// must be error	
			}
	}

	/*
	 * ---------------------------------------------------------------------------------------------
	 * Function to format the length of the message to be sent to Hearsay
	 * @param {Object} mesg the message to be sent
	 * moved from SocketComponent.js
	 */
	function _hstFormatMessageLength(msg) {
		var len_s = msg.length.toString();
		return "00000000".slice(len_s.length)+len_s;
	}

	/** internal use only function. Canceled connect timeout timer */ 

	function _StopConnectTimeoutTimer() {
		log("Cancel ConnectTimeout timer");
		if(_ConnectTimeOutTimer != null)
			_ConnectTimeOutTimer.cancel();
	}

	function _onConnect()
	{
		_StopConnectTimeoutTimer();
		log('Connection has been established');
		_InStream     = _transportObject.openInputStream(0, 0, 0);
		_in	   	   = new BinaryInputStreamComponent();        
		_in.setInputStream(_InStream);
		_InStream.asyncWait(asyncWaitEvent, 0, 0, hstThreadManager.mainThread); 
		listener.onConnect(hsTransportObject);
	}

	function _OnDisconnect()
	{
		log('OnDisconnect was invoked');
		if(listener.onDisconnect != null)
			listener.onDisconnect(hsTransportObject);

		_StopConnectTimeoutTimer();
		_DestroyTransport();

		if(_ReConnectTimer != null)
			_ReConnectTimer.initWithCallback(initWithCallbackEvent, hstReconnectInterval, 0);
	}

	/* this function is called when we got data in input stream
	 * 
	 * @param aStream                not used
	 */
	var asyncWaitEvent=
	{	
			onInputStreamReady:	function(/*nsIAsyncInputStream*/ aStream) {
				try {
					//log("onInputStreamReady is invoked");
					var avail_bytes = _in.available();
					_data ="";
					_DataLength = 0;
					//_data += _in.read(avail_bytes);
					_data += _in.readBytes(avail_bytes);
					for(;;) {
						if(_DataLength==0) {	// // read length
							//log("Really read: " + _data.length);
							if(_data.length<8)
								break;
							_DataLength = _data.substr(0, 8);
							_data 		 = _data.substr(8);
							//log("Message length detected = " + _DataLength); 
						}
						//log("DataLength is : " + _DataLength);
						//log("_data is : " + _data);
						if(_data.length<_DataLength)
							break;			  				
						//log("_data.substr(0, _DataLength) : "+_data.substr(0, _DataLength));
						var message 	 = decodeURIComponent(escape(_data.substr(0, _DataLength)));
						//log("Message decoded is : " + message);
						_data  	 = _data.substr(_DataLength);
						_DataLength = 0;
						//log( "execute message: \"" + message.toXML + "\":" + message.length + " : " + _data.length);
						listener.onReceive(hsTransportObject,message);
						/*if(message != null && message.length > 0)
						{
							
						}*/
					}
					_InStream.asyncWait(asyncWaitEvent, 0, 0, hstThreadManager.mainThread);
				}
				catch(e) {
					log("onInputStreamReady exception. finish");
					log(e.name);
					log(e.message);
					_OnDisconnect();
				}
			}

	}

	/*
	 * nsITransportEventSink interface
	 * callback that monitoring connection state.
	 */ 	 
	var setEventSinkEvent=
	{
			onTransportStatus : function (/*nsITransport*/ aTransport,/*nsresult*/ aStatus,/*unsigned long long*/ aProgress,/*unsigned long long*/ aProgressMax) 
			{
				try
				{
					switch(aStatus)
					{
					case aTransport.STATUS_READING:
						//log("onTransportStatus::status: Reading, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break;
					case aTransport.STATUS_WRITING:
						//log("onTransportStatus::status: Writing, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break;
					case aTransport.STATUS_RESOLVING:
						//log("onTransportStatus::status: Resolving, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break; 			
					case aTransport.STATUS_CONNECTED_TO: 			
						//log("onTransportStatus::status: Connected, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						_onConnect();		    			    
						break; 			
					case aTransport.STATUS_SENDING_TO:
						//log("onTransportStatus::status: Sending, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break; 			

					case aTransport.STATUS_RECEIVING_FROM:
						//log("onTransportStatus::status: Receiving, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);  				
						break;

					case aTransport.STATUS_CONNECTING_TO:
						//log("onTransportStatus::status: Connecting, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break; 			
					case aTransport.STATUS_WAITING_FOR:
						//log("onTransportStatus::status: Waiting, aProgress=" + aProgress + ", aProgressMax="+aProgressMax);
						break;
					default:
						//log("onTransportStatus::status: Unknown, code=" + aStatus);
					}
				}
				catch(ex)
				{
					log("hit happend: "+ex.message+"\n"+ex.stack);
				}
			}
	}

	function _InitTransport()
	{
		try
		{
			log('Initializing the transport layer');
			//Create a transport for the requested host and port number
			//Using default socket type			
			_transportObject = hstTransportService.createTransport(null, 0, hstHost, hstPort, null);
			// this forces the async transport run in main thread of FF
			_ConnectTimeOutTimer.initWithCallback(initWithCallbackEvent, hstConnectTimeout, 0);
			_transportObject.setEventSink(setEventSinkEvent, hstThreadManager.mainThread); 
			_OutStream = _transportObject.openOutputStream(1, 0, 0);
			log("Transport Host : " + _transportObject.host + " Port : " + _transportObject.port + " Alive Yet ? : " + _transportObject.isAlive());
			return true;
		}
		catch(e)
		{
			log("An error was encountered while initializing : " + e);
			_DestroyTransport();
			_StopConnectTimeoutTimer();
			return false;
		}
	}

	function _Done()
	{
		if(_ReConnectTimer != null)
		{
			_ReConnectTimer.cancel();
			_ReConnectTimer = null;
		}
		_DestroyTransport();
		_StopConnectTimeoutTimer();       	
		_ConnectTimeOutTimer = null;
	}

	// * internal use only function. an antipode of _InitTransport().
	//* destroy all associated with socket   

	function _DestroyTransport() {
		try
		{
			if(_OutStream != null)
				_OutStream.close();
			_transportObject.close(0);
		}
		catch(e)
		{
			log("Shit happens");
		}
		_OutStream = null;
		_InStream  = null;
		_in		= null;            	
		_transportObject = null;
	}  

	var _initSuccess = _InitTransport();
	if(!_initSuccess)
	{
		_ReConnectTimer.initWithCallback(initWithCallbackEvent, hstReconnectInterval, 0);
	}

	/**
	 * An object that supports the send and receive functions
	 */
	var hsTransportObject = {
			send : function(message) {
				if(_OutStream == null)
					log("Error: call hs_transport.js::hstSendMsg() without initialize transport");
				else {
					try
					{
						var strbytes = _hstFormatMessageLength(message);
						_OutStream.write(strbytes, 8);
						_OutStream.write(message, message.length);
					}
					catch(e)
					{
						log("Error on sending a message : " + message + " : " + e + " : " + _OutStream.isNonBlocking());
						_OnDisconnect();
					}
				}
			},
			release: function(){
				_Done();
			}
	};

	return hsTransportObject;

}