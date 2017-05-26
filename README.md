# node-chat

Problems with npm install:

 Error: Can't find Python executable "python", you can set the PYTHON env variable.

If you're using Windows you can now install all node-gyp dependencies with single command:

 $ npm install --global --production windows-build-tools
 
and then install the package:

 $ npm install --global node-gyp

after this, you can run npm install