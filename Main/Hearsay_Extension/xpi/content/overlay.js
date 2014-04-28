var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
function log(msg) {
	consoleService.logStringMessage(msg);
}

var Hearsay_Extension = 
{
	ButtonClick: function(stri) {

		speak(stri,{ noWorker:true});
		
	},
	StopClick: function() {

		const doc = gBrowser.contentDocument;
		var ele = doc.getElementById("audio");
		doc.body.removeChild(ele);
		log('audio stopped by user');
		
	},
	WAlert: function(str) {
		window.alert(str);
	},
	
	onConnect: function() 
		{
		// init keyboard, mouse, tts
		//register to handle start of gBrowser
		
		// enumerate already existed tabs and send INIT_DOMs
		var numberOfTabs = gBrowser.browsers.length;
		for(var iterator = 0; iterator < numberOfTabs; iterator++) {
			var browserInstance = gBrowser.getBrowserAtIndex(iterator);
			var currentDocument = browserInstance.contentDocument;
			log("Current DOcument URI is : " + currentDocument.documentURI);
		}
		
		// set activeTab to actual value and send ACTIVE_TAB message
		var container = gBrowser.tabContainer;
		
		// set eventListeners for gBrowser events for new tab, delete tab, and active tab
			
		},
		onDisconnect: function()
		{
			hstDone();
		},
		onSend: function()
		{
			log("[Firefox Client]: sending");
			messageref = new message("NEW_DOM",1);
			var parameterName = "param1";
			var parameterValues = ["value1", "value2"];
			messageref.setParameter(parameterName, parameterValues);
			var hearsayXMLMessage = messageref.convertToString();
			log("[Firefox Client]: XML Message is : " + hearsayXMLMessage);
//			newmessageref = createmessage(hearsayXMLMessage);
//			log(newmessageref.getTabId() + " " + newmessageref.getMessageType() + " " + newmessageref.getParameter());
			
			hstSendMsg(hearsayXMLMessage);
		}
};

log("Hearsay_Extension is loaded");

function init() {
	document.getElementById('play').addEventListener('click',function() {
		Hearsay_Extension.ButtonClick('Play/Resume Text Play/Resume');
	},false);
	document.getElementById('pause').addEventListener('click',function() {
		Hearsay_Extension.StopClick();
	},false);
	document.getElementById('send').addEventListener('click',function() {
		Hearsay_Extension.ButtonClick('Send Info to Server');
	},false);
}

window.addEventListener("load", init, false);

