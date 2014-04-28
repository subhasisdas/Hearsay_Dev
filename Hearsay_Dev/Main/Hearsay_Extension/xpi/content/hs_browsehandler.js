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
	var frameobserver = {};
	var k = 0;
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	//handling normal content of the browser 'without' frames
	function initializeDocument()
	{
		observer = new MutationSummary({
		  callback: handleChanges,
		  rootNode: br.contentDocument,
		  queries: [{all:true}]
		});
		newNodeId = 1;
		docToSend = br.contentDocument;
		initializeNodeMap(br.contentDocument.documentElement);
		var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
		var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
		listener.onDOMInit(obj , xmlPayload, tabId);
	}
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	//handling frames
	function initializeFrameDocument()
	{
		for (var j = br.contentDocument.defaultView.frames.length-1; j >= 0; j--)
		{
			docToSend = br.contentDocument.defaultView.frames[j].document;
			//array of mutation summary observers for the frames
			frameobserver[k] = new MutationSummary({
				  callback: handleChanges,
				  rootNode: docToSend,
				  queries: [{all:true}]
				});
			k++;
			if(!(docToSend.documentElement._internalNodeId in nodeMap))
			{
				initializeNodeMap(docToSend.documentElement);
				var xmlDocument = docToSend.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
				var xmlPayload = createXMLPayload(xmlDocument, docToSend.documentElement);
				var parent = br.contentDocument.defaultView.frames[j].frameElement.parentNode;
				var parent_id = "";
				if(parent != null && parent._internalNodeId != undefined)
				{
					parent_id = br.contentDocument.defaultView.frames[j].frameElement.parentNode._internalNodeId;
				}
				listener.onDOMUpdate(obj , parent_id, "", xmlPayload, tabId);
			}
		}
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	}

	//common functionlity
	function handleLoad(event)
	{
		var eventDocument = event.target;
		if(eventDocument == br.contentDocument)
		{
			if(docToSend == null)
			{
				initializeDocument();
			}
<<<<<<< HEAD

=======
			
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		}
		else
		{
			initializeFrameDocument();	
		}
	}

	function handlePageHide(event)
	{
		docToSend = null;
		// Release Mutation observer??
		delete observer;
		frameobserver = {};
		delete frameobserver;
	}

	var newNodeId = 0;

	var nodeMap = {};	// map id -> node

	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	var obj = {
			highlight: function(/*String[]*/ ids)
			{
				// Clear current highlightning, 
				// highlight new set of nodes				         
				for (var index in ids) {
					//We do not want to highlight entire page
					if(ids[index] == 0 )
						continue;
					else
					{
						// Clear current highlighting,
<<<<<<< HEAD

						ClearHighlightsDoc(br.contentDocument);		

=======
						
						ClearHighlightsDoc(br.contentDocument);		
						
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
						for(var i=0; i<br.contentDocument.defaultView.frames.length; i++)
						{
							ClearHighlightsDoc(br.contentDocument.defaultView.frames[i].document);
						}
<<<<<<< HEAD

=======
						
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
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
				xmlDocNode.setAttribute(attributeNode.nodeName,attributeNode.nodeValue);
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
					var newtextNode = xmlDocument.createTextNode(documentRootNode.nodeValue);
					newTextElement.appendChild(newtextNode);
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
		log("This was the payload generated : " + xmlPayload);
		listener.onDOMInit(obj , xmlPayload, tabId);
	}
<<<<<<< HEAD

	function handleChanges(summaries)
	{
		var summary = summaries[0];

=======
	
	function handleChanges(summaries)
	{
		var summary = summaries[0];
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		updateDOM(summary);
		deleteDOM(summary);
		attrChange(summary);
		moveDOM(summary);
	}
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	function updateDOM(summary)
	{
		var elements = new Array();
		var parents = new Array();
		var siblings = new Array();
		var i = 0;
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		summary.added.forEach(function(element)
		{					
			var parent = element.parentNode;
			var sibling = element.previousSibling;
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = element;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
		}); 
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		handleAddedElements(elements,parents,siblings);
	}

	function moveDOM(summary)
	{
		var elements = new Array();
		var parents = new Array();
		var siblings = new Array();
		var i = 0;
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		summary.reparented.forEach(function(reparent)
		{
			var parent = reparent.parentNode;
			var sibling = reparent.previousSibling;
<<<<<<< HEAD

=======
			
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = reparent;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
<<<<<<< HEAD

		});

=======
			
		});
		 		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
 		summary.reordered.forEach(function(reorder)
		{
 			var parent = reorder.parentNode;
			var sibling = reorder.previousSibling;
<<<<<<< HEAD

=======
			
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
			if(parent != null && parent._internalNodeId != undefined && !find(parent,elements))
			{
				elements[i] = reorder;
				parents[i] = parent;
				siblings[i] = sibling;
				i++;
			}
		});
 		
 		handleMovedElements(elements,parents,siblings);
 		
	}
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	function handleMovedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var new_parent_id = "";
			var new_prev_sibling_id = "";
			var moved_node_id = elements[j]._internalNodeId;
<<<<<<< HEAD

=======
			
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
			if(parents[j]._internalNodeId != undefined)
			{
				new_parent_id = parents[j]._internalNodeId;
			}
			if(siblings[j] != null && siblings[j]._internalNodeId != undefined)
			{
				new_prev_sibling_id = siblings[j]._internalNodeId;
			}
<<<<<<< HEAD

			listener.onDOMMove(obj , new_parent_id, new_prev_sibling_id, moved_node_id , tabId);
		}
	}

