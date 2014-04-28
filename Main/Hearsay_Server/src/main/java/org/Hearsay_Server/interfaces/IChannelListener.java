package org.Hearsay_Server.interfaces;

import org.Hearsay_Server.server.Message;

public interface IChannelListener 
{
	void onDisconnect(IMessageChannel sp);
	//Add exception on the below function
	void onReceive(IMessageChannel sp, Message msg) throws Exception;
}
