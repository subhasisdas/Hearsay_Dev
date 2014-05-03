/*
 * Browser event handler
 * 
 * listener
 * {
		onDOMUpdate(hsBrowserHandler handler, String parent_id, String prev_sibling_id, Node xml_dom);
		onDOMDelete(hsBrowserHandler handler, String[] node_ids);
		onDOMInit(hsBrowserHandler handler, Node xml_dom);
		onDOMMove(hsBrowserHandler handler, String new_parent_id, String new_prev_sibling_id, String moved_node_id);
		onDOMAttrChange(hsBrowserHandler handler, String[] node_id, String[] attr, String[] values);
		onDOMAttrDelete(hsBrowserHandler handler, String[] node_id, String[] attr);
		onValueChange(hsBrowserHandler handler, String node_id, String value);
 * }
 * 
 * Implement this handler in the following order:
 * 1) Implement static part (init)
 * 2) Implement highlight
 * 3) Implement dynamic part (load/unload/pageshow) that can call onDOMInit (when whole page will be loaded)
 * 4) Implement dynamic part 2 (use mutation_summary): changes in 

 * 5) Implement frame support (Don't forget, that frames can be removed/created too, as any other document node)
 * 6) Implement value change event listener for input nodes.
 */



/*hsBrowserHandler*/ function hsCreateBrowserHandler(/*Browser*/br, /*Listener*/ listener, 
		/*long*/ tabId, /*custom filter ignoreCheckFn(Node to check)*/ ignoreCheckFunction)
{	
	var observer;
	var frameobserver = {}; // To store all the frame observers
	var k = 0;
	
	//handling normal content of the browser 'without' frames
	function initializeDocument(doc)
	{		
		docToSend = doc;
		newNodeId = 1;
		
		initializeNodeMap(docToSend.documentElement);
		var xmlDocument = docToSend.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
		var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
		listener.onDOMInit(obj , xmlPayload, tabId);
		
		//observer for the root document
		observer = new MutationSummary({
			  callback: handleChanges,
			  rootNode: docToSend,
			  queries: [{all:true}]
			});
	}
	
	//handling frames
	function handle_frames(doc)
	{
		for (var j = 0; j < doc.defaultView.frames.length; j++)
		{
			frame = doc.defaultView.frames[j];
			
			initializeFrameDocument(frame);
			
			//array of mutation summary observers for the frames
			var temp = new MutationSummary({
				  callback: handleChanges,
				  rootNode: frame.document,
				  queries: [{all:true}]
				});
			
			frameobserver[frame.frameElement._internalNodeId] = temp;
			
			//checking if the frame contains frames within itself
			if (frame.document && frame.document.defaultView.frames && frame.document.defaultView.frames.length > 0 )
			{
				handle_frames(frame.document);
			}
		}
	}
		
	//initialize Frame Document
	function initializeFrameDocument(frame)
	{
		var parent = frame.frameElement;
		if(frame.document && parent && parent._internalNodeId 
			&& frame.document.documentElement && !(frame.document.documentElement._internalNodeId in nodeMap)
			&& (frame.document.readyState =="interactive" || frame.document.readyState =="complete"))
		{
				addEventListeners(frame.document.documentElement);
				initializeNodeMap(frame.document.documentElement);
				var xmlDocument = frame.document.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
				var xmlPayload = createXMLPayload(xmlDocument, frame.document.documentElement);
				if(parent._internalNodeId)
					listener.onDOMUpdate(obj , parent._internalNodeId, "", xmlPayload, tabId);
		}
	}

	/*helper function to print the node Map*/
	function printNodeMap()
	{
		var count = 0;
		for (id in nodeMap)
		{
			count++;
			console.log(id);
		}
		console.log("Total No. of ids:"+count);
		
	}
	
	function handleLoad(event)
	{
		var eventDocument = event.target;
		if(eventDocument == br.contentDocument)
		{
			if(docToSend == null)
			{
				addEventListeners(br.contentDocument.documentElement);
				initializeDocument(br.contentDocument);
			}	
		}
		else
		{
			handle_frames(br.contentDocument);
		}
	}

	function handlePageHide(event)
	{
		docToSend = null;
		/*
		 * Release all the observers on that page
		 * 
		 * */
		delete observer;
		for (frame in frameobserver)
			delete frame;
		delete frameobserver;
		delete temp;
	}

	var newNodeId = 0;

	var nodeMap = {};	// map id -> node

	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	function ClearFrameHighlighting(doc)
	{
		for(var i=0; i<doc.defaultView.frames.length; i++)
		{
			frame = doc.defaultView.frames[i];
			ClearHighlightsDoc(frame.document);
			if (frame.document && frame.document.defaultView.frames && frame.document.defaultView.frames.length > 0 )
			{
				ClearFrameHighlighting(frame.document);
			}
		}
	}
	
	var obj = {
			highlight: function(/*String[]*/ ids)
			{
				// Clear current highlighting, 
				// highlight new set of nodes				         
				for (var index in ids) {
					//We do not want to highlight entire page
					if(ids[index] == 0 )
						continue;
					else
					{
						// Clear current highlighting,
						
						ClearHighlightsDoc(br.contentDocument);
						
						ClearFrameHighlighting(br.contentDocument);
						
						var nodeObject = this.getNode(ids[index]);						                                              
						SetHighlightControl(nodeObject);
					}
				}                
			},
			getNode: function(/*String*/ id)
			{
				if(id in nodeMap)
				{
					return nodeMap[id];
				}
				return null;
			},
			/*String*/getNodeId: function(/*Node*/node)
			{
				return node._internalNodeId;
			},
			getURL: function()
			{
				return br.contentDocument.URL;
			},
			release: /*void*/ function()
			{
				br.removeEventListener('load', handleLoad);
				br.removeEventListener('DOMContentLoaded', handleLoad);
				br.removeEventListener('pageshow', handleLoad);
				br.removeEventListener('pagehide', handlePageHide);
			},
			getBrowser:function() { return br; }
	};


	function copyAttributes(htmlDocNode, xmlDocNode)
	{
		if(htmlDocNode.hasAttributes())
		{
			for(var x=0; x < htmlDocNode.attributes.length ; x++)
			{
				var attributeNode = htmlDocNode.attributes[x];

				//log("Print the attr ->"+attributeNode.value);

				//checks if an element node
				//check if css is there
				/*if(attributeNode.getAttribute("style"))
					{
						log("Gotcha!");
						var attributeToBeRemoved = attributeNode.getAttribute("style");
						if(attributeToBeRemoved.value.search("text/css") != -1)
							{
							log("css found"+attributeToBeRemoved.value);
							}
					}
					log("Element node found in copyAttributes");
				 */

				//put attribute name check here
				if(attributeNode.nodeName.match(/^[A-Za-z0-9_]+$/))	
					xmlDocNode.setAttribute(attributeNode.nodeName,attributeNode.nodeValue);
				else
				{
					log("Invalid attribute name. attribute not copied -> "+attributeNode.nodeName);
					continue;
				}
			}
		}
		return xmlDocNode;
	}

	/**
	 * TODO: Ignore empty nodes where you assign id's when storing nodes in node map
	 * 
	 */
	function createXMLPayload(xmlDocument, documentRootNode)
	{
		/**
		 * Checking for empty nodes
		 */
		//Creates an XML payload in reference to the current node map by traversing the given document
		//log('Creating payload now for document node  : ' + documentRootNode.nodeName);

		var internalNodeId = obj.getNodeId(documentRootNode);

		if(internalNodeId != null)
		{
			//Check if this document node is a text node
			if(documentRootNode.nodeType == 3)
			{
				if(documentRootNode.nodeValue.trim() != '')
				{
					var newTextElement = xmlDocument.createElement("textelement");
					newTextElement.setAttribute("node_id" , internalNodeId);

					//old code to send text node
					//var newtextNode = xmlDocument.createTextNode(documentRootNode.nodeValue);
					//newTextElement.appendChild(newtextNode);

					//send CDATA node instead
					var newCDataNode = xmlDocument.createCDATASection(documentRootNode.nodeValue);
					newTextElement.appendChild(newCDataNode);

					//log("hs_browserhandler CDATA : ]]" + (new XMLSerializer().serializeToString(newTextElement)));
					return newTextElement;
				}            
			}
			else
			{
				var xmlRootNode = xmlDocument.createElement(documentRootNode.nodeName);
				xmlRootNode = copyAttributes(documentRootNode, xmlRootNode);
				xmlRootNode.setAttribute("node_id",internalNodeId);
				for(var x=0 ; x < documentRootNode.childNodes.length ; x++)
				{
					var childNode = documentRootNode.childNodes[x];
					var elementToAppend = createXMLPayload(xmlDocument, childNode);
					if(elementToAppend != null)
					{
						xmlRootNode.appendChild(elementToAppend);
					}
				}
				//log("Returning xmlRootNode : " + xmlRootNode);
				return xmlRootNode;
			}
		}
		else
		{
			//log("Returning null for xmlRootNode : " + documentRootNode.nodeName);
			return null;
		}
	}

	/**
	 * Initialize the node map from the document tree provided and filter nodes with the provided filter callback
	 */
	function initializeNodeMap(root)
	{
		if(ignoreCheckFunction(root))
			return;

		//log('Initializing node map for document node : ' + root.nodeName + " with value : " + root.nodeValue + " and type : " + root.nodeType);
		//Invoke specified filter that checks if the given node must be ignored or not
		nodeMap[newNodeId] = root;
		root._internalNodeId = newNodeId;
		newNodeId++;

		if(root.hasChildNodes())
			for(var x=0; x<root.childNodes.length; x++)
				initializeNodeMap(root.childNodes[x]);
	}

	function log(msg) 
	{	
		consoleService.logStringMessage("brhandler] "+msg);	
	}

	// TODO: add implementation.
	// use br events to control load page process,
	// use mutation observer to control page mutations

	//log('hsCreateBrowserHandler invoked with document status : ' + document.readyState);

	var docToSend = null;

	if(br.contentDocument.readyState === "complete" || br.contentDocument.readyState === "interactive")
	{
		//log('document loading is now complete : ' + br.contentDocument.readyState + 'with URL as ' + br.contentDocument.URL);
		docToSend = br.contentDocument;
		initializeNodeMap(br.contentDocument.documentElement);
		var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
		//log(br.contentDocument.body.hasChildNodes());
		var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
		//log("This was the payload generated : " + xmlPayload);
		listener.onDOMInit(obj , xmlPayload, tabId);
	}
	
	function handleChanges(summaries)
	{
		var summary = summaries[0];
		
		updateDOM(summary);
		deleteDOM(summary);
		attrChange(summary);
		moveDOM(summary);
	}
	
	function  updateDOM(summary)
	{
		var elements = [];
		var parents = [];
		var siblings = [];
		
		summary.added.forEach(function(element)
		{					
			var parent = element.parentNode;
			var sibling = element.previousSibling;
			if(parent && parent._internalNodeId && !find(parent,elements))
			{
				elements.push(element);
				parents.push(parent);
				siblings.push(sibling);
			}
		}); 
		
		handleAddedElements(elements,parents,siblings);
	}

	function moveDOM(summary)
	{
		var elements = [];
		var parents = [];
		var siblings = [];
		
		summary.reparented.forEach(function(reparent)
		{
			var parent = reparent.parentNode;
			var sibling = reparent.previousSibling;
			
			if(parent && parent._internalNodeId && !find(parent,elements))
			{
				elements.push(reparent);
				parents.push(parent);
				siblings.push(sibling);
			}
			
		});
		 		
 		summary.reordered.forEach(function(reorder)
		{
 			var parent = reorder.parentNode;
			var sibling = reorder.previousSibling;
			
			if(parent && parent._internalNodeId && !find(parent,elements))
			{
				elements.push(reorder);
				parents.push(parent);
				siblings.push(sibling);
			}
		});
 		
 		handleMovedElements(elements,parents,siblings);
 		
	}
	
	function handleMovedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var new_prev_sibling_id = "";
			var moved_node_id = elements[j]._internalNodeId;
			
			if(parents[j]._internalNodeId)
			{
				var new_parent_id = parents[j]._internalNodeId;
			}
			if(siblings[j] && siblings[j]._internalNodeId)
			{
				new_prev_sibling_id = siblings[j]._internalNodeId;
			}
			if(new_parent_id)
				listener.onDOMMove(obj , new_parent_id, new_prev_sibling_id, moved_node_id , tabId);
		}
	}
	
	function handleAddedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var prev_sibling_id = "";	
			initializeNodeMap(elements[j]);
			var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
			var xmlPayload = createXMLPayload(xmlDocument, elements[j]);
			if(xmlPayload)
			{
				if(parents[j]._internalNodeId)
				{
					var parent_id = parents[j]._internalNodeId;
				}
				if(siblings[j] != null && siblings[j]._internalNodeId)
				{ 
					prev_sibling_id = siblings[j]._internalNodeId;
				}
				if (parent_id)
					listener.onDOMUpdate(obj , parent_id, prev_sibling_id, xmlPayload, tabId);
			}
		}
	}
	
	function deleteDOM(summary)
	{
		var removed = [];
		summary.removed.forEach(function(removedEl)
		{
			if(removedEl._internalNodeId)
			{
				removed.push(removedEl._internalNodeId);
				delete frameobserver[removedEl._internalNodeId];
				delete nodeMap[removedEl._internalNodeId];
			}
	    });
		
		if(removed.length > 0)
			listener.onDOMDelete(obj , removed, tabId);
	}
	
	function attrChange(summary)
	{
		var node_id = [];
		var attr = [];
		var values = [];
		var removed_node_id = [];
		var removed_attr = [];
		var k = 0;
		Object.keys(summary.attributeChanged).forEach(function(attrName)
		{
			for(var j = 0; j < summary.attributeChanged[attrName].length; j++)
			{				
	            if(summary.attributeChanged[attrName][j].getAttribute(attrName) &&
	            		summary.attributeChanged[attrName][j]._internalNodeId)
	            {
		            node_id.push(summary.attributeChanged[attrName][j]._internalNodeId);
		            attr.push(attrName);
		            values.push(summary.attributeChanged[attrName][j].getAttribute(attrName));
	            }
	            else if(summary.attributeChanged[attrName][j]._internalNodeId)
	            {
	            	removed_node_id[k] = summary.attributeChanged[attrName][j]._internalNodeId;
		            removed_attr[k] = attrName;
		            k++;
	            }
			}
		});	
		
		if(node_id.length > 0)
			listener.onDOMAttrChange(obj, node_id, attr, values, tabId);
		if(removed_node_id.length > 0)
			listener.onDOMAttrDelete(obj, removed_node_id, removed_attr, tabId);
	}
	
	/*
	 * Recursively checking for the root node of te sub-tree which has been modified
	 * 
	 * */
	function find(parent,elements)
	{
		for(var j=0; j<elements.length; j++)
		{
			if(elements[j]==parent)
			{ 
				return true;
			}
		}
		return false;
	}
	
	function addEventListeners(doc)
	{
	    doc.addEventListener("change", onChangeValue, false);
	    doc.addEventListener("change", onChangeValue, true);
	    doc.addEventListener("input", onChangeValue, false);
	    doc.addEventListener("input", onChangeValue, true);
	}
	
	function onChangeValue(e)
	{
		console.log("Value changed for:"+e.target+" having node id: "+e.target._internalNodeId+" with value: "+e.target.value);
		listener.onValueChange(obj, e.target._internalNodeId, e.target.value, tabId);
	}
	
	/**
	 * Update part of document, receive load as well as DOMContentLoad
	 */
	br.addEventListener('load', handleLoad, false);
	br.addEventListener('DOMContentLoaded', handleLoad, false);
	br.addEventListener('pageshow', handleLoad, false);
	br.addEventListener('pagehide', handlePageHide, false);

	return obj;
}