package org.Hearsay_Server.server;


import org.Hearsay_Server.interfaces.IChannelListener;
import org.Hearsay_Server.interfaces.IMessageChannel;

import java.io.IOException;
import java.net.Socket;
import java.net.SocketException;
import java.io.DataInputStream;
import java.io.UnsupportedEncodingException;


/**
 * Represents a socket in the hearsay system
 * @author Subhasis Das
 *
 */
public class MessageChannel extends Loggable implements IMessageChannel 
{
	private final Socket socket;
	private final IChannelListener listener;
	private final Thread thread;
	private final int id;
	
	
	public MessageChannel(Socket sock, IChannelListener l) throws SocketException
	{
		SetLinePrefix("Socket#"+getId()+">");
		SetLogLevel(0);
		
		socket = sock;
		listener = l;
		id = socket.getPort();
		
		socket.setTcpNoDelay(true);
		
		thread = new Thread()
		{
			@Override
			public void run()
			{
				try 
				{
					for(;;)  
					{
						final String message = receiveMessage();
						//System.out.println("Received message : " + message);
						if(message == null)
							break;
	
						if(!message.isEmpty()) 
						{	// message not read yet
							log(1, " : Message Receive() works : message :"/*+message*/);	
							//listener.onReceive
								//System.out.println("Received message for parsing : " + message);
								listener.onReceive(MessageChannel.this, Message.parseXML(message));
						}
					}
				} 
				catch (Exception e) 
				{
					System.out.println("An error was encountered when parsing the message received from extension : " + e.getLocalizedMessage());
					e.printStackTrace();
					log(1, "An error was encountered when parsing the message received from extension : " + e.getMessage());
				}
				// notify event listeners that socket was closed (possibly without notification)
				listener.onDisconnect(MessageChannel.this);
				try { if(!socket.isClosed())	socket.close(); } catch (IOException e) {}	
			}
		};
		thread.start();
	}
	
	@Override
	public synchronized void send(Message msg) 
	{
		try
		{
		final String smsg = msg.writeXML();
		//System.out.println("Sending Message : " + smsg);
		final byte[] msgb = smsg.getBytes("UTF-8");
		String msg_len = String.valueOf(msgb.length);
		msg_len = "00000000".substring(msg_len.length())+msg_len;
		//System.out.println("Message length : " + msg_len + "::" + msgb.toString());
		final byte[] msg_lenb = msg_len.getBytes("UTF-8");
		socket.getOutputStream().write(msg_lenb);
		socket.getOutputStream().write(msgb);
		}
		catch(Exception e)
		{
			System.out.println("Sending error: " + e);
		}
	}
	//TODO: DELETE AFTER TESTING
	/*	
	public synchronized int getNextTextId()
	{
		int nextTextId = newTextId;
		newTextId++;
		return nextTextId;
	}
	*/
	@Override
	public int getId()	{ return id;	}
	
	@Override
	public void release()
	{
		// TODO: interrupt thread,
		// wait, until its done,
		// return
		thread.interrupt();
		//TODO: The thread DOES NOT LISTEN TO INTERRUPTS and uses a BLOCKING CALL to read from the input stream that DOES NOT listen to interrupts
	}
	
	private boolean	_ReadLengthMode = true;
	private int		_readPtr = 0;
	private byte[]	_readBuf = new byte[8];
	// states: _msgLength<0 - we read header, contain size of message (8 bytes) 
	//         _msgLength>=0 - header already read, now we're reading message 

	private String receiveMessage() throws IOException 
	{
		DataInputStream in = new DataInputStream(socket.getInputStream());

		int readed;
		try {
			readed = in.read(_readBuf, _readPtr, _readBuf.length - _readPtr);
		} catch (IOException e1) {
			log(0, "receiveMessage: got read exception, session will be closed");
			log(1, "\t_readPtr="+_readPtr);
			log(1,  "\tBufSize="+_readBuf.length);
			log(1, "\tMode="+ _ReadLengthMode);
			log(0,  e1.getStackTrace().toString());
			return null;
		}
		if(readed == -1)
		{
			log(0," : receiveMessage: read -1, session will be closed");
			return null;
		}
		_readPtr += readed;

		String msg = "";

		if(_readPtr == _readBuf.length){
			_readPtr = 0;

			if(_ReadLengthMode) {
				int msglen;
				try
				{
					msglen = Integer.parseInt(new String(_readBuf));
				}
				catch (NumberFormatException e) 
				{
					log(1, " : receiveMessage: wrong length read, session will be closed");
					return null;
				}

				if(msglen <=0)
					log(1," : receiveMessage: bad length read: len=" + msglen + " skipped");
				else {
					_readBuf = new byte[msglen];
					_ReadLengthMode = false;
				}
			}
			else
			{
				// convert to String only the range of bytes that was filled         
				try { // convert from DynamivByteArray to string preserving Unicode encoding
					msg = new String(_readBuf, "UTF-8");
				} catch (UnsupportedEncodingException e) {
					log(1,"receiveMessage: message convert error, session will be closed");
					return null;
				}

				log(1, "receiveMessage: got message, size=" + _readBuf.length);
				_ReadLengthMode = true;
				_readBuf = new byte[8];
			}
		}
		return msg;
	}
}


