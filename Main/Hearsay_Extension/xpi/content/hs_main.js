/*
 * Main part of extension.
 * depends on:
 * 	hs_transport.js
 *  hs_msgtypes.js
 * 	hs_message.js
 */

//services, such as console output
//internal variables
var transport = null;
var keyboard = null;
var mouse = null;
var tts = null;
var newTabId;
var tabMap = {};	// map tabId: tab
var activeTabBrowserHandler = null;
var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
//variable to validate XML characters chars : #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
var NOT_SAFE_IN_XML_1_0 = /[^\x09\x0A\x0D\x20-\xFF\x85\xA0-\uD7FF\uE000-\uFDCF\uFDE0-\uFFFD]/gm;
var ALPHA_NUMERIC_UNDERSCORE = /^[A-Za-z0-9_]+$/;

function log(msg) 
{	
	consoleService.logStringMessage("transport : [hs_main] "+msg);	
}
function getTabId(/*Browser*/ br)
{
	for(var tabId in tabMap)
	{
		log('Check for tabId : ' + tabId);
		if(tabMap[tabId].getBrowser() == br)
			return tabId;
	}
	return null;
}

function ignoreCheckFunction(/*Node*/ node)
{
	if(node.nodeName == 'SCRIPT' || node.nodeName == 'script')
		return true;

	//to filter out style
	// check if element node
	/*if(node.nodeType == 1){

		//var elem = (Element)node;
		if(node.getAttribute('style'))
		{
			log("Gotcha!");
			//log(node.getAttribute('style'));
			node.get
		}
	}*/
	if(node.nodeName == "STYLE" || node.nodeName == "#comment" || node.nodeName == "NOSCRIPT" || node.nodeName == "META" || node.nodeName == "style") 
	{
		log("Hey there! removing style node");
		return true;
	}

	if(node.nodeType == 8)	// comment node
		return true;

	if(node.nodeType == 3 && node.nodeValue.replace(/^\s+/, '') == '')	// empty text nodes
		return true;

	if(node.getAttribute && node.getAttribute("classname") == "_ignore_")
		return true;

	if(typeof(node) == "undefined")
		return true;

	if(typeof(node.nodeName)){
		log("this node has a defined node name");
		IsAlphanumericNodeName(node.nodeName);
	}

	return false;
}

function IsAlphanumericNodeName(/*String*/ nodeName){

	if(!nodeName.match(/^[A-Za-z0-9_]+$/))
	{
		log("invalid nodename");
		return true;
	}

	return false;
} 

/*function sanitizeStringForXML(theString) {

	return theString.replace(NOT_SAFE_IN_XML_1_0, '');
}

function removeInvalidCharacters(Node node){

	log("inside removeInvalidCharacters");
	if (node.attributes) {
		for (var i = 0; i < node.attributes.length; i++) {
			var attribute = node.attributes[i];
			if (attribute.nodeValue) {
				attribute.nodeValue = sanitizeStringForXML(attribute.nodeValue);
			}
		}
	}
	log("Now checking the children");
	if (node.childNodes) {
		for (var i = 0; i < node.childNodes.length; i++) {
			var childNode = node.childNodes[i];
			if (childNode.nodeType == 1  ELEMENT_NODE ) {
				removeInvalidCharacters(childNode);
			} else if (childNode.nodeType == 3  TEXT_NODE ) {
				if (childNode.nodeValue) {
					childNode.nodeValue = sanitizeStringForXML(childNode.nodeValue);
				}
			}
		}
	}
}*/

function processNewTab(/*int*/ newTabId, /*Browser*/ browser)
{
	log('Sending NEW_TAB message');
	var newTabMessage = hsMessage.create(hsMsgType.NEW_TAB, newTabId);
	transport.send(newTabMessage.toXMLString());
	tabMap[newTabId] = hsCreateBrowserHandler(browser, listener, newTabId, ignoreCheckFunction);
}

//Tab events
function onTabAdded(event)
{
	try
	{
		var browser = gBrowser.getBrowserForTab(event.target);
		processNewTab(newTabId, browser);
		newTabId++;
	}
	catch(ex)
	{
		log(ex);
	}
}

