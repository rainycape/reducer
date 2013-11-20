#!/usr/bin/python

try:
	import httplib
except ImportError:
	import http.client as httplib

try:
	import urllib.parse as urllib
except ImportError:
	import urllib

import sys
import os

def main(args):

    server = os.environ.get("SERVER", "localhost:8888")

    for arg in args:
        if arg.endswith('.js'):
            path = '/js'
        elif arg.endswith('.css'):
            path = '/css'
        elif arg.endswith('.less'):
            path = '/less'
        else:
            print ('Invalid file type ' + arg)
            continue

        params = urllib.urlencode({'file1': open(arg).read()})
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        conn = httplib.HTTPConnection(server)
        conn.request('POST', path, params, headers)
        response = conn.getresponse()
        print (response.status, response.reason)
        data = response.read()
        conn.close()
        print (data)
        print ("\n")

if __name__ == "__main__":
  main(sys.argv[1:])
