package org.Hearsay_Server.server;
//package interfaces;

import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Source;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.w3c.dom.Text;
import org.xml.sax.InputSource;

/**
 * Represents a message in the hearsay system
 * 
 *
 */
public class Message
{
	public final MessageType type;

	public final long tabId;

	private final Map<String, List<String>> arguments = new HashMap<String, List<String>>();

	public Node payload;

	public Message(MessageType t, long id)
	{
		type = t;
		tabId = id;
	}

	public Map<String, List<String>> getArguments() 
	{
		return arguments;
	}

	public Node getPayload() 
	{
		return payload;
	}

	public void setPayload(Node payload) 
	{
		this.payload = payload;
	}

	private static Message parseDocument(Document xmlDocument) throws Exception
	{
		//Parse the tab identifier from the received XML document
		Integer tabId = Integer.parseInt((xmlDocument.getElementsByTagName("tabId").item(0)).getFirstChild().getNodeValue());
		//Parse the message type
		MessageType type = null;
		String typeName = xmlDocument.getElementsByTagName("type").item(0).getFirstChild().getNodeValue();
		//Enumerate over message types for validating the type
		for(MessageType messageType : MessageType.values())
		{
			if(messageType.name().equalsIgnoreCase(typeName))
			{
				type = messageType;
			}
		}
		if(type == null)
		{
			throw new Exception("An invalid message type was found on the document with name : " + typeName);
		}
		Message message = new Message(type, tabId);
		Node payloadElement = xmlDocument.getElementsByTagName("payload").item(0);
		//If a payload exists then add it onto the message
		if(payloadElement != null)
		{
			System.out.println("Payload element not null");
			//The payload's root node will be cloned deeply
			if(payloadElement.getChildNodes().getLength() == 1)
			{
				message.setPayload(payloadElement.getFirstChild().cloneNode(true));
			}
		}
		Node parameters = xmlDocument.getElementsByTagName("parameters").item(0);
		//System.out.println("Parameter length : " + parameters.getChildNodes().getLength());
		if(parameters.getNodeType() == Node.ELEMENT_NODE)
		{
			Element parametersElement = (Element) parameters;
			NodeList parameterList = parametersElement.getElementsByTagName("parameter");
			if(parameterList != null)
			{
				int index = 0;
				while(index < parameterList.getLength())
				{
					Element eParameter = (Element) parameterList.item(index);
					NodeList parameterNameNodes = eParameter.getElementsByTagName("parameterName");
					if(parameterNameNodes.getLength() > 1 || parameterNameNodes.getLength() < 1)
					{
						throw new Exception("Node for parameter name not found");
					}
					String parameterName = parameterNameNodes.item(0).getTextContent();
					NodeList parameterValuesNodeList = eParameter.getElementsByTagName("parameterValues");
					if(parameterValuesNodeList.getLength() > 1 || parameterValuesNodeList.getLength() < 1)
					{
						throw new Exception("Node for parameter name not found");
					}
					Element parameterValues = (Element)parameterValuesNodeList.item(0);
					NodeList parameterValueNodeList = parameterValues.getElementsByTagName("parameterValue");
					int iterator = 0;
					int parameterValueCount = parameterValueNodeList.getLength();
					ArrayList<String> parameterValueList = new ArrayList<String>();
					while(iterator < parameterValueCount)
					{
						Element parameterValue = (Element)parameterValueNodeList.item(iterator);
						parameterValueList.add(parameterValue.getTextContent());
						iterator++;
					}
					if(message != null)
					{
						message.getArguments().put(parameterName, parameterValueList);
					}
					index++;
				}
			}
		}
		return message;
	}

	public static Message parseXML(String hearsayMessage) throws Exception
	{
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		InputSource is = new InputSource();
		is.setCharacterStream(new StringReader(hearsayMessage));
		DocumentBuilder builder = factory.newDocumentBuilder();
		Document xmlDoc = builder.parse(is);
		return parseDocument(xmlDoc);
	}

	public String writeXML() throws Exception
	{
		DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
		DocumentBuilder builder =  factory.newDocumentBuilder();
		Document hearsayXMLMessage = builder.newDocument();
		Element hearsayMessage = (Element) hearsayXMLMessage.createElement("hearsayMessage");
		hearsayXMLMessage.appendChild(hearsayMessage);
		//Add the identifier
		Element id = hearsayXMLMessage.createElement("tabId");
		Text idValue = hearsayXMLMessage.createTextNode(Long.toString(this.tabId));
		id.appendChild(idValue);
		hearsayMessage.appendChild(id);
		//Add the message type
		Element type = hearsayXMLMessage.createElement("type");
		Text typeValue = hearsayXMLMessage.createTextNode(this.type.toString());
		type.appendChild(typeValue);
		hearsayMessage.appendChild(type);

		//Add the parameters
		Element parameters = hearsayXMLMessage.createElement("parameters");
		for(Map.Entry<String, List<String>> parameter : arguments.entrySet())
		{
			//Process the current parameter and add an element for it to the document	
			String parameterName = parameter.getKey();
			List<String> parameterValueList = parameter.getValue();
			//Create the XML document element for this parameter
			Element parameterElement = hearsayXMLMessage.createElement("parameter");
			//Create an element for the parameter name
			Element parameterNameElement = hearsayXMLMessage.createElement("parameterName");
			parameterNameElement.appendChild(hearsayXMLMessage.createTextNode(parameterName));
			parameterElement.appendChild(parameterNameElement);
			//Create an element for the parameter values
			Element parameterValuesElement = hearsayXMLMessage.createElement("parameterValues");
			for(String parameterValue : parameterValueList)
			{
				Element parameterValueElement = hearsayXMLMessage.createElement("parameterValue");
				Text paramValueField = hearsayXMLMessage.createTextNode(parameterValue);
				parameterValueElement.appendChild(paramValueField);
				parameterValuesElement.appendChild(parameterValueElement);
			}
			parameterElement.appendChild(parameterValuesElement);
			parameters.appendChild(parameterElement);
		}
		hearsayMessage.appendChild(parameters);

		//Clone the payload if there is one
		if(payload != null)
		{
			Element payloadElement = hearsayXMLMessage.createElement("payload");
			payloadElement.appendChild(hearsayXMLMessage.importNode(payload, true));
			hearsayMessage.appendChild(payloadElement);
		}
		Writer outWriter = new StringWriter();
		StreamResult result=new StreamResult(outWriter);
		TransformerFactory tranFactory = TransformerFactory.newInstance();
		Transformer transformer = tranFactory.newTransformer();
		transformer.setOutputProperty(OutputKeys.INDENT, "yes");
		transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
		transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
		Source source = new DOMSource(hearsayXMLMessage);
		transformer.transform(source, result);
		return outWriter.toString();
	}
}
