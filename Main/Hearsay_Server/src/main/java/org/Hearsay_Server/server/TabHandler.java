package org.Hearsay_Server.server;
//package interfaces;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;
import java.util.Map;
import java.util.List;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.Hearsay_Server.interfaces.IDomIterator;
import org.Hearsay_Server.interfaces.IDomIterator;
import org.Hearsay_Server.interfaces.IMessageChannel;
import org.Hearsay_Server.interfaces.ITabHandler;

public class TabHandler implements ITabHandler
{
	public static final String NODE_ID_ATTR = "node_id";

	private final long globalId;
	private long base;
	private int offset;
	private final long  tabId;
	private final IMessageChannel channel;

	private Document document;
	private final Map<Integer/*NodeId*/,Node> nodeMap = new HashMap<Integer,Node>();
	private IDomIterator iterator = null;
	private boolean active = false;
	private boolean initializedAtleastOnce = false;
	private boolean pauseMode = false;
	/*moved from Message Channel interface*/
	private int newTextId = 1;
	private ArrayList<Long> text_id_bucket = new ArrayList<Long>();

	public TabHandler(long gId, long id, IMessageChannel ch)
	{
		globalId = gId;
		tabId = id;
		channel = ch;
		base = globalId*100;
		offset = 1;
	}

	@Override
	public IMessageChannel getChannel()	{ return channel; }

	@Override
	public long getGlobalId()	{ return globalId; }	

	@Override
	public long getId()	{ return tabId; }

	public void updateNodeMap(Element element)
	{
		if(element != null)
		{
			String nodeId = element.getAttribute(NODE_ID_ATTR);
			nodeMap.put(Integer.parseInt(nodeId), element);
			NodeList nodeList = element.getChildNodes();
			for(int index = 0; index < nodeList.getLength(); index++)
			{
				Node currentNode = nodeList.item(index);
				if (currentNode.getNodeType() == Node.ELEMENT_NODE)
				{
					Element currentElement = (Element) currentNode;
					updateNodeMap(currentElement);
				}
			}
		}
	}
	
	private void process_Update_Attr(List<Integer> nodeIds, List<String> attr, List<String> values) throws Exception
	{		
		for(int i=0;i<nodeIds.size();i++)
		{
			Element current = (Element)getNodebyID(document.getFirstChild(),nodeIds.get(i).toString());
			current.setAttribute(attr.get(i), values.get(i));
			
			//check if iterator is not null and the node attr being changed is inside the sub-tree
			if(iterator.getPos()!=null && findIfPreDecessor(nodeMap.get(nodeIds.get(i)), iterator.getPos()))
			{
				//case when updated attribute is being spoken; move to next element
				iterator.next();
			}
		}
		
	}
	/*
	private void process_Delete_Attr(Message msg) throws Exception
	{
	TODO : ask if 3 LOC has to be kept here or down	
	}
	*/
	
	private void process_Dom_Update(Node updateTree, String parentID, String siblingID) throws Exception
	{

    	document.importNode(updateTree, true);
    	document.adoptNode(updateTree);	        	
		Node appendedSubTree=appendSubTree(document.getFirstChild(), updateTree, parentID, siblingID);
		
		if(appendedSubTree!=null)
		{				
			updateNodeMap(document.getDocumentElement()); //if tree appended/updated successfully then call updateNodeMap
			Element currentNode = (Element) updateTree;
			//Node iteratorNode = getNodebyID(getNodebyID(document.getFirstChild(),currentNode.getAttribute("node_id")), getNodeId(iterator.getPos())+"");
			if(findIfPreDecessor( nodeMap.get(Integer.parseInt(currentNode.getAttribute("node_id"))),iterator.getPos()))
					iterator.next();
					//process_iterator(iterator,iteratorNode);
			
		}
	}
	
	private void process_Dom_Delete(List<Integer> listNodes) throws Exception
	{
		for(int i=0;i<listNodes.size();i++)
		{
			Node deletedNode=nodeMap.get(listNodes.get(i));//getNodebyID(document.getFirstChild(), listNodes[i]);
			System.out.println(deletedNode);
			if(deletedNode!=null)
			{
				if(findIfPreDecessor(deletedNode,iterator.getPos()))
				{
					iterator.next();
				}
				DeleteSubTree(document.getFirstChild(), listNodes.get(i));				
			}
		}
	}
	
	private boolean findIfPreDecessor(Node parent, Node child) //change to PreDecessor !!
	{
		if(parent==null)
			return false;
		
		while(child!=null) 
		{
			if(child == parent)
				return true;
			child=child.getParentNode();
		}
		return false;
	}
	
