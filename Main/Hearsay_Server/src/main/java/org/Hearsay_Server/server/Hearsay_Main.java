package org.Hearsay_Server.server;
//package interfaces;

import java.io.BufferedReader;
import java.io.InputStreamReader;

/*Main Class
 * 
 * 
 */

/*
 * Valentyn Melnyk's notes:
 * Common rules:
 * 1) Do not create any threads. All required threads already defined (thread for server, and 1 thread for every connection)
 * 2) DO NOT DEFINE ANY STATIC VARIABLES. you use it wrong. I haven't seen any proper example in your code.
 * 3) Do not create useless accessors.
 */
public class Hearsay_Main  
{
	final static int ServerPort = 13000;
	
	public static void main(String[] args) throws Exception
	{
		final Dispatcher dispatcher = new Dispatcher();
		final Communicator comm = new Communicator(dispatcher, ServerPort);

		//comm.run();
		System.out.println("Comm.start");
		System.out.println("hello");
		
		comm.start();
		
		System.out.println("Comm.started");

		final BufferedReader bufferRead = new BufferedReader(new InputStreamReader(System.in));
		for(;;)
		{
			String s = bufferRead.readLine();
			if(s.isEmpty())
				break;
		}
		System.out.println("Stopping comm!");
		comm.stop();
		dispatcher.release();		
		System.out.println("Zed is dead");
	}
}
