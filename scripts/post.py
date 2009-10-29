#!/usr/bin/python

import httplib
import sys
import urllib
import os

def main(args):
  server = os.environ.get("REDUCISAURUS", "localhost:8080")

  params = urllib.urlencode({'file1': open(args.pop()).read()})
  headers = {'Content-Type': 'application/x-www-form-urlencoded'}
  conn = httplib.HTTPConnection(server)
  conn.request('POST', '/js', params, headers)
  response = conn.getresponse()
  print response.status, response.reason
  data = response.read()
  conn.close()
  print data
  print "\n"

if __name__ == "__main__":
  main(sys.argv)
