Please follow the following instructions:


Create a new repository on the command line

touch README.md

git init

git add README.md

git commit -m "first commit"

git remote add origin https://github.com/subhasisdas/Hearsay_Dev.git

git push -u origin master

----------------------------------------------------------------------
Push an existing repository from the command line

git remote add origin https://github.com/subhasisdas/Hearsay_Dev.git

git push -u origin master

---------------------------------------------------------------------

Readme for Maven
================

1. It is important to understand the maven POM structure for Hearsay. Please have a thorough understanding of maven basics before making any changes to pom.xml files

2. For Hearsay :
	
  Main 	: Maven Project . It has a pom.xml which essentially lists down the maven modules in it and the compiler version.
				  Any version restriction that is wished to be imposed across all the maven modules need to be mentioned in its pom.xml
  
  Hearsay_Extension: Maven Module. This is the client side extension part of Hearsay. As far as maven dependency is concerned,its pom.xml is pretty straightforward with information about its parent maven project and UTF encoding

  Hearsay_Main : Maven Module . This is the server side of Hearsay. The pom.xml for this module is where the trick is. Make sure
				  that it contains the following <plugin> : maven-jar-plugin , maven-compiler-plugin ,maven-assembly-plugin (this 
				  generates the final runnable jar)

3. Steps to run maven build
	
	mvn package

	// to check locally if the maven build generated the correct runnable jar
	java -cp Hearsay_Server\target\Hearsay_Version1-jar-with-dependencies.jar org.Hearsay_Server.server.Hearsay_Main
