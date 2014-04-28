/*
 * Mouse event handler
 * 
 * listener
 * {
 * 	[void] onClick: function([hsMouseHandler] handler, [Node] clicked_node, [String] pressed_buttons);
 * }
 * 
 */

/*hsMouseHandler*/ function hsCreateMouseHandler(/*MouseListener*/ listener)
{
	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	function log(msg) {	consoleService.logStringMessage(msg);	}
	
	var mouseListener = /*void*/function(event)
			{			
			log("mouse listener start point : " + event.target);
				// TODO: add Event listeners for mouse "click" event
				listener.onClick(mHandler,event.target,"click");
			};


	//registering the mouse listener
	window.addEventListener('click', mouseListener, false);	
	log("Registered the mouse listener");
	var mHandler =
	{
			release: /*void*/ function()
			{
				// TODO: release listeners for mouse click event
				window.removeEventListener("click", mouseListener, false);
			}
	};
	return mHandler;
}