function onTabRemoved(event)
{
	log('A tab was removed');
	var removedTabBrowser = gBrowser.getBrowserForTab(event.target);
	var tabRemovedId = getTabId(removedTabBrowser);
	var activeTabBrowser = gBrowser.getBrowserForTab(gBrowser.selectedTab);
	var newActiveTabId = getTabId(activeTabBrowser);
	if(tabRemovedId)
	{
		tabMap[tabRemovedId].release();
		delete tabMap[tabRemovedId];
		var m = hsMessage.create(hsMsgType.DELETE_TAB, tabRemovedId);
		transport.send(m.toXMLString());
	}
	if(newActiveTabId)
	{
		activeTabBrowserHandler = tabMap[newActiveTabId];
		if(activeTabBrowserHandler)
		{
			var activeTabMessage = hsMessage.create(hsMsgType.ACTIVE_TAB, newActiveTabId);
			transport.send(activeTabMessage.toXMLString());
		}
	}
}

function onTabActivated(event)
{
	log('A tab has been selected / activated');
	var activeTabBrowser = gBrowser.getBrowserForTab(gBrowser.selectedTab);
	var newActiveTabId = getTabId(activeTabBrowser);
	if(newActiveTabId)
	{
		activeTabBrowserHandler = tabMap[newActiveTabId];
		var activeTabMessage = hsMessage.create(hsMsgType.ACTIVE_TAB, newActiveTabId);
		transport.send(activeTabMessage.toXMLString());
	}
}

/**
 * Invoked from the listener's onConnect implementation
 */
function enumerateExistingTabs(/*tabbrowser*/ gBrowser)
{
	var numberOfTabs = gBrowser.browsers.length;
	for(var index = 0; index < numberOfTabs; index++)
	{
		var currentTab = gBrowser.tabContainer.childNodes[index];
		var currentBrowser = gBrowser.getBrowserForTab(currentTab);
		processNewTab(newTabId, currentBrowser);
		newTabId++;
	}
}

