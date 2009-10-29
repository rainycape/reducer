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
package com.google.reducisaurus.servlets;

import com.google.reducisaurus.JsCompressor;

import org.mozilla.javascript.EvaluatorException;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;

import javax.servlet.http.HttpServletResponse;

@SuppressWarnings("serial")
public class JsServlet extends BaseServlet {
  private static final String MIME_TYPE_JAVASCRIPT =
      "application/x-javascript; charset=utf-8";

  @Override
  protected final String process(HttpServletResponse resp, StringReader jssr)
      throws IOException {
    final StringWriter writer = new StringWriter();
    final ErrorCollector errorCollector = new ErrorCollector();

    try {
      resp.setContentType(MIME_TYPE_JAVASCRIPT);
      new JsCompressor().compress(jssr, writer, errorCollector);

    } catch (EvaluatorException ee) {
      resp.setStatus(404);
      resp.setContentType("text/plain");
      writer.write("Errors:\n");
      for (String i : errorCollector.getErrors()) {
        writer.write(i + "\n");
      }
    }
    return writer.toString();
  }


  @Override
  protected final void render(final HttpServletResponse resp,
      final String response) throws IOException {
    resp.setContentType(MIME_TYPE_JAVASCRIPT);
    resp.getWriter().write(response);
  }
}
