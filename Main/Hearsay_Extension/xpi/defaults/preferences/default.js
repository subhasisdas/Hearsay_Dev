/**
 * default for serverIP
 */

var serverIP = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
//serverIP.data = "192.168.0.10";
//pref("extensions.hearsay.serverIP",Components.interfaces.nsISupportsString, serverIP);

var serverIP = "192.168.0.10";
prefManager.setCharPref("extensions.hearsay.serverIP",serverIP);
prefManager.setCharPref("extensions.hearsay.description","Developed at Stony Brook University");