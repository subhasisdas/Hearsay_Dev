package org.Hearsay_Server.server;
//package interfaces;


import java.io.IOException;
import java.net.Socket;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.w3c.dom.Node;

import org.Hearsay_Server.interfaces.ICommunicatorListener;
import org.Hearsay_Server.interfaces.IChannelListener;
import org.Hearsay_Server.interfaces.IMessageChannel;
import org.Hearsay_Server.interfaces.ITabHandler;

/*
 * Reviewed by Valentyn
 * 
 * TODO: 
 * 1) Move it to server unit
 */

@SuppressWarnings("unused")
public class Dispatcher extends Loggable implements ICommunicatorListener, IChannelListener
{
	final private Map<Integer, IMessageChannel> channels = new HashMap<Integer, IMessageChannel>();
	final private Map<Long, ITabHandler> tabs = new HashMap<Long, ITabHandler>();
	private ITabHandler activeTab = null;

	public Dispatcher()	{}

	@Override
	public synchronized void onConnect(Communicator source, Socket socket) 
	{
		System.out.println("Dispatcher onConnect");
		try 
		{
			System.out.println("flag1");
			IMessageChannel channel = new MessageChannel(socket, this);
			System.out.println("flag2");			
			channel = channels.put(channel.getId(), channel);
			System.out.println("flag3");
			if(channel!=null)	// previous channel with the same port? a little strange but...
			{
				System.out.println("flag4");
				channel.release();
			}
		}
		catch (SocketException e) 
		{
			log(1, "A SocketException : " + e.getMessage() + " was encountered when creating a new message channel for connection to : " + socket.getRemoteSocketAddress().toString());	
			try { socket.close(); }	catch (IOException e1)	{}
		}
	}

	public void release()
	{
		System.out.println("Release was invoked");
		for(ITabHandler tabHandler : tabs.values())
		{
			tabHandler.release();
		}
		tabs.clear();		
		for(IMessageChannel channel : channels.values())
		{
			channel.release();
		}
		channels.clear();
	}

	@Override
	public synchronized void onDisconnect(IMessageChannel sp) 
	{
		System.out.println("onDisconnect was invoked");
		channels.remove(sp.getId());
		//Prepare the list of tabs that must be removed
		List<Long> tabsToRemove = new ArrayList<Long>();
		for(Map.Entry<Long, ITabHandler> tab : tabs.entrySet())
		{
			Long tabId = tab.getKey();
			if((tabId % 100000) == sp.getId())
			{
				tabsToRemove.add(tabId);
			}
		}
		// remove all tabs, related to channel with sp.getId().
		// tabID is tabID(from browser)*100000+channelid
		// so you must release all tabs with (getId()%100000) == sp.getId();
		//Release and remove the relevant tabs
		for(Long tabId : tabsToRemove)
		{
			ITabHandler tabHandler = tabs.get(tabId);
			tabHandler.release();
			tabs.remove(tabId);
		}
	}

	@Override
	public synchronized void onReceive(IMessageChannel sp, Message msg) throws Exception
	{
		//sdas
		//System.out.println("The mesasge that has been received by dispatcher is : " + msg.writeXML());
		//System.out.println("Current state of tabs is : " + tabs.toString());
		// re-build msg id:
		System.out.println("Dispatcher OnReceive");
		final long globalTabId = msg.tabId*100000+sp.getId();
		switch(msg.type)
		{
		// Will be processed by active tab. if tabID of the message is the same. Otherwise ignore it
		case KEY:		// Parameters: "press": a pressed key name. This message will be sent with active tab
			//Sending TTS_SPEAK to extension
			if(activeTab != null && (activeTab.getGlobalId() == globalTabId))
			{
				activeTab.onReceive(msg);
			}
			break;
		case MOUSE:			// Parameters: "id" - clicked node id, extra parameters - pressed mouse button state.
			if(activeTab != null && (activeTab.getGlobalId() == globalTabId))
			{
				activeTab.onReceive(msg);
			}
			break;
		case FOCUS:			// Parameters: "id" - new currently selected node by browser.
			break;
		case TTS_DONE:	// parameters: "text_id" - text with text_id has been spoken.
			if(activeTab != null && activeTab.getGlobalId()==globalTabId)
			{
				//System.out.println("Active tab is being delivered a TTS_DONE message");
				activeTab.onReceive(msg);
			}
			//System.out.println("Global tab Id : " + globalTabId + " : " + activeTab.getId());
			break;
			// Browser handler events. Will be produced by main part of the extension.
			// Will be processed by Dispatcher
		case NEW_TAB:
			if(tabs.containsKey(globalTabId))
				log(0, "Error: received NEW_TAB for already created tab");
			else
				//sp is message channel
				tabs.put(globalTabId, new TabHandler(globalTabId, msg.tabId, sp));
			break;
		case ACTIVE_TAB:		// Parameters: none. Will be sent when tab switch happend.
			// deactivate active tab; cancel current speech, activate tab with globalTabId
			if(activeTab != null && activeTab.getGlobalId() == globalTabId)
			{
				break;
			}
			ITabHandler newActiveTab = tabs.get(globalTabId);
			if(newActiveTab != null && newActiveTab != activeTab)
			{
				if(activeTab != null)
				{
					activeTab.deactivate();
				}
				activeTab = newActiveTab;
				activeTab.activate();
			}
			break;
		case DELETE_TAB:		// Parameters: none. C.O.: yes, it will be sent when the tab was deleted
			// check, is it active tab? if it is, deactivate it, cancel speech 
			// remove & release
			ITabHandler deletedTab = tabs.remove(globalTabId);
			if(deletedTab != null)
			{
				if(activeTab == deletedTab)
					activeTab = null;
				deletedTab.release();
			}
			break;
			// DOM events. will be processed by ITabHandler
		case INIT_DOM:		// parameters: "url" of the document; payload will contain whole the serialized document, except sub-frames
			ITabHandler tabHandler = tabs.get(globalTabId);
			if(tabHandler == null)
			{
				log(1, "An invalid message was found based on a tab identifier : " + msg.tabId + " that does not exist");
				return;
			}
			//Deliver the message to the relevant tab handler and don't handle just crash / disconnect

			tabHandler.onReceive(msg);
			break;
		case UPDATE_DOM:		// parameters: "parent_id" - id of the parent node of updated subtree, "sibling_id" - previous (or left) sibling of the updated subtree.
			// 	payload - the serialized subtree. Note: subframes of the document will be sent as updates for subtree.
		case DELETE_DOM:		// Parameters: "node_id" - list of root's id for deleted subtrees.
		case MOVE_DOM:		// Parameters: "node_id", "parent_id", "sibling_id" - this event will be sent when "node_id" has been moved to a new position in "parent_id" and placed after "sibling_id".
		case UPDATE_ATTR:	// Parameters: "node_id", "attr", "value"
		case DELETE_ATTR:	// Parameters: "node_id", "attr"
		case CHANGE_VALUE:	// Parameters: "node_id", "value" - will be send when input form element has been changed
			final ITabHandler tab = tabs.get(globalTabId);
			if(tab == null)
			{
				log(1, "An invalid message was found based on a tab identifier : " + msg.tabId + " that does not exist");
				return;

			}
			tab.onReceive(msg);
			break;
		case SET_HIGHLIGHT:
			break;
		case TTS_CANCEL:
			break;
		case TTS_SPEAK:
			break;
		default:
			System.out.println("Got a default msg");
			break;

		}
	}
}