	public Node getNodebyID(Node root,String id)
	{
		if(root.hasAttributes()) 
		{	
			Element e=(Element) (Node)root;
			String currentID="-1";
			if(e.getAttribute(NODE_ID_ATTR)!="") //to ensure if node_id exists
				currentID = e.getAttribute(NODE_ID_ATTR); //get node_id of current id	
			if(currentID.equals(id))
				return root; // if the node_id matches, node is found. Return the node
		}	
		//if node not found/has no attributes, search its children recursively
		NodeList childNodes = root.getChildNodes(); //get child nodes		
		for(int i = 0; i < childNodes.getLength(); i++)
		{
			Node currentNextNode = getNodebyID(childNodes.item(i),id); //check for a node recursively, if its the node to be found
			if(currentNextNode != null)
				return currentNextNode; //return the node if found
		}
		return null; //return null if node not found
	}
	
	public void DeleteSubTree(Node root,Integer node_id)
	{
		Node nodeToBeDeleted = nodeMap.get(node_id);//getNodebyID(root,node_id);		
		if(nodeToBeDeleted!=null)
		{
			nodeToBeDeleted.getParentNode().removeChild(nodeToBeDeleted);
			updateDeleteNodeMap((Element)root);
		}				
	}
	
	private void updateDeleteNodeMap(Element element)
	{
		if(element != null)
		{
			String nodeId = element.getAttribute(NODE_ID_ATTR);			
			NodeList nodeList = element.getChildNodes();
			for(int index = 0; index < nodeList.getLength(); index++)
			{
				Node currentNode = nodeList.item(index);
				if (currentNode.getNodeType() == Node.ELEMENT_NODE)
				{
					Element currentElement = (Element) currentNode;
					updateDeleteNodeMap(currentElement);
				}
			}
			nodeMap.remove(Integer.parseInt(nodeId));
		}
	}
	
	private void process_Dom_Move(int parentIDm,String siblingIDm,String nodeIDm)
	{
		Node parentUpdated = nodeMap.get(parentIDm);
    	Node siblingToBe = getNodebyID(parentUpdated,siblingIDm);
    	Node movedDom = nodeMap.get(Integer.parseInt(nodeIDm));
    	if((siblingToBe==null || siblingIDm.isEmpty()) && movedDom!=null )
    		parentUpdated.appendChild(movedDom);
    	else if(movedDom!=null)
    		parentUpdated.insertBefore(movedDom, siblingToBe);	
	}
	
	public List<Integer> convertToIntegerList(List<String> listStr)
	{
		List<Integer> listNodes = new ArrayList();
		for(int i=0;i<listStr.size();i++)
			listNodes.add(Integer.parseInt(listStr.get(i)));
		return listNodes;
	}
	
	private void process_iterator(IDomIterator iterator, Node iteratorNode) throws Exception
	{
		if(iteratorNode!=null)
		{
			//iterator.setPos(iterator.getPos().getParentNode().getFirstChild());
			try { iterator.next(); } catch(Exception e){}
			{
				String nodeValueToSendPI = null;
				if(iterator.getPos().getNodeName().equals("textelement"))
				{								
					nodeValueToSendPI = iterator.getPos().getTextContent();
				}
				else
				{
					boolean nextNodeExists = iterator.next();
					if(nextNodeExists)
					{
						nodeValueToSendPI = iterator.getPos().getTextContent();
					}					
				}
				if(nodeValueToSendPI != null)
				{
					try{speak(nodeValueToSendPI);hightLight(getNodeId(iterator.getPos()));} catch(Exception e){}					
					//speakAndHighlightNode(nodeValueToSend);
				}
				
			}
		}
	}
	
	public Node appendSubTree(Node root, Node updateTree, String parentID,String leftID)
	{
		Node parent = nodeMap.get(Integer.parseInt(parentID));//getNodebyID(root,parentID); //finding the parent node of child to be updated / appended
		if(parent==null) 
			return null; //if parent not found then return null
		NamedNodeMap at = updateTree.getAttributes(); //get attributes(node_id) of root updated tree 		
		/* Logic to update(replace) subtree if it already exists */
		if(at!=null)
		{
			String id = at.getNamedItem(NODE_ID_ATTR).getTextContent(); //get the value of node_id			
			Node updateNode=getNodebyID(root,id); //check if the updateTree node already exists
			
			if(updateNode!=null && updateNode.getParentNode()==parent) //if node already exists, replace the node subtree
			{
				updateNode.getParentNode().replaceChild(updateTree, updateNode); //replace old tree with new tree
				return updateTree; //return root of updated subtree
			}
		}
		else		
			return null; //return null as no valid node_id for updated tree
		/* Logic to insert subtree if subtree doesn't exist */
		if(leftID.isEmpty()) // special case where we want to insert new node as the first child(as it has no left sibling)
		{
			parent.insertBefore(updateTree, parent.getFirstChild()); //inserting before 1st child of parent
			return updateTree; 
		}
		//if not the first node; find the sibling and append after that
		else
		{
			Node prevSibling=getNodebyID(parent,leftID); //find the location of previous sibling specified			
			if(prevSibling!=null && prevSibling.getParentNode()==parent) //inserting after the specified sibling
			{
				parent.insertBefore(updateTree, prevSibling.getNextSibling());
				return updateTree;
			}
			else
				return null;
		}		
	}




