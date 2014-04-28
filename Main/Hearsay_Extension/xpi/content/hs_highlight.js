/**
 * All const, global varibles to set and remove highlight
 * 
 */

const _xtHightLightTag = "hs_highlights";
const IGNORED_CLASSNAME = "_ignore_";

/******************************************************************************
 * Finding out the pos of the passed element
 * @param obj element whose co-ordinate is to be found
 * @return {x,y} co-ordinate
 */
function findPos(obj)
{
	var pos = {};
	pos.x = 1;
	pos.y = 0;
	
   	if(obj.offsetParent)
   		for(;;obj = obj.offsetParent)
   		{
      		pos.x += obj.offsetLeft;
      		pos.y += obj.offsetTop;
      		
      		if(!obj.offsetParent)
      			break;
   		}
   	else
   	{ 
   		if(obj.x)
   			pos.x += obj.x;
   		if(obj.y)
   			pos.y += obj.y;
   	}
   	return pos;
}

/******************************************************************************
 *  Calculating the dimensions and position of the element to be highlighted 
 *	@param control Element to be highlighted
 *	@return returns struct {x,y,w,h} - size and position of node 
*/
function GetControlSize(control) {
	var rect = {};
	//Calculating the X,Y Coordinates everytime before applying highlighting
	//Not applying the offsetParent based algorithm to find the xpos,ypos if the
		rect 	= findPos(control);			
		rect.w 	= control.offsetWidth;
		rect.h 	= control.offsetHeight;
	return rect;
}

/******************************************************************************
 * Draw over style class
*/

function AddOver(backgroundColor, borderWidth, borderColor, opacity){
    this.backgroundColor = backgroundColor;
    this.borderWidth = borderWidth;
    this.borderColor = borderColor;
    this.opacity = opacity;
}

AddOver.prototype = {
	getbackgroundColor: function() { return this.backgroundColor; },
	getborderWidth: 	function() { return this.borderWidth; },
	getOpacity: 		function() { return this.opacity; },
	getBorderColor:		function() { return this.borderColor; }
}

/******************************************************************************
 * Creates a div highlighter
 * @param {Object} - div_name name(id) of the div highlighter
 * @param {Object} obj_overlay - stores highlighter properties such as color, width
 * @param {Object} doc - dom document under which the div is to be created
 */
function CreateHightlightRect(name, obj_overlay, doc){
    var divElement = doc.createElement("div");
    divElement.setAttribute("classname", IGNORED_CLASSNAME);
    divElement.setAttribute("id", name); 
    divElement.style.backgroundColor = obj_overlay.getbackgroundColor();
    divElement.style.position = "absolute";
    divElement.style.overflow = "hidden";
    divElement.style.left = "0px";
    divElement.style.top = "0px";
    divElement.style.border = obj_overlay.getborderWidth() + "px solid ";
    divElement.style.borderColor = obj_overlay.getBorderColor();
    divElement.style.opacity = parseInt(obj_overlay.getOpacity()) / 100;
    divElement.style.zIndex = 10000000;
    divElement.style.visibility = "visible";    
    return divElement;    
}
/**
 * Removes the highlighter divs from the document object specified.
 * @param {Object} doc Document object from where the highlights are to be cleared
 */function ClearHighlightsDoc(doc) {
	 //log("clearing docs");
	 try{
	var html_part = doc.getElementsByTagName('html')[0];
	var elements = doc.getElementsByTagName(_xtHightLightTag);
	for(var j=0; j<elements.length; j++)
		html_part.removeChild(elements[j]);
	//log("clearing docs : COMPLETE");
	 }
	 catch(e){
		 log("ClearHighlightsDoc ex :"+ e.getMessage());
	 }
}

/**
	Clears all highlights 
	@param clearWindow - window of browser, that will be cleared
*/
function ClearHighlights(clearWindow) {
	try {		
		//log("Cleaned the window");
		var allFrames = clearWindow.frames;			
		for (var i=0; i<allFrames.length; i++)
			ClearHighlightsDoc(allFrames[i].document);
		//log("Cleaned the window: Success ");
	}
	catch(e) {
		log("ClearHighlights() exception: " + e.message);
	}
}

/******************************************************************************
 * TODO: docs, remove refrences to treeHash
*/
/**
 * A helper function used to highlight multiple elements on a page simultaneously 
 * @param {Object} tControl The element to be highlighted
 * @param {Object} style Specifies the properties for the highlighter div to be used
 */
function SetHighlightControl(/*Element*/ tControl) {
	var highlight_color = "lightgrey";
	var highlight_transparencylevel = "30";
	var highlight_borderColor = "red";
	var style = new AddOver(highlight_color, 2, highlight_borderColor, 30);
	//var IGNORED_CLASSNAME = "_ignore_";
	//log("SetHighlightControl : Received "+tControl)
	//ClearHighlights(clearWindow);
	if(tControl.getAttribute('attr_visibility') != "hidden") {
		var doc = tControl.ownerDocument;
		var allHightlights = doc.getElementsByTagName(_xtHightLightTag);
		if(allHightlights.length == 0) 
		{ 
			allHightlights = [doc.createElement(_xtHightLightTag)];
			allHightlights[0].setAttribute("classname", IGNORED_CLASSNAME);
			allHightlights[0].setAttribute("id", _xtHightLightTag);
			allHightlights[0].style.visibility = "visible";	
			doc.getElementsByTagName('html')[0].appendChild(allHightlights[0]);						
	    }
	    
		// create the div (if doesn't exists) and highlight the element
		var pos = GetControlSize(tControl);
		var divElement = CreateHightlightRect("hs_multi_highlight_tmp", style, doc);										
		allHightlights[0].appendChild(divElement);
		
		// get client rect of the element		
		var rects = tControl.getClientRects();		
		// Set the div highlighter properties to highlight the element
		if (rects.length > 1) 
			divElement.style.left = pos.x - style.getborderWidth() - Math.ceil(rects[0].left - rects[1].left) + doc.body.scrollLeft + "px";
		else 
			divElement.style.left = pos.x - style.getborderWidth() + doc.body.scrollLeft + "px";
		
		divElement.style.top = pos.y - style.getborderWidth() + "px";
		divElement.style.width = pos.w + "px";
		divElement.style.height = pos.h + "px";
	}	
}

/**
 * Used to highlight multiple elements at the same time
 * @param {Object} iids Identifiers to be highlighted
 * @param {Object} style Specifies the properties for the highlighter div to be used 
 *//*
function SetHighlights(iids, style) {
	var idArray = iids.split(",");
	for (var i = 0; i < idArray.length; i++){
		if((+idArray[i]) in treeHash)
			SetHighlightControl(treeHash[+idArray[i]], style);
	}
}*/