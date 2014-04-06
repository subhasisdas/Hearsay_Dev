package org.Hearsay_Server.server;
//package interfaces;

import java.util.ArrayList;
import java.util.HashMap;
//import java.util.Set;
//import java.util.HashSet;
import java.util.Map;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
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
	//private ArrayList<Long> text_id_bucket = new ArrayList<Long>();

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
			nodeMap.put(Integer.parseInt(nodeId), (Node) element);
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
			break;
		case DELETE_DOM:
			// TODO: update Docunent and nodeMap. check, that iterator.getPos() is not inside updated tree
			// update iterator
			break;
		case MOVE_DOM:
			// TODO: update Docunent.
			break;
		case UPDATE_ATTR:
			// TODO: update Docunent.
			break;
		case DELETE_ATTR:
			// TODO: update Docunent.
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
		case ACTIVE_TAB:
			break;
		case DELETE_TAB:
			break;
		case FOCUS:
			break;
		case NEW_TAB:
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
			iterator = new DomIterator(this);
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
					//System.out.println("Highlight Message sent on KEY PAUSE"); 
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
				speak(ttsDoneNodeValueToSend);
				hightLight(0);
				System.out.println("Highlight Message sent on TTS_DONE"); 
			}
		}
	}
}
