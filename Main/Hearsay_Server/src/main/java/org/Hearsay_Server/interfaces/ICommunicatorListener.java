package org.Hearsay_Server.interfaces;

import java.net.Socket;

import org.Hearsay_Server.server.Communicator;

public interface ICommunicatorListener 
{
	void onConnect(Communicator source, Socket socket);
}