=======
			
			listener.onDOMMove(obj , new_parent_id, new_prev_sibling_id, moved_node_id , tabId);
		}
	}
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	function handleAddedElements(elements,parents,siblings)
	{
		for(var j = 0; j < elements.length; j++)
		{
			var parent_id = "";
			var prev_sibling_id = "";	
			initializeNodeMap(elements[j]);
			var xmlDocument = br.contentDocument.implementation.createDocument('http://www.w3.org/1999/xhtml','HTML', null);
			var xmlPayload = createXMLPayload(xmlDocument, elements[j]);
			if(xmlPayload != null)
			{
				if(parents[j]._internalNodeId != undefined)
				{
					parent_id = parents[j]._internalNodeId;
				}
				if(siblings[j] != null && siblings[j]._internalNodeId != undefined)
				{
					prev_sibling_id = siblings[j]._internalNodeId;
				}
				listener.onDOMUpdate(obj , parent_id, prev_sibling_id, xmlPayload, tabId);
			}
		}
	}
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	function deleteDOM(summary)
	{
		var removed = new Array();
		var i = 0;
		summary.removed.forEach(function(removedEl)
		{
<<<<<<< HEAD

=======
			
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
			if(removedEl._internalNodeId != undefined)
			{
				removed[i] = removedEl._internalNodeId;
				delete nodeMap[removed[i]];
				i++;
			}
	    });
<<<<<<< HEAD

		if(removed.length > 0)
			listener.onDOMDelete(obj , removed, tabId);
	}

=======
		
		if(removed.length > 0)
			listener.onDOMDelete(obj , removed, tabId);
	}
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	function attrChange(summary)
	{
		var node_id = new Array();
		var attr = new Array();
		var values = new Array();
		var removed_node_id = new Array();
		var removed_attr = new Array();
		var i = 0, k = 0;
		Object.keys(summary.attributeChanged).forEach(function(attrName)
		{
			for(var j = 0; j < summary.attributeChanged[attrName].length; j++)
			{				
<<<<<<< HEAD
	            if(summary.attributeChanged[attrName][j].getAttribute(attrName) && summary.attributeChanged[attrName][j]._internalNodeId)
=======
	            if(summary.attributeChanged[attrName][j].getAttribute(attrName))
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	            {
		            node_id[i] = summary.attributeChanged[attrName][j]._internalNodeId;
		            attr[i] = attrName;
		            values[i] = summary.attributeChanged[attrName][j].getAttribute(attrName);
		            i++;
	            }
<<<<<<< HEAD
	            else if(summary.attributeChanged[attrName][j]._internalNodeId)
=======
	            else
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	            {
	            	removed_node_id[k] = summary.attributeChanged[attrName][j]._internalNodeId;
		            removed_attr[k] = attrName;
		            k++;
	            }
			}
		});	
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
		if(node_id.length > 0)
			listener.onDOMAttrChange(obj, node_id, attr, values, tabId);
		if(removed_node_id.length > 0)
			listener.onDOMAttrDelete(obj, removed_node_id, removed_attr, tabId);
	}
<<<<<<< HEAD

=======
		
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
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
<<<<<<< HEAD

=======
	
>>>>>>> 4c9b0b0b2337b0b23d4664b360bf73449295b926
	/**
	 * Update part of document, receive load as well as DOMContentLoad
	 */

	br.addEventListener('load', handleLoad, false);
	br.addEventListener('DOMContentLoaded', handleLoad, false);
	br.addEventListener('pageshow', handleLoad, false);
	br.addEventListener('pagehide', handlePageHide, false);

	return obj;
}