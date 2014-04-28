package org.Hearsay_Server.interfaces;

import org.w3c.dom.Node;

public interface IDomIterator 
{
	boolean next() throws Exception;	// return false if there is no next position
	boolean prev() throws Exception;	// return false if there is no prev position
	void begin();	// go to 1st node
	void end() throws Exception;		// go to last node
	boolean onRemove(Node node);	// needs to synchronize reading if current node will be deleted
					// returns false, if IDomIterator doesn't care about
					// true, if it recalculated current position, in this case ITabHandler must cancel current speak and re-read IDomIterator position() again
	boolean setPos(Node node);	// true, if position has been changed.
	Node	getPos();	// get current node to read
}