	@Override
	public synchronized void onReceive(Message msg) throws Exception
	{
		// TODO: process all messages, related to tab (see msg types)
		System.out.println("Tabhandler Onreceive");
		switch(msg.type)
		{
		case INIT_DOM:
			Node payload = msg.payload;
			processINIT_DOM(payload);
			break;
		case KEY:
			System.out.println("Key press event");
			processKeyPress(msg);
			break;
		case MOUSE:
			System.out.println("MOUSE EVENT");
			processMouseEvent(msg);
			break;
		case UPDATE_DOM:
			// TODO: update Docunent and nodeMap. check, that iterator.getPos() is not inside updated tree
			// if it is, then update iterator
			Node updateTree = msg.payload;
			//NOTE TO ASK : Types have been kept as String bcoz sometimes siblindID = ""; parseInt will fail in valid cases causing exception
	    	String parentID = msg.getArguments().get("parent_id").get(0);
	    	String siblingID = msg.getArguments().get("sibling_id").get(0);	    	
			process_Dom_Update(updateTree,parentID,siblingID);
			break;
		case DELETE_DOM:
			// TODO: update Docunent and nodeMap. check, that iterator.getPos() is not inside updated tree
			// update iterator
			List<String> listNodesStr = msg.getArguments().get("node_ids");
			List<Integer> listNodes = convertToIntegerList(listNodesStr);
			process_Dom_Delete(listNodes);		
			break;
		case MOVE_DOM:
			// TODO: update Docunent.
			int parentIDm = Integer.parseInt(msg.getArguments().get("parent_id").get(0));
	    	String siblingIDm = msg.getArguments().get("sibling_id").get(0);
	    	String nodeIDm = msg.getArguments().get("node_id").get(0);
	    	process_Dom_Move(parentIDm, siblingIDm, nodeIDm);
			break;
		case UPDATE_ATTR:
			// TODO: update Docunent.			
			List<String> nodeIdsString = msg.getArguments().get("node_id");
			List<String> attr = msg.getArguments().get("attr");
			List<String> values = msg.getArguments().get("values");
			List<Integer> nodeIds = convertToIntegerList(nodeIdsString);
					
			process_Update_Attr(nodeIds,attr,values);
			break;
		case DELETE_ATTR:
			// TODO: update Docunent.
			List<String> nodeIdsStri = msg.getArguments().get("node_id");
			List<String> Attr = msg.getArguments().get("attr");
			List<Integer> nodeInt = convertToIntegerList(nodeIdsStri);
			
			for(int i=0;i<nodeInt.size();i++){
				Element current = (Element)nodeMap.get(nodeInt.get(i));//getNodebyID(document.getFirstChild(),nodeInt.get(i));
				current.removeAttribute(Attr.get(i));			
			}
			//process_Delete_Attr(msg);
			break;
		case CHANGE_VALUE:
			// TODO: update Docunent. if iterator points to this input element,
			// re-read its value.
			break;
		case TTS_DONE:
			processTTSDone(msg);
			break;
			/**
			 * TTS_DONE
			 */
		
		case FOCUS:
			break;
		case SET_HIGHLIGHT:
			break;
		case TTS_CANCEL:
			break;
		case TTS_SPEAK:
			break;
		default:
			break;
		}
	}

	@Override
	public void release() 
	{
		// TODO: release all resources
		channel.release();
		document = null;
		nodeMap.clear();
	}

	@Override
	public Node getNode(int id) 
	{
		return nodeMap.get(id);
	}

	@Override
	public int getNodeId(Node node)
	{
		return Integer.parseInt(((Element)node).getAttribute(NODE_ID_ATTR));
	}

	@Override
	public Node getRootNode() 
	{
		return document.getDocumentElement();
	}

