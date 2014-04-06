/*
 * Added by Valentyn
 */

var hsMsgType = 
{
// Server->Extension messages:
		SET_HIGHLIGHT:	"SET_HIGHLIGHT",	// parameter: "node_id", list of highlighted ID. Processed by BrowserController
		TTS_SPEAK:		"TTS_SPEAK",		// processed by main handler, tabID will be ignored. Cancels currently speaking text.
											// parameters: 
											// 		"text" - text to speak
											//		"text_id" - id of the text.
		TTS_CANCEL:		"TTS_CANCEL",		// Cancel current speak, if text_id is current speaking text id.
											// parameter: "text_id" - id of the text.
// Extension->Server messages:
		// TTS events:
		TTS_DONE:		"TTS_DONE",			// parameters: "text_id" - text with text_id has been spoken.
		// Browser handler events. Will be produced by main part of the extension.
		NEW_TAB:		"NEW_TAB",			// Parameters: none. if a new tab is opened, then initial message will be sent.
		ACTIVE_TAB:		"ACTIVE_TAB",		// Parameters: none. Will be sent when tab switch happend.
		DELETE_TAB:		"DELETE_TAB",		// Parameters: none. C.O.: yes, it will be sent when the tab was deleted
		KEY:			"KEY",				// Parameters: "press": a pressed key name. This message will be sent with active tab
		MOUSE:			"MOUSE",			// Parameters: "id" - clicked node id, extra parameters - pressed mouse button state. 
		FOCUS:			"FOCUS",			// Parameters: "id" - new currently selected node by browser.
		// DOM events.
		
		INIT_DOM:		"INIT_DOM",			// parameters: "url" of the document; payload will contain whole the serialized document, except sub-frames
		UPDATE_DOM:		"UPDATE_DOM",			// parameters: "parent_id" - id of the parent node of updated subtree, "sibling_id" - previous (or left) sibling of the updated subtree.
											// 	payload - the serialized subtree. Note: subframes of the document will be sent as updates for subtree.
		DELETE_DOM:		"DELETE_DOM",		// Parameters: "node_id" - list of root's id for deleted subtrees.
		MOVE_DOM:		"MOVE_DOM",			// Parameters: "node_id", "parent_id", "sibling_id" - this event will be sent when "node_id" has been moved to a new position in "parent_id" and placed after "sibling_id".
		UPDATE_ATTR:	"UPDATE_ATTR",		// Parameters: "node_id", "attr", "value"
		DELETE_ATTR:	"DELETE_ATTR",		// Parameters: "node_id", "attr"
		CHANGE_VALUE:	"CHANGE_VALUE"		// Parameters: "node_id", "value" - will be send when input form element has been changed
};
