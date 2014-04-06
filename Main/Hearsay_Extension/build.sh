#!/bin/bash
xpifile=hearsayXtalk.xpi
rm "$xpifile"
cd xpi
zip -r "$xpifile" *
mv "$xpifile" ../
cd ..
echo -n Created file:
ls "$xpifile"