	@Override
	public synchronized void activate() throws Exception 
	{
		System.out.println("Activate tab : " + tabId);
		if(active)
			return;
		active = true;
		if(!pauseMode && initializedAtleastOnce && (iterator.getPos() != null))
		{
			String nodeValueToSend = iterator.getPos().getTextContent();
			if(nodeValueToSend != null)
			{
				speak(nodeValueToSend);
				hightLight(0);
				System.out.println("Highlight Message sent on ACTIVATE"); 
			}
		}
	}

	@Override
	public void deactivate() 
	{
		System.out.println("Deactivate tab : " + tabId);
		if(!active)
			return;
		active = false;
		// TODO: cancel speaking
	}

	@Override
	public synchronized int getNextTextId()
	{
		int nextTextId = newTextId;
		newTextId++;
		return nextTextId;
	}

	/**
	 * 	Speaks the input parameter.
	 * 	@param String This attribute stores the text content of the node and its descendants
	 *  @return void
	 */
	public void speak(String nodeValueToSend) throws Exception{
		//System.out.println("highlighting");
		Message ttsSpeakMessage = new Message(MessageType.TTS_SPEAK, tabId);
		ArrayList<String> textParameter = new ArrayList<String>();
		textParameter.add(nodeValueToSend);
		System.out.println("[TabHandler Server] : Node value to be sent :"+ nodeValueToSend);
		ArrayList<String> textIdParameter = new ArrayList<String>();
		//System.out.println("Text Id :"+Long.toString(globalId));
		Long text_Id = base+(2*(++offset));
		textIdParameter.add(Long.toString(text_Id));
		ttsSpeakMessage.getArguments().put("text", textParameter);
		ttsSpeakMessage.getArguments().put("text_id", textIdParameter);

		//new code added to fix the iterator bug
		//text_id_bucket.add(text_Id);

		//if (text_id_bucket.size()!=0){
		System.out.println("[TabHandler Server Speak] : text- "+ textParameter +"   :: text_id- "+ textIdParameter );
		channel.send(ttsSpeakMessage);
		//	}

		// new code ends		

		//original code - commented
		//channel.send(ttsSpeakMessage);

	}	

	private int setHighlight(int nodeIdToSend){
		String ss = " ";
		if((iterator.getPos() == null))
		{
			System.out.println("node id is 0");
			return 0;
		}
		if(iterator.getPos().getNodeName().equals("textelement"))
		{
			nodeIdToSend = getNodeId(iterator.getPos().getParentNode());
			ss = iterator.getPos().getTextContent();
			System.out.println("[TabHandler Server SetHighlight] Text highlighted :" + ss);
		}
		else
		{
			nodeIdToSend = getNodeId(iterator.getPos());
		}
		return nodeIdToSend;
	}

	/**
	 * 	highlight the input parameter.
	 * 	@param String This attribute stores the text content of the node and its descendants
	 *  @return void
	 */
	private void hightLight(int nodeId) throws Exception{

		Message highlightMessage = new Message(MessageType.SET_HIGHLIGHT, tabId);
		ArrayList<String> nodeToHighlight = new ArrayList<String>();
		int nodeIdToSend = 0;	
		if(nodeId == 0){
			//sending the highlight text
			nodeIdToSend = setHighlight(nodeIdToSend);
		}
		else{
			nodeIdToSend = nodeId;
		}
		System.out.println("[TabHandler Server] : NodeID highlighted is "+ Integer.toString(nodeIdToSend));
		nodeToHighlight.add(Integer.toString(nodeIdToSend));
		highlightMessage.getArguments().put("node_id", nodeToHighlight);

		/*while(text_id_bucket.size() ==1){*/
		channel.send(highlightMessage);
		//}
	}

	private void processINIT_DOM(Node payload) throws Exception{
		if(payload != null)
		{
			Node documentPayload = payload.cloneNode(true);
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
			DocumentBuilder builder = factory.newDocumentBuilder();
			document = builder.newDocument();
			Node importedNode = document.importNode(documentPayload, true);
			document.appendChild(importedNode);
			//Recursively traverse the document and update the nodeMap
			Element documentElement = document.getDocumentElement();
			updateNodeMap(documentElement);
			iterator = new NewDomIterator(this);
			for(;iterator.getPos() != null;)
			{
				System.out.println(getNodeId(iterator.getPos())+">>> "+ iterator.getPos().getTextContent());
				if(!iterator.next())
					break;
			}
			iterator.begin();
			//Sending TTS_SPEAK to extension
			if(active)
			{
				String nodeValueToSend = null;
				if((iterator.getPos() == null))
				{
					System.out.println("node id is 0");
					return ;
				}
				if(iterator.getPos().getNodeName().equals("textelement"))
				{
					nodeValueToSend = iterator.getPos().getTextContent();
				}
				else
				{
					boolean nextNodeExists = iterator.next();
					if(nextNodeExists)
					{
						nodeValueToSend = iterator.getPos().getTextContent();
					}
				}
				if(nodeValueToSend != null)
				{
					speak(nodeValueToSend);
					//hightLight(0);
					System.out.println("Highlight Message sent at INIT_DOM"); 

				}
			}
			initializedAtleastOnce = true;
		}
		else
		{
			throw new Exception("An INIT DOM message was received with an invalid payload");
		}
	}

