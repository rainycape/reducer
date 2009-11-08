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
package com.google.reducisaurus.servlets;

import com.google.appengine.api.memcache.Expiration;
import com.google.appengine.api.memcache.MemcacheService;
import com.google.appengine.api.memcache.MemcacheServiceFactory;
import com.google.common.base.Predicate;
import com.google.common.collect.Collections2;
import com.google.common.collect.Iterators;
import com.google.common.collect.Lists;
import com.google.common.collect.Ordering;
import org.apache.commons.fileupload.FileItemIterator;
import org.apache.commons.fileupload.FileItemStream;
import org.apache.commons.fileupload.FileUploadException;
import org.apache.commons.fileupload.servlet.ServletFileUpload;
import org.apache.commons.io.IOUtils;

import javax.annotation.Nullable;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collection;
import java.util.Date;
import java.util.Enumeration;
import java.util.List;
import java.util.logging.Logger;

public abstract class BaseServlet extends HttpServlet {
  private static final String EXPIRE_URLS_PARAM = "expire_urls";
  private static final String CONTENT_TYPE_ERROR = "text/plain";
  private static final int STATUS_CODE_ERROR = 400;
  private static final int DISABLE_URL_CACHE_VALUE = 0;
  private static final int DEFAULT_URL_CACHE_TIME_SECS = 300;
  private static final String MAX_AGE_PARAM = "max-age";
  private static final int DISABLE_MAX_AGE = 0;
  private static final int DEFAULT_MAX_AGE_PARAM = 600;

  private final MemcacheService memcache =
      MemcacheServiceFactory.getMemcacheService();
  private static final Logger logger =
      Logger.getLogger(BaseServlet.class.getName());

  @Override
  protected void service(final HttpServletRequest req,
                         final HttpServletResponse resp)
      throws ServletException, IOException {
    String filecontents;
    boolean useMemcache = isMemcacheAllowed(req);

    if (ServletFileUpload.isMultipartContent(req)) {
      filecontents = collectFromFileUpload(req);
    } else {
      filecontents = collectFromFormArgs(req);
    }

    filecontents = filecontents.trim();
    if (filecontents.length() == 0) {
      resp.setStatus(STATUS_CODE_ERROR);
      resp.setContentType(CONTENT_TYPE_ERROR);
      resp.getWriter().println("No data to parse!");
      return;
    }

    final String key = getKeyForContents(filecontents);

    Object cachedCopy;

    if (useMemcache && (cachedCopy = memcache.get(key)) !=
        null) {
      maybeSetHttpCacheHeaders(req, resp);
      render(resp, (String) cachedCopy);
    } else {
      StringReader reader = new StringReader(filecontents);
      Response results = process(resp, reader);
      if (results.isCacheable()) {
        maybeSetHttpCacheHeaders(req, resp);
        if (useMemcache) {
          memcache.put(key, results.getBody());
        }
      }
      render(resp, results.getBody());
    }
  }

  private boolean isMemcacheAllowed(HttpServletRequest hreq) {
    // If there are any caching related headers, don't use any server side
    // caches.  This isn't built to HTTP spec, but it covers the
    // shift-reload case.
    String cacheControl = hreq.getHeader("Cache-Control");
    if (cacheControl != null && (cacheControl.contains("max-age") ||
        cacheControl.contains("no-cache"))) {
      return false;
    }
    String pragma = hreq.getHeader("Pragma");
    if (pragma != null && pragma.contains("no-cache")) {
      return false;
    }
    try {
      long ims = hreq.getDateHeader("If-Modified-Since");
      if (ims != -1) {
        return false;
      }
    } catch (IllegalArgumentException e) {
      return false;
    }

    return true;
  }

  private void maybeSetHttpCacheHeaders(HttpServletRequest req,
                                        HttpServletResponse resp) {
    long cachePolicy = getCachingPolicy(req, MAX_AGE_PARAM, DISABLE_MAX_AGE,
        DEFAULT_MAX_AGE_PARAM);
    if (cachePolicy != DISABLE_MAX_AGE) {
      resp.setDateHeader("Expires", new Date().getTime() + cachePolicy * 1000);
      resp.setHeader("Cache-Control", "max-age=" + cachePolicy);
    }
  }

  private String collectFromFileUpload(final HttpServletRequest req)
      throws IOException, ServletException {
    StringBuilder collector = new StringBuilder();
    try {
      ServletFileUpload sfu = new ServletFileUpload();
      FileItemIterator it = sfu.getItemIterator(req);
      while (it.hasNext()) {
        FileItemStream item = it.next();
        if (!item.isFormField()) {
          InputStream stream = item.openStream();
          collector.append(IOUtils.toString(stream, "UTF-8"));
          collector.append("\n");
          IOUtils.closeQuietly(stream);
        }
      }
    } catch (FileUploadException e) {
      throw new ServletException(e);
    }

    return collector.toString();
  }

