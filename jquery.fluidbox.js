// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ( $, window, document, undefined ) {

	"use strict";

		// undefined is used here as the undefined global variable in ECMAScript 3 is
		// mutable (ie. it can be changed by someone else). undefined isn't really being
		// passed in so we can ensure the value of it is truly undefined. In ES5, undefined
		// can no longer be modified.

		// window and document are passed through as local variable rather than global
		// as this (slightly) quickens the resolution process and can be more efficiently
		// minified (especially when both are regularly referenced in your plugin).

		// Create the defaults once
		var $w			= $(window),
			$d			= $(document),
			pluginName	= "fluidbox",
			defaults	= {
				immediateOpen: false,
				loadingEle: false,
				resizeThrottle: 500,
				stackIndex: 1000,
				stackIndexDelta: 10,
				viewportFill: 0.95,
			},
			globalData = {},
			keyboardEvents = ['keyup', 'keydown', 'keypress'];
		
		// -------------------------------------------------------- //
		//  Dependency: Paul Irish's jQuery debounced resize event  //
		// -------------------------------------------------------- //
		(function($,sr){

			// debouncing function from John Hann
			// http://unscriptable.com/index.php/2009/03/20/debouncing-javascript-methods/
			var debounce = function (func, threshold, execAsap) {
				var timeout;

				return function debounced () {
					var obj = this, args = arguments;
					function delayed () {
						if (!execAsap)
						func.apply(obj, args);
						timeout = null;
					};

					if (timeout)
						clearTimeout(timeout);
					else if (execAsap)
						func.apply(obj, args);

					timeout = setTimeout(delayed, threshold || 100);
				};
			}
			// smartresize
			jQuery.fn[sr] = function(fn){  return fn ? this.bind('resize', debounce(fn)) : this.trigger(sr); };

		})(jQuery,'smartresize');

		// ---------------------------------------------------------------------------------------------------------------------- //
		//  Dependency: David Walsh (http://davidwalsh.name/css-animation-callback)                                               //
		//              and                                                                                                       //
		//              Jonathan Suh (https://jonsuh.com/blog/detect-the-end-of-css-animations-and-transitions-with-javascript/)  //
		// ---------------------------------------------------------------------------------------------------------------------- //
		var whichTransitionEvent = function() {
			var t,
				el = document.createElement("fakeelement");

			var transitions = {
				"transition"      : "transitionend",
				"OTransition"     : "oTransitionEnd",
				"MozTransition"   : "transitionend",
				"WebkitTransition": "webkitTransitionEnd"
			}

			for (t in transitions){
				if (el.style[t] !== undefined){
					return transitions[t];
				}
			}
		}
		var customTransitionEnd = whichTransitionEvent();

		// The actual plugin constructor
		function Plugin (element, options) {
			// Assign element
			this.element = element;
			
			// Merge defaults into options, into dataset
			this.settings = $.extend( {}, defaults, options, $(this.element).data());

			// Coerce settings
			this.settings.viewportFill		= Math.max(Math.min(parseFloat(this.settings.viewportFill), 1), 0);
			if(this.settings.stackIndex < this.settings.stackIndexDelta) {
				settings.stackIndexDelta = settings.stackIndex;
			}

			// Store plugin name
			this._name = pluginName;

			// Initialize
			this.init();
		}

		// Private functions
		var _fun = {
			dom: function() {
				// Wrap and add ghost element
				var $fb_innerWrap = $('<div />', {
					'class': 'fluidbox__wrap',
					css: {
						zIndex: this.settings.stackIndex - this.settings.stackIndexDelta
					}
				})
				$(this.element)
				.addClass('fluidbox--closed')
				.wrapInner($fb_innerWrap)
				.find('img')
					.first()
					.css({ opacity: 1})
					.addClass('fluidbox__thumb')
					.after('<div class="fluidbox__ghost" />');

				// Append loader
				var $fbLoader = $('<div />', {
					'class': 'fluidbox__loader',
					css: {
						zIndex: 2
					}
				});
				$(this.element).find('.fluidbox__wrap').append($fbLoader);
			},
			prepareFb: function() {
				var fb	= this,
					$fb	= $(this.element);

				// Thumbnail is successfully loaded, fire event
				$fb.trigger('thumbloaddone.fluidbox');

				// Get basic measurements and to resize the ghost element
				_fun.measure.fbElements.call(this);

				// Bind events
				fb.bindEvents();

				// Status: Fluidbox is ready to use
				$fb.addClass('fluidbox--ready');

				// Bind listeners
				fb.bindListeners();

				// Emit custom even
				$fb.trigger('ready.fluidbox');
			},
			measure: {
				viewport: function() {
					globalData.viewport = {
						w: $w.width(),
						h: $w.height()
					};
				},
				fbElements: function() {
					var fb			= this,
						$fb			= $(this.element),
						$fbThumb	= $fb.find('img').first(),
						$fbGhost	= $fb.find('.fluidbox__ghost'),
						$fbWrap		= $fb.find('.fluidbox__wrap');

					// Store image dimensions in instance data
					fb.instanceData.thumb = {
						natW:	$fbThumb[0].naturalWidth,
						natH:	$fbThumb[0].naturalHeight,
						w:		$fbThumb.width(),
						h:		$fbThumb.height()
					};

					// Set ghost dimensions
					$fbGhost
					.css({
						width: $fbThumb.width(),
						height: $fbThumb.height(),
						top: $fbThumb.offset().top - $fbWrap.offset().top + parseInt($fbThumb.css('borderTopWidth')) + parseInt($fbThumb.css('paddingTop')),
						left: $fbThumb.offset().left - $fbWrap.offset().left + parseInt($fbThumb.css('borderLeftWidth')) + parseInt($fbThumb.css('paddingLeft'))
					});
				}
			}
		};

		// Public functions
		$.extend(Plugin.prototype, {
			init: function () {
			
				// Define elements
				var fb				= this,
					$fb				= $(this.element),
					$fbThumb		= $fb.find('img').first();

				// Get basic measurements
				_fun.measure.viewport();

				// Only perform initialization when
				// - It is not yet initialized
				// + DOM checks are satisfied:
				// +-- An anchor element is selected
				// +-- Contains one and only one child
				// +-- The only child is an image element OR a picture element
				// +-- The element must not be hidden (itself or its parents)
				if(
					(!fb.instanceData || !fb.instanceData.initialized) &&
					(
						$fb.is('a') &&
						$fb.children().length === 1 &&
						(
							$fb.children().is('img') || (
								$fb.children().is('picture') &&
								$fb.find('img').length === 1
							)
						) &&
						$fb.css('display') !== 'none' &&
						$fb.children().css('display') !== 'none' &&
						$fb.parents().css('display') !== 'none'
					)
				) {

					// Initialize and store original node
					fb.instanceData = {};
					fb.instanceData.initialize = true;
					fb.instanceData.originalNode = $fb.html();

					// Status: Fluidbox has been initialized
					$fb.addClass('fluidbox--initialized');

					// DOM replacement
					_fun.dom.call(fb);

					// Emit custom event
					$fb.trigger('init.fluidbox');

					// Wait for image to load, but only if image is not found in cache
					var img = new Image();
					if($fbThumb.width() > 0 && $fbThumb.height() > 0) {
						// Thumbnail loaded from cache, let's prepare fluidbox
						_fun.prepareFb.call(fb);
					} else {
						img.onload = function() {
							// Thumbnail loaded, let's prepare fluidbox
							_fun.prepareFb.call(fb);
						};
						img.onerror = function() {
							// Trigger custom error event
							$fb.trigger('thumbloadfail.fluidbox');
						};
						img.src = $fbThumb.attr('src');
					}
				}

			},
			open: function() {
				// Open Fluidbox
				var fb			= this,
					$fb			= $(this.element),
					$fbThumb	= $fb.find('img').first(),
					$fbGhost	= $fb.find('.fluidbox__ghost'),
					$fbWrap		= $fb.find('.fluidbox__wrap');

				// Forcibly turn off transition end detection,
				// otherwise users will get choppy transition if toggling between states rapidly
				$fbGhost.off(customTransitionEnd);

				// Close all other Fluidbox instances
				$('.fluidbox--opened').fluidbox('close');

				// Emit custom event
				$fb.trigger('openinit.fluidbox');

				// Append overlay
				var $fbOverlay = $('<div />', {
					'class': 'fluidbox__overlay',
					css: {
						zIndex: -1
					}
				});
				$fbWrap.append($fbOverlay);

				// Add class to indicate larger image being loaded
				$fb
				.removeClass('fluidbox--closed')
				.addClass('fluidbox--loading');

				// Set thumbnail image source as background image first, worry later
				$fbGhost.css({
					'background-image': 'url('+$fbThumb.attr('src')+')',
					opacity: 1
				});

				// Set dimensions for ghost
				_fun.measure.fbElements.call(fb);

				// Wait for ghost image to preload
				if (fb.settings.immediateOpen) {
					// Update classes
					$fb
					.addClass('fluidbox--opened fluidbox--loaded')
					.find('.fluidbox__wrap')
						.css({ zIndex: fb.settings.stackIndex + fb.settings.stackIndexDelta });

					// Compute
					fb.compute();

					// Hide thumbnail
					$fbThumb.css({ opacity: 0 });

					// Show overlay
					$('.fluidbox__overlay').css({ opacity: 1 });

					// Emit custom event when ghost image finishes transition
					$fbGhost.one(customTransitionEnd, function() {
						$fb.trigger('openend.fluidbox');
					});

					var img = new Image();
					img.onload = function() {
						// Perform only if the Fluidbox instance is still open
						if (fb.instanceData.state === 1) {
							// Set new natural dimensions
							fb.instanceData.thumb.natW = img.naturalWidth;
							fb.instanceData.thumb.natH = img.naturalHeight;

							// Remove loading status
							$fb.removeClass('fluidbox--loading');

							// Set new image background
							$fbGhost.css({ 'background-image': 'url('+img.src+')' });

							// Compute
							fb.compute();
						}
					};
					img.onerror = function() {
						// Trigger closing
						fb.close();

						// Emit custom event
						$fb.trigger('delayedloadfail.fluidbox');
					}
					img.src = $fb.attr('href');
					
				} else {
					var img = new Image();
					img.onload = function() {

						// Update classes
						$fb
						.removeClass('fluidbox--loading')
						.addClass('fluidbox--opened fluidbox--loaded')
						.find('.fluidbox__wrap')
							.css({ zIndex: fb.settings.stackIndex + fb.settings.stackIndexDelta });

						// Emit custom event
						$fb.trigger('openstart.fluidbox');

						// Set new image background
						$fbGhost.css({ 'background-image': 'url('+img.src+')' });

						// Set new natural dimensions
						fb.instanceData.thumb.natW = img.naturalWidth;
						fb.instanceData.thumb.natH = img.naturalHeight;

						// Compute
						fb.compute();

						// Hide thumbnail
						$fbThumb.css({ opacity: 0 });

						// Show overlay
						$('.fluidbox__overlay').css({ opacity: 1 });

						// Emit custom event when ghost image finishes transition
						$fbGhost.one(customTransitionEnd, function() {
							$fb.trigger('openend.fluidbox');
						});
					};
					img.onerror = function() {
						// Trigger closing
						fb.close();

						// Emit custom event
						$fb.trigger('imageloadfail.fluidbox');
					};
					img.src = $fb.attr('href');
				}
					
			},
			compute: function() {
				var fb			= this,
					$fb			= $(this.element),
					$fbThumb	= $fb.find('img').first(),
					$fbGhost	= $fb.find('.fluidbox__ghost'),
					$fbWrap		= $fb.find('.fluidbox__wrap');

				// Shorthand for dimensions
				var imgNatW = fb.instanceData.thumb.natW,
					imgNatH = fb.instanceData.thumb.natH,
					imgW	= fb.instanceData.thumb.w,
					imgH	= fb.instanceData.thumb.h;

				// Calculate aspect ratios
				var thumbRatio = imgNatW / imgNatH,
					viewportRatio = globalData.viewport.w / globalData.viewport.h;

				// Compare image ratio with viewport ratio
				if (viewportRatio > thumbRatio) {
					var computedHeight	= (imgNatH < globalData.viewport.h) ? imgNatH : globalData.viewport.h*fb.settings.viewportFill,
						imgScaleY		= computedHeight / imgH,
						imgScaleX		= imgNatW * (imgH * imgScaleY / imgNatH) / imgW,
						imgMinScale		= imgScaleY;
				} else {
					var computedWidth	= (imgNatW < globalData.viewport.w) ? imgNatW : globalData.viewport.w*fb.settings.viewportFill,
						imgScaleX		= computedWidth / imgW,
						imgScaleY		= imgNatH * (imgW * imgScaleX / imgNatW) / imgH,
						imgMinScale		= imgScaleX;
				}

				// Scale
				var offsetY = $w.scrollTop() - $fbThumb.offset().top + 0.5*(imgH*(imgMinScale-1)) + 0.5*($w.height() - imgH*imgMinScale),
					offsetX = 0.5*(imgW*(imgMinScale-1)) + 0.5*($w.width() - imgW*imgMinScale) - $fbThumb.offset().left,
					scale = parseInt(imgScaleX*100)/100 + ',' + parseInt(imgScaleY*100)/100;

				// Apply styles to ghost and loader (if present)
				$fbGhost
				.add($fb.find('.fluidbox__loader'))
				.css({
					'transform': 'translate(' + parseInt(offsetX*100)/100 + 'px,' + parseInt(offsetY*100)/100 + 'px) scale(' + scale + ')',
					top: $fbThumb.offset().top - $fbWrap.offset().top,
					left: $fbThumb.offset().left - $fbWrap.offset().left
				});

				// Emit custom event
				$fb.trigger('computeend.fluidbox');
			},
			close: function() {
				// Close Fluidbox
				var fb			= this,
					$fb			= $(this.element),
					$fbThumb	= $fb.find('img').first(),
					$fbGhost	= $fb.find('.fluidbox__ghost'),
					$fbWrap		= $fb.find('.fluidbox__wrap'),
					$fbOverlay	= $fb.find('.fluidbox__overlay');

				// Emit custom event
				$fb.trigger('closestart.fluidbox');

				// Change classes
				$fb
				.removeClass('fluidbox--opened fluidbox--loaded fluidbox--loading')
				.addClass('fluidbox--closed');

				$fbGhost
				.add($fb.find('.fluidbox__loader'))
				.css({
					'transform': 'translate(0,0) scale(1,1)',
					top: $fbThumb.offset().top - $fbWrap.offset().top + parseInt($fbThumb.css('borderTopWidth')) + parseInt($fbThumb.css('paddingTop')),
					left: $fbThumb.offset().left - $fbWrap.offset().left + parseInt($fbThumb.css('borderLeftWidth')) + parseInt($fbThumb.css('paddingLeft'))
				});

				$fbGhost.one(customTransitionEnd, function() {
					$fbGhost.css({ opacity: 0 });
					$fbThumb.css({ opacity: 1 });
					$fbOverlay.remove();
					$fbWrap.css({ zIndex: fb.settings.stackIndex - fb.settings.stackIndexDelta });
				});

				$fbThumb.one(customTransitionEnd, function() {
					$fb.trigger('closeend.fluidbox');
				});

				// Fadeout overlay
				$fbOverlay.css({ opacity: 0 });
			},
			bindEvents: function() {
				var fb = this,
					$fb = $(this.element);

				// Click handler
				$fb.on('click.fluidbox', function(e) {
					e.preventDefault();

					// Check state
					// If state does not exist, or if Fluidbox is closed, we open it
					if(!fb.instanceData.state || fb.instanceData.state === 0) {
						// Update state
						fb.instanceData.state = 1;

						// Open Fluidbox
						fb.open();

					// If state exists, we close it
					} else {
						// Update state
						fb.instanceData.state = 0;

						// Close Fluidbox
						fb.close();
					}
				});
			},
			bindListeners: function() {
				var fb	= this,
					$fb = $(this.element);

				// Window resize
				$w.smartresize(function() {

					// Re-measure viewport dimensions
					_fun.measure.viewport();
					_fun.measure.fbElements.call(fb);

					// Re-compute, but only for the active element
					if($fb.hasClass('fluidbox--opened')) fb.compute();

				}, fb.settings.resizeThrottle);

				// Reposition
				$fb.on('reposition.fluidbox', function() {
					fb.reposition();
				});

				// Destroy
				$fb.on('destroy.fluidbox', function() {
					fb.destroy();
				});
			},
			unbind: function() {
				$(this.element).off('.fluidbox');
			},
			reposition: function() {
				_fun.measure.fbElements.call(this);
			},
			destroy: function() {
				var pluginData = $(this.element).data('plugin_' + pluginName);
				if(pluginData) {
					// Unbind event hanlders
					this.unbind();

					// DOM reversal
					$(this.element)
					.trigger('destroyed.fluidbox')
					.removeClass(function(i,c) {
						return (c.match (/(^|\s)fluidbox-\S+/g) || []).join(' ');
					})
					.empty()
					.html(pluginData.instanceData.originalNode);

					// Destroy plugin data entirely
					$(this.element).data('plugin_' + pluginName, null);
				}
			}
		});

		// A really lightweight plugin wrapper around the constructor,
		// preventing against multiple instantiations
		$.fn[pluginName] = function (options) {

			var args = arguments;

			// Check the options parameter
			// If it is undefined or is an object (plugin configuration),
			// we create a new instance (conditionally, see inside) of the plugin
			if (options === undefined || typeof options === 'object') {

				return $(this).each(function() {
					// Only if the plugin_fluidbox data is not present,
					// to prevent multiple instances being created
					if (!$.data(this, "plugin_" + pluginName)) {
						$.data(this, "plugin_" + pluginName, new Plugin(this, options));
					}
				});

			// If it is defined, but it is a string, does not start with an underscore and does not call init(),
			// we allow users to make calls to public methods
			} else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
				var publicMethods;

				$(this).each(function() {
					// Check if plugin instance already exists, and that the 'options' string is a function name
					var instance = $.data(this, 'plugin_' + pluginName);
					if (instance instanceof Plugin && typeof instance[options] === 'function') {
						publicMethods = instance[options].apply(instance, Array.prototype.slice.call(args,1));
					}
				});

				return publicMethods !== undefined ? publicMethods : $(this);
			}

			// Return to allow chaining
			return this;
		};



})(jQuery, window, document);