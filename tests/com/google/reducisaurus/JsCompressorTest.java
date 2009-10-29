/**
 * Copyright 2009 Google Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
package com.google.reducisaurus;

import com.google.reducisaurus.servlets.ErrorCollector;

import junit.framework.TestCase;

import org.apache.commons.io.FileUtils;
import org.junit.Test;

import java.io.File;
import java.io.StringReader;
import java.io.StringWriter;

public class JsCompressorTest extends TestCase {

  private String readFileToString(String filename) throws Exception {
    File file = new File(filename);
    return FileUtils.readFileToString(file, "UTF-8");
  }

  private String compressNoErrors(String js) throws Exception {
    StringReader input = new StringReader(js);
    StringWriter output = new StringWriter();
    ErrorCollector errorCollector = new ErrorCollector();
    new JsCompressor().compress(input, output, errorCollector);
    return output.toString();
  }

  @Test
  public final void testCompressSimple() throws Exception {
    assertEquals("", compressNoErrors(""));
    assertEquals("alert(a);", compressNoErrors("alert(a);"));
    assertEquals("function(a){alert(a)};",
        compressNoErrors("function (foo) { alert(foo); };"));
  }

  public final void testReadFileToString() throws Exception {
    assertEquals("function (foo) { alert (foo); };\n",
        readFileToString("tests/testdata/simple.js"));
  }

  public final void testFeedGadgetJs() throws Exception {
    String input =
        readFileToString("tests/testdata/feedgadget.js");
    String expected =
        readFileToString("tests/testdata/feedgadget-min.js");
    assertEquals(expected, compressNoErrors(input));
  }

  public final void testJQueryJs() throws Exception {
    String input =
        readFileToString("tests/testdata/jquery-1.3.2.js");
    String expected =
        readFileToString("tests/testdata/jquery-1.3.2-min.js");
    assertEquals(expected, compressNoErrors(input));
  }

  public final void testConcatenatedJs() throws Exception {
    String input =
        readFileToString("tests/testdata/concatenated.js");
    String expected =
        readFileToString("tests/testdata/concatenated-min.js");
    assertEquals(expected, compressNoErrors(input));
  }
}
