#!/bin/bash

ARCH=`uname -m`
EXEC=`find . -name "kr-Linux-${ARCH}-*" -size   +1M`

if [ ! $EXEC ]; then
  echo "No executable file matched"
  exit -1
fi 

cp ${EXEC} /usr/src/kr/kr

/usr/src/kr/kr

