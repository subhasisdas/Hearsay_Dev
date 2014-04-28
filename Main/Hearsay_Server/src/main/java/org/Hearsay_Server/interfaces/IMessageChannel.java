package org.Hearsay_Server.interfaces;

import org.Hearsay_Server.server.Message;

public interface IMessageChannel 
{
	int getId();
	//int getNextTextId();
	void send(Message msg) throws Exception;
	void release();
}
