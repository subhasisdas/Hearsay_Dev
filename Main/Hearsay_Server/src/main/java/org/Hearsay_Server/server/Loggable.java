package org.Hearsay_Server.server;
//package interfaces;
import java.io.PrintStream;

public class Loggable {
	
	private static PrintStream _sysout;
		
	static
	{
		try { _sysout = new PrintStream(System.out, true, "UTF-8"); } catch(Exception e) { assert false; }
	}
	
	private int 	_LogLevel = 0;
	private String 	_LinePrefix = "";
	
	public void SetLogLevel(int level) { _LogLevel = level; }
	
	public void SetLinePrefix(String prefix) { _LinePrefix = prefix; }
	
	public void log(int loglevel, String message) { 
		if(loglevel<=_LogLevel)
		{
			_sysout.println(_LinePrefix + message);
			
		}	
	}
}
