// Copyright 2008 Google Inc.
// All Rights Reserved.

/**
 * @fileoverview This is the script portion of the Google Code feed gadget. It
 *     contains code that should be safe for inlining on a given page.
 */
(function() {
  var prefs = new gadgets.Prefs();

  function myAdjustHeight() {
    if (gadgets.rpc) {
      var relay = gadgets.rpc.getRelayUrl('..');
      if (relay) {
        gadgets.window.adjustHeight();
      }
    }
  }

  function fetch(url, callback, type, opt_num_entries) {
    var params = {};
    params[gadgets.io.RequestParameters.CONTENT_TYPE] = type;
    if (type == gadgets.io.ContentType.FEED) {
      params[gadgets.io.RequestParameters.GET_SUMMARIES] = true;
    }
    if (opt_num_entries) {
      params[gadgets.io.RequestParameters.NUM_ENTRIES] = opt_num_entries;
    }
    gadgets.io.makeRequest(url, callback, params);
  }

  function fetchAsFeedLegacy(url, callback, opt_num_entries) {
    fetch(url, function(response) { callback(response.data); },
          gadgets.io.ContentType.FEED, opt_num_entries);
  }

  function fetchAsStringLegacy(url, callback) {
    fetch(url, function(response) { callback(response.text); },
          gadgets.io.ContentType.TEXT);
  }

  /**
   * The FeedGadget class is responsible for loading, rendering and handling
   * the blog and feed gadgets throughout the various code.google.com pages.
   *
   * @param {string} targetSelector jQuery compatible selector identifying the
   *     target element in which the gadget will be drawn.
   * @constructor
   */
  var FeedGadget = function(targetSelector) {
    this.targetId = targetSelector;
    this.target = jQuery(this.targetId);
    this.target.addSection = FeedGadget._appendSection;
    this.sections = [];
    this.finished = [];

    // TODO: these are redundant with the initializers in FeedGadget.prototype.
    this.feeds = prefs.getArray('feeds');
    this.opt_defer = prefs.getBool('defer');
    this.opt_random = prefs.getBool('random');
    this.opt_gadgetTitle = prefs.getString('gadgetTitle');
    this.opt_cssUrl = prefs.getString('cssUrl');
    this.opt_maxFeeds = prefs.getInt('maxFeeds');
    this.opt_showaddbutton = prefs.getBool('showaddbutton');

    return this;
  };

  /**
   * Below are the instance methods and properties of the FeedGadget class.
   */
  FeedGadget.prototype = {
    /**
     * jQuery compatible selector used to create the target property.
     * @type {string}
     */
    targetId: null,

    /**
     * jQuery wrapped target element. Used throughout.
     * @type {Object}
     */
    target: null,

    /**
     * Array of feeds used for this feed gadget.
     * @type {Array.<string>}
     */
    feeds: prefs.getArray('feeds'),

    /**
     * An array of {url, section} objects that denote when the
     * loading of a feed has finished.
     * @type {Array.<Object>}
     */
    finished: null,

    /**
     * Defer option; true if content loading is deferred.
     * @type {boolean}
     */
    opt_defer: prefs.getBool('defer'),

    /**
     * Random option; true if initial loaded feed is randomized.
     * @type {boolean}
     */
    opt_random: prefs.getBool('random'),

    /**
     * Optional override that defines which feed gets opened first
     * @type {number}
     */
    opt_openIndex: prefs.getInt('openIndex'),

    /**
     * Gadget Title; defaults to __MSG_blogs. See bundles.
     * @type {string}
     */
    opt_gadgetTitle: prefs.getString('gadgetTitle'),

    /**
     * CSS; url to the CSS used in rendering the chrome.
     * @type {string}
     */
    opt_cssUrl: prefs.getString('cssUrl'),

    /**
     * Feed entry count. This number is the maximum number of feeds
     * loaded from the JSON fetched feeds.
     * @type {number}
     */
    opt_maxFeeds: prefs.getInt('maxFeeds'),

    /**
     * Featured feed entry count. Featured feeds are rendered differently
     * than normal feeds and as such the number we load is also separately
     * definable.
     * @type {number}
     */
    opt_maxFeaturedFeeds: prefs.getInt('maxFeaturedFeeds'),

    /**
     * Minimal Featured Content; the minimal featured content has a little
     * less visible chrome and turned on by default.
     * @type {boolean}
     */
    opt_minFeaturedChrome: prefs.getBool('minFeaturedChrome'),

    /**
     * Boolean determining whether or not the show/hide is to be replaced
     * with sliding animations.
     * @type {boolean}
     */
    opt_animate: prefs.getBool('animate'),

    /**
     * Array of jQuery wrapped section elements
     * @type {Object}
     */
    sections: null,

    /**
     * Checks to see if the number of elements within the finished
     * array equals the number of feeds. If so, it fires any registered
     * allComplete events. If the opt_deferred is set to true, this
     * event fires after one feed has loaded.
     */
    checkFinished: function() {
      if (this.opt_defer) {
        if (this.finished.length >= 1) {
          jQuery(this).trigger('allComplete', [this]);
        }
      }
      else if (this.finished.length == this.feeds.length) {
        jQuery(this).trigger('allComplete', [this]);
      }
    },

    /**
     * Sets the new value of the Gadget's title. Accepts a __MSG_
     * style value as per the {@code msgValue} function.
     * @param {string} value the new value for the Gadget's Title.
     */
    setGadgetTitle: function(value) {
      this.target.find('h2.fg-maintitle').html(FeedGadget.msgValue(value));
    },

    /**
     * Retreives the gadget's title as a string.
     * @return {string} the title of the blog gadget.
     */
    getGadgetTitle: function() {
      return this.target.find('h2.fg-maintitle').text();
    },

    /**
     * Applies the common open, close and toggle events that should be
     * associated with each section added to the gadget. If the user
     * preference is to defer the loading of each section's content until
     * needed, the supplied defer event is bound to the section as well.
     *
     * @param {Object} section a jQuery wrapped section as created with
     *     any of the createSection() methods.
     * @param {Function} deferEvent if supplied, this event is bound
     *     as a {@code deferred} event on the supplied section.
     * @param {Object} deferData additional data that is to be merged
     *     with the object sent as the deferred event's data parameter.
     * @return {Object} the supplied section object is returned after it's
     *     modified.
     */
    applySectionEvents: function(section) {
      var animate = this.opt_animate;

      // Imbue the section object with open, close and toggle events
      section['open'] = function() {
        FeedGadget._sectionOpen.call(section, null, animate);
      }
      section['close'] = function() {
        FeedGadget._sectionClose.call(section, null, animate);
      }
      section['toggle'] = function() {
        FeedGadget._sectionToggle.call(section, null, animate);
      }

      // Apply the onClick event
      section.find('.fg-subheader').bind('click', {animate: animate},
        FeedGadget._sectionToggle);

      return section;
    },

    /**
     * Applies the deferred event callback. The callback will have the
     * signature {@code callback(event, furtherProcessing)} where the
     * furtherProcessing parameter is a function that should be called
     * when the deferred function is finished.
     *
     * In addition, the event parameter contains a property called data
     * which in turn contains the following properties:
     *   feed    - a string denoting this feeds url
     *   gadget  - a reference to the executing FeedGadget instance
     *   section - a reference to the section dealing with relevant content
     *
     * @param {number} the numeric ordering for this feed.
     * @param {Object} section a customized jQuery object wrapping the
     *     relevant elements denoting the current section.
     * @param {string} feed the url pointing to the feed to be loaded.
     * @param {Function} callback the bulk of the deferred event's code.
     */
    applyDeferEvent: function(index, section, feed, callback) {
      // Apply event
      section.find('.fg-subheader').one('deferred',
        {index: index, feed: feed, gadget: this, section: section}, callback);
      section.find('.fg-subheader').one('deferred', {gadget: this},
        function(e) {e.data.gadget.checkFinished();});
    },

    /**
     * Creates a set of elements, using jQuery, that are ready for immediate
     * insertion into a live document. The jQuery object returned contains
     * the elements in question.
     *
     * The result object is imbued with the following two functions:
     *   title(value)   - Called with no value it returns the current title
     *                    otherwise it replaces the title with the new value.
     *   content(value) - Called with no value it returns the jQuery wrapped
     *                    <div.fg-entries> element. Otherwise the supplied
     *                    HTML string or jQuery object of elements is inserted.
     *
     * @param {string} title the string to use as the new title for the section.
     * @param {string|Object} the HTML string or jQuery object of elements to
     *     set as the content for this sections entry content.
     * @return {Object} the jQuery wrapped section elements.
     */
    createRawSection: function(title, content) {
      var result = jQuery(FeedGadget.content_html);

      if (this.feeds.length == 1) {
        result.find('.fg-subheader:first').hide();
        this.setGadgetTitle(title || '');
      }

      (result.title = FeedGadget._setSectionTitle).call(result, title || '');
      (result.content = FeedGadget._setEntryHTML).call(result, content || '');
      result._sectionType = FeedGadget.SECTION_RAW;
      this.applySectionEvents(result);

      return result;
    },

    /**
     * Creates a set of elements, using jQuery, that are ready for immediate
     * insertion into a live document. The jQuery object returned contains
     * the elements in question.
     *
     * The result object is imbued with the following functions:
     *   title(value)     - Called with no value it returns the current title
     *                      otherwise it replaces the title with the new value.
     *   subscribe(value) - Called with no value it returns the current href
     *                      otherwise it replaces the url.
     *   readMore(value)  - Called with no value it returns the current read
     *                      more href; otherwise it sets the supplied value.
     *   entry(value,no)  - Called with a null or undefined value it returns
     *                      the first (or specified) entry wrapped in a jQuery
     *                      object. Otherwise it sets the (specified) entry
     *                      with the supplied value. Value can be an HTML
     *                      string or jQuery selected elements.
     *
     * @param {string} title the string to use as the new title for the section.
     * @param {string} subUrl the new url to use for the subscribe link.
     * @param {string|Object} a block of HTML or a jQuery object of selected
     *     elements that should be inserted in the correct location.
     * @param {string} moreUrl the new url to use for the read more link.
     * @return {Object} a jQuery wrapped feed section.
     */
    createFeedSection: function(title, subUrl, entries, moreUrl) {
      var result = jQuery(FeedGadget.feed_html);

      if (this.feeds.length == 1) {
        result.find('.fg-subheader:first').hide().find('.fg-subscribe').
          appendTo(this.target.find('.fg-header'));
        this.setGadgetTitle(title || '');
      }

      (result.title = FeedGadget._setSectionTitle).call(result, title || '');
      (result.subscribe = FeedGadget._setSectionSubscribeUrl).call(result,
        subUrl || '#');
      (result.readMore = FeedGadget._setSectionReadMoreUrl).call(result,
        moreUrl || '');
      (result.entry = FeedGadget._setSectionEntry).call(result, entries || '');
      result._sectionType = FeedGadget.SECTION_FEED;

      this.applySectionEvents(result);

      return result;
    },

    /**
     * This method is responsible for drawing the chrome and setting up the
     * the gadget. The gadget is written such that the chrome renders before
     * any remote feeds are loaded. As such, it should appear as quickly as
     * possible.
     */
    drawChrome: function() {
      // Adds the raw chrome to the page
      this.target.append(jQuery(FeedGadget.gadget_html).hide());

      // Set gadget title
      this.setGadgetTitle(this.opt_gadgetTitle);

      // Choose which feed to open first
      var openWhich = this.opt_openIndex || 0;
      if (this.opt_random && this.feeds.length > 1) {
        openWhich = Math.ceil(this.feeds.length * Math.random()) - 1;
      }

      // Add an event for when the rendering is done
      jQuery(this).one('renderComplete', function(event, gadget) {
        gadget.sections[openWhich].open();
      });

      jQuery(this).one('allComplete', function(event, gadget) {
        jQuery('#gc-blog-gadget').show();
        myAdjustHeight();
      });

      // Create reference to this for the jQuery.each() call
      var gadget = this;

      // Process each of the unique feed URLs
      jQuery.each(this.feeds, function(index, feedUrl) {
        var data;

        if ((data = /(raw|escaped):(.*?):(.*)/i.exec(feedUrl))) {
          var section;

          gadget.target.addSection((section =
            gadget.createRawSection(data[2])));

          if (gadget.opt_defer) {
            gadget.applyDeferEvent(index, section, feedUrl,
              gadget._handleRawData);
          } else {
            gadget._handleRawData({data: {index: index, feed: feedUrl,
              gadget: gadget, section: section}});
          }

          gadget.sections.push(section);
        }

        else if ((data = /html:(.*?):(.*)/i.exec(feedUrl))) {
          var section;

          gadget.target.addSection(section = gadget.
            createRawSection(data[1], data[2]));

          gadget.sections.push(section);
          gadget.finished.push({url: 'n/a', section: section});
          gadget.checkFinished();
        }

        else if ((data = /frame:(.*?):(.*)/i.exec(feedUrl))) {
          var section, frame = jQuery(['<iframe src="', data[2], '" ',
            'frameborder="0" width="100%"></iframe>'].join(''));

          gadget.target.addSection(section = gadget.
            createRawSection(data[1], frame));

          gadget.sections.push(section);
          gadget.finished.push({url: data[2], section: section});
          gadget.checkFinished();
        }

        else if ((data = /featured:(.*?):(.*)/i.exec(feedUrl))) {
          var section, title = data[1], url = data[2];

          gadget.target.addSection(section = gadget.createFeedSection(title));

          section.title(title);
          section.subscribe(url);

          if (gadget.opt_defer) {
            gadget.applyDeferEvent(index, section, url,
              gadget._handleFeaturedContent);
          } else {
            gadget._handleFeaturedContent({data: {index: index, feed: url,
              gadget: gadget, section: section}});
          }

          gadget.sections.push(section);
        }

        else {
          var section, data, title;

          if ((data = /([^:]*?):(.*:.*)/.exec(feedUrl))) {
            title = data[1];
            feedUrl = data[2];
          }

          // Create the new (almost) empty feed section and add it to the DOM
          gadget.target.addSection(section = gadget.createFeedSection(title));

          section.title(title);
          section.subscribe(feedUrl);

          if (gadget.opt_defer) {
            gadget.applyDeferEvent(index, section, feedUrl,
              gadget._handleFeed);
          } else {
            gadget._handleFeed({data: {index: index, feed: feedUrl,
              gadget: gadget, section: section}});
          }

          gadget.sections.push(section);
        }
      });

      // Check to see if we need to add the add-to-your-page button.
      this._handleAddButton();

      jQuery(this).trigger('renderComplete', [this]);
    },

    /**
     * By default, adding of the "Add this gadget to your page" button is
     * disabled. However, for the pages on code.google.com, the ones the
     * gadget was designed for, this button is required. This function places
     * the button within the gadget's footer.
     */
    _handleAddButton: function() {
      if (this.opt_showaddbutton) {
        jQuery(function() {
          var addButtonUrl = [
            'http://fusion.google.com/ig/add?',
            'synd=open&',
            'source=ggyp&',
            'moduleurl=',
            prefs.getString('prodGadgetUrl')
          ].join('');

          var args = _args();
          for (var a in args) {
            if (a.indexOf('up_') == 0) {
              addButtonUrl = [addButtonUrl, '&', a, '=', args[a]].join('');
            }
          }

          // Add the jQuery button to the page
          jQuery('#google-code-feed-gadget .fg-footer').append([
            '<a href="', addButtonUrl, '" target="_top">',
              '<img src="http://gmodules.com/ig/images/plus_google.gif" ',
                'style="border:none">',
            '</a>'
          ].join('')).css({
            height: 'auto',
            textAlign: 'right',
            padding: '1px 0 1px 0'
          });
        });
      }
    },

    /**
     * This method is either called when the section is first opened or it's
     * called directly in the {@code drawChrome()} method if {@code opt_defer}
     * is false.
     * @param {Object} event a browser normalized event object.
     * @param {Function} finallyFn an optional function that should be called
     *     if available. It handles subsequent processing passed on by other
     *     functions.
     */
    _handleRawData: function(event, finallyFn) {
      var feedData = /(raw|escaped)\:(.*?)\:(.*)/i.exec(event.data.feed);
      var type = feedData[2], url = feedData[3], gadget = event.data.gadget;
      event.data.section.find('.fg-loading').show();

      fetchAsStringLegacy(url, function(content) {
        event.data.section.find('.fg-loading').hide();
        event.data.section.content(type == 'raw' ? content : _hesc(content));
        if (finallyFn) {
          finallyFn();
        }
        gadget.postProcess(event.data.section);
        gadget.finished.push({url: url, section: event.data.section});
        gadget.checkFinished();
      });
    },

    /**
     * This method is either called when the section is first opened or it's
     * called directly in the {@code drawChrome()} method if {@code opt_defer}
     * is false.
     * @param {Object} event a browser normalized event object.
     * @param {Function} finallyFn an optional function that should be called
     *     if available. It handles subsequent processing passed on by other
     *     functions.
     */
    _handleFeed: function(event, finallyFn) {
      var gadget = event.data.gadget;
      var feedUrl = event.data.feed.replace(' ', '+');
      var index = event.data.index;
      var section = event.data.section;

      section.find('.fg-loading').show();

      fetchAsFeedLegacy(feedUrl, function(feed) {
        section.find('.fg-loading').hide();
        if (section.title() == '') {
          section.title(feed.Title);
        }

        var link = "";
        if (typeof feed.Link == 'string') {
          link = feed.Link;
        } else if (typeof feed.URL == 'string') {
          link = feed.URL;
        }
        link = jQuery.trim(link);
        section.subscribe(link);
        section.readMore(link);
        section.entry(FeedGadget._buildFeedEntries(feed), 'last');
        if (finallyFn) {
          finallyFn();
        }
        gadget.postProcess(section);
        gadget.finished.push({url: feedUrl, section: section});
        gadget.checkFinished();
      }, gadget.opt_maxFeeds);
    },

    /**
     * This method is either called when the section is first opened or it's
     * called directly in the {@code drawChrome()} method if {@code opt_defer}
     * is false.
     * @param {Object} event a browser normalized event object.
     * @param {Function} finallyFn an optional function that should be called
     *     if available. It handles subsequent processing passed on by other
     *     functions.
     */
    _handleFeaturedContent: function(event, finallyFn) {
      var gadget = event.data.gadget;
      var feedUrl = event.data.feed.replace(' ', '+');
      var index = event.data.index;
      var section = event.data.section;

      section.find('.fg-loading').show();

      fetchAsFeedLegacy(feedUrl, function(feed) {
        // Remove loading marker
        section.find('.fg-loading').hide();
        section.subscribe(feedUrl);

        // Markup existing section content
        var jContainer = jQuery(FeedGadget.featured_content_container_html);
        var jEntries = section.find('.fg-entries').addClass('fcg');

        // Empty standard .fg-entries div and insert our container
        // Note: Here we reassign jContainer since modifying its
        // contents after the next statement would normally do nothing.
        jContainer = jEntries.empty().append(jContainer);

        // Put something there in case of error.
        if (!feed) {
          jContainer.find('.fcg-contents').
            append(prefs.getMsg('error.loading'));
        } else {
          if (gadget.opt_minFeaturedChrome) {
            jContainer.addClass('fcg-minimal');
            jContainer.find('.fcg-corner').remove();
          }

          var features = [], contents = jContainer.find('.fcg-contents');
          for (var i = 0, feature; i < feed.Entry.length; i++) {
            feature = jQuery('<div>').addClass('fcg-feature' +
              (i == 0 ? ' fcg-first-feature' : ''));

            feature.html(jQuery(feed.Entry[i].Summary).eq(0).html());
            feature.append('<div class="fcg-clear"></div>');
            feature.find('img[width=1][height=1]').
              css({position: 'absolute'});

            contents.append(feature);
            features.push(feature);
          }

          var featureList = section.find('.fcg-feature');
          var currentFeature = 0;

          jContainer.find('.fcg-previous').click(function(event) {
            var prev;
            var current = featureList.eq(currentFeature);
            var width = parseInt(section.css('width'));

            currentFeature = currentFeature == 0 ?
              featureList.length - 1 : currentFeature - 1;

            prev = featureList.eq(currentFeature);

            current.hide();

            if (gadget.opt_animate) {
              prev.css({left: (width * -1)}).show().animate({left: 0});
            } else {
              prev.show();
            }
          }).attr('href', 'javascript:void("Previous")').css('z-index', '2');

          jContainer.find('.fcg-next').click(function(event) {
            var next;
            var current = featureList.eq(currentFeature);
            var width = section.css('width');

            currentFeature = currentFeature + 1 == featureList.length ?
              0 : currentFeature + 1;

            next = featureList.eq(currentFeature);

            current.hide();
            if (gadget.opt_animate) {
              next.css({left: width}).show().animate({left: 0});
            } else {
              next.show();
            }
          }).attr('href', 'javascript:void("Next")').css('z-index', '2');

          features._feed = feed;
        }

        if (finallyFn) {
          finallyFn();
        }
        gadget.postProcess(section);
        gadget.finished.push({url: feedUrl, section: section});
        gadget.checkFinished();
      }, gadget.opt_maxFeaturedFeeds);
    },

    /**
     * This method is called at the end of each function that prepares
     * section data. After the data is loaded and placed appropriately
     * the postProcess() function is responsible for setting the content's
     * <a> elements' target attribute such that loaded content doesn't
     * render within the Gadget's frame.
     *
     * @param {Object} section the section upon which to work.
     */
    postProcess: function(section) {
      var anchors = section.find('.fcg-contents a, .fg-entry a');
      var newHref;
      var anchor;
      for (var i = 0; i < anchors.length; i++) {
        anchor = anchors.eq(i);
        newHref = FeedGadget.scrubUrl(anchor.attr('href'));

        anchor.attr('href', newHref);
        anchor.attr('target', '_top');
      }
    }
  }

  /**
   * Static properties and methods of the FeedGadget class.
   */
  jQuery.extend(FeedGadget, {
    /**
     * A constant variable defining the type of section that was created.
     * @type {string}
     */
    SECTION_RAW: 'raw',

    /**
     * A constant variable defining the type of section that was created.
     * @type {string}
     */
    SECTION_FEED: 'feed',

    /**
     * A constant variable defining the type of section that was created.
     * @type {string}
     */
    SECTION_FEATURED: 'raw',

    /**
     * A constant variable defining the type of section that was created.
     * @type {string}
     */
    SECTION_CUSTOM: 'custom',

    /**
     * A snippet defining the exterior of the gadget.
     */
    gadget_html: [
      '<div id="gc-blog-gadget" class="roundbox solidbox">',
        '<div class="fg-header">',
          '<h2 class="fg-maintitle"></h2>',
        '</div>',
        '<div class="fg-clearer"></div>',
        '<div class="fg-divider"></div>',
        '<div class="fg-footer"></div>',
      '</div>'
    ].join(''),

    /**
     * This is a block defining the standard feed section.
     */
    feed_html: [
      '<div class="fg-section">',
        '<div class="fg-subheader">',
          '<img class="fg-sign" src="@cleardot"/>',
          '<span></span>', // This is the section title span
          '<span class="fg-loading" style="display: none;">',
            ' (@loading)',
          '</span>',
          '<div class="fg-subscribe">',
            '<a href="#" target="_top" title="@subscribeAltText">',
              '<img alt="@subscribeAltText" src="@cleardot"/>',
            '</a>',
          '</div>',
        '</div>',
        '<div class="fg-entries">',
          '<div class="fg-subfooter">',
            '<a href="#" target="_top">@readmoreText</a>',
          '</div>',
        '</div>',
        '<div class="fg-divider"></div>',
      '</div>'
    ].join('').
      replace(/@cleardot/g, prefs.getString('cleardot')).
      replace(/@loading/g, prefs.getMsg('loading')).
      replace(/@subscribeAltText/g, prefs.getMsg('subscribe')).
      replace(/@readmoreText/g, prefs.getMsg('read.more') + ' &#x00BB;'),

    /**
     * This block constitutes a feed entry within a section.
     *
     * The HTML includes the following replacement tokens:
     *   -@titleUrl   the url for the title of the entry
     *   -@titleText  the text for the entries title
     *   -@byline     the byline text
     *   -@snippet    the snippet text
     */
    feed_entry_html: [
      '<div class="fg-entry">',
        '<h3 class="fg-maintitle">',
          '<a href="@titleUrl" target="_top">@titleText</a>',
        '</h3>',
        '<div class="fg-byline">',
          '@byline',
        '</div>',
        '<div class="fg-snippet">',
          '@snippet',
        '</div>',
      '</div>',
      '<div class="fg-divider"></div>'
    ].join(''),


    /**
     * This block of HTML is used as a template for featured content feeds.
     */
    featured_content_container_html: [
      '<a class="fcg-previous" title="@prevTitle" href="">&#x00AB;</a>',
      '<div class="fcg-contents"></div>',
      '<a class="fcg-next" title="@nextTitle" href="">&#x00BB;</a>',
      '<div class="fcg-footer"></div>',
      '<div class="fcg-corner fcg-tl"></div>',
      '<div class="fcg-corner fcg-tr"></div>',
      '<div class="fcg-corner fcg-bl"></div>',
      '<div class="fcg-corner fcg-br"></div>'
    ].join('').
      replace(/@prevTitle/g, prefs.getMsg('previous')).
      replace(/@nextTitle/g, prefs.getMsg('next')),

    /**
     * Used instead of a standard feed section, this allows easy
     * insertion of a block of HTML.
     */
    content_html: [
      '<div class="fg-section">',
        '<div class="fg-subheader">',
          '<img class="fg-sign" src="@cleardot"/>',
          '<span></span>', // This is the section title span
          '<span class="fg-loading" style="display: none;">',
            ' (@loading)',
          '</span>',
        '</div>',
        '<div class="fg-entries">',
          '<div class="fg-entry"></div>',
        '</div>',
        '<div class="fg-divider"></div>',
      '</div>'
    ].join('').
      replace(/@cleardot/g, prefs.getString('cleardot')).
      replace(/@loading/g, prefs.getMsg('loading')),

    /**
     * Used to parse any string value for an internationized string. If
     * the supplied parameter contains the prefix {@code __MSG_<msgName>__}
     * then {@code <msgName>} will be used in a call to {@code getMsg()}.
     * Otherwise, the supplied string will be returned.
     * @param {string} string the string to parse for an i18n message name.
     * @return {string} either the i18n version of the message string or
     *     the supplied string parameter if not embedded string request
     *     exists.
     */
    msgValue: function(string) {
      var result = /__MSG_(.*?)__/.exec(string);
      return result ? prefs.getMsg(result[1]) : string;
    },

    /**
     * A delegate function; currently used to fix a bug in offending feeds
     * where returned content has pre- and post-fixed %20 text that shouldnt
     * be there.
     * @param {string} string a url string that needs scrubbing.
     * @return {string} a potentially modified version of the supplied url
     *     parameter.
     */
    scrubUrl: function(string) {
      // TODO(gharrison): this is here to fix bad HTML from the appengine
      // feed and should be removed when that feed is fixed.
      return string.replace(/^(%20)*(.*?)(%20)*$/, '$2');
    },

    /**
     * This function is attached to a <div.fg-subheader> element
     * and slides the element's associated content <div> into view.
     * If the <div.fg-subheader> element has one or more custom
     * 'deferred' events associated with it, they are called and
     * passed an anonymous function as their second parameter that
     * finishes the opening of the section.
     */
    _sectionOpen: function(event, animate) {
      var jSubHeader = jQuery(this);
      var events = jSubHeader.data('events');
      var openMethod = animate ? 'slideDown' : 'show';

      if (!jSubHeader.is('.fg-subheader')) {
        jSubHeader = jSubHeader.find('.fg-subheader');
        events = jSubHeader.data('events');
      }

      /**
       * The code that actually opens the section's relevant content
       * div visually. Placed within anonymous function should it need
       * to be called in the deffered event.
       * @type {Function}
       */
      var openIt = function() {
        if (jSubHeader.is(':not(.fg-expanded)')) {
          jSubHeader.addClass('fg-expanded').
            siblings('.fg-entries:first')[openMethod]();
        }
        myAdjustHeight();
      }

      if (events && events['deferred']) {
        jSubHeader.trigger('deferred', [openIt]);
      } else {
        openIt();
      }
    },

    /**
     * This function is attached to a <div.fg-subheader> element
     * and slides the element's associated content <div> out of view.
     */
    _sectionClose: function(event, animate) {
      var jSubHeader = jQuery(this);

      if (jSubHeader.is('.fg-expanded')) {
        jSubHeader.removeClass('fg-expanded').
          siblings('.fg-entries:first')[animate ? 'slideUp' : 'hide']();
      }

      myAdjustHeight();
    },

    /**
     * This function toggles the currently clicked element and calls
     * its relevant open or close method based on its current visibility.
     * After which it immediately calls close on all the sibling
     * section elements having the class {@code fg-expanded}.
     */
    _sectionToggle: function(event, animate) {
      var jSubHeader = jQuery(this);

      // Check for event.data.animate
      if (event && event.data && event.data.animate) {
        animate = true;
      }

      // Toggle this entry
      if (jSubHeader.is('.fg-expanded')) {
        FeedGadget._sectionClose.call(this, null, animate);
      } else {
        FeedGadget._sectionOpen.call(this, null, animate);
      }

      // Close all other open sections using the section
      var sections = jSubHeader.parent().siblings('.fg-section').
        children('.fg-subheader.fg-expanded');

      for (var i = 0; i < sections.length; i++) {
        FeedGadget._sectionClose.call(sections[i], null, animate);
      }

      myAdjustHeight();
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own title entry easily.
     * @param {string} value HTML content for the nested fg-entry
     *     div within.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setSectionTitle: function(value, index) {
      var title = this.find('.fg-subheader').eq(index || 0);

      if (!title.is(':visible')) {
        title = this.parents('#gc-blog-gadget').find('.fg-maintitle');
        if (!title.length) {
          return;
        }
      }

      if (!value) {
        return title.find('span:first').html();
      } else {
        title.find('span:first').html(FeedGadget.msgValue(value));
      }

      return this;
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own title entry easily.
     * @param {string} value HTML content for the nested fg-entry
     *     div within.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setSectionEntry: function(value, index) {
      if (!value) {
        return this.find('.fg-entry').eq(parseInt(index) || 0);
      }

      if (!parseInt(index) && index == 'last') {
        if (this.find('.fg-entry').length == 0) {
          return this.find('.fg-subfooter').before(value).end();
        } else {
          return this.find('.fg-entries .fg-entry:last').after(value).end();
        }
      } else {
        index = 0;
      }

      if (this.find('.fg-entry').length == 0) {
        return this.find('.fg-entries').prepend(value).end();
      } else {
        return this.find('.fg-entries .fg-entry').eq(parseInt(index) || 0).
          prepend(value).end();
      }
    },

    /**
     * This handy piece of code is used to generate a large block of
     * HTML code that contains the feed entries.
     * @param {Object} feed the result from the AJAX gadget API call
     *     {@code fetchAsFeedLegacy()}.
     * @return {string} a large string of concatenated HTML.
     */
    _buildFeedEntries: function(feed) {
      var entries = [];

      if (!feed || !feed.Entry) {
        entries.push([
          '<div class="fg-entry">',
            '<b>Error loading feed!</b>',
          '</div>',
          '<div class="fg-divider"></div>'
        ].join(''));

        return entries;
      }

      for (var e = 0, entry; e < feed.Entry.length; e++) {
        var content = feed.Entry[e].Summary;
        var ellipsis = content.length > 120 ? '...' : '';
        var title = feed.Entry[e].Title;
        var titleUrl = feed.Entry[e].Link;
        var entryDate = null;
        var month = null;
        var year = null;
        var dateString = null;
        var byline = '';

        if (feed.URL.indexOf('spreadsheets.google.com') != -1) {
          var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul',
            'aug', 'sep', 'oct', 'nov', 'dec'];

          for (var m = 0; m < months.length; m++) {
            months[months[m]] = m;
          }

          var pairs = content.split(',');
          var gdata = {};
          for (var p = 0, pair, key, value; p < pairs.length; p++) {
            pair = pairs[p].split(':');
            key = jQuery.trim(pair[0]);
            pair.splice(0, 1);
            value = jQuery.trim(pair.join(':'));
            gdata[key] = value;
          }

          title = gdata['title'] || '';
          titleUrl = gdata['link'] || '';
          content = gdata['content'] || '';
          entryDate = /(^\d{1,2})-(.*?)-(\d*)/.exec(gdata['date']);
          if (entryDate) {
            month = months[entryDate[2].toLowerCase()];
            dateString = prefs.getMsg('month.' + month) + ' ' +
              entryDate[1] + ', ' + entryDate[3];
          }
          else {
            dateString = '';
          }
        }
        else if (!dateString && feed.Entry[e].Date) {
          entryDate = new Date(feed.Entry[e].Date);

          if (entryDate.getFullYear) {
            year = entryDate.getFullYear();
          } else {
            year = entryDate.getYear();
            if (year < 2000) {
              year += 1900;
            }
          }

          dateString = prefs.getMsg('month.' + entryDate.getMonth()) + ' ' +
            entryDate.getDate() + ', ' + year;
        } else {
          dateString = '';
        }

        // Truncate the content and append a ellipsis if the previous content
        // length was greater than 120 characters.
        content = content.replace(/<.*?>/g, ' ').substr(0, 120) + ellipsis;

        if (dateString.length) {
          byline += dateString;
        }

        entry = this.feed_entry_html.
          replace(/@titleText/g, title).
          replace(/@byline/g, byline).
          replace(/@titleUrl/g, titleUrl).
          replace(/@snippet/g, content);

        entries.push(entry);
      }

      return entries.join('');
    },

    /**
     * Assigned to the jQuery wrapper around the gadgets chrome,
     * this method takes the HTML or jQuery wrapped section elements
     * and inserts them in the appropriate place.
     * @param {string|Object} the HTML or jQuery wrapped elements to
     *     append to the portion of the chrome containing the sections.
     * @return {Object} returns this (a jQuery wrapped object).
     */
    _appendSection: function(value) {
      if (!value) {
        return;
      }

      return this.find('.fg-section:last, .fg-divider:first').
        eq(0).after(value);
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own subscribe href entry easily.
     * @param {string} value HTML content for the nested fg-subscribe
     *     link within.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setSectionSubscribeUrl: function(value, altText, index) {
      var subElement = this.find('.fg-subscribe').eq(index || 0);
      if (!subElement.length) {
        subElement = this.parent().find('.fg-header .fg-subscribe');
        if (subElement.length == 0) {
          return;
        }
      }

      if (!value) {
        return subElement.find('a:first').attr('href');
      }

      var parsedValue = FeedGadget.scrubUrl(value);
      subElement.find('a:first').attr('href',
        FeedGadget.msgValue(parsedValue)).end().end();

      if (altText) {
        subElement.
          find('a:first').attr('title', FeedGadget.msgValue(altText)).
          find('img:first').attr('alt', FeedGadget.msgValue(altText)).
          end().end();
      }

      return this;
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own read more href entry easily.
     * @param {string} value HTML content for the nested fg-subscribe
     *     link within.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setSectionReadMoreUrl: function(value, index) {
      if (!value) {
        return this.find('.fg-subfooter').eq(index || 0).find('a:first').
          attr('href');
      }

      var parsedValue = FeedGadget.scrubUrl(value);
      return this.find('.fg-subfooter').eq(index || 0).
        find('a:first').attr('href',
        FeedGadget.msgValue(parsedValue)).end().end();
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own title entry easily.
     * @param {string} value HTML content for the nested fg-entry
     *     div within a raw section snippet.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setEntryTitle: function(value, index) {
      if (!value) {
        return this.find('.fg-maintitle').eq(index || 0).find('a:first').
          text();
      }

      return this.find('.fg-maintitle').eq(index || 0).
        find('a:first').html(FeedGadget.msgValue(value)).end().end();
    },

    /**
     * Assigned to a jQuery object, adds the ability to target and
     * set it's own content entry easily.
     * @param {string} value HTML content for the nested fg-entry
     *     div within a raw section snippet.
     * @return {Object} the jQuery-wrapped raw section elements.
     */
    _setEntryHTML: function(value, index) {
      if (!value) {
        return this.find('.fg-entry').eq(index || 0);
      }

      return this.find('.fg-entry').eq(index || 0).
        html(FeedGadget.msgValue(value)).end();
    }
  });

  window['FeedGadget'] = FeedGadget;
})();
