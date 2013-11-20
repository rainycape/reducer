package com.rainycape.reducer.servlets;

import java.io.IOException;
import java.io.StringReader;

import org.apache.commons.io.IOUtils;
import org.lesscss.LessCompiler;
import org.lesscss.LessException;

@SuppressWarnings("serial")
public class LessServlet extends CssServlet {

  private static LessCompiler compiler = new LessCompiler();

  @Override
  protected final String compile(final StringReader sr) throws IOException {
    try {
      String css = compiler.compile(IOUtils.toString(sr));
      // It seems the LESS compiler replaces "\n" with "\\n",
      // which is invalid CSS.
      return super.compile(new StringReader(css.replace("\\n", "")));
    } catch (LessException e) {
      throw new IOException(e.getMessage(), e.getCause());
    }
  }
}
