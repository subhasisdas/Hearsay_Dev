package org.Hearsay_Server.server;
//package interfaces;


import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import org.Hearsay_Server.interfaces.IDomIterator;
import org.Hearsay_Server.interfaces.ITabHandler;


public class DomIterator implements IDomIterator 
{
	final private ITabHandler tab;
	private Node node;

	public DomIterator(ITabHandler t)
	{
		tab = t;
		begin();
	}

	/**
	 * Find the first text node if one exists within the given root node's subtree
	 * @param rootNode
	 */
	private Node findTextNodeInSubtree(Node rootNode)
	{
		if(rootNode.getNodeName().equals("textelement"))
			return rootNode;

		final NodeList childNodes = rootNode.getChildNodes();
		for(int iter = 0; iter < childNodes.getLength(); iter++)
		{
			final Node currentNextNode = findTextNodeInSubtree(childNodes.item(iter));
			if(currentNextNode != null)
				return currentNextNode;
		}

		return null;
	}

	@Override
	public boolean next() 
	{
		Node currentPosition = node;
		if(currentPosition == null)
		{
			return false;
		}
		Node destinationPosition = null;
		Node currentNode = currentPosition;
		Node nextNodeToCheck;
		do
		{
			nextNodeToCheck = currentNode;
			Node nextSibling = currentNode.getNextSibling();
			if(nextSibling == null)
			{
				Node parentNode = currentNode.getParentNode();
				while(parentNode != null)
				{
					Node parentNodeSibling = parentNode.getNextSibling();
					if(parentNodeSibling != null)
					{
						nextNodeToCheck = parentNodeSibling;
						break;
					}
					parentNode = parentNode.getParentNode();
				}
			}
			else
			{
				nextNodeToCheck = nextSibling;
			}
			if(currentNode.isSameNode(nextNodeToCheck))
			{
				//We had no new node when we tried to move
				break;
			}
			currentNode = nextNodeToCheck;
			Node prevRelativeNode = findTextNodeInSubtree(currentNode);
			if(prevRelativeNode != null)
			{
				destinationPosition = prevRelativeNode;
				break;
			}
		}
		while((currentNode.getParentNode() != null) || (currentNode.getNextSibling() != null));

		if(destinationPosition != null)
		{
			node = destinationPosition;
			return true;
		}
		return false;
	}

	@Override
	public boolean prev() 
	{
		Node currentPosition = getPos();
		if(currentPosition == null)
		{
			return false;
		}
		Node destinationPosition = null;
		Node currentNode = currentPosition;
		Node nextNodeToCheck;
		do
		{
			nextNodeToCheck = currentNode;
			Node previousSibling = currentNode.getPreviousSibling();
			if(previousSibling == null)
			{
				Node parentNode = currentNode.getParentNode();
				while(parentNode != null)
				{
					Node parentNodeSibling = parentNode.getPreviousSibling();
					if(parentNodeSibling != null)
					{
						nextNodeToCheck = parentNodeSibling;
						break;
					}
					parentNode = parentNode.getParentNode();
				}
			}
			else
			{
				nextNodeToCheck = previousSibling;
			}
			if(currentNode.isSameNode(nextNodeToCheck))
			{
				//We had no new node when we tried to move
				break;
			}
			currentNode = nextNodeToCheck;
			Node prevRelativeNode = findTextNodeInSubtree(currentNode);
			if(prevRelativeNode != null)
			{
				destinationPosition = prevRelativeNode;
				break;
			}
		}
		while((currentNode.getParentNode() != null) || (currentNode.getPreviousSibling() != null));

		if(destinationPosition != null)
		{
			//TODO: Check this
			this.node = destinationPosition;
			return true;
		}
		return false;
	}

	@Override
	public void begin() 
	{
		//Initialize the position to the text node within the subtree
		node = findTextNodeInSubtree(tab.getRootNode());
	}

	@Override
	public void end() throws Exception 
	{
		//Move ahead until next returns false which means we reached the last node
		while(next())
		{
		}
		//We are now at the last node
	}

	private Node findTextNodeInSiblings(final Node searchNode)
	{
		Node currentNode = searchNode.getNextSibling();
		while(currentNode != null)
		{
			Node tmpNode = findTextNodeInSubtree(currentNode);
			if(tmpNode != null)
				return tmpNode;

			currentNode = currentNode.getNextSibling();
		}

		currentNode = searchNode.getPreviousSibling();
		while(currentNode != null)
		{
			Node tmpNode = findTextNodeInSubtree(currentNode);
			if(tmpNode != null)
				return tmpNode;

			currentNode = currentNode.getPreviousSibling();
		}

		return null;
	}

	//TODO
	@Override
	public boolean onRemove(Node nodeToRemove)
	{
		assert nodeToRemove != null;
		//TODO: Implementation based on current position
		/**
		 * Check if the node is the same as the current node being spoken out
		 * Then, we need to recalculate our speaking position and return true
		 * Else, we return false after removing this node
		 */
		if(node==null)
			return false;

		if(!nodeToRemove.isSameNode(node))
			return false;

		//Recalculate the speaking position to a text node
		while(nodeToRemove != null)
		{
			final Node newPosition = findTextNodeInSiblings(nodeToRemove);
			if(newPosition != null)
			{
				node = newPosition;
				return true;
			}
			nodeToRemove = nodeToRemove.getParentNode();
		}
		node = null;
		return true;
	}

	@Override
	public boolean setPos(Node node) 
	{
		if(node == null)
			return false;
		if(this.node.isSameNode(node))
		{
			return false;
		}
		else
		{
			//TODO: Navigate to the closest text node position
			Node currentNode = node;
			Node newPosition = null;
			if(currentNode.getNodeName().equals("textelement"))
			{
				newPosition = currentNode;
			}
			else
			{
				newPosition = findTextNodeInSubtree(currentNode);
				if(newPosition == null)
				{
					while(currentNode != null)
					{
						newPosition = findTextNodeInSiblings(currentNode);
						if(newPosition != null)
						{
							break;
						}
						currentNode = currentNode.getParentNode();
					}
				}
			}			
			if(newPosition != null)
			{
				this.node = newPosition;
			}
			return true;
		}
	}

	@Override
	public Node getPos() 
	{
		return node;
	}

}