var listener =
{
		// transport events ----------------------------------------------------------------------
		onConnect: 		/*void*/function(/*hsTransport*/ handle) 
		{
			log('onConnect on listener in main was invoked');
			newTabId = 1;
			// Initialize keyboard, mouse and tts components
			log("initializing the handlers");
			tts = hsCreateTTS(listener);
			mouse = hsCreateMouseHandler(listener);
			keyboard = hsCreateKeyboardHandler(listener);	
			log("handlers created");

			//enumerate already existed tabs and send INIT_DOMs
			enumerateExistingTabs(gBrowser);
			if(gBrowser.selectedTab)
			{
				//Set the active tab and send the ACTIVE_TAB message to server
				var activeTabId = getTabId(gBrowser.getBrowserForTab(gBrowser.selectedTab));
				if(activeTabId)
				{
					activeTabBrowserHandler = tabMap[activeTabId];
					var activeTabMessage = hsMessage.create(hsMsgType.ACTIVE_TAB, activeTabId);
					transport.send(activeTabMessage.toXMLString());
				}
			}
			// set eventListeners for gBrowser events for new tab, delete tab, and active tab
			var container = gBrowser.tabContainer;
			container.addEventListener("TabOpen", onTabAdded, false);
			container.addEventListener("TabClose", onTabRemoved, false);
			container.addEventListener("TabSelect", onTabActivated, false);			
		},
		onDisconnect:	/*void*/function(/*hsTransport*/ handle) 
		{	
			if(keyboard)
			{
				keyboard.release();
				keyboard = null;
			}
			if(mouse)
			{
				mouse.release();
				mouse = null;
			}
			if(tts)
			{
				tts.release();
				tts = null;
			}
			if(tabMap)
			{
				for(tabId in tabMap)
				{
					tabMap[tabId].release();
				}
			}
			tabMap = {};
			// release gBrowser listeners
			var container = gBrowser.tabContainer;
			container.removeEventListener("TabOpen", onTabAdded, false);
			container.removeEventListener("TabClose", onTabRemoved, false);
			container.removeEventListener("TabSelect", onTabActivated, false);
		},
		onReceive:		/*void*/function(/*hsTransport*/ handle, /*String*/message) 
		{
			//log("CDATA message received from server =>" + message);
			var msg = hsMessage.load(message);
			//log("Listener onReceive msg="+message);
			switch(msg.getType())
			{
			case hsMsgType.TTS_SPEAK:
				//log("Receive TTS_SPEAK message : " + message);
				var text = msg.getParameter("text");
				log("CDATA text =>"+text);
				//var temp = text;
				//,<![CDATA[Home]]>,
				//var temp1 = temp.toString();
				//temp1.replace(/\<\!\[CDATA\[(.+\]{0}\>{0})\]\]\>/g,"");
				//log("CDATA clean text =>"+temp1);

				var text_id = msg.getParameter("text_id");				
				text = text && text.length>0 && text[1];				
				if(text)
				{
					text_id = text_id && text_id.length>0 && text_id[1];
					tts.speak(text, text_id);
				}
				break;
			case hsMsgType.TTS_CANCEL:
				// TODO: implement it
				//log("Receive TTS_CANCEL message : "+ message);
				var text_id = msg.getParameter("text_id");
				text_id = text_id && text_id.length>0 && text_id[1];
				tts.cancel(text_id);
				break;
			case hsMsgType.SET_HIGHLIGHT:
				//log("hsMsgType.SET_HIGHLIGHT: Received");
				var tab = tabMap[msg.getId()];
				//log("tab"+tab+":"+msg.getParameter("node_id"));
				if(tab)
					tab.highlight(msg.getParameter("node_id"));
				//log("hsMsgType.SET_HIGHLIGHT: OK")
				break;
			default:
				// TODO: print error message to console with message description
			}
		},
		// TTS events -----------------------------------------------------------------------
		onEndSpeak: /*void*/function(/*ttsHandler*/tts, /*String*/text_id)
		{
			var activeTabId =  getTabId(gBrowser.getBrowserForTab(gBrowser.selectedTab));
			var activeTabMessage = hsMessage.create(hsMsgType.TTS_DONE, activeTabId);
			activeTabMessage.setParameter("text_id", [text_id]);
			transport.send(activeTabMessage.toXMLString());
		},
		// ----------------------------------------------------------------------------------
		// TODO: add keyboard, mouse event handlers
		onKeyPress: /*void*/function(/*keybHandler*/keyboard, /*String*/key)
		{

			// TODO: send hsMsgType.KEY message
			//log(" onKeyPress message sent!"+ key);
			var activeTabId =  getTabId(gBrowser.getBrowserForTab(gBrowser.selectedTab));
			if(activeTabId)
			{
				//log(" onKeyPress message sent!");
				if(key && key.length>0)	
				{
					var activeTabMessage = hsMessage.create(hsMsgType.KEY, activeTabId);
					activeTabMessage.setParameter("press", [key]);
					//log("msg sent is :"+activeTabMessage.toXMLString())
					transport.send(activeTabMessage.toXMLString());
				}

			}
		},

		onClick : /*void*/function(/*[hsMouseHandler]*/ mouse, /*[Node]*/ clicked_node, /*[String]*/ button)
		{
			//log(" onClick message sent!"+ button);
			var activeTabId =  getTabId(gBrowser.getBrowserForTab(gBrowser.selectedTab));

			var nodeId = activeTabBrowserHandler.getNodeId(clicked_node);
			//log("Node Id of clicked node is : " + nodeId);
			if(nodeId != null && activeTabId != null)
			{
				//log("onClick message sent!");
				var activeTabMessage = hsMessage.create(hsMsgType.MOUSE, activeTabId);
				activeTabMessage.setParameter("id", [nodeId]);
				//log("msg sent is :"+activeTabMessage.toXMLString());
				var nodeBeingClicked = activeTabBrowserHandler.getNode(nodeId);
				transport.send(activeTabMessage.toXMLString());
			}
		},
		// DOM events observer
		// TODO: implement it

		onDOMInit: /*void*/function(/*hsBrowserHandler*/ handler, /*Node*/ xml_dom, /*long*/ tabId)
		{
			log('onDOMInit invoked : ' + handler.getBrowser());
			log("Tab id is : " + tabId);
			if(tabId)
			{
				var initDOMMessage = hsMessage.create(hsMsgType.INIT_DOM, tabId);
				initDOMMessage.setParameter("URL", [handler.getBrowser().contentDocument.URL]);
				initDOMMessage.setPayload(xml_dom);
				//log(initDOMMessage.toXMLString());
				transport.send(initDOMMessage.toXMLString());
			}
		},
		onDOMUpdate: /*void*/function(/*hsBrowserHandler*/ handler,/*String*/ parent_id, /*String*/ prev_sibling_id, /*Node*/ xml_dom, /*long*/ tabId)
		{
			log('onDOMUpdate invoked : ' + handler.getBrowser());
			log("Tab id is : " + tabId);
			if(tabId)
			{
				var updateDOMMessage = hsMessage.create(hsMsgType.UPDATE_DOM, tabId);
				updateDOMMessage.setParameter("parent_id", [parent_id]);
				updateDOMMessage.setParameter("sibling_id", [prev_sibling_id]);
				updateDOMMessage.setPayload(xml_dom);
				transport.send(updateDOMMessage.toXMLString());
			}
		},
		onDOMDelete: /*void*/function(/*hsBrowserHandler*/ handler, /*String[]*/ node_ids, /*long*/ tabId)
		{
			log('onDOMDelete invoked : ' + handler.getBrowser());
			log("Tab id is : " + tabId);
			if(tabId)
			{
				var deleteDOMMessage = hsMessage.create(hsMsgType.DELETE_DOM, tabId);
				deleteDOMMessage.setParameter("node_ids",node_ids);
				transport.send(deleteDOMMessage.toXMLString());
			}
		},
		onDOMAttrChange: /*void*/function(/*hsBrowserHandler*/ handler, /*String[]*/ node_id, /*String[]*/ attr, /*String[]*/ values, /*long*/ tabId)
		{
			//check for null values of attr, values
			if(tabId && attr && values)
			{
				var updateAttrMessage = hsMessage.create(hsMsgType.UPDATE_ATTR, tabId);
				updateAttrMessage.setParameter("node_id",node_id);
				updateAttrMessage.setParameter("attr",attr);
				updateAttrMessage.setParameter("values",values);
				transport.send(updateAttrMessage.toXMLString());
			}
		},
		onDOMAttrDelete: /*void*/function(/*hsBrowserHandler*/ handler, /*String[]*/ node_id, /*String[]*/ attr, /*long*/ tabId)
		{
			//check for null values of attr
			if(tabId && attr)
			{
				var deleteAttrMessage = hsMessage.create(hsMsgType.DELETE_ATTR, tabId);
				deleteAttrMessage.setParameter("node_id",node_id);
				deleteAttrMessage.setParameter("attr",attr);
				transport.send(deleteAttrMessage.toXMLString());
			}
		},
		onDOMMove: /*void*/function(/*hsBrowserHandler*/ handler, /*String*/ new_parent_id, /*String*/ new_prev_sibling_id, /*String*/ moved_node_id, /*long*/ tabId)
		{
			log('onDOMMove invoked : ' + handler.getBrowser());
			log("Tab id is : " + tabId);
			if(tabId)
			{
				var moveDOMMessage = hsMessage.create(hsMsgType.MOVE_DOM, tabId);
				moveDOMMessage.setParameter("node_id", [moved_node_id]);
				moveDOMMessage.setParameter("parent_id", [new_parent_id]);
				moveDOMMessage.setParameter("sibling_id", [new_prev_sibling_id]);
				transport.send(moveDOMMessage.toXMLString());
			}
		},

		// onValueChange
};

function onLoad()
{
	window.removeEventListener("load", onLoad, false);
	window.addEventListener("unload", onUnload, false);
	transport = hsCreateTransport("localhost", /*port*/13000, /*TransportListener*/listener);
}

//do not forget to release all resources!
function onUnload()
{
	window.removeEventListener("unload", onUnload, false);
	transport.release();
	// TODO: release all: transport, mouse, keyboard, listeners ....
	mouse.release();
	keyboard.release();
	tts.release();
}

//TODO: add gBrowser event listeners
window.addEventListener("load", onLoad, false);