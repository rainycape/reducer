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

import org.mozilla.javascript.ErrorReporter;
import org.mozilla.javascript.EvaluatorException;

import java.util.ArrayList;
import java.util.List;

public class ErrorCollector implements ErrorReporter {

  private final List<String> errors_ = new ArrayList<String>();

  public void warning(String message, String sourceName, int line,
      String lineSource, int lineOffset) {
    errors_.add(composeError("WARN", message, line, lineOffset));
  }

  public void error(String message, String sourceName, int line,
      String lineSource, int lineOffset) {
    errors_.add(composeError("ERROR", message, line, lineOffset));
  }

  public EvaluatorException runtimeError(String message, String sourceName,
      int line, String lineSource, int lineOffset) {
    errors_.add(composeError("RUNTIME", message, line, lineOffset));
    return new EvaluatorException(message);
  }

  private String composeError(final String severity, final String message,
      final int line, final int lineOffset) {
    StringBuilder error = new StringBuilder();
    error.append("\n[").append(severity).append("] ");
    if (line > 0) {
      error.append(line).append(":").append(lineOffset).append(" ");
    }
    error.append(message);
    return error.toString();
  }

  public List<String> getErrors() {
    return errors_;
  }
}
