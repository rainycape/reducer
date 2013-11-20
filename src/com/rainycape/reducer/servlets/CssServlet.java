/*
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
package com.rainycape.reducer.servlets;

import com.yahoo.platform.yui.compressor.CssCompressor;

import javax.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;

@SuppressWarnings("serial")
public class CssServlet extends BaseServlet {
  private static final int WRAP_AT_COLUMN = 80;
  private static final String MIME_TYPE_CSS = "text/css; charset=utf-8";

  protected String compile(final StringReader sr) throws IOException {

    CssCompressor css = new CssCompressor(sr);
    StringWriter sw = new StringWriter();
    css.compress(sw, WRAP_AT_COLUMN);
    return sw.toString();
  }

  @Override
  protected final Response process(final HttpServletResponse resp,
      final StringReader csssr) throws IOException {

    try {
      String css = compile(csssr);
      resp.setContentType(MIME_TYPE_CSS);
      return Response.of(true, css);
    } catch (IOException e) {
      resp.setStatus(404);
      resp.setContentType("text/plain");
      return Response.of(false, e.getMessage());
    }
  }

  @Override
  protected final void render(final HttpServletResponse resp,
      final String response) throws IOException {
    resp.setContentType(MIME_TYPE_CSS);
    resp.getWriter().print(response);
  }
}