  private String collectFromFormArgs(final HttpServletRequest req)
      throws IOException, ServletException {
    StringBuilder collector = new StringBuilder();

    for (String urlParameterName : getSortedParameterNames(req)) {
      final String[] values = req.getParameterValues(urlParameterName);
      for (String value : values) {
        if (value.matches("^https?://.*")) {
          acquireFromRemoteUrl(req, collector, value);
        } else {
          acquireFromParameterValue(collector, value);
        }
      }
    }
    return collector.toString();
  }

  private void acquireFromRemoteUrl(final HttpServletRequest req,
                                    StringBuilder concatenatedContents,
                                    final String url) throws IOException,
      ServletException {
    logger.severe("fetching url " + url);
    try {
      final String cached = maybeFetchUrlFromCache(req, url);

      if (cached != null) {
        concatenatedContents.append(cached);
      } else {
        final String urlContents = fetchUrl(url);
        acquireFromParameterValue(concatenatedContents, urlContents);

        maybePutUrlInCache(req, url, urlContents);
      }
    } catch (MalformedURLException ex) {
      throw new ServletException(ex);
    }
  }

  private void acquireFromParameterValue(StringBuilder concatenatedContents,
                                         String value) {
    concatenatedContents.append(value);
    concatenatedContents.append("\n");
  }

  private Collection<String> getSortedParameterNames(HttpServletRequest req) {
    // We want a deterministic order so that dependencies can span input files.
    // We don't trust the servlet container to return query parameters in any
    // order, so we impose our own ordering. In this case, we use natural String
    // ordering.
    List<String> list = Lists.newArrayList(Iterators.forEnumeration(
        (Enumeration<String>) req.getParameterNames()));
    // Some parameter names should be ignored.
    Iterable<String> filtered = Collections2.filter(list,
        new Predicate<String>() {
          @Override
          public boolean apply(@Nullable String s) {
            return !(s.contains("_") || s.contains("-"));
          }
        });
    return Ordering.natural().sortedCopy(filtered);
  }

  private String getKeyForContents(final String filecontents)
      throws ServletException {
    MessageDigest sha1;
    try {
      sha1 = MessageDigest.getInstance("SHA-1");
    } catch (NoSuchAlgorithmException e) {
      throw new ServletException(e);
    }
    byte[] hashValue = sha1.digest(filecontents.getBytes());
    sha1.reset();
    return new String(hashValue);
  }

  private int getCachingPolicy(final HttpServletRequest req, String paramName,
                               int disabledValue,
                               int defaultValue) {
    int returnValue = defaultValue;

    final String asString = req.getParameter(paramName);
    if (asString != null) {
      try {
        int seconds = Integer.parseInt(asString);
        if (seconds >= 0) {
          returnValue = seconds;
        }
      } catch (NumberFormatException e) {
        returnValue = disabledValue;
      }
    }

    return returnValue;
  }

  private String fetchUrl(final String url) throws IOException {
    final URL u = new URL(url);
    return IOUtils.toString(u.openStream(), "UTF-8");
  }

  private void maybePutUrlInCache(final HttpServletRequest req,
                                  final String url, final String contents) {
    int cacheForSecs = getUrlCachePolicyFromParams(req);

    if (cacheForSecs == DISABLE_URL_CACHE_VALUE) {
      return;
    }

    memcache.put(url, contents, Expiration.byDeltaSeconds(cacheForSecs));
  }

  private int getUrlCachePolicyFromParams(HttpServletRequest req) {
    return getCachingPolicy(req, EXPIRE_URLS_PARAM,
        DISABLE_URL_CACHE_VALUE,
        DEFAULT_URL_CACHE_TIME_SECS);
  }

  private String maybeFetchUrlFromCache(final HttpServletRequest req,
                                        final String url) {
    // If the client asks us to not cache, we also delete any cached values for
    // this key.
    if (getUrlCachePolicyFromParams(req) == DISABLE_URL_CACHE_VALUE ||
        !isMemcacheAllowed(req)) {
      memcache.delete(url);
      return null;
    }

    Object cached = memcache.get(url);

    if (cached != null) {
      return (String) cached;
    } else {
      return null;
    }
  }

  protected abstract void render(HttpServletResponse resp, String response)
      throws IOException;

  protected abstract Response process(HttpServletResponse resp,
                                      StringReader reader) throws IOException;
}
