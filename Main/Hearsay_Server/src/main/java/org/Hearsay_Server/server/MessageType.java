package org.Hearsay_Server.server;
//package interfaces;

enum MessageType
{
// Server messages
	SET_HIGHLIGHT,	// parameter: "node_id", list of highlighted ID. Processed by BrowserController
	TTS_SPEAK,		// processed by main handler, tabID will be ignored. Cancels currently speaking text.
					// parameters: 
					// 		"text" - text to speak
					//		"text_id" - id of the text.
	TTS_CANCEL,		// Cancel current speak, if text_id is current speaking text id.
					// parameter: "text_id" - id of the text.
//Extension->Server messages:
	// TTS events:
	// will be send to active tab as a signal to continue reading
	TTS_DONE,		// parameters: "text_id" - text with text_id has been spoken.
	// Browser handler events. Will be produced by main part of the extension.
	// Will be processed by Dispatcher
	NEW_TAB,		// Parameters: none. if a new tab is opened, then initial message will be sent.
	ACTIVE_TAB,		// Parameters: none. Will be sent when tab switch happend.
	DELETE_TAB,		// Parameters: none. C.O.: yes, it will be sent when the tab was deleted
	// Will be processed by active tab. if tabID of the message is the same. Otherwise ignore it
	KEY,			// Parameters: "press": a pressed key name. This message will be sent with active tab
	MOUSE,			// Parameters: "id" - clicked node id, extra parameters - pressed mouse button state. 
	FOCUS,			// Parameters: "id" - new currently selected node by browser.
	// DOM events. will be processed by ITabHandler
	INIT_DOM,		// parameters: "url" of the document; payload will contain whole the serialized document, except sub-frames
	UPDATE_DOM,		// parameters: "parent_id" - id of the parent node of updated subtree, "sibling_id" - previous (or left) sibling of the updated subtree.
										// 	payload - the serialized subtree. Note: subframes of the document will be sent as updates for subtree.
	DELETE_DOM,		// Parameters: "node_id" - list of root's id for deleted subtrees.
	MOVE_DOM,		// Parameters: "node_id", "parent_id", "sibling_id" - this event will be sent when "node_id" has been moved to a new position in "parent_id" and placed after "sibling_id".
	UPDATE_ATTR,	// Parameters: "node_id", "attr", "value"
	DELETE_ATTR,	// Parameters: "node_id", "attr"
	CHANGE_VALUE	// Parameters: "node_id", "value" - will be send when input form element has been changed
}