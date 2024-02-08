#!/bin/bash

if ! [ -x "$(command -v git)" ]
then
	echo "Install git to update"
	exit
fi

if [ -x "$(command -v git)" ]
then
    if [ -d ".git" ]
	then
		git config --local url."https://".insteadOf git://
		git config --local url."https://github.com/".insteadOf git@github.com:
		git config --local url."https://".insteadOf ssh://
		git pull --rebase --autostash
	else
		echo "Only able to update if you clone the 3.8.5 branch"
		echo "git clone https://gitgud.io/ahsk/clewd.git"
		echo "cd clewd && git switch 3.8.5"
	fi
fi