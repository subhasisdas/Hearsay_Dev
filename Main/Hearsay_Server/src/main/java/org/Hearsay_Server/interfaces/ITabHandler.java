package org.Hearsay_Server.interfaces;

import org.w3c.dom.Node;

import org.Hearsay_Server.server.Message;

public interface ITabHandler 
{
	void onReceive(Message msg) throws Exception;
	void release();
	Node getNode(int id);		// null if there is no node with this id
	int	 getNodeId(Node node) throws Exception;	// 0 if there is no Id or wrong node
	Node getRootNode();
	void activate() throws Exception;			// start speaking, switch to active state
	void deactivate();			// cancel speaking, switch to inactive state
	long  getId();
	long getGlobalId();
	IMessageChannel getChannel();
	int getNextTextId();
}