	private void processKeyPress(Message msg) throws Exception{
		System.out.println("Key Press");
		String nodeValueToSend = "";
		int node_Id =0;
		if(active)
		{
			String keyPressed = msg.getArguments().get("press").get(0);
			System.out.println("Key Pressed now"+ keyPressed);
			if(keyPressed != null & !keyPressed.isEmpty())
			{
				if(keyPressed.equals("keyPressed Insert"))
				{
					System.out.println("KeyEvent "+ keyPressed);
					if(pauseMode)
					{
						pauseMode = false;
						nodeValueToSend = iterator.getPos().getTextContent();
						/*	if(nodeValueToSend != null)
						{
							System.out.println("Speaking!");
							speak(nodeValueToSend);
							System.out.println("highlighting");
							hightLight(0);
							System.out.println("Highlight Message sent on KEY PAUSE"); 
						}*/
					}
					else
					{
						pauseMode = true;
						System.out.println("PAUSE MODE ENABLED");
					}
				}

				else if(keyPressed.equals("keyPressed Up"))
				{
					//System.out.println("Keypressed up");
					iterator.prev();
					
				}
				else if(keyPressed.equals("keyPressed Down"))
				{
					//System.out.println("Keypressed Down");
					iterator.next();
				
				}
				else
				{
					//System.out.println("Speaking in second flag");
					speak(keyPressed);
					//System.out.println("highlightng in second flag");
					hightLight(node_Id);
				}

				if(nodeValueToSend != null)
				{
					System.out.println("Speaking!");
					speak(nodeValueToSend);
					System.out.println("highlighting");
					hightLight(node_Id);
					System.out.println("Highlight Message sent on KEY PAUSE"); 
				}
			}
		}
	}

	private void processMouseEvent(Message msg) throws Exception{
		System.out.println("Inside mouse");
		int nodeClickedId = Integer.parseInt(msg.getArguments().get("id").get(0));
		System.out.println("nodeClick :"+nodeClickedId);
		Node newPosition = nodeMap.get(nodeClickedId);
		System.out.println("newPos: "+newPosition);
		String ele = newPosition.getTextContent();
		String nodeValueToSend = null;
		if(ele.isEmpty() || ele == "" || ele==null)
			System.out.println("No node for "+nodeClickedId);
		else/*(newPosition != null)*/
		{
			System.out.println("flag!");
			boolean positionUpdated = iterator.setPos(newPosition);
			if(positionUpdated)
			{
				Node currentNode = iterator.getPos();
				if(currentNode != null)
				{
					nodeValueToSend = currentNode.getTextContent();
				}
				if(nodeValueToSend == null){
					System.out.println("NULL MOUSE CLICK");
				}
				else
				{
					speak(nodeValueToSend);
					hightLight(0);
					System.out.println("Highlight Message sent on MOUSE CLICK"); 

				}
			}
		}
	}

	private void processTTSDone(Message msg) throws Exception{
		long text_id = Long.parseLong(msg.getArguments().get("text_id").get(0)); 

		System.out.println("Received a TTS_DONE message with pauseMode : " + pauseMode);
		System.out.println("Received a TTS Done message for text_id" + text_id );
		if(active && !pauseMode)
		{
			/*System.out.println("in loop");
			if(text_id_bucket.contains(text_id)){
				System.out.println(text_id + "found.removing..");
				text_id_bucket.remove(text_id);
			}*/
			System.out.println("beginning iterator");
			if(iterator.next())
			{
				String ttsDoneNodeValueToSend = iterator.getPos().getTextContent();
				if(ttsDoneNodeValueToSend == null || ttsDoneNodeValueToSend.equals(null)){
					System.out.println("NULL TABHANDLER FLAG");
				}
				else if(ttsDoneNodeValueToSend != null || !ttsDoneNodeValueToSend.equals(null))
				{
					speak(ttsDoneNodeValueToSend);
					hightLight(0);
					System.out.println("Highlight Message sent on TTS_DONE"); 
				}
			}
		}
	}
}

