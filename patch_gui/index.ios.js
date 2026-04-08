var jsxRuntime = { exports: {} };
var reactJsxRuntime_production = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactJsxRuntime_production;
function requireReactJsxRuntime_production() {
  if (hasRequiredReactJsxRuntime_production) return reactJsxRuntime_production;
  hasRequiredReactJsxRuntime_production = 1;
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  function jsxProd(type, config, maybeKey) {
    var key = null;
    void 0 !== maybeKey && (key = "" + maybeKey);
    void 0 !== config.key && (key = "" + config.key);
    if ("key" in config) {
      maybeKey = {};
      for (var propName in config)
        "key" !== propName && (maybeKey[propName] = config[propName]);
    } else maybeKey = config;
    config = maybeKey.ref;
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref: void 0 !== config ? config : null,
      props: maybeKey
    };
  }
  reactJsxRuntime_production.Fragment = REACT_FRAGMENT_TYPE;
  reactJsxRuntime_production.jsx = jsxProd;
  reactJsxRuntime_production.jsxs = jsxProd;
  return reactJsxRuntime_production;
}
var hasRequiredJsxRuntime;
function requireJsxRuntime() {
  if (hasRequiredJsxRuntime) return jsxRuntime.exports;
  hasRequiredJsxRuntime = 1;
  {
    jsxRuntime.exports = requireReactJsxRuntime_production();
  }
  return jsxRuntime.exports;
}
var jsxRuntimeExports = requireJsxRuntime();
var react = { exports: {} };
var react_production = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReact_production;
function requireReact_production() {
  if (hasRequiredReact_production) return react_production;
  hasRequiredReact_production = 1;
  var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
    maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
    return "function" === typeof maybeIterable ? maybeIterable : null;
  }
  var ReactNoopUpdateQueue = {
    isMounted: function() {
      return false;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, assign = Object.assign, emptyObject = {};
  function Component(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  Component.prototype.isReactComponent = {};
  Component.prototype.setState = function(partialState, callback) {
    if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, partialState, callback, "setState");
  };
  Component.prototype.forceUpdate = function(callback) {
    this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
  };
  function ComponentDummy() {
  }
  ComponentDummy.prototype = Component.prototype;
  function PureComponent(props, context, updater) {
    this.props = props;
    this.context = context;
    this.refs = emptyObject;
    this.updater = updater || ReactNoopUpdateQueue;
  }
  var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
  pureComponentPrototype.constructor = PureComponent;
  assign(pureComponentPrototype, Component.prototype);
  pureComponentPrototype.isPureReactComponent = true;
  var isArrayImpl = Array.isArray;
  function noop() {
  }
  var ReactSharedInternals = { H: null, A: null, T: null, S: null }, hasOwnProperty = Object.prototype.hasOwnProperty;
  function ReactElement(type, key, props) {
    var refProp = props.ref;
    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref: void 0 !== refProp ? refProp : null,
      props
    };
  }
  function cloneAndReplaceKey(oldElement, newKey) {
    return ReactElement(oldElement.type, newKey, oldElement.props);
  }
  function isValidElement(object) {
    return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
  }
  function escape(key) {
    var escaperLookup = { "=": "=0", ":": "=2" };
    return "$" + key.replace(/[=:]/g, function(match) {
      return escaperLookup[match];
    });
  }
  var userProvidedKeyEscapeRegex = /\/+/g;
  function getElementKey(element, index) {
    return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
  }
  function resolveThenable(thenable) {
    switch (thenable.status) {
      case "fulfilled":
        return thenable.value;
      case "rejected":
        throw thenable.reason;
      default:
        switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
          function(fulfilledValue) {
            "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
          },
          function(error) {
            "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
          }
        )), thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
        }
    }
    throw thenable;
  }
  function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
    var type = typeof children;
    if ("undefined" === type || "boolean" === type) children = null;
    var invokeCallback = false;
    if (null === children) invokeCallback = true;
    else
      switch (type) {
        case "bigint":
        case "string":
        case "number":
          invokeCallback = true;
          break;
        case "object":
          switch (children.$$typeof) {
            case REACT_ELEMENT_TYPE:
            case REACT_PORTAL_TYPE:
              invokeCallback = true;
              break;
            case REACT_LAZY_TYPE:
              return invokeCallback = children._init, mapIntoArray(
                invokeCallback(children._payload),
                array,
                escapedPrefix,
                nameSoFar,
                callback
              );
          }
      }
    if (invokeCallback)
      return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
        return c;
      })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
        callback,
        escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
          userProvidedKeyEscapeRegex,
          "$&/"
        ) + "/") + invokeCallback
      )), array.push(callback)), 1;
    invokeCallback = 0;
    var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
    if (isArrayImpl(children))
      for (var i = 0; i < children.length; i++)
        nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
          nameSoFar,
          array,
          escapedPrefix,
          type,
          callback
        );
    else if (i = getIteratorFn(children), "function" === typeof i)
      for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
        nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
          nameSoFar,
          array,
          escapedPrefix,
          type,
          callback
        );
    else if ("object" === type) {
      if ("function" === typeof children.then)
        return mapIntoArray(
          resolveThenable(children),
          array,
          escapedPrefix,
          nameSoFar,
          callback
        );
      array = String(children);
      throw Error(
        "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return invokeCallback;
  }
  function mapChildren(children, func, context) {
    if (null == children) return children;
    var result = [], count = 0;
    mapIntoArray(children, result, "", "", function(child) {
      return func.call(context, child, count++);
    });
    return result;
  }
  function lazyInitializer(payload) {
    if (-1 === payload._status) {
      var ctor = payload._result;
      ctor = ctor();
      ctor.then(
        function(moduleObject) {
          if (0 === payload._status || -1 === payload._status)
            payload._status = 1, payload._result = moduleObject;
        },
        function(error) {
          if (0 === payload._status || -1 === payload._status)
            payload._status = 2, payload._result = error;
        }
      );
      -1 === payload._status && (payload._status = 0, payload._result = ctor);
    }
    if (1 === payload._status) return payload._result.default;
    throw payload._result;
  }
  var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
    if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
      var event = new window.ErrorEvent("error", {
        bubbles: true,
        cancelable: true,
        message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
        error
      });
      if (!window.dispatchEvent(event)) return;
    } else if ("object" === typeof process && "function" === typeof process.emit) {
      process.emit("uncaughtException", error);
      return;
    }
    console.error(error);
  }, Children = {
    map: mapChildren,
    forEach: function(children, forEachFunc, forEachContext) {
      mapChildren(
        children,
        function() {
          forEachFunc.apply(this, arguments);
        },
        forEachContext
      );
    },
    count: function(children) {
      var n = 0;
      mapChildren(children, function() {
        n++;
      });
      return n;
    },
    toArray: function(children) {
      return mapChildren(children, function(child) {
        return child;
      }) || [];
    },
    only: function(children) {
      if (!isValidElement(children))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return children;
    }
  };
  react_production.Activity = REACT_ACTIVITY_TYPE;
  react_production.Children = Children;
  react_production.Component = Component;
  react_production.Fragment = REACT_FRAGMENT_TYPE;
  react_production.Profiler = REACT_PROFILER_TYPE;
  react_production.PureComponent = PureComponent;
  react_production.StrictMode = REACT_STRICT_MODE_TYPE;
  react_production.Suspense = REACT_SUSPENSE_TYPE;
  react_production.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
  react_production.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(size) {
      return ReactSharedInternals.H.useMemoCache(size);
    }
  };
  react_production.cache = function(fn) {
    return function() {
      return fn.apply(null, arguments);
    };
  };
  react_production.cacheSignal = function() {
    return null;
  };
  react_production.cloneElement = function(element, config, children) {
    if (null === element || void 0 === element)
      throw Error(
        "The argument must be a React element, but you passed " + element + "."
      );
    var props = assign({}, element.props), key = element.key;
    if (null != config)
      for (propName in void 0 !== config.key && (key = "" + config.key), config)
        !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
    var propName = arguments.length - 2;
    if (1 === propName) props.children = children;
    else if (1 < propName) {
      for (var childArray = Array(propName), i = 0; i < propName; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    return ReactElement(element.type, key, props);
  };
  react_production.createContext = function(defaultValue) {
    defaultValue = {
      $$typeof: REACT_CONTEXT_TYPE,
      _currentValue: defaultValue,
      _currentValue2: defaultValue,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    };
    defaultValue.Provider = defaultValue;
    defaultValue.Consumer = {
      $$typeof: REACT_CONSUMER_TYPE,
      _context: defaultValue
    };
    return defaultValue;
  };
  react_production.createElement = function(type, config, children) {
    var propName, props = {}, key = null;
    if (null != config)
      for (propName in void 0 !== config.key && (key = "" + config.key), config)
        hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
    var childrenLength = arguments.length - 2;
    if (1 === childrenLength) props.children = children;
    else if (1 < childrenLength) {
      for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
        childArray[i] = arguments[i + 2];
      props.children = childArray;
    }
    if (type && type.defaultProps)
      for (propName in childrenLength = type.defaultProps, childrenLength)
        void 0 === props[propName] && (props[propName] = childrenLength[propName]);
    return ReactElement(type, key, props);
  };
  react_production.createRef = function() {
    return { current: null };
  };
  react_production.forwardRef = function(render) {
    return { $$typeof: REACT_FORWARD_REF_TYPE, render };
  };
  react_production.isValidElement = isValidElement;
  react_production.lazy = function(ctor) {
    return {
      $$typeof: REACT_LAZY_TYPE,
      _payload: { _status: -1, _result: ctor },
      _init: lazyInitializer
    };
  };
  react_production.memo = function(type, compare) {
    return {
      $$typeof: REACT_MEMO_TYPE,
      type,
      compare: void 0 === compare ? null : compare
    };
  };
  react_production.startTransition = function(scope) {
    var prevTransition = ReactSharedInternals.T, currentTransition = {};
    ReactSharedInternals.T = currentTransition;
    try {
      var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
      null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
      "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
    } catch (error) {
      reportGlobalError(error);
    } finally {
      null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
    }
  };
  react_production.unstable_useCacheRefresh = function() {
    return ReactSharedInternals.H.useCacheRefresh();
  };
  react_production.use = function(usable) {
    return ReactSharedInternals.H.use(usable);
  };
  react_production.useActionState = function(action, initialState, permalink) {
    return ReactSharedInternals.H.useActionState(action, initialState, permalink);
  };
  react_production.useCallback = function(callback, deps) {
    return ReactSharedInternals.H.useCallback(callback, deps);
  };
  react_production.useContext = function(Context) {
    return ReactSharedInternals.H.useContext(Context);
  };
  react_production.useDebugValue = function() {
  };
  react_production.useDeferredValue = function(value, initialValue) {
    return ReactSharedInternals.H.useDeferredValue(value, initialValue);
  };
  react_production.useEffect = function(create, deps) {
    return ReactSharedInternals.H.useEffect(create, deps);
  };
  react_production.useEffectEvent = function(callback) {
    return ReactSharedInternals.H.useEffectEvent(callback);
  };
  react_production.useId = function() {
    return ReactSharedInternals.H.useId();
  };
  react_production.useImperativeHandle = function(ref, create, deps) {
    return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
  };
  react_production.useInsertionEffect = function(create, deps) {
    return ReactSharedInternals.H.useInsertionEffect(create, deps);
  };
  react_production.useLayoutEffect = function(create, deps) {
    return ReactSharedInternals.H.useLayoutEffect(create, deps);
  };
  react_production.useMemo = function(create, deps) {
    return ReactSharedInternals.H.useMemo(create, deps);
  };
  react_production.useOptimistic = function(passthrough, reducer) {
    return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
  };
  react_production.useReducer = function(reducer, initialArg, init) {
    return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
  };
  react_production.useRef = function(initialValue) {
    return ReactSharedInternals.H.useRef(initialValue);
  };
  react_production.useState = function(initialState) {
    return ReactSharedInternals.H.useState(initialState);
  };
  react_production.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
    return ReactSharedInternals.H.useSyncExternalStore(
      subscribe,
      getSnapshot,
      getServerSnapshot
    );
  };
  react_production.useTransition = function() {
    return ReactSharedInternals.H.useTransition();
  };
  react_production.version = "19.2.4";
  return react_production;
}
var hasRequiredReact;
function requireReact() {
  if (hasRequiredReact) return react.exports;
  hasRequiredReact = 1;
  {
    react.exports = requireReact_production();
  }
  return react.exports;
}
var reactExports = requireReact();
var client = { exports: {} };
var reactDomClient_production = {};
var scheduler = { exports: {} };
var scheduler_production = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredScheduler_production;
function requireScheduler_production() {
  if (hasRequiredScheduler_production) return scheduler_production;
  hasRequiredScheduler_production = 1;
  (function(exports$1) {
    function push(heap, node) {
      var index = heap.length;
      heap.push(node);
      a: for (; 0 < index; ) {
        var parentIndex = index - 1 >>> 1, parent = heap[parentIndex];
        if (0 < compare(parent, node))
          heap[parentIndex] = node, heap[index] = parent, index = parentIndex;
        else break a;
      }
    }
    function peek(heap) {
      return 0 === heap.length ? null : heap[0];
    }
    function pop(heap) {
      if (0 === heap.length) return null;
      var first = heap[0], last = heap.pop();
      if (last !== first) {
        heap[0] = last;
        a: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
          var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
          if (0 > compare(left, last))
            rightIndex < length && 0 > compare(right, left) ? (heap[index] = right, heap[rightIndex] = last, index = rightIndex) : (heap[index] = left, heap[leftIndex] = last, index = leftIndex);
          else if (rightIndex < length && 0 > compare(right, last))
            heap[index] = right, heap[rightIndex] = last, index = rightIndex;
          else break a;
        }
      }
      return first;
    }
    function compare(a, b) {
      var diff = a.sortIndex - b.sortIndex;
      return 0 !== diff ? diff : a.id - b.id;
    }
    exports$1.unstable_now = void 0;
    if ("object" === typeof performance && "function" === typeof performance.now) {
      var localPerformance = performance;
      exports$1.unstable_now = function() {
        return localPerformance.now();
      };
    } else {
      var localDate = Date, initialTime = localDate.now();
      exports$1.unstable_now = function() {
        return localDate.now() - initialTime;
      };
    }
    var taskQueue = [], timerQueue = [], taskIdCounter = 1, currentTask = null, currentPriorityLevel = 3, isPerformingWork = false, isHostCallbackScheduled = false, isHostTimeoutScheduled = false, needsPaint = false, localSetTimeout = "function" === typeof setTimeout ? setTimeout : null, localClearTimeout = "function" === typeof clearTimeout ? clearTimeout : null, localSetImmediate = "undefined" !== typeof setImmediate ? setImmediate : null;
    function advanceTimers(currentTime) {
      for (var timer = peek(timerQueue); null !== timer; ) {
        if (null === timer.callback) pop(timerQueue);
        else if (timer.startTime <= currentTime)
          pop(timerQueue), timer.sortIndex = timer.expirationTime, push(taskQueue, timer);
        else break;
        timer = peek(timerQueue);
      }
    }
    function handleTimeout(currentTime) {
      isHostTimeoutScheduled = false;
      advanceTimers(currentTime);
      if (!isHostCallbackScheduled)
        if (null !== peek(taskQueue))
          isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline());
        else {
          var firstTimer = peek(timerQueue);
          null !== firstTimer && requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
        }
    }
    var isMessageLoopRunning = false, taskTimeoutID = -1, frameInterval = 5, startTime = -1;
    function shouldYieldToHost() {
      return needsPaint ? true : exports$1.unstable_now() - startTime < frameInterval ? false : true;
    }
    function performWorkUntilDeadline() {
      needsPaint = false;
      if (isMessageLoopRunning) {
        var currentTime = exports$1.unstable_now();
        startTime = currentTime;
        var hasMoreWork = true;
        try {
          a: {
            isHostCallbackScheduled = false;
            isHostTimeoutScheduled && (isHostTimeoutScheduled = false, localClearTimeout(taskTimeoutID), taskTimeoutID = -1);
            isPerformingWork = true;
            var previousPriorityLevel = currentPriorityLevel;
            try {
              b: {
                advanceTimers(currentTime);
                for (currentTask = peek(taskQueue); null !== currentTask && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                  var callback = currentTask.callback;
                  if ("function" === typeof callback) {
                    currentTask.callback = null;
                    currentPriorityLevel = currentTask.priorityLevel;
                    var continuationCallback = callback(
                      currentTask.expirationTime <= currentTime
                    );
                    currentTime = exports$1.unstable_now();
                    if ("function" === typeof continuationCallback) {
                      currentTask.callback = continuationCallback;
                      advanceTimers(currentTime);
                      hasMoreWork = true;
                      break b;
                    }
                    currentTask === peek(taskQueue) && pop(taskQueue);
                    advanceTimers(currentTime);
                  } else pop(taskQueue);
                  currentTask = peek(taskQueue);
                }
                if (null !== currentTask) hasMoreWork = true;
                else {
                  var firstTimer = peek(timerQueue);
                  null !== firstTimer && requestHostTimeout(
                    handleTimeout,
                    firstTimer.startTime - currentTime
                  );
                  hasMoreWork = false;
                }
              }
              break a;
            } finally {
              currentTask = null, currentPriorityLevel = previousPriorityLevel, isPerformingWork = false;
            }
            hasMoreWork = void 0;
          }
        } finally {
          hasMoreWork ? schedulePerformWorkUntilDeadline() : isMessageLoopRunning = false;
        }
      }
    }
    var schedulePerformWorkUntilDeadline;
    if ("function" === typeof localSetImmediate)
      schedulePerformWorkUntilDeadline = function() {
        localSetImmediate(performWorkUntilDeadline);
      };
    else if ("undefined" !== typeof MessageChannel) {
      var channel = new MessageChannel(), port = channel.port2;
      channel.port1.onmessage = performWorkUntilDeadline;
      schedulePerformWorkUntilDeadline = function() {
        port.postMessage(null);
      };
    } else
      schedulePerformWorkUntilDeadline = function() {
        localSetTimeout(performWorkUntilDeadline, 0);
      };
    function requestHostTimeout(callback, ms) {
      taskTimeoutID = localSetTimeout(function() {
        callback(exports$1.unstable_now());
      }, ms);
    }
    exports$1.unstable_IdlePriority = 5;
    exports$1.unstable_ImmediatePriority = 1;
    exports$1.unstable_LowPriority = 4;
    exports$1.unstable_NormalPriority = 3;
    exports$1.unstable_Profiling = null;
    exports$1.unstable_UserBlockingPriority = 2;
    exports$1.unstable_cancelCallback = function(task) {
      task.callback = null;
    };
    exports$1.unstable_forceFrameRate = function(fps) {
      0 > fps || 125 < fps ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5;
    };
    exports$1.unstable_getCurrentPriorityLevel = function() {
      return currentPriorityLevel;
    };
    exports$1.unstable_next = function(eventHandler) {
      switch (currentPriorityLevel) {
        case 1:
        case 2:
        case 3:
          var priorityLevel = 3;
          break;
        default:
          priorityLevel = currentPriorityLevel;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports$1.unstable_requestPaint = function() {
      needsPaint = true;
    };
    exports$1.unstable_runWithPriority = function(priorityLevel, eventHandler) {
      switch (priorityLevel) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          priorityLevel = 3;
      }
      var previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;
      try {
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    };
    exports$1.unstable_scheduleCallback = function(priorityLevel, callback, options) {
      var currentTime = exports$1.unstable_now();
      "object" === typeof options && null !== options ? (options = options.delay, options = "number" === typeof options && 0 < options ? currentTime + options : currentTime) : options = currentTime;
      switch (priorityLevel) {
        case 1:
          var timeout = -1;
          break;
        case 2:
          timeout = 250;
          break;
        case 5:
          timeout = 1073741823;
          break;
        case 4:
          timeout = 1e4;
          break;
        default:
          timeout = 5e3;
      }
      timeout = options + timeout;
      priorityLevel = {
        id: taskIdCounter++,
        callback,
        priorityLevel,
        startTime: options,
        expirationTime: timeout,
        sortIndex: -1
      };
      options > currentTime ? (priorityLevel.sortIndex = options, push(timerQueue, priorityLevel), null === peek(taskQueue) && priorityLevel === peek(timerQueue) && (isHostTimeoutScheduled ? (localClearTimeout(taskTimeoutID), taskTimeoutID = -1) : isHostTimeoutScheduled = true, requestHostTimeout(handleTimeout, options - currentTime))) : (priorityLevel.sortIndex = timeout, push(taskQueue, priorityLevel), isHostCallbackScheduled || isPerformingWork || (isHostCallbackScheduled = true, isMessageLoopRunning || (isMessageLoopRunning = true, schedulePerformWorkUntilDeadline())));
      return priorityLevel;
    };
    exports$1.unstable_shouldYield = shouldYieldToHost;
    exports$1.unstable_wrapCallback = function(callback) {
      var parentPriorityLevel = currentPriorityLevel;
      return function() {
        var previousPriorityLevel = currentPriorityLevel;
        currentPriorityLevel = parentPriorityLevel;
        try {
          return callback.apply(this, arguments);
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
    };
  })(scheduler_production);
  return scheduler_production;
}
var hasRequiredScheduler;
function requireScheduler() {
  if (hasRequiredScheduler) return scheduler.exports;
  hasRequiredScheduler = 1;
  {
    scheduler.exports = requireScheduler_production();
  }
  return scheduler.exports;
}
var reactDom = { exports: {} };
var reactDom_production = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactDom_production;
function requireReactDom_production() {
  if (hasRequiredReactDom_production) return reactDom_production;
  hasRequiredReactDom_production = 1;
  var React = requireReact();
  function formatProdErrorMessage(code) {
    var url = "https://react.dev/errors/" + code;
    if (1 < arguments.length) {
      url += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var i = 2; i < arguments.length; i++)
        url += "&args[]=" + encodeURIComponent(arguments[i]);
    }
    return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function noop() {
  }
  var Internals = {
    d: {
      f: noop,
      r: function() {
        throw Error(formatProdErrorMessage(522));
      },
      D: noop,
      C: noop,
      L: noop,
      m: noop,
      X: noop,
      S: noop,
      M: noop
    },
    p: 0,
    findDOMNode: null
  }, REACT_PORTAL_TYPE = Symbol.for("react.portal");
  function createPortal$1(children, containerInfo, implementation) {
    var key = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
    return {
      $$typeof: REACT_PORTAL_TYPE,
      key: null == key ? null : "" + key,
      children,
      containerInfo,
      implementation
    };
  }
  var ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function getCrossOriginStringAs(as, input) {
    if ("font" === as) return "";
    if ("string" === typeof input)
      return "use-credentials" === input ? input : "";
  }
  reactDom_production.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Internals;
  reactDom_production.createPortal = function(children, container) {
    var key = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
    if (!container || 1 !== container.nodeType && 9 !== container.nodeType && 11 !== container.nodeType)
      throw Error(formatProdErrorMessage(299));
    return createPortal$1(children, container, null, key);
  };
  reactDom_production.flushSync = function(fn) {
    var previousTransition = ReactSharedInternals.T, previousUpdatePriority = Internals.p;
    try {
      if (ReactSharedInternals.T = null, Internals.p = 2, fn) return fn();
    } finally {
      ReactSharedInternals.T = previousTransition, Internals.p = previousUpdatePriority, Internals.d.f();
    }
  };
  reactDom_production.preconnect = function(href, options) {
    "string" === typeof href && (options ? (options = options.crossOrigin, options = "string" === typeof options ? "use-credentials" === options ? options : "" : void 0) : options = null, Internals.d.C(href, options));
  };
  reactDom_production.prefetchDNS = function(href) {
    "string" === typeof href && Internals.d.D(href);
  };
  reactDom_production.preinit = function(href, options) {
    if ("string" === typeof href && options && "string" === typeof options.as) {
      var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin), integrity = "string" === typeof options.integrity ? options.integrity : void 0, fetchPriority = "string" === typeof options.fetchPriority ? options.fetchPriority : void 0;
      "style" === as ? Internals.d.S(
        href,
        "string" === typeof options.precedence ? options.precedence : void 0,
        {
          crossOrigin,
          integrity,
          fetchPriority
        }
      ) : "script" === as && Internals.d.X(href, {
        crossOrigin,
        integrity,
        fetchPriority,
        nonce: "string" === typeof options.nonce ? options.nonce : void 0
      });
    }
  };
  reactDom_production.preinitModule = function(href, options) {
    if ("string" === typeof href)
      if ("object" === typeof options && null !== options) {
        if (null == options.as || "script" === options.as) {
          var crossOrigin = getCrossOriginStringAs(
            options.as,
            options.crossOrigin
          );
          Internals.d.M(href, {
            crossOrigin,
            integrity: "string" === typeof options.integrity ? options.integrity : void 0,
            nonce: "string" === typeof options.nonce ? options.nonce : void 0
          });
        }
      } else null == options && Internals.d.M(href);
  };
  reactDom_production.preload = function(href, options) {
    if ("string" === typeof href && "object" === typeof options && null !== options && "string" === typeof options.as) {
      var as = options.as, crossOrigin = getCrossOriginStringAs(as, options.crossOrigin);
      Internals.d.L(href, as, {
        crossOrigin,
        integrity: "string" === typeof options.integrity ? options.integrity : void 0,
        nonce: "string" === typeof options.nonce ? options.nonce : void 0,
        type: "string" === typeof options.type ? options.type : void 0,
        fetchPriority: "string" === typeof options.fetchPriority ? options.fetchPriority : void 0,
        referrerPolicy: "string" === typeof options.referrerPolicy ? options.referrerPolicy : void 0,
        imageSrcSet: "string" === typeof options.imageSrcSet ? options.imageSrcSet : void 0,
        imageSizes: "string" === typeof options.imageSizes ? options.imageSizes : void 0,
        media: "string" === typeof options.media ? options.media : void 0
      });
    }
  };
  reactDom_production.preloadModule = function(href, options) {
    if ("string" === typeof href)
      if (options) {
        var crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
        Internals.d.m(href, {
          as: "string" === typeof options.as && "script" !== options.as ? options.as : void 0,
          crossOrigin,
          integrity: "string" === typeof options.integrity ? options.integrity : void 0
        });
      } else Internals.d.m(href);
  };
  reactDom_production.requestFormReset = function(form) {
    Internals.d.r(form);
  };
  reactDom_production.unstable_batchedUpdates = function(fn, a) {
    return fn(a);
  };
  reactDom_production.useFormState = function(action, initialState, permalink) {
    return ReactSharedInternals.H.useFormState(action, initialState, permalink);
  };
  reactDom_production.useFormStatus = function() {
    return ReactSharedInternals.H.useHostTransitionStatus();
  };
  reactDom_production.version = "19.2.4";
  return reactDom_production;
}
var hasRequiredReactDom;
function requireReactDom() {
  if (hasRequiredReactDom) return reactDom.exports;
  hasRequiredReactDom = 1;
  function checkDCE() {
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
      return;
    }
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
    } catch (err) {
      console.error(err);
    }
  }
  {
    checkDCE();
    reactDom.exports = requireReactDom_production();
  }
  return reactDom.exports;
}
/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hasRequiredReactDomClient_production;
function requireReactDomClient_production() {
  if (hasRequiredReactDomClient_production) return reactDomClient_production;
  hasRequiredReactDomClient_production = 1;
  var Scheduler = requireScheduler(), React = requireReact(), ReactDOM = requireReactDom();
  function formatProdErrorMessage(code) {
    var url = "https://react.dev/errors/" + code;
    if (1 < arguments.length) {
      url += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var i = 2; i < arguments.length; i++)
        url += "&args[]=" + encodeURIComponent(arguments[i]);
    }
    return "Minified React error #" + code + "; visit " + url + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function isValidContainer(node) {
    return !(!node || 1 !== node.nodeType && 9 !== node.nodeType && 11 !== node.nodeType);
  }
  function getNearestMountedFiber(fiber) {
    var node = fiber, nearestMounted = fiber;
    if (fiber.alternate) for (; node.return; ) node = node.return;
    else {
      fiber = node;
      do
        node = fiber, 0 !== (node.flags & 4098) && (nearestMounted = node.return), fiber = node.return;
      while (fiber);
    }
    return 3 === node.tag ? nearestMounted : null;
  }
  function getSuspenseInstanceFromFiber(fiber) {
    if (13 === fiber.tag) {
      var suspenseState = fiber.memoizedState;
      null === suspenseState && (fiber = fiber.alternate, null !== fiber && (suspenseState = fiber.memoizedState));
      if (null !== suspenseState) return suspenseState.dehydrated;
    }
    return null;
  }
  function getActivityInstanceFromFiber(fiber) {
    if (31 === fiber.tag) {
      var activityState = fiber.memoizedState;
      null === activityState && (fiber = fiber.alternate, null !== fiber && (activityState = fiber.memoizedState));
      if (null !== activityState) return activityState.dehydrated;
    }
    return null;
  }
  function assertIsMounted(fiber) {
    if (getNearestMountedFiber(fiber) !== fiber)
      throw Error(formatProdErrorMessage(188));
  }
  function findCurrentFiberUsingSlowPath(fiber) {
    var alternate = fiber.alternate;
    if (!alternate) {
      alternate = getNearestMountedFiber(fiber);
      if (null === alternate) throw Error(formatProdErrorMessage(188));
      return alternate !== fiber ? null : fiber;
    }
    for (var a = fiber, b = alternate; ; ) {
      var parentA = a.return;
      if (null === parentA) break;
      var parentB = parentA.alternate;
      if (null === parentB) {
        b = parentA.return;
        if (null !== b) {
          a = b;
          continue;
        }
        break;
      }
      if (parentA.child === parentB.child) {
        for (parentB = parentA.child; parentB; ) {
          if (parentB === a) return assertIsMounted(parentA), fiber;
          if (parentB === b) return assertIsMounted(parentA), alternate;
          parentB = parentB.sibling;
        }
        throw Error(formatProdErrorMessage(188));
      }
      if (a.return !== b.return) a = parentA, b = parentB;
      else {
        for (var didFindChild = false, child$0 = parentA.child; child$0; ) {
          if (child$0 === a) {
            didFindChild = true;
            a = parentA;
            b = parentB;
            break;
          }
          if (child$0 === b) {
            didFindChild = true;
            b = parentA;
            a = parentB;
            break;
          }
          child$0 = child$0.sibling;
        }
        if (!didFindChild) {
          for (child$0 = parentB.child; child$0; ) {
            if (child$0 === a) {
              didFindChild = true;
              a = parentB;
              b = parentA;
              break;
            }
            if (child$0 === b) {
              didFindChild = true;
              b = parentB;
              a = parentA;
              break;
            }
            child$0 = child$0.sibling;
          }
          if (!didFindChild) throw Error(formatProdErrorMessage(189));
        }
      }
      if (a.alternate !== b) throw Error(formatProdErrorMessage(190));
    }
    if (3 !== a.tag) throw Error(formatProdErrorMessage(188));
    return a.stateNode.current === a ? fiber : alternate;
  }
  function findCurrentHostFiberImpl(node) {
    var tag = node.tag;
    if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return node;
    for (node = node.child; null !== node; ) {
      tag = findCurrentHostFiberImpl(node);
      if (null !== tag) return tag;
      node = node.sibling;
    }
    return null;
  }
  var assign = Object.assign, REACT_LEGACY_ELEMENT_TYPE = Symbol.for("react.element"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy");
  var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
  var REACT_MEMO_CACHE_SENTINEL = Symbol.for("react.memo_cache_sentinel");
  var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
  function getIteratorFn(maybeIterable) {
    if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
    maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
    return "function" === typeof maybeIterable ? maybeIterable : null;
  }
  var REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
  function getComponentNameFromType(type) {
    if (null == type) return null;
    if ("function" === typeof type)
      return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
    if ("string" === typeof type) return type;
    switch (type) {
      case REACT_FRAGMENT_TYPE:
        return "Fragment";
      case REACT_PROFILER_TYPE:
        return "Profiler";
      case REACT_STRICT_MODE_TYPE:
        return "StrictMode";
      case REACT_SUSPENSE_TYPE:
        return "Suspense";
      case REACT_SUSPENSE_LIST_TYPE:
        return "SuspenseList";
      case REACT_ACTIVITY_TYPE:
        return "Activity";
    }
    if ("object" === typeof type)
      switch (type.$$typeof) {
        case REACT_PORTAL_TYPE:
          return "Portal";
        case REACT_CONTEXT_TYPE:
          return type.displayName || "Context";
        case REACT_CONSUMER_TYPE:
          return (type._context.displayName || "Context") + ".Consumer";
        case REACT_FORWARD_REF_TYPE:
          var innerType = type.render;
          type = type.displayName;
          type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
          return type;
        case REACT_MEMO_TYPE:
          return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
        case REACT_LAZY_TYPE:
          innerType = type._payload;
          type = type._init;
          try {
            return getComponentNameFromType(type(innerType));
          } catch (x) {
          }
      }
    return null;
  }
  var isArrayImpl = Array.isArray, ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, ReactDOMSharedInternals = ReactDOM.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, sharedNotPendingObject = {
    pending: false,
    data: null,
    method: null,
    action: null
  }, valueStack = [], index = -1;
  function createCursor(defaultValue) {
    return { current: defaultValue };
  }
  function pop(cursor) {
    0 > index || (cursor.current = valueStack[index], valueStack[index] = null, index--);
  }
  function push(cursor, value) {
    index++;
    valueStack[index] = cursor.current;
    cursor.current = value;
  }
  var contextStackCursor = createCursor(null), contextFiberStackCursor = createCursor(null), rootInstanceStackCursor = createCursor(null), hostTransitionProviderCursor = createCursor(null);
  function pushHostContainer(fiber, nextRootInstance) {
    push(rootInstanceStackCursor, nextRootInstance);
    push(contextFiberStackCursor, fiber);
    push(contextStackCursor, null);
    switch (nextRootInstance.nodeType) {
      case 9:
      case 11:
        fiber = (fiber = nextRootInstance.documentElement) ? (fiber = fiber.namespaceURI) ? getOwnHostContext(fiber) : 0 : 0;
        break;
      default:
        if (fiber = nextRootInstance.tagName, nextRootInstance = nextRootInstance.namespaceURI)
          nextRootInstance = getOwnHostContext(nextRootInstance), fiber = getChildHostContextProd(nextRootInstance, fiber);
        else
          switch (fiber) {
            case "svg":
              fiber = 1;
              break;
            case "math":
              fiber = 2;
              break;
            default:
              fiber = 0;
          }
    }
    pop(contextStackCursor);
    push(contextStackCursor, fiber);
  }
  function popHostContainer() {
    pop(contextStackCursor);
    pop(contextFiberStackCursor);
    pop(rootInstanceStackCursor);
  }
  function pushHostContext(fiber) {
    null !== fiber.memoizedState && push(hostTransitionProviderCursor, fiber);
    var context = contextStackCursor.current;
    var JSCompiler_inline_result = getChildHostContextProd(context, fiber.type);
    context !== JSCompiler_inline_result && (push(contextFiberStackCursor, fiber), push(contextStackCursor, JSCompiler_inline_result));
  }
  function popHostContext(fiber) {
    contextFiberStackCursor.current === fiber && (pop(contextStackCursor), pop(contextFiberStackCursor));
    hostTransitionProviderCursor.current === fiber && (pop(hostTransitionProviderCursor), HostTransitionContext._currentValue = sharedNotPendingObject);
  }
  var prefix, suffix;
  function describeBuiltInComponentFrame(name) {
    if (void 0 === prefix)
      try {
        throw Error();
      } catch (x) {
        var match = x.stack.trim().match(/\n( *(at )?)/);
        prefix = match && match[1] || "";
        suffix = -1 < x.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < x.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return "\n" + prefix + name + suffix;
  }
  var reentry = false;
  function describeNativeComponentFrame(fn, construct) {
    if (!fn || reentry) return "";
    reentry = true;
    var previousPrepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var RunInRootFrame = {
        DetermineComponentFrameRoot: function() {
          try {
            if (construct) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if ("object" === typeof Reflect && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  var control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x$1) {
                  control = x$1;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x$2) {
                control = x$2;
              }
              (Fake = fn()) && "function" === typeof Fake.catch && Fake.catch(function() {
              });
            }
          } catch (sample) {
            if (sample && control && "string" === typeof sample.stack)
              return [sample.stack, control.stack];
          }
          return [null, null];
        }
      };
      RunInRootFrame.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var namePropDescriptor = Object.getOwnPropertyDescriptor(
        RunInRootFrame.DetermineComponentFrameRoot,
        "name"
      );
      namePropDescriptor && namePropDescriptor.configurable && Object.defineProperty(
        RunInRootFrame.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var _RunInRootFrame$Deter = RunInRootFrame.DetermineComponentFrameRoot(), sampleStack = _RunInRootFrame$Deter[0], controlStack = _RunInRootFrame$Deter[1];
      if (sampleStack && controlStack) {
        var sampleLines = sampleStack.split("\n"), controlLines = controlStack.split("\n");
        for (namePropDescriptor = RunInRootFrame = 0; RunInRootFrame < sampleLines.length && !sampleLines[RunInRootFrame].includes("DetermineComponentFrameRoot"); )
          RunInRootFrame++;
        for (; namePropDescriptor < controlLines.length && !controlLines[namePropDescriptor].includes(
          "DetermineComponentFrameRoot"
        ); )
          namePropDescriptor++;
        if (RunInRootFrame === sampleLines.length || namePropDescriptor === controlLines.length)
          for (RunInRootFrame = sampleLines.length - 1, namePropDescriptor = controlLines.length - 1; 1 <= RunInRootFrame && 0 <= namePropDescriptor && sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]; )
            namePropDescriptor--;
        for (; 1 <= RunInRootFrame && 0 <= namePropDescriptor; RunInRootFrame--, namePropDescriptor--)
          if (sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
            if (1 !== RunInRootFrame || 1 !== namePropDescriptor) {
              do
                if (RunInRootFrame--, namePropDescriptor--, 0 > namePropDescriptor || sampleLines[RunInRootFrame] !== controlLines[namePropDescriptor]) {
                  var frame = "\n" + sampleLines[RunInRootFrame].replace(" at new ", " at ");
                  fn.displayName && frame.includes("<anonymous>") && (frame = frame.replace("<anonymous>", fn.displayName));
                  return frame;
                }
              while (1 <= RunInRootFrame && 0 <= namePropDescriptor);
            }
            break;
          }
      }
    } finally {
      reentry = false, Error.prepareStackTrace = previousPrepareStackTrace;
    }
    return (previousPrepareStackTrace = fn ? fn.displayName || fn.name : "") ? describeBuiltInComponentFrame(previousPrepareStackTrace) : "";
  }
  function describeFiber(fiber, childFiber) {
    switch (fiber.tag) {
      case 26:
      case 27:
      case 5:
        return describeBuiltInComponentFrame(fiber.type);
      case 16:
        return describeBuiltInComponentFrame("Lazy");
      case 13:
        return fiber.child !== childFiber && null !== childFiber ? describeBuiltInComponentFrame("Suspense Fallback") : describeBuiltInComponentFrame("Suspense");
      case 19:
        return describeBuiltInComponentFrame("SuspenseList");
      case 0:
      case 15:
        return describeNativeComponentFrame(fiber.type, false);
      case 11:
        return describeNativeComponentFrame(fiber.type.render, false);
      case 1:
        return describeNativeComponentFrame(fiber.type, true);
      case 31:
        return describeBuiltInComponentFrame("Activity");
      default:
        return "";
    }
  }
  function getStackByFiberInDevAndProd(workInProgress2) {
    try {
      var info = "", previous = null;
      do
        info += describeFiber(workInProgress2, previous), previous = workInProgress2, workInProgress2 = workInProgress2.return;
      while (workInProgress2);
      return info;
    } catch (x) {
      return "\nError generating stack: " + x.message + "\n" + x.stack;
    }
  }
  var hasOwnProperty = Object.prototype.hasOwnProperty, scheduleCallback$3 = Scheduler.unstable_scheduleCallback, cancelCallback$1 = Scheduler.unstable_cancelCallback, shouldYield = Scheduler.unstable_shouldYield, requestPaint = Scheduler.unstable_requestPaint, now = Scheduler.unstable_now, getCurrentPriorityLevel = Scheduler.unstable_getCurrentPriorityLevel, ImmediatePriority = Scheduler.unstable_ImmediatePriority, UserBlockingPriority = Scheduler.unstable_UserBlockingPriority, NormalPriority$1 = Scheduler.unstable_NormalPriority, LowPriority = Scheduler.unstable_LowPriority, IdlePriority = Scheduler.unstable_IdlePriority, log$1 = Scheduler.log, unstable_setDisableYieldValue = Scheduler.unstable_setDisableYieldValue, rendererID = null, injectedHook = null;
  function setIsStrictModeForDevtools(newIsStrictMode) {
    "function" === typeof log$1 && unstable_setDisableYieldValue(newIsStrictMode);
    if (injectedHook && "function" === typeof injectedHook.setStrictMode)
      try {
        injectedHook.setStrictMode(rendererID, newIsStrictMode);
      } catch (err) {
      }
  }
  var clz32 = Math.clz32 ? Math.clz32 : clz32Fallback, log = Math.log, LN2 = Math.LN2;
  function clz32Fallback(x) {
    x >>>= 0;
    return 0 === x ? 32 : 31 - (log(x) / LN2 | 0) | 0;
  }
  var nextTransitionUpdateLane = 256, nextTransitionDeferredLane = 262144, nextRetryLane = 4194304;
  function getHighestPriorityLanes(lanes) {
    var pendingSyncLanes = lanes & 42;
    if (0 !== pendingSyncLanes) return pendingSyncLanes;
    switch (lanes & -lanes) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return lanes & 261888;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return lanes & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return lanes & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return lanes;
    }
  }
  function getNextLanes(root2, wipLanes, rootHasPendingCommit) {
    var pendingLanes = root2.pendingLanes;
    if (0 === pendingLanes) return 0;
    var nextLanes = 0, suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes;
    root2 = root2.warmLanes;
    var nonIdlePendingLanes = pendingLanes & 134217727;
    0 !== nonIdlePendingLanes ? (pendingLanes = nonIdlePendingLanes & ~suspendedLanes, 0 !== pendingLanes ? nextLanes = getHighestPriorityLanes(pendingLanes) : (pingedLanes &= nonIdlePendingLanes, 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = nonIdlePendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))))) : (nonIdlePendingLanes = pendingLanes & ~suspendedLanes, 0 !== nonIdlePendingLanes ? nextLanes = getHighestPriorityLanes(nonIdlePendingLanes) : 0 !== pingedLanes ? nextLanes = getHighestPriorityLanes(pingedLanes) : rootHasPendingCommit || (rootHasPendingCommit = pendingLanes & ~root2, 0 !== rootHasPendingCommit && (nextLanes = getHighestPriorityLanes(rootHasPendingCommit))));
    return 0 === nextLanes ? 0 : 0 !== wipLanes && wipLanes !== nextLanes && 0 === (wipLanes & suspendedLanes) && (suspendedLanes = nextLanes & -nextLanes, rootHasPendingCommit = wipLanes & -wipLanes, suspendedLanes >= rootHasPendingCommit || 32 === suspendedLanes && 0 !== (rootHasPendingCommit & 4194048)) ? wipLanes : nextLanes;
  }
  function checkIfRootIsPrerendering(root2, renderLanes2) {
    return 0 === (root2.pendingLanes & ~(root2.suspendedLanes & ~root2.pingedLanes) & renderLanes2);
  }
  function computeExpirationTime(lane, currentTime) {
    switch (lane) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return currentTime + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return currentTime + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function claimNextRetryLane() {
    var lane = nextRetryLane;
    nextRetryLane <<= 1;
    0 === (nextRetryLane & 62914560) && (nextRetryLane = 4194304);
    return lane;
  }
  function createLaneMap(initial) {
    for (var laneMap = [], i = 0; 31 > i; i++) laneMap.push(initial);
    return laneMap;
  }
  function markRootUpdated$1(root2, updateLane) {
    root2.pendingLanes |= updateLane;
    268435456 !== updateLane && (root2.suspendedLanes = 0, root2.pingedLanes = 0, root2.warmLanes = 0);
  }
  function markRootFinished(root2, finishedLanes, remainingLanes, spawnedLane, updatedLanes, suspendedRetryLanes) {
    var previouslyPendingLanes = root2.pendingLanes;
    root2.pendingLanes = remainingLanes;
    root2.suspendedLanes = 0;
    root2.pingedLanes = 0;
    root2.warmLanes = 0;
    root2.expiredLanes &= remainingLanes;
    root2.entangledLanes &= remainingLanes;
    root2.errorRecoveryDisabledLanes &= remainingLanes;
    root2.shellSuspendCounter = 0;
    var entanglements = root2.entanglements, expirationTimes = root2.expirationTimes, hiddenUpdates = root2.hiddenUpdates;
    for (remainingLanes = previouslyPendingLanes & ~remainingLanes; 0 < remainingLanes; ) {
      var index$7 = 31 - clz32(remainingLanes), lane = 1 << index$7;
      entanglements[index$7] = 0;
      expirationTimes[index$7] = -1;
      var hiddenUpdatesForLane = hiddenUpdates[index$7];
      if (null !== hiddenUpdatesForLane)
        for (hiddenUpdates[index$7] = null, index$7 = 0; index$7 < hiddenUpdatesForLane.length; index$7++) {
          var update = hiddenUpdatesForLane[index$7];
          null !== update && (update.lane &= -536870913);
        }
      remainingLanes &= ~lane;
    }
    0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, 0);
    0 !== suspendedRetryLanes && 0 === updatedLanes && 0 !== root2.tag && (root2.suspendedLanes |= suspendedRetryLanes & ~(previouslyPendingLanes & ~finishedLanes));
  }
  function markSpawnedDeferredLane(root2, spawnedLane, entangledLanes) {
    root2.pendingLanes |= spawnedLane;
    root2.suspendedLanes &= ~spawnedLane;
    var spawnedLaneIndex = 31 - clz32(spawnedLane);
    root2.entangledLanes |= spawnedLane;
    root2.entanglements[spawnedLaneIndex] = root2.entanglements[spawnedLaneIndex] | 1073741824 | entangledLanes & 261930;
  }
  function markRootEntangled(root2, entangledLanes) {
    var rootEntangledLanes = root2.entangledLanes |= entangledLanes;
    for (root2 = root2.entanglements; rootEntangledLanes; ) {
      var index$8 = 31 - clz32(rootEntangledLanes), lane = 1 << index$8;
      lane & entangledLanes | root2[index$8] & entangledLanes && (root2[index$8] |= entangledLanes);
      rootEntangledLanes &= ~lane;
    }
  }
  function getBumpedLaneForHydration(root2, renderLanes2) {
    var renderLane = renderLanes2 & -renderLanes2;
    renderLane = 0 !== (renderLane & 42) ? 1 : getBumpedLaneForHydrationByLane(renderLane);
    return 0 !== (renderLane & (root2.suspendedLanes | renderLanes2)) ? 0 : renderLane;
  }
  function getBumpedLaneForHydrationByLane(lane) {
    switch (lane) {
      case 2:
        lane = 1;
        break;
      case 8:
        lane = 4;
        break;
      case 32:
        lane = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        lane = 128;
        break;
      case 268435456:
        lane = 134217728;
        break;
      default:
        lane = 0;
    }
    return lane;
  }
  function lanesToEventPriority(lanes) {
    lanes &= -lanes;
    return 2 < lanes ? 8 < lanes ? 0 !== (lanes & 134217727) ? 32 : 268435456 : 8 : 2;
  }
  function resolveUpdatePriority() {
    var updatePriority = ReactDOMSharedInternals.p;
    if (0 !== updatePriority) return updatePriority;
    updatePriority = window.event;
    return void 0 === updatePriority ? 32 : getEventPriority(updatePriority.type);
  }
  function runWithPriority(priority, fn) {
    var previousPriority = ReactDOMSharedInternals.p;
    try {
      return ReactDOMSharedInternals.p = priority, fn();
    } finally {
      ReactDOMSharedInternals.p = previousPriority;
    }
  }
  var randomKey = Math.random().toString(36).slice(2), internalInstanceKey = "__reactFiber$" + randomKey, internalPropsKey = "__reactProps$" + randomKey, internalContainerInstanceKey = "__reactContainer$" + randomKey, internalEventHandlersKey = "__reactEvents$" + randomKey, internalEventHandlerListenersKey = "__reactListeners$" + randomKey, internalEventHandlesSetKey = "__reactHandles$" + randomKey, internalRootNodeResourcesKey = "__reactResources$" + randomKey, internalHoistableMarker = "__reactMarker$" + randomKey;
  function detachDeletedInstance(node) {
    delete node[internalInstanceKey];
    delete node[internalPropsKey];
    delete node[internalEventHandlersKey];
    delete node[internalEventHandlerListenersKey];
    delete node[internalEventHandlesSetKey];
  }
  function getClosestInstanceFromNode(targetNode) {
    var targetInst = targetNode[internalInstanceKey];
    if (targetInst) return targetInst;
    for (var parentNode = targetNode.parentNode; parentNode; ) {
      if (targetInst = parentNode[internalContainerInstanceKey] || parentNode[internalInstanceKey]) {
        parentNode = targetInst.alternate;
        if (null !== targetInst.child || null !== parentNode && null !== parentNode.child)
          for (targetNode = getParentHydrationBoundary(targetNode); null !== targetNode; ) {
            if (parentNode = targetNode[internalInstanceKey]) return parentNode;
            targetNode = getParentHydrationBoundary(targetNode);
          }
        return targetInst;
      }
      targetNode = parentNode;
      parentNode = targetNode.parentNode;
    }
    return null;
  }
  function getInstanceFromNode(node) {
    if (node = node[internalInstanceKey] || node[internalContainerInstanceKey]) {
      var tag = node.tag;
      if (5 === tag || 6 === tag || 13 === tag || 31 === tag || 26 === tag || 27 === tag || 3 === tag)
        return node;
    }
    return null;
  }
  function getNodeFromInstance(inst) {
    var tag = inst.tag;
    if (5 === tag || 26 === tag || 27 === tag || 6 === tag) return inst.stateNode;
    throw Error(formatProdErrorMessage(33));
  }
  function getResourcesFromRoot(root2) {
    var resources = root2[internalRootNodeResourcesKey];
    resources || (resources = root2[internalRootNodeResourcesKey] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() });
    return resources;
  }
  function markNodeAsHoistable(node) {
    node[internalHoistableMarker] = true;
  }
  var allNativeEvents = /* @__PURE__ */ new Set(), registrationNameDependencies = {};
  function registerTwoPhaseEvent(registrationName, dependencies) {
    registerDirectEvent(registrationName, dependencies);
    registerDirectEvent(registrationName + "Capture", dependencies);
  }
  function registerDirectEvent(registrationName, dependencies) {
    registrationNameDependencies[registrationName] = dependencies;
    for (registrationName = 0; registrationName < dependencies.length; registrationName++)
      allNativeEvents.add(dependencies[registrationName]);
  }
  var VALID_ATTRIBUTE_NAME_REGEX = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), illegalAttributeNameCache = {}, validatedAttributeNameCache = {};
  function isAttributeNameSafe(attributeName) {
    if (hasOwnProperty.call(validatedAttributeNameCache, attributeName))
      return true;
    if (hasOwnProperty.call(illegalAttributeNameCache, attributeName)) return false;
    if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName))
      return validatedAttributeNameCache[attributeName] = true;
    illegalAttributeNameCache[attributeName] = true;
    return false;
  }
  function setValueForAttribute(node, name, value) {
    if (isAttributeNameSafe(name))
      if (null === value) node.removeAttribute(name);
      else {
        switch (typeof value) {
          case "undefined":
          case "function":
          case "symbol":
            node.removeAttribute(name);
            return;
          case "boolean":
            var prefix$10 = name.toLowerCase().slice(0, 5);
            if ("data-" !== prefix$10 && "aria-" !== prefix$10) {
              node.removeAttribute(name);
              return;
            }
        }
        node.setAttribute(name, "" + value);
      }
  }
  function setValueForKnownAttribute(node, name, value) {
    if (null === value) node.removeAttribute(name);
    else {
      switch (typeof value) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          node.removeAttribute(name);
          return;
      }
      node.setAttribute(name, "" + value);
    }
  }
  function setValueForNamespacedAttribute(node, namespace, name, value) {
    if (null === value) node.removeAttribute(name);
    else {
      switch (typeof value) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          node.removeAttribute(name);
          return;
      }
      node.setAttributeNS(namespace, name, "" + value);
    }
  }
  function getToStringValue(value) {
    switch (typeof value) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return value;
      case "object":
        return value;
      default:
        return "";
    }
  }
  function isCheckable(elem) {
    var type = elem.type;
    return (elem = elem.nodeName) && "input" === elem.toLowerCase() && ("checkbox" === type || "radio" === type);
  }
  function trackValueOnNode(node, valueField, currentValue) {
    var descriptor = Object.getOwnPropertyDescriptor(
      node.constructor.prototype,
      valueField
    );
    if (!node.hasOwnProperty(valueField) && "undefined" !== typeof descriptor && "function" === typeof descriptor.get && "function" === typeof descriptor.set) {
      var get = descriptor.get, set = descriptor.set;
      Object.defineProperty(node, valueField, {
        configurable: true,
        get: function() {
          return get.call(this);
        },
        set: function(value) {
          currentValue = "" + value;
          set.call(this, value);
        }
      });
      Object.defineProperty(node, valueField, {
        enumerable: descriptor.enumerable
      });
      return {
        getValue: function() {
          return currentValue;
        },
        setValue: function(value) {
          currentValue = "" + value;
        },
        stopTracking: function() {
          node._valueTracker = null;
          delete node[valueField];
        }
      };
    }
  }
  function track(node) {
    if (!node._valueTracker) {
      var valueField = isCheckable(node) ? "checked" : "value";
      node._valueTracker = trackValueOnNode(
        node,
        valueField,
        "" + node[valueField]
      );
    }
  }
  function updateValueIfChanged(node) {
    if (!node) return false;
    var tracker = node._valueTracker;
    if (!tracker) return true;
    var lastValue = tracker.getValue();
    var value = "";
    node && (value = isCheckable(node) ? node.checked ? "true" : "false" : node.value);
    node = value;
    return node !== lastValue ? (tracker.setValue(node), true) : false;
  }
  function getActiveElement(doc) {
    doc = doc || ("undefined" !== typeof document ? document : void 0);
    if ("undefined" === typeof doc) return null;
    try {
      return doc.activeElement || doc.body;
    } catch (e) {
      return doc.body;
    }
  }
  var escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n"\\]/g;
  function escapeSelectorAttributeValueInsideDoubleQuotes(value) {
    return value.replace(
      escapeSelectorAttributeValueInsideDoubleQuotesRegex,
      function(ch) {
        return "\\" + ch.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function updateInput(element, value, defaultValue, lastDefaultValue, checked, defaultChecked, type, name) {
    element.name = "";
    null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type ? element.type = type : element.removeAttribute("type");
    if (null != value)
      if ("number" === type) {
        if (0 === value && "" === element.value || element.value != value)
          element.value = "" + getToStringValue(value);
      } else
        element.value !== "" + getToStringValue(value) && (element.value = "" + getToStringValue(value));
    else
      "submit" !== type && "reset" !== type || element.removeAttribute("value");
    null != value ? setDefaultValue(element, type, getToStringValue(value)) : null != defaultValue ? setDefaultValue(element, type, getToStringValue(defaultValue)) : null != lastDefaultValue && element.removeAttribute("value");
    null == checked && null != defaultChecked && (element.defaultChecked = !!defaultChecked);
    null != checked && (element.checked = checked && "function" !== typeof checked && "symbol" !== typeof checked);
    null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name ? element.name = "" + getToStringValue(name) : element.removeAttribute("name");
  }
  function initInput(element, value, defaultValue, checked, defaultChecked, type, name, isHydrating2) {
    null != type && "function" !== typeof type && "symbol" !== typeof type && "boolean" !== typeof type && (element.type = type);
    if (null != value || null != defaultValue) {
      if (!("submit" !== type && "reset" !== type || void 0 !== value && null !== value)) {
        track(element);
        return;
      }
      defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
      value = null != value ? "" + getToStringValue(value) : defaultValue;
      isHydrating2 || value === element.value || (element.value = value);
      element.defaultValue = value;
    }
    checked = null != checked ? checked : defaultChecked;
    checked = "function" !== typeof checked && "symbol" !== typeof checked && !!checked;
    element.checked = isHydrating2 ? element.checked : !!checked;
    element.defaultChecked = !!checked;
    null != name && "function" !== typeof name && "symbol" !== typeof name && "boolean" !== typeof name && (element.name = name);
    track(element);
  }
  function setDefaultValue(node, type, value) {
    "number" === type && getActiveElement(node.ownerDocument) === node || node.defaultValue === "" + value || (node.defaultValue = "" + value);
  }
  function updateOptions(node, multiple, propValue, setDefaultSelected) {
    node = node.options;
    if (multiple) {
      multiple = {};
      for (var i = 0; i < propValue.length; i++)
        multiple["$" + propValue[i]] = true;
      for (propValue = 0; propValue < node.length; propValue++)
        i = multiple.hasOwnProperty("$" + node[propValue].value), node[propValue].selected !== i && (node[propValue].selected = i), i && setDefaultSelected && (node[propValue].defaultSelected = true);
    } else {
      propValue = "" + getToStringValue(propValue);
      multiple = null;
      for (i = 0; i < node.length; i++) {
        if (node[i].value === propValue) {
          node[i].selected = true;
          setDefaultSelected && (node[i].defaultSelected = true);
          return;
        }
        null !== multiple || node[i].disabled || (multiple = node[i]);
      }
      null !== multiple && (multiple.selected = true);
    }
  }
  function updateTextarea(element, value, defaultValue) {
    if (null != value && (value = "" + getToStringValue(value), value !== element.value && (element.value = value), null == defaultValue)) {
      element.defaultValue !== value && (element.defaultValue = value);
      return;
    }
    element.defaultValue = null != defaultValue ? "" + getToStringValue(defaultValue) : "";
  }
  function initTextarea(element, value, defaultValue, children) {
    if (null == value) {
      if (null != children) {
        if (null != defaultValue) throw Error(formatProdErrorMessage(92));
        if (isArrayImpl(children)) {
          if (1 < children.length) throw Error(formatProdErrorMessage(93));
          children = children[0];
        }
        defaultValue = children;
      }
      null == defaultValue && (defaultValue = "");
      value = defaultValue;
    }
    defaultValue = getToStringValue(value);
    element.defaultValue = defaultValue;
    children = element.textContent;
    children === defaultValue && "" !== children && null !== children && (element.value = children);
    track(element);
  }
  function setTextContent(node, text) {
    if (text) {
      var firstChild = node.firstChild;
      if (firstChild && firstChild === node.lastChild && 3 === firstChild.nodeType) {
        firstChild.nodeValue = text;
        return;
      }
    }
    node.textContent = text;
  }
  var unitlessNumbers = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function setValueForStyle(style2, styleName, value) {
    var isCustomProperty = 0 === styleName.indexOf("--");
    null == value || "boolean" === typeof value || "" === value ? isCustomProperty ? style2.setProperty(styleName, "") : "float" === styleName ? style2.cssFloat = "" : style2[styleName] = "" : isCustomProperty ? style2.setProperty(styleName, value) : "number" !== typeof value || 0 === value || unitlessNumbers.has(styleName) ? "float" === styleName ? style2.cssFloat = value : style2[styleName] = ("" + value).trim() : style2[styleName] = value + "px";
  }
  function setValueForStyles(node, styles, prevStyles) {
    if (null != styles && "object" !== typeof styles)
      throw Error(formatProdErrorMessage(62));
    node = node.style;
    if (null != prevStyles) {
      for (var styleName in prevStyles)
        !prevStyles.hasOwnProperty(styleName) || null != styles && styles.hasOwnProperty(styleName) || (0 === styleName.indexOf("--") ? node.setProperty(styleName, "") : "float" === styleName ? node.cssFloat = "" : node[styleName] = "");
      for (var styleName$16 in styles)
        styleName = styles[styleName$16], styles.hasOwnProperty(styleName$16) && prevStyles[styleName$16] !== styleName && setValueForStyle(node, styleName$16, styleName);
    } else
      for (var styleName$17 in styles)
        styles.hasOwnProperty(styleName$17) && setValueForStyle(node, styleName$17, styles[styleName$17]);
  }
  function isCustomElement(tagName) {
    if (-1 === tagName.indexOf("-")) return false;
    switch (tagName) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return false;
      default:
        return true;
    }
  }
  var aliases = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), isJavaScriptProtocol = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function sanitizeURL(url) {
    return isJavaScriptProtocol.test("" + url) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : url;
  }
  function noop$1() {
  }
  var currentReplayingEvent = null;
  function getEventTarget(nativeEvent) {
    nativeEvent = nativeEvent.target || nativeEvent.srcElement || window;
    nativeEvent.correspondingUseElement && (nativeEvent = nativeEvent.correspondingUseElement);
    return 3 === nativeEvent.nodeType ? nativeEvent.parentNode : nativeEvent;
  }
  var restoreTarget = null, restoreQueue = null;
  function restoreStateOfTarget(target) {
    var internalInstance = getInstanceFromNode(target);
    if (internalInstance && (target = internalInstance.stateNode)) {
      var props = target[internalPropsKey] || null;
      a: switch (target = internalInstance.stateNode, internalInstance.type) {
        case "input":
          updateInput(
            target,
            props.value,
            props.defaultValue,
            props.defaultValue,
            props.checked,
            props.defaultChecked,
            props.type,
            props.name
          );
          internalInstance = props.name;
          if ("radio" === props.type && null != internalInstance) {
            for (props = target; props.parentNode; ) props = props.parentNode;
            props = props.querySelectorAll(
              'input[name="' + escapeSelectorAttributeValueInsideDoubleQuotes(
                "" + internalInstance
              ) + '"][type="radio"]'
            );
            for (internalInstance = 0; internalInstance < props.length; internalInstance++) {
              var otherNode = props[internalInstance];
              if (otherNode !== target && otherNode.form === target.form) {
                var otherProps = otherNode[internalPropsKey] || null;
                if (!otherProps) throw Error(formatProdErrorMessage(90));
                updateInput(
                  otherNode,
                  otherProps.value,
                  otherProps.defaultValue,
                  otherProps.defaultValue,
                  otherProps.checked,
                  otherProps.defaultChecked,
                  otherProps.type,
                  otherProps.name
                );
              }
            }
            for (internalInstance = 0; internalInstance < props.length; internalInstance++)
              otherNode = props[internalInstance], otherNode.form === target.form && updateValueIfChanged(otherNode);
          }
          break a;
        case "textarea":
          updateTextarea(target, props.value, props.defaultValue);
          break a;
        case "select":
          internalInstance = props.value, null != internalInstance && updateOptions(target, !!props.multiple, internalInstance, false);
      }
    }
  }
  var isInsideEventHandler = false;
  function batchedUpdates$1(fn, a, b) {
    if (isInsideEventHandler) return fn(a, b);
    isInsideEventHandler = true;
    try {
      var JSCompiler_inline_result = fn(a);
      return JSCompiler_inline_result;
    } finally {
      if (isInsideEventHandler = false, null !== restoreTarget || null !== restoreQueue) {
        if (flushSyncWork$1(), restoreTarget && (a = restoreTarget, fn = restoreQueue, restoreQueue = restoreTarget = null, restoreStateOfTarget(a), fn))
          for (a = 0; a < fn.length; a++) restoreStateOfTarget(fn[a]);
      }
    }
  }
  function getListener(inst, registrationName) {
    var stateNode = inst.stateNode;
    if (null === stateNode) return null;
    var props = stateNode[internalPropsKey] || null;
    if (null === props) return null;
    stateNode = props[registrationName];
    a: switch (registrationName) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (props = !props.disabled) || (inst = inst.type, props = !("button" === inst || "input" === inst || "select" === inst || "textarea" === inst));
        inst = !props;
        break a;
      default:
        inst = false;
    }
    if (inst) return null;
    if (stateNode && "function" !== typeof stateNode)
      throw Error(
        formatProdErrorMessage(231, registrationName, typeof stateNode)
      );
    return stateNode;
  }
  var canUseDOM = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement), passiveBrowserEventsSupported = false;
  if (canUseDOM)
    try {
      var options = {};
      Object.defineProperty(options, "passive", {
        get: function() {
          passiveBrowserEventsSupported = true;
        }
      });
      window.addEventListener("test", options, options);
      window.removeEventListener("test", options, options);
    } catch (e) {
      passiveBrowserEventsSupported = false;
    }
  var root = null, startText = null, fallbackText = null;
  function getData() {
    if (fallbackText) return fallbackText;
    var start, startValue = startText, startLength = startValue.length, end, endValue = "value" in root ? root.value : root.textContent, endLength = endValue.length;
    for (start = 0; start < startLength && startValue[start] === endValue[start]; start++) ;
    var minEnd = startLength - start;
    for (end = 1; end <= minEnd && startValue[startLength - end] === endValue[endLength - end]; end++) ;
    return fallbackText = endValue.slice(start, 1 < end ? 1 - end : void 0);
  }
  function getEventCharCode(nativeEvent) {
    var keyCode = nativeEvent.keyCode;
    "charCode" in nativeEvent ? (nativeEvent = nativeEvent.charCode, 0 === nativeEvent && 13 === keyCode && (nativeEvent = 13)) : nativeEvent = keyCode;
    10 === nativeEvent && (nativeEvent = 13);
    return 32 <= nativeEvent || 13 === nativeEvent ? nativeEvent : 0;
  }
  function functionThatReturnsTrue() {
    return true;
  }
  function functionThatReturnsFalse() {
    return false;
  }
  function createSyntheticEvent(Interface) {
    function SyntheticBaseEvent(reactName, reactEventType, targetInst, nativeEvent, nativeEventTarget) {
      this._reactName = reactName;
      this._targetInst = targetInst;
      this.type = reactEventType;
      this.nativeEvent = nativeEvent;
      this.target = nativeEventTarget;
      this.currentTarget = null;
      for (var propName in Interface)
        Interface.hasOwnProperty(propName) && (reactName = Interface[propName], this[propName] = reactName ? reactName(nativeEvent) : nativeEvent[propName]);
      this.isDefaultPrevented = (null != nativeEvent.defaultPrevented ? nativeEvent.defaultPrevented : false === nativeEvent.returnValue) ? functionThatReturnsTrue : functionThatReturnsFalse;
      this.isPropagationStopped = functionThatReturnsFalse;
      return this;
    }
    assign(SyntheticBaseEvent.prototype, {
      preventDefault: function() {
        this.defaultPrevented = true;
        var event = this.nativeEvent;
        event && (event.preventDefault ? event.preventDefault() : "unknown" !== typeof event.returnValue && (event.returnValue = false), this.isDefaultPrevented = functionThatReturnsTrue);
      },
      stopPropagation: function() {
        var event = this.nativeEvent;
        event && (event.stopPropagation ? event.stopPropagation() : "unknown" !== typeof event.cancelBubble && (event.cancelBubble = true), this.isPropagationStopped = functionThatReturnsTrue);
      },
      persist: function() {
      },
      isPersistent: functionThatReturnsTrue
    });
    return SyntheticBaseEvent;
  }
  var EventInterface = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(event) {
      return event.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, SyntheticEvent = createSyntheticEvent(EventInterface), UIEventInterface = assign({}, EventInterface, { view: 0, detail: 0 }), SyntheticUIEvent = createSyntheticEvent(UIEventInterface), lastMovementX, lastMovementY, lastMouseEvent, MouseEventInterface = assign({}, UIEventInterface, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: getEventModifierState,
    button: 0,
    buttons: 0,
    relatedTarget: function(event) {
      return void 0 === event.relatedTarget ? event.fromElement === event.srcElement ? event.toElement : event.fromElement : event.relatedTarget;
    },
    movementX: function(event) {
      if ("movementX" in event) return event.movementX;
      event !== lastMouseEvent && (lastMouseEvent && "mousemove" === event.type ? (lastMovementX = event.screenX - lastMouseEvent.screenX, lastMovementY = event.screenY - lastMouseEvent.screenY) : lastMovementY = lastMovementX = 0, lastMouseEvent = event);
      return lastMovementX;
    },
    movementY: function(event) {
      return "movementY" in event ? event.movementY : lastMovementY;
    }
  }), SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface), DragEventInterface = assign({}, MouseEventInterface, { dataTransfer: 0 }), SyntheticDragEvent = createSyntheticEvent(DragEventInterface), FocusEventInterface = assign({}, UIEventInterface, { relatedTarget: 0 }), SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface), AnimationEventInterface = assign({}, EventInterface, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), SyntheticAnimationEvent = createSyntheticEvent(AnimationEventInterface), ClipboardEventInterface = assign({}, EventInterface, {
    clipboardData: function(event) {
      return "clipboardData" in event ? event.clipboardData : window.clipboardData;
    }
  }), SyntheticClipboardEvent = createSyntheticEvent(ClipboardEventInterface), CompositionEventInterface = assign({}, EventInterface, { data: 0 }), SyntheticCompositionEvent = createSyntheticEvent(CompositionEventInterface), normalizeKey = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, translateToKey = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, modifierKeyToProp = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function modifierStateGetter(keyArg) {
    var nativeEvent = this.nativeEvent;
    return nativeEvent.getModifierState ? nativeEvent.getModifierState(keyArg) : (keyArg = modifierKeyToProp[keyArg]) ? !!nativeEvent[keyArg] : false;
  }
  function getEventModifierState() {
    return modifierStateGetter;
  }
  var KeyboardEventInterface = assign({}, UIEventInterface, {
    key: function(nativeEvent) {
      if (nativeEvent.key) {
        var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
        if ("Unidentified" !== key) return key;
      }
      return "keypress" === nativeEvent.type ? (nativeEvent = getEventCharCode(nativeEvent), 13 === nativeEvent ? "Enter" : String.fromCharCode(nativeEvent)) : "keydown" === nativeEvent.type || "keyup" === nativeEvent.type ? translateToKey[nativeEvent.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: getEventModifierState,
    charCode: function(event) {
      return "keypress" === event.type ? getEventCharCode(event) : 0;
    },
    keyCode: function(event) {
      return "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
    },
    which: function(event) {
      return "keypress" === event.type ? getEventCharCode(event) : "keydown" === event.type || "keyup" === event.type ? event.keyCode : 0;
    }
  }), SyntheticKeyboardEvent = createSyntheticEvent(KeyboardEventInterface), PointerEventInterface = assign({}, MouseEventInterface, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  }), SyntheticPointerEvent = createSyntheticEvent(PointerEventInterface), TouchEventInterface = assign({}, UIEventInterface, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: getEventModifierState
  }), SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface), TransitionEventInterface = assign({}, EventInterface, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), SyntheticTransitionEvent = createSyntheticEvent(TransitionEventInterface), WheelEventInterface = assign({}, MouseEventInterface, {
    deltaX: function(event) {
      return "deltaX" in event ? event.deltaX : "wheelDeltaX" in event ? -event.wheelDeltaX : 0;
    },
    deltaY: function(event) {
      return "deltaY" in event ? event.deltaY : "wheelDeltaY" in event ? -event.wheelDeltaY : "wheelDelta" in event ? -event.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface), ToggleEventInterface = assign({}, EventInterface, {
    newState: 0,
    oldState: 0
  }), SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface), END_KEYCODES = [9, 13, 27, 32], canUseCompositionEvent = canUseDOM && "CompositionEvent" in window, documentMode = null;
  canUseDOM && "documentMode" in document && (documentMode = document.documentMode);
  var canUseTextInputEvent = canUseDOM && "TextEvent" in window && !documentMode, useFallbackCompositionData = canUseDOM && (!canUseCompositionEvent || documentMode && 8 < documentMode && 11 >= documentMode), SPACEBAR_CHAR = String.fromCharCode(32), hasSpaceKeypress = false;
  function isFallbackCompositionEnd(domEventName, nativeEvent) {
    switch (domEventName) {
      case "keyup":
        return -1 !== END_KEYCODES.indexOf(nativeEvent.keyCode);
      case "keydown":
        return 229 !== nativeEvent.keyCode;
      case "keypress":
      case "mousedown":
      case "focusout":
        return true;
      default:
        return false;
    }
  }
  function getDataFromCustomEvent(nativeEvent) {
    nativeEvent = nativeEvent.detail;
    return "object" === typeof nativeEvent && "data" in nativeEvent ? nativeEvent.data : null;
  }
  var isComposing = false;
  function getNativeBeforeInputChars(domEventName, nativeEvent) {
    switch (domEventName) {
      case "compositionend":
        return getDataFromCustomEvent(nativeEvent);
      case "keypress":
        if (32 !== nativeEvent.which) return null;
        hasSpaceKeypress = true;
        return SPACEBAR_CHAR;
      case "textInput":
        return domEventName = nativeEvent.data, domEventName === SPACEBAR_CHAR && hasSpaceKeypress ? null : domEventName;
      default:
        return null;
    }
  }
  function getFallbackBeforeInputChars(domEventName, nativeEvent) {
    if (isComposing)
      return "compositionend" === domEventName || !canUseCompositionEvent && isFallbackCompositionEnd(domEventName, nativeEvent) ? (domEventName = getData(), fallbackText = startText = root = null, isComposing = false, domEventName) : null;
    switch (domEventName) {
      case "paste":
        return null;
      case "keypress":
        if (!(nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) || nativeEvent.ctrlKey && nativeEvent.altKey) {
          if (nativeEvent.char && 1 < nativeEvent.char.length)
            return nativeEvent.char;
          if (nativeEvent.which) return String.fromCharCode(nativeEvent.which);
        }
        return null;
      case "compositionend":
        return useFallbackCompositionData && "ko" !== nativeEvent.locale ? null : nativeEvent.data;
      default:
        return null;
    }
  }
  var supportedInputTypes = {
    color: true,
    date: true,
    datetime: true,
    "datetime-local": true,
    email: true,
    month: true,
    number: true,
    password: true,
    range: true,
    search: true,
    tel: true,
    text: true,
    time: true,
    url: true,
    week: true
  };
  function isTextInputElement(elem) {
    var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
    return "input" === nodeName ? !!supportedInputTypes[elem.type] : "textarea" === nodeName ? true : false;
  }
  function createAndAccumulateChangeEvent(dispatchQueue, inst, nativeEvent, target) {
    restoreTarget ? restoreQueue ? restoreQueue.push(target) : restoreQueue = [target] : restoreTarget = target;
    inst = accumulateTwoPhaseListeners(inst, "onChange");
    0 < inst.length && (nativeEvent = new SyntheticEvent(
      "onChange",
      "change",
      null,
      nativeEvent,
      target
    ), dispatchQueue.push({ event: nativeEvent, listeners: inst }));
  }
  var activeElement$1 = null, activeElementInst$1 = null;
  function runEventInBatch(dispatchQueue) {
    processDispatchQueue(dispatchQueue, 0);
  }
  function getInstIfValueChanged(targetInst) {
    var targetNode = getNodeFromInstance(targetInst);
    if (updateValueIfChanged(targetNode)) return targetInst;
  }
  function getTargetInstForChangeEvent(domEventName, targetInst) {
    if ("change" === domEventName) return targetInst;
  }
  var isInputEventSupported = false;
  if (canUseDOM) {
    var JSCompiler_inline_result$jscomp$286;
    if (canUseDOM) {
      var isSupported$jscomp$inline_427 = "oninput" in document;
      if (!isSupported$jscomp$inline_427) {
        var element$jscomp$inline_428 = document.createElement("div");
        element$jscomp$inline_428.setAttribute("oninput", "return;");
        isSupported$jscomp$inline_427 = "function" === typeof element$jscomp$inline_428.oninput;
      }
      JSCompiler_inline_result$jscomp$286 = isSupported$jscomp$inline_427;
    } else JSCompiler_inline_result$jscomp$286 = false;
    isInputEventSupported = JSCompiler_inline_result$jscomp$286 && (!document.documentMode || 9 < document.documentMode);
  }
  function stopWatchingForValueChange() {
    activeElement$1 && (activeElement$1.detachEvent("onpropertychange", handlePropertyChange), activeElementInst$1 = activeElement$1 = null);
  }
  function handlePropertyChange(nativeEvent) {
    if ("value" === nativeEvent.propertyName && getInstIfValueChanged(activeElementInst$1)) {
      var dispatchQueue = [];
      createAndAccumulateChangeEvent(
        dispatchQueue,
        activeElementInst$1,
        nativeEvent,
        getEventTarget(nativeEvent)
      );
      batchedUpdates$1(runEventInBatch, dispatchQueue);
    }
  }
  function handleEventsForInputEventPolyfill(domEventName, target, targetInst) {
    "focusin" === domEventName ? (stopWatchingForValueChange(), activeElement$1 = target, activeElementInst$1 = targetInst, activeElement$1.attachEvent("onpropertychange", handlePropertyChange)) : "focusout" === domEventName && stopWatchingForValueChange();
  }
  function getTargetInstForInputEventPolyfill(domEventName) {
    if ("selectionchange" === domEventName || "keyup" === domEventName || "keydown" === domEventName)
      return getInstIfValueChanged(activeElementInst$1);
  }
  function getTargetInstForClickEvent(domEventName, targetInst) {
    if ("click" === domEventName) return getInstIfValueChanged(targetInst);
  }
  function getTargetInstForInputOrChangeEvent(domEventName, targetInst) {
    if ("input" === domEventName || "change" === domEventName)
      return getInstIfValueChanged(targetInst);
  }
  function is(x, y) {
    return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
  }
  var objectIs = "function" === typeof Object.is ? Object.is : is;
  function shallowEqual(objA, objB) {
    if (objectIs(objA, objB)) return true;
    if ("object" !== typeof objA || null === objA || "object" !== typeof objB || null === objB)
      return false;
    var keysA = Object.keys(objA), keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (keysB = 0; keysB < keysA.length; keysB++) {
      var currentKey = keysA[keysB];
      if (!hasOwnProperty.call(objB, currentKey) || !objectIs(objA[currentKey], objB[currentKey]))
        return false;
    }
    return true;
  }
  function getLeafNode(node) {
    for (; node && node.firstChild; ) node = node.firstChild;
    return node;
  }
  function getNodeForCharacterOffset(root2, offset) {
    var node = getLeafNode(root2);
    root2 = 0;
    for (var nodeEnd; node; ) {
      if (3 === node.nodeType) {
        nodeEnd = root2 + node.textContent.length;
        if (root2 <= offset && nodeEnd >= offset)
          return { node, offset: offset - root2 };
        root2 = nodeEnd;
      }
      a: {
        for (; node; ) {
          if (node.nextSibling) {
            node = node.nextSibling;
            break a;
          }
          node = node.parentNode;
        }
        node = void 0;
      }
      node = getLeafNode(node);
    }
  }
  function containsNode(outerNode, innerNode) {
    return outerNode && innerNode ? outerNode === innerNode ? true : outerNode && 3 === outerNode.nodeType ? false : innerNode && 3 === innerNode.nodeType ? containsNode(outerNode, innerNode.parentNode) : "contains" in outerNode ? outerNode.contains(innerNode) : outerNode.compareDocumentPosition ? !!(outerNode.compareDocumentPosition(innerNode) & 16) : false : false;
  }
  function getActiveElementDeep(containerInfo) {
    containerInfo = null != containerInfo && null != containerInfo.ownerDocument && null != containerInfo.ownerDocument.defaultView ? containerInfo.ownerDocument.defaultView : window;
    for (var element = getActiveElement(containerInfo.document); element instanceof containerInfo.HTMLIFrameElement; ) {
      try {
        var JSCompiler_inline_result = "string" === typeof element.contentWindow.location.href;
      } catch (err) {
        JSCompiler_inline_result = false;
      }
      if (JSCompiler_inline_result) containerInfo = element.contentWindow;
      else break;
      element = getActiveElement(containerInfo.document);
    }
    return element;
  }
  function hasSelectionCapabilities(elem) {
    var nodeName = elem && elem.nodeName && elem.nodeName.toLowerCase();
    return nodeName && ("input" === nodeName && ("text" === elem.type || "search" === elem.type || "tel" === elem.type || "url" === elem.type || "password" === elem.type) || "textarea" === nodeName || "true" === elem.contentEditable);
  }
  var skipSelectionChangeEvent = canUseDOM && "documentMode" in document && 11 >= document.documentMode, activeElement = null, activeElementInst = null, lastSelection = null, mouseDown = false;
  function constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget) {
    var doc = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget.document : 9 === nativeEventTarget.nodeType ? nativeEventTarget : nativeEventTarget.ownerDocument;
    mouseDown || null == activeElement || activeElement !== getActiveElement(doc) || (doc = activeElement, "selectionStart" in doc && hasSelectionCapabilities(doc) ? doc = { start: doc.selectionStart, end: doc.selectionEnd } : (doc = (doc.ownerDocument && doc.ownerDocument.defaultView || window).getSelection(), doc = {
      anchorNode: doc.anchorNode,
      anchorOffset: doc.anchorOffset,
      focusNode: doc.focusNode,
      focusOffset: doc.focusOffset
    }), lastSelection && shallowEqual(lastSelection, doc) || (lastSelection = doc, doc = accumulateTwoPhaseListeners(activeElementInst, "onSelect"), 0 < doc.length && (nativeEvent = new SyntheticEvent(
      "onSelect",
      "select",
      null,
      nativeEvent,
      nativeEventTarget
    ), dispatchQueue.push({ event: nativeEvent, listeners: doc }), nativeEvent.target = activeElement)));
  }
  function makePrefixMap(styleProp, eventName) {
    var prefixes = {};
    prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
    prefixes["Webkit" + styleProp] = "webkit" + eventName;
    prefixes["Moz" + styleProp] = "moz" + eventName;
    return prefixes;
  }
  var vendorPrefixes = {
    animationend: makePrefixMap("Animation", "AnimationEnd"),
    animationiteration: makePrefixMap("Animation", "AnimationIteration"),
    animationstart: makePrefixMap("Animation", "AnimationStart"),
    transitionrun: makePrefixMap("Transition", "TransitionRun"),
    transitionstart: makePrefixMap("Transition", "TransitionStart"),
    transitioncancel: makePrefixMap("Transition", "TransitionCancel"),
    transitionend: makePrefixMap("Transition", "TransitionEnd")
  }, prefixedEventNames = {}, style = {};
  canUseDOM && (style = document.createElement("div").style, "AnimationEvent" in window || (delete vendorPrefixes.animationend.animation, delete vendorPrefixes.animationiteration.animation, delete vendorPrefixes.animationstart.animation), "TransitionEvent" in window || delete vendorPrefixes.transitionend.transition);
  function getVendorPrefixedEventName(eventName) {
    if (prefixedEventNames[eventName]) return prefixedEventNames[eventName];
    if (!vendorPrefixes[eventName]) return eventName;
    var prefixMap = vendorPrefixes[eventName], styleProp;
    for (styleProp in prefixMap)
      if (prefixMap.hasOwnProperty(styleProp) && styleProp in style)
        return prefixedEventNames[eventName] = prefixMap[styleProp];
    return eventName;
  }
  var ANIMATION_END = getVendorPrefixedEventName("animationend"), ANIMATION_ITERATION = getVendorPrefixedEventName("animationiteration"), ANIMATION_START = getVendorPrefixedEventName("animationstart"), TRANSITION_RUN = getVendorPrefixedEventName("transitionrun"), TRANSITION_START = getVendorPrefixedEventName("transitionstart"), TRANSITION_CANCEL = getVendorPrefixedEventName("transitioncancel"), TRANSITION_END = getVendorPrefixedEventName("transitionend"), topLevelEventsToReactNames = /* @__PURE__ */ new Map(), simpleEventPluginEvents = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  simpleEventPluginEvents.push("scrollEnd");
  function registerSimpleEvent(domEventName, reactName) {
    topLevelEventsToReactNames.set(domEventName, reactName);
    registerTwoPhaseEvent(reactName, [domEventName]);
  }
  var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
    if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
      var event = new window.ErrorEvent("error", {
        bubbles: true,
        cancelable: true,
        message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
        error
      });
      if (!window.dispatchEvent(event)) return;
    } else if ("object" === typeof process && "function" === typeof process.emit) {
      process.emit("uncaughtException", error);
      return;
    }
    console.error(error);
  }, concurrentQueues = [], concurrentQueuesIndex = 0, concurrentlyUpdatedLanes = 0;
  function finishQueueingConcurrentUpdates() {
    for (var endIndex = concurrentQueuesIndex, i = concurrentlyUpdatedLanes = concurrentQueuesIndex = 0; i < endIndex; ) {
      var fiber = concurrentQueues[i];
      concurrentQueues[i++] = null;
      var queue = concurrentQueues[i];
      concurrentQueues[i++] = null;
      var update = concurrentQueues[i];
      concurrentQueues[i++] = null;
      var lane = concurrentQueues[i];
      concurrentQueues[i++] = null;
      if (null !== queue && null !== update) {
        var pending = queue.pending;
        null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
        queue.pending = update;
      }
      0 !== lane && markUpdateLaneFromFiberToRoot(fiber, update, lane);
    }
  }
  function enqueueUpdate$1(fiber, queue, update, lane) {
    concurrentQueues[concurrentQueuesIndex++] = fiber;
    concurrentQueues[concurrentQueuesIndex++] = queue;
    concurrentQueues[concurrentQueuesIndex++] = update;
    concurrentQueues[concurrentQueuesIndex++] = lane;
    concurrentlyUpdatedLanes |= lane;
    fiber.lanes |= lane;
    fiber = fiber.alternate;
    null !== fiber && (fiber.lanes |= lane);
  }
  function enqueueConcurrentHookUpdate(fiber, queue, update, lane) {
    enqueueUpdate$1(fiber, queue, update, lane);
    return getRootForUpdatedFiber(fiber);
  }
  function enqueueConcurrentRenderForLane(fiber, lane) {
    enqueueUpdate$1(fiber, null, null, lane);
    return getRootForUpdatedFiber(fiber);
  }
  function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
    sourceFiber.lanes |= lane;
    var alternate = sourceFiber.alternate;
    null !== alternate && (alternate.lanes |= lane);
    for (var isHidden = false, parent = sourceFiber.return; null !== parent; )
      parent.childLanes |= lane, alternate = parent.alternate, null !== alternate && (alternate.childLanes |= lane), 22 === parent.tag && (sourceFiber = parent.stateNode, null === sourceFiber || sourceFiber._visibility & 1 || (isHidden = true)), sourceFiber = parent, parent = parent.return;
    return 3 === sourceFiber.tag ? (parent = sourceFiber.stateNode, isHidden && null !== update && (isHidden = 31 - clz32(lane), sourceFiber = parent.hiddenUpdates, alternate = sourceFiber[isHidden], null === alternate ? sourceFiber[isHidden] = [update] : alternate.push(update), update.lane = lane | 536870912), parent) : null;
  }
  function getRootForUpdatedFiber(sourceFiber) {
    if (50 < nestedUpdateCount)
      throw nestedUpdateCount = 0, rootWithNestedUpdates = null, Error(formatProdErrorMessage(185));
    for (var parent = sourceFiber.return; null !== parent; )
      sourceFiber = parent, parent = sourceFiber.return;
    return 3 === sourceFiber.tag ? sourceFiber.stateNode : null;
  }
  var emptyContextObject = {};
  function FiberNode(tag, pendingProps, key, mode) {
    this.tag = tag;
    this.key = key;
    this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
    this.index = 0;
    this.refCleanup = this.ref = null;
    this.pendingProps = pendingProps;
    this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
    this.mode = mode;
    this.subtreeFlags = this.flags = 0;
    this.deletions = null;
    this.childLanes = this.lanes = 0;
    this.alternate = null;
  }
  function createFiberImplClass(tag, pendingProps, key, mode) {
    return new FiberNode(tag, pendingProps, key, mode);
  }
  function shouldConstruct(Component) {
    Component = Component.prototype;
    return !(!Component || !Component.isReactComponent);
  }
  function createWorkInProgress(current, pendingProps) {
    var workInProgress2 = current.alternate;
    null === workInProgress2 ? (workInProgress2 = createFiberImplClass(
      current.tag,
      pendingProps,
      current.key,
      current.mode
    ), workInProgress2.elementType = current.elementType, workInProgress2.type = current.type, workInProgress2.stateNode = current.stateNode, workInProgress2.alternate = current, current.alternate = workInProgress2) : (workInProgress2.pendingProps = pendingProps, workInProgress2.type = current.type, workInProgress2.flags = 0, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null);
    workInProgress2.flags = current.flags & 65011712;
    workInProgress2.childLanes = current.childLanes;
    workInProgress2.lanes = current.lanes;
    workInProgress2.child = current.child;
    workInProgress2.memoizedProps = current.memoizedProps;
    workInProgress2.memoizedState = current.memoizedState;
    workInProgress2.updateQueue = current.updateQueue;
    pendingProps = current.dependencies;
    workInProgress2.dependencies = null === pendingProps ? null : { lanes: pendingProps.lanes, firstContext: pendingProps.firstContext };
    workInProgress2.sibling = current.sibling;
    workInProgress2.index = current.index;
    workInProgress2.ref = current.ref;
    workInProgress2.refCleanup = current.refCleanup;
    return workInProgress2;
  }
  function resetWorkInProgress(workInProgress2, renderLanes2) {
    workInProgress2.flags &= 65011714;
    var current = workInProgress2.alternate;
    null === current ? (workInProgress2.childLanes = 0, workInProgress2.lanes = renderLanes2, workInProgress2.child = null, workInProgress2.subtreeFlags = 0, workInProgress2.memoizedProps = null, workInProgress2.memoizedState = null, workInProgress2.updateQueue = null, workInProgress2.dependencies = null, workInProgress2.stateNode = null) : (workInProgress2.childLanes = current.childLanes, workInProgress2.lanes = current.lanes, workInProgress2.child = current.child, workInProgress2.subtreeFlags = 0, workInProgress2.deletions = null, workInProgress2.memoizedProps = current.memoizedProps, workInProgress2.memoizedState = current.memoizedState, workInProgress2.updateQueue = current.updateQueue, workInProgress2.type = current.type, renderLanes2 = current.dependencies, workInProgress2.dependencies = null === renderLanes2 ? null : {
      lanes: renderLanes2.lanes,
      firstContext: renderLanes2.firstContext
    });
    return workInProgress2;
  }
  function createFiberFromTypeAndProps(type, key, pendingProps, owner, mode, lanes) {
    var fiberTag = 0;
    owner = type;
    if ("function" === typeof type) shouldConstruct(type) && (fiberTag = 1);
    else if ("string" === typeof type)
      fiberTag = isHostHoistableType(
        type,
        pendingProps,
        contextStackCursor.current
      ) ? 26 : "html" === type || "head" === type || "body" === type ? 27 : 5;
    else
      a: switch (type) {
        case REACT_ACTIVITY_TYPE:
          return type = createFiberImplClass(31, pendingProps, key, mode), type.elementType = REACT_ACTIVITY_TYPE, type.lanes = lanes, type;
        case REACT_FRAGMENT_TYPE:
          return createFiberFromFragment(pendingProps.children, mode, lanes, key);
        case REACT_STRICT_MODE_TYPE:
          fiberTag = 8;
          mode |= 24;
          break;
        case REACT_PROFILER_TYPE:
          return type = createFiberImplClass(12, pendingProps, key, mode | 2), type.elementType = REACT_PROFILER_TYPE, type.lanes = lanes, type;
        case REACT_SUSPENSE_TYPE:
          return type = createFiberImplClass(13, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_TYPE, type.lanes = lanes, type;
        case REACT_SUSPENSE_LIST_TYPE:
          return type = createFiberImplClass(19, pendingProps, key, mode), type.elementType = REACT_SUSPENSE_LIST_TYPE, type.lanes = lanes, type;
        default:
          if ("object" === typeof type && null !== type)
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                fiberTag = 10;
                break a;
              case REACT_CONSUMER_TYPE:
                fiberTag = 9;
                break a;
              case REACT_FORWARD_REF_TYPE:
                fiberTag = 11;
                break a;
              case REACT_MEMO_TYPE:
                fiberTag = 14;
                break a;
              case REACT_LAZY_TYPE:
                fiberTag = 16;
                owner = null;
                break a;
            }
          fiberTag = 29;
          pendingProps = Error(
            formatProdErrorMessage(130, null === type ? "null" : typeof type, "")
          );
          owner = null;
      }
    key = createFiberImplClass(fiberTag, pendingProps, key, mode);
    key.elementType = type;
    key.type = owner;
    key.lanes = lanes;
    return key;
  }
  function createFiberFromFragment(elements, mode, lanes, key) {
    elements = createFiberImplClass(7, elements, key, mode);
    elements.lanes = lanes;
    return elements;
  }
  function createFiberFromText(content, mode, lanes) {
    content = createFiberImplClass(6, content, null, mode);
    content.lanes = lanes;
    return content;
  }
  function createFiberFromDehydratedFragment(dehydratedNode) {
    var fiber = createFiberImplClass(18, null, null, 0);
    fiber.stateNode = dehydratedNode;
    return fiber;
  }
  function createFiberFromPortal(portal, mode, lanes) {
    mode = createFiberImplClass(
      4,
      null !== portal.children ? portal.children : [],
      portal.key,
      mode
    );
    mode.lanes = lanes;
    mode.stateNode = {
      containerInfo: portal.containerInfo,
      pendingChildren: null,
      implementation: portal.implementation
    };
    return mode;
  }
  var CapturedStacks = /* @__PURE__ */ new WeakMap();
  function createCapturedValueAtFiber(value, source) {
    if ("object" === typeof value && null !== value) {
      var existing = CapturedStacks.get(value);
      if (void 0 !== existing) return existing;
      source = {
        value,
        source,
        stack: getStackByFiberInDevAndProd(source)
      };
      CapturedStacks.set(value, source);
      return source;
    }
    return {
      value,
      source,
      stack: getStackByFiberInDevAndProd(source)
    };
  }
  var forkStack = [], forkStackIndex = 0, treeForkProvider = null, treeForkCount = 0, idStack = [], idStackIndex = 0, treeContextProvider = null, treeContextId = 1, treeContextOverflow = "";
  function pushTreeFork(workInProgress2, totalChildren) {
    forkStack[forkStackIndex++] = treeForkCount;
    forkStack[forkStackIndex++] = treeForkProvider;
    treeForkProvider = workInProgress2;
    treeForkCount = totalChildren;
  }
  function pushTreeId(workInProgress2, totalChildren, index2) {
    idStack[idStackIndex++] = treeContextId;
    idStack[idStackIndex++] = treeContextOverflow;
    idStack[idStackIndex++] = treeContextProvider;
    treeContextProvider = workInProgress2;
    var baseIdWithLeadingBit = treeContextId;
    workInProgress2 = treeContextOverflow;
    var baseLength = 32 - clz32(baseIdWithLeadingBit) - 1;
    baseIdWithLeadingBit &= ~(1 << baseLength);
    index2 += 1;
    var length = 32 - clz32(totalChildren) + baseLength;
    if (30 < length) {
      var numberOfOverflowBits = baseLength - baseLength % 5;
      length = (baseIdWithLeadingBit & (1 << numberOfOverflowBits) - 1).toString(32);
      baseIdWithLeadingBit >>= numberOfOverflowBits;
      baseLength -= numberOfOverflowBits;
      treeContextId = 1 << 32 - clz32(totalChildren) + baseLength | index2 << baseLength | baseIdWithLeadingBit;
      treeContextOverflow = length + workInProgress2;
    } else
      treeContextId = 1 << length | index2 << baseLength | baseIdWithLeadingBit, treeContextOverflow = workInProgress2;
  }
  function pushMaterializedTreeId(workInProgress2) {
    null !== workInProgress2.return && (pushTreeFork(workInProgress2, 1), pushTreeId(workInProgress2, 1, 0));
  }
  function popTreeContext(workInProgress2) {
    for (; workInProgress2 === treeForkProvider; )
      treeForkProvider = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null, treeForkCount = forkStack[--forkStackIndex], forkStack[forkStackIndex] = null;
    for (; workInProgress2 === treeContextProvider; )
      treeContextProvider = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextOverflow = idStack[--idStackIndex], idStack[idStackIndex] = null, treeContextId = idStack[--idStackIndex], idStack[idStackIndex] = null;
  }
  function restoreSuspendedTreeContext(workInProgress2, suspendedContext) {
    idStack[idStackIndex++] = treeContextId;
    idStack[idStackIndex++] = treeContextOverflow;
    idStack[idStackIndex++] = treeContextProvider;
    treeContextId = suspendedContext.id;
    treeContextOverflow = suspendedContext.overflow;
    treeContextProvider = workInProgress2;
  }
  var hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = false, hydrationErrors = null, rootOrSingletonContext = false, HydrationMismatchException = Error(formatProdErrorMessage(519));
  function throwOnHydrationMismatch(fiber) {
    var error = Error(
      formatProdErrorMessage(
        418,
        1 < arguments.length && void 0 !== arguments[1] && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    queueHydrationError(createCapturedValueAtFiber(error, fiber));
    throw HydrationMismatchException;
  }
  function prepareToHydrateHostInstance(fiber) {
    var instance = fiber.stateNode, type = fiber.type, props = fiber.memoizedProps;
    instance[internalInstanceKey] = fiber;
    instance[internalPropsKey] = props;
    switch (type) {
      case "dialog":
        listenToNonDelegatedEvent("cancel", instance);
        listenToNonDelegatedEvent("close", instance);
        break;
      case "iframe":
      case "object":
      case "embed":
        listenToNonDelegatedEvent("load", instance);
        break;
      case "video":
      case "audio":
        for (type = 0; type < mediaEventTypes.length; type++)
          listenToNonDelegatedEvent(mediaEventTypes[type], instance);
        break;
      case "source":
        listenToNonDelegatedEvent("error", instance);
        break;
      case "img":
      case "image":
      case "link":
        listenToNonDelegatedEvent("error", instance);
        listenToNonDelegatedEvent("load", instance);
        break;
      case "details":
        listenToNonDelegatedEvent("toggle", instance);
        break;
      case "input":
        listenToNonDelegatedEvent("invalid", instance);
        initInput(
          instance,
          props.value,
          props.defaultValue,
          props.checked,
          props.defaultChecked,
          props.type,
          props.name,
          true
        );
        break;
      case "select":
        listenToNonDelegatedEvent("invalid", instance);
        break;
      case "textarea":
        listenToNonDelegatedEvent("invalid", instance), initTextarea(instance, props.value, props.defaultValue, props.children);
    }
    type = props.children;
    "string" !== typeof type && "number" !== typeof type && "bigint" !== typeof type || instance.textContent === "" + type || true === props.suppressHydrationWarning || checkForUnmatchedText(instance.textContent, type) ? (null != props.popover && (listenToNonDelegatedEvent("beforetoggle", instance), listenToNonDelegatedEvent("toggle", instance)), null != props.onScroll && listenToNonDelegatedEvent("scroll", instance), null != props.onScrollEnd && listenToNonDelegatedEvent("scrollend", instance), null != props.onClick && (instance.onclick = noop$1), instance = true) : instance = false;
    instance || throwOnHydrationMismatch(fiber, true);
  }
  function popToNextHostParent(fiber) {
    for (hydrationParentFiber = fiber.return; hydrationParentFiber; )
      switch (hydrationParentFiber.tag) {
        case 5:
        case 31:
        case 13:
          rootOrSingletonContext = false;
          return;
        case 27:
        case 3:
          rootOrSingletonContext = true;
          return;
        default:
          hydrationParentFiber = hydrationParentFiber.return;
      }
  }
  function popHydrationState(fiber) {
    if (fiber !== hydrationParentFiber) return false;
    if (!isHydrating) return popToNextHostParent(fiber), isHydrating = true, false;
    var tag = fiber.tag, JSCompiler_temp;
    if (JSCompiler_temp = 3 !== tag && 27 !== tag) {
      if (JSCompiler_temp = 5 === tag)
        JSCompiler_temp = fiber.type, JSCompiler_temp = !("form" !== JSCompiler_temp && "button" !== JSCompiler_temp) || shouldSetTextContent(fiber.type, fiber.memoizedProps);
      JSCompiler_temp = !JSCompiler_temp;
    }
    JSCompiler_temp && nextHydratableInstance && throwOnHydrationMismatch(fiber);
    popToNextHostParent(fiber);
    if (13 === tag) {
      fiber = fiber.memoizedState;
      fiber = null !== fiber ? fiber.dehydrated : null;
      if (!fiber) throw Error(formatProdErrorMessage(317));
      nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
    } else if (31 === tag) {
      fiber = fiber.memoizedState;
      fiber = null !== fiber ? fiber.dehydrated : null;
      if (!fiber) throw Error(formatProdErrorMessage(317));
      nextHydratableInstance = getNextHydratableInstanceAfterHydrationBoundary(fiber);
    } else
      27 === tag ? (tag = nextHydratableInstance, isSingletonScope(fiber.type) ? (fiber = previousHydratableOnEnteringScopedSingleton, previousHydratableOnEnteringScopedSingleton = null, nextHydratableInstance = fiber) : nextHydratableInstance = tag) : nextHydratableInstance = hydrationParentFiber ? getNextHydratable(fiber.stateNode.nextSibling) : null;
    return true;
  }
  function resetHydrationState() {
    nextHydratableInstance = hydrationParentFiber = null;
    isHydrating = false;
  }
  function upgradeHydrationErrorsToRecoverable() {
    var queuedErrors = hydrationErrors;
    null !== queuedErrors && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = queuedErrors : workInProgressRootRecoverableErrors.push.apply(
      workInProgressRootRecoverableErrors,
      queuedErrors
    ), hydrationErrors = null);
    return queuedErrors;
  }
  function queueHydrationError(error) {
    null === hydrationErrors ? hydrationErrors = [error] : hydrationErrors.push(error);
  }
  var valueCursor = createCursor(null), currentlyRenderingFiber$1 = null, lastContextDependency = null;
  function pushProvider(providerFiber, context, nextValue) {
    push(valueCursor, context._currentValue);
    context._currentValue = nextValue;
  }
  function popProvider(context) {
    context._currentValue = valueCursor.current;
    pop(valueCursor);
  }
  function scheduleContextWorkOnParentPath(parent, renderLanes2, propagationRoot) {
    for (; null !== parent; ) {
      var alternate = parent.alternate;
      (parent.childLanes & renderLanes2) !== renderLanes2 ? (parent.childLanes |= renderLanes2, null !== alternate && (alternate.childLanes |= renderLanes2)) : null !== alternate && (alternate.childLanes & renderLanes2) !== renderLanes2 && (alternate.childLanes |= renderLanes2);
      if (parent === propagationRoot) break;
      parent = parent.return;
    }
  }
  function propagateContextChanges(workInProgress2, contexts, renderLanes2, forcePropagateEntireTree) {
    var fiber = workInProgress2.child;
    null !== fiber && (fiber.return = workInProgress2);
    for (; null !== fiber; ) {
      var list = fiber.dependencies;
      if (null !== list) {
        var nextFiber = fiber.child;
        list = list.firstContext;
        a: for (; null !== list; ) {
          var dependency = list;
          list = fiber;
          for (var i = 0; i < contexts.length; i++)
            if (dependency.context === contexts[i]) {
              list.lanes |= renderLanes2;
              dependency = list.alternate;
              null !== dependency && (dependency.lanes |= renderLanes2);
              scheduleContextWorkOnParentPath(
                list.return,
                renderLanes2,
                workInProgress2
              );
              forcePropagateEntireTree || (nextFiber = null);
              break a;
            }
          list = dependency.next;
        }
      } else if (18 === fiber.tag) {
        nextFiber = fiber.return;
        if (null === nextFiber) throw Error(formatProdErrorMessage(341));
        nextFiber.lanes |= renderLanes2;
        list = nextFiber.alternate;
        null !== list && (list.lanes |= renderLanes2);
        scheduleContextWorkOnParentPath(nextFiber, renderLanes2, workInProgress2);
        nextFiber = null;
      } else nextFiber = fiber.child;
      if (null !== nextFiber) nextFiber.return = fiber;
      else
        for (nextFiber = fiber; null !== nextFiber; ) {
          if (nextFiber === workInProgress2) {
            nextFiber = null;
            break;
          }
          fiber = nextFiber.sibling;
          if (null !== fiber) {
            fiber.return = nextFiber.return;
            nextFiber = fiber;
            break;
          }
          nextFiber = nextFiber.return;
        }
      fiber = nextFiber;
    }
  }
  function propagateParentContextChanges(current, workInProgress2, renderLanes2, forcePropagateEntireTree) {
    current = null;
    for (var parent = workInProgress2, isInsidePropagationBailout = false; null !== parent; ) {
      if (!isInsidePropagationBailout) {
        if (0 !== (parent.flags & 524288)) isInsidePropagationBailout = true;
        else if (0 !== (parent.flags & 262144)) break;
      }
      if (10 === parent.tag) {
        var currentParent = parent.alternate;
        if (null === currentParent) throw Error(formatProdErrorMessage(387));
        currentParent = currentParent.memoizedProps;
        if (null !== currentParent) {
          var context = parent.type;
          objectIs(parent.pendingProps.value, currentParent.value) || (null !== current ? current.push(context) : current = [context]);
        }
      } else if (parent === hostTransitionProviderCursor.current) {
        currentParent = parent.alternate;
        if (null === currentParent) throw Error(formatProdErrorMessage(387));
        currentParent.memoizedState.memoizedState !== parent.memoizedState.memoizedState && (null !== current ? current.push(HostTransitionContext) : current = [HostTransitionContext]);
      }
      parent = parent.return;
    }
    null !== current && propagateContextChanges(
      workInProgress2,
      current,
      renderLanes2,
      forcePropagateEntireTree
    );
    workInProgress2.flags |= 262144;
  }
  function checkIfContextChanged(currentDependencies) {
    for (currentDependencies = currentDependencies.firstContext; null !== currentDependencies; ) {
      if (!objectIs(
        currentDependencies.context._currentValue,
        currentDependencies.memoizedValue
      ))
        return true;
      currentDependencies = currentDependencies.next;
    }
    return false;
  }
  function prepareToReadContext(workInProgress2) {
    currentlyRenderingFiber$1 = workInProgress2;
    lastContextDependency = null;
    workInProgress2 = workInProgress2.dependencies;
    null !== workInProgress2 && (workInProgress2.firstContext = null);
  }
  function readContext(context) {
    return readContextForConsumer(currentlyRenderingFiber$1, context);
  }
  function readContextDuringReconciliation(consumer, context) {
    null === currentlyRenderingFiber$1 && prepareToReadContext(consumer);
    return readContextForConsumer(consumer, context);
  }
  function readContextForConsumer(consumer, context) {
    var value = context._currentValue;
    context = { context, memoizedValue: value, next: null };
    if (null === lastContextDependency) {
      if (null === consumer) throw Error(formatProdErrorMessage(308));
      lastContextDependency = context;
      consumer.dependencies = { lanes: 0, firstContext: context };
      consumer.flags |= 524288;
    } else lastContextDependency = lastContextDependency.next = context;
    return value;
  }
  var AbortControllerLocal = "undefined" !== typeof AbortController ? AbortController : function() {
    var listeners = [], signal = this.signal = {
      aborted: false,
      addEventListener: function(type, listener) {
        listeners.push(listener);
      }
    };
    this.abort = function() {
      signal.aborted = true;
      listeners.forEach(function(listener) {
        return listener();
      });
    };
  }, scheduleCallback$2 = Scheduler.unstable_scheduleCallback, NormalPriority = Scheduler.unstable_NormalPriority, CacheContext = {
    $$typeof: REACT_CONTEXT_TYPE,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function createCache() {
    return {
      controller: new AbortControllerLocal(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function releaseCache(cache) {
    cache.refCount--;
    0 === cache.refCount && scheduleCallback$2(NormalPriority, function() {
      cache.controller.abort();
    });
  }
  var currentEntangledListeners = null, currentEntangledPendingCount = 0, currentEntangledLane = 0, currentEntangledActionThenable = null;
  function entangleAsyncAction(transition, thenable) {
    if (null === currentEntangledListeners) {
      var entangledListeners = currentEntangledListeners = [];
      currentEntangledPendingCount = 0;
      currentEntangledLane = requestTransitionLane();
      currentEntangledActionThenable = {
        status: "pending",
        value: void 0,
        then: function(resolve) {
          entangledListeners.push(resolve);
        }
      };
    }
    currentEntangledPendingCount++;
    thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
    return thenable;
  }
  function pingEngtangledActionScope() {
    if (0 === --currentEntangledPendingCount && null !== currentEntangledListeners) {
      null !== currentEntangledActionThenable && (currentEntangledActionThenable.status = "fulfilled");
      var listeners = currentEntangledListeners;
      currentEntangledListeners = null;
      currentEntangledLane = 0;
      currentEntangledActionThenable = null;
      for (var i = 0; i < listeners.length; i++) (0, listeners[i])();
    }
  }
  function chainThenableValue(thenable, result) {
    var listeners = [], thenableWithOverride = {
      status: "pending",
      value: null,
      reason: null,
      then: function(resolve) {
        listeners.push(resolve);
      }
    };
    thenable.then(
      function() {
        thenableWithOverride.status = "fulfilled";
        thenableWithOverride.value = result;
        for (var i = 0; i < listeners.length; i++) (0, listeners[i])(result);
      },
      function(error) {
        thenableWithOverride.status = "rejected";
        thenableWithOverride.reason = error;
        for (error = 0; error < listeners.length; error++)
          (0, listeners[error])(void 0);
      }
    );
    return thenableWithOverride;
  }
  var prevOnStartTransitionFinish = ReactSharedInternals.S;
  ReactSharedInternals.S = function(transition, returnValue) {
    globalMostRecentTransitionTime = now();
    "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && entangleAsyncAction(transition, returnValue);
    null !== prevOnStartTransitionFinish && prevOnStartTransitionFinish(transition, returnValue);
  };
  var resumedCache = createCursor(null);
  function peekCacheFromPool() {
    var cacheResumedFromPreviousRender = resumedCache.current;
    return null !== cacheResumedFromPreviousRender ? cacheResumedFromPreviousRender : workInProgressRoot.pooledCache;
  }
  function pushTransition(offscreenWorkInProgress, prevCachePool) {
    null === prevCachePool ? push(resumedCache, resumedCache.current) : push(resumedCache, prevCachePool.pool);
  }
  function getSuspendedCache() {
    var cacheFromPool = peekCacheFromPool();
    return null === cacheFromPool ? null : { parent: CacheContext._currentValue, pool: cacheFromPool };
  }
  var SuspenseException = Error(formatProdErrorMessage(460)), SuspenseyCommitException = Error(formatProdErrorMessage(474)), SuspenseActionException = Error(formatProdErrorMessage(542)), noopSuspenseyCommitThenable = { then: function() {
  } };
  function isThenableResolved(thenable) {
    thenable = thenable.status;
    return "fulfilled" === thenable || "rejected" === thenable;
  }
  function trackUsedThenable(thenableState2, thenable, index2) {
    index2 = thenableState2[index2];
    void 0 === index2 ? thenableState2.push(thenable) : index2 !== thenable && (thenable.then(noop$1, noop$1), thenable = index2);
    switch (thenable.status) {
      case "fulfilled":
        return thenable.value;
      case "rejected":
        throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
      default:
        if ("string" === typeof thenable.status) thenable.then(noop$1, noop$1);
        else {
          thenableState2 = workInProgressRoot;
          if (null !== thenableState2 && 100 < thenableState2.shellSuspendCounter)
            throw Error(formatProdErrorMessage(482));
          thenableState2 = thenable;
          thenableState2.status = "pending";
          thenableState2.then(
            function(fulfilledValue) {
              if ("pending" === thenable.status) {
                var fulfilledThenable = thenable;
                fulfilledThenable.status = "fulfilled";
                fulfilledThenable.value = fulfilledValue;
              }
            },
            function(error) {
              if ("pending" === thenable.status) {
                var rejectedThenable = thenable;
                rejectedThenable.status = "rejected";
                rejectedThenable.reason = error;
              }
            }
          );
        }
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenableState2 = thenable.reason, checkIfUseWrappedInAsyncCatch(thenableState2), thenableState2;
        }
        suspendedThenable = thenable;
        throw SuspenseException;
    }
  }
  function resolveLazy(lazyType) {
    try {
      var init = lazyType._init;
      return init(lazyType._payload);
    } catch (x) {
      if (null !== x && "object" === typeof x && "function" === typeof x.then)
        throw suspendedThenable = x, SuspenseException;
      throw x;
    }
  }
  var suspendedThenable = null;
  function getSuspendedThenable() {
    if (null === suspendedThenable) throw Error(formatProdErrorMessage(459));
    var thenable = suspendedThenable;
    suspendedThenable = null;
    return thenable;
  }
  function checkIfUseWrappedInAsyncCatch(rejectedReason) {
    if (rejectedReason === SuspenseException || rejectedReason === SuspenseActionException)
      throw Error(formatProdErrorMessage(483));
  }
  var thenableState$1 = null, thenableIndexCounter$1 = 0;
  function unwrapThenable(thenable) {
    var index2 = thenableIndexCounter$1;
    thenableIndexCounter$1 += 1;
    null === thenableState$1 && (thenableState$1 = []);
    return trackUsedThenable(thenableState$1, thenable, index2);
  }
  function coerceRef(workInProgress2, element) {
    element = element.props.ref;
    workInProgress2.ref = void 0 !== element ? element : null;
  }
  function throwOnInvalidObjectTypeImpl(returnFiber, newChild) {
    if (newChild.$$typeof === REACT_LEGACY_ELEMENT_TYPE)
      throw Error(formatProdErrorMessage(525));
    returnFiber = Object.prototype.toString.call(newChild);
    throw Error(
      formatProdErrorMessage(
        31,
        "[object Object]" === returnFiber ? "object with keys {" + Object.keys(newChild).join(", ") + "}" : returnFiber
      )
    );
  }
  function createChildReconciler(shouldTrackSideEffects) {
    function deleteChild(returnFiber, childToDelete) {
      if (shouldTrackSideEffects) {
        var deletions = returnFiber.deletions;
        null === deletions ? (returnFiber.deletions = [childToDelete], returnFiber.flags |= 16) : deletions.push(childToDelete);
      }
    }
    function deleteRemainingChildren(returnFiber, currentFirstChild) {
      if (!shouldTrackSideEffects) return null;
      for (; null !== currentFirstChild; )
        deleteChild(returnFiber, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
      return null;
    }
    function mapRemainingChildren(currentFirstChild) {
      for (var existingChildren = /* @__PURE__ */ new Map(); null !== currentFirstChild; )
        null !== currentFirstChild.key ? existingChildren.set(currentFirstChild.key, currentFirstChild) : existingChildren.set(currentFirstChild.index, currentFirstChild), currentFirstChild = currentFirstChild.sibling;
      return existingChildren;
    }
    function useFiber(fiber, pendingProps) {
      fiber = createWorkInProgress(fiber, pendingProps);
      fiber.index = 0;
      fiber.sibling = null;
      return fiber;
    }
    function placeChild(newFiber, lastPlacedIndex, newIndex) {
      newFiber.index = newIndex;
      if (!shouldTrackSideEffects)
        return newFiber.flags |= 1048576, lastPlacedIndex;
      newIndex = newFiber.alternate;
      if (null !== newIndex)
        return newIndex = newIndex.index, newIndex < lastPlacedIndex ? (newFiber.flags |= 67108866, lastPlacedIndex) : newIndex;
      newFiber.flags |= 67108866;
      return lastPlacedIndex;
    }
    function placeSingleChild(newFiber) {
      shouldTrackSideEffects && null === newFiber.alternate && (newFiber.flags |= 67108866);
      return newFiber;
    }
    function updateTextNode(returnFiber, current, textContent, lanes) {
      if (null === current || 6 !== current.tag)
        return current = createFiberFromText(textContent, returnFiber.mode, lanes), current.return = returnFiber, current;
      current = useFiber(current, textContent);
      current.return = returnFiber;
      return current;
    }
    function updateElement(returnFiber, current, element, lanes) {
      var elementType = element.type;
      if (elementType === REACT_FRAGMENT_TYPE)
        return updateFragment(
          returnFiber,
          current,
          element.props.children,
          lanes,
          element.key
        );
      if (null !== current && (current.elementType === elementType || "object" === typeof elementType && null !== elementType && elementType.$$typeof === REACT_LAZY_TYPE && resolveLazy(elementType) === current.type))
        return current = useFiber(current, element.props), coerceRef(current, element), current.return = returnFiber, current;
      current = createFiberFromTypeAndProps(
        element.type,
        element.key,
        element.props,
        null,
        returnFiber.mode,
        lanes
      );
      coerceRef(current, element);
      current.return = returnFiber;
      return current;
    }
    function updatePortal(returnFiber, current, portal, lanes) {
      if (null === current || 4 !== current.tag || current.stateNode.containerInfo !== portal.containerInfo || current.stateNode.implementation !== portal.implementation)
        return current = createFiberFromPortal(portal, returnFiber.mode, lanes), current.return = returnFiber, current;
      current = useFiber(current, portal.children || []);
      current.return = returnFiber;
      return current;
    }
    function updateFragment(returnFiber, current, fragment, lanes, key) {
      if (null === current || 7 !== current.tag)
        return current = createFiberFromFragment(
          fragment,
          returnFiber.mode,
          lanes,
          key
        ), current.return = returnFiber, current;
      current = useFiber(current, fragment);
      current.return = returnFiber;
      return current;
    }
    function createChild(returnFiber, newChild, lanes) {
      if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
        return newChild = createFiberFromText(
          "" + newChild,
          returnFiber.mode,
          lanes
        ), newChild.return = returnFiber, newChild;
      if ("object" === typeof newChild && null !== newChild) {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return lanes = createFiberFromTypeAndProps(
              newChild.type,
              newChild.key,
              newChild.props,
              null,
              returnFiber.mode,
              lanes
            ), coerceRef(lanes, newChild), lanes.return = returnFiber, lanes;
          case REACT_PORTAL_TYPE:
            return newChild = createFiberFromPortal(
              newChild,
              returnFiber.mode,
              lanes
            ), newChild.return = returnFiber, newChild;
          case REACT_LAZY_TYPE:
            return newChild = resolveLazy(newChild), createChild(returnFiber, newChild, lanes);
        }
        if (isArrayImpl(newChild) || getIteratorFn(newChild))
          return newChild = createFiberFromFragment(
            newChild,
            returnFiber.mode,
            lanes,
            null
          ), newChild.return = returnFiber, newChild;
        if ("function" === typeof newChild.then)
          return createChild(returnFiber, unwrapThenable(newChild), lanes);
        if (newChild.$$typeof === REACT_CONTEXT_TYPE)
          return createChild(
            returnFiber,
            readContextDuringReconciliation(returnFiber, newChild),
            lanes
          );
        throwOnInvalidObjectTypeImpl(returnFiber, newChild);
      }
      return null;
    }
    function updateSlot(returnFiber, oldFiber, newChild, lanes) {
      var key = null !== oldFiber ? oldFiber.key : null;
      if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
        return null !== key ? null : updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
      if ("object" === typeof newChild && null !== newChild) {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return newChild.key === key ? updateElement(returnFiber, oldFiber, newChild, lanes) : null;
          case REACT_PORTAL_TYPE:
            return newChild.key === key ? updatePortal(returnFiber, oldFiber, newChild, lanes) : null;
          case REACT_LAZY_TYPE:
            return newChild = resolveLazy(newChild), updateSlot(returnFiber, oldFiber, newChild, lanes);
        }
        if (isArrayImpl(newChild) || getIteratorFn(newChild))
          return null !== key ? null : updateFragment(returnFiber, oldFiber, newChild, lanes, null);
        if ("function" === typeof newChild.then)
          return updateSlot(
            returnFiber,
            oldFiber,
            unwrapThenable(newChild),
            lanes
          );
        if (newChild.$$typeof === REACT_CONTEXT_TYPE)
          return updateSlot(
            returnFiber,
            oldFiber,
            readContextDuringReconciliation(returnFiber, newChild),
            lanes
          );
        throwOnInvalidObjectTypeImpl(returnFiber, newChild);
      }
      return null;
    }
    function updateFromMap(existingChildren, returnFiber, newIdx, newChild, lanes) {
      if ("string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild)
        return existingChildren = existingChildren.get(newIdx) || null, updateTextNode(returnFiber, existingChildren, "" + newChild, lanes);
      if ("object" === typeof newChild && null !== newChild) {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            return existingChildren = existingChildren.get(
              null === newChild.key ? newIdx : newChild.key
            ) || null, updateElement(returnFiber, existingChildren, newChild, lanes);
          case REACT_PORTAL_TYPE:
            return existingChildren = existingChildren.get(
              null === newChild.key ? newIdx : newChild.key
            ) || null, updatePortal(returnFiber, existingChildren, newChild, lanes);
          case REACT_LAZY_TYPE:
            return newChild = resolveLazy(newChild), updateFromMap(
              existingChildren,
              returnFiber,
              newIdx,
              newChild,
              lanes
            );
        }
        if (isArrayImpl(newChild) || getIteratorFn(newChild))
          return existingChildren = existingChildren.get(newIdx) || null, updateFragment(returnFiber, existingChildren, newChild, lanes, null);
        if ("function" === typeof newChild.then)
          return updateFromMap(
            existingChildren,
            returnFiber,
            newIdx,
            unwrapThenable(newChild),
            lanes
          );
        if (newChild.$$typeof === REACT_CONTEXT_TYPE)
          return updateFromMap(
            existingChildren,
            returnFiber,
            newIdx,
            readContextDuringReconciliation(returnFiber, newChild),
            lanes
          );
        throwOnInvalidObjectTypeImpl(returnFiber, newChild);
      }
      return null;
    }
    function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
      for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null; null !== oldFiber && newIdx < newChildren.length; newIdx++) {
        oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
        var newFiber = updateSlot(
          returnFiber,
          oldFiber,
          newChildren[newIdx],
          lanes
        );
        if (null === newFiber) {
          null === oldFiber && (oldFiber = nextOldFiber);
          break;
        }
        shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
        currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
        null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
        previousNewFiber = newFiber;
        oldFiber = nextOldFiber;
      }
      if (newIdx === newChildren.length)
        return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
      if (null === oldFiber) {
        for (; newIdx < newChildren.length; newIdx++)
          oldFiber = createChild(returnFiber, newChildren[newIdx], lanes), null !== oldFiber && (currentFirstChild = placeChild(
            oldFiber,
            currentFirstChild,
            newIdx
          ), null === previousNewFiber ? resultingFirstChild = oldFiber : previousNewFiber.sibling = oldFiber, previousNewFiber = oldFiber);
        isHydrating && pushTreeFork(returnFiber, newIdx);
        return resultingFirstChild;
      }
      for (oldFiber = mapRemainingChildren(oldFiber); newIdx < newChildren.length; newIdx++)
        nextOldFiber = updateFromMap(
          oldFiber,
          returnFiber,
          newIdx,
          newChildren[newIdx],
          lanes
        ), null !== nextOldFiber && (shouldTrackSideEffects && null !== nextOldFiber.alternate && oldFiber.delete(
          null === nextOldFiber.key ? newIdx : nextOldFiber.key
        ), currentFirstChild = placeChild(
          nextOldFiber,
          currentFirstChild,
          newIdx
        ), null === previousNewFiber ? resultingFirstChild = nextOldFiber : previousNewFiber.sibling = nextOldFiber, previousNewFiber = nextOldFiber);
      shouldTrackSideEffects && oldFiber.forEach(function(child) {
        return deleteChild(returnFiber, child);
      });
      isHydrating && pushTreeFork(returnFiber, newIdx);
      return resultingFirstChild;
    }
    function reconcileChildrenIterator(returnFiber, currentFirstChild, newChildren, lanes) {
      if (null == newChildren) throw Error(formatProdErrorMessage(151));
      for (var resultingFirstChild = null, previousNewFiber = null, oldFiber = currentFirstChild, newIdx = currentFirstChild = 0, nextOldFiber = null, step = newChildren.next(); null !== oldFiber && !step.done; newIdx++, step = newChildren.next()) {
        oldFiber.index > newIdx ? (nextOldFiber = oldFiber, oldFiber = null) : nextOldFiber = oldFiber.sibling;
        var newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
        if (null === newFiber) {
          null === oldFiber && (oldFiber = nextOldFiber);
          break;
        }
        shouldTrackSideEffects && oldFiber && null === newFiber.alternate && deleteChild(returnFiber, oldFiber);
        currentFirstChild = placeChild(newFiber, currentFirstChild, newIdx);
        null === previousNewFiber ? resultingFirstChild = newFiber : previousNewFiber.sibling = newFiber;
        previousNewFiber = newFiber;
        oldFiber = nextOldFiber;
      }
      if (step.done)
        return deleteRemainingChildren(returnFiber, oldFiber), isHydrating && pushTreeFork(returnFiber, newIdx), resultingFirstChild;
      if (null === oldFiber) {
        for (; !step.done; newIdx++, step = newChildren.next())
          step = createChild(returnFiber, step.value, lanes), null !== step && (currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
        isHydrating && pushTreeFork(returnFiber, newIdx);
        return resultingFirstChild;
      }
      for (oldFiber = mapRemainingChildren(oldFiber); !step.done; newIdx++, step = newChildren.next())
        step = updateFromMap(oldFiber, returnFiber, newIdx, step.value, lanes), null !== step && (shouldTrackSideEffects && null !== step.alternate && oldFiber.delete(null === step.key ? newIdx : step.key), currentFirstChild = placeChild(step, currentFirstChild, newIdx), null === previousNewFiber ? resultingFirstChild = step : previousNewFiber.sibling = step, previousNewFiber = step);
      shouldTrackSideEffects && oldFiber.forEach(function(child) {
        return deleteChild(returnFiber, child);
      });
      isHydrating && pushTreeFork(returnFiber, newIdx);
      return resultingFirstChild;
    }
    function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
      "object" === typeof newChild && null !== newChild && newChild.type === REACT_FRAGMENT_TYPE && null === newChild.key && (newChild = newChild.props.children);
      if ("object" === typeof newChild && null !== newChild) {
        switch (newChild.$$typeof) {
          case REACT_ELEMENT_TYPE:
            a: {
              for (var key = newChild.key; null !== currentFirstChild; ) {
                if (currentFirstChild.key === key) {
                  key = newChild.type;
                  if (key === REACT_FRAGMENT_TYPE) {
                    if (7 === currentFirstChild.tag) {
                      deleteRemainingChildren(
                        returnFiber,
                        currentFirstChild.sibling
                      );
                      lanes = useFiber(
                        currentFirstChild,
                        newChild.props.children
                      );
                      lanes.return = returnFiber;
                      returnFiber = lanes;
                      break a;
                    }
                  } else if (currentFirstChild.elementType === key || "object" === typeof key && null !== key && key.$$typeof === REACT_LAZY_TYPE && resolveLazy(key) === currentFirstChild.type) {
                    deleteRemainingChildren(
                      returnFiber,
                      currentFirstChild.sibling
                    );
                    lanes = useFiber(currentFirstChild, newChild.props);
                    coerceRef(lanes, newChild);
                    lanes.return = returnFiber;
                    returnFiber = lanes;
                    break a;
                  }
                  deleteRemainingChildren(returnFiber, currentFirstChild);
                  break;
                } else deleteChild(returnFiber, currentFirstChild);
                currentFirstChild = currentFirstChild.sibling;
              }
              newChild.type === REACT_FRAGMENT_TYPE ? (lanes = createFiberFromFragment(
                newChild.props.children,
                returnFiber.mode,
                lanes,
                newChild.key
              ), lanes.return = returnFiber, returnFiber = lanes) : (lanes = createFiberFromTypeAndProps(
                newChild.type,
                newChild.key,
                newChild.props,
                null,
                returnFiber.mode,
                lanes
              ), coerceRef(lanes, newChild), lanes.return = returnFiber, returnFiber = lanes);
            }
            return placeSingleChild(returnFiber);
          case REACT_PORTAL_TYPE:
            a: {
              for (key = newChild.key; null !== currentFirstChild; ) {
                if (currentFirstChild.key === key)
                  if (4 === currentFirstChild.tag && currentFirstChild.stateNode.containerInfo === newChild.containerInfo && currentFirstChild.stateNode.implementation === newChild.implementation) {
                    deleteRemainingChildren(
                      returnFiber,
                      currentFirstChild.sibling
                    );
                    lanes = useFiber(currentFirstChild, newChild.children || []);
                    lanes.return = returnFiber;
                    returnFiber = lanes;
                    break a;
                  } else {
                    deleteRemainingChildren(returnFiber, currentFirstChild);
                    break;
                  }
                else deleteChild(returnFiber, currentFirstChild);
                currentFirstChild = currentFirstChild.sibling;
              }
              lanes = createFiberFromPortal(newChild, returnFiber.mode, lanes);
              lanes.return = returnFiber;
              returnFiber = lanes;
            }
            return placeSingleChild(returnFiber);
          case REACT_LAZY_TYPE:
            return newChild = resolveLazy(newChild), reconcileChildFibersImpl(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes
            );
        }
        if (isArrayImpl(newChild))
          return reconcileChildrenArray(
            returnFiber,
            currentFirstChild,
            newChild,
            lanes
          );
        if (getIteratorFn(newChild)) {
          key = getIteratorFn(newChild);
          if ("function" !== typeof key) throw Error(formatProdErrorMessage(150));
          newChild = key.call(newChild);
          return reconcileChildrenIterator(
            returnFiber,
            currentFirstChild,
            newChild,
            lanes
          );
        }
        if ("function" === typeof newChild.then)
          return reconcileChildFibersImpl(
            returnFiber,
            currentFirstChild,
            unwrapThenable(newChild),
            lanes
          );
        if (newChild.$$typeof === REACT_CONTEXT_TYPE)
          return reconcileChildFibersImpl(
            returnFiber,
            currentFirstChild,
            readContextDuringReconciliation(returnFiber, newChild),
            lanes
          );
        throwOnInvalidObjectTypeImpl(returnFiber, newChild);
      }
      return "string" === typeof newChild && "" !== newChild || "number" === typeof newChild || "bigint" === typeof newChild ? (newChild = "" + newChild, null !== currentFirstChild && 6 === currentFirstChild.tag ? (deleteRemainingChildren(returnFiber, currentFirstChild.sibling), lanes = useFiber(currentFirstChild, newChild), lanes.return = returnFiber, returnFiber = lanes) : (deleteRemainingChildren(returnFiber, currentFirstChild), lanes = createFiberFromText(newChild, returnFiber.mode, lanes), lanes.return = returnFiber, returnFiber = lanes), placeSingleChild(returnFiber)) : deleteRemainingChildren(returnFiber, currentFirstChild);
    }
    return function(returnFiber, currentFirstChild, newChild, lanes) {
      try {
        thenableIndexCounter$1 = 0;
        var firstChildFiber = reconcileChildFibersImpl(
          returnFiber,
          currentFirstChild,
          newChild,
          lanes
        );
        thenableState$1 = null;
        return firstChildFiber;
      } catch (x) {
        if (x === SuspenseException || x === SuspenseActionException) throw x;
        var fiber = createFiberImplClass(29, x, null, returnFiber.mode);
        fiber.lanes = lanes;
        fiber.return = returnFiber;
        return fiber;
      } finally {
      }
    };
  }
  var reconcileChildFibers = createChildReconciler(true), mountChildFibers = createChildReconciler(false), hasForceUpdate = false;
  function initializeUpdateQueue(fiber) {
    fiber.updateQueue = {
      baseState: fiber.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function cloneUpdateQueue(current, workInProgress2) {
    current = current.updateQueue;
    workInProgress2.updateQueue === current && (workInProgress2.updateQueue = {
      baseState: current.baseState,
      firstBaseUpdate: current.firstBaseUpdate,
      lastBaseUpdate: current.lastBaseUpdate,
      shared: current.shared,
      callbacks: null
    });
  }
  function createUpdate(lane) {
    return { lane, tag: 0, payload: null, callback: null, next: null };
  }
  function enqueueUpdate(fiber, update, lane) {
    var updateQueue = fiber.updateQueue;
    if (null === updateQueue) return null;
    updateQueue = updateQueue.shared;
    if (0 !== (executionContext & 2)) {
      var pending = updateQueue.pending;
      null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
      updateQueue.pending = update;
      update = getRootForUpdatedFiber(fiber);
      markUpdateLaneFromFiberToRoot(fiber, null, lane);
      return update;
    }
    enqueueUpdate$1(fiber, updateQueue, update, lane);
    return getRootForUpdatedFiber(fiber);
  }
  function entangleTransitions(root2, fiber, lane) {
    fiber = fiber.updateQueue;
    if (null !== fiber && (fiber = fiber.shared, 0 !== (lane & 4194048))) {
      var queueLanes = fiber.lanes;
      queueLanes &= root2.pendingLanes;
      lane |= queueLanes;
      fiber.lanes = lane;
      markRootEntangled(root2, lane);
    }
  }
  function enqueueCapturedUpdate(workInProgress2, capturedUpdate) {
    var queue = workInProgress2.updateQueue, current = workInProgress2.alternate;
    if (null !== current && (current = current.updateQueue, queue === current)) {
      var newFirst = null, newLast = null;
      queue = queue.firstBaseUpdate;
      if (null !== queue) {
        do {
          var clone = {
            lane: queue.lane,
            tag: queue.tag,
            payload: queue.payload,
            callback: null,
            next: null
          };
          null === newLast ? newFirst = newLast = clone : newLast = newLast.next = clone;
          queue = queue.next;
        } while (null !== queue);
        null === newLast ? newFirst = newLast = capturedUpdate : newLast = newLast.next = capturedUpdate;
      } else newFirst = newLast = capturedUpdate;
      queue = {
        baseState: current.baseState,
        firstBaseUpdate: newFirst,
        lastBaseUpdate: newLast,
        shared: current.shared,
        callbacks: current.callbacks
      };
      workInProgress2.updateQueue = queue;
      return;
    }
    workInProgress2 = queue.lastBaseUpdate;
    null === workInProgress2 ? queue.firstBaseUpdate = capturedUpdate : workInProgress2.next = capturedUpdate;
    queue.lastBaseUpdate = capturedUpdate;
  }
  var didReadFromEntangledAsyncAction = false;
  function suspendIfUpdateReadFromEntangledAsyncAction() {
    if (didReadFromEntangledAsyncAction) {
      var entangledActionThenable = currentEntangledActionThenable;
      if (null !== entangledActionThenable) throw entangledActionThenable;
    }
  }
  function processUpdateQueue(workInProgress$jscomp$0, props, instance$jscomp$0, renderLanes2) {
    didReadFromEntangledAsyncAction = false;
    var queue = workInProgress$jscomp$0.updateQueue;
    hasForceUpdate = false;
    var firstBaseUpdate = queue.firstBaseUpdate, lastBaseUpdate = queue.lastBaseUpdate, pendingQueue = queue.shared.pending;
    if (null !== pendingQueue) {
      queue.shared.pending = null;
      var lastPendingUpdate = pendingQueue, firstPendingUpdate = lastPendingUpdate.next;
      lastPendingUpdate.next = null;
      null === lastBaseUpdate ? firstBaseUpdate = firstPendingUpdate : lastBaseUpdate.next = firstPendingUpdate;
      lastBaseUpdate = lastPendingUpdate;
      var current = workInProgress$jscomp$0.alternate;
      null !== current && (current = current.updateQueue, pendingQueue = current.lastBaseUpdate, pendingQueue !== lastBaseUpdate && (null === pendingQueue ? current.firstBaseUpdate = firstPendingUpdate : pendingQueue.next = firstPendingUpdate, current.lastBaseUpdate = lastPendingUpdate));
    }
    if (null !== firstBaseUpdate) {
      var newState = queue.baseState;
      lastBaseUpdate = 0;
      current = firstPendingUpdate = lastPendingUpdate = null;
      pendingQueue = firstBaseUpdate;
      do {
        var updateLane = pendingQueue.lane & -536870913, isHiddenUpdate = updateLane !== pendingQueue.lane;
        if (isHiddenUpdate ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes2 & updateLane) === updateLane) {
          0 !== updateLane && updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction = true);
          null !== current && (current = current.next = {
            lane: 0,
            tag: pendingQueue.tag,
            payload: pendingQueue.payload,
            callback: null,
            next: null
          });
          a: {
            var workInProgress2 = workInProgress$jscomp$0, update = pendingQueue;
            updateLane = props;
            var instance = instance$jscomp$0;
            switch (update.tag) {
              case 1:
                workInProgress2 = update.payload;
                if ("function" === typeof workInProgress2) {
                  newState = workInProgress2.call(instance, newState, updateLane);
                  break a;
                }
                newState = workInProgress2;
                break a;
              case 3:
                workInProgress2.flags = workInProgress2.flags & -65537 | 128;
              case 0:
                workInProgress2 = update.payload;
                updateLane = "function" === typeof workInProgress2 ? workInProgress2.call(instance, newState, updateLane) : workInProgress2;
                if (null === updateLane || void 0 === updateLane) break a;
                newState = assign({}, newState, updateLane);
                break a;
              case 2:
                hasForceUpdate = true;
            }
          }
          updateLane = pendingQueue.callback;
          null !== updateLane && (workInProgress$jscomp$0.flags |= 64, isHiddenUpdate && (workInProgress$jscomp$0.flags |= 8192), isHiddenUpdate = queue.callbacks, null === isHiddenUpdate ? queue.callbacks = [updateLane] : isHiddenUpdate.push(updateLane));
        } else
          isHiddenUpdate = {
            lane: updateLane,
            tag: pendingQueue.tag,
            payload: pendingQueue.payload,
            callback: pendingQueue.callback,
            next: null
          }, null === current ? (firstPendingUpdate = current = isHiddenUpdate, lastPendingUpdate = newState) : current = current.next = isHiddenUpdate, lastBaseUpdate |= updateLane;
        pendingQueue = pendingQueue.next;
        if (null === pendingQueue)
          if (pendingQueue = queue.shared.pending, null === pendingQueue)
            break;
          else
            isHiddenUpdate = pendingQueue, pendingQueue = isHiddenUpdate.next, isHiddenUpdate.next = null, queue.lastBaseUpdate = isHiddenUpdate, queue.shared.pending = null;
      } while (1);
      null === current && (lastPendingUpdate = newState);
      queue.baseState = lastPendingUpdate;
      queue.firstBaseUpdate = firstPendingUpdate;
      queue.lastBaseUpdate = current;
      null === firstBaseUpdate && (queue.shared.lanes = 0);
      workInProgressRootSkippedLanes |= lastBaseUpdate;
      workInProgress$jscomp$0.lanes = lastBaseUpdate;
      workInProgress$jscomp$0.memoizedState = newState;
    }
  }
  function callCallback(callback, context) {
    if ("function" !== typeof callback)
      throw Error(formatProdErrorMessage(191, callback));
    callback.call(context);
  }
  function commitCallbacks(updateQueue, context) {
    var callbacks = updateQueue.callbacks;
    if (null !== callbacks)
      for (updateQueue.callbacks = null, updateQueue = 0; updateQueue < callbacks.length; updateQueue++)
        callCallback(callbacks[updateQueue], context);
  }
  var currentTreeHiddenStackCursor = createCursor(null), prevEntangledRenderLanesCursor = createCursor(0);
  function pushHiddenContext(fiber, context) {
    fiber = entangledRenderLanes;
    push(prevEntangledRenderLanesCursor, fiber);
    push(currentTreeHiddenStackCursor, context);
    entangledRenderLanes = fiber | context.baseLanes;
  }
  function reuseHiddenContextOnStack() {
    push(prevEntangledRenderLanesCursor, entangledRenderLanes);
    push(currentTreeHiddenStackCursor, currentTreeHiddenStackCursor.current);
  }
  function popHiddenContext() {
    entangledRenderLanes = prevEntangledRenderLanesCursor.current;
    pop(currentTreeHiddenStackCursor);
    pop(prevEntangledRenderLanesCursor);
  }
  var suspenseHandlerStackCursor = createCursor(null), shellBoundary = null;
  function pushPrimaryTreeSuspenseHandler(handler) {
    var current = handler.alternate;
    push(suspenseStackCursor, suspenseStackCursor.current & 1);
    push(suspenseHandlerStackCursor, handler);
    null === shellBoundary && (null === current || null !== currentTreeHiddenStackCursor.current ? shellBoundary = handler : null !== current.memoizedState && (shellBoundary = handler));
  }
  function pushDehydratedActivitySuspenseHandler(fiber) {
    push(suspenseStackCursor, suspenseStackCursor.current);
    push(suspenseHandlerStackCursor, fiber);
    null === shellBoundary && (shellBoundary = fiber);
  }
  function pushOffscreenSuspenseHandler(fiber) {
    22 === fiber.tag ? (push(suspenseStackCursor, suspenseStackCursor.current), push(suspenseHandlerStackCursor, fiber), null === shellBoundary && (shellBoundary = fiber)) : reuseSuspenseHandlerOnStack();
  }
  function reuseSuspenseHandlerOnStack() {
    push(suspenseStackCursor, suspenseStackCursor.current);
    push(suspenseHandlerStackCursor, suspenseHandlerStackCursor.current);
  }
  function popSuspenseHandler(fiber) {
    pop(suspenseHandlerStackCursor);
    shellBoundary === fiber && (shellBoundary = null);
    pop(suspenseStackCursor);
  }
  var suspenseStackCursor = createCursor(0);
  function findFirstSuspended(row) {
    for (var node = row; null !== node; ) {
      if (13 === node.tag) {
        var state = node.memoizedState;
        if (null !== state && (state = state.dehydrated, null === state || isSuspenseInstancePending(state) || isSuspenseInstanceFallback(state)))
          return node;
      } else if (19 === node.tag && ("forwards" === node.memoizedProps.revealOrder || "backwards" === node.memoizedProps.revealOrder || "unstable_legacy-backwards" === node.memoizedProps.revealOrder || "together" === node.memoizedProps.revealOrder)) {
        if (0 !== (node.flags & 128)) return node;
      } else if (null !== node.child) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === row) break;
      for (; null === node.sibling; ) {
        if (null === node.return || node.return === row) return null;
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
    return null;
  }
  var renderLanes = 0, currentlyRenderingFiber = null, currentHook = null, workInProgressHook = null, didScheduleRenderPhaseUpdate = false, didScheduleRenderPhaseUpdateDuringThisPass = false, shouldDoubleInvokeUserFnsInHooksDEV = false, localIdCounter = 0, thenableIndexCounter = 0, thenableState = null, globalClientIdCounter = 0;
  function throwInvalidHookError() {
    throw Error(formatProdErrorMessage(321));
  }
  function areHookInputsEqual(nextDeps, prevDeps) {
    if (null === prevDeps) return false;
    for (var i = 0; i < prevDeps.length && i < nextDeps.length; i++)
      if (!objectIs(nextDeps[i], prevDeps[i])) return false;
    return true;
  }
  function renderWithHooks(current, workInProgress2, Component, props, secondArg, nextRenderLanes) {
    renderLanes = nextRenderLanes;
    currentlyRenderingFiber = workInProgress2;
    workInProgress2.memoizedState = null;
    workInProgress2.updateQueue = null;
    workInProgress2.lanes = 0;
    ReactSharedInternals.H = null === current || null === current.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate;
    shouldDoubleInvokeUserFnsInHooksDEV = false;
    nextRenderLanes = Component(props, secondArg);
    shouldDoubleInvokeUserFnsInHooksDEV = false;
    didScheduleRenderPhaseUpdateDuringThisPass && (nextRenderLanes = renderWithHooksAgain(
      workInProgress2,
      Component,
      props,
      secondArg
    ));
    finishRenderingHooks(current);
    return nextRenderLanes;
  }
  function finishRenderingHooks(current) {
    ReactSharedInternals.H = ContextOnlyDispatcher;
    var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
    renderLanes = 0;
    workInProgressHook = currentHook = currentlyRenderingFiber = null;
    didScheduleRenderPhaseUpdate = false;
    thenableIndexCounter = 0;
    thenableState = null;
    if (didRenderTooFewHooks) throw Error(formatProdErrorMessage(300));
    null === current || didReceiveUpdate || (current = current.dependencies, null !== current && checkIfContextChanged(current) && (didReceiveUpdate = true));
  }
  function renderWithHooksAgain(workInProgress2, Component, props, secondArg) {
    currentlyRenderingFiber = workInProgress2;
    var numberOfReRenders = 0;
    do {
      didScheduleRenderPhaseUpdateDuringThisPass && (thenableState = null);
      thenableIndexCounter = 0;
      didScheduleRenderPhaseUpdateDuringThisPass = false;
      if (25 <= numberOfReRenders) throw Error(formatProdErrorMessage(301));
      numberOfReRenders += 1;
      workInProgressHook = currentHook = null;
      if (null != workInProgress2.updateQueue) {
        var children = workInProgress2.updateQueue;
        children.lastEffect = null;
        children.events = null;
        children.stores = null;
        null != children.memoCache && (children.memoCache.index = 0);
      }
      ReactSharedInternals.H = HooksDispatcherOnRerender;
      children = Component(props, secondArg);
    } while (didScheduleRenderPhaseUpdateDuringThisPass);
    return children;
  }
  function TransitionAwareHostComponent() {
    var dispatcher = ReactSharedInternals.H, maybeThenable = dispatcher.useState()[0];
    maybeThenable = "function" === typeof maybeThenable.then ? useThenable(maybeThenable) : maybeThenable;
    dispatcher = dispatcher.useState()[0];
    (null !== currentHook ? currentHook.memoizedState : null) !== dispatcher && (currentlyRenderingFiber.flags |= 1024);
    return maybeThenable;
  }
  function checkDidRenderIdHook() {
    var didRenderIdHook = 0 !== localIdCounter;
    localIdCounter = 0;
    return didRenderIdHook;
  }
  function bailoutHooks(current, workInProgress2, lanes) {
    workInProgress2.updateQueue = current.updateQueue;
    workInProgress2.flags &= -2053;
    current.lanes &= ~lanes;
  }
  function resetHooksOnUnwind(workInProgress2) {
    if (didScheduleRenderPhaseUpdate) {
      for (workInProgress2 = workInProgress2.memoizedState; null !== workInProgress2; ) {
        var queue = workInProgress2.queue;
        null !== queue && (queue.pending = null);
        workInProgress2 = workInProgress2.next;
      }
      didScheduleRenderPhaseUpdate = false;
    }
    renderLanes = 0;
    workInProgressHook = currentHook = currentlyRenderingFiber = null;
    didScheduleRenderPhaseUpdateDuringThisPass = false;
    thenableIndexCounter = localIdCounter = 0;
    thenableState = null;
  }
  function mountWorkInProgressHook() {
    var hook = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = hook : workInProgressHook = workInProgressHook.next = hook;
    return workInProgressHook;
  }
  function updateWorkInProgressHook() {
    if (null === currentHook) {
      var nextCurrentHook = currentlyRenderingFiber.alternate;
      nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
    } else nextCurrentHook = currentHook.next;
    var nextWorkInProgressHook = null === workInProgressHook ? currentlyRenderingFiber.memoizedState : workInProgressHook.next;
    if (null !== nextWorkInProgressHook)
      workInProgressHook = nextWorkInProgressHook, currentHook = nextCurrentHook;
    else {
      if (null === nextCurrentHook) {
        if (null === currentlyRenderingFiber.alternate)
          throw Error(formatProdErrorMessage(467));
        throw Error(formatProdErrorMessage(310));
      }
      currentHook = nextCurrentHook;
      nextCurrentHook = {
        memoizedState: currentHook.memoizedState,
        baseState: currentHook.baseState,
        baseQueue: currentHook.baseQueue,
        queue: currentHook.queue,
        next: null
      };
      null === workInProgressHook ? currentlyRenderingFiber.memoizedState = workInProgressHook = nextCurrentHook : workInProgressHook = workInProgressHook.next = nextCurrentHook;
    }
    return workInProgressHook;
  }
  function createFunctionComponentUpdateQueue() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function useThenable(thenable) {
    var index2 = thenableIndexCounter;
    thenableIndexCounter += 1;
    null === thenableState && (thenableState = []);
    thenable = trackUsedThenable(thenableState, thenable, index2);
    index2 = currentlyRenderingFiber;
    null === (null === workInProgressHook ? index2.memoizedState : workInProgressHook.next) && (index2 = index2.alternate, ReactSharedInternals.H = null === index2 || null === index2.memoizedState ? HooksDispatcherOnMount : HooksDispatcherOnUpdate);
    return thenable;
  }
  function use(usable) {
    if (null !== usable && "object" === typeof usable) {
      if ("function" === typeof usable.then) return useThenable(usable);
      if (usable.$$typeof === REACT_CONTEXT_TYPE) return readContext(usable);
    }
    throw Error(formatProdErrorMessage(438, String(usable)));
  }
  function useMemoCache(size) {
    var memoCache = null, updateQueue = currentlyRenderingFiber.updateQueue;
    null !== updateQueue && (memoCache = updateQueue.memoCache);
    if (null == memoCache) {
      var current = currentlyRenderingFiber.alternate;
      null !== current && (current = current.updateQueue, null !== current && (current = current.memoCache, null != current && (memoCache = {
        data: current.data.map(function(array) {
          return array.slice();
        }),
        index: 0
      })));
    }
    null == memoCache && (memoCache = { data: [], index: 0 });
    null === updateQueue && (updateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = updateQueue);
    updateQueue.memoCache = memoCache;
    updateQueue = memoCache.data[memoCache.index];
    if (void 0 === updateQueue)
      for (updateQueue = memoCache.data[memoCache.index] = Array(size), current = 0; current < size; current++)
        updateQueue[current] = REACT_MEMO_CACHE_SENTINEL;
    memoCache.index++;
    return updateQueue;
  }
  function basicStateReducer(state, action) {
    return "function" === typeof action ? action(state) : action;
  }
  function updateReducer(reducer) {
    var hook = updateWorkInProgressHook();
    return updateReducerImpl(hook, currentHook, reducer);
  }
  function updateReducerImpl(hook, current, reducer) {
    var queue = hook.queue;
    if (null === queue) throw Error(formatProdErrorMessage(311));
    queue.lastRenderedReducer = reducer;
    var baseQueue = hook.baseQueue, pendingQueue = queue.pending;
    if (null !== pendingQueue) {
      if (null !== baseQueue) {
        var baseFirst = baseQueue.next;
        baseQueue.next = pendingQueue.next;
        pendingQueue.next = baseFirst;
      }
      current.baseQueue = baseQueue = pendingQueue;
      queue.pending = null;
    }
    pendingQueue = hook.baseState;
    if (null === baseQueue) hook.memoizedState = pendingQueue;
    else {
      current = baseQueue.next;
      var newBaseQueueFirst = baseFirst = null, newBaseQueueLast = null, update = current, didReadFromEntangledAsyncAction$60 = false;
      do {
        var updateLane = update.lane & -536870913;
        if (updateLane !== update.lane ? (workInProgressRootRenderLanes & updateLane) === updateLane : (renderLanes & updateLane) === updateLane) {
          var revertLane = update.revertLane;
          if (0 === revertLane)
            null !== newBaseQueueLast && (newBaseQueueLast = newBaseQueueLast.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: update.action,
              hasEagerState: update.hasEagerState,
              eagerState: update.eagerState,
              next: null
            }), updateLane === currentEntangledLane && (didReadFromEntangledAsyncAction$60 = true);
          else if ((renderLanes & revertLane) === revertLane) {
            update = update.next;
            revertLane === currentEntangledLane && (didReadFromEntangledAsyncAction$60 = true);
            continue;
          } else
            updateLane = {
              lane: 0,
              revertLane: update.revertLane,
              gesture: null,
              action: update.action,
              hasEagerState: update.hasEagerState,
              eagerState: update.eagerState,
              next: null
            }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = updateLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = updateLane, currentlyRenderingFiber.lanes |= revertLane, workInProgressRootSkippedLanes |= revertLane;
          updateLane = update.action;
          shouldDoubleInvokeUserFnsInHooksDEV && reducer(pendingQueue, updateLane);
          pendingQueue = update.hasEagerState ? update.eagerState : reducer(pendingQueue, updateLane);
        } else
          revertLane = {
            lane: updateLane,
            revertLane: update.revertLane,
            gesture: update.gesture,
            action: update.action,
            hasEagerState: update.hasEagerState,
            eagerState: update.eagerState,
            next: null
          }, null === newBaseQueueLast ? (newBaseQueueFirst = newBaseQueueLast = revertLane, baseFirst = pendingQueue) : newBaseQueueLast = newBaseQueueLast.next = revertLane, currentlyRenderingFiber.lanes |= updateLane, workInProgressRootSkippedLanes |= updateLane;
        update = update.next;
      } while (null !== update && update !== current);
      null === newBaseQueueLast ? baseFirst = pendingQueue : newBaseQueueLast.next = newBaseQueueFirst;
      if (!objectIs(pendingQueue, hook.memoizedState) && (didReceiveUpdate = true, didReadFromEntangledAsyncAction$60 && (reducer = currentEntangledActionThenable, null !== reducer)))
        throw reducer;
      hook.memoizedState = pendingQueue;
      hook.baseState = baseFirst;
      hook.baseQueue = newBaseQueueLast;
      queue.lastRenderedState = pendingQueue;
    }
    null === baseQueue && (queue.lanes = 0);
    return [hook.memoizedState, queue.dispatch];
  }
  function rerenderReducer(reducer) {
    var hook = updateWorkInProgressHook(), queue = hook.queue;
    if (null === queue) throw Error(formatProdErrorMessage(311));
    queue.lastRenderedReducer = reducer;
    var dispatch = queue.dispatch, lastRenderPhaseUpdate = queue.pending, newState = hook.memoizedState;
    if (null !== lastRenderPhaseUpdate) {
      queue.pending = null;
      var update = lastRenderPhaseUpdate = lastRenderPhaseUpdate.next;
      do
        newState = reducer(newState, update.action), update = update.next;
      while (update !== lastRenderPhaseUpdate);
      objectIs(newState, hook.memoizedState) || (didReceiveUpdate = true);
      hook.memoizedState = newState;
      null === hook.baseQueue && (hook.baseState = newState);
      queue.lastRenderedState = newState;
    }
    return [newState, dispatch];
  }
  function updateSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    var fiber = currentlyRenderingFiber, hook = updateWorkInProgressHook(), isHydrating$jscomp$0 = isHydrating;
    if (isHydrating$jscomp$0) {
      if (void 0 === getServerSnapshot) throw Error(formatProdErrorMessage(407));
      getServerSnapshot = getServerSnapshot();
    } else getServerSnapshot = getSnapshot();
    var snapshotChanged = !objectIs(
      (currentHook || hook).memoizedState,
      getServerSnapshot
    );
    snapshotChanged && (hook.memoizedState = getServerSnapshot, didReceiveUpdate = true);
    hook = hook.queue;
    updateEffect(subscribeToStore.bind(null, fiber, hook, subscribe), [
      subscribe
    ]);
    if (hook.getSnapshot !== getSnapshot || snapshotChanged || null !== workInProgressHook && workInProgressHook.memoizedState.tag & 1) {
      fiber.flags |= 2048;
      pushSimpleEffect(
        9,
        { destroy: void 0 },
        updateStoreInstance.bind(
          null,
          fiber,
          hook,
          getServerSnapshot,
          getSnapshot
        ),
        null
      );
      if (null === workInProgressRoot) throw Error(formatProdErrorMessage(349));
      isHydrating$jscomp$0 || 0 !== (renderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
    }
    return getServerSnapshot;
  }
  function pushStoreConsistencyCheck(fiber, getSnapshot, renderedSnapshot) {
    fiber.flags |= 16384;
    fiber = { getSnapshot, value: renderedSnapshot };
    getSnapshot = currentlyRenderingFiber.updateQueue;
    null === getSnapshot ? (getSnapshot = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = getSnapshot, getSnapshot.stores = [fiber]) : (renderedSnapshot = getSnapshot.stores, null === renderedSnapshot ? getSnapshot.stores = [fiber] : renderedSnapshot.push(fiber));
  }
  function updateStoreInstance(fiber, inst, nextSnapshot, getSnapshot) {
    inst.value = nextSnapshot;
    inst.getSnapshot = getSnapshot;
    checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
  }
  function subscribeToStore(fiber, inst, subscribe) {
    return subscribe(function() {
      checkIfSnapshotChanged(inst) && forceStoreRerender(fiber);
    });
  }
  function checkIfSnapshotChanged(inst) {
    var latestGetSnapshot = inst.getSnapshot;
    inst = inst.value;
    try {
      var nextValue = latestGetSnapshot();
      return !objectIs(inst, nextValue);
    } catch (error) {
      return true;
    }
  }
  function forceStoreRerender(fiber) {
    var root2 = enqueueConcurrentRenderForLane(fiber, 2);
    null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2);
  }
  function mountStateImpl(initialState) {
    var hook = mountWorkInProgressHook();
    if ("function" === typeof initialState) {
      var initialStateInitializer = initialState;
      initialState = initialStateInitializer();
      if (shouldDoubleInvokeUserFnsInHooksDEV) {
        setIsStrictModeForDevtools(true);
        try {
          initialStateInitializer();
        } finally {
          setIsStrictModeForDevtools(false);
        }
      }
    }
    hook.memoizedState = hook.baseState = initialState;
    hook.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: basicStateReducer,
      lastRenderedState: initialState
    };
    return hook;
  }
  function updateOptimisticImpl(hook, current, passthrough, reducer) {
    hook.baseState = passthrough;
    return updateReducerImpl(
      hook,
      currentHook,
      "function" === typeof reducer ? reducer : basicStateReducer
    );
  }
  function dispatchActionState(fiber, actionQueue, setPendingState, setState, payload) {
    if (isRenderPhaseUpdate(fiber)) throw Error(formatProdErrorMessage(485));
    fiber = actionQueue.action;
    if (null !== fiber) {
      var actionNode = {
        payload,
        action: fiber,
        next: null,
        isTransition: true,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(listener) {
          actionNode.listeners.push(listener);
        }
      };
      null !== ReactSharedInternals.T ? setPendingState(true) : actionNode.isTransition = false;
      setState(actionNode);
      setPendingState = actionQueue.pending;
      null === setPendingState ? (actionNode.next = actionQueue.pending = actionNode, runActionStateAction(actionQueue, actionNode)) : (actionNode.next = setPendingState.next, actionQueue.pending = setPendingState.next = actionNode);
    }
  }
  function runActionStateAction(actionQueue, node) {
    var action = node.action, payload = node.payload, prevState = actionQueue.state;
    if (node.isTransition) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = action(prevState, payload), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        handleActionReturnValue(actionQueue, node, returnValue);
      } catch (error) {
        onActionError(actionQueue, node, error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    } else
      try {
        prevTransition = action(prevState, payload), handleActionReturnValue(actionQueue, node, prevTransition);
      } catch (error$66) {
        onActionError(actionQueue, node, error$66);
      }
  }
  function handleActionReturnValue(actionQueue, node, returnValue) {
    null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then ? returnValue.then(
      function(nextState) {
        onActionSuccess(actionQueue, node, nextState);
      },
      function(error) {
        return onActionError(actionQueue, node, error);
      }
    ) : onActionSuccess(actionQueue, node, returnValue);
  }
  function onActionSuccess(actionQueue, actionNode, nextState) {
    actionNode.status = "fulfilled";
    actionNode.value = nextState;
    notifyActionListeners(actionNode);
    actionQueue.state = nextState;
    actionNode = actionQueue.pending;
    null !== actionNode && (nextState = actionNode.next, nextState === actionNode ? actionQueue.pending = null : (nextState = nextState.next, actionNode.next = nextState, runActionStateAction(actionQueue, nextState)));
  }
  function onActionError(actionQueue, actionNode, error) {
    var last = actionQueue.pending;
    actionQueue.pending = null;
    if (null !== last) {
      last = last.next;
      do
        actionNode.status = "rejected", actionNode.reason = error, notifyActionListeners(actionNode), actionNode = actionNode.next;
      while (actionNode !== last);
    }
    actionQueue.action = null;
  }
  function notifyActionListeners(actionNode) {
    actionNode = actionNode.listeners;
    for (var i = 0; i < actionNode.length; i++) (0, actionNode[i])();
  }
  function actionStateReducer(oldState, newState) {
    return newState;
  }
  function mountActionState(action, initialStateProp) {
    if (isHydrating) {
      var ssrFormState = workInProgressRoot.formState;
      if (null !== ssrFormState) {
        a: {
          var JSCompiler_inline_result = currentlyRenderingFiber;
          if (isHydrating) {
            if (nextHydratableInstance) {
              b: {
                var JSCompiler_inline_result$jscomp$0 = nextHydratableInstance;
                for (var inRootOrSingleton = rootOrSingletonContext; 8 !== JSCompiler_inline_result$jscomp$0.nodeType; ) {
                  if (!inRootOrSingleton) {
                    JSCompiler_inline_result$jscomp$0 = null;
                    break b;
                  }
                  JSCompiler_inline_result$jscomp$0 = getNextHydratable(
                    JSCompiler_inline_result$jscomp$0.nextSibling
                  );
                  if (null === JSCompiler_inline_result$jscomp$0) {
                    JSCompiler_inline_result$jscomp$0 = null;
                    break b;
                  }
                }
                inRootOrSingleton = JSCompiler_inline_result$jscomp$0.data;
                JSCompiler_inline_result$jscomp$0 = "F!" === inRootOrSingleton || "F" === inRootOrSingleton ? JSCompiler_inline_result$jscomp$0 : null;
              }
              if (JSCompiler_inline_result$jscomp$0) {
                nextHydratableInstance = getNextHydratable(
                  JSCompiler_inline_result$jscomp$0.nextSibling
                );
                JSCompiler_inline_result = "F!" === JSCompiler_inline_result$jscomp$0.data;
                break a;
              }
            }
            throwOnHydrationMismatch(JSCompiler_inline_result);
          }
          JSCompiler_inline_result = false;
        }
        JSCompiler_inline_result && (initialStateProp = ssrFormState[0]);
      }
    }
    ssrFormState = mountWorkInProgressHook();
    ssrFormState.memoizedState = ssrFormState.baseState = initialStateProp;
    JSCompiler_inline_result = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: actionStateReducer,
      lastRenderedState: initialStateProp
    };
    ssrFormState.queue = JSCompiler_inline_result;
    ssrFormState = dispatchSetState.bind(
      null,
      currentlyRenderingFiber,
      JSCompiler_inline_result
    );
    JSCompiler_inline_result.dispatch = ssrFormState;
    JSCompiler_inline_result = mountStateImpl(false);
    inRootOrSingleton = dispatchOptimisticSetState.bind(
      null,
      currentlyRenderingFiber,
      false,
      JSCompiler_inline_result.queue
    );
    JSCompiler_inline_result = mountWorkInProgressHook();
    JSCompiler_inline_result$jscomp$0 = {
      state: initialStateProp,
      dispatch: null,
      action,
      pending: null
    };
    JSCompiler_inline_result.queue = JSCompiler_inline_result$jscomp$0;
    ssrFormState = dispatchActionState.bind(
      null,
      currentlyRenderingFiber,
      JSCompiler_inline_result$jscomp$0,
      inRootOrSingleton,
      ssrFormState
    );
    JSCompiler_inline_result$jscomp$0.dispatch = ssrFormState;
    JSCompiler_inline_result.memoizedState = action;
    return [initialStateProp, ssrFormState, false];
  }
  function updateActionState(action) {
    var stateHook = updateWorkInProgressHook();
    return updateActionStateImpl(stateHook, currentHook, action);
  }
  function updateActionStateImpl(stateHook, currentStateHook, action) {
    currentStateHook = updateReducerImpl(
      stateHook,
      currentStateHook,
      actionStateReducer
    )[0];
    stateHook = updateReducer(basicStateReducer)[0];
    if ("object" === typeof currentStateHook && null !== currentStateHook && "function" === typeof currentStateHook.then)
      try {
        var state = useThenable(currentStateHook);
      } catch (x) {
        if (x === SuspenseException) throw SuspenseActionException;
        throw x;
      }
    else state = currentStateHook;
    currentStateHook = updateWorkInProgressHook();
    var actionQueue = currentStateHook.queue, dispatch = actionQueue.dispatch;
    action !== currentStateHook.memoizedState && (currentlyRenderingFiber.flags |= 2048, pushSimpleEffect(
      9,
      { destroy: void 0 },
      actionStateActionEffect.bind(null, actionQueue, action),
      null
    ));
    return [state, dispatch, stateHook];
  }
  function actionStateActionEffect(actionQueue, action) {
    actionQueue.action = action;
  }
  function rerenderActionState(action) {
    var stateHook = updateWorkInProgressHook(), currentStateHook = currentHook;
    if (null !== currentStateHook)
      return updateActionStateImpl(stateHook, currentStateHook, action);
    updateWorkInProgressHook();
    stateHook = stateHook.memoizedState;
    currentStateHook = updateWorkInProgressHook();
    var dispatch = currentStateHook.queue.dispatch;
    currentStateHook.memoizedState = action;
    return [stateHook, dispatch, false];
  }
  function pushSimpleEffect(tag, inst, create, deps) {
    tag = { tag, create, deps, inst, next: null };
    inst = currentlyRenderingFiber.updateQueue;
    null === inst && (inst = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = inst);
    create = inst.lastEffect;
    null === create ? inst.lastEffect = tag.next = tag : (deps = create.next, create.next = tag, tag.next = deps, inst.lastEffect = tag);
    return tag;
  }
  function updateRef() {
    return updateWorkInProgressHook().memoizedState;
  }
  function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
    var hook = mountWorkInProgressHook();
    currentlyRenderingFiber.flags |= fiberFlags;
    hook.memoizedState = pushSimpleEffect(
      1 | hookFlags,
      { destroy: void 0 },
      create,
      void 0 === deps ? null : deps
    );
  }
  function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
    var hook = updateWorkInProgressHook();
    deps = void 0 === deps ? null : deps;
    var inst = hook.memoizedState.inst;
    null !== currentHook && null !== deps && areHookInputsEqual(deps, currentHook.memoizedState.deps) ? hook.memoizedState = pushSimpleEffect(hookFlags, inst, create, deps) : (currentlyRenderingFiber.flags |= fiberFlags, hook.memoizedState = pushSimpleEffect(
      1 | hookFlags,
      inst,
      create,
      deps
    ));
  }
  function mountEffect(create, deps) {
    mountEffectImpl(8390656, 8, create, deps);
  }
  function updateEffect(create, deps) {
    updateEffectImpl(2048, 8, create, deps);
  }
  function useEffectEventImpl(payload) {
    currentlyRenderingFiber.flags |= 4;
    var componentUpdateQueue = currentlyRenderingFiber.updateQueue;
    if (null === componentUpdateQueue)
      componentUpdateQueue = createFunctionComponentUpdateQueue(), currentlyRenderingFiber.updateQueue = componentUpdateQueue, componentUpdateQueue.events = [payload];
    else {
      var events = componentUpdateQueue.events;
      null === events ? componentUpdateQueue.events = [payload] : events.push(payload);
    }
  }
  function updateEvent(callback) {
    var ref = updateWorkInProgressHook().memoizedState;
    useEffectEventImpl({ ref, nextImpl: callback });
    return function() {
      if (0 !== (executionContext & 2)) throw Error(formatProdErrorMessage(440));
      return ref.impl.apply(void 0, arguments);
    };
  }
  function updateInsertionEffect(create, deps) {
    return updateEffectImpl(4, 2, create, deps);
  }
  function updateLayoutEffect(create, deps) {
    return updateEffectImpl(4, 4, create, deps);
  }
  function imperativeHandleEffect(create, ref) {
    if ("function" === typeof ref) {
      create = create();
      var refCleanup = ref(create);
      return function() {
        "function" === typeof refCleanup ? refCleanup() : ref(null);
      };
    }
    if (null !== ref && void 0 !== ref)
      return create = create(), ref.current = create, function() {
        ref.current = null;
      };
  }
  function updateImperativeHandle(ref, create, deps) {
    deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
    updateEffectImpl(4, 4, imperativeHandleEffect.bind(null, create, ref), deps);
  }
  function mountDebugValue() {
  }
  function updateCallback(callback, deps) {
    var hook = updateWorkInProgressHook();
    deps = void 0 === deps ? null : deps;
    var prevState = hook.memoizedState;
    if (null !== deps && areHookInputsEqual(deps, prevState[1]))
      return prevState[0];
    hook.memoizedState = [callback, deps];
    return callback;
  }
  function updateMemo(nextCreate, deps) {
    var hook = updateWorkInProgressHook();
    deps = void 0 === deps ? null : deps;
    var prevState = hook.memoizedState;
    if (null !== deps && areHookInputsEqual(deps, prevState[1]))
      return prevState[0];
    prevState = nextCreate();
    if (shouldDoubleInvokeUserFnsInHooksDEV) {
      setIsStrictModeForDevtools(true);
      try {
        nextCreate();
      } finally {
        setIsStrictModeForDevtools(false);
      }
    }
    hook.memoizedState = [prevState, deps];
    return prevState;
  }
  function mountDeferredValueImpl(hook, value, initialValue) {
    if (void 0 === initialValue || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
      return hook.memoizedState = value;
    hook.memoizedState = initialValue;
    hook = requestDeferredLane();
    currentlyRenderingFiber.lanes |= hook;
    workInProgressRootSkippedLanes |= hook;
    return initialValue;
  }
  function updateDeferredValueImpl(hook, prevValue, value, initialValue) {
    if (objectIs(value, prevValue)) return value;
    if (null !== currentTreeHiddenStackCursor.current)
      return hook = mountDeferredValueImpl(hook, value, initialValue), objectIs(hook, prevValue) || (didReceiveUpdate = true), hook;
    if (0 === (renderLanes & 42) || 0 !== (renderLanes & 1073741824) && 0 === (workInProgressRootRenderLanes & 261930))
      return didReceiveUpdate = true, hook.memoizedState = value;
    hook = requestDeferredLane();
    currentlyRenderingFiber.lanes |= hook;
    workInProgressRootSkippedLanes |= hook;
    return prevValue;
  }
  function startTransition(fiber, queue, pendingState, finishedState, callback) {
    var previousPriority = ReactDOMSharedInternals.p;
    ReactDOMSharedInternals.p = 0 !== previousPriority && 8 > previousPriority ? previousPriority : 8;
    var prevTransition = ReactSharedInternals.T, currentTransition = {};
    ReactSharedInternals.T = currentTransition;
    dispatchOptimisticSetState(fiber, false, queue, pendingState);
    try {
      var returnValue = callback(), onStartTransitionFinish = ReactSharedInternals.S;
      null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
      if (null !== returnValue && "object" === typeof returnValue && "function" === typeof returnValue.then) {
        var thenableForFinishedState = chainThenableValue(
          returnValue,
          finishedState
        );
        dispatchSetStateInternal(
          fiber,
          queue,
          thenableForFinishedState,
          requestUpdateLane(fiber)
        );
      } else
        dispatchSetStateInternal(
          fiber,
          queue,
          finishedState,
          requestUpdateLane(fiber)
        );
    } catch (error) {
      dispatchSetStateInternal(
        fiber,
        queue,
        { then: function() {
        }, status: "rejected", reason: error },
        requestUpdateLane()
      );
    } finally {
      ReactDOMSharedInternals.p = previousPriority, null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
    }
  }
  function noop() {
  }
  function startHostTransition(formFiber, pendingState, action, formData) {
    if (5 !== formFiber.tag) throw Error(formatProdErrorMessage(476));
    var queue = ensureFormComponentIsStateful(formFiber).queue;
    startTransition(
      formFiber,
      queue,
      pendingState,
      sharedNotPendingObject,
      null === action ? noop : function() {
        requestFormReset$1(formFiber);
        return action(formData);
      }
    );
  }
  function ensureFormComponentIsStateful(formFiber) {
    var existingStateHook = formFiber.memoizedState;
    if (null !== existingStateHook) return existingStateHook;
    existingStateHook = {
      memoizedState: sharedNotPendingObject,
      baseState: sharedNotPendingObject,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: basicStateReducer,
        lastRenderedState: sharedNotPendingObject
      },
      next: null
    };
    var initialResetState = {};
    existingStateHook.next = {
      memoizedState: initialResetState,
      baseState: initialResetState,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: basicStateReducer,
        lastRenderedState: initialResetState
      },
      next: null
    };
    formFiber.memoizedState = existingStateHook;
    formFiber = formFiber.alternate;
    null !== formFiber && (formFiber.memoizedState = existingStateHook);
    return existingStateHook;
  }
  function requestFormReset$1(formFiber) {
    var stateHook = ensureFormComponentIsStateful(formFiber);
    null === stateHook.next && (stateHook = formFiber.alternate.memoizedState);
    dispatchSetStateInternal(
      formFiber,
      stateHook.next.queue,
      {},
      requestUpdateLane()
    );
  }
  function useHostTransitionStatus() {
    return readContext(HostTransitionContext);
  }
  function updateId() {
    return updateWorkInProgressHook().memoizedState;
  }
  function updateRefresh() {
    return updateWorkInProgressHook().memoizedState;
  }
  function refreshCache(fiber) {
    for (var provider = fiber.return; null !== provider; ) {
      switch (provider.tag) {
        case 24:
        case 3:
          var lane = requestUpdateLane();
          fiber = createUpdate(lane);
          var root$69 = enqueueUpdate(provider, fiber, lane);
          null !== root$69 && (scheduleUpdateOnFiber(root$69, provider, lane), entangleTransitions(root$69, provider, lane));
          provider = { cache: createCache() };
          fiber.payload = provider;
          return;
      }
      provider = provider.return;
    }
  }
  function dispatchReducerAction(fiber, queue, action) {
    var lane = requestUpdateLane();
    action = {
      lane,
      revertLane: 0,
      gesture: null,
      action,
      hasEagerState: false,
      eagerState: null,
      next: null
    };
    isRenderPhaseUpdate(fiber) ? enqueueRenderPhaseUpdate(queue, action) : (action = enqueueConcurrentHookUpdate(fiber, queue, action, lane), null !== action && (scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane)));
  }
  function dispatchSetState(fiber, queue, action) {
    var lane = requestUpdateLane();
    dispatchSetStateInternal(fiber, queue, action, lane);
  }
  function dispatchSetStateInternal(fiber, queue, action, lane) {
    var update = {
      lane,
      revertLane: 0,
      gesture: null,
      action,
      hasEagerState: false,
      eagerState: null,
      next: null
    };
    if (isRenderPhaseUpdate(fiber)) enqueueRenderPhaseUpdate(queue, update);
    else {
      var alternate = fiber.alternate;
      if (0 === fiber.lanes && (null === alternate || 0 === alternate.lanes) && (alternate = queue.lastRenderedReducer, null !== alternate))
        try {
          var currentState = queue.lastRenderedState, eagerState = alternate(currentState, action);
          update.hasEagerState = true;
          update.eagerState = eagerState;
          if (objectIs(eagerState, currentState))
            return enqueueUpdate$1(fiber, queue, update, 0), null === workInProgressRoot && finishQueueingConcurrentUpdates(), false;
        } catch (error) {
        } finally {
        }
      action = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
      if (null !== action)
        return scheduleUpdateOnFiber(action, fiber, lane), entangleTransitionUpdate(action, queue, lane), true;
    }
    return false;
  }
  function dispatchOptimisticSetState(fiber, throwIfDuringRender, queue, action) {
    action = {
      lane: 2,
      revertLane: requestTransitionLane(),
      gesture: null,
      action,
      hasEagerState: false,
      eagerState: null,
      next: null
    };
    if (isRenderPhaseUpdate(fiber)) {
      if (throwIfDuringRender) throw Error(formatProdErrorMessage(479));
    } else
      throwIfDuringRender = enqueueConcurrentHookUpdate(
        fiber,
        queue,
        action,
        2
      ), null !== throwIfDuringRender && scheduleUpdateOnFiber(throwIfDuringRender, fiber, 2);
  }
  function isRenderPhaseUpdate(fiber) {
    var alternate = fiber.alternate;
    return fiber === currentlyRenderingFiber || null !== alternate && alternate === currentlyRenderingFiber;
  }
  function enqueueRenderPhaseUpdate(queue, update) {
    didScheduleRenderPhaseUpdateDuringThisPass = didScheduleRenderPhaseUpdate = true;
    var pending = queue.pending;
    null === pending ? update.next = update : (update.next = pending.next, pending.next = update);
    queue.pending = update;
  }
  function entangleTransitionUpdate(root2, queue, lane) {
    if (0 !== (lane & 4194048)) {
      var queueLanes = queue.lanes;
      queueLanes &= root2.pendingLanes;
      lane |= queueLanes;
      queue.lanes = lane;
      markRootEntangled(root2, lane);
    }
  }
  var ContextOnlyDispatcher = {
    readContext,
    use,
    useCallback: throwInvalidHookError,
    useContext: throwInvalidHookError,
    useEffect: throwInvalidHookError,
    useImperativeHandle: throwInvalidHookError,
    useLayoutEffect: throwInvalidHookError,
    useInsertionEffect: throwInvalidHookError,
    useMemo: throwInvalidHookError,
    useReducer: throwInvalidHookError,
    useRef: throwInvalidHookError,
    useState: throwInvalidHookError,
    useDebugValue: throwInvalidHookError,
    useDeferredValue: throwInvalidHookError,
    useTransition: throwInvalidHookError,
    useSyncExternalStore: throwInvalidHookError,
    useId: throwInvalidHookError,
    useHostTransitionStatus: throwInvalidHookError,
    useFormState: throwInvalidHookError,
    useActionState: throwInvalidHookError,
    useOptimistic: throwInvalidHookError,
    useMemoCache: throwInvalidHookError,
    useCacheRefresh: throwInvalidHookError
  };
  ContextOnlyDispatcher.useEffectEvent = throwInvalidHookError;
  var HooksDispatcherOnMount = {
    readContext,
    use,
    useCallback: function(callback, deps) {
      mountWorkInProgressHook().memoizedState = [
        callback,
        void 0 === deps ? null : deps
      ];
      return callback;
    },
    useContext: readContext,
    useEffect: mountEffect,
    useImperativeHandle: function(ref, create, deps) {
      deps = null !== deps && void 0 !== deps ? deps.concat([ref]) : null;
      mountEffectImpl(
        4194308,
        4,
        imperativeHandleEffect.bind(null, create, ref),
        deps
      );
    },
    useLayoutEffect: function(create, deps) {
      return mountEffectImpl(4194308, 4, create, deps);
    },
    useInsertionEffect: function(create, deps) {
      mountEffectImpl(4, 2, create, deps);
    },
    useMemo: function(nextCreate, deps) {
      var hook = mountWorkInProgressHook();
      deps = void 0 === deps ? null : deps;
      var nextValue = nextCreate();
      if (shouldDoubleInvokeUserFnsInHooksDEV) {
        setIsStrictModeForDevtools(true);
        try {
          nextCreate();
        } finally {
          setIsStrictModeForDevtools(false);
        }
      }
      hook.memoizedState = [nextValue, deps];
      return nextValue;
    },
    useReducer: function(reducer, initialArg, init) {
      var hook = mountWorkInProgressHook();
      if (void 0 !== init) {
        var initialState = init(initialArg);
        if (shouldDoubleInvokeUserFnsInHooksDEV) {
          setIsStrictModeForDevtools(true);
          try {
            init(initialArg);
          } finally {
            setIsStrictModeForDevtools(false);
          }
        }
      } else initialState = initialArg;
      hook.memoizedState = hook.baseState = initialState;
      reducer = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: reducer,
        lastRenderedState: initialState
      };
      hook.queue = reducer;
      reducer = reducer.dispatch = dispatchReducerAction.bind(
        null,
        currentlyRenderingFiber,
        reducer
      );
      return [hook.memoizedState, reducer];
    },
    useRef: function(initialValue) {
      var hook = mountWorkInProgressHook();
      initialValue = { current: initialValue };
      return hook.memoizedState = initialValue;
    },
    useState: function(initialState) {
      initialState = mountStateImpl(initialState);
      var queue = initialState.queue, dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
      queue.dispatch = dispatch;
      return [initialState.memoizedState, dispatch];
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = mountWorkInProgressHook();
      return mountDeferredValueImpl(hook, value, initialValue);
    },
    useTransition: function() {
      var stateHook = mountStateImpl(false);
      stateHook = startTransition.bind(
        null,
        currentlyRenderingFiber,
        stateHook.queue,
        true,
        false
      );
      mountWorkInProgressHook().memoizedState = stateHook;
      return [false, stateHook];
    },
    useSyncExternalStore: function(subscribe, getSnapshot, getServerSnapshot) {
      var fiber = currentlyRenderingFiber, hook = mountWorkInProgressHook();
      if (isHydrating) {
        if (void 0 === getServerSnapshot)
          throw Error(formatProdErrorMessage(407));
        getServerSnapshot = getServerSnapshot();
      } else {
        getServerSnapshot = getSnapshot();
        if (null === workInProgressRoot)
          throw Error(formatProdErrorMessage(349));
        0 !== (workInProgressRootRenderLanes & 127) || pushStoreConsistencyCheck(fiber, getSnapshot, getServerSnapshot);
      }
      hook.memoizedState = getServerSnapshot;
      var inst = { value: getServerSnapshot, getSnapshot };
      hook.queue = inst;
      mountEffect(subscribeToStore.bind(null, fiber, inst, subscribe), [
        subscribe
      ]);
      fiber.flags |= 2048;
      pushSimpleEffect(
        9,
        { destroy: void 0 },
        updateStoreInstance.bind(
          null,
          fiber,
          inst,
          getServerSnapshot,
          getSnapshot
        ),
        null
      );
      return getServerSnapshot;
    },
    useId: function() {
      var hook = mountWorkInProgressHook(), identifierPrefix = workInProgressRoot.identifierPrefix;
      if (isHydrating) {
        var JSCompiler_inline_result = treeContextOverflow;
        var idWithLeadingBit = treeContextId;
        JSCompiler_inline_result = (idWithLeadingBit & ~(1 << 32 - clz32(idWithLeadingBit) - 1)).toString(32) + JSCompiler_inline_result;
        identifierPrefix = "_" + identifierPrefix + "R_" + JSCompiler_inline_result;
        JSCompiler_inline_result = localIdCounter++;
        0 < JSCompiler_inline_result && (identifierPrefix += "H" + JSCompiler_inline_result.toString(32));
        identifierPrefix += "_";
      } else
        JSCompiler_inline_result = globalClientIdCounter++, identifierPrefix = "_" + identifierPrefix + "r_" + JSCompiler_inline_result.toString(32) + "_";
      return hook.memoizedState = identifierPrefix;
    },
    useHostTransitionStatus,
    useFormState: mountActionState,
    useActionState: mountActionState,
    useOptimistic: function(passthrough) {
      var hook = mountWorkInProgressHook();
      hook.memoizedState = hook.baseState = passthrough;
      var queue = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      hook.queue = queue;
      hook = dispatchOptimisticSetState.bind(
        null,
        currentlyRenderingFiber,
        true,
        queue
      );
      queue.dispatch = hook;
      return [passthrough, hook];
    },
    useMemoCache,
    useCacheRefresh: function() {
      return mountWorkInProgressHook().memoizedState = refreshCache.bind(
        null,
        currentlyRenderingFiber
      );
    },
    useEffectEvent: function(callback) {
      var hook = mountWorkInProgressHook(), ref = { impl: callback };
      hook.memoizedState = ref;
      return function() {
        if (0 !== (executionContext & 2))
          throw Error(formatProdErrorMessage(440));
        return ref.impl.apply(void 0, arguments);
      };
    }
  }, HooksDispatcherOnUpdate = {
    readContext,
    use,
    useCallback: updateCallback,
    useContext: readContext,
    useEffect: updateEffect,
    useImperativeHandle: updateImperativeHandle,
    useInsertionEffect: updateInsertionEffect,
    useLayoutEffect: updateLayoutEffect,
    useMemo: updateMemo,
    useReducer: updateReducer,
    useRef: updateRef,
    useState: function() {
      return updateReducer(basicStateReducer);
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = updateWorkInProgressHook();
      return updateDeferredValueImpl(
        hook,
        currentHook.memoizedState,
        value,
        initialValue
      );
    },
    useTransition: function() {
      var booleanOrThenable = updateReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
      return [
        "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
        start
      ];
    },
    useSyncExternalStore: updateSyncExternalStore,
    useId: updateId,
    useHostTransitionStatus,
    useFormState: updateActionState,
    useActionState: updateActionState,
    useOptimistic: function(passthrough, reducer) {
      var hook = updateWorkInProgressHook();
      return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
    },
    useMemoCache,
    useCacheRefresh: updateRefresh
  };
  HooksDispatcherOnUpdate.useEffectEvent = updateEvent;
  var HooksDispatcherOnRerender = {
    readContext,
    use,
    useCallback: updateCallback,
    useContext: readContext,
    useEffect: updateEffect,
    useImperativeHandle: updateImperativeHandle,
    useInsertionEffect: updateInsertionEffect,
    useLayoutEffect: updateLayoutEffect,
    useMemo: updateMemo,
    useReducer: rerenderReducer,
    useRef: updateRef,
    useState: function() {
      return rerenderReducer(basicStateReducer);
    },
    useDebugValue: mountDebugValue,
    useDeferredValue: function(value, initialValue) {
      var hook = updateWorkInProgressHook();
      return null === currentHook ? mountDeferredValueImpl(hook, value, initialValue) : updateDeferredValueImpl(
        hook,
        currentHook.memoizedState,
        value,
        initialValue
      );
    },
    useTransition: function() {
      var booleanOrThenable = rerenderReducer(basicStateReducer)[0], start = updateWorkInProgressHook().memoizedState;
      return [
        "boolean" === typeof booleanOrThenable ? booleanOrThenable : useThenable(booleanOrThenable),
        start
      ];
    },
    useSyncExternalStore: updateSyncExternalStore,
    useId: updateId,
    useHostTransitionStatus,
    useFormState: rerenderActionState,
    useActionState: rerenderActionState,
    useOptimistic: function(passthrough, reducer) {
      var hook = updateWorkInProgressHook();
      if (null !== currentHook)
        return updateOptimisticImpl(hook, currentHook, passthrough, reducer);
      hook.baseState = passthrough;
      return [passthrough, hook.queue.dispatch];
    },
    useMemoCache,
    useCacheRefresh: updateRefresh
  };
  HooksDispatcherOnRerender.useEffectEvent = updateEvent;
  function applyDerivedStateFromProps(workInProgress2, ctor, getDerivedStateFromProps, nextProps) {
    ctor = workInProgress2.memoizedState;
    getDerivedStateFromProps = getDerivedStateFromProps(nextProps, ctor);
    getDerivedStateFromProps = null === getDerivedStateFromProps || void 0 === getDerivedStateFromProps ? ctor : assign({}, ctor, getDerivedStateFromProps);
    workInProgress2.memoizedState = getDerivedStateFromProps;
    0 === workInProgress2.lanes && (workInProgress2.updateQueue.baseState = getDerivedStateFromProps);
  }
  var classComponentUpdater = {
    enqueueSetState: function(inst, payload, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.payload = payload;
      void 0 !== callback && null !== callback && (update.callback = callback);
      payload = enqueueUpdate(inst, update, lane);
      null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
    },
    enqueueReplaceState: function(inst, payload, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.tag = 1;
      update.payload = payload;
      void 0 !== callback && null !== callback && (update.callback = callback);
      payload = enqueueUpdate(inst, update, lane);
      null !== payload && (scheduleUpdateOnFiber(payload, inst, lane), entangleTransitions(payload, inst, lane));
    },
    enqueueForceUpdate: function(inst, callback) {
      inst = inst._reactInternals;
      var lane = requestUpdateLane(), update = createUpdate(lane);
      update.tag = 2;
      void 0 !== callback && null !== callback && (update.callback = callback);
      callback = enqueueUpdate(inst, update, lane);
      null !== callback && (scheduleUpdateOnFiber(callback, inst, lane), entangleTransitions(callback, inst, lane));
    }
  };
  function checkShouldComponentUpdate(workInProgress2, ctor, oldProps, newProps, oldState, newState, nextContext) {
    workInProgress2 = workInProgress2.stateNode;
    return "function" === typeof workInProgress2.shouldComponentUpdate ? workInProgress2.shouldComponentUpdate(newProps, newState, nextContext) : ctor.prototype && ctor.prototype.isPureReactComponent ? !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState) : true;
  }
  function callComponentWillReceiveProps(workInProgress2, instance, newProps, nextContext) {
    workInProgress2 = instance.state;
    "function" === typeof instance.componentWillReceiveProps && instance.componentWillReceiveProps(newProps, nextContext);
    "function" === typeof instance.UNSAFE_componentWillReceiveProps && instance.UNSAFE_componentWillReceiveProps(newProps, nextContext);
    instance.state !== workInProgress2 && classComponentUpdater.enqueueReplaceState(instance, instance.state, null);
  }
  function resolveClassComponentProps(Component, baseProps) {
    var newProps = baseProps;
    if ("ref" in baseProps) {
      newProps = {};
      for (var propName in baseProps)
        "ref" !== propName && (newProps[propName] = baseProps[propName]);
    }
    if (Component = Component.defaultProps) {
      newProps === baseProps && (newProps = assign({}, newProps));
      for (var propName$73 in Component)
        void 0 === newProps[propName$73] && (newProps[propName$73] = Component[propName$73]);
    }
    return newProps;
  }
  function defaultOnUncaughtError(error) {
    reportGlobalError(error);
  }
  function defaultOnCaughtError(error) {
    console.error(error);
  }
  function defaultOnRecoverableError(error) {
    reportGlobalError(error);
  }
  function logUncaughtError(root2, errorInfo) {
    try {
      var onUncaughtError = root2.onUncaughtError;
      onUncaughtError(errorInfo.value, { componentStack: errorInfo.stack });
    } catch (e$74) {
      setTimeout(function() {
        throw e$74;
      });
    }
  }
  function logCaughtError(root2, boundary, errorInfo) {
    try {
      var onCaughtError = root2.onCaughtError;
      onCaughtError(errorInfo.value, {
        componentStack: errorInfo.stack,
        errorBoundary: 1 === boundary.tag ? boundary.stateNode : null
      });
    } catch (e$75) {
      setTimeout(function() {
        throw e$75;
      });
    }
  }
  function createRootErrorUpdate(root2, errorInfo, lane) {
    lane = createUpdate(lane);
    lane.tag = 3;
    lane.payload = { element: null };
    lane.callback = function() {
      logUncaughtError(root2, errorInfo);
    };
    return lane;
  }
  function createClassErrorUpdate(lane) {
    lane = createUpdate(lane);
    lane.tag = 3;
    return lane;
  }
  function initializeClassErrorUpdate(update, root2, fiber, errorInfo) {
    var getDerivedStateFromError = fiber.type.getDerivedStateFromError;
    if ("function" === typeof getDerivedStateFromError) {
      var error = errorInfo.value;
      update.payload = function() {
        return getDerivedStateFromError(error);
      };
      update.callback = function() {
        logCaughtError(root2, fiber, errorInfo);
      };
    }
    var inst = fiber.stateNode;
    null !== inst && "function" === typeof inst.componentDidCatch && (update.callback = function() {
      logCaughtError(root2, fiber, errorInfo);
      "function" !== typeof getDerivedStateFromError && (null === legacyErrorBoundariesThatAlreadyFailed ? legacyErrorBoundariesThatAlreadyFailed = /* @__PURE__ */ new Set([this]) : legacyErrorBoundariesThatAlreadyFailed.add(this));
      var stack = errorInfo.stack;
      this.componentDidCatch(errorInfo.value, {
        componentStack: null !== stack ? stack : ""
      });
    });
  }
  function throwException(root2, returnFiber, sourceFiber, value, rootRenderLanes) {
    sourceFiber.flags |= 32768;
    if (null !== value && "object" === typeof value && "function" === typeof value.then) {
      returnFiber = sourceFiber.alternate;
      null !== returnFiber && propagateParentContextChanges(
        returnFiber,
        sourceFiber,
        rootRenderLanes,
        true
      );
      sourceFiber = suspenseHandlerStackCursor.current;
      if (null !== sourceFiber) {
        switch (sourceFiber.tag) {
          case 31:
          case 13:
            return null === shellBoundary ? renderDidSuspendDelayIfPossible() : null === sourceFiber.alternate && 0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 3), sourceFiber.flags &= -257, sourceFiber.flags |= 65536, sourceFiber.lanes = rootRenderLanes, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? sourceFiber.updateQueue = /* @__PURE__ */ new Set([value]) : returnFiber.add(value), attachPingListener(root2, value, rootRenderLanes)), false;
          case 22:
            return sourceFiber.flags |= 65536, value === noopSuspenseyCommitThenable ? sourceFiber.flags |= 16384 : (returnFiber = sourceFiber.updateQueue, null === returnFiber ? (returnFiber = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([value])
            }, sourceFiber.updateQueue = returnFiber) : (sourceFiber = returnFiber.retryQueue, null === sourceFiber ? returnFiber.retryQueue = /* @__PURE__ */ new Set([value]) : sourceFiber.add(value)), attachPingListener(root2, value, rootRenderLanes)), false;
        }
        throw Error(formatProdErrorMessage(435, sourceFiber.tag));
      }
      attachPingListener(root2, value, rootRenderLanes);
      renderDidSuspendDelayIfPossible();
      return false;
    }
    if (isHydrating)
      return returnFiber = suspenseHandlerStackCursor.current, null !== returnFiber ? (0 === (returnFiber.flags & 65536) && (returnFiber.flags |= 256), returnFiber.flags |= 65536, returnFiber.lanes = rootRenderLanes, value !== HydrationMismatchException && (root2 = Error(formatProdErrorMessage(422), { cause: value }), queueHydrationError(createCapturedValueAtFiber(root2, sourceFiber)))) : (value !== HydrationMismatchException && (returnFiber = Error(formatProdErrorMessage(423), {
        cause: value
      }), queueHydrationError(
        createCapturedValueAtFiber(returnFiber, sourceFiber)
      )), root2 = root2.current.alternate, root2.flags |= 65536, rootRenderLanes &= -rootRenderLanes, root2.lanes |= rootRenderLanes, value = createCapturedValueAtFiber(value, sourceFiber), rootRenderLanes = createRootErrorUpdate(
        root2.stateNode,
        value,
        rootRenderLanes
      ), enqueueCapturedUpdate(root2, rootRenderLanes), 4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2)), false;
    var wrapperError = Error(formatProdErrorMessage(520), { cause: value });
    wrapperError = createCapturedValueAtFiber(wrapperError, sourceFiber);
    null === workInProgressRootConcurrentErrors ? workInProgressRootConcurrentErrors = [wrapperError] : workInProgressRootConcurrentErrors.push(wrapperError);
    4 !== workInProgressRootExitStatus && (workInProgressRootExitStatus = 2);
    if (null === returnFiber) return true;
    value = createCapturedValueAtFiber(value, sourceFiber);
    sourceFiber = returnFiber;
    do {
      switch (sourceFiber.tag) {
        case 3:
          return sourceFiber.flags |= 65536, root2 = rootRenderLanes & -rootRenderLanes, sourceFiber.lanes |= root2, root2 = createRootErrorUpdate(sourceFiber.stateNode, value, root2), enqueueCapturedUpdate(sourceFiber, root2), false;
        case 1:
          if (returnFiber = sourceFiber.type, wrapperError = sourceFiber.stateNode, 0 === (sourceFiber.flags & 128) && ("function" === typeof returnFiber.getDerivedStateFromError || null !== wrapperError && "function" === typeof wrapperError.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(wrapperError))))
            return sourceFiber.flags |= 65536, rootRenderLanes &= -rootRenderLanes, sourceFiber.lanes |= rootRenderLanes, rootRenderLanes = createClassErrorUpdate(rootRenderLanes), initializeClassErrorUpdate(
              rootRenderLanes,
              root2,
              sourceFiber,
              value
            ), enqueueCapturedUpdate(sourceFiber, rootRenderLanes), false;
      }
      sourceFiber = sourceFiber.return;
    } while (null !== sourceFiber);
    return false;
  }
  var SelectiveHydrationException = Error(formatProdErrorMessage(461)), didReceiveUpdate = false;
  function reconcileChildren(current, workInProgress2, nextChildren, renderLanes2) {
    workInProgress2.child = null === current ? mountChildFibers(workInProgress2, null, nextChildren, renderLanes2) : reconcileChildFibers(
      workInProgress2,
      current.child,
      nextChildren,
      renderLanes2
    );
  }
  function updateForwardRef(current, workInProgress2, Component, nextProps, renderLanes2) {
    Component = Component.render;
    var ref = workInProgress2.ref;
    if ("ref" in nextProps) {
      var propsWithoutRef = {};
      for (var key in nextProps)
        "ref" !== key && (propsWithoutRef[key] = nextProps[key]);
    } else propsWithoutRef = nextProps;
    prepareToReadContext(workInProgress2);
    nextProps = renderWithHooks(
      current,
      workInProgress2,
      Component,
      propsWithoutRef,
      ref,
      renderLanes2
    );
    key = checkDidRenderIdHook();
    if (null !== current && !didReceiveUpdate)
      return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
    isHydrating && key && pushMaterializedTreeId(workInProgress2);
    workInProgress2.flags |= 1;
    reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
    return workInProgress2.child;
  }
  function updateMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
    if (null === current) {
      var type = Component.type;
      if ("function" === typeof type && !shouldConstruct(type) && void 0 === type.defaultProps && null === Component.compare)
        return workInProgress2.tag = 15, workInProgress2.type = type, updateSimpleMemoComponent(
          current,
          workInProgress2,
          type,
          nextProps,
          renderLanes2
        );
      current = createFiberFromTypeAndProps(
        Component.type,
        null,
        nextProps,
        workInProgress2,
        workInProgress2.mode,
        renderLanes2
      );
      current.ref = workInProgress2.ref;
      current.return = workInProgress2;
      return workInProgress2.child = current;
    }
    type = current.child;
    if (!checkScheduledUpdateOrContext(current, renderLanes2)) {
      var prevProps = type.memoizedProps;
      Component = Component.compare;
      Component = null !== Component ? Component : shallowEqual;
      if (Component(prevProps, nextProps) && current.ref === workInProgress2.ref)
        return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
    }
    workInProgress2.flags |= 1;
    current = createWorkInProgress(type, nextProps);
    current.ref = workInProgress2.ref;
    current.return = workInProgress2;
    return workInProgress2.child = current;
  }
  function updateSimpleMemoComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
    if (null !== current) {
      var prevProps = current.memoizedProps;
      if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress2.ref)
        if (didReceiveUpdate = false, workInProgress2.pendingProps = nextProps = prevProps, checkScheduledUpdateOrContext(current, renderLanes2))
          0 !== (current.flags & 131072) && (didReceiveUpdate = true);
        else
          return workInProgress2.lanes = current.lanes, bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
    }
    return updateFunctionComponent(
      current,
      workInProgress2,
      Component,
      nextProps,
      renderLanes2
    );
  }
  function updateOffscreenComponent(current, workInProgress2, renderLanes2, nextProps) {
    var nextChildren = nextProps.children, prevState = null !== current ? current.memoizedState : null;
    null === current && null === workInProgress2.stateNode && (workInProgress2.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    });
    if ("hidden" === nextProps.mode) {
      if (0 !== (workInProgress2.flags & 128)) {
        prevState = null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2;
        if (null !== current) {
          nextProps = workInProgress2.child = current.child;
          for (nextChildren = 0; null !== nextProps; )
            nextChildren = nextChildren | nextProps.lanes | nextProps.childLanes, nextProps = nextProps.sibling;
          nextProps = nextChildren & ~prevState;
        } else nextProps = 0, workInProgress2.child = null;
        return deferHiddenOffscreenComponent(
          current,
          workInProgress2,
          prevState,
          renderLanes2,
          nextProps
        );
      }
      if (0 !== (renderLanes2 & 536870912))
        workInProgress2.memoizedState = { baseLanes: 0, cachePool: null }, null !== current && pushTransition(
          workInProgress2,
          null !== prevState ? prevState.cachePool : null
        ), null !== prevState ? pushHiddenContext(workInProgress2, prevState) : reuseHiddenContextOnStack(), pushOffscreenSuspenseHandler(workInProgress2);
      else
        return nextProps = workInProgress2.lanes = 536870912, deferHiddenOffscreenComponent(
          current,
          workInProgress2,
          null !== prevState ? prevState.baseLanes | renderLanes2 : renderLanes2,
          renderLanes2,
          nextProps
        );
    } else
      null !== prevState ? (pushTransition(workInProgress2, prevState.cachePool), pushHiddenContext(workInProgress2, prevState), reuseSuspenseHandlerOnStack(), workInProgress2.memoizedState = null) : (null !== current && pushTransition(workInProgress2, null), reuseHiddenContextOnStack(), reuseSuspenseHandlerOnStack());
    reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
    return workInProgress2.child;
  }
  function bailoutOffscreenComponent(current, workInProgress2) {
    null !== current && 22 === current.tag || null !== workInProgress2.stateNode || (workInProgress2.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    });
    return workInProgress2.sibling;
  }
  function deferHiddenOffscreenComponent(current, workInProgress2, nextBaseLanes, renderLanes2, remainingChildLanes) {
    var JSCompiler_inline_result = peekCacheFromPool();
    JSCompiler_inline_result = null === JSCompiler_inline_result ? null : { parent: CacheContext._currentValue, pool: JSCompiler_inline_result };
    workInProgress2.memoizedState = {
      baseLanes: nextBaseLanes,
      cachePool: JSCompiler_inline_result
    };
    null !== current && pushTransition(workInProgress2, null);
    reuseHiddenContextOnStack();
    pushOffscreenSuspenseHandler(workInProgress2);
    null !== current && propagateParentContextChanges(current, workInProgress2, renderLanes2, true);
    workInProgress2.childLanes = remainingChildLanes;
    return null;
  }
  function mountActivityChildren(workInProgress2, nextProps) {
    nextProps = mountWorkInProgressOffscreenFiber(
      { mode: nextProps.mode, children: nextProps.children },
      workInProgress2.mode
    );
    nextProps.ref = workInProgress2.ref;
    workInProgress2.child = nextProps;
    nextProps.return = workInProgress2;
    return nextProps;
  }
  function retryActivityComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
    reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
    current = mountActivityChildren(workInProgress2, workInProgress2.pendingProps);
    current.flags |= 2;
    popSuspenseHandler(workInProgress2);
    workInProgress2.memoizedState = null;
    return current;
  }
  function updateActivityComponent(current, workInProgress2, renderLanes2) {
    var nextProps = workInProgress2.pendingProps, didSuspend = 0 !== (workInProgress2.flags & 128);
    workInProgress2.flags &= -129;
    if (null === current) {
      if (isHydrating) {
        if ("hidden" === nextProps.mode)
          return current = mountActivityChildren(workInProgress2, nextProps), workInProgress2.lanes = 536870912, bailoutOffscreenComponent(null, current);
        pushDehydratedActivitySuspenseHandler(workInProgress2);
        (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(
          current,
          rootOrSingletonContext
        ), current = null !== current && "&" === current.data ? current : null, null !== current && (workInProgress2.memoizedState = {
          dehydrated: current,
          treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current = null;
        if (null === current) throw throwOnHydrationMismatch(workInProgress2);
        workInProgress2.lanes = 536870912;
        return null;
      }
      return mountActivityChildren(workInProgress2, nextProps);
    }
    var prevState = current.memoizedState;
    if (null !== prevState) {
      var dehydrated = prevState.dehydrated;
      pushDehydratedActivitySuspenseHandler(workInProgress2);
      if (didSuspend)
        if (workInProgress2.flags & 256)
          workInProgress2.flags &= -257, workInProgress2 = retryActivityComponentWithoutHydrating(
            current,
            workInProgress2,
            renderLanes2
          );
        else if (null !== workInProgress2.memoizedState)
          workInProgress2.child = current.child, workInProgress2.flags |= 128, workInProgress2 = null;
        else throw Error(formatProdErrorMessage(558));
      else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false), didSuspend = 0 !== (renderLanes2 & current.childLanes), didReceiveUpdate || didSuspend) {
        nextProps = workInProgressRoot;
        if (null !== nextProps && (dehydrated = getBumpedLaneForHydration(nextProps, renderLanes2), 0 !== dehydrated && dehydrated !== prevState.retryLane))
          throw prevState.retryLane = dehydrated, enqueueConcurrentRenderForLane(current, dehydrated), scheduleUpdateOnFiber(nextProps, current, dehydrated), SelectiveHydrationException;
        renderDidSuspendDelayIfPossible();
        workInProgress2 = retryActivityComponentWithoutHydrating(
          current,
          workInProgress2,
          renderLanes2
        );
      } else
        current = prevState.treeContext, nextHydratableInstance = getNextHydratable(dehydrated.nextSibling), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current && restoreSuspendedTreeContext(workInProgress2, current), workInProgress2 = mountActivityChildren(workInProgress2, nextProps), workInProgress2.flags |= 4096;
      return workInProgress2;
    }
    current = createWorkInProgress(current.child, {
      mode: nextProps.mode,
      children: nextProps.children
    });
    current.ref = workInProgress2.ref;
    workInProgress2.child = current;
    current.return = workInProgress2;
    return current;
  }
  function markRef(current, workInProgress2) {
    var ref = workInProgress2.ref;
    if (null === ref)
      null !== current && null !== current.ref && (workInProgress2.flags |= 4194816);
    else {
      if ("function" !== typeof ref && "object" !== typeof ref)
        throw Error(formatProdErrorMessage(284));
      if (null === current || current.ref !== ref)
        workInProgress2.flags |= 4194816;
    }
  }
  function updateFunctionComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
    prepareToReadContext(workInProgress2);
    Component = renderWithHooks(
      current,
      workInProgress2,
      Component,
      nextProps,
      void 0,
      renderLanes2
    );
    nextProps = checkDidRenderIdHook();
    if (null !== current && !didReceiveUpdate)
      return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
    isHydrating && nextProps && pushMaterializedTreeId(workInProgress2);
    workInProgress2.flags |= 1;
    reconcileChildren(current, workInProgress2, Component, renderLanes2);
    return workInProgress2.child;
  }
  function replayFunctionComponent(current, workInProgress2, nextProps, Component, secondArg, renderLanes2) {
    prepareToReadContext(workInProgress2);
    workInProgress2.updateQueue = null;
    nextProps = renderWithHooksAgain(
      workInProgress2,
      Component,
      nextProps,
      secondArg
    );
    finishRenderingHooks(current);
    Component = checkDidRenderIdHook();
    if (null !== current && !didReceiveUpdate)
      return bailoutHooks(current, workInProgress2, renderLanes2), bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
    isHydrating && Component && pushMaterializedTreeId(workInProgress2);
    workInProgress2.flags |= 1;
    reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
    return workInProgress2.child;
  }
  function updateClassComponent(current, workInProgress2, Component, nextProps, renderLanes2) {
    prepareToReadContext(workInProgress2);
    if (null === workInProgress2.stateNode) {
      var context = emptyContextObject, contextType = Component.contextType;
      "object" === typeof contextType && null !== contextType && (context = readContext(contextType));
      context = new Component(nextProps, context);
      workInProgress2.memoizedState = null !== context.state && void 0 !== context.state ? context.state : null;
      context.updater = classComponentUpdater;
      workInProgress2.stateNode = context;
      context._reactInternals = workInProgress2;
      context = workInProgress2.stateNode;
      context.props = nextProps;
      context.state = workInProgress2.memoizedState;
      context.refs = {};
      initializeUpdateQueue(workInProgress2);
      contextType = Component.contextType;
      context.context = "object" === typeof contextType && null !== contextType ? readContext(contextType) : emptyContextObject;
      context.state = workInProgress2.memoizedState;
      contextType = Component.getDerivedStateFromProps;
      "function" === typeof contextType && (applyDerivedStateFromProps(
        workInProgress2,
        Component,
        contextType,
        nextProps
      ), context.state = workInProgress2.memoizedState);
      "function" === typeof Component.getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || (contextType = context.state, "function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount(), contextType !== context.state && classComponentUpdater.enqueueReplaceState(context, context.state, null), processUpdateQueue(workInProgress2, nextProps, context, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction(), context.state = workInProgress2.memoizedState);
      "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308);
      nextProps = true;
    } else if (null === current) {
      context = workInProgress2.stateNode;
      var unresolvedOldProps = workInProgress2.memoizedProps, oldProps = resolveClassComponentProps(Component, unresolvedOldProps);
      context.props = oldProps;
      var oldContext = context.context, contextType$jscomp$0 = Component.contextType;
      contextType = emptyContextObject;
      "object" === typeof contextType$jscomp$0 && null !== contextType$jscomp$0 && (contextType = readContext(contextType$jscomp$0));
      var getDerivedStateFromProps = Component.getDerivedStateFromProps;
      contextType$jscomp$0 = "function" === typeof getDerivedStateFromProps || "function" === typeof context.getSnapshotBeforeUpdate;
      unresolvedOldProps = workInProgress2.pendingProps !== unresolvedOldProps;
      contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (unresolvedOldProps || oldContext !== contextType) && callComponentWillReceiveProps(
        workInProgress2,
        context,
        nextProps,
        contextType
      );
      hasForceUpdate = false;
      var oldState = workInProgress2.memoizedState;
      context.state = oldState;
      processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
      suspendIfUpdateReadFromEntangledAsyncAction();
      oldContext = workInProgress2.memoizedState;
      unresolvedOldProps || oldState !== oldContext || hasForceUpdate ? ("function" === typeof getDerivedStateFromProps && (applyDerivedStateFromProps(
        workInProgress2,
        Component,
        getDerivedStateFromProps,
        nextProps
      ), oldContext = workInProgress2.memoizedState), (oldProps = hasForceUpdate || checkShouldComponentUpdate(
        workInProgress2,
        Component,
        oldProps,
        nextProps,
        oldState,
        oldContext,
        contextType
      )) ? (contextType$jscomp$0 || "function" !== typeof context.UNSAFE_componentWillMount && "function" !== typeof context.componentWillMount || ("function" === typeof context.componentWillMount && context.componentWillMount(), "function" === typeof context.UNSAFE_componentWillMount && context.UNSAFE_componentWillMount()), "function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308)) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = oldContext), context.props = nextProps, context.state = oldContext, context.context = contextType, nextProps = oldProps) : ("function" === typeof context.componentDidMount && (workInProgress2.flags |= 4194308), nextProps = false);
    } else {
      context = workInProgress2.stateNode;
      cloneUpdateQueue(current, workInProgress2);
      contextType = workInProgress2.memoizedProps;
      contextType$jscomp$0 = resolveClassComponentProps(Component, contextType);
      context.props = contextType$jscomp$0;
      getDerivedStateFromProps = workInProgress2.pendingProps;
      oldState = context.context;
      oldContext = Component.contextType;
      oldProps = emptyContextObject;
      "object" === typeof oldContext && null !== oldContext && (oldProps = readContext(oldContext));
      unresolvedOldProps = Component.getDerivedStateFromProps;
      (oldContext = "function" === typeof unresolvedOldProps || "function" === typeof context.getSnapshotBeforeUpdate) || "function" !== typeof context.UNSAFE_componentWillReceiveProps && "function" !== typeof context.componentWillReceiveProps || (contextType !== getDerivedStateFromProps || oldState !== oldProps) && callComponentWillReceiveProps(
        workInProgress2,
        context,
        nextProps,
        oldProps
      );
      hasForceUpdate = false;
      oldState = workInProgress2.memoizedState;
      context.state = oldState;
      processUpdateQueue(workInProgress2, nextProps, context, renderLanes2);
      suspendIfUpdateReadFromEntangledAsyncAction();
      var newState = workInProgress2.memoizedState;
      contextType !== getDerivedStateFromProps || oldState !== newState || hasForceUpdate || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies) ? ("function" === typeof unresolvedOldProps && (applyDerivedStateFromProps(
        workInProgress2,
        Component,
        unresolvedOldProps,
        nextProps
      ), newState = workInProgress2.memoizedState), (contextType$jscomp$0 = hasForceUpdate || checkShouldComponentUpdate(
        workInProgress2,
        Component,
        contextType$jscomp$0,
        nextProps,
        oldState,
        newState,
        oldProps
      ) || null !== current && null !== current.dependencies && checkIfContextChanged(current.dependencies)) ? (oldContext || "function" !== typeof context.UNSAFE_componentWillUpdate && "function" !== typeof context.componentWillUpdate || ("function" === typeof context.componentWillUpdate && context.componentWillUpdate(nextProps, newState, oldProps), "function" === typeof context.UNSAFE_componentWillUpdate && context.UNSAFE_componentWillUpdate(
        nextProps,
        newState,
        oldProps
      )), "function" === typeof context.componentDidUpdate && (workInProgress2.flags |= 4), "function" === typeof context.getSnapshotBeforeUpdate && (workInProgress2.flags |= 1024)) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), workInProgress2.memoizedProps = nextProps, workInProgress2.memoizedState = newState), context.props = nextProps, context.state = newState, context.context = oldProps, nextProps = contextType$jscomp$0) : ("function" !== typeof context.componentDidUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 4), "function" !== typeof context.getSnapshotBeforeUpdate || contextType === current.memoizedProps && oldState === current.memoizedState || (workInProgress2.flags |= 1024), nextProps = false);
    }
    context = nextProps;
    markRef(current, workInProgress2);
    nextProps = 0 !== (workInProgress2.flags & 128);
    context || nextProps ? (context = workInProgress2.stateNode, Component = nextProps && "function" !== typeof Component.getDerivedStateFromError ? null : context.render(), workInProgress2.flags |= 1, null !== current && nextProps ? (workInProgress2.child = reconcileChildFibers(
      workInProgress2,
      current.child,
      null,
      renderLanes2
    ), workInProgress2.child = reconcileChildFibers(
      workInProgress2,
      null,
      Component,
      renderLanes2
    )) : reconcileChildren(current, workInProgress2, Component, renderLanes2), workInProgress2.memoizedState = context.state, current = workInProgress2.child) : current = bailoutOnAlreadyFinishedWork(
      current,
      workInProgress2,
      renderLanes2
    );
    return current;
  }
  function mountHostRootWithoutHydrating(current, workInProgress2, nextChildren, renderLanes2) {
    resetHydrationState();
    workInProgress2.flags |= 256;
    reconcileChildren(current, workInProgress2, nextChildren, renderLanes2);
    return workInProgress2.child;
  }
  var SUSPENDED_MARKER = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function mountSuspenseOffscreenState(renderLanes2) {
    return { baseLanes: renderLanes2, cachePool: getSuspendedCache() };
  }
  function getRemainingWorkInPrimaryTree(current, primaryTreeDidDefer, renderLanes2) {
    current = null !== current ? current.childLanes & ~renderLanes2 : 0;
    primaryTreeDidDefer && (current |= workInProgressDeferredLane);
    return current;
  }
  function updateSuspenseComponent(current, workInProgress2, renderLanes2) {
    var nextProps = workInProgress2.pendingProps, showFallback = false, didSuspend = 0 !== (workInProgress2.flags & 128), JSCompiler_temp;
    (JSCompiler_temp = didSuspend) || (JSCompiler_temp = null !== current && null === current.memoizedState ? false : 0 !== (suspenseStackCursor.current & 2));
    JSCompiler_temp && (showFallback = true, workInProgress2.flags &= -129);
    JSCompiler_temp = 0 !== (workInProgress2.flags & 32);
    workInProgress2.flags &= -33;
    if (null === current) {
      if (isHydrating) {
        showFallback ? pushPrimaryTreeSuspenseHandler(workInProgress2) : reuseSuspenseHandlerOnStack();
        (current = nextHydratableInstance) ? (current = canHydrateHydrationBoundary(
          current,
          rootOrSingletonContext
        ), current = null !== current && "&" !== current.data ? current : null, null !== current && (workInProgress2.memoizedState = {
          dehydrated: current,
          treeContext: null !== treeContextProvider ? { id: treeContextId, overflow: treeContextOverflow } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, renderLanes2 = createFiberFromDehydratedFragment(current), renderLanes2.return = workInProgress2, workInProgress2.child = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null)) : current = null;
        if (null === current) throw throwOnHydrationMismatch(workInProgress2);
        isSuspenseInstanceFallback(current) ? workInProgress2.lanes = 32 : workInProgress2.lanes = 536870912;
        return null;
      }
      var nextPrimaryChildren = nextProps.children;
      nextProps = nextProps.fallback;
      if (showFallback)
        return reuseSuspenseHandlerOnStack(), showFallback = workInProgress2.mode, nextPrimaryChildren = mountWorkInProgressOffscreenFiber(
          { mode: "hidden", children: nextPrimaryChildren },
          showFallback
        ), nextProps = createFiberFromFragment(
          nextProps,
          showFallback,
          renderLanes2,
          null
        ), nextPrimaryChildren.return = workInProgress2, nextProps.return = workInProgress2, nextPrimaryChildren.sibling = nextProps, workInProgress2.child = nextPrimaryChildren, nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
          current,
          JSCompiler_temp,
          renderLanes2
        ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(null, nextProps);
      pushPrimaryTreeSuspenseHandler(workInProgress2);
      return mountSuspensePrimaryChildren(workInProgress2, nextPrimaryChildren);
    }
    var prevState = current.memoizedState;
    if (null !== prevState && (nextPrimaryChildren = prevState.dehydrated, null !== nextPrimaryChildren)) {
      if (didSuspend)
        workInProgress2.flags & 256 ? (pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags &= -257, workInProgress2 = retrySuspenseComponentWithoutHydrating(
          current,
          workInProgress2,
          renderLanes2
        )) : null !== workInProgress2.memoizedState ? (reuseSuspenseHandlerOnStack(), workInProgress2.child = current.child, workInProgress2.flags |= 128, workInProgress2 = null) : (reuseSuspenseHandlerOnStack(), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress2.mode, nextProps = mountWorkInProgressOffscreenFiber(
          { mode: "visible", children: nextProps.children },
          showFallback
        ), nextPrimaryChildren = createFiberFromFragment(
          nextPrimaryChildren,
          showFallback,
          renderLanes2,
          null
        ), nextPrimaryChildren.flags |= 2, nextProps.return = workInProgress2, nextPrimaryChildren.return = workInProgress2, nextProps.sibling = nextPrimaryChildren, workInProgress2.child = nextProps, reconcileChildFibers(
          workInProgress2,
          current.child,
          null,
          renderLanes2
        ), nextProps = workInProgress2.child, nextProps.memoizedState = mountSuspenseOffscreenState(renderLanes2), nextProps.childLanes = getRemainingWorkInPrimaryTree(
          current,
          JSCompiler_temp,
          renderLanes2
        ), workInProgress2.memoizedState = SUSPENDED_MARKER, workInProgress2 = bailoutOffscreenComponent(null, nextProps));
      else if (pushPrimaryTreeSuspenseHandler(workInProgress2), isSuspenseInstanceFallback(nextPrimaryChildren)) {
        JSCompiler_temp = nextPrimaryChildren.nextSibling && nextPrimaryChildren.nextSibling.dataset;
        if (JSCompiler_temp) var digest = JSCompiler_temp.dgst;
        JSCompiler_temp = digest;
        nextProps = Error(formatProdErrorMessage(419));
        nextProps.stack = "";
        nextProps.digest = JSCompiler_temp;
        queueHydrationError({ value: nextProps, source: null, stack: null });
        workInProgress2 = retrySuspenseComponentWithoutHydrating(
          current,
          workInProgress2,
          renderLanes2
        );
      } else if (didReceiveUpdate || propagateParentContextChanges(current, workInProgress2, renderLanes2, false), JSCompiler_temp = 0 !== (renderLanes2 & current.childLanes), didReceiveUpdate || JSCompiler_temp) {
        JSCompiler_temp = workInProgressRoot;
        if (null !== JSCompiler_temp && (nextProps = getBumpedLaneForHydration(JSCompiler_temp, renderLanes2), 0 !== nextProps && nextProps !== prevState.retryLane))
          throw prevState.retryLane = nextProps, enqueueConcurrentRenderForLane(current, nextProps), scheduleUpdateOnFiber(JSCompiler_temp, current, nextProps), SelectiveHydrationException;
        isSuspenseInstancePending(nextPrimaryChildren) || renderDidSuspendDelayIfPossible();
        workInProgress2 = retrySuspenseComponentWithoutHydrating(
          current,
          workInProgress2,
          renderLanes2
        );
      } else
        isSuspenseInstancePending(nextPrimaryChildren) ? (workInProgress2.flags |= 192, workInProgress2.child = current.child, workInProgress2 = null) : (current = prevState.treeContext, nextHydratableInstance = getNextHydratable(
          nextPrimaryChildren.nextSibling
        ), hydrationParentFiber = workInProgress2, isHydrating = true, hydrationErrors = null, rootOrSingletonContext = false, null !== current && restoreSuspendedTreeContext(workInProgress2, current), workInProgress2 = mountSuspensePrimaryChildren(
          workInProgress2,
          nextProps.children
        ), workInProgress2.flags |= 4096);
      return workInProgress2;
    }
    if (showFallback)
      return reuseSuspenseHandlerOnStack(), nextPrimaryChildren = nextProps.fallback, showFallback = workInProgress2.mode, prevState = current.child, digest = prevState.sibling, nextProps = createWorkInProgress(prevState, {
        mode: "hidden",
        children: nextProps.children
      }), nextProps.subtreeFlags = prevState.subtreeFlags & 65011712, null !== digest ? nextPrimaryChildren = createWorkInProgress(
        digest,
        nextPrimaryChildren
      ) : (nextPrimaryChildren = createFiberFromFragment(
        nextPrimaryChildren,
        showFallback,
        renderLanes2,
        null
      ), nextPrimaryChildren.flags |= 2), nextPrimaryChildren.return = workInProgress2, nextProps.return = workInProgress2, nextProps.sibling = nextPrimaryChildren, workInProgress2.child = nextProps, bailoutOffscreenComponent(null, nextProps), nextProps = workInProgress2.child, nextPrimaryChildren = current.child.memoizedState, null === nextPrimaryChildren ? nextPrimaryChildren = mountSuspenseOffscreenState(renderLanes2) : (showFallback = nextPrimaryChildren.cachePool, null !== showFallback ? (prevState = CacheContext._currentValue, showFallback = showFallback.parent !== prevState ? { parent: prevState, pool: prevState } : showFallback) : showFallback = getSuspendedCache(), nextPrimaryChildren = {
        baseLanes: nextPrimaryChildren.baseLanes | renderLanes2,
        cachePool: showFallback
      }), nextProps.memoizedState = nextPrimaryChildren, nextProps.childLanes = getRemainingWorkInPrimaryTree(
        current,
        JSCompiler_temp,
        renderLanes2
      ), workInProgress2.memoizedState = SUSPENDED_MARKER, bailoutOffscreenComponent(current.child, nextProps);
    pushPrimaryTreeSuspenseHandler(workInProgress2);
    renderLanes2 = current.child;
    current = renderLanes2.sibling;
    renderLanes2 = createWorkInProgress(renderLanes2, {
      mode: "visible",
      children: nextProps.children
    });
    renderLanes2.return = workInProgress2;
    renderLanes2.sibling = null;
    null !== current && (JSCompiler_temp = workInProgress2.deletions, null === JSCompiler_temp ? (workInProgress2.deletions = [current], workInProgress2.flags |= 16) : JSCompiler_temp.push(current));
    workInProgress2.child = renderLanes2;
    workInProgress2.memoizedState = null;
    return renderLanes2;
  }
  function mountSuspensePrimaryChildren(workInProgress2, primaryChildren) {
    primaryChildren = mountWorkInProgressOffscreenFiber(
      { mode: "visible", children: primaryChildren },
      workInProgress2.mode
    );
    primaryChildren.return = workInProgress2;
    return workInProgress2.child = primaryChildren;
  }
  function mountWorkInProgressOffscreenFiber(offscreenProps, mode) {
    offscreenProps = createFiberImplClass(22, offscreenProps, null, mode);
    offscreenProps.lanes = 0;
    return offscreenProps;
  }
  function retrySuspenseComponentWithoutHydrating(current, workInProgress2, renderLanes2) {
    reconcileChildFibers(workInProgress2, current.child, null, renderLanes2);
    current = mountSuspensePrimaryChildren(
      workInProgress2,
      workInProgress2.pendingProps.children
    );
    current.flags |= 2;
    workInProgress2.memoizedState = null;
    return current;
  }
  function scheduleSuspenseWorkOnFiber(fiber, renderLanes2, propagationRoot) {
    fiber.lanes |= renderLanes2;
    var alternate = fiber.alternate;
    null !== alternate && (alternate.lanes |= renderLanes2);
    scheduleContextWorkOnParentPath(fiber.return, renderLanes2, propagationRoot);
  }
  function initSuspenseListRenderState(workInProgress2, isBackwards, tail, lastContentRow, tailMode, treeForkCount2) {
    var renderState = workInProgress2.memoizedState;
    null === renderState ? workInProgress2.memoizedState = {
      isBackwards,
      rendering: null,
      renderingStartTime: 0,
      last: lastContentRow,
      tail,
      tailMode,
      treeForkCount: treeForkCount2
    } : (renderState.isBackwards = isBackwards, renderState.rendering = null, renderState.renderingStartTime = 0, renderState.last = lastContentRow, renderState.tail = tail, renderState.tailMode = tailMode, renderState.treeForkCount = treeForkCount2);
  }
  function updateSuspenseListComponent(current, workInProgress2, renderLanes2) {
    var nextProps = workInProgress2.pendingProps, revealOrder = nextProps.revealOrder, tailMode = nextProps.tail;
    nextProps = nextProps.children;
    var suspenseContext = suspenseStackCursor.current, shouldForceFallback = 0 !== (suspenseContext & 2);
    shouldForceFallback ? (suspenseContext = suspenseContext & 1 | 2, workInProgress2.flags |= 128) : suspenseContext &= 1;
    push(suspenseStackCursor, suspenseContext);
    reconcileChildren(current, workInProgress2, nextProps, renderLanes2);
    nextProps = isHydrating ? treeForkCount : 0;
    if (!shouldForceFallback && null !== current && 0 !== (current.flags & 128))
      a: for (current = workInProgress2.child; null !== current; ) {
        if (13 === current.tag)
          null !== current.memoizedState && scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
        else if (19 === current.tag)
          scheduleSuspenseWorkOnFiber(current, renderLanes2, workInProgress2);
        else if (null !== current.child) {
          current.child.return = current;
          current = current.child;
          continue;
        }
        if (current === workInProgress2) break a;
        for (; null === current.sibling; ) {
          if (null === current.return || current.return === workInProgress2)
            break a;
          current = current.return;
        }
        current.sibling.return = current.return;
        current = current.sibling;
      }
    switch (revealOrder) {
      case "forwards":
        renderLanes2 = workInProgress2.child;
        for (revealOrder = null; null !== renderLanes2; )
          current = renderLanes2.alternate, null !== current && null === findFirstSuspended(current) && (revealOrder = renderLanes2), renderLanes2 = renderLanes2.sibling;
        renderLanes2 = revealOrder;
        null === renderLanes2 ? (revealOrder = workInProgress2.child, workInProgress2.child = null) : (revealOrder = renderLanes2.sibling, renderLanes2.sibling = null);
        initSuspenseListRenderState(
          workInProgress2,
          false,
          revealOrder,
          renderLanes2,
          tailMode,
          nextProps
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        renderLanes2 = null;
        revealOrder = workInProgress2.child;
        for (workInProgress2.child = null; null !== revealOrder; ) {
          current = revealOrder.alternate;
          if (null !== current && null === findFirstSuspended(current)) {
            workInProgress2.child = revealOrder;
            break;
          }
          current = revealOrder.sibling;
          revealOrder.sibling = renderLanes2;
          renderLanes2 = revealOrder;
          revealOrder = current;
        }
        initSuspenseListRenderState(
          workInProgress2,
          true,
          renderLanes2,
          null,
          tailMode,
          nextProps
        );
        break;
      case "together":
        initSuspenseListRenderState(
          workInProgress2,
          false,
          null,
          null,
          void 0,
          nextProps
        );
        break;
      default:
        workInProgress2.memoizedState = null;
    }
    return workInProgress2.child;
  }
  function bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2) {
    null !== current && (workInProgress2.dependencies = current.dependencies);
    workInProgressRootSkippedLanes |= workInProgress2.lanes;
    if (0 === (renderLanes2 & workInProgress2.childLanes))
      if (null !== current) {
        if (propagateParentContextChanges(
          current,
          workInProgress2,
          renderLanes2,
          false
        ), 0 === (renderLanes2 & workInProgress2.childLanes))
          return null;
      } else return null;
    if (null !== current && workInProgress2.child !== current.child)
      throw Error(formatProdErrorMessage(153));
    if (null !== workInProgress2.child) {
      current = workInProgress2.child;
      renderLanes2 = createWorkInProgress(current, current.pendingProps);
      workInProgress2.child = renderLanes2;
      for (renderLanes2.return = workInProgress2; null !== current.sibling; )
        current = current.sibling, renderLanes2 = renderLanes2.sibling = createWorkInProgress(current, current.pendingProps), renderLanes2.return = workInProgress2;
      renderLanes2.sibling = null;
    }
    return workInProgress2.child;
  }
  function checkScheduledUpdateOrContext(current, renderLanes2) {
    if (0 !== (current.lanes & renderLanes2)) return true;
    current = current.dependencies;
    return null !== current && checkIfContextChanged(current) ? true : false;
  }
  function attemptEarlyBailoutIfNoScheduledUpdate(current, workInProgress2, renderLanes2) {
    switch (workInProgress2.tag) {
      case 3:
        pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
        pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
        resetHydrationState();
        break;
      case 27:
      case 5:
        pushHostContext(workInProgress2);
        break;
      case 4:
        pushHostContainer(workInProgress2, workInProgress2.stateNode.containerInfo);
        break;
      case 10:
        pushProvider(
          workInProgress2,
          workInProgress2.type,
          workInProgress2.memoizedProps.value
        );
        break;
      case 31:
        if (null !== workInProgress2.memoizedState)
          return workInProgress2.flags |= 128, pushDehydratedActivitySuspenseHandler(workInProgress2), null;
        break;
      case 13:
        var state$102 = workInProgress2.memoizedState;
        if (null !== state$102) {
          if (null !== state$102.dehydrated)
            return pushPrimaryTreeSuspenseHandler(workInProgress2), workInProgress2.flags |= 128, null;
          if (0 !== (renderLanes2 & workInProgress2.child.childLanes))
            return updateSuspenseComponent(current, workInProgress2, renderLanes2);
          pushPrimaryTreeSuspenseHandler(workInProgress2);
          current = bailoutOnAlreadyFinishedWork(
            current,
            workInProgress2,
            renderLanes2
          );
          return null !== current ? current.sibling : null;
        }
        pushPrimaryTreeSuspenseHandler(workInProgress2);
        break;
      case 19:
        var didSuspendBefore = 0 !== (current.flags & 128);
        state$102 = 0 !== (renderLanes2 & workInProgress2.childLanes);
        state$102 || (propagateParentContextChanges(
          current,
          workInProgress2,
          renderLanes2,
          false
        ), state$102 = 0 !== (renderLanes2 & workInProgress2.childLanes));
        if (didSuspendBefore) {
          if (state$102)
            return updateSuspenseListComponent(
              current,
              workInProgress2,
              renderLanes2
            );
          workInProgress2.flags |= 128;
        }
        didSuspendBefore = workInProgress2.memoizedState;
        null !== didSuspendBefore && (didSuspendBefore.rendering = null, didSuspendBefore.tail = null, didSuspendBefore.lastEffect = null);
        push(suspenseStackCursor, suspenseStackCursor.current);
        if (state$102) break;
        else return null;
      case 22:
        return workInProgress2.lanes = 0, updateOffscreenComponent(
          current,
          workInProgress2,
          renderLanes2,
          workInProgress2.pendingProps
        );
      case 24:
        pushProvider(workInProgress2, CacheContext, current.memoizedState.cache);
    }
    return bailoutOnAlreadyFinishedWork(current, workInProgress2, renderLanes2);
  }
  function beginWork(current, workInProgress2, renderLanes2) {
    if (null !== current)
      if (current.memoizedProps !== workInProgress2.pendingProps)
        didReceiveUpdate = true;
      else {
        if (!checkScheduledUpdateOrContext(current, renderLanes2) && 0 === (workInProgress2.flags & 128))
          return didReceiveUpdate = false, attemptEarlyBailoutIfNoScheduledUpdate(
            current,
            workInProgress2,
            renderLanes2
          );
        didReceiveUpdate = 0 !== (current.flags & 131072) ? true : false;
      }
    else
      didReceiveUpdate = false, isHydrating && 0 !== (workInProgress2.flags & 1048576) && pushTreeId(workInProgress2, treeForkCount, workInProgress2.index);
    workInProgress2.lanes = 0;
    switch (workInProgress2.tag) {
      case 16:
        a: {
          var props = workInProgress2.pendingProps;
          current = resolveLazy(workInProgress2.elementType);
          workInProgress2.type = current;
          if ("function" === typeof current)
            shouldConstruct(current) ? (props = resolveClassComponentProps(current, props), workInProgress2.tag = 1, workInProgress2 = updateClassComponent(
              null,
              workInProgress2,
              current,
              props,
              renderLanes2
            )) : (workInProgress2.tag = 0, workInProgress2 = updateFunctionComponent(
              null,
              workInProgress2,
              current,
              props,
              renderLanes2
            ));
          else {
            if (void 0 !== current && null !== current) {
              var $$typeof = current.$$typeof;
              if ($$typeof === REACT_FORWARD_REF_TYPE) {
                workInProgress2.tag = 11;
                workInProgress2 = updateForwardRef(
                  null,
                  workInProgress2,
                  current,
                  props,
                  renderLanes2
                );
                break a;
              } else if ($$typeof === REACT_MEMO_TYPE) {
                workInProgress2.tag = 14;
                workInProgress2 = updateMemoComponent(
                  null,
                  workInProgress2,
                  current,
                  props,
                  renderLanes2
                );
                break a;
              }
            }
            workInProgress2 = getComponentNameFromType(current) || current;
            throw Error(formatProdErrorMessage(306, workInProgress2, ""));
          }
        }
        return workInProgress2;
      case 0:
        return updateFunctionComponent(
          current,
          workInProgress2,
          workInProgress2.type,
          workInProgress2.pendingProps,
          renderLanes2
        );
      case 1:
        return props = workInProgress2.type, $$typeof = resolveClassComponentProps(
          props,
          workInProgress2.pendingProps
        ), updateClassComponent(
          current,
          workInProgress2,
          props,
          $$typeof,
          renderLanes2
        );
      case 3:
        a: {
          pushHostContainer(
            workInProgress2,
            workInProgress2.stateNode.containerInfo
          );
          if (null === current) throw Error(formatProdErrorMessage(387));
          props = workInProgress2.pendingProps;
          var prevState = workInProgress2.memoizedState;
          $$typeof = prevState.element;
          cloneUpdateQueue(current, workInProgress2);
          processUpdateQueue(workInProgress2, props, null, renderLanes2);
          var nextState = workInProgress2.memoizedState;
          props = nextState.cache;
          pushProvider(workInProgress2, CacheContext, props);
          props !== prevState.cache && propagateContextChanges(
            workInProgress2,
            [CacheContext],
            renderLanes2,
            true
          );
          suspendIfUpdateReadFromEntangledAsyncAction();
          props = nextState.element;
          if (prevState.isDehydrated)
            if (prevState = {
              element: props,
              isDehydrated: false,
              cache: nextState.cache
            }, workInProgress2.updateQueue.baseState = prevState, workInProgress2.memoizedState = prevState, workInProgress2.flags & 256) {
              workInProgress2 = mountHostRootWithoutHydrating(
                current,
                workInProgress2,
                props,
                renderLanes2
              );
              break a;
            } else if (props !== $$typeof) {
              $$typeof = createCapturedValueAtFiber(
                Error(formatProdErrorMessage(424)),
                workInProgress2
              );
              queueHydrationError($$typeof);
              workInProgress2 = mountHostRootWithoutHydrating(
                current,
                workInProgress2,
                props,
                renderLanes2
              );
              break a;
            } else {
              current = workInProgress2.stateNode.containerInfo;
              switch (current.nodeType) {
                case 9:
                  current = current.body;
                  break;
                default:
                  current = "HTML" === current.nodeName ? current.ownerDocument.body : current;
              }
              nextHydratableInstance = getNextHydratable(current.firstChild);
              hydrationParentFiber = workInProgress2;
              isHydrating = true;
              hydrationErrors = null;
              rootOrSingletonContext = true;
              renderLanes2 = mountChildFibers(
                workInProgress2,
                null,
                props,
                renderLanes2
              );
              for (workInProgress2.child = renderLanes2; renderLanes2; )
                renderLanes2.flags = renderLanes2.flags & -3 | 4096, renderLanes2 = renderLanes2.sibling;
            }
          else {
            resetHydrationState();
            if (props === $$typeof) {
              workInProgress2 = bailoutOnAlreadyFinishedWork(
                current,
                workInProgress2,
                renderLanes2
              );
              break a;
            }
            reconcileChildren(current, workInProgress2, props, renderLanes2);
          }
          workInProgress2 = workInProgress2.child;
        }
        return workInProgress2;
      case 26:
        return markRef(current, workInProgress2), null === current ? (renderLanes2 = getResource(
          workInProgress2.type,
          null,
          workInProgress2.pendingProps,
          null
        )) ? workInProgress2.memoizedState = renderLanes2 : isHydrating || (renderLanes2 = workInProgress2.type, current = workInProgress2.pendingProps, props = getOwnerDocumentFromRootContainer(
          rootInstanceStackCursor.current
        ).createElement(renderLanes2), props[internalInstanceKey] = workInProgress2, props[internalPropsKey] = current, setInitialProperties(props, renderLanes2, current), markNodeAsHoistable(props), workInProgress2.stateNode = props) : workInProgress2.memoizedState = getResource(
          workInProgress2.type,
          current.memoizedProps,
          workInProgress2.pendingProps,
          current.memoizedState
        ), null;
      case 27:
        return pushHostContext(workInProgress2), null === current && isHydrating && (props = workInProgress2.stateNode = resolveSingletonInstance(
          workInProgress2.type,
          workInProgress2.pendingProps,
          rootInstanceStackCursor.current
        ), hydrationParentFiber = workInProgress2, rootOrSingletonContext = true, $$typeof = nextHydratableInstance, isSingletonScope(workInProgress2.type) ? (previousHydratableOnEnteringScopedSingleton = $$typeof, nextHydratableInstance = getNextHydratable(props.firstChild)) : nextHydratableInstance = $$typeof), reconcileChildren(
          current,
          workInProgress2,
          workInProgress2.pendingProps.children,
          renderLanes2
        ), markRef(current, workInProgress2), null === current && (workInProgress2.flags |= 4194304), workInProgress2.child;
      case 5:
        if (null === current && isHydrating) {
          if ($$typeof = props = nextHydratableInstance)
            props = canHydrateInstance(
              props,
              workInProgress2.type,
              workInProgress2.pendingProps,
              rootOrSingletonContext
            ), null !== props ? (workInProgress2.stateNode = props, hydrationParentFiber = workInProgress2, nextHydratableInstance = getNextHydratable(props.firstChild), rootOrSingletonContext = false, $$typeof = true) : $$typeof = false;
          $$typeof || throwOnHydrationMismatch(workInProgress2);
        }
        pushHostContext(workInProgress2);
        $$typeof = workInProgress2.type;
        prevState = workInProgress2.pendingProps;
        nextState = null !== current ? current.memoizedProps : null;
        props = prevState.children;
        shouldSetTextContent($$typeof, prevState) ? props = null : null !== nextState && shouldSetTextContent($$typeof, nextState) && (workInProgress2.flags |= 32);
        null !== workInProgress2.memoizedState && ($$typeof = renderWithHooks(
          current,
          workInProgress2,
          TransitionAwareHostComponent,
          null,
          null,
          renderLanes2
        ), HostTransitionContext._currentValue = $$typeof);
        markRef(current, workInProgress2);
        reconcileChildren(current, workInProgress2, props, renderLanes2);
        return workInProgress2.child;
      case 6:
        if (null === current && isHydrating) {
          if (current = renderLanes2 = nextHydratableInstance)
            renderLanes2 = canHydrateTextInstance(
              renderLanes2,
              workInProgress2.pendingProps,
              rootOrSingletonContext
            ), null !== renderLanes2 ? (workInProgress2.stateNode = renderLanes2, hydrationParentFiber = workInProgress2, nextHydratableInstance = null, current = true) : current = false;
          current || throwOnHydrationMismatch(workInProgress2);
        }
        return null;
      case 13:
        return updateSuspenseComponent(current, workInProgress2, renderLanes2);
      case 4:
        return pushHostContainer(
          workInProgress2,
          workInProgress2.stateNode.containerInfo
        ), props = workInProgress2.pendingProps, null === current ? workInProgress2.child = reconcileChildFibers(
          workInProgress2,
          null,
          props,
          renderLanes2
        ) : reconcileChildren(current, workInProgress2, props, renderLanes2), workInProgress2.child;
      case 11:
        return updateForwardRef(
          current,
          workInProgress2,
          workInProgress2.type,
          workInProgress2.pendingProps,
          renderLanes2
        );
      case 7:
        return reconcileChildren(
          current,
          workInProgress2,
          workInProgress2.pendingProps,
          renderLanes2
        ), workInProgress2.child;
      case 8:
        return reconcileChildren(
          current,
          workInProgress2,
          workInProgress2.pendingProps.children,
          renderLanes2
        ), workInProgress2.child;
      case 12:
        return reconcileChildren(
          current,
          workInProgress2,
          workInProgress2.pendingProps.children,
          renderLanes2
        ), workInProgress2.child;
      case 10:
        return props = workInProgress2.pendingProps, pushProvider(workInProgress2, workInProgress2.type, props.value), reconcileChildren(current, workInProgress2, props.children, renderLanes2), workInProgress2.child;
      case 9:
        return $$typeof = workInProgress2.type._context, props = workInProgress2.pendingProps.children, prepareToReadContext(workInProgress2), $$typeof = readContext($$typeof), props = props($$typeof), workInProgress2.flags |= 1, reconcileChildren(current, workInProgress2, props, renderLanes2), workInProgress2.child;
      case 14:
        return updateMemoComponent(
          current,
          workInProgress2,
          workInProgress2.type,
          workInProgress2.pendingProps,
          renderLanes2
        );
      case 15:
        return updateSimpleMemoComponent(
          current,
          workInProgress2,
          workInProgress2.type,
          workInProgress2.pendingProps,
          renderLanes2
        );
      case 19:
        return updateSuspenseListComponent(current, workInProgress2, renderLanes2);
      case 31:
        return updateActivityComponent(current, workInProgress2, renderLanes2);
      case 22:
        return updateOffscreenComponent(
          current,
          workInProgress2,
          renderLanes2,
          workInProgress2.pendingProps
        );
      case 24:
        return prepareToReadContext(workInProgress2), props = readContext(CacheContext), null === current ? ($$typeof = peekCacheFromPool(), null === $$typeof && ($$typeof = workInProgressRoot, prevState = createCache(), $$typeof.pooledCache = prevState, prevState.refCount++, null !== prevState && ($$typeof.pooledCacheLanes |= renderLanes2), $$typeof = prevState), workInProgress2.memoizedState = { parent: props, cache: $$typeof }, initializeUpdateQueue(workInProgress2), pushProvider(workInProgress2, CacheContext, $$typeof)) : (0 !== (current.lanes & renderLanes2) && (cloneUpdateQueue(current, workInProgress2), processUpdateQueue(workInProgress2, null, null, renderLanes2), suspendIfUpdateReadFromEntangledAsyncAction()), $$typeof = current.memoizedState, prevState = workInProgress2.memoizedState, $$typeof.parent !== props ? ($$typeof = { parent: props, cache: props }, workInProgress2.memoizedState = $$typeof, 0 === workInProgress2.lanes && (workInProgress2.memoizedState = workInProgress2.updateQueue.baseState = $$typeof), pushProvider(workInProgress2, CacheContext, props)) : (props = prevState.cache, pushProvider(workInProgress2, CacheContext, props), props !== $$typeof.cache && propagateContextChanges(
          workInProgress2,
          [CacheContext],
          renderLanes2,
          true
        ))), reconcileChildren(
          current,
          workInProgress2,
          workInProgress2.pendingProps.children,
          renderLanes2
        ), workInProgress2.child;
      case 29:
        throw workInProgress2.pendingProps;
    }
    throw Error(formatProdErrorMessage(156, workInProgress2.tag));
  }
  function markUpdate(workInProgress2) {
    workInProgress2.flags |= 4;
  }
  function preloadInstanceAndSuspendIfNeeded(workInProgress2, type, oldProps, newProps, renderLanes2) {
    if (type = 0 !== (workInProgress2.mode & 32)) type = false;
    if (type) {
      if (workInProgress2.flags |= 16777216, (renderLanes2 & 335544128) === renderLanes2)
        if (workInProgress2.stateNode.complete) workInProgress2.flags |= 8192;
        else if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
        else
          throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
    } else workInProgress2.flags &= -16777217;
  }
  function preloadResourceAndSuspendIfNeeded(workInProgress2, resource) {
    if ("stylesheet" !== resource.type || 0 !== (resource.state.loading & 4))
      workInProgress2.flags &= -16777217;
    else if (workInProgress2.flags |= 16777216, !preloadResource(resource))
      if (shouldRemainOnPreviousScreen()) workInProgress2.flags |= 8192;
      else
        throw suspendedThenable = noopSuspenseyCommitThenable, SuspenseyCommitException;
  }
  function scheduleRetryEffect(workInProgress2, retryQueue) {
    null !== retryQueue && (workInProgress2.flags |= 4);
    workInProgress2.flags & 16384 && (retryQueue = 22 !== workInProgress2.tag ? claimNextRetryLane() : 536870912, workInProgress2.lanes |= retryQueue, workInProgressSuspendedRetryLanes |= retryQueue);
  }
  function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
    if (!isHydrating)
      switch (renderState.tailMode) {
        case "hidden":
          hasRenderedATailFallback = renderState.tail;
          for (var lastTailNode = null; null !== hasRenderedATailFallback; )
            null !== hasRenderedATailFallback.alternate && (lastTailNode = hasRenderedATailFallback), hasRenderedATailFallback = hasRenderedATailFallback.sibling;
          null === lastTailNode ? renderState.tail = null : lastTailNode.sibling = null;
          break;
        case "collapsed":
          lastTailNode = renderState.tail;
          for (var lastTailNode$106 = null; null !== lastTailNode; )
            null !== lastTailNode.alternate && (lastTailNode$106 = lastTailNode), lastTailNode = lastTailNode.sibling;
          null === lastTailNode$106 ? hasRenderedATailFallback || null === renderState.tail ? renderState.tail = null : renderState.tail.sibling = null : lastTailNode$106.sibling = null;
      }
  }
  function bubbleProperties(completedWork) {
    var didBailout = null !== completedWork.alternate && completedWork.alternate.child === completedWork.child, newChildLanes = 0, subtreeFlags = 0;
    if (didBailout)
      for (var child$107 = completedWork.child; null !== child$107; )
        newChildLanes |= child$107.lanes | child$107.childLanes, subtreeFlags |= child$107.subtreeFlags & 65011712, subtreeFlags |= child$107.flags & 65011712, child$107.return = completedWork, child$107 = child$107.sibling;
    else
      for (child$107 = completedWork.child; null !== child$107; )
        newChildLanes |= child$107.lanes | child$107.childLanes, subtreeFlags |= child$107.subtreeFlags, subtreeFlags |= child$107.flags, child$107.return = completedWork, child$107 = child$107.sibling;
    completedWork.subtreeFlags |= subtreeFlags;
    completedWork.childLanes = newChildLanes;
    return didBailout;
  }
  function completeWork(current, workInProgress2, renderLanes2) {
    var newProps = workInProgress2.pendingProps;
    popTreeContext(workInProgress2);
    switch (workInProgress2.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return bubbleProperties(workInProgress2), null;
      case 1:
        return bubbleProperties(workInProgress2), null;
      case 3:
        renderLanes2 = workInProgress2.stateNode;
        newProps = null;
        null !== current && (newProps = current.memoizedState.cache);
        workInProgress2.memoizedState.cache !== newProps && (workInProgress2.flags |= 2048);
        popProvider(CacheContext);
        popHostContainer();
        renderLanes2.pendingContext && (renderLanes2.context = renderLanes2.pendingContext, renderLanes2.pendingContext = null);
        if (null === current || null === current.child)
          popHydrationState(workInProgress2) ? markUpdate(workInProgress2) : null === current || current.memoizedState.isDehydrated && 0 === (workInProgress2.flags & 256) || (workInProgress2.flags |= 1024, upgradeHydrationErrorsToRecoverable());
        bubbleProperties(workInProgress2);
        return null;
      case 26:
        var type = workInProgress2.type, nextResource = workInProgress2.memoizedState;
        null === current ? (markUpdate(workInProgress2), null !== nextResource ? (bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
          workInProgress2,
          type,
          null,
          newProps,
          renderLanes2
        ))) : nextResource ? nextResource !== current.memoizedState ? (markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadResourceAndSuspendIfNeeded(workInProgress2, nextResource)) : (bubbleProperties(workInProgress2), workInProgress2.flags &= -16777217) : (current = current.memoizedProps, current !== newProps && markUpdate(workInProgress2), bubbleProperties(workInProgress2), preloadInstanceAndSuspendIfNeeded(
          workInProgress2,
          type,
          current,
          newProps,
          renderLanes2
        ));
        return null;
      case 27:
        popHostContext(workInProgress2);
        renderLanes2 = rootInstanceStackCursor.current;
        type = workInProgress2.type;
        if (null !== current && null != workInProgress2.stateNode)
          current.memoizedProps !== newProps && markUpdate(workInProgress2);
        else {
          if (!newProps) {
            if (null === workInProgress2.stateNode)
              throw Error(formatProdErrorMessage(166));
            bubbleProperties(workInProgress2);
            return null;
          }
          current = contextStackCursor.current;
          popHydrationState(workInProgress2) ? prepareToHydrateHostInstance(workInProgress2) : (current = resolveSingletonInstance(type, newProps, renderLanes2), workInProgress2.stateNode = current, markUpdate(workInProgress2));
        }
        bubbleProperties(workInProgress2);
        return null;
      case 5:
        popHostContext(workInProgress2);
        type = workInProgress2.type;
        if (null !== current && null != workInProgress2.stateNode)
          current.memoizedProps !== newProps && markUpdate(workInProgress2);
        else {
          if (!newProps) {
            if (null === workInProgress2.stateNode)
              throw Error(formatProdErrorMessage(166));
            bubbleProperties(workInProgress2);
            return null;
          }
          nextResource = contextStackCursor.current;
          if (popHydrationState(workInProgress2))
            prepareToHydrateHostInstance(workInProgress2);
          else {
            var ownerDocument = getOwnerDocumentFromRootContainer(
              rootInstanceStackCursor.current
            );
            switch (nextResource) {
              case 1:
                nextResource = ownerDocument.createElementNS(
                  "http://www.w3.org/2000/svg",
                  type
                );
                break;
              case 2:
                nextResource = ownerDocument.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  type
                );
                break;
              default:
                switch (type) {
                  case "svg":
                    nextResource = ownerDocument.createElementNS(
                      "http://www.w3.org/2000/svg",
                      type
                    );
                    break;
                  case "math":
                    nextResource = ownerDocument.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      type
                    );
                    break;
                  case "script":
                    nextResource = ownerDocument.createElement("div");
                    nextResource.innerHTML = "<script><\/script>";
                    nextResource = nextResource.removeChild(
                      nextResource.firstChild
                    );
                    break;
                  case "select":
                    nextResource = "string" === typeof newProps.is ? ownerDocument.createElement("select", {
                      is: newProps.is
                    }) : ownerDocument.createElement("select");
                    newProps.multiple ? nextResource.multiple = true : newProps.size && (nextResource.size = newProps.size);
                    break;
                  default:
                    nextResource = "string" === typeof newProps.is ? ownerDocument.createElement(type, { is: newProps.is }) : ownerDocument.createElement(type);
                }
            }
            nextResource[internalInstanceKey] = workInProgress2;
            nextResource[internalPropsKey] = newProps;
            a: for (ownerDocument = workInProgress2.child; null !== ownerDocument; ) {
              if (5 === ownerDocument.tag || 6 === ownerDocument.tag)
                nextResource.appendChild(ownerDocument.stateNode);
              else if (4 !== ownerDocument.tag && 27 !== ownerDocument.tag && null !== ownerDocument.child) {
                ownerDocument.child.return = ownerDocument;
                ownerDocument = ownerDocument.child;
                continue;
              }
              if (ownerDocument === workInProgress2) break a;
              for (; null === ownerDocument.sibling; ) {
                if (null === ownerDocument.return || ownerDocument.return === workInProgress2)
                  break a;
                ownerDocument = ownerDocument.return;
              }
              ownerDocument.sibling.return = ownerDocument.return;
              ownerDocument = ownerDocument.sibling;
            }
            workInProgress2.stateNode = nextResource;
            a: switch (setInitialProperties(nextResource, type, newProps), type) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                newProps = !!newProps.autoFocus;
                break a;
              case "img":
                newProps = true;
                break a;
              default:
                newProps = false;
            }
            newProps && markUpdate(workInProgress2);
          }
        }
        bubbleProperties(workInProgress2);
        preloadInstanceAndSuspendIfNeeded(
          workInProgress2,
          workInProgress2.type,
          null === current ? null : current.memoizedProps,
          workInProgress2.pendingProps,
          renderLanes2
        );
        return null;
      case 6:
        if (current && null != workInProgress2.stateNode)
          current.memoizedProps !== newProps && markUpdate(workInProgress2);
        else {
          if ("string" !== typeof newProps && null === workInProgress2.stateNode)
            throw Error(formatProdErrorMessage(166));
          current = rootInstanceStackCursor.current;
          if (popHydrationState(workInProgress2)) {
            current = workInProgress2.stateNode;
            renderLanes2 = workInProgress2.memoizedProps;
            newProps = null;
            type = hydrationParentFiber;
            if (null !== type)
              switch (type.tag) {
                case 27:
                case 5:
                  newProps = type.memoizedProps;
              }
            current[internalInstanceKey] = workInProgress2;
            current = current.nodeValue === renderLanes2 || null !== newProps && true === newProps.suppressHydrationWarning || checkForUnmatchedText(current.nodeValue, renderLanes2) ? true : false;
            current || throwOnHydrationMismatch(workInProgress2, true);
          } else
            current = getOwnerDocumentFromRootContainer(current).createTextNode(
              newProps
            ), current[internalInstanceKey] = workInProgress2, workInProgress2.stateNode = current;
        }
        bubbleProperties(workInProgress2);
        return null;
      case 31:
        renderLanes2 = workInProgress2.memoizedState;
        if (null === current || null !== current.memoizedState) {
          newProps = popHydrationState(workInProgress2);
          if (null !== renderLanes2) {
            if (null === current) {
              if (!newProps) throw Error(formatProdErrorMessage(318));
              current = workInProgress2.memoizedState;
              current = null !== current ? current.dehydrated : null;
              if (!current) throw Error(formatProdErrorMessage(557));
              current[internalInstanceKey] = workInProgress2;
            } else
              resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
            bubbleProperties(workInProgress2);
            current = false;
          } else
            renderLanes2 = upgradeHydrationErrorsToRecoverable(), null !== current && null !== current.memoizedState && (current.memoizedState.hydrationErrors = renderLanes2), current = true;
          if (!current) {
            if (workInProgress2.flags & 256)
              return popSuspenseHandler(workInProgress2), workInProgress2;
            popSuspenseHandler(workInProgress2);
            return null;
          }
          if (0 !== (workInProgress2.flags & 128))
            throw Error(formatProdErrorMessage(558));
        }
        bubbleProperties(workInProgress2);
        return null;
      case 13:
        newProps = workInProgress2.memoizedState;
        if (null === current || null !== current.memoizedState && null !== current.memoizedState.dehydrated) {
          type = popHydrationState(workInProgress2);
          if (null !== newProps && null !== newProps.dehydrated) {
            if (null === current) {
              if (!type) throw Error(formatProdErrorMessage(318));
              type = workInProgress2.memoizedState;
              type = null !== type ? type.dehydrated : null;
              if (!type) throw Error(formatProdErrorMessage(317));
              type[internalInstanceKey] = workInProgress2;
            } else
              resetHydrationState(), 0 === (workInProgress2.flags & 128) && (workInProgress2.memoizedState = null), workInProgress2.flags |= 4;
            bubbleProperties(workInProgress2);
            type = false;
          } else
            type = upgradeHydrationErrorsToRecoverable(), null !== current && null !== current.memoizedState && (current.memoizedState.hydrationErrors = type), type = true;
          if (!type) {
            if (workInProgress2.flags & 256)
              return popSuspenseHandler(workInProgress2), workInProgress2;
            popSuspenseHandler(workInProgress2);
            return null;
          }
        }
        popSuspenseHandler(workInProgress2);
        if (0 !== (workInProgress2.flags & 128))
          return workInProgress2.lanes = renderLanes2, workInProgress2;
        renderLanes2 = null !== newProps;
        current = null !== current && null !== current.memoizedState;
        renderLanes2 && (newProps = workInProgress2.child, type = null, null !== newProps.alternate && null !== newProps.alternate.memoizedState && null !== newProps.alternate.memoizedState.cachePool && (type = newProps.alternate.memoizedState.cachePool.pool), nextResource = null, null !== newProps.memoizedState && null !== newProps.memoizedState.cachePool && (nextResource = newProps.memoizedState.cachePool.pool), nextResource !== type && (newProps.flags |= 2048));
        renderLanes2 !== current && renderLanes2 && (workInProgress2.child.flags |= 8192);
        scheduleRetryEffect(workInProgress2, workInProgress2.updateQueue);
        bubbleProperties(workInProgress2);
        return null;
      case 4:
        return popHostContainer(), null === current && listenToAllSupportedEvents(workInProgress2.stateNode.containerInfo), bubbleProperties(workInProgress2), null;
      case 10:
        return popProvider(workInProgress2.type), bubbleProperties(workInProgress2), null;
      case 19:
        pop(suspenseStackCursor);
        newProps = workInProgress2.memoizedState;
        if (null === newProps) return bubbleProperties(workInProgress2), null;
        type = 0 !== (workInProgress2.flags & 128);
        nextResource = newProps.rendering;
        if (null === nextResource)
          if (type) cutOffTailIfNeeded(newProps, false);
          else {
            if (0 !== workInProgressRootExitStatus || null !== current && 0 !== (current.flags & 128))
              for (current = workInProgress2.child; null !== current; ) {
                nextResource = findFirstSuspended(current);
                if (null !== nextResource) {
                  workInProgress2.flags |= 128;
                  cutOffTailIfNeeded(newProps, false);
                  current = nextResource.updateQueue;
                  workInProgress2.updateQueue = current;
                  scheduleRetryEffect(workInProgress2, current);
                  workInProgress2.subtreeFlags = 0;
                  current = renderLanes2;
                  for (renderLanes2 = workInProgress2.child; null !== renderLanes2; )
                    resetWorkInProgress(renderLanes2, current), renderLanes2 = renderLanes2.sibling;
                  push(
                    suspenseStackCursor,
                    suspenseStackCursor.current & 1 | 2
                  );
                  isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount);
                  return workInProgress2.child;
                }
                current = current.sibling;
              }
            null !== newProps.tail && now() > workInProgressRootRenderTargetTime && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
          }
        else {
          if (!type)
            if (current = findFirstSuspended(nextResource), null !== current) {
              if (workInProgress2.flags |= 128, type = true, current = current.updateQueue, workInProgress2.updateQueue = current, scheduleRetryEffect(workInProgress2, current), cutOffTailIfNeeded(newProps, true), null === newProps.tail && "hidden" === newProps.tailMode && !nextResource.alternate && !isHydrating)
                return bubbleProperties(workInProgress2), null;
            } else
              2 * now() - newProps.renderingStartTime > workInProgressRootRenderTargetTime && 536870912 !== renderLanes2 && (workInProgress2.flags |= 128, type = true, cutOffTailIfNeeded(newProps, false), workInProgress2.lanes = 4194304);
          newProps.isBackwards ? (nextResource.sibling = workInProgress2.child, workInProgress2.child = nextResource) : (current = newProps.last, null !== current ? current.sibling = nextResource : workInProgress2.child = nextResource, newProps.last = nextResource);
        }
        if (null !== newProps.tail)
          return current = newProps.tail, newProps.rendering = current, newProps.tail = current.sibling, newProps.renderingStartTime = now(), current.sibling = null, renderLanes2 = suspenseStackCursor.current, push(
            suspenseStackCursor,
            type ? renderLanes2 & 1 | 2 : renderLanes2 & 1
          ), isHydrating && pushTreeFork(workInProgress2, newProps.treeForkCount), current;
        bubbleProperties(workInProgress2);
        return null;
      case 22:
      case 23:
        return popSuspenseHandler(workInProgress2), popHiddenContext(), newProps = null !== workInProgress2.memoizedState, null !== current ? null !== current.memoizedState !== newProps && (workInProgress2.flags |= 8192) : newProps && (workInProgress2.flags |= 8192), newProps ? 0 !== (renderLanes2 & 536870912) && 0 === (workInProgress2.flags & 128) && (bubbleProperties(workInProgress2), workInProgress2.subtreeFlags & 6 && (workInProgress2.flags |= 8192)) : bubbleProperties(workInProgress2), renderLanes2 = workInProgress2.updateQueue, null !== renderLanes2 && scheduleRetryEffect(workInProgress2, renderLanes2.retryQueue), renderLanes2 = null, null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (renderLanes2 = current.memoizedState.cachePool.pool), newProps = null, null !== workInProgress2.memoizedState && null !== workInProgress2.memoizedState.cachePool && (newProps = workInProgress2.memoizedState.cachePool.pool), newProps !== renderLanes2 && (workInProgress2.flags |= 2048), null !== current && pop(resumedCache), null;
      case 24:
        return renderLanes2 = null, null !== current && (renderLanes2 = current.memoizedState.cache), workInProgress2.memoizedState.cache !== renderLanes2 && (workInProgress2.flags |= 2048), popProvider(CacheContext), bubbleProperties(workInProgress2), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(formatProdErrorMessage(156, workInProgress2.tag));
  }
  function unwindWork(current, workInProgress2) {
    popTreeContext(workInProgress2);
    switch (workInProgress2.tag) {
      case 1:
        return current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
      case 3:
        return popProvider(CacheContext), popHostContainer(), current = workInProgress2.flags, 0 !== (current & 65536) && 0 === (current & 128) ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
      case 26:
      case 27:
      case 5:
        return popHostContext(workInProgress2), null;
      case 31:
        if (null !== workInProgress2.memoizedState) {
          popSuspenseHandler(workInProgress2);
          if (null === workInProgress2.alternate)
            throw Error(formatProdErrorMessage(340));
          resetHydrationState();
        }
        current = workInProgress2.flags;
        return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
      case 13:
        popSuspenseHandler(workInProgress2);
        current = workInProgress2.memoizedState;
        if (null !== current && null !== current.dehydrated) {
          if (null === workInProgress2.alternate)
            throw Error(formatProdErrorMessage(340));
          resetHydrationState();
        }
        current = workInProgress2.flags;
        return current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
      case 19:
        return pop(suspenseStackCursor), null;
      case 4:
        return popHostContainer(), null;
      case 10:
        return popProvider(workInProgress2.type), null;
      case 22:
      case 23:
        return popSuspenseHandler(workInProgress2), popHiddenContext(), null !== current && pop(resumedCache), current = workInProgress2.flags, current & 65536 ? (workInProgress2.flags = current & -65537 | 128, workInProgress2) : null;
      case 24:
        return popProvider(CacheContext), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function unwindInterruptedWork(current, interruptedWork) {
    popTreeContext(interruptedWork);
    switch (interruptedWork.tag) {
      case 3:
        popProvider(CacheContext);
        popHostContainer();
        break;
      case 26:
      case 27:
      case 5:
        popHostContext(interruptedWork);
        break;
      case 4:
        popHostContainer();
        break;
      case 31:
        null !== interruptedWork.memoizedState && popSuspenseHandler(interruptedWork);
        break;
      case 13:
        popSuspenseHandler(interruptedWork);
        break;
      case 19:
        pop(suspenseStackCursor);
        break;
      case 10:
        popProvider(interruptedWork.type);
        break;
      case 22:
      case 23:
        popSuspenseHandler(interruptedWork);
        popHiddenContext();
        null !== current && pop(resumedCache);
        break;
      case 24:
        popProvider(CacheContext);
    }
  }
  function commitHookEffectListMount(flags, finishedWork) {
    try {
      var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
      if (null !== lastEffect) {
        var firstEffect = lastEffect.next;
        updateQueue = firstEffect;
        do {
          if ((updateQueue.tag & flags) === flags) {
            lastEffect = void 0;
            var create = updateQueue.create, inst = updateQueue.inst;
            lastEffect = create();
            inst.destroy = lastEffect;
          }
          updateQueue = updateQueue.next;
        } while (updateQueue !== firstEffect);
      }
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
  function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor$jscomp$0) {
    try {
      var updateQueue = finishedWork.updateQueue, lastEffect = null !== updateQueue ? updateQueue.lastEffect : null;
      if (null !== lastEffect) {
        var firstEffect = lastEffect.next;
        updateQueue = firstEffect;
        do {
          if ((updateQueue.tag & flags) === flags) {
            var inst = updateQueue.inst, destroy = inst.destroy;
            if (void 0 !== destroy) {
              inst.destroy = void 0;
              lastEffect = finishedWork;
              var nearestMountedAncestor = nearestMountedAncestor$jscomp$0, destroy_ = destroy;
              try {
                destroy_();
              } catch (error) {
                captureCommitPhaseError(
                  lastEffect,
                  nearestMountedAncestor,
                  error
                );
              }
            }
          }
          updateQueue = updateQueue.next;
        } while (updateQueue !== firstEffect);
      }
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
  function commitClassCallbacks(finishedWork) {
    var updateQueue = finishedWork.updateQueue;
    if (null !== updateQueue) {
      var instance = finishedWork.stateNode;
      try {
        commitCallbacks(updateQueue, instance);
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
  }
  function safelyCallComponentWillUnmount(current, nearestMountedAncestor, instance) {
    instance.props = resolveClassComponentProps(
      current.type,
      current.memoizedProps
    );
    instance.state = current.memoizedState;
    try {
      instance.componentWillUnmount();
    } catch (error) {
      captureCommitPhaseError(current, nearestMountedAncestor, error);
    }
  }
  function safelyAttachRef(current, nearestMountedAncestor) {
    try {
      var ref = current.ref;
      if (null !== ref) {
        switch (current.tag) {
          case 26:
          case 27:
          case 5:
            var instanceToUse = current.stateNode;
            break;
          case 30:
            instanceToUse = current.stateNode;
            break;
          default:
            instanceToUse = current.stateNode;
        }
        "function" === typeof ref ? current.refCleanup = ref(instanceToUse) : ref.current = instanceToUse;
      }
    } catch (error) {
      captureCommitPhaseError(current, nearestMountedAncestor, error);
    }
  }
  function safelyDetachRef(current, nearestMountedAncestor) {
    var ref = current.ref, refCleanup = current.refCleanup;
    if (null !== ref)
      if ("function" === typeof refCleanup)
        try {
          refCleanup();
        } catch (error) {
          captureCommitPhaseError(current, nearestMountedAncestor, error);
        } finally {
          current.refCleanup = null, current = current.alternate, null != current && (current.refCleanup = null);
        }
      else if ("function" === typeof ref)
        try {
          ref(null);
        } catch (error$140) {
          captureCommitPhaseError(current, nearestMountedAncestor, error$140);
        }
      else ref.current = null;
  }
  function commitHostMount(finishedWork) {
    var type = finishedWork.type, props = finishedWork.memoizedProps, instance = finishedWork.stateNode;
    try {
      a: switch (type) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          props.autoFocus && instance.focus();
          break a;
        case "img":
          props.src ? instance.src = props.src : props.srcSet && (instance.srcset = props.srcSet);
      }
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
  function commitHostUpdate(finishedWork, newProps, oldProps) {
    try {
      var domElement = finishedWork.stateNode;
      updateProperties(domElement, finishedWork.type, oldProps, newProps);
      domElement[internalPropsKey] = newProps;
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
  function isHostParent(fiber) {
    return 5 === fiber.tag || 3 === fiber.tag || 26 === fiber.tag || 27 === fiber.tag && isSingletonScope(fiber.type) || 4 === fiber.tag;
  }
  function getHostSibling(fiber) {
    a: for (; ; ) {
      for (; null === fiber.sibling; ) {
        if (null === fiber.return || isHostParent(fiber.return)) return null;
        fiber = fiber.return;
      }
      fiber.sibling.return = fiber.return;
      for (fiber = fiber.sibling; 5 !== fiber.tag && 6 !== fiber.tag && 18 !== fiber.tag; ) {
        if (27 === fiber.tag && isSingletonScope(fiber.type)) continue a;
        if (fiber.flags & 2) continue a;
        if (null === fiber.child || 4 === fiber.tag) continue a;
        else fiber.child.return = fiber, fiber = fiber.child;
      }
      if (!(fiber.flags & 2)) return fiber.stateNode;
    }
  }
  function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
    var tag = node.tag;
    if (5 === tag || 6 === tag)
      node = node.stateNode, before ? (9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent).insertBefore(node, before) : (before = 9 === parent.nodeType ? parent.body : "HTML" === parent.nodeName ? parent.ownerDocument.body : parent, before.appendChild(node), parent = parent._reactRootContainer, null !== parent && void 0 !== parent || null !== before.onclick || (before.onclick = noop$1));
    else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode, before = null), node = node.child, null !== node))
      for (insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling; null !== node; )
        insertOrAppendPlacementNodeIntoContainer(node, before, parent), node = node.sibling;
  }
  function insertOrAppendPlacementNode(node, before, parent) {
    var tag = node.tag;
    if (5 === tag || 6 === tag)
      node = node.stateNode, before ? parent.insertBefore(node, before) : parent.appendChild(node);
    else if (4 !== tag && (27 === tag && isSingletonScope(node.type) && (parent = node.stateNode), node = node.child, null !== node))
      for (insertOrAppendPlacementNode(node, before, parent), node = node.sibling; null !== node; )
        insertOrAppendPlacementNode(node, before, parent), node = node.sibling;
  }
  function commitHostSingletonAcquisition(finishedWork) {
    var singleton = finishedWork.stateNode, props = finishedWork.memoizedProps;
    try {
      for (var type = finishedWork.type, attributes = singleton.attributes; attributes.length; )
        singleton.removeAttributeNode(attributes[0]);
      setInitialProperties(singleton, type, props);
      singleton[internalInstanceKey] = finishedWork;
      singleton[internalPropsKey] = props;
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
  }
  var offscreenSubtreeIsHidden = false, offscreenSubtreeWasHidden = false, needsFormReset = false, PossiblyWeakSet = "function" === typeof WeakSet ? WeakSet : Set, nextEffect = null;
  function commitBeforeMutationEffects(root2, firstChild) {
    root2 = root2.containerInfo;
    eventsEnabled = _enabled;
    root2 = getActiveElementDeep(root2);
    if (hasSelectionCapabilities(root2)) {
      if ("selectionStart" in root2)
        var JSCompiler_temp = {
          start: root2.selectionStart,
          end: root2.selectionEnd
        };
      else
        a: {
          JSCompiler_temp = (JSCompiler_temp = root2.ownerDocument) && JSCompiler_temp.defaultView || window;
          var selection = JSCompiler_temp.getSelection && JSCompiler_temp.getSelection();
          if (selection && 0 !== selection.rangeCount) {
            JSCompiler_temp = selection.anchorNode;
            var anchorOffset = selection.anchorOffset, focusNode = selection.focusNode;
            selection = selection.focusOffset;
            try {
              JSCompiler_temp.nodeType, focusNode.nodeType;
            } catch (e$20) {
              JSCompiler_temp = null;
              break a;
            }
            var length = 0, start = -1, end = -1, indexWithinAnchor = 0, indexWithinFocus = 0, node = root2, parentNode = null;
            b: for (; ; ) {
              for (var next; ; ) {
                node !== JSCompiler_temp || 0 !== anchorOffset && 3 !== node.nodeType || (start = length + anchorOffset);
                node !== focusNode || 0 !== selection && 3 !== node.nodeType || (end = length + selection);
                3 === node.nodeType && (length += node.nodeValue.length);
                if (null === (next = node.firstChild)) break;
                parentNode = node;
                node = next;
              }
              for (; ; ) {
                if (node === root2) break b;
                parentNode === JSCompiler_temp && ++indexWithinAnchor === anchorOffset && (start = length);
                parentNode === focusNode && ++indexWithinFocus === selection && (end = length);
                if (null !== (next = node.nextSibling)) break;
                node = parentNode;
                parentNode = node.parentNode;
              }
              node = next;
            }
            JSCompiler_temp = -1 === start || -1 === end ? null : { start, end };
          } else JSCompiler_temp = null;
        }
      JSCompiler_temp = JSCompiler_temp || { start: 0, end: 0 };
    } else JSCompiler_temp = null;
    selectionInformation = { focusedElem: root2, selectionRange: JSCompiler_temp };
    _enabled = false;
    for (nextEffect = firstChild; null !== nextEffect; )
      if (firstChild = nextEffect, root2 = firstChild.child, 0 !== (firstChild.subtreeFlags & 1028) && null !== root2)
        root2.return = firstChild, nextEffect = root2;
      else
        for (; null !== nextEffect; ) {
          firstChild = nextEffect;
          focusNode = firstChild.alternate;
          root2 = firstChild.flags;
          switch (firstChild.tag) {
            case 0:
              if (0 !== (root2 & 4) && (root2 = firstChild.updateQueue, root2 = null !== root2 ? root2.events : null, null !== root2))
                for (JSCompiler_temp = 0; JSCompiler_temp < root2.length; JSCompiler_temp++)
                  anchorOffset = root2[JSCompiler_temp], anchorOffset.ref.impl = anchorOffset.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if (0 !== (root2 & 1024) && null !== focusNode) {
                root2 = void 0;
                JSCompiler_temp = firstChild;
                anchorOffset = focusNode.memoizedProps;
                focusNode = focusNode.memoizedState;
                selection = JSCompiler_temp.stateNode;
                try {
                  var resolvedPrevProps = resolveClassComponentProps(
                    JSCompiler_temp.type,
                    anchorOffset
                  );
                  root2 = selection.getSnapshotBeforeUpdate(
                    resolvedPrevProps,
                    focusNode
                  );
                  selection.__reactInternalSnapshotBeforeUpdate = root2;
                } catch (error) {
                  captureCommitPhaseError(
                    JSCompiler_temp,
                    JSCompiler_temp.return,
                    error
                  );
                }
              }
              break;
            case 3:
              if (0 !== (root2 & 1024)) {
                if (root2 = firstChild.stateNode.containerInfo, JSCompiler_temp = root2.nodeType, 9 === JSCompiler_temp)
                  clearContainerSparingly(root2);
                else if (1 === JSCompiler_temp)
                  switch (root2.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      clearContainerSparingly(root2);
                      break;
                    default:
                      root2.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if (0 !== (root2 & 1024)) throw Error(formatProdErrorMessage(163));
          }
          root2 = firstChild.sibling;
          if (null !== root2) {
            root2.return = firstChild.return;
            nextEffect = root2;
            break;
          }
          nextEffect = firstChild.return;
        }
  }
  function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
    var flags = finishedWork.flags;
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 15:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        flags & 4 && commitHookEffectListMount(5, finishedWork);
        break;
      case 1:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        if (flags & 4)
          if (finishedRoot = finishedWork.stateNode, null === current)
            try {
              finishedRoot.componentDidMount();
            } catch (error) {
              captureCommitPhaseError(finishedWork, finishedWork.return, error);
            }
          else {
            var prevProps = resolveClassComponentProps(
              finishedWork.type,
              current.memoizedProps
            );
            current = current.memoizedState;
            try {
              finishedRoot.componentDidUpdate(
                prevProps,
                current,
                finishedRoot.__reactInternalSnapshotBeforeUpdate
              );
            } catch (error$139) {
              captureCommitPhaseError(
                finishedWork,
                finishedWork.return,
                error$139
              );
            }
          }
        flags & 64 && commitClassCallbacks(finishedWork);
        flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
        break;
      case 3:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        if (flags & 64 && (finishedRoot = finishedWork.updateQueue, null !== finishedRoot)) {
          current = null;
          if (null !== finishedWork.child)
            switch (finishedWork.child.tag) {
              case 27:
              case 5:
                current = finishedWork.child.stateNode;
                break;
              case 1:
                current = finishedWork.child.stateNode;
            }
          try {
            commitCallbacks(finishedRoot, current);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
        break;
      case 27:
        null === current && flags & 4 && commitHostSingletonAcquisition(finishedWork);
      case 26:
      case 5:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        null === current && flags & 4 && commitHostMount(finishedWork);
        flags & 512 && safelyAttachRef(finishedWork, finishedWork.return);
        break;
      case 12:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        break;
      case 31:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
        break;
      case 13:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
        flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
        flags & 64 && (finishedRoot = finishedWork.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot && (finishedWork = retryDehydratedSuspenseBoundary.bind(
          null,
          finishedWork
        ), registerSuspenseInstanceRetry(finishedRoot, finishedWork))));
        break;
      case 22:
        flags = null !== finishedWork.memoizedState || offscreenSubtreeIsHidden;
        if (!flags) {
          current = null !== current && null !== current.memoizedState || offscreenSubtreeWasHidden;
          prevProps = offscreenSubtreeIsHidden;
          var prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
          offscreenSubtreeIsHidden = flags;
          (offscreenSubtreeWasHidden = current) && !prevOffscreenSubtreeWasHidden ? recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            0 !== (finishedWork.subtreeFlags & 8772)
          ) : recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
          offscreenSubtreeIsHidden = prevProps;
          offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
        }
        break;
      case 30:
        break;
      default:
        recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
    }
  }
  function detachFiberAfterEffects(fiber) {
    var alternate = fiber.alternate;
    null !== alternate && (fiber.alternate = null, detachFiberAfterEffects(alternate));
    fiber.child = null;
    fiber.deletions = null;
    fiber.sibling = null;
    5 === fiber.tag && (alternate = fiber.stateNode, null !== alternate && detachDeletedInstance(alternate));
    fiber.stateNode = null;
    fiber.return = null;
    fiber.dependencies = null;
    fiber.memoizedProps = null;
    fiber.memoizedState = null;
    fiber.pendingProps = null;
    fiber.stateNode = null;
    fiber.updateQueue = null;
  }
  var hostParent = null, hostParentIsContainer = false;
  function recursivelyTraverseDeletionEffects(finishedRoot, nearestMountedAncestor, parent) {
    for (parent = parent.child; null !== parent; )
      commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, parent), parent = parent.sibling;
  }
  function commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, deletedFiber) {
    if (injectedHook && "function" === typeof injectedHook.onCommitFiberUnmount)
      try {
        injectedHook.onCommitFiberUnmount(rendererID, deletedFiber);
      } catch (err) {
      }
    switch (deletedFiber.tag) {
      case 26:
        offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        deletedFiber.memoizedState ? deletedFiber.memoizedState.count-- : deletedFiber.stateNode && (deletedFiber = deletedFiber.stateNode, deletedFiber.parentNode.removeChild(deletedFiber));
        break;
      case 27:
        offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
        var prevHostParent = hostParent, prevHostParentIsContainer = hostParentIsContainer;
        isSingletonScope(deletedFiber.type) && (hostParent = deletedFiber.stateNode, hostParentIsContainer = false);
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        releaseSingletonInstance(deletedFiber.stateNode);
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;
        break;
      case 5:
        offscreenSubtreeWasHidden || safelyDetachRef(deletedFiber, nearestMountedAncestor);
      case 6:
        prevHostParent = hostParent;
        prevHostParentIsContainer = hostParentIsContainer;
        hostParent = null;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;
        if (null !== hostParent)
          if (hostParentIsContainer)
            try {
              (9 === hostParent.nodeType ? hostParent.body : "HTML" === hostParent.nodeName ? hostParent.ownerDocument.body : hostParent).removeChild(deletedFiber.stateNode);
            } catch (error) {
              captureCommitPhaseError(
                deletedFiber,
                nearestMountedAncestor,
                error
              );
            }
          else
            try {
              hostParent.removeChild(deletedFiber.stateNode);
            } catch (error) {
              captureCommitPhaseError(
                deletedFiber,
                nearestMountedAncestor,
                error
              );
            }
        break;
      case 18:
        null !== hostParent && (hostParentIsContainer ? (finishedRoot = hostParent, clearHydrationBoundary(
          9 === finishedRoot.nodeType ? finishedRoot.body : "HTML" === finishedRoot.nodeName ? finishedRoot.ownerDocument.body : finishedRoot,
          deletedFiber.stateNode
        ), retryIfBlockedOn(finishedRoot)) : clearHydrationBoundary(hostParent, deletedFiber.stateNode));
        break;
      case 4:
        prevHostParent = hostParent;
        prevHostParentIsContainer = hostParentIsContainer;
        hostParent = deletedFiber.stateNode.containerInfo;
        hostParentIsContainer = true;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        commitHookEffectListUnmount(2, deletedFiber, nearestMountedAncestor);
        offscreenSubtreeWasHidden || commitHookEffectListUnmount(4, deletedFiber, nearestMountedAncestor);
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        break;
      case 1:
        offscreenSubtreeWasHidden || (safelyDetachRef(deletedFiber, nearestMountedAncestor), prevHostParent = deletedFiber.stateNode, "function" === typeof prevHostParent.componentWillUnmount && safelyCallComponentWillUnmount(
          deletedFiber,
          nearestMountedAncestor,
          prevHostParent
        ));
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        break;
      case 21:
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        break;
      case 22:
        offscreenSubtreeWasHidden = (prevHostParent = offscreenSubtreeWasHidden) || null !== deletedFiber.memoizedState;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
        offscreenSubtreeWasHidden = prevHostParent;
        break;
      default:
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber
        );
    }
  }
  function commitActivityHydrationCallbacks(finishedRoot, finishedWork) {
    if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot))) {
      finishedRoot = finishedRoot.dehydrated;
      try {
        retryIfBlockedOn(finishedRoot);
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
    }
  }
  function commitSuspenseHydrationCallbacks(finishedRoot, finishedWork) {
    if (null === finishedWork.memoizedState && (finishedRoot = finishedWork.alternate, null !== finishedRoot && (finishedRoot = finishedRoot.memoizedState, null !== finishedRoot && (finishedRoot = finishedRoot.dehydrated, null !== finishedRoot))))
      try {
        retryIfBlockedOn(finishedRoot);
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
  }
  function getRetryCache(finishedWork) {
    switch (finishedWork.tag) {
      case 31:
      case 13:
      case 19:
        var retryCache = finishedWork.stateNode;
        null === retryCache && (retryCache = finishedWork.stateNode = new PossiblyWeakSet());
        return retryCache;
      case 22:
        return finishedWork = finishedWork.stateNode, retryCache = finishedWork._retryCache, null === retryCache && (retryCache = finishedWork._retryCache = new PossiblyWeakSet()), retryCache;
      default:
        throw Error(formatProdErrorMessage(435, finishedWork.tag));
    }
  }
  function attachSuspenseRetryListeners(finishedWork, wakeables) {
    var retryCache = getRetryCache(finishedWork);
    wakeables.forEach(function(wakeable) {
      if (!retryCache.has(wakeable)) {
        retryCache.add(wakeable);
        var retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
        wakeable.then(retry, retry);
      }
    });
  }
  function recursivelyTraverseMutationEffects(root$jscomp$0, parentFiber) {
    var deletions = parentFiber.deletions;
    if (null !== deletions)
      for (var i = 0; i < deletions.length; i++) {
        var childToDelete = deletions[i], root2 = root$jscomp$0, returnFiber = parentFiber, parent = returnFiber;
        a: for (; null !== parent; ) {
          switch (parent.tag) {
            case 27:
              if (isSingletonScope(parent.type)) {
                hostParent = parent.stateNode;
                hostParentIsContainer = false;
                break a;
              }
              break;
            case 5:
              hostParent = parent.stateNode;
              hostParentIsContainer = false;
              break a;
            case 3:
            case 4:
              hostParent = parent.stateNode.containerInfo;
              hostParentIsContainer = true;
              break a;
          }
          parent = parent.return;
        }
        if (null === hostParent) throw Error(formatProdErrorMessage(160));
        commitDeletionEffectsOnFiber(root2, returnFiber, childToDelete);
        hostParent = null;
        hostParentIsContainer = false;
        root2 = childToDelete.alternate;
        null !== root2 && (root2.return = null);
        childToDelete.return = null;
      }
    if (parentFiber.subtreeFlags & 13886)
      for (parentFiber = parentFiber.child; null !== parentFiber; )
        commitMutationEffectsOnFiber(parentFiber, root$jscomp$0), parentFiber = parentFiber.sibling;
  }
  var currentHoistableRoot = null;
  function commitMutationEffectsOnFiber(finishedWork, root2) {
    var current = finishedWork.alternate, flags = finishedWork.flags;
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 4 && (commitHookEffectListUnmount(3, finishedWork, finishedWork.return), commitHookEffectListMount(3, finishedWork), commitHookEffectListUnmount(5, finishedWork, finishedWork.return));
        break;
      case 1:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
        flags & 64 && offscreenSubtreeIsHidden && (finishedWork = finishedWork.updateQueue, null !== finishedWork && (flags = finishedWork.callbacks, null !== flags && (current = finishedWork.shared.hiddenCallbacks, finishedWork.shared.hiddenCallbacks = null === current ? flags : current.concat(flags))));
        break;
      case 26:
        var hoistableRoot = currentHoistableRoot;
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
        if (flags & 4) {
          var currentResource = null !== current ? current.memoizedState : null;
          flags = finishedWork.memoizedState;
          if (null === current)
            if (null === flags)
              if (null === finishedWork.stateNode) {
                a: {
                  flags = finishedWork.type;
                  current = finishedWork.memoizedProps;
                  hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
                  b: switch (flags) {
                    case "title":
                      currentResource = hoistableRoot.getElementsByTagName("title")[0];
                      if (!currentResource || currentResource[internalHoistableMarker] || currentResource[internalInstanceKey] || "http://www.w3.org/2000/svg" === currentResource.namespaceURI || currentResource.hasAttribute("itemprop"))
                        currentResource = hoistableRoot.createElement(flags), hoistableRoot.head.insertBefore(
                          currentResource,
                          hoistableRoot.querySelector("head > title")
                        );
                      setInitialProperties(currentResource, flags, current);
                      currentResource[internalInstanceKey] = finishedWork;
                      markNodeAsHoistable(currentResource);
                      flags = currentResource;
                      break a;
                    case "link":
                      var maybeNodes = getHydratableHoistableCache(
                        "link",
                        "href",
                        hoistableRoot
                      ).get(flags + (current.href || ""));
                      if (maybeNodes) {
                        for (var i = 0; i < maybeNodes.length; i++)
                          if (currentResource = maybeNodes[i], currentResource.getAttribute("href") === (null == current.href || "" === current.href ? null : current.href) && currentResource.getAttribute("rel") === (null == current.rel ? null : current.rel) && currentResource.getAttribute("title") === (null == current.title ? null : current.title) && currentResource.getAttribute("crossorigin") === (null == current.crossOrigin ? null : current.crossOrigin)) {
                            maybeNodes.splice(i, 1);
                            break b;
                          }
                      }
                      currentResource = hoistableRoot.createElement(flags);
                      setInitialProperties(currentResource, flags, current);
                      hoistableRoot.head.appendChild(currentResource);
                      break;
                    case "meta":
                      if (maybeNodes = getHydratableHoistableCache(
                        "meta",
                        "content",
                        hoistableRoot
                      ).get(flags + (current.content || ""))) {
                        for (i = 0; i < maybeNodes.length; i++)
                          if (currentResource = maybeNodes[i], currentResource.getAttribute("content") === (null == current.content ? null : "" + current.content) && currentResource.getAttribute("name") === (null == current.name ? null : current.name) && currentResource.getAttribute("property") === (null == current.property ? null : current.property) && currentResource.getAttribute("http-equiv") === (null == current.httpEquiv ? null : current.httpEquiv) && currentResource.getAttribute("charset") === (null == current.charSet ? null : current.charSet)) {
                            maybeNodes.splice(i, 1);
                            break b;
                          }
                      }
                      currentResource = hoistableRoot.createElement(flags);
                      setInitialProperties(currentResource, flags, current);
                      hoistableRoot.head.appendChild(currentResource);
                      break;
                    default:
                      throw Error(formatProdErrorMessage(468, flags));
                  }
                  currentResource[internalInstanceKey] = finishedWork;
                  markNodeAsHoistable(currentResource);
                  flags = currentResource;
                }
                finishedWork.stateNode = flags;
              } else
                mountHoistable(
                  hoistableRoot,
                  finishedWork.type,
                  finishedWork.stateNode
                );
            else
              finishedWork.stateNode = acquireResource(
                hoistableRoot,
                flags,
                finishedWork.memoizedProps
              );
          else
            currentResource !== flags ? (null === currentResource ? null !== current.stateNode && (current = current.stateNode, current.parentNode.removeChild(current)) : currentResource.count--, null === flags ? mountHoistable(
              hoistableRoot,
              finishedWork.type,
              finishedWork.stateNode
            ) : acquireResource(
              hoistableRoot,
              flags,
              finishedWork.memoizedProps
            )) : null === flags && null !== finishedWork.stateNode && commitHostUpdate(
              finishedWork,
              finishedWork.memoizedProps,
              current.memoizedProps
            );
        }
        break;
      case 27:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
        null !== current && flags & 4 && commitHostUpdate(
          finishedWork,
          finishedWork.memoizedProps,
          current.memoizedProps
        );
        break;
      case 5:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 512 && (offscreenSubtreeWasHidden || null === current || safelyDetachRef(current, current.return));
        if (finishedWork.flags & 32) {
          hoistableRoot = finishedWork.stateNode;
          try {
            setTextContent(hoistableRoot, "");
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
        flags & 4 && null != finishedWork.stateNode && (hoistableRoot = finishedWork.memoizedProps, commitHostUpdate(
          finishedWork,
          hoistableRoot,
          null !== current ? current.memoizedProps : hoistableRoot
        ));
        flags & 1024 && (needsFormReset = true);
        break;
      case 6:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        if (flags & 4) {
          if (null === finishedWork.stateNode)
            throw Error(formatProdErrorMessage(162));
          flags = finishedWork.memoizedProps;
          current = finishedWork.stateNode;
          try {
            current.nodeValue = flags;
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
        break;
      case 3:
        tagCaches = null;
        hoistableRoot = currentHoistableRoot;
        currentHoistableRoot = getHoistableRoot(root2.containerInfo);
        recursivelyTraverseMutationEffects(root2, finishedWork);
        currentHoistableRoot = hoistableRoot;
        commitReconciliationEffects(finishedWork);
        if (flags & 4 && null !== current && current.memoizedState.isDehydrated)
          try {
            retryIfBlockedOn(root2.containerInfo);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        needsFormReset && (needsFormReset = false, recursivelyResetForms(finishedWork));
        break;
      case 4:
        flags = currentHoistableRoot;
        currentHoistableRoot = getHoistableRoot(
          finishedWork.stateNode.containerInfo
        );
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        currentHoistableRoot = flags;
        break;
      case 12:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        break;
      case 31:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
        break;
      case 13:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        finishedWork.child.flags & 8192 && null !== finishedWork.memoizedState !== (null !== current && null !== current.memoizedState) && (globalMostRecentFallbackTime = now());
        flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
        break;
      case 22:
        hoistableRoot = null !== finishedWork.memoizedState;
        var wasHidden = null !== current && null !== current.memoizedState, prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden, prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
        offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden || hoistableRoot;
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
        recursivelyTraverseMutationEffects(root2, finishedWork);
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
        offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
        commitReconciliationEffects(finishedWork);
        if (flags & 8192)
          a: for (root2 = finishedWork.stateNode, root2._visibility = hoistableRoot ? root2._visibility & -2 : root2._visibility | 1, hoistableRoot && (null === current || wasHidden || offscreenSubtreeIsHidden || offscreenSubtreeWasHidden || recursivelyTraverseDisappearLayoutEffects(finishedWork)), current = null, root2 = finishedWork; ; ) {
            if (5 === root2.tag || 26 === root2.tag) {
              if (null === current) {
                wasHidden = current = root2;
                try {
                  if (currentResource = wasHidden.stateNode, hoistableRoot)
                    maybeNodes = currentResource.style, "function" === typeof maybeNodes.setProperty ? maybeNodes.setProperty("display", "none", "important") : maybeNodes.display = "none";
                  else {
                    i = wasHidden.stateNode;
                    var styleProp = wasHidden.memoizedProps.style, display = void 0 !== styleProp && null !== styleProp && styleProp.hasOwnProperty("display") ? styleProp.display : null;
                    i.style.display = null == display || "boolean" === typeof display ? "" : ("" + display).trim();
                  }
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if (6 === root2.tag) {
              if (null === current) {
                wasHidden = root2;
                try {
                  wasHidden.stateNode.nodeValue = hoistableRoot ? "" : wasHidden.memoizedProps;
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if (18 === root2.tag) {
              if (null === current) {
                wasHidden = root2;
                try {
                  var instance = wasHidden.stateNode;
                  hoistableRoot ? hideOrUnhideDehydratedBoundary(instance, true) : hideOrUnhideDehydratedBoundary(wasHidden.stateNode, false);
                } catch (error) {
                  captureCommitPhaseError(wasHidden, wasHidden.return, error);
                }
              }
            } else if ((22 !== root2.tag && 23 !== root2.tag || null === root2.memoizedState || root2 === finishedWork) && null !== root2.child) {
              root2.child.return = root2;
              root2 = root2.child;
              continue;
            }
            if (root2 === finishedWork) break a;
            for (; null === root2.sibling; ) {
              if (null === root2.return || root2.return === finishedWork) break a;
              current === root2 && (current = null);
              root2 = root2.return;
            }
            current === root2 && (current = null);
            root2.sibling.return = root2.return;
            root2 = root2.sibling;
          }
        flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (current = flags.retryQueue, null !== current && (flags.retryQueue = null, attachSuspenseRetryListeners(finishedWork, current))));
        break;
      case 19:
        recursivelyTraverseMutationEffects(root2, finishedWork);
        commitReconciliationEffects(finishedWork);
        flags & 4 && (flags = finishedWork.updateQueue, null !== flags && (finishedWork.updateQueue = null, attachSuspenseRetryListeners(finishedWork, flags)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        recursivelyTraverseMutationEffects(root2, finishedWork), commitReconciliationEffects(finishedWork);
    }
  }
  function commitReconciliationEffects(finishedWork) {
    var flags = finishedWork.flags;
    if (flags & 2) {
      try {
        for (var hostParentFiber, parentFiber = finishedWork.return; null !== parentFiber; ) {
          if (isHostParent(parentFiber)) {
            hostParentFiber = parentFiber;
            break;
          }
          parentFiber = parentFiber.return;
        }
        if (null == hostParentFiber) throw Error(formatProdErrorMessage(160));
        switch (hostParentFiber.tag) {
          case 27:
            var parent = hostParentFiber.stateNode, before = getHostSibling(finishedWork);
            insertOrAppendPlacementNode(finishedWork, before, parent);
            break;
          case 5:
            var parent$141 = hostParentFiber.stateNode;
            hostParentFiber.flags & 32 && (setTextContent(parent$141, ""), hostParentFiber.flags &= -33);
            var before$142 = getHostSibling(finishedWork);
            insertOrAppendPlacementNode(finishedWork, before$142, parent$141);
            break;
          case 3:
          case 4:
            var parent$143 = hostParentFiber.stateNode.containerInfo, before$144 = getHostSibling(finishedWork);
            insertOrAppendPlacementNodeIntoContainer(
              finishedWork,
              before$144,
              parent$143
            );
            break;
          default:
            throw Error(formatProdErrorMessage(161));
        }
      } catch (error) {
        captureCommitPhaseError(finishedWork, finishedWork.return, error);
      }
      finishedWork.flags &= -3;
    }
    flags & 4096 && (finishedWork.flags &= -4097);
  }
  function recursivelyResetForms(parentFiber) {
    if (parentFiber.subtreeFlags & 1024)
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        var fiber = parentFiber;
        recursivelyResetForms(fiber);
        5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
        parentFiber = parentFiber.sibling;
      }
  }
  function recursivelyTraverseLayoutEffects(root2, parentFiber) {
    if (parentFiber.subtreeFlags & 8772)
      for (parentFiber = parentFiber.child; null !== parentFiber; )
        commitLayoutEffectOnFiber(root2, parentFiber.alternate, parentFiber), parentFiber = parentFiber.sibling;
  }
  function recursivelyTraverseDisappearLayoutEffects(parentFiber) {
    for (parentFiber = parentFiber.child; null !== parentFiber; ) {
      var finishedWork = parentFiber;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          commitHookEffectListUnmount(4, finishedWork, finishedWork.return);
          recursivelyTraverseDisappearLayoutEffects(finishedWork);
          break;
        case 1:
          safelyDetachRef(finishedWork, finishedWork.return);
          var instance = finishedWork.stateNode;
          "function" === typeof instance.componentWillUnmount && safelyCallComponentWillUnmount(
            finishedWork,
            finishedWork.return,
            instance
          );
          recursivelyTraverseDisappearLayoutEffects(finishedWork);
          break;
        case 27:
          releaseSingletonInstance(finishedWork.stateNode);
        case 26:
        case 5:
          safelyDetachRef(finishedWork, finishedWork.return);
          recursivelyTraverseDisappearLayoutEffects(finishedWork);
          break;
        case 22:
          null === finishedWork.memoizedState && recursivelyTraverseDisappearLayoutEffects(finishedWork);
          break;
        case 30:
          recursivelyTraverseDisappearLayoutEffects(finishedWork);
          break;
        default:
          recursivelyTraverseDisappearLayoutEffects(finishedWork);
      }
      parentFiber = parentFiber.sibling;
    }
  }
  function recursivelyTraverseReappearLayoutEffects(finishedRoot$jscomp$0, parentFiber, includeWorkInProgressEffects) {
    includeWorkInProgressEffects = includeWorkInProgressEffects && 0 !== (parentFiber.subtreeFlags & 8772);
    for (parentFiber = parentFiber.child; null !== parentFiber; ) {
      var current = parentFiber.alternate, finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 15:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          commitHookEffectListMount(4, finishedWork);
          break;
        case 1:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          current = finishedWork;
          finishedRoot = current.stateNode;
          if ("function" === typeof finishedRoot.componentDidMount)
            try {
              finishedRoot.componentDidMount();
            } catch (error) {
              captureCommitPhaseError(current, current.return, error);
            }
          current = finishedWork;
          finishedRoot = current.updateQueue;
          if (null !== finishedRoot) {
            var instance = current.stateNode;
            try {
              var hiddenCallbacks = finishedRoot.shared.hiddenCallbacks;
              if (null !== hiddenCallbacks)
                for (finishedRoot.shared.hiddenCallbacks = null, finishedRoot = 0; finishedRoot < hiddenCallbacks.length; finishedRoot++)
                  callCallback(hiddenCallbacks[finishedRoot], instance);
            } catch (error) {
              captureCommitPhaseError(current, current.return, error);
            }
          }
          includeWorkInProgressEffects && flags & 64 && commitClassCallbacks(finishedWork);
          safelyAttachRef(finishedWork, finishedWork.return);
          break;
        case 27:
          commitHostSingletonAcquisition(finishedWork);
        case 26:
        case 5:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          includeWorkInProgressEffects && null === current && flags & 4 && commitHostMount(finishedWork);
          safelyAttachRef(finishedWork, finishedWork.return);
          break;
        case 12:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          break;
        case 31:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          includeWorkInProgressEffects && flags & 4 && commitActivityHydrationCallbacks(finishedRoot, finishedWork);
          break;
        case 13:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          includeWorkInProgressEffects && flags & 4 && commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
          break;
        case 22:
          null === finishedWork.memoizedState && recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
          safelyAttachRef(finishedWork, finishedWork.return);
          break;
        case 30:
          break;
        default:
          recursivelyTraverseReappearLayoutEffects(
            finishedRoot,
            finishedWork,
            includeWorkInProgressEffects
          );
      }
      parentFiber = parentFiber.sibling;
    }
  }
  function commitOffscreenPassiveMountEffects(current, finishedWork) {
    var previousCache = null;
    null !== current && null !== current.memoizedState && null !== current.memoizedState.cachePool && (previousCache = current.memoizedState.cachePool.pool);
    current = null;
    null !== finishedWork.memoizedState && null !== finishedWork.memoizedState.cachePool && (current = finishedWork.memoizedState.cachePool.pool);
    current !== previousCache && (null != current && current.refCount++, null != previousCache && releaseCache(previousCache));
  }
  function commitCachePassiveMountEffect(current, finishedWork) {
    current = null;
    null !== finishedWork.alternate && (current = finishedWork.alternate.memoizedState.cache);
    finishedWork = finishedWork.memoizedState.cache;
    finishedWork !== current && (finishedWork.refCount++, null != current && releaseCache(current));
  }
  function recursivelyTraversePassiveMountEffects(root2, parentFiber, committedLanes, committedTransitions) {
    if (parentFiber.subtreeFlags & 10256)
      for (parentFiber = parentFiber.child; null !== parentFiber; )
        commitPassiveMountOnFiber(
          root2,
          parentFiber,
          committedLanes,
          committedTransitions
        ), parentFiber = parentFiber.sibling;
  }
  function commitPassiveMountOnFiber(finishedRoot, finishedWork, committedLanes, committedTransitions) {
    var flags = finishedWork.flags;
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 15:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        flags & 2048 && commitHookEffectListMount(9, finishedWork);
        break;
      case 1:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        break;
      case 3:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        flags & 2048 && (finishedRoot = null, null !== finishedWork.alternate && (finishedRoot = finishedWork.alternate.memoizedState.cache), finishedWork = finishedWork.memoizedState.cache, finishedWork !== finishedRoot && (finishedWork.refCount++, null != finishedRoot && releaseCache(finishedRoot)));
        break;
      case 12:
        if (flags & 2048) {
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
          finishedRoot = finishedWork.stateNode;
          try {
            var _finishedWork$memoize2 = finishedWork.memoizedProps, id = _finishedWork$memoize2.id, onPostCommit = _finishedWork$memoize2.onPostCommit;
            "function" === typeof onPostCommit && onPostCommit(
              id,
              null === finishedWork.alternate ? "mount" : "update",
              finishedRoot.passiveEffectDuration,
              -0
            );
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        } else
          recursivelyTraversePassiveMountEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions
          );
        break;
      case 31:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        break;
      case 13:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        break;
      case 23:
        break;
      case 22:
        _finishedWork$memoize2 = finishedWork.stateNode;
        id = finishedWork.alternate;
        null !== finishedWork.memoizedState ? _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        ) : recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork) : _finishedWork$memoize2._visibility & 2 ? recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        ) : (_finishedWork$memoize2._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions,
          0 !== (finishedWork.subtreeFlags & 10256) || false
        ));
        flags & 2048 && commitOffscreenPassiveMountEffects(id, finishedWork);
        break;
      case 24:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
        flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
        break;
      default:
        recursivelyTraversePassiveMountEffects(
          finishedRoot,
          finishedWork,
          committedLanes,
          committedTransitions
        );
    }
  }
  function recursivelyTraverseReconnectPassiveEffects(finishedRoot$jscomp$0, parentFiber, committedLanes$jscomp$0, committedTransitions$jscomp$0, includeWorkInProgressEffects) {
    includeWorkInProgressEffects = includeWorkInProgressEffects && (0 !== (parentFiber.subtreeFlags & 10256) || false);
    for (parentFiber = parentFiber.child; null !== parentFiber; ) {
      var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, committedLanes = committedLanes$jscomp$0, committedTransitions = committedTransitions$jscomp$0, flags = finishedWork.flags;
      switch (finishedWork.tag) {
        case 0:
        case 11:
        case 15:
          recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            includeWorkInProgressEffects
          );
          commitHookEffectListMount(8, finishedWork);
          break;
        case 23:
          break;
        case 22:
          var instance = finishedWork.stateNode;
          null !== finishedWork.memoizedState ? instance._visibility & 2 ? recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            includeWorkInProgressEffects
          ) : recursivelyTraverseAtomicPassiveEffects(
            finishedRoot,
            finishedWork
          ) : (instance._visibility |= 2, recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            includeWorkInProgressEffects
          ));
          includeWorkInProgressEffects && flags & 2048 && commitOffscreenPassiveMountEffects(
            finishedWork.alternate,
            finishedWork
          );
          break;
        case 24:
          recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            includeWorkInProgressEffects
          );
          includeWorkInProgressEffects && flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
          break;
        default:
          recursivelyTraverseReconnectPassiveEffects(
            finishedRoot,
            finishedWork,
            committedLanes,
            committedTransitions,
            includeWorkInProgressEffects
          );
      }
      parentFiber = parentFiber.sibling;
    }
  }
  function recursivelyTraverseAtomicPassiveEffects(finishedRoot$jscomp$0, parentFiber) {
    if (parentFiber.subtreeFlags & 10256)
      for (parentFiber = parentFiber.child; null !== parentFiber; ) {
        var finishedRoot = finishedRoot$jscomp$0, finishedWork = parentFiber, flags = finishedWork.flags;
        switch (finishedWork.tag) {
          case 22:
            recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
            flags & 2048 && commitOffscreenPassiveMountEffects(
              finishedWork.alternate,
              finishedWork
            );
            break;
          case 24:
            recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
            flags & 2048 && commitCachePassiveMountEffect(finishedWork.alternate, finishedWork);
            break;
          default:
            recursivelyTraverseAtomicPassiveEffects(finishedRoot, finishedWork);
        }
        parentFiber = parentFiber.sibling;
      }
  }
  var suspenseyCommitFlag = 8192;
  function recursivelyAccumulateSuspenseyCommit(parentFiber, committedLanes, suspendedState) {
    if (parentFiber.subtreeFlags & suspenseyCommitFlag)
      for (parentFiber = parentFiber.child; null !== parentFiber; )
        accumulateSuspenseyCommitOnFiber(
          parentFiber,
          committedLanes,
          suspendedState
        ), parentFiber = parentFiber.sibling;
  }
  function accumulateSuspenseyCommitOnFiber(fiber, committedLanes, suspendedState) {
    switch (fiber.tag) {
      case 26:
        recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        );
        fiber.flags & suspenseyCommitFlag && null !== fiber.memoizedState && suspendResource(
          suspendedState,
          currentHoistableRoot,
          fiber.memoizedState,
          fiber.memoizedProps
        );
        break;
      case 5:
        recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        );
        break;
      case 3:
      case 4:
        var previousHoistableRoot = currentHoistableRoot;
        currentHoistableRoot = getHoistableRoot(fiber.stateNode.containerInfo);
        recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        );
        currentHoistableRoot = previousHoistableRoot;
        break;
      case 22:
        null === fiber.memoizedState && (previousHoistableRoot = fiber.alternate, null !== previousHoistableRoot && null !== previousHoistableRoot.memoizedState ? (previousHoistableRoot = suspenseyCommitFlag, suspenseyCommitFlag = 16777216, recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        ), suspenseyCommitFlag = previousHoistableRoot) : recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        ));
        break;
      default:
        recursivelyAccumulateSuspenseyCommit(
          fiber,
          committedLanes,
          suspendedState
        );
    }
  }
  function detachAlternateSiblings(parentFiber) {
    var previousFiber = parentFiber.alternate;
    if (null !== previousFiber && (parentFiber = previousFiber.child, null !== parentFiber)) {
      previousFiber.child = null;
      do
        previousFiber = parentFiber.sibling, parentFiber.sibling = null, parentFiber = previousFiber;
      while (null !== parentFiber);
    }
  }
  function recursivelyTraversePassiveUnmountEffects(parentFiber) {
    var deletions = parentFiber.deletions;
    if (0 !== (parentFiber.flags & 16)) {
      if (null !== deletions)
        for (var i = 0; i < deletions.length; i++) {
          var childToDelete = deletions[i];
          nextEffect = childToDelete;
          commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
            childToDelete,
            parentFiber
          );
        }
      detachAlternateSiblings(parentFiber);
    }
    if (parentFiber.subtreeFlags & 10256)
      for (parentFiber = parentFiber.child; null !== parentFiber; )
        commitPassiveUnmountOnFiber(parentFiber), parentFiber = parentFiber.sibling;
  }
  function commitPassiveUnmountOnFiber(finishedWork) {
    switch (finishedWork.tag) {
      case 0:
      case 11:
      case 15:
        recursivelyTraversePassiveUnmountEffects(finishedWork);
        finishedWork.flags & 2048 && commitHookEffectListUnmount(9, finishedWork, finishedWork.return);
        break;
      case 3:
        recursivelyTraversePassiveUnmountEffects(finishedWork);
        break;
      case 12:
        recursivelyTraversePassiveUnmountEffects(finishedWork);
        break;
      case 22:
        var instance = finishedWork.stateNode;
        null !== finishedWork.memoizedState && instance._visibility & 2 && (null === finishedWork.return || 13 !== finishedWork.return.tag) ? (instance._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(finishedWork)) : recursivelyTraversePassiveUnmountEffects(finishedWork);
        break;
      default:
        recursivelyTraversePassiveUnmountEffects(finishedWork);
    }
  }
  function recursivelyTraverseDisconnectPassiveEffects(parentFiber) {
    var deletions = parentFiber.deletions;
    if (0 !== (parentFiber.flags & 16)) {
      if (null !== deletions)
        for (var i = 0; i < deletions.length; i++) {
          var childToDelete = deletions[i];
          nextEffect = childToDelete;
          commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
            childToDelete,
            parentFiber
          );
        }
      detachAlternateSiblings(parentFiber);
    }
    for (parentFiber = parentFiber.child; null !== parentFiber; ) {
      deletions = parentFiber;
      switch (deletions.tag) {
        case 0:
        case 11:
        case 15:
          commitHookEffectListUnmount(8, deletions, deletions.return);
          recursivelyTraverseDisconnectPassiveEffects(deletions);
          break;
        case 22:
          i = deletions.stateNode;
          i._visibility & 2 && (i._visibility &= -3, recursivelyTraverseDisconnectPassiveEffects(deletions));
          break;
        default:
          recursivelyTraverseDisconnectPassiveEffects(deletions);
      }
      parentFiber = parentFiber.sibling;
    }
  }
  function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(deletedSubtreeRoot, nearestMountedAncestor) {
    for (; null !== nextEffect; ) {
      var fiber = nextEffect;
      switch (fiber.tag) {
        case 0:
        case 11:
        case 15:
          commitHookEffectListUnmount(8, fiber, nearestMountedAncestor);
          break;
        case 23:
        case 22:
          if (null !== fiber.memoizedState && null !== fiber.memoizedState.cachePool) {
            var cache = fiber.memoizedState.cachePool.pool;
            null != cache && cache.refCount++;
          }
          break;
        case 24:
          releaseCache(fiber.memoizedState.cache);
      }
      cache = fiber.child;
      if (null !== cache) cache.return = fiber, nextEffect = cache;
      else
        a: for (fiber = deletedSubtreeRoot; null !== nextEffect; ) {
          cache = nextEffect;
          var sibling = cache.sibling, returnFiber = cache.return;
          detachFiberAfterEffects(cache);
          if (cache === fiber) {
            nextEffect = null;
            break a;
          }
          if (null !== sibling) {
            sibling.return = returnFiber;
            nextEffect = sibling;
            break a;
          }
          nextEffect = returnFiber;
        }
    }
  }
  var DefaultAsyncDispatcher = {
    getCacheForType: function(resourceType) {
      var cache = readContext(CacheContext), cacheForType = cache.data.get(resourceType);
      void 0 === cacheForType && (cacheForType = resourceType(), cache.data.set(resourceType, cacheForType));
      return cacheForType;
    },
    cacheSignal: function() {
      return readContext(CacheContext).controller.signal;
    }
  }, PossiblyWeakMap = "function" === typeof WeakMap ? WeakMap : Map, executionContext = 0, workInProgressRoot = null, workInProgress = null, workInProgressRootRenderLanes = 0, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, workInProgressRootDidSkipSuspendedSiblings = false, workInProgressRootIsPrerendering = false, workInProgressRootDidAttachPingListener = false, entangledRenderLanes = 0, workInProgressRootExitStatus = 0, workInProgressRootSkippedLanes = 0, workInProgressRootInterleavedUpdatedLanes = 0, workInProgressRootPingedLanes = 0, workInProgressDeferredLane = 0, workInProgressSuspendedRetryLanes = 0, workInProgressRootConcurrentErrors = null, workInProgressRootRecoverableErrors = null, workInProgressRootDidIncludeRecursiveRenderUpdate = false, globalMostRecentFallbackTime = 0, globalMostRecentTransitionTime = 0, workInProgressRootRenderTargetTime = Infinity, workInProgressTransitions = null, legacyErrorBoundariesThatAlreadyFailed = null, pendingEffectsStatus = 0, pendingEffectsRoot = null, pendingFinishedWork = null, pendingEffectsLanes = 0, pendingEffectsRemainingLanes = 0, pendingPassiveTransitions = null, pendingRecoverableErrors = null, nestedUpdateCount = 0, rootWithNestedUpdates = null;
  function requestUpdateLane() {
    return 0 !== (executionContext & 2) && 0 !== workInProgressRootRenderLanes ? workInProgressRootRenderLanes & -workInProgressRootRenderLanes : null !== ReactSharedInternals.T ? requestTransitionLane() : resolveUpdatePriority();
  }
  function requestDeferredLane() {
    if (0 === workInProgressDeferredLane)
      if (0 === (workInProgressRootRenderLanes & 536870912) || isHydrating) {
        var lane = nextTransitionDeferredLane;
        nextTransitionDeferredLane <<= 1;
        0 === (nextTransitionDeferredLane & 3932160) && (nextTransitionDeferredLane = 262144);
        workInProgressDeferredLane = lane;
      } else workInProgressDeferredLane = 536870912;
    lane = suspenseHandlerStackCursor.current;
    null !== lane && (lane.flags |= 32);
    return workInProgressDeferredLane;
  }
  function scheduleUpdateOnFiber(root2, fiber, lane) {
    if (root2 === workInProgressRoot && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
      prepareFreshStack(root2, 0), markRootSuspended(
        root2,
        workInProgressRootRenderLanes,
        workInProgressDeferredLane,
        false
      );
    markRootUpdated$1(root2, lane);
    if (0 === (executionContext & 2) || root2 !== workInProgressRoot)
      root2 === workInProgressRoot && (0 === (executionContext & 2) && (workInProgressRootInterleavedUpdatedLanes |= lane), 4 === workInProgressRootExitStatus && markRootSuspended(
        root2,
        workInProgressRootRenderLanes,
        workInProgressDeferredLane,
        false
      )), ensureRootIsScheduled(root2);
  }
  function performWorkOnRoot(root$jscomp$0, lanes, forceSync) {
    if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
    var shouldTimeSlice = !forceSync && 0 === (lanes & 127) && 0 === (lanes & root$jscomp$0.expiredLanes) || checkIfRootIsPrerendering(root$jscomp$0, lanes), exitStatus = shouldTimeSlice ? renderRootConcurrent(root$jscomp$0, lanes) : renderRootSync(root$jscomp$0, lanes, true), renderWasConcurrent = shouldTimeSlice;
    do {
      if (0 === exitStatus) {
        workInProgressRootIsPrerendering && !shouldTimeSlice && markRootSuspended(root$jscomp$0, lanes, 0, false);
        break;
      } else {
        forceSync = root$jscomp$0.current.alternate;
        if (renderWasConcurrent && !isRenderConsistentWithExternalStores(forceSync)) {
          exitStatus = renderRootSync(root$jscomp$0, lanes, false);
          renderWasConcurrent = false;
          continue;
        }
        if (2 === exitStatus) {
          renderWasConcurrent = lanes;
          if (root$jscomp$0.errorRecoveryDisabledLanes & renderWasConcurrent)
            var JSCompiler_inline_result = 0;
          else
            JSCompiler_inline_result = root$jscomp$0.pendingLanes & -536870913, JSCompiler_inline_result = 0 !== JSCompiler_inline_result ? JSCompiler_inline_result : JSCompiler_inline_result & 536870912 ? 536870912 : 0;
          if (0 !== JSCompiler_inline_result) {
            lanes = JSCompiler_inline_result;
            a: {
              var root2 = root$jscomp$0;
              exitStatus = workInProgressRootConcurrentErrors;
              var wasRootDehydrated = root2.current.memoizedState.isDehydrated;
              wasRootDehydrated && (prepareFreshStack(root2, JSCompiler_inline_result).flags |= 256);
              JSCompiler_inline_result = renderRootSync(
                root2,
                JSCompiler_inline_result,
                false
              );
              if (2 !== JSCompiler_inline_result) {
                if (workInProgressRootDidAttachPingListener && !wasRootDehydrated) {
                  root2.errorRecoveryDisabledLanes |= renderWasConcurrent;
                  workInProgressRootInterleavedUpdatedLanes |= renderWasConcurrent;
                  exitStatus = 4;
                  break a;
                }
                renderWasConcurrent = workInProgressRootRecoverableErrors;
                workInProgressRootRecoverableErrors = exitStatus;
                null !== renderWasConcurrent && (null === workInProgressRootRecoverableErrors ? workInProgressRootRecoverableErrors = renderWasConcurrent : workInProgressRootRecoverableErrors.push.apply(
                  workInProgressRootRecoverableErrors,
                  renderWasConcurrent
                ));
              }
              exitStatus = JSCompiler_inline_result;
            }
            renderWasConcurrent = false;
            if (2 !== exitStatus) continue;
          }
        }
        if (1 === exitStatus) {
          prepareFreshStack(root$jscomp$0, 0);
          markRootSuspended(root$jscomp$0, lanes, 0, true);
          break;
        }
        a: {
          shouldTimeSlice = root$jscomp$0;
          renderWasConcurrent = exitStatus;
          switch (renderWasConcurrent) {
            case 0:
            case 1:
              throw Error(formatProdErrorMessage(345));
            case 4:
              if ((lanes & 4194048) !== lanes) break;
            case 6:
              markRootSuspended(
                shouldTimeSlice,
                lanes,
                workInProgressDeferredLane,
                !workInProgressRootDidSkipSuspendedSiblings
              );
              break a;
            case 2:
              workInProgressRootRecoverableErrors = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(formatProdErrorMessage(329));
          }
          if ((lanes & 62914560) === lanes && (exitStatus = globalMostRecentFallbackTime + 300 - now(), 10 < exitStatus)) {
            markRootSuspended(
              shouldTimeSlice,
              lanes,
              workInProgressDeferredLane,
              !workInProgressRootDidSkipSuspendedSiblings
            );
            if (0 !== getNextLanes(shouldTimeSlice, 0, true)) break a;
            pendingEffectsLanes = lanes;
            shouldTimeSlice.timeoutHandle = scheduleTimeout(
              commitRootWhenReady.bind(
                null,
                shouldTimeSlice,
                forceSync,
                workInProgressRootRecoverableErrors,
                workInProgressTransitions,
                workInProgressRootDidIncludeRecursiveRenderUpdate,
                lanes,
                workInProgressDeferredLane,
                workInProgressRootInterleavedUpdatedLanes,
                workInProgressSuspendedRetryLanes,
                workInProgressRootDidSkipSuspendedSiblings,
                renderWasConcurrent,
                "Throttled",
                -0,
                0
              ),
              exitStatus
            );
            break a;
          }
          commitRootWhenReady(
            shouldTimeSlice,
            forceSync,
            workInProgressRootRecoverableErrors,
            workInProgressTransitions,
            workInProgressRootDidIncludeRecursiveRenderUpdate,
            lanes,
            workInProgressDeferredLane,
            workInProgressRootInterleavedUpdatedLanes,
            workInProgressSuspendedRetryLanes,
            workInProgressRootDidSkipSuspendedSiblings,
            renderWasConcurrent,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (1);
    ensureRootIsScheduled(root$jscomp$0);
  }
  function commitRootWhenReady(root2, finishedWork, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, lanes, spawnedLane, updatedLanes, suspendedRetryLanes, didSkipSuspendedSiblings, exitStatus, suspendedCommitReason, completedRenderStartTime, completedRenderEndTime) {
    root2.timeoutHandle = -1;
    suspendedCommitReason = finishedWork.subtreeFlags;
    if (suspendedCommitReason & 8192 || 16785408 === (suspendedCommitReason & 16785408)) {
      suspendedCommitReason = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: true,
        waitingForViewTransition: false,
        unsuspend: noop$1
      };
      accumulateSuspenseyCommitOnFiber(
        finishedWork,
        lanes,
        suspendedCommitReason
      );
      var timeoutOffset = (lanes & 62914560) === lanes ? globalMostRecentFallbackTime - now() : (lanes & 4194048) === lanes ? globalMostRecentTransitionTime - now() : 0;
      timeoutOffset = waitForCommitToBeReady(
        suspendedCommitReason,
        timeoutOffset
      );
      if (null !== timeoutOffset) {
        pendingEffectsLanes = lanes;
        root2.cancelPendingCommit = timeoutOffset(
          commitRoot.bind(
            null,
            root2,
            finishedWork,
            lanes,
            recoverableErrors,
            transitions,
            didIncludeRenderPhaseUpdate,
            spawnedLane,
            updatedLanes,
            suspendedRetryLanes,
            exitStatus,
            suspendedCommitReason,
            null,
            completedRenderStartTime,
            completedRenderEndTime
          )
        );
        markRootSuspended(root2, lanes, spawnedLane, !didSkipSuspendedSiblings);
        return;
      }
    }
    commitRoot(
      root2,
      finishedWork,
      lanes,
      recoverableErrors,
      transitions,
      didIncludeRenderPhaseUpdate,
      spawnedLane,
      updatedLanes,
      suspendedRetryLanes
    );
  }
  function isRenderConsistentWithExternalStores(finishedWork) {
    for (var node = finishedWork; ; ) {
      var tag = node.tag;
      if ((0 === tag || 11 === tag || 15 === tag) && node.flags & 16384 && (tag = node.updateQueue, null !== tag && (tag = tag.stores, null !== tag)))
        for (var i = 0; i < tag.length; i++) {
          var check = tag[i], getSnapshot = check.getSnapshot;
          check = check.value;
          try {
            if (!objectIs(getSnapshot(), check)) return false;
          } catch (error) {
            return false;
          }
        }
      tag = node.child;
      if (node.subtreeFlags & 16384 && null !== tag)
        tag.return = node, node = tag;
      else {
        if (node === finishedWork) break;
        for (; null === node.sibling; ) {
          if (null === node.return || node.return === finishedWork) return true;
          node = node.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
      }
    }
    return true;
  }
  function markRootSuspended(root2, suspendedLanes, spawnedLane, didAttemptEntireTree) {
    suspendedLanes &= ~workInProgressRootPingedLanes;
    suspendedLanes &= ~workInProgressRootInterleavedUpdatedLanes;
    root2.suspendedLanes |= suspendedLanes;
    root2.pingedLanes &= ~suspendedLanes;
    didAttemptEntireTree && (root2.warmLanes |= suspendedLanes);
    didAttemptEntireTree = root2.expirationTimes;
    for (var lanes = suspendedLanes; 0 < lanes; ) {
      var index$6 = 31 - clz32(lanes), lane = 1 << index$6;
      didAttemptEntireTree[index$6] = -1;
      lanes &= ~lane;
    }
    0 !== spawnedLane && markSpawnedDeferredLane(root2, spawnedLane, suspendedLanes);
  }
  function flushSyncWork$1() {
    return 0 === (executionContext & 6) ? (flushSyncWorkAcrossRoots_impl(0), false) : true;
  }
  function resetWorkInProgressStack() {
    if (null !== workInProgress) {
      if (0 === workInProgressSuspendedReason)
        var interruptedWork = workInProgress.return;
      else
        interruptedWork = workInProgress, lastContextDependency = currentlyRenderingFiber$1 = null, resetHooksOnUnwind(interruptedWork), thenableState$1 = null, thenableIndexCounter$1 = 0, interruptedWork = workInProgress;
      for (; null !== interruptedWork; )
        unwindInterruptedWork(interruptedWork.alternate, interruptedWork), interruptedWork = interruptedWork.return;
      workInProgress = null;
    }
  }
  function prepareFreshStack(root2, lanes) {
    var timeoutHandle = root2.timeoutHandle;
    -1 !== timeoutHandle && (root2.timeoutHandle = -1, cancelTimeout(timeoutHandle));
    timeoutHandle = root2.cancelPendingCommit;
    null !== timeoutHandle && (root2.cancelPendingCommit = null, timeoutHandle());
    pendingEffectsLanes = 0;
    resetWorkInProgressStack();
    workInProgressRoot = root2;
    workInProgress = timeoutHandle = createWorkInProgress(root2.current, null);
    workInProgressRootRenderLanes = lanes;
    workInProgressSuspendedReason = 0;
    workInProgressThrownValue = null;
    workInProgressRootDidSkipSuspendedSiblings = false;
    workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root2, lanes);
    workInProgressRootDidAttachPingListener = false;
    workInProgressSuspendedRetryLanes = workInProgressDeferredLane = workInProgressRootPingedLanes = workInProgressRootInterleavedUpdatedLanes = workInProgressRootSkippedLanes = workInProgressRootExitStatus = 0;
    workInProgressRootRecoverableErrors = workInProgressRootConcurrentErrors = null;
    workInProgressRootDidIncludeRecursiveRenderUpdate = false;
    0 !== (lanes & 8) && (lanes |= lanes & 32);
    var allEntangledLanes = root2.entangledLanes;
    if (0 !== allEntangledLanes)
      for (root2 = root2.entanglements, allEntangledLanes &= lanes; 0 < allEntangledLanes; ) {
        var index$4 = 31 - clz32(allEntangledLanes), lane = 1 << index$4;
        lanes |= root2[index$4];
        allEntangledLanes &= ~lane;
      }
    entangledRenderLanes = lanes;
    finishQueueingConcurrentUpdates();
    return timeoutHandle;
  }
  function handleThrow(root2, thrownValue) {
    currentlyRenderingFiber = null;
    ReactSharedInternals.H = ContextOnlyDispatcher;
    thrownValue === SuspenseException || thrownValue === SuspenseActionException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 3) : thrownValue === SuspenseyCommitException ? (thrownValue = getSuspendedThenable(), workInProgressSuspendedReason = 4) : workInProgressSuspendedReason = thrownValue === SelectiveHydrationException ? 8 : null !== thrownValue && "object" === typeof thrownValue && "function" === typeof thrownValue.then ? 6 : 1;
    workInProgressThrownValue = thrownValue;
    null === workInProgress && (workInProgressRootExitStatus = 1, logUncaughtError(
      root2,
      createCapturedValueAtFiber(thrownValue, root2.current)
    ));
  }
  function shouldRemainOnPreviousScreen() {
    var handler = suspenseHandlerStackCursor.current;
    return null === handler ? true : (workInProgressRootRenderLanes & 4194048) === workInProgressRootRenderLanes ? null === shellBoundary ? true : false : (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes || 0 !== (workInProgressRootRenderLanes & 536870912) ? handler === shellBoundary : false;
  }
  function pushDispatcher() {
    var prevDispatcher = ReactSharedInternals.H;
    ReactSharedInternals.H = ContextOnlyDispatcher;
    return null === prevDispatcher ? ContextOnlyDispatcher : prevDispatcher;
  }
  function pushAsyncDispatcher() {
    var prevAsyncDispatcher = ReactSharedInternals.A;
    ReactSharedInternals.A = DefaultAsyncDispatcher;
    return prevAsyncDispatcher;
  }
  function renderDidSuspendDelayIfPossible() {
    workInProgressRootExitStatus = 4;
    workInProgressRootDidSkipSuspendedSiblings || (workInProgressRootRenderLanes & 4194048) !== workInProgressRootRenderLanes && null !== suspenseHandlerStackCursor.current || (workInProgressRootIsPrerendering = true);
    0 === (workInProgressRootSkippedLanes & 134217727) && 0 === (workInProgressRootInterleavedUpdatedLanes & 134217727) || null === workInProgressRoot || markRootSuspended(
      workInProgressRoot,
      workInProgressRootRenderLanes,
      workInProgressDeferredLane,
      false
    );
  }
  function renderRootSync(root2, lanes, shouldYieldForPrerendering) {
    var prevExecutionContext = executionContext;
    executionContext |= 2;
    var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
    if (workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes)
      workInProgressTransitions = null, prepareFreshStack(root2, lanes);
    lanes = false;
    var exitStatus = workInProgressRootExitStatus;
    a: do
      try {
        if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
          var unitOfWork = workInProgress, thrownValue = workInProgressThrownValue;
          switch (workInProgressSuspendedReason) {
            case 8:
              resetWorkInProgressStack();
              exitStatus = 6;
              break a;
            case 3:
            case 2:
            case 9:
            case 6:
              null === suspenseHandlerStackCursor.current && (lanes = true);
              var reason = workInProgressSuspendedReason;
              workInProgressSuspendedReason = 0;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
              if (shouldYieldForPrerendering && workInProgressRootIsPrerendering) {
                exitStatus = 0;
                break a;
              }
              break;
            default:
              reason = workInProgressSuspendedReason, workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, reason);
          }
        }
        workLoopSync();
        exitStatus = workInProgressRootExitStatus;
        break;
      } catch (thrownValue$165) {
        handleThrow(root2, thrownValue$165);
      }
    while (1);
    lanes && root2.shellSuspendCounter++;
    lastContextDependency = currentlyRenderingFiber$1 = null;
    executionContext = prevExecutionContext;
    ReactSharedInternals.H = prevDispatcher;
    ReactSharedInternals.A = prevAsyncDispatcher;
    null === workInProgress && (workInProgressRoot = null, workInProgressRootRenderLanes = 0, finishQueueingConcurrentUpdates());
    return exitStatus;
  }
  function workLoopSync() {
    for (; null !== workInProgress; ) performUnitOfWork(workInProgress);
  }
  function renderRootConcurrent(root2, lanes) {
    var prevExecutionContext = executionContext;
    executionContext |= 2;
    var prevDispatcher = pushDispatcher(), prevAsyncDispatcher = pushAsyncDispatcher();
    workInProgressRoot !== root2 || workInProgressRootRenderLanes !== lanes ? (workInProgressTransitions = null, workInProgressRootRenderTargetTime = now() + 500, prepareFreshStack(root2, lanes)) : workInProgressRootIsPrerendering = checkIfRootIsPrerendering(
      root2,
      lanes
    );
    a: do
      try {
        if (0 !== workInProgressSuspendedReason && null !== workInProgress) {
          lanes = workInProgress;
          var thrownValue = workInProgressThrownValue;
          b: switch (workInProgressSuspendedReason) {
            case 1:
              workInProgressSuspendedReason = 0;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root2, lanes, thrownValue, 1);
              break;
            case 2:
            case 9:
              if (isThenableResolved(thrownValue)) {
                workInProgressSuspendedReason = 0;
                workInProgressThrownValue = null;
                replaySuspendedUnitOfWork(lanes);
                break;
              }
              lanes = function() {
                2 !== workInProgressSuspendedReason && 9 !== workInProgressSuspendedReason || workInProgressRoot !== root2 || (workInProgressSuspendedReason = 7);
                ensureRootIsScheduled(root2);
              };
              thrownValue.then(lanes, lanes);
              break a;
            case 3:
              workInProgressSuspendedReason = 7;
              break a;
            case 4:
              workInProgressSuspendedReason = 5;
              break a;
            case 7:
              isThenableResolved(thrownValue) ? (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, replaySuspendedUnitOfWork(lanes)) : (workInProgressSuspendedReason = 0, workInProgressThrownValue = null, throwAndUnwindWorkLoop(root2, lanes, thrownValue, 7));
              break;
            case 5:
              var resource = null;
              switch (workInProgress.tag) {
                case 26:
                  resource = workInProgress.memoizedState;
                case 5:
                case 27:
                  var hostFiber = workInProgress;
                  if (resource ? preloadResource(resource) : hostFiber.stateNode.complete) {
                    workInProgressSuspendedReason = 0;
                    workInProgressThrownValue = null;
                    var sibling = hostFiber.sibling;
                    if (null !== sibling) workInProgress = sibling;
                    else {
                      var returnFiber = hostFiber.return;
                      null !== returnFiber ? (workInProgress = returnFiber, completeUnitOfWork(returnFiber)) : workInProgress = null;
                    }
                    break b;
                  }
              }
              workInProgressSuspendedReason = 0;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root2, lanes, thrownValue, 5);
              break;
            case 6:
              workInProgressSuspendedReason = 0;
              workInProgressThrownValue = null;
              throwAndUnwindWorkLoop(root2, lanes, thrownValue, 6);
              break;
            case 8:
              resetWorkInProgressStack();
              workInProgressRootExitStatus = 6;
              break a;
            default:
              throw Error(formatProdErrorMessage(462));
          }
        }
        workLoopConcurrentByScheduler();
        break;
      } catch (thrownValue$167) {
        handleThrow(root2, thrownValue$167);
      }
    while (1);
    lastContextDependency = currentlyRenderingFiber$1 = null;
    ReactSharedInternals.H = prevDispatcher;
    ReactSharedInternals.A = prevAsyncDispatcher;
    executionContext = prevExecutionContext;
    if (null !== workInProgress) return 0;
    workInProgressRoot = null;
    workInProgressRootRenderLanes = 0;
    finishQueueingConcurrentUpdates();
    return workInProgressRootExitStatus;
  }
  function workLoopConcurrentByScheduler() {
    for (; null !== workInProgress && !shouldYield(); )
      performUnitOfWork(workInProgress);
  }
  function performUnitOfWork(unitOfWork) {
    var next = beginWork(unitOfWork.alternate, unitOfWork, entangledRenderLanes);
    unitOfWork.memoizedProps = unitOfWork.pendingProps;
    null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
  }
  function replaySuspendedUnitOfWork(unitOfWork) {
    var next = unitOfWork;
    var current = next.alternate;
    switch (next.tag) {
      case 15:
      case 0:
        next = replayFunctionComponent(
          current,
          next,
          next.pendingProps,
          next.type,
          void 0,
          workInProgressRootRenderLanes
        );
        break;
      case 11:
        next = replayFunctionComponent(
          current,
          next,
          next.pendingProps,
          next.type.render,
          next.ref,
          workInProgressRootRenderLanes
        );
        break;
      case 5:
        resetHooksOnUnwind(next);
      default:
        unwindInterruptedWork(current, next), next = workInProgress = resetWorkInProgress(next, entangledRenderLanes), next = beginWork(current, next, entangledRenderLanes);
    }
    unitOfWork.memoizedProps = unitOfWork.pendingProps;
    null === next ? completeUnitOfWork(unitOfWork) : workInProgress = next;
  }
  function throwAndUnwindWorkLoop(root2, unitOfWork, thrownValue, suspendedReason) {
    lastContextDependency = currentlyRenderingFiber$1 = null;
    resetHooksOnUnwind(unitOfWork);
    thenableState$1 = null;
    thenableIndexCounter$1 = 0;
    var returnFiber = unitOfWork.return;
    try {
      if (throwException(
        root2,
        returnFiber,
        unitOfWork,
        thrownValue,
        workInProgressRootRenderLanes
      )) {
        workInProgressRootExitStatus = 1;
        logUncaughtError(
          root2,
          createCapturedValueAtFiber(thrownValue, root2.current)
        );
        workInProgress = null;
        return;
      }
    } catch (error) {
      if (null !== returnFiber) throw workInProgress = returnFiber, error;
      workInProgressRootExitStatus = 1;
      logUncaughtError(
        root2,
        createCapturedValueAtFiber(thrownValue, root2.current)
      );
      workInProgress = null;
      return;
    }
    if (unitOfWork.flags & 32768) {
      if (isHydrating || 1 === suspendedReason) root2 = true;
      else if (workInProgressRootIsPrerendering || 0 !== (workInProgressRootRenderLanes & 536870912))
        root2 = false;
      else if (workInProgressRootDidSkipSuspendedSiblings = root2 = true, 2 === suspendedReason || 9 === suspendedReason || 3 === suspendedReason || 6 === suspendedReason)
        suspendedReason = suspenseHandlerStackCursor.current, null !== suspendedReason && 13 === suspendedReason.tag && (suspendedReason.flags |= 16384);
      unwindUnitOfWork(unitOfWork, root2);
    } else completeUnitOfWork(unitOfWork);
  }
  function completeUnitOfWork(unitOfWork) {
    var completedWork = unitOfWork;
    do {
      if (0 !== (completedWork.flags & 32768)) {
        unwindUnitOfWork(
          completedWork,
          workInProgressRootDidSkipSuspendedSiblings
        );
        return;
      }
      unitOfWork = completedWork.return;
      var next = completeWork(
        completedWork.alternate,
        completedWork,
        entangledRenderLanes
      );
      if (null !== next) {
        workInProgress = next;
        return;
      }
      completedWork = completedWork.sibling;
      if (null !== completedWork) {
        workInProgress = completedWork;
        return;
      }
      workInProgress = completedWork = unitOfWork;
    } while (null !== completedWork);
    0 === workInProgressRootExitStatus && (workInProgressRootExitStatus = 5);
  }
  function unwindUnitOfWork(unitOfWork, skipSiblings) {
    do {
      var next = unwindWork(unitOfWork.alternate, unitOfWork);
      if (null !== next) {
        next.flags &= 32767;
        workInProgress = next;
        return;
      }
      next = unitOfWork.return;
      null !== next && (next.flags |= 32768, next.subtreeFlags = 0, next.deletions = null);
      if (!skipSiblings && (unitOfWork = unitOfWork.sibling, null !== unitOfWork)) {
        workInProgress = unitOfWork;
        return;
      }
      workInProgress = unitOfWork = next;
    } while (null !== unitOfWork);
    workInProgressRootExitStatus = 6;
    workInProgress = null;
  }
  function commitRoot(root2, finishedWork, lanes, recoverableErrors, transitions, didIncludeRenderPhaseUpdate, spawnedLane, updatedLanes, suspendedRetryLanes) {
    root2.cancelPendingCommit = null;
    do
      flushPendingEffects();
    while (0 !== pendingEffectsStatus);
    if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(327));
    if (null !== finishedWork) {
      if (finishedWork === root2.current) throw Error(formatProdErrorMessage(177));
      didIncludeRenderPhaseUpdate = finishedWork.lanes | finishedWork.childLanes;
      didIncludeRenderPhaseUpdate |= concurrentlyUpdatedLanes;
      markRootFinished(
        root2,
        lanes,
        didIncludeRenderPhaseUpdate,
        spawnedLane,
        updatedLanes,
        suspendedRetryLanes
      );
      root2 === workInProgressRoot && (workInProgress = workInProgressRoot = null, workInProgressRootRenderLanes = 0);
      pendingFinishedWork = finishedWork;
      pendingEffectsRoot = root2;
      pendingEffectsLanes = lanes;
      pendingEffectsRemainingLanes = didIncludeRenderPhaseUpdate;
      pendingPassiveTransitions = transitions;
      pendingRecoverableErrors = recoverableErrors;
      0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? (root2.callbackNode = null, root2.callbackPriority = 0, scheduleCallback$1(NormalPriority$1, function() {
        flushPassiveEffects();
        return null;
      })) : (root2.callbackNode = null, root2.callbackPriority = 0);
      recoverableErrors = 0 !== (finishedWork.flags & 13878);
      if (0 !== (finishedWork.subtreeFlags & 13878) || recoverableErrors) {
        recoverableErrors = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        transitions = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 2;
        spawnedLane = executionContext;
        executionContext |= 4;
        try {
          commitBeforeMutationEffects(root2, finishedWork, lanes);
        } finally {
          executionContext = spawnedLane, ReactDOMSharedInternals.p = transitions, ReactSharedInternals.T = recoverableErrors;
        }
      }
      pendingEffectsStatus = 1;
      flushMutationEffects();
      flushLayoutEffects();
      flushSpawnedWork();
    }
  }
  function flushMutationEffects() {
    if (1 === pendingEffectsStatus) {
      pendingEffectsStatus = 0;
      var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootMutationHasEffect = 0 !== (finishedWork.flags & 13878);
      if (0 !== (finishedWork.subtreeFlags & 13878) || rootMutationHasEffect) {
        rootMutationHasEffect = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 2;
        var prevExecutionContext = executionContext;
        executionContext |= 4;
        try {
          commitMutationEffectsOnFiber(finishedWork, root2);
          var priorSelectionInformation = selectionInformation, curFocusedElem = getActiveElementDeep(root2.containerInfo), priorFocusedElem = priorSelectionInformation.focusedElem, priorSelectionRange = priorSelectionInformation.selectionRange;
          if (curFocusedElem !== priorFocusedElem && priorFocusedElem && priorFocusedElem.ownerDocument && containsNode(
            priorFocusedElem.ownerDocument.documentElement,
            priorFocusedElem
          )) {
            if (null !== priorSelectionRange && hasSelectionCapabilities(priorFocusedElem)) {
              var start = priorSelectionRange.start, end = priorSelectionRange.end;
              void 0 === end && (end = start);
              if ("selectionStart" in priorFocusedElem)
                priorFocusedElem.selectionStart = start, priorFocusedElem.selectionEnd = Math.min(
                  end,
                  priorFocusedElem.value.length
                );
              else {
                var doc = priorFocusedElem.ownerDocument || document, win = doc && doc.defaultView || window;
                if (win.getSelection) {
                  var selection = win.getSelection(), length = priorFocusedElem.textContent.length, start$jscomp$0 = Math.min(priorSelectionRange.start, length), end$jscomp$0 = void 0 === priorSelectionRange.end ? start$jscomp$0 : Math.min(priorSelectionRange.end, length);
                  !selection.extend && start$jscomp$0 > end$jscomp$0 && (curFocusedElem = end$jscomp$0, end$jscomp$0 = start$jscomp$0, start$jscomp$0 = curFocusedElem);
                  var startMarker = getNodeForCharacterOffset(
                    priorFocusedElem,
                    start$jscomp$0
                  ), endMarker = getNodeForCharacterOffset(
                    priorFocusedElem,
                    end$jscomp$0
                  );
                  if (startMarker && endMarker && (1 !== selection.rangeCount || selection.anchorNode !== startMarker.node || selection.anchorOffset !== startMarker.offset || selection.focusNode !== endMarker.node || selection.focusOffset !== endMarker.offset)) {
                    var range = doc.createRange();
                    range.setStart(startMarker.node, startMarker.offset);
                    selection.removeAllRanges();
                    start$jscomp$0 > end$jscomp$0 ? (selection.addRange(range), selection.extend(endMarker.node, endMarker.offset)) : (range.setEnd(endMarker.node, endMarker.offset), selection.addRange(range));
                  }
                }
              }
            }
            doc = [];
            for (selection = priorFocusedElem; selection = selection.parentNode; )
              1 === selection.nodeType && doc.push({
                element: selection,
                left: selection.scrollLeft,
                top: selection.scrollTop
              });
            "function" === typeof priorFocusedElem.focus && priorFocusedElem.focus();
            for (priorFocusedElem = 0; priorFocusedElem < doc.length; priorFocusedElem++) {
              var info = doc[priorFocusedElem];
              info.element.scrollLeft = info.left;
              info.element.scrollTop = info.top;
            }
          }
          _enabled = !!eventsEnabled;
          selectionInformation = eventsEnabled = null;
        } finally {
          executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootMutationHasEffect;
        }
      }
      root2.current = finishedWork;
      pendingEffectsStatus = 2;
    }
  }
  function flushLayoutEffects() {
    if (2 === pendingEffectsStatus) {
      pendingEffectsStatus = 0;
      var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, rootHasLayoutEffect = 0 !== (finishedWork.flags & 8772);
      if (0 !== (finishedWork.subtreeFlags & 8772) || rootHasLayoutEffect) {
        rootHasLayoutEffect = ReactSharedInternals.T;
        ReactSharedInternals.T = null;
        var previousPriority = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 2;
        var prevExecutionContext = executionContext;
        executionContext |= 4;
        try {
          commitLayoutEffectOnFiber(root2, finishedWork.alternate, finishedWork);
        } finally {
          executionContext = prevExecutionContext, ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = rootHasLayoutEffect;
        }
      }
      pendingEffectsStatus = 3;
    }
  }
  function flushSpawnedWork() {
    if (4 === pendingEffectsStatus || 3 === pendingEffectsStatus) {
      pendingEffectsStatus = 0;
      requestPaint();
      var root2 = pendingEffectsRoot, finishedWork = pendingFinishedWork, lanes = pendingEffectsLanes, recoverableErrors = pendingRecoverableErrors;
      0 !== (finishedWork.subtreeFlags & 10256) || 0 !== (finishedWork.flags & 10256) ? pendingEffectsStatus = 5 : (pendingEffectsStatus = 0, pendingFinishedWork = pendingEffectsRoot = null, releaseRootPooledCache(root2, root2.pendingLanes));
      var remainingLanes = root2.pendingLanes;
      0 === remainingLanes && (legacyErrorBoundariesThatAlreadyFailed = null);
      lanesToEventPriority(lanes);
      finishedWork = finishedWork.stateNode;
      if (injectedHook && "function" === typeof injectedHook.onCommitFiberRoot)
        try {
          injectedHook.onCommitFiberRoot(
            rendererID,
            finishedWork,
            void 0,
            128 === (finishedWork.current.flags & 128)
          );
        } catch (err) {
        }
      if (null !== recoverableErrors) {
        finishedWork = ReactSharedInternals.T;
        remainingLanes = ReactDOMSharedInternals.p;
        ReactDOMSharedInternals.p = 2;
        ReactSharedInternals.T = null;
        try {
          for (var onRecoverableError = root2.onRecoverableError, i = 0; i < recoverableErrors.length; i++) {
            var recoverableError = recoverableErrors[i];
            onRecoverableError(recoverableError.value, {
              componentStack: recoverableError.stack
            });
          }
        } finally {
          ReactSharedInternals.T = finishedWork, ReactDOMSharedInternals.p = remainingLanes;
        }
      }
      0 !== (pendingEffectsLanes & 3) && flushPendingEffects();
      ensureRootIsScheduled(root2);
      remainingLanes = root2.pendingLanes;
      0 !== (lanes & 261930) && 0 !== (remainingLanes & 42) ? root2 === rootWithNestedUpdates ? nestedUpdateCount++ : (nestedUpdateCount = 0, rootWithNestedUpdates = root2) : nestedUpdateCount = 0;
      flushSyncWorkAcrossRoots_impl(0);
    }
  }
  function releaseRootPooledCache(root2, remainingLanes) {
    0 === (root2.pooledCacheLanes &= remainingLanes) && (remainingLanes = root2.pooledCache, null != remainingLanes && (root2.pooledCache = null, releaseCache(remainingLanes)));
  }
  function flushPendingEffects() {
    flushMutationEffects();
    flushLayoutEffects();
    flushSpawnedWork();
    return flushPassiveEffects();
  }
  function flushPassiveEffects() {
    if (5 !== pendingEffectsStatus) return false;
    var root2 = pendingEffectsRoot, remainingLanes = pendingEffectsRemainingLanes;
    pendingEffectsRemainingLanes = 0;
    var renderPriority = lanesToEventPriority(pendingEffectsLanes), prevTransition = ReactSharedInternals.T, previousPriority = ReactDOMSharedInternals.p;
    try {
      ReactDOMSharedInternals.p = 32 > renderPriority ? 32 : renderPriority;
      ReactSharedInternals.T = null;
      renderPriority = pendingPassiveTransitions;
      pendingPassiveTransitions = null;
      var root$jscomp$0 = pendingEffectsRoot, lanes = pendingEffectsLanes;
      pendingEffectsStatus = 0;
      pendingFinishedWork = pendingEffectsRoot = null;
      pendingEffectsLanes = 0;
      if (0 !== (executionContext & 6)) throw Error(formatProdErrorMessage(331));
      var prevExecutionContext = executionContext;
      executionContext |= 4;
      commitPassiveUnmountOnFiber(root$jscomp$0.current);
      commitPassiveMountOnFiber(
        root$jscomp$0,
        root$jscomp$0.current,
        lanes,
        renderPriority
      );
      executionContext = prevExecutionContext;
      flushSyncWorkAcrossRoots_impl(0, false);
      if (injectedHook && "function" === typeof injectedHook.onPostCommitFiberRoot)
        try {
          injectedHook.onPostCommitFiberRoot(rendererID, root$jscomp$0);
        } catch (err) {
        }
      return true;
    } finally {
      ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition, releaseRootPooledCache(root2, remainingLanes);
    }
  }
  function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
    sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
    sourceFiber = createRootErrorUpdate(rootFiber.stateNode, sourceFiber, 2);
    rootFiber = enqueueUpdate(rootFiber, sourceFiber, 2);
    null !== rootFiber && (markRootUpdated$1(rootFiber, 2), ensureRootIsScheduled(rootFiber));
  }
  function captureCommitPhaseError(sourceFiber, nearestMountedAncestor, error) {
    if (3 === sourceFiber.tag)
      captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    else
      for (; null !== nearestMountedAncestor; ) {
        if (3 === nearestMountedAncestor.tag) {
          captureCommitPhaseErrorOnRoot(
            nearestMountedAncestor,
            sourceFiber,
            error
          );
          break;
        } else if (1 === nearestMountedAncestor.tag) {
          var instance = nearestMountedAncestor.stateNode;
          if ("function" === typeof nearestMountedAncestor.type.getDerivedStateFromError || "function" === typeof instance.componentDidCatch && (null === legacyErrorBoundariesThatAlreadyFailed || !legacyErrorBoundariesThatAlreadyFailed.has(instance))) {
            sourceFiber = createCapturedValueAtFiber(error, sourceFiber);
            error = createClassErrorUpdate(2);
            instance = enqueueUpdate(nearestMountedAncestor, error, 2);
            null !== instance && (initializeClassErrorUpdate(
              error,
              instance,
              nearestMountedAncestor,
              sourceFiber
            ), markRootUpdated$1(instance, 2), ensureRootIsScheduled(instance));
            break;
          }
        }
        nearestMountedAncestor = nearestMountedAncestor.return;
      }
  }
  function attachPingListener(root2, wakeable, lanes) {
    var pingCache = root2.pingCache;
    if (null === pingCache) {
      pingCache = root2.pingCache = new PossiblyWeakMap();
      var threadIDs = /* @__PURE__ */ new Set();
      pingCache.set(wakeable, threadIDs);
    } else
      threadIDs = pingCache.get(wakeable), void 0 === threadIDs && (threadIDs = /* @__PURE__ */ new Set(), pingCache.set(wakeable, threadIDs));
    threadIDs.has(lanes) || (workInProgressRootDidAttachPingListener = true, threadIDs.add(lanes), root2 = pingSuspendedRoot.bind(null, root2, wakeable, lanes), wakeable.then(root2, root2));
  }
  function pingSuspendedRoot(root2, wakeable, pingedLanes) {
    var pingCache = root2.pingCache;
    null !== pingCache && pingCache.delete(wakeable);
    root2.pingedLanes |= root2.suspendedLanes & pingedLanes;
    root2.warmLanes &= ~pingedLanes;
    workInProgressRoot === root2 && (workInProgressRootRenderLanes & pingedLanes) === pingedLanes && (4 === workInProgressRootExitStatus || 3 === workInProgressRootExitStatus && (workInProgressRootRenderLanes & 62914560) === workInProgressRootRenderLanes && 300 > now() - globalMostRecentFallbackTime ? 0 === (executionContext & 2) && prepareFreshStack(root2, 0) : workInProgressRootPingedLanes |= pingedLanes, workInProgressSuspendedRetryLanes === workInProgressRootRenderLanes && (workInProgressSuspendedRetryLanes = 0));
    ensureRootIsScheduled(root2);
  }
  function retryTimedOutBoundary(boundaryFiber, retryLane) {
    0 === retryLane && (retryLane = claimNextRetryLane());
    boundaryFiber = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
    null !== boundaryFiber && (markRootUpdated$1(boundaryFiber, retryLane), ensureRootIsScheduled(boundaryFiber));
  }
  function retryDehydratedSuspenseBoundary(boundaryFiber) {
    var suspenseState = boundaryFiber.memoizedState, retryLane = 0;
    null !== suspenseState && (retryLane = suspenseState.retryLane);
    retryTimedOutBoundary(boundaryFiber, retryLane);
  }
  function resolveRetryWakeable(boundaryFiber, wakeable) {
    var retryLane = 0;
    switch (boundaryFiber.tag) {
      case 31:
      case 13:
        var retryCache = boundaryFiber.stateNode;
        var suspenseState = boundaryFiber.memoizedState;
        null !== suspenseState && (retryLane = suspenseState.retryLane);
        break;
      case 19:
        retryCache = boundaryFiber.stateNode;
        break;
      case 22:
        retryCache = boundaryFiber.stateNode._retryCache;
        break;
      default:
        throw Error(formatProdErrorMessage(314));
    }
    null !== retryCache && retryCache.delete(wakeable);
    retryTimedOutBoundary(boundaryFiber, retryLane);
  }
  function scheduleCallback$1(priorityLevel, callback) {
    return scheduleCallback$3(priorityLevel, callback);
  }
  var firstScheduledRoot = null, lastScheduledRoot = null, didScheduleMicrotask = false, mightHavePendingSyncWork = false, isFlushingWork = false, currentEventTransitionLane = 0;
  function ensureRootIsScheduled(root2) {
    root2 !== lastScheduledRoot && null === root2.next && (null === lastScheduledRoot ? firstScheduledRoot = lastScheduledRoot = root2 : lastScheduledRoot = lastScheduledRoot.next = root2);
    mightHavePendingSyncWork = true;
    didScheduleMicrotask || (didScheduleMicrotask = true, scheduleImmediateRootScheduleTask());
  }
  function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
    if (!isFlushingWork && mightHavePendingSyncWork) {
      isFlushingWork = true;
      do {
        var didPerformSomeWork = false;
        for (var root$170 = firstScheduledRoot; null !== root$170; ) {
          if (0 !== syncTransitionLanes) {
            var pendingLanes = root$170.pendingLanes;
            if (0 === pendingLanes) var JSCompiler_inline_result = 0;
            else {
              var suspendedLanes = root$170.suspendedLanes, pingedLanes = root$170.pingedLanes;
              JSCompiler_inline_result = (1 << 31 - clz32(42 | syncTransitionLanes) + 1) - 1;
              JSCompiler_inline_result &= pendingLanes & ~(suspendedLanes & ~pingedLanes);
              JSCompiler_inline_result = JSCompiler_inline_result & 201326741 ? JSCompiler_inline_result & 201326741 | 1 : JSCompiler_inline_result ? JSCompiler_inline_result | 2 : 0;
            }
            0 !== JSCompiler_inline_result && (didPerformSomeWork = true, performSyncWorkOnRoot(root$170, JSCompiler_inline_result));
          } else
            JSCompiler_inline_result = workInProgressRootRenderLanes, JSCompiler_inline_result = getNextLanes(
              root$170,
              root$170 === workInProgressRoot ? JSCompiler_inline_result : 0,
              null !== root$170.cancelPendingCommit || -1 !== root$170.timeoutHandle
            ), 0 === (JSCompiler_inline_result & 3) || checkIfRootIsPrerendering(root$170, JSCompiler_inline_result) || (didPerformSomeWork = true, performSyncWorkOnRoot(root$170, JSCompiler_inline_result));
          root$170 = root$170.next;
        }
      } while (didPerformSomeWork);
      isFlushingWork = false;
    }
  }
  function processRootScheduleInImmediateTask() {
    processRootScheduleInMicrotask();
  }
  function processRootScheduleInMicrotask() {
    mightHavePendingSyncWork = didScheduleMicrotask = false;
    var syncTransitionLanes = 0;
    0 !== currentEventTransitionLane && shouldAttemptEagerTransition() && (syncTransitionLanes = currentEventTransitionLane);
    for (var currentTime = now(), prev = null, root2 = firstScheduledRoot; null !== root2; ) {
      var next = root2.next, nextLanes = scheduleTaskForRootDuringMicrotask(root2, currentTime);
      if (0 === nextLanes)
        root2.next = null, null === prev ? firstScheduledRoot = next : prev.next = next, null === next && (lastScheduledRoot = prev);
      else if (prev = root2, 0 !== syncTransitionLanes || 0 !== (nextLanes & 3))
        mightHavePendingSyncWork = true;
      root2 = next;
    }
    0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus || flushSyncWorkAcrossRoots_impl(syncTransitionLanes);
    0 !== currentEventTransitionLane && (currentEventTransitionLane = 0);
  }
  function scheduleTaskForRootDuringMicrotask(root2, currentTime) {
    for (var suspendedLanes = root2.suspendedLanes, pingedLanes = root2.pingedLanes, expirationTimes = root2.expirationTimes, lanes = root2.pendingLanes & -62914561; 0 < lanes; ) {
      var index$5 = 31 - clz32(lanes), lane = 1 << index$5, expirationTime = expirationTimes[index$5];
      if (-1 === expirationTime) {
        if (0 === (lane & suspendedLanes) || 0 !== (lane & pingedLanes))
          expirationTimes[index$5] = computeExpirationTime(lane, currentTime);
      } else expirationTime <= currentTime && (root2.expiredLanes |= lane);
      lanes &= ~lane;
    }
    currentTime = workInProgressRoot;
    suspendedLanes = workInProgressRootRenderLanes;
    suspendedLanes = getNextLanes(
      root2,
      root2 === currentTime ? suspendedLanes : 0,
      null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
    );
    pingedLanes = root2.callbackNode;
    if (0 === suspendedLanes || root2 === currentTime && (2 === workInProgressSuspendedReason || 9 === workInProgressSuspendedReason) || null !== root2.cancelPendingCommit)
      return null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes), root2.callbackNode = null, root2.callbackPriority = 0;
    if (0 === (suspendedLanes & 3) || checkIfRootIsPrerendering(root2, suspendedLanes)) {
      currentTime = suspendedLanes & -suspendedLanes;
      if (currentTime === root2.callbackPriority) return currentTime;
      null !== pingedLanes && cancelCallback$1(pingedLanes);
      switch (lanesToEventPriority(suspendedLanes)) {
        case 2:
        case 8:
          suspendedLanes = UserBlockingPriority;
          break;
        case 32:
          suspendedLanes = NormalPriority$1;
          break;
        case 268435456:
          suspendedLanes = IdlePriority;
          break;
        default:
          suspendedLanes = NormalPriority$1;
      }
      pingedLanes = performWorkOnRootViaSchedulerTask.bind(null, root2);
      suspendedLanes = scheduleCallback$3(suspendedLanes, pingedLanes);
      root2.callbackPriority = currentTime;
      root2.callbackNode = suspendedLanes;
      return currentTime;
    }
    null !== pingedLanes && null !== pingedLanes && cancelCallback$1(pingedLanes);
    root2.callbackPriority = 2;
    root2.callbackNode = null;
    return 2;
  }
  function performWorkOnRootViaSchedulerTask(root2, didTimeout) {
    if (0 !== pendingEffectsStatus && 5 !== pendingEffectsStatus)
      return root2.callbackNode = null, root2.callbackPriority = 0, null;
    var originalCallbackNode = root2.callbackNode;
    if (flushPendingEffects() && root2.callbackNode !== originalCallbackNode)
      return null;
    var workInProgressRootRenderLanes$jscomp$0 = workInProgressRootRenderLanes;
    workInProgressRootRenderLanes$jscomp$0 = getNextLanes(
      root2,
      root2 === workInProgressRoot ? workInProgressRootRenderLanes$jscomp$0 : 0,
      null !== root2.cancelPendingCommit || -1 !== root2.timeoutHandle
    );
    if (0 === workInProgressRootRenderLanes$jscomp$0) return null;
    performWorkOnRoot(root2, workInProgressRootRenderLanes$jscomp$0, didTimeout);
    scheduleTaskForRootDuringMicrotask(root2, now());
    return null != root2.callbackNode && root2.callbackNode === originalCallbackNode ? performWorkOnRootViaSchedulerTask.bind(null, root2) : null;
  }
  function performSyncWorkOnRoot(root2, lanes) {
    if (flushPendingEffects()) return null;
    performWorkOnRoot(root2, lanes, true);
  }
  function scheduleImmediateRootScheduleTask() {
    scheduleMicrotask(function() {
      0 !== (executionContext & 6) ? scheduleCallback$3(
        ImmediatePriority,
        processRootScheduleInImmediateTask
      ) : processRootScheduleInMicrotask();
    });
  }
  function requestTransitionLane() {
    if (0 === currentEventTransitionLane) {
      var actionScopeLane = currentEntangledLane;
      0 === actionScopeLane && (actionScopeLane = nextTransitionUpdateLane, nextTransitionUpdateLane <<= 1, 0 === (nextTransitionUpdateLane & 261888) && (nextTransitionUpdateLane = 256));
      currentEventTransitionLane = actionScopeLane;
    }
    return currentEventTransitionLane;
  }
  function coerceFormActionProp(actionProp) {
    return null == actionProp || "symbol" === typeof actionProp || "boolean" === typeof actionProp ? null : "function" === typeof actionProp ? actionProp : sanitizeURL("" + actionProp);
  }
  function createFormDataWithSubmitter(form, submitter) {
    var temp = submitter.ownerDocument.createElement("input");
    temp.name = submitter.name;
    temp.value = submitter.value;
    form.id && temp.setAttribute("form", form.id);
    submitter.parentNode.insertBefore(temp, submitter);
    form = new FormData(form);
    temp.parentNode.removeChild(temp);
    return form;
  }
  function extractEvents$1(dispatchQueue, domEventName, maybeTargetInst, nativeEvent, nativeEventTarget) {
    if ("submit" === domEventName && maybeTargetInst && maybeTargetInst.stateNode === nativeEventTarget) {
      var action = coerceFormActionProp(
        (nativeEventTarget[internalPropsKey] || null).action
      ), submitter = nativeEvent.submitter;
      submitter && (domEventName = (domEventName = submitter[internalPropsKey] || null) ? coerceFormActionProp(domEventName.formAction) : submitter.getAttribute("formAction"), null !== domEventName && (action = domEventName, submitter = null));
      var event = new SyntheticEvent(
        "action",
        "action",
        null,
        nativeEvent,
        nativeEventTarget
      );
      dispatchQueue.push({
        event,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (nativeEvent.defaultPrevented) {
                if (0 !== currentEventTransitionLane) {
                  var formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget);
                  startHostTransition(
                    maybeTargetInst,
                    {
                      pending: true,
                      data: formData,
                      method: nativeEventTarget.method,
                      action
                    },
                    null,
                    formData
                  );
                }
              } else
                "function" === typeof action && (event.preventDefault(), formData = submitter ? createFormDataWithSubmitter(nativeEventTarget, submitter) : new FormData(nativeEventTarget), startHostTransition(
                  maybeTargetInst,
                  {
                    pending: true,
                    data: formData,
                    method: nativeEventTarget.method,
                    action
                  },
                  action,
                  formData
                ));
            },
            currentTarget: nativeEventTarget
          }
        ]
      });
    }
  }
  for (var i$jscomp$inline_1577 = 0; i$jscomp$inline_1577 < simpleEventPluginEvents.length; i$jscomp$inline_1577++) {
    var eventName$jscomp$inline_1578 = simpleEventPluginEvents[i$jscomp$inline_1577], domEventName$jscomp$inline_1579 = eventName$jscomp$inline_1578.toLowerCase(), capitalizedEvent$jscomp$inline_1580 = eventName$jscomp$inline_1578[0].toUpperCase() + eventName$jscomp$inline_1578.slice(1);
    registerSimpleEvent(
      domEventName$jscomp$inline_1579,
      "on" + capitalizedEvent$jscomp$inline_1580
    );
  }
  registerSimpleEvent(ANIMATION_END, "onAnimationEnd");
  registerSimpleEvent(ANIMATION_ITERATION, "onAnimationIteration");
  registerSimpleEvent(ANIMATION_START, "onAnimationStart");
  registerSimpleEvent("dblclick", "onDoubleClick");
  registerSimpleEvent("focusin", "onFocus");
  registerSimpleEvent("focusout", "onBlur");
  registerSimpleEvent(TRANSITION_RUN, "onTransitionRun");
  registerSimpleEvent(TRANSITION_START, "onTransitionStart");
  registerSimpleEvent(TRANSITION_CANCEL, "onTransitionCancel");
  registerSimpleEvent(TRANSITION_END, "onTransitionEnd");
  registerDirectEvent("onMouseEnter", ["mouseout", "mouseover"]);
  registerDirectEvent("onMouseLeave", ["mouseout", "mouseover"]);
  registerDirectEvent("onPointerEnter", ["pointerout", "pointerover"]);
  registerDirectEvent("onPointerLeave", ["pointerout", "pointerover"]);
  registerTwoPhaseEvent(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  );
  registerTwoPhaseEvent(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  );
  registerTwoPhaseEvent("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]);
  registerTwoPhaseEvent(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  );
  registerTwoPhaseEvent(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  );
  registerTwoPhaseEvent(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var mediaEventTypes = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), nonDelegatedEvents = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(mediaEventTypes)
  );
  function processDispatchQueue(dispatchQueue, eventSystemFlags) {
    eventSystemFlags = 0 !== (eventSystemFlags & 4);
    for (var i = 0; i < dispatchQueue.length; i++) {
      var _dispatchQueue$i = dispatchQueue[i], event = _dispatchQueue$i.event;
      _dispatchQueue$i = _dispatchQueue$i.listeners;
      a: {
        var previousInstance = void 0;
        if (eventSystemFlags)
          for (var i$jscomp$0 = _dispatchQueue$i.length - 1; 0 <= i$jscomp$0; i$jscomp$0--) {
            var _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0], instance = _dispatchListeners$i.instance, currentTarget = _dispatchListeners$i.currentTarget;
            _dispatchListeners$i = _dispatchListeners$i.listener;
            if (instance !== previousInstance && event.isPropagationStopped())
              break a;
            previousInstance = _dispatchListeners$i;
            event.currentTarget = currentTarget;
            try {
              previousInstance(event);
            } catch (error) {
              reportGlobalError(error);
            }
            event.currentTarget = null;
            previousInstance = instance;
          }
        else
          for (i$jscomp$0 = 0; i$jscomp$0 < _dispatchQueue$i.length; i$jscomp$0++) {
            _dispatchListeners$i = _dispatchQueue$i[i$jscomp$0];
            instance = _dispatchListeners$i.instance;
            currentTarget = _dispatchListeners$i.currentTarget;
            _dispatchListeners$i = _dispatchListeners$i.listener;
            if (instance !== previousInstance && event.isPropagationStopped())
              break a;
            previousInstance = _dispatchListeners$i;
            event.currentTarget = currentTarget;
            try {
              previousInstance(event);
            } catch (error) {
              reportGlobalError(error);
            }
            event.currentTarget = null;
            previousInstance = instance;
          }
      }
    }
  }
  function listenToNonDelegatedEvent(domEventName, targetElement) {
    var JSCompiler_inline_result = targetElement[internalEventHandlersKey];
    void 0 === JSCompiler_inline_result && (JSCompiler_inline_result = targetElement[internalEventHandlersKey] = /* @__PURE__ */ new Set());
    var listenerSetKey = domEventName + "__bubble";
    JSCompiler_inline_result.has(listenerSetKey) || (addTrappedEventListener(targetElement, domEventName, 2, false), JSCompiler_inline_result.add(listenerSetKey));
  }
  function listenToNativeEvent(domEventName, isCapturePhaseListener, target) {
    var eventSystemFlags = 0;
    isCapturePhaseListener && (eventSystemFlags |= 4);
    addTrappedEventListener(
      target,
      domEventName,
      eventSystemFlags,
      isCapturePhaseListener
    );
  }
  var listeningMarker = "_reactListening" + Math.random().toString(36).slice(2);
  function listenToAllSupportedEvents(rootContainerElement) {
    if (!rootContainerElement[listeningMarker]) {
      rootContainerElement[listeningMarker] = true;
      allNativeEvents.forEach(function(domEventName) {
        "selectionchange" !== domEventName && (nonDelegatedEvents.has(domEventName) || listenToNativeEvent(domEventName, false, rootContainerElement), listenToNativeEvent(domEventName, true, rootContainerElement));
      });
      var ownerDocument = 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
      null === ownerDocument || ownerDocument[listeningMarker] || (ownerDocument[listeningMarker] = true, listenToNativeEvent("selectionchange", false, ownerDocument));
    }
  }
  function addTrappedEventListener(targetContainer, domEventName, eventSystemFlags, isCapturePhaseListener) {
    switch (getEventPriority(domEventName)) {
      case 2:
        var listenerWrapper = dispatchDiscreteEvent;
        break;
      case 8:
        listenerWrapper = dispatchContinuousEvent;
        break;
      default:
        listenerWrapper = dispatchEvent;
    }
    eventSystemFlags = listenerWrapper.bind(
      null,
      domEventName,
      eventSystemFlags,
      targetContainer
    );
    listenerWrapper = void 0;
    !passiveBrowserEventsSupported || "touchstart" !== domEventName && "touchmove" !== domEventName && "wheel" !== domEventName || (listenerWrapper = true);
    isCapturePhaseListener ? void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
      capture: true,
      passive: listenerWrapper
    }) : targetContainer.addEventListener(domEventName, eventSystemFlags, true) : void 0 !== listenerWrapper ? targetContainer.addEventListener(domEventName, eventSystemFlags, {
      passive: listenerWrapper
    }) : targetContainer.addEventListener(domEventName, eventSystemFlags, false);
  }
  function dispatchEventForPluginEventSystem(domEventName, eventSystemFlags, nativeEvent, targetInst$jscomp$0, targetContainer) {
    var ancestorInst = targetInst$jscomp$0;
    if (0 === (eventSystemFlags & 1) && 0 === (eventSystemFlags & 2) && null !== targetInst$jscomp$0)
      a: for (; ; ) {
        if (null === targetInst$jscomp$0) return;
        var nodeTag = targetInst$jscomp$0.tag;
        if (3 === nodeTag || 4 === nodeTag) {
          var container = targetInst$jscomp$0.stateNode.containerInfo;
          if (container === targetContainer) break;
          if (4 === nodeTag)
            for (nodeTag = targetInst$jscomp$0.return; null !== nodeTag; ) {
              var grandTag = nodeTag.tag;
              if ((3 === grandTag || 4 === grandTag) && nodeTag.stateNode.containerInfo === targetContainer)
                return;
              nodeTag = nodeTag.return;
            }
          for (; null !== container; ) {
            nodeTag = getClosestInstanceFromNode(container);
            if (null === nodeTag) return;
            grandTag = nodeTag.tag;
            if (5 === grandTag || 6 === grandTag || 26 === grandTag || 27 === grandTag) {
              targetInst$jscomp$0 = ancestorInst = nodeTag;
              continue a;
            }
            container = container.parentNode;
          }
        }
        targetInst$jscomp$0 = targetInst$jscomp$0.return;
      }
    batchedUpdates$1(function() {
      var targetInst = ancestorInst, nativeEventTarget = getEventTarget(nativeEvent), dispatchQueue = [];
      a: {
        var reactName = topLevelEventsToReactNames.get(domEventName);
        if (void 0 !== reactName) {
          var SyntheticEventCtor = SyntheticEvent, reactEventType = domEventName;
          switch (domEventName) {
            case "keypress":
              if (0 === getEventCharCode(nativeEvent)) break a;
            case "keydown":
            case "keyup":
              SyntheticEventCtor = SyntheticKeyboardEvent;
              break;
            case "focusin":
              reactEventType = "focus";
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "focusout":
              reactEventType = "blur";
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "beforeblur":
            case "afterblur":
              SyntheticEventCtor = SyntheticFocusEvent;
              break;
            case "click":
              if (2 === nativeEvent.button) break a;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              SyntheticEventCtor = SyntheticMouseEvent;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              SyntheticEventCtor = SyntheticDragEvent;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              SyntheticEventCtor = SyntheticTouchEvent;
              break;
            case ANIMATION_END:
            case ANIMATION_ITERATION:
            case ANIMATION_START:
              SyntheticEventCtor = SyntheticAnimationEvent;
              break;
            case TRANSITION_END:
              SyntheticEventCtor = SyntheticTransitionEvent;
              break;
            case "scroll":
            case "scrollend":
              SyntheticEventCtor = SyntheticUIEvent;
              break;
            case "wheel":
              SyntheticEventCtor = SyntheticWheelEvent;
              break;
            case "copy":
            case "cut":
            case "paste":
              SyntheticEventCtor = SyntheticClipboardEvent;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              SyntheticEventCtor = SyntheticPointerEvent;
              break;
            case "toggle":
            case "beforetoggle":
              SyntheticEventCtor = SyntheticToggleEvent;
          }
          var inCapturePhase = 0 !== (eventSystemFlags & 4), accumulateTargetOnly = !inCapturePhase && ("scroll" === domEventName || "scrollend" === domEventName), reactEventName = inCapturePhase ? null !== reactName ? reactName + "Capture" : null : reactName;
          inCapturePhase = [];
          for (var instance = targetInst, lastHostComponent; null !== instance; ) {
            var _instance = instance;
            lastHostComponent = _instance.stateNode;
            _instance = _instance.tag;
            5 !== _instance && 26 !== _instance && 27 !== _instance || null === lastHostComponent || null === reactEventName || (_instance = getListener(instance, reactEventName), null != _instance && inCapturePhase.push(
              createDispatchListener(instance, _instance, lastHostComponent)
            ));
            if (accumulateTargetOnly) break;
            instance = instance.return;
          }
          0 < inCapturePhase.length && (reactName = new SyntheticEventCtor(
            reactName,
            reactEventType,
            null,
            nativeEvent,
            nativeEventTarget
          ), dispatchQueue.push({ event: reactName, listeners: inCapturePhase }));
        }
      }
      if (0 === (eventSystemFlags & 7)) {
        a: {
          reactName = "mouseover" === domEventName || "pointerover" === domEventName;
          SyntheticEventCtor = "mouseout" === domEventName || "pointerout" === domEventName;
          if (reactName && nativeEvent !== currentReplayingEvent && (reactEventType = nativeEvent.relatedTarget || nativeEvent.fromElement) && (getClosestInstanceFromNode(reactEventType) || reactEventType[internalContainerInstanceKey]))
            break a;
          if (SyntheticEventCtor || reactName) {
            reactName = nativeEventTarget.window === nativeEventTarget ? nativeEventTarget : (reactName = nativeEventTarget.ownerDocument) ? reactName.defaultView || reactName.parentWindow : window;
            if (SyntheticEventCtor) {
              if (reactEventType = nativeEvent.relatedTarget || nativeEvent.toElement, SyntheticEventCtor = targetInst, reactEventType = reactEventType ? getClosestInstanceFromNode(reactEventType) : null, null !== reactEventType && (accumulateTargetOnly = getNearestMountedFiber(reactEventType), inCapturePhase = reactEventType.tag, reactEventType !== accumulateTargetOnly || 5 !== inCapturePhase && 27 !== inCapturePhase && 6 !== inCapturePhase))
                reactEventType = null;
            } else SyntheticEventCtor = null, reactEventType = targetInst;
            if (SyntheticEventCtor !== reactEventType) {
              inCapturePhase = SyntheticMouseEvent;
              _instance = "onMouseLeave";
              reactEventName = "onMouseEnter";
              instance = "mouse";
              if ("pointerout" === domEventName || "pointerover" === domEventName)
                inCapturePhase = SyntheticPointerEvent, _instance = "onPointerLeave", reactEventName = "onPointerEnter", instance = "pointer";
              accumulateTargetOnly = null == SyntheticEventCtor ? reactName : getNodeFromInstance(SyntheticEventCtor);
              lastHostComponent = null == reactEventType ? reactName : getNodeFromInstance(reactEventType);
              reactName = new inCapturePhase(
                _instance,
                instance + "leave",
                SyntheticEventCtor,
                nativeEvent,
                nativeEventTarget
              );
              reactName.target = accumulateTargetOnly;
              reactName.relatedTarget = lastHostComponent;
              _instance = null;
              getClosestInstanceFromNode(nativeEventTarget) === targetInst && (inCapturePhase = new inCapturePhase(
                reactEventName,
                instance + "enter",
                reactEventType,
                nativeEvent,
                nativeEventTarget
              ), inCapturePhase.target = lastHostComponent, inCapturePhase.relatedTarget = accumulateTargetOnly, _instance = inCapturePhase);
              accumulateTargetOnly = _instance;
              if (SyntheticEventCtor && reactEventType)
                b: {
                  inCapturePhase = getParent;
                  reactEventName = SyntheticEventCtor;
                  instance = reactEventType;
                  lastHostComponent = 0;
                  for (_instance = reactEventName; _instance; _instance = inCapturePhase(_instance))
                    lastHostComponent++;
                  _instance = 0;
                  for (var tempB = instance; tempB; tempB = inCapturePhase(tempB))
                    _instance++;
                  for (; 0 < lastHostComponent - _instance; )
                    reactEventName = inCapturePhase(reactEventName), lastHostComponent--;
                  for (; 0 < _instance - lastHostComponent; )
                    instance = inCapturePhase(instance), _instance--;
                  for (; lastHostComponent--; ) {
                    if (reactEventName === instance || null !== instance && reactEventName === instance.alternate) {
                      inCapturePhase = reactEventName;
                      break b;
                    }
                    reactEventName = inCapturePhase(reactEventName);
                    instance = inCapturePhase(instance);
                  }
                  inCapturePhase = null;
                }
              else inCapturePhase = null;
              null !== SyntheticEventCtor && accumulateEnterLeaveListenersForEvent(
                dispatchQueue,
                reactName,
                SyntheticEventCtor,
                inCapturePhase,
                false
              );
              null !== reactEventType && null !== accumulateTargetOnly && accumulateEnterLeaveListenersForEvent(
                dispatchQueue,
                accumulateTargetOnly,
                reactEventType,
                inCapturePhase,
                true
              );
            }
          }
        }
        a: {
          reactName = targetInst ? getNodeFromInstance(targetInst) : window;
          SyntheticEventCtor = reactName.nodeName && reactName.nodeName.toLowerCase();
          if ("select" === SyntheticEventCtor || "input" === SyntheticEventCtor && "file" === reactName.type)
            var getTargetInstFunc = getTargetInstForChangeEvent;
          else if (isTextInputElement(reactName))
            if (isInputEventSupported)
              getTargetInstFunc = getTargetInstForInputOrChangeEvent;
            else {
              getTargetInstFunc = getTargetInstForInputEventPolyfill;
              var handleEventFunc = handleEventsForInputEventPolyfill;
            }
          else
            SyntheticEventCtor = reactName.nodeName, !SyntheticEventCtor || "input" !== SyntheticEventCtor.toLowerCase() || "checkbox" !== reactName.type && "radio" !== reactName.type ? targetInst && isCustomElement(targetInst.elementType) && (getTargetInstFunc = getTargetInstForChangeEvent) : getTargetInstFunc = getTargetInstForClickEvent;
          if (getTargetInstFunc && (getTargetInstFunc = getTargetInstFunc(domEventName, targetInst))) {
            createAndAccumulateChangeEvent(
              dispatchQueue,
              getTargetInstFunc,
              nativeEvent,
              nativeEventTarget
            );
            break a;
          }
          handleEventFunc && handleEventFunc(domEventName, reactName, targetInst);
          "focusout" === domEventName && targetInst && "number" === reactName.type && null != targetInst.memoizedProps.value && setDefaultValue(reactName, "number", reactName.value);
        }
        handleEventFunc = targetInst ? getNodeFromInstance(targetInst) : window;
        switch (domEventName) {
          case "focusin":
            if (isTextInputElement(handleEventFunc) || "true" === handleEventFunc.contentEditable)
              activeElement = handleEventFunc, activeElementInst = targetInst, lastSelection = null;
            break;
          case "focusout":
            lastSelection = activeElementInst = activeElement = null;
            break;
          case "mousedown":
            mouseDown = true;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            mouseDown = false;
            constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
            break;
          case "selectionchange":
            if (skipSelectionChangeEvent) break;
          case "keydown":
          case "keyup":
            constructSelectEvent(dispatchQueue, nativeEvent, nativeEventTarget);
        }
        var fallbackData;
        if (canUseCompositionEvent)
          b: {
            switch (domEventName) {
              case "compositionstart":
                var eventType = "onCompositionStart";
                break b;
              case "compositionend":
                eventType = "onCompositionEnd";
                break b;
              case "compositionupdate":
                eventType = "onCompositionUpdate";
                break b;
            }
            eventType = void 0;
          }
        else
          isComposing ? isFallbackCompositionEnd(domEventName, nativeEvent) && (eventType = "onCompositionEnd") : "keydown" === domEventName && 229 === nativeEvent.keyCode && (eventType = "onCompositionStart");
        eventType && (useFallbackCompositionData && "ko" !== nativeEvent.locale && (isComposing || "onCompositionStart" !== eventType ? "onCompositionEnd" === eventType && isComposing && (fallbackData = getData()) : (root = nativeEventTarget, startText = "value" in root ? root.value : root.textContent, isComposing = true)), handleEventFunc = accumulateTwoPhaseListeners(targetInst, eventType), 0 < handleEventFunc.length && (eventType = new SyntheticCompositionEvent(
          eventType,
          domEventName,
          null,
          nativeEvent,
          nativeEventTarget
        ), dispatchQueue.push({ event: eventType, listeners: handleEventFunc }), fallbackData ? eventType.data = fallbackData : (fallbackData = getDataFromCustomEvent(nativeEvent), null !== fallbackData && (eventType.data = fallbackData))));
        if (fallbackData = canUseTextInputEvent ? getNativeBeforeInputChars(domEventName, nativeEvent) : getFallbackBeforeInputChars(domEventName, nativeEvent))
          eventType = accumulateTwoPhaseListeners(targetInst, "onBeforeInput"), 0 < eventType.length && (handleEventFunc = new SyntheticCompositionEvent(
            "onBeforeInput",
            "beforeinput",
            null,
            nativeEvent,
            nativeEventTarget
          ), dispatchQueue.push({
            event: handleEventFunc,
            listeners: eventType
          }), handleEventFunc.data = fallbackData);
        extractEvents$1(
          dispatchQueue,
          domEventName,
          targetInst,
          nativeEvent,
          nativeEventTarget
        );
      }
      processDispatchQueue(dispatchQueue, eventSystemFlags);
    });
  }
  function createDispatchListener(instance, listener, currentTarget) {
    return {
      instance,
      listener,
      currentTarget
    };
  }
  function accumulateTwoPhaseListeners(targetFiber, reactName) {
    for (var captureName = reactName + "Capture", listeners = []; null !== targetFiber; ) {
      var _instance2 = targetFiber, stateNode = _instance2.stateNode;
      _instance2 = _instance2.tag;
      5 !== _instance2 && 26 !== _instance2 && 27 !== _instance2 || null === stateNode || (_instance2 = getListener(targetFiber, captureName), null != _instance2 && listeners.unshift(
        createDispatchListener(targetFiber, _instance2, stateNode)
      ), _instance2 = getListener(targetFiber, reactName), null != _instance2 && listeners.push(
        createDispatchListener(targetFiber, _instance2, stateNode)
      ));
      if (3 === targetFiber.tag) return listeners;
      targetFiber = targetFiber.return;
    }
    return [];
  }
  function getParent(inst) {
    if (null === inst) return null;
    do
      inst = inst.return;
    while (inst && 5 !== inst.tag && 27 !== inst.tag);
    return inst ? inst : null;
  }
  function accumulateEnterLeaveListenersForEvent(dispatchQueue, event, target, common, inCapturePhase) {
    for (var registrationName = event._reactName, listeners = []; null !== target && target !== common; ) {
      var _instance3 = target, alternate = _instance3.alternate, stateNode = _instance3.stateNode;
      _instance3 = _instance3.tag;
      if (null !== alternate && alternate === common) break;
      5 !== _instance3 && 26 !== _instance3 && 27 !== _instance3 || null === stateNode || (alternate = stateNode, inCapturePhase ? (stateNode = getListener(target, registrationName), null != stateNode && listeners.unshift(
        createDispatchListener(target, stateNode, alternate)
      )) : inCapturePhase || (stateNode = getListener(target, registrationName), null != stateNode && listeners.push(
        createDispatchListener(target, stateNode, alternate)
      )));
      target = target.return;
    }
    0 !== listeners.length && dispatchQueue.push({ event, listeners });
  }
  var NORMALIZE_NEWLINES_REGEX = /\r\n?/g, NORMALIZE_NULL_AND_REPLACEMENT_REGEX = /\u0000|\uFFFD/g;
  function normalizeMarkupForTextOrAttribute(markup) {
    return ("string" === typeof markup ? markup : "" + markup).replace(NORMALIZE_NEWLINES_REGEX, "\n").replace(NORMALIZE_NULL_AND_REPLACEMENT_REGEX, "");
  }
  function checkForUnmatchedText(serverText, clientText) {
    clientText = normalizeMarkupForTextOrAttribute(clientText);
    return normalizeMarkupForTextOrAttribute(serverText) === clientText ? true : false;
  }
  function setProp(domElement, tag, key, value, props, prevValue) {
    switch (key) {
      case "children":
        "string" === typeof value ? "body" === tag || "textarea" === tag && "" === value || setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && "body" !== tag && setTextContent(domElement, "" + value);
        break;
      case "className":
        setValueForKnownAttribute(domElement, "class", value);
        break;
      case "tabIndex":
        setValueForKnownAttribute(domElement, "tabindex", value);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        setValueForKnownAttribute(domElement, key, value);
        break;
      case "style":
        setValueForStyles(domElement, value, prevValue);
        break;
      case "data":
        if ("object" !== tag) {
          setValueForKnownAttribute(domElement, "data", value);
          break;
        }
      case "src":
      case "href":
        if ("" === value && ("a" !== tag || "href" !== key)) {
          domElement.removeAttribute(key);
          break;
        }
        if (null == value || "function" === typeof value || "symbol" === typeof value || "boolean" === typeof value) {
          domElement.removeAttribute(key);
          break;
        }
        value = sanitizeURL("" + value);
        domElement.setAttribute(key, value);
        break;
      case "action":
      case "formAction":
        if ("function" === typeof value) {
          domElement.setAttribute(
            key,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          "function" === typeof prevValue && ("formAction" === key ? ("input" !== tag && setProp(domElement, tag, "name", props.name, props, null), setProp(
            domElement,
            tag,
            "formEncType",
            props.formEncType,
            props,
            null
          ), setProp(
            domElement,
            tag,
            "formMethod",
            props.formMethod,
            props,
            null
          ), setProp(
            domElement,
            tag,
            "formTarget",
            props.formTarget,
            props,
            null
          )) : (setProp(domElement, tag, "encType", props.encType, props, null), setProp(domElement, tag, "method", props.method, props, null), setProp(domElement, tag, "target", props.target, props, null)));
        if (null == value || "symbol" === typeof value || "boolean" === typeof value) {
          domElement.removeAttribute(key);
          break;
        }
        value = sanitizeURL("" + value);
        domElement.setAttribute(key, value);
        break;
      case "onClick":
        null != value && (domElement.onclick = noop$1);
        break;
      case "onScroll":
        null != value && listenToNonDelegatedEvent("scroll", domElement);
        break;
      case "onScrollEnd":
        null != value && listenToNonDelegatedEvent("scrollend", domElement);
        break;
      case "dangerouslySetInnerHTML":
        if (null != value) {
          if ("object" !== typeof value || !("__html" in value))
            throw Error(formatProdErrorMessage(61));
          key = value.__html;
          if (null != key) {
            if (null != props.children) throw Error(formatProdErrorMessage(60));
            domElement.innerHTML = key;
          }
        }
        break;
      case "multiple":
        domElement.multiple = value && "function" !== typeof value && "symbol" !== typeof value;
        break;
      case "muted":
        domElement.muted = value && "function" !== typeof value && "symbol" !== typeof value;
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (null == value || "function" === typeof value || "boolean" === typeof value || "symbol" === typeof value) {
          domElement.removeAttribute("xlink:href");
          break;
        }
        key = sanitizeURL("" + value);
        domElement.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          key
        );
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "" + value) : domElement.removeAttribute(key);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, "") : domElement.removeAttribute(key);
        break;
      case "capture":
      case "download":
        true === value ? domElement.setAttribute(key, "") : false !== value && null != value && "function" !== typeof value && "symbol" !== typeof value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        null != value && "function" !== typeof value && "symbol" !== typeof value && !isNaN(value) && 1 <= value ? domElement.setAttribute(key, value) : domElement.removeAttribute(key);
        break;
      case "rowSpan":
      case "start":
        null == value || "function" === typeof value || "symbol" === typeof value || isNaN(value) ? domElement.removeAttribute(key) : domElement.setAttribute(key, value);
        break;
      case "popover":
        listenToNonDelegatedEvent("beforetoggle", domElement);
        listenToNonDelegatedEvent("toggle", domElement);
        setValueForAttribute(domElement, "popover", value);
        break;
      case "xlinkActuate":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          value
        );
        break;
      case "xlinkArcrole":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          value
        );
        break;
      case "xlinkRole":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          value
        );
        break;
      case "xlinkShow":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          value
        );
        break;
      case "xlinkTitle":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          value
        );
        break;
      case "xlinkType":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          value
        );
        break;
      case "xmlBase":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          value
        );
        break;
      case "xmlLang":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          value
        );
        break;
      case "xmlSpace":
        setValueForNamespacedAttribute(
          domElement,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          value
        );
        break;
      case "is":
        setValueForAttribute(domElement, "is", value);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!(2 < key.length) || "o" !== key[0] && "O" !== key[0] || "n" !== key[1] && "N" !== key[1])
          key = aliases.get(key) || key, setValueForAttribute(domElement, key, value);
    }
  }
  function setPropOnCustomElement(domElement, tag, key, value, props, prevValue) {
    switch (key) {
      case "style":
        setValueForStyles(domElement, value, prevValue);
        break;
      case "dangerouslySetInnerHTML":
        if (null != value) {
          if ("object" !== typeof value || !("__html" in value))
            throw Error(formatProdErrorMessage(61));
          key = value.__html;
          if (null != key) {
            if (null != props.children) throw Error(formatProdErrorMessage(60));
            domElement.innerHTML = key;
          }
        }
        break;
      case "children":
        "string" === typeof value ? setTextContent(domElement, value) : ("number" === typeof value || "bigint" === typeof value) && setTextContent(domElement, "" + value);
        break;
      case "onScroll":
        null != value && listenToNonDelegatedEvent("scroll", domElement);
        break;
      case "onScrollEnd":
        null != value && listenToNonDelegatedEvent("scrollend", domElement);
        break;
      case "onClick":
        null != value && (domElement.onclick = noop$1);
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!registrationNameDependencies.hasOwnProperty(key))
          a: {
            if ("o" === key[0] && "n" === key[1] && (props = key.endsWith("Capture"), tag = key.slice(2, props ? key.length - 7 : void 0), prevValue = domElement[internalPropsKey] || null, prevValue = null != prevValue ? prevValue[key] : null, "function" === typeof prevValue && domElement.removeEventListener(tag, prevValue, props), "function" === typeof value)) {
              "function" !== typeof prevValue && null !== prevValue && (key in domElement ? domElement[key] = null : domElement.hasAttribute(key) && domElement.removeAttribute(key));
              domElement.addEventListener(tag, value, props);
              break a;
            }
            key in domElement ? domElement[key] = value : true === value ? domElement.setAttribute(key, "") : setValueForAttribute(domElement, key, value);
          }
    }
  }
  function setInitialProperties(domElement, tag, props) {
    switch (tag) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        listenToNonDelegatedEvent("error", domElement);
        listenToNonDelegatedEvent("load", domElement);
        var hasSrc = false, hasSrcSet = false, propKey;
        for (propKey in props)
          if (props.hasOwnProperty(propKey)) {
            var propValue = props[propKey];
            if (null != propValue)
              switch (propKey) {
                case "src":
                  hasSrc = true;
                  break;
                case "srcSet":
                  hasSrcSet = true;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(formatProdErrorMessage(137, tag));
                default:
                  setProp(domElement, tag, propKey, propValue, props, null);
              }
          }
        hasSrcSet && setProp(domElement, tag, "srcSet", props.srcSet, props, null);
        hasSrc && setProp(domElement, tag, "src", props.src, props, null);
        return;
      case "input":
        listenToNonDelegatedEvent("invalid", domElement);
        var defaultValue = propKey = propValue = hasSrcSet = null, checked = null, defaultChecked = null;
        for (hasSrc in props)
          if (props.hasOwnProperty(hasSrc)) {
            var propValue$184 = props[hasSrc];
            if (null != propValue$184)
              switch (hasSrc) {
                case "name":
                  hasSrcSet = propValue$184;
                  break;
                case "type":
                  propValue = propValue$184;
                  break;
                case "checked":
                  checked = propValue$184;
                  break;
                case "defaultChecked":
                  defaultChecked = propValue$184;
                  break;
                case "value":
                  propKey = propValue$184;
                  break;
                case "defaultValue":
                  defaultValue = propValue$184;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (null != propValue$184)
                    throw Error(formatProdErrorMessage(137, tag));
                  break;
                default:
                  setProp(domElement, tag, hasSrc, propValue$184, props, null);
              }
          }
        initInput(
          domElement,
          propKey,
          defaultValue,
          checked,
          defaultChecked,
          propValue,
          hasSrcSet,
          false
        );
        return;
      case "select":
        listenToNonDelegatedEvent("invalid", domElement);
        hasSrc = propValue = propKey = null;
        for (hasSrcSet in props)
          if (props.hasOwnProperty(hasSrcSet) && (defaultValue = props[hasSrcSet], null != defaultValue))
            switch (hasSrcSet) {
              case "value":
                propKey = defaultValue;
                break;
              case "defaultValue":
                propValue = defaultValue;
                break;
              case "multiple":
                hasSrc = defaultValue;
              default:
                setProp(domElement, tag, hasSrcSet, defaultValue, props, null);
            }
        tag = propKey;
        props = propValue;
        domElement.multiple = !!hasSrc;
        null != tag ? updateOptions(domElement, !!hasSrc, tag, false) : null != props && updateOptions(domElement, !!hasSrc, props, true);
        return;
      case "textarea":
        listenToNonDelegatedEvent("invalid", domElement);
        propKey = hasSrcSet = hasSrc = null;
        for (propValue in props)
          if (props.hasOwnProperty(propValue) && (defaultValue = props[propValue], null != defaultValue))
            switch (propValue) {
              case "value":
                hasSrc = defaultValue;
                break;
              case "defaultValue":
                hasSrcSet = defaultValue;
                break;
              case "children":
                propKey = defaultValue;
                break;
              case "dangerouslySetInnerHTML":
                if (null != defaultValue) throw Error(formatProdErrorMessage(91));
                break;
              default:
                setProp(domElement, tag, propValue, defaultValue, props, null);
            }
        initTextarea(domElement, hasSrc, hasSrcSet, propKey);
        return;
      case "option":
        for (checked in props)
          if (props.hasOwnProperty(checked) && (hasSrc = props[checked], null != hasSrc))
            switch (checked) {
              case "selected":
                domElement.selected = hasSrc && "function" !== typeof hasSrc && "symbol" !== typeof hasSrc;
                break;
              default:
                setProp(domElement, tag, checked, hasSrc, props, null);
            }
        return;
      case "dialog":
        listenToNonDelegatedEvent("beforetoggle", domElement);
        listenToNonDelegatedEvent("toggle", domElement);
        listenToNonDelegatedEvent("cancel", domElement);
        listenToNonDelegatedEvent("close", domElement);
        break;
      case "iframe":
      case "object":
        listenToNonDelegatedEvent("load", domElement);
        break;
      case "video":
      case "audio":
        for (hasSrc = 0; hasSrc < mediaEventTypes.length; hasSrc++)
          listenToNonDelegatedEvent(mediaEventTypes[hasSrc], domElement);
        break;
      case "image":
        listenToNonDelegatedEvent("error", domElement);
        listenToNonDelegatedEvent("load", domElement);
        break;
      case "details":
        listenToNonDelegatedEvent("toggle", domElement);
        break;
      case "embed":
      case "source":
      case "link":
        listenToNonDelegatedEvent("error", domElement), listenToNonDelegatedEvent("load", domElement);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (defaultChecked in props)
          if (props.hasOwnProperty(defaultChecked) && (hasSrc = props[defaultChecked], null != hasSrc))
            switch (defaultChecked) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(formatProdErrorMessage(137, tag));
              default:
                setProp(domElement, tag, defaultChecked, hasSrc, props, null);
            }
        return;
      default:
        if (isCustomElement(tag)) {
          for (propValue$184 in props)
            props.hasOwnProperty(propValue$184) && (hasSrc = props[propValue$184], void 0 !== hasSrc && setPropOnCustomElement(
              domElement,
              tag,
              propValue$184,
              hasSrc,
              props,
              void 0
            ));
          return;
        }
    }
    for (defaultValue in props)
      props.hasOwnProperty(defaultValue) && (hasSrc = props[defaultValue], null != hasSrc && setProp(domElement, tag, defaultValue, hasSrc, props, null));
  }
  function updateProperties(domElement, tag, lastProps, nextProps) {
    switch (tag) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var name = null, type = null, value = null, defaultValue = null, lastDefaultValue = null, checked = null, defaultChecked = null;
        for (propKey in lastProps) {
          var lastProp = lastProps[propKey];
          if (lastProps.hasOwnProperty(propKey) && null != lastProp)
            switch (propKey) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                lastDefaultValue = lastProp;
              default:
                nextProps.hasOwnProperty(propKey) || setProp(domElement, tag, propKey, null, nextProps, lastProp);
            }
        }
        for (var propKey$201 in nextProps) {
          var propKey = nextProps[propKey$201];
          lastProp = lastProps[propKey$201];
          if (nextProps.hasOwnProperty(propKey$201) && (null != propKey || null != lastProp))
            switch (propKey$201) {
              case "type":
                type = propKey;
                break;
              case "name":
                name = propKey;
                break;
              case "checked":
                checked = propKey;
                break;
              case "defaultChecked":
                defaultChecked = propKey;
                break;
              case "value":
                value = propKey;
                break;
              case "defaultValue":
                defaultValue = propKey;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (null != propKey)
                  throw Error(formatProdErrorMessage(137, tag));
                break;
              default:
                propKey !== lastProp && setProp(
                  domElement,
                  tag,
                  propKey$201,
                  propKey,
                  nextProps,
                  lastProp
                );
            }
        }
        updateInput(
          domElement,
          value,
          defaultValue,
          lastDefaultValue,
          checked,
          defaultChecked,
          type,
          name
        );
        return;
      case "select":
        propKey = value = defaultValue = propKey$201 = null;
        for (type in lastProps)
          if (lastDefaultValue = lastProps[type], lastProps.hasOwnProperty(type) && null != lastDefaultValue)
            switch (type) {
              case "value":
                break;
              case "multiple":
                propKey = lastDefaultValue;
              default:
                nextProps.hasOwnProperty(type) || setProp(
                  domElement,
                  tag,
                  type,
                  null,
                  nextProps,
                  lastDefaultValue
                );
            }
        for (name in nextProps)
          if (type = nextProps[name], lastDefaultValue = lastProps[name], nextProps.hasOwnProperty(name) && (null != type || null != lastDefaultValue))
            switch (name) {
              case "value":
                propKey$201 = type;
                break;
              case "defaultValue":
                defaultValue = type;
                break;
              case "multiple":
                value = type;
              default:
                type !== lastDefaultValue && setProp(
                  domElement,
                  tag,
                  name,
                  type,
                  nextProps,
                  lastDefaultValue
                );
            }
        tag = defaultValue;
        lastProps = value;
        nextProps = propKey;
        null != propKey$201 ? updateOptions(domElement, !!lastProps, propKey$201, false) : !!nextProps !== !!lastProps && (null != tag ? updateOptions(domElement, !!lastProps, tag, true) : updateOptions(domElement, !!lastProps, lastProps ? [] : "", false));
        return;
      case "textarea":
        propKey = propKey$201 = null;
        for (defaultValue in lastProps)
          if (name = lastProps[defaultValue], lastProps.hasOwnProperty(defaultValue) && null != name && !nextProps.hasOwnProperty(defaultValue))
            switch (defaultValue) {
              case "value":
                break;
              case "children":
                break;
              default:
                setProp(domElement, tag, defaultValue, null, nextProps, name);
            }
        for (value in nextProps)
          if (name = nextProps[value], type = lastProps[value], nextProps.hasOwnProperty(value) && (null != name || null != type))
            switch (value) {
              case "value":
                propKey$201 = name;
                break;
              case "defaultValue":
                propKey = name;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (null != name) throw Error(formatProdErrorMessage(91));
                break;
              default:
                name !== type && setProp(domElement, tag, value, name, nextProps, type);
            }
        updateTextarea(domElement, propKey$201, propKey);
        return;
      case "option":
        for (var propKey$217 in lastProps)
          if (propKey$201 = lastProps[propKey$217], lastProps.hasOwnProperty(propKey$217) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$217))
            switch (propKey$217) {
              case "selected":
                domElement.selected = false;
                break;
              default:
                setProp(
                  domElement,
                  tag,
                  propKey$217,
                  null,
                  nextProps,
                  propKey$201
                );
            }
        for (lastDefaultValue in nextProps)
          if (propKey$201 = nextProps[lastDefaultValue], propKey = lastProps[lastDefaultValue], nextProps.hasOwnProperty(lastDefaultValue) && propKey$201 !== propKey && (null != propKey$201 || null != propKey))
            switch (lastDefaultValue) {
              case "selected":
                domElement.selected = propKey$201 && "function" !== typeof propKey$201 && "symbol" !== typeof propKey$201;
                break;
              default:
                setProp(
                  domElement,
                  tag,
                  lastDefaultValue,
                  propKey$201,
                  nextProps,
                  propKey
                );
            }
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var propKey$222 in lastProps)
          propKey$201 = lastProps[propKey$222], lastProps.hasOwnProperty(propKey$222) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$222) && setProp(domElement, tag, propKey$222, null, nextProps, propKey$201);
        for (checked in nextProps)
          if (propKey$201 = nextProps[checked], propKey = lastProps[checked], nextProps.hasOwnProperty(checked) && propKey$201 !== propKey && (null != propKey$201 || null != propKey))
            switch (checked) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (null != propKey$201)
                  throw Error(formatProdErrorMessage(137, tag));
                break;
              default:
                setProp(
                  domElement,
                  tag,
                  checked,
                  propKey$201,
                  nextProps,
                  propKey
                );
            }
        return;
      default:
        if (isCustomElement(tag)) {
          for (var propKey$227 in lastProps)
            propKey$201 = lastProps[propKey$227], lastProps.hasOwnProperty(propKey$227) && void 0 !== propKey$201 && !nextProps.hasOwnProperty(propKey$227) && setPropOnCustomElement(
              domElement,
              tag,
              propKey$227,
              void 0,
              nextProps,
              propKey$201
            );
          for (defaultChecked in nextProps)
            propKey$201 = nextProps[defaultChecked], propKey = lastProps[defaultChecked], !nextProps.hasOwnProperty(defaultChecked) || propKey$201 === propKey || void 0 === propKey$201 && void 0 === propKey || setPropOnCustomElement(
              domElement,
              tag,
              defaultChecked,
              propKey$201,
              nextProps,
              propKey
            );
          return;
        }
    }
    for (var propKey$232 in lastProps)
      propKey$201 = lastProps[propKey$232], lastProps.hasOwnProperty(propKey$232) && null != propKey$201 && !nextProps.hasOwnProperty(propKey$232) && setProp(domElement, tag, propKey$232, null, nextProps, propKey$201);
    for (lastProp in nextProps)
      propKey$201 = nextProps[lastProp], propKey = lastProps[lastProp], !nextProps.hasOwnProperty(lastProp) || propKey$201 === propKey || null == propKey$201 && null == propKey || setProp(domElement, tag, lastProp, propKey$201, nextProps, propKey);
  }
  function isLikelyStaticResource(initiatorType) {
    switch (initiatorType) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return true;
      default:
        return false;
    }
  }
  function estimateBandwidth() {
    if ("function" === typeof performance.getEntriesByType) {
      for (var count = 0, bits = 0, resourceEntries = performance.getEntriesByType("resource"), i = 0; i < resourceEntries.length; i++) {
        var entry = resourceEntries[i], transferSize = entry.transferSize, initiatorType = entry.initiatorType, duration = entry.duration;
        if (transferSize && duration && isLikelyStaticResource(initiatorType)) {
          initiatorType = 0;
          duration = entry.responseEnd;
          for (i += 1; i < resourceEntries.length; i++) {
            var overlapEntry = resourceEntries[i], overlapStartTime = overlapEntry.startTime;
            if (overlapStartTime > duration) break;
            var overlapTransferSize = overlapEntry.transferSize, overlapInitiatorType = overlapEntry.initiatorType;
            overlapTransferSize && isLikelyStaticResource(overlapInitiatorType) && (overlapEntry = overlapEntry.responseEnd, initiatorType += overlapTransferSize * (overlapEntry < duration ? 1 : (duration - overlapStartTime) / (overlapEntry - overlapStartTime)));
          }
          --i;
          bits += 8 * (transferSize + initiatorType) / (entry.duration / 1e3);
          count++;
          if (10 < count) break;
        }
      }
      if (0 < count) return bits / count / 1e6;
    }
    return navigator.connection && (count = navigator.connection.downlink, "number" === typeof count) ? count : 5;
  }
  var eventsEnabled = null, selectionInformation = null;
  function getOwnerDocumentFromRootContainer(rootContainerElement) {
    return 9 === rootContainerElement.nodeType ? rootContainerElement : rootContainerElement.ownerDocument;
  }
  function getOwnHostContext(namespaceURI) {
    switch (namespaceURI) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function getChildHostContextProd(parentNamespace, type) {
    if (0 === parentNamespace)
      switch (type) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return 1 === parentNamespace && "foreignObject" === type ? 0 : parentNamespace;
  }
  function shouldSetTextContent(type, props) {
    return "textarea" === type || "noscript" === type || "string" === typeof props.children || "number" === typeof props.children || "bigint" === typeof props.children || "object" === typeof props.dangerouslySetInnerHTML && null !== props.dangerouslySetInnerHTML && null != props.dangerouslySetInnerHTML.__html;
  }
  var currentPopstateTransitionEvent = null;
  function shouldAttemptEagerTransition() {
    var event = window.event;
    if (event && "popstate" === event.type) {
      if (event === currentPopstateTransitionEvent) return false;
      currentPopstateTransitionEvent = event;
      return true;
    }
    currentPopstateTransitionEvent = null;
    return false;
  }
  var scheduleTimeout = "function" === typeof setTimeout ? setTimeout : void 0, cancelTimeout = "function" === typeof clearTimeout ? clearTimeout : void 0, localPromise = "function" === typeof Promise ? Promise : void 0, scheduleMicrotask = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof localPromise ? function(callback) {
    return localPromise.resolve(null).then(callback).catch(handleErrorInNextTick);
  } : scheduleTimeout;
  function handleErrorInNextTick(error) {
    setTimeout(function() {
      throw error;
    });
  }
  function isSingletonScope(type) {
    return "head" === type;
  }
  function clearHydrationBoundary(parentInstance, hydrationInstance) {
    var node = hydrationInstance, depth = 0;
    do {
      var nextNode = node.nextSibling;
      parentInstance.removeChild(node);
      if (nextNode && 8 === nextNode.nodeType)
        if (node = nextNode.data, "/$" === node || "/&" === node) {
          if (0 === depth) {
            parentInstance.removeChild(nextNode);
            retryIfBlockedOn(hydrationInstance);
            return;
          }
          depth--;
        } else if ("$" === node || "$?" === node || "$~" === node || "$!" === node || "&" === node)
          depth++;
        else if ("html" === node)
          releaseSingletonInstance(parentInstance.ownerDocument.documentElement);
        else if ("head" === node) {
          node = parentInstance.ownerDocument.head;
          releaseSingletonInstance(node);
          for (var node$jscomp$0 = node.firstChild; node$jscomp$0; ) {
            var nextNode$jscomp$0 = node$jscomp$0.nextSibling, nodeName = node$jscomp$0.nodeName;
            node$jscomp$0[internalHoistableMarker] || "SCRIPT" === nodeName || "STYLE" === nodeName || "LINK" === nodeName && "stylesheet" === node$jscomp$0.rel.toLowerCase() || node.removeChild(node$jscomp$0);
            node$jscomp$0 = nextNode$jscomp$0;
          }
        } else
          "body" === node && releaseSingletonInstance(parentInstance.ownerDocument.body);
      node = nextNode;
    } while (node);
    retryIfBlockedOn(hydrationInstance);
  }
  function hideOrUnhideDehydratedBoundary(suspenseInstance, isHidden) {
    var node = suspenseInstance;
    suspenseInstance = 0;
    do {
      var nextNode = node.nextSibling;
      1 === node.nodeType ? isHidden ? (node._stashedDisplay = node.style.display, node.style.display = "none") : (node.style.display = node._stashedDisplay || "", "" === node.getAttribute("style") && node.removeAttribute("style")) : 3 === node.nodeType && (isHidden ? (node._stashedText = node.nodeValue, node.nodeValue = "") : node.nodeValue = node._stashedText || "");
      if (nextNode && 8 === nextNode.nodeType)
        if (node = nextNode.data, "/$" === node)
          if (0 === suspenseInstance) break;
          else suspenseInstance--;
        else
          "$" !== node && "$?" !== node && "$~" !== node && "$!" !== node || suspenseInstance++;
      node = nextNode;
    } while (node);
  }
  function clearContainerSparingly(container) {
    var nextNode = container.firstChild;
    nextNode && 10 === nextNode.nodeType && (nextNode = nextNode.nextSibling);
    for (; nextNode; ) {
      var node = nextNode;
      nextNode = nextNode.nextSibling;
      switch (node.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          clearContainerSparingly(node);
          detachDeletedInstance(node);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if ("stylesheet" === node.rel.toLowerCase()) continue;
      }
      container.removeChild(node);
    }
  }
  function canHydrateInstance(instance, type, props, inRootOrSingleton) {
    for (; 1 === instance.nodeType; ) {
      var anyProps = props;
      if (instance.nodeName.toLowerCase() !== type.toLowerCase()) {
        if (!inRootOrSingleton && ("INPUT" !== instance.nodeName || "hidden" !== instance.type))
          break;
      } else if (!inRootOrSingleton)
        if ("input" === type && "hidden" === instance.type) {
          var name = null == anyProps.name ? null : "" + anyProps.name;
          if ("hidden" === anyProps.type && instance.getAttribute("name") === name)
            return instance;
        } else return instance;
      else if (!instance[internalHoistableMarker])
        switch (type) {
          case "meta":
            if (!instance.hasAttribute("itemprop")) break;
            return instance;
          case "link":
            name = instance.getAttribute("rel");
            if ("stylesheet" === name && instance.hasAttribute("data-precedence"))
              break;
            else if (name !== anyProps.rel || instance.getAttribute("href") !== (null == anyProps.href || "" === anyProps.href ? null : anyProps.href) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin) || instance.getAttribute("title") !== (null == anyProps.title ? null : anyProps.title))
              break;
            return instance;
          case "style":
            if (instance.hasAttribute("data-precedence")) break;
            return instance;
          case "script":
            name = instance.getAttribute("src");
            if ((name !== (null == anyProps.src ? null : anyProps.src) || instance.getAttribute("type") !== (null == anyProps.type ? null : anyProps.type) || instance.getAttribute("crossorigin") !== (null == anyProps.crossOrigin ? null : anyProps.crossOrigin)) && name && instance.hasAttribute("async") && !instance.hasAttribute("itemprop"))
              break;
            return instance;
          default:
            return instance;
        }
      instance = getNextHydratable(instance.nextSibling);
      if (null === instance) break;
    }
    return null;
  }
  function canHydrateTextInstance(instance, text, inRootOrSingleton) {
    if ("" === text) return null;
    for (; 3 !== instance.nodeType; ) {
      if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
        return null;
      instance = getNextHydratable(instance.nextSibling);
      if (null === instance) return null;
    }
    return instance;
  }
  function canHydrateHydrationBoundary(instance, inRootOrSingleton) {
    for (; 8 !== instance.nodeType; ) {
      if ((1 !== instance.nodeType || "INPUT" !== instance.nodeName || "hidden" !== instance.type) && !inRootOrSingleton)
        return null;
      instance = getNextHydratable(instance.nextSibling);
      if (null === instance) return null;
    }
    return instance;
  }
  function isSuspenseInstancePending(instance) {
    return "$?" === instance.data || "$~" === instance.data;
  }
  function isSuspenseInstanceFallback(instance) {
    return "$!" === instance.data || "$?" === instance.data && "loading" !== instance.ownerDocument.readyState;
  }
  function registerSuspenseInstanceRetry(instance, callback) {
    var ownerDocument = instance.ownerDocument;
    if ("$~" === instance.data) instance._reactRetry = callback;
    else if ("$?" !== instance.data || "loading" !== ownerDocument.readyState)
      callback();
    else {
      var listener = function() {
        callback();
        ownerDocument.removeEventListener("DOMContentLoaded", listener);
      };
      ownerDocument.addEventListener("DOMContentLoaded", listener);
      instance._reactRetry = listener;
    }
  }
  function getNextHydratable(node) {
    for (; null != node; node = node.nextSibling) {
      var nodeType = node.nodeType;
      if (1 === nodeType || 3 === nodeType) break;
      if (8 === nodeType) {
        nodeType = node.data;
        if ("$" === nodeType || "$!" === nodeType || "$?" === nodeType || "$~" === nodeType || "&" === nodeType || "F!" === nodeType || "F" === nodeType)
          break;
        if ("/$" === nodeType || "/&" === nodeType) return null;
      }
    }
    return node;
  }
  var previousHydratableOnEnteringScopedSingleton = null;
  function getNextHydratableInstanceAfterHydrationBoundary(hydrationInstance) {
    hydrationInstance = hydrationInstance.nextSibling;
    for (var depth = 0; hydrationInstance; ) {
      if (8 === hydrationInstance.nodeType) {
        var data = hydrationInstance.data;
        if ("/$" === data || "/&" === data) {
          if (0 === depth)
            return getNextHydratable(hydrationInstance.nextSibling);
          depth--;
        } else
          "$" !== data && "$!" !== data && "$?" !== data && "$~" !== data && "&" !== data || depth++;
      }
      hydrationInstance = hydrationInstance.nextSibling;
    }
    return null;
  }
  function getParentHydrationBoundary(targetInstance) {
    targetInstance = targetInstance.previousSibling;
    for (var depth = 0; targetInstance; ) {
      if (8 === targetInstance.nodeType) {
        var data = targetInstance.data;
        if ("$" === data || "$!" === data || "$?" === data || "$~" === data || "&" === data) {
          if (0 === depth) return targetInstance;
          depth--;
        } else "/$" !== data && "/&" !== data || depth++;
      }
      targetInstance = targetInstance.previousSibling;
    }
    return null;
  }
  function resolveSingletonInstance(type, props, rootContainerInstance) {
    props = getOwnerDocumentFromRootContainer(rootContainerInstance);
    switch (type) {
      case "html":
        type = props.documentElement;
        if (!type) throw Error(formatProdErrorMessage(452));
        return type;
      case "head":
        type = props.head;
        if (!type) throw Error(formatProdErrorMessage(453));
        return type;
      case "body":
        type = props.body;
        if (!type) throw Error(formatProdErrorMessage(454));
        return type;
      default:
        throw Error(formatProdErrorMessage(451));
    }
  }
  function releaseSingletonInstance(instance) {
    for (var attributes = instance.attributes; attributes.length; )
      instance.removeAttributeNode(attributes[0]);
    detachDeletedInstance(instance);
  }
  var preloadPropsMap = /* @__PURE__ */ new Map(), preconnectsSet = /* @__PURE__ */ new Set();
  function getHoistableRoot(container) {
    return "function" === typeof container.getRootNode ? container.getRootNode() : 9 === container.nodeType ? container : container.ownerDocument;
  }
  var previousDispatcher = ReactDOMSharedInternals.d;
  ReactDOMSharedInternals.d = {
    f: flushSyncWork,
    r: requestFormReset,
    D: prefetchDNS,
    C: preconnect,
    L: preload,
    m: preloadModule,
    X: preinitScript,
    S: preinitStyle,
    M: preinitModuleScript
  };
  function flushSyncWork() {
    var previousWasRendering = previousDispatcher.f(), wasRendering = flushSyncWork$1();
    return previousWasRendering || wasRendering;
  }
  function requestFormReset(form) {
    var formInst = getInstanceFromNode(form);
    null !== formInst && 5 === formInst.tag && "form" === formInst.type ? requestFormReset$1(formInst) : previousDispatcher.r(form);
  }
  var globalDocument = "undefined" === typeof document ? null : document;
  function preconnectAs(rel, href, crossOrigin) {
    var ownerDocument = globalDocument;
    if (ownerDocument && "string" === typeof href && href) {
      var limitedEscapedHref = escapeSelectorAttributeValueInsideDoubleQuotes(href);
      limitedEscapedHref = 'link[rel="' + rel + '"][href="' + limitedEscapedHref + '"]';
      "string" === typeof crossOrigin && (limitedEscapedHref += '[crossorigin="' + crossOrigin + '"]');
      preconnectsSet.has(limitedEscapedHref) || (preconnectsSet.add(limitedEscapedHref), rel = { rel, crossOrigin, href }, null === ownerDocument.querySelector(limitedEscapedHref) && (href = ownerDocument.createElement("link"), setInitialProperties(href, "link", rel), markNodeAsHoistable(href), ownerDocument.head.appendChild(href)));
    }
  }
  function prefetchDNS(href) {
    previousDispatcher.D(href);
    preconnectAs("dns-prefetch", href, null);
  }
  function preconnect(href, crossOrigin) {
    previousDispatcher.C(href, crossOrigin);
    preconnectAs("preconnect", href, crossOrigin);
  }
  function preload(href, as, options2) {
    previousDispatcher.L(href, as, options2);
    var ownerDocument = globalDocument;
    if (ownerDocument && href && as) {
      var preloadSelector = 'link[rel="preload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"]';
      "image" === as ? options2 && options2.imageSrcSet ? (preloadSelector += '[imagesrcset="' + escapeSelectorAttributeValueInsideDoubleQuotes(
        options2.imageSrcSet
      ) + '"]', "string" === typeof options2.imageSizes && (preloadSelector += '[imagesizes="' + escapeSelectorAttributeValueInsideDoubleQuotes(
        options2.imageSizes
      ) + '"]')) : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]' : preloadSelector += '[href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]';
      var key = preloadSelector;
      switch (as) {
        case "style":
          key = getStyleKey(href);
          break;
        case "script":
          key = getScriptKey(href);
      }
      preloadPropsMap.has(key) || (href = assign(
        {
          rel: "preload",
          href: "image" === as && options2 && options2.imageSrcSet ? void 0 : href,
          as
        },
        options2
      ), preloadPropsMap.set(key, href), null !== ownerDocument.querySelector(preloadSelector) || "style" === as && ownerDocument.querySelector(getStylesheetSelectorFromKey(key)) || "script" === as && ownerDocument.querySelector(getScriptSelectorFromKey(key)) || (as = ownerDocument.createElement("link"), setInitialProperties(as, "link", href), markNodeAsHoistable(as), ownerDocument.head.appendChild(as)));
    }
  }
  function preloadModule(href, options2) {
    previousDispatcher.m(href, options2);
    var ownerDocument = globalDocument;
    if (ownerDocument && href) {
      var as = options2 && "string" === typeof options2.as ? options2.as : "script", preloadSelector = 'link[rel="modulepreload"][as="' + escapeSelectorAttributeValueInsideDoubleQuotes(as) + '"][href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"]', key = preloadSelector;
      switch (as) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          key = getScriptKey(href);
      }
      if (!preloadPropsMap.has(key) && (href = assign({ rel: "modulepreload", href }, options2), preloadPropsMap.set(key, href), null === ownerDocument.querySelector(preloadSelector))) {
        switch (as) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (ownerDocument.querySelector(getScriptSelectorFromKey(key)))
              return;
        }
        as = ownerDocument.createElement("link");
        setInitialProperties(as, "link", href);
        markNodeAsHoistable(as);
        ownerDocument.head.appendChild(as);
      }
    }
  }
  function preinitStyle(href, precedence, options2) {
    previousDispatcher.S(href, precedence, options2);
    var ownerDocument = globalDocument;
    if (ownerDocument && href) {
      var styles = getResourcesFromRoot(ownerDocument).hoistableStyles, key = getStyleKey(href);
      precedence = precedence || "default";
      var resource = styles.get(key);
      if (!resource) {
        var state = { loading: 0, preload: null };
        if (resource = ownerDocument.querySelector(
          getStylesheetSelectorFromKey(key)
        ))
          state.loading = 5;
        else {
          href = assign(
            { rel: "stylesheet", href, "data-precedence": precedence },
            options2
          );
          (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(href, options2);
          var link = resource = ownerDocument.createElement("link");
          markNodeAsHoistable(link);
          setInitialProperties(link, "link", href);
          link._p = new Promise(function(resolve, reject) {
            link.onload = resolve;
            link.onerror = reject;
          });
          link.addEventListener("load", function() {
            state.loading |= 1;
          });
          link.addEventListener("error", function() {
            state.loading |= 2;
          });
          state.loading |= 4;
          insertStylesheet(resource, precedence, ownerDocument);
        }
        resource = {
          type: "stylesheet",
          instance: resource,
          count: 1,
          state
        };
        styles.set(key, resource);
      }
    }
  }
  function preinitScript(src, options2) {
    previousDispatcher.X(src, options2);
    var ownerDocument = globalDocument;
    if (ownerDocument && src) {
      var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
      resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
        type: "script",
        instance: resource,
        count: 1,
        state: null
      }, scripts.set(key, resource));
    }
  }
  function preinitModuleScript(src, options2) {
    previousDispatcher.M(src, options2);
    var ownerDocument = globalDocument;
    if (ownerDocument && src) {
      var scripts = getResourcesFromRoot(ownerDocument).hoistableScripts, key = getScriptKey(src), resource = scripts.get(key);
      resource || (resource = ownerDocument.querySelector(getScriptSelectorFromKey(key)), resource || (src = assign({ src, async: true, type: "module" }, options2), (options2 = preloadPropsMap.get(key)) && adoptPreloadPropsForScript(src, options2), resource = ownerDocument.createElement("script"), markNodeAsHoistable(resource), setInitialProperties(resource, "link", src), ownerDocument.head.appendChild(resource)), resource = {
        type: "script",
        instance: resource,
        count: 1,
        state: null
      }, scripts.set(key, resource));
    }
  }
  function getResource(type, currentProps, pendingProps, currentResource) {
    var JSCompiler_inline_result = (JSCompiler_inline_result = rootInstanceStackCursor.current) ? getHoistableRoot(JSCompiler_inline_result) : null;
    if (!JSCompiler_inline_result) throw Error(formatProdErrorMessage(446));
    switch (type) {
      case "meta":
      case "title":
        return null;
      case "style":
        return "string" === typeof pendingProps.precedence && "string" === typeof pendingProps.href ? (currentProps = getStyleKey(pendingProps.href), pendingProps = getResourcesFromRoot(
          JSCompiler_inline_result
        ).hoistableStyles, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if ("stylesheet" === pendingProps.rel && "string" === typeof pendingProps.href && "string" === typeof pendingProps.precedence) {
          type = getStyleKey(pendingProps.href);
          var styles$243 = getResourcesFromRoot(
            JSCompiler_inline_result
          ).hoistableStyles, resource$244 = styles$243.get(type);
          resource$244 || (JSCompiler_inline_result = JSCompiler_inline_result.ownerDocument || JSCompiler_inline_result, resource$244 = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, styles$243.set(type, resource$244), (styles$243 = JSCompiler_inline_result.querySelector(
            getStylesheetSelectorFromKey(type)
          )) && !styles$243._p && (resource$244.instance = styles$243, resource$244.state.loading = 5), preloadPropsMap.has(type) || (pendingProps = {
            rel: "preload",
            as: "style",
            href: pendingProps.href,
            crossOrigin: pendingProps.crossOrigin,
            integrity: pendingProps.integrity,
            media: pendingProps.media,
            hrefLang: pendingProps.hrefLang,
            referrerPolicy: pendingProps.referrerPolicy
          }, preloadPropsMap.set(type, pendingProps), styles$243 || preloadStylesheet(
            JSCompiler_inline_result,
            type,
            pendingProps,
            resource$244.state
          )));
          if (currentProps && null === currentResource)
            throw Error(formatProdErrorMessage(528, ""));
          return resource$244;
        }
        if (currentProps && null !== currentResource)
          throw Error(formatProdErrorMessage(529, ""));
        return null;
      case "script":
        return currentProps = pendingProps.async, pendingProps = pendingProps.src, "string" === typeof pendingProps && currentProps && "function" !== typeof currentProps && "symbol" !== typeof currentProps ? (currentProps = getScriptKey(pendingProps), pendingProps = getResourcesFromRoot(
          JSCompiler_inline_result
        ).hoistableScripts, currentResource = pendingProps.get(currentProps), currentResource || (currentResource = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, pendingProps.set(currentProps, currentResource)), currentResource) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(formatProdErrorMessage(444, type));
    }
  }
  function getStyleKey(href) {
    return 'href="' + escapeSelectorAttributeValueInsideDoubleQuotes(href) + '"';
  }
  function getStylesheetSelectorFromKey(key) {
    return 'link[rel="stylesheet"][' + key + "]";
  }
  function stylesheetPropsFromRawProps(rawProps) {
    return assign({}, rawProps, {
      "data-precedence": rawProps.precedence,
      precedence: null
    });
  }
  function preloadStylesheet(ownerDocument, key, preloadProps, state) {
    ownerDocument.querySelector('link[rel="preload"][as="style"][' + key + "]") ? state.loading = 1 : (key = ownerDocument.createElement("link"), state.preload = key, key.addEventListener("load", function() {
      return state.loading |= 1;
    }), key.addEventListener("error", function() {
      return state.loading |= 2;
    }), setInitialProperties(key, "link", preloadProps), markNodeAsHoistable(key), ownerDocument.head.appendChild(key));
  }
  function getScriptKey(src) {
    return '[src="' + escapeSelectorAttributeValueInsideDoubleQuotes(src) + '"]';
  }
  function getScriptSelectorFromKey(key) {
    return "script[async]" + key;
  }
  function acquireResource(hoistableRoot, resource, props) {
    resource.count++;
    if (null === resource.instance)
      switch (resource.type) {
        case "style":
          var instance = hoistableRoot.querySelector(
            'style[data-href~="' + escapeSelectorAttributeValueInsideDoubleQuotes(props.href) + '"]'
          );
          if (instance)
            return resource.instance = instance, markNodeAsHoistable(instance), instance;
          var styleProps = assign({}, props, {
            "data-href": props.href,
            "data-precedence": props.precedence,
            href: null,
            precedence: null
          });
          instance = (hoistableRoot.ownerDocument || hoistableRoot).createElement(
            "style"
          );
          markNodeAsHoistable(instance);
          setInitialProperties(instance, "style", styleProps);
          insertStylesheet(instance, props.precedence, hoistableRoot);
          return resource.instance = instance;
        case "stylesheet":
          styleProps = getStyleKey(props.href);
          var instance$249 = hoistableRoot.querySelector(
            getStylesheetSelectorFromKey(styleProps)
          );
          if (instance$249)
            return resource.state.loading |= 4, resource.instance = instance$249, markNodeAsHoistable(instance$249), instance$249;
          instance = stylesheetPropsFromRawProps(props);
          (styleProps = preloadPropsMap.get(styleProps)) && adoptPreloadPropsForStylesheet(instance, styleProps);
          instance$249 = (hoistableRoot.ownerDocument || hoistableRoot).createElement("link");
          markNodeAsHoistable(instance$249);
          var linkInstance = instance$249;
          linkInstance._p = new Promise(function(resolve, reject) {
            linkInstance.onload = resolve;
            linkInstance.onerror = reject;
          });
          setInitialProperties(instance$249, "link", instance);
          resource.state.loading |= 4;
          insertStylesheet(instance$249, props.precedence, hoistableRoot);
          return resource.instance = instance$249;
        case "script":
          instance$249 = getScriptKey(props.src);
          if (styleProps = hoistableRoot.querySelector(
            getScriptSelectorFromKey(instance$249)
          ))
            return resource.instance = styleProps, markNodeAsHoistable(styleProps), styleProps;
          instance = props;
          if (styleProps = preloadPropsMap.get(instance$249))
            instance = assign({}, props), adoptPreloadPropsForScript(instance, styleProps);
          hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
          styleProps = hoistableRoot.createElement("script");
          markNodeAsHoistable(styleProps);
          setInitialProperties(styleProps, "link", instance);
          hoistableRoot.head.appendChild(styleProps);
          return resource.instance = styleProps;
        case "void":
          return null;
        default:
          throw Error(formatProdErrorMessage(443, resource.type));
      }
    else
      "stylesheet" === resource.type && 0 === (resource.state.loading & 4) && (instance = resource.instance, resource.state.loading |= 4, insertStylesheet(instance, props.precedence, hoistableRoot));
    return resource.instance;
  }
  function insertStylesheet(instance, precedence, root2) {
    for (var nodes = root2.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), last = nodes.length ? nodes[nodes.length - 1] : null, prior = last, i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.dataset.precedence === precedence) prior = node;
      else if (prior !== last) break;
    }
    prior ? prior.parentNode.insertBefore(instance, prior.nextSibling) : (precedence = 9 === root2.nodeType ? root2.head : root2, precedence.insertBefore(instance, precedence.firstChild));
  }
  function adoptPreloadPropsForStylesheet(stylesheetProps, preloadProps) {
    null == stylesheetProps.crossOrigin && (stylesheetProps.crossOrigin = preloadProps.crossOrigin);
    null == stylesheetProps.referrerPolicy && (stylesheetProps.referrerPolicy = preloadProps.referrerPolicy);
    null == stylesheetProps.title && (stylesheetProps.title = preloadProps.title);
  }
  function adoptPreloadPropsForScript(scriptProps, preloadProps) {
    null == scriptProps.crossOrigin && (scriptProps.crossOrigin = preloadProps.crossOrigin);
    null == scriptProps.referrerPolicy && (scriptProps.referrerPolicy = preloadProps.referrerPolicy);
    null == scriptProps.integrity && (scriptProps.integrity = preloadProps.integrity);
  }
  var tagCaches = null;
  function getHydratableHoistableCache(type, keyAttribute, ownerDocument) {
    if (null === tagCaches) {
      var cache = /* @__PURE__ */ new Map();
      var caches = tagCaches = /* @__PURE__ */ new Map();
      caches.set(ownerDocument, cache);
    } else
      caches = tagCaches, cache = caches.get(ownerDocument), cache || (cache = /* @__PURE__ */ new Map(), caches.set(ownerDocument, cache));
    if (cache.has(type)) return cache;
    cache.set(type, null);
    ownerDocument = ownerDocument.getElementsByTagName(type);
    for (caches = 0; caches < ownerDocument.length; caches++) {
      var node = ownerDocument[caches];
      if (!(node[internalHoistableMarker] || node[internalInstanceKey] || "link" === type && "stylesheet" === node.getAttribute("rel")) && "http://www.w3.org/2000/svg" !== node.namespaceURI) {
        var nodeKey = node.getAttribute(keyAttribute) || "";
        nodeKey = type + nodeKey;
        var existing = cache.get(nodeKey);
        existing ? existing.push(node) : cache.set(nodeKey, [node]);
      }
    }
    return cache;
  }
  function mountHoistable(hoistableRoot, type, instance) {
    hoistableRoot = hoistableRoot.ownerDocument || hoistableRoot;
    hoistableRoot.head.insertBefore(
      instance,
      "title" === type ? hoistableRoot.querySelector("head > title") : null
    );
  }
  function isHostHoistableType(type, props, hostContext) {
    if (1 === hostContext || null != props.itemProp) return false;
    switch (type) {
      case "meta":
      case "title":
        return true;
      case "style":
        if ("string" !== typeof props.precedence || "string" !== typeof props.href || "" === props.href)
          break;
        return true;
      case "link":
        if ("string" !== typeof props.rel || "string" !== typeof props.href || "" === props.href || props.onLoad || props.onError)
          break;
        switch (props.rel) {
          case "stylesheet":
            return type = props.disabled, "string" === typeof props.precedence && null == type;
          default:
            return true;
        }
      case "script":
        if (props.async && "function" !== typeof props.async && "symbol" !== typeof props.async && !props.onLoad && !props.onError && props.src && "string" === typeof props.src)
          return true;
    }
    return false;
  }
  function preloadResource(resource) {
    return "stylesheet" === resource.type && 0 === (resource.state.loading & 3) ? false : true;
  }
  function suspendResource(state, hoistableRoot, resource, props) {
    if ("stylesheet" === resource.type && ("string" !== typeof props.media || false !== matchMedia(props.media).matches) && 0 === (resource.state.loading & 4)) {
      if (null === resource.instance) {
        var key = getStyleKey(props.href), instance = hoistableRoot.querySelector(
          getStylesheetSelectorFromKey(key)
        );
        if (instance) {
          hoistableRoot = instance._p;
          null !== hoistableRoot && "object" === typeof hoistableRoot && "function" === typeof hoistableRoot.then && (state.count++, state = onUnsuspend.bind(state), hoistableRoot.then(state, state));
          resource.state.loading |= 4;
          resource.instance = instance;
          markNodeAsHoistable(instance);
          return;
        }
        instance = hoistableRoot.ownerDocument || hoistableRoot;
        props = stylesheetPropsFromRawProps(props);
        (key = preloadPropsMap.get(key)) && adoptPreloadPropsForStylesheet(props, key);
        instance = instance.createElement("link");
        markNodeAsHoistable(instance);
        var linkInstance = instance;
        linkInstance._p = new Promise(function(resolve, reject) {
          linkInstance.onload = resolve;
          linkInstance.onerror = reject;
        });
        setInitialProperties(instance, "link", props);
        resource.instance = instance;
      }
      null === state.stylesheets && (state.stylesheets = /* @__PURE__ */ new Map());
      state.stylesheets.set(resource, hoistableRoot);
      (hoistableRoot = resource.state.preload) && 0 === (resource.state.loading & 3) && (state.count++, resource = onUnsuspend.bind(state), hoistableRoot.addEventListener("load", resource), hoistableRoot.addEventListener("error", resource));
    }
  }
  var estimatedBytesWithinLimit = 0;
  function waitForCommitToBeReady(state, timeoutOffset) {
    state.stylesheets && 0 === state.count && insertSuspendedStylesheets(state, state.stylesheets);
    return 0 < state.count || 0 < state.imgCount ? function(commit) {
      var stylesheetTimer = setTimeout(function() {
        state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets);
        if (state.unsuspend) {
          var unsuspend = state.unsuspend;
          state.unsuspend = null;
          unsuspend();
        }
      }, 6e4 + timeoutOffset);
      0 < state.imgBytes && 0 === estimatedBytesWithinLimit && (estimatedBytesWithinLimit = 62500 * estimateBandwidth());
      var imgTimer = setTimeout(
        function() {
          state.waitingForImages = false;
          if (0 === state.count && (state.stylesheets && insertSuspendedStylesheets(state, state.stylesheets), state.unsuspend)) {
            var unsuspend = state.unsuspend;
            state.unsuspend = null;
            unsuspend();
          }
        },
        (state.imgBytes > estimatedBytesWithinLimit ? 50 : 800) + timeoutOffset
      );
      state.unsuspend = commit;
      return function() {
        state.unsuspend = null;
        clearTimeout(stylesheetTimer);
        clearTimeout(imgTimer);
      };
    } : null;
  }
  function onUnsuspend() {
    this.count--;
    if (0 === this.count && (0 === this.imgCount || !this.waitingForImages)) {
      if (this.stylesheets) insertSuspendedStylesheets(this, this.stylesheets);
      else if (this.unsuspend) {
        var unsuspend = this.unsuspend;
        this.unsuspend = null;
        unsuspend();
      }
    }
  }
  var precedencesByRoot = null;
  function insertSuspendedStylesheets(state, resources) {
    state.stylesheets = null;
    null !== state.unsuspend && (state.count++, precedencesByRoot = /* @__PURE__ */ new Map(), resources.forEach(insertStylesheetIntoRoot, state), precedencesByRoot = null, onUnsuspend.call(state));
  }
  function insertStylesheetIntoRoot(root2, resource) {
    if (!(resource.state.loading & 4)) {
      var precedences = precedencesByRoot.get(root2);
      if (precedences) var last = precedences.get(null);
      else {
        precedences = /* @__PURE__ */ new Map();
        precedencesByRoot.set(root2, precedences);
        for (var nodes = root2.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if ("LINK" === node.nodeName || "not all" !== node.getAttribute("media"))
            precedences.set(node.dataset.precedence, node), last = node;
        }
        last && precedences.set(null, last);
      }
      nodes = resource.instance;
      node = nodes.getAttribute("data-precedence");
      i = precedences.get(node) || last;
      i === last && precedences.set(null, nodes);
      precedences.set(node, nodes);
      this.count++;
      last = onUnsuspend.bind(this);
      nodes.addEventListener("load", last);
      nodes.addEventListener("error", last);
      i ? i.parentNode.insertBefore(nodes, i.nextSibling) : (root2 = 9 === root2.nodeType ? root2.head : root2, root2.insertBefore(nodes, root2.firstChild));
      resource.state.loading |= 4;
    }
  }
  var HostTransitionContext = {
    $$typeof: REACT_CONTEXT_TYPE,
    Provider: null,
    Consumer: null,
    _currentValue: sharedNotPendingObject,
    _currentValue2: sharedNotPendingObject,
    _threadCount: 0
  };
  function FiberRootNode(containerInfo, tag, hydrate, identifierPrefix, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator, formState) {
    this.tag = 1;
    this.containerInfo = containerInfo;
    this.pingCache = this.current = this.pendingChildren = null;
    this.timeoutHandle = -1;
    this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null;
    this.callbackPriority = 0;
    this.expirationTimes = createLaneMap(-1);
    this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
    this.entanglements = createLaneMap(0);
    this.hiddenUpdates = createLaneMap(null);
    this.identifierPrefix = identifierPrefix;
    this.onUncaughtError = onUncaughtError;
    this.onCaughtError = onCaughtError;
    this.onRecoverableError = onRecoverableError;
    this.pooledCache = null;
    this.pooledCacheLanes = 0;
    this.formState = formState;
    this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function createFiberRoot(containerInfo, tag, hydrate, initialChildren, hydrationCallbacks, isStrictMode, identifierPrefix, formState, onUncaughtError, onCaughtError, onRecoverableError, onDefaultTransitionIndicator) {
    containerInfo = new FiberRootNode(
      containerInfo,
      tag,
      hydrate,
      identifierPrefix,
      onUncaughtError,
      onCaughtError,
      onRecoverableError,
      onDefaultTransitionIndicator,
      formState
    );
    tag = 1;
    true === isStrictMode && (tag |= 24);
    isStrictMode = createFiberImplClass(3, null, null, tag);
    containerInfo.current = isStrictMode;
    isStrictMode.stateNode = containerInfo;
    tag = createCache();
    tag.refCount++;
    containerInfo.pooledCache = tag;
    tag.refCount++;
    isStrictMode.memoizedState = {
      element: initialChildren,
      isDehydrated: hydrate,
      cache: tag
    };
    initializeUpdateQueue(isStrictMode);
    return containerInfo;
  }
  function getContextForSubtree(parentComponent) {
    if (!parentComponent) return emptyContextObject;
    parentComponent = emptyContextObject;
    return parentComponent;
  }
  function updateContainerImpl(rootFiber, lane, element, container, parentComponent, callback) {
    parentComponent = getContextForSubtree(parentComponent);
    null === container.context ? container.context = parentComponent : container.pendingContext = parentComponent;
    container = createUpdate(lane);
    container.payload = { element };
    callback = void 0 === callback ? null : callback;
    null !== callback && (container.callback = callback);
    element = enqueueUpdate(rootFiber, container, lane);
    null !== element && (scheduleUpdateOnFiber(element, rootFiber, lane), entangleTransitions(element, rootFiber, lane));
  }
  function markRetryLaneImpl(fiber, retryLane) {
    fiber = fiber.memoizedState;
    if (null !== fiber && null !== fiber.dehydrated) {
      var a = fiber.retryLane;
      fiber.retryLane = 0 !== a && a < retryLane ? a : retryLane;
    }
  }
  function markRetryLaneIfNotHydrated(fiber, retryLane) {
    markRetryLaneImpl(fiber, retryLane);
    (fiber = fiber.alternate) && markRetryLaneImpl(fiber, retryLane);
  }
  function attemptContinuousHydration(fiber) {
    if (13 === fiber.tag || 31 === fiber.tag) {
      var root2 = enqueueConcurrentRenderForLane(fiber, 67108864);
      null !== root2 && scheduleUpdateOnFiber(root2, fiber, 67108864);
      markRetryLaneIfNotHydrated(fiber, 67108864);
    }
  }
  function attemptHydrationAtCurrentPriority(fiber) {
    if (13 === fiber.tag || 31 === fiber.tag) {
      var lane = requestUpdateLane();
      lane = getBumpedLaneForHydrationByLane(lane);
      var root2 = enqueueConcurrentRenderForLane(fiber, lane);
      null !== root2 && scheduleUpdateOnFiber(root2, fiber, lane);
      markRetryLaneIfNotHydrated(fiber, lane);
    }
  }
  var _enabled = true;
  function dispatchDiscreteEvent(domEventName, eventSystemFlags, container, nativeEvent) {
    var prevTransition = ReactSharedInternals.T;
    ReactSharedInternals.T = null;
    var previousPriority = ReactDOMSharedInternals.p;
    try {
      ReactDOMSharedInternals.p = 2, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
    } finally {
      ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
    }
  }
  function dispatchContinuousEvent(domEventName, eventSystemFlags, container, nativeEvent) {
    var prevTransition = ReactSharedInternals.T;
    ReactSharedInternals.T = null;
    var previousPriority = ReactDOMSharedInternals.p;
    try {
      ReactDOMSharedInternals.p = 8, dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
    } finally {
      ReactDOMSharedInternals.p = previousPriority, ReactSharedInternals.T = prevTransition;
    }
  }
  function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
    if (_enabled) {
      var blockedOn = findInstanceBlockingEvent(nativeEvent);
      if (null === blockedOn)
        dispatchEventForPluginEventSystem(
          domEventName,
          eventSystemFlags,
          nativeEvent,
          return_targetInst,
          targetContainer
        ), clearIfContinuousEvent(domEventName, nativeEvent);
      else if (queueIfContinuousEvent(
        blockedOn,
        domEventName,
        eventSystemFlags,
        targetContainer,
        nativeEvent
      ))
        nativeEvent.stopPropagation();
      else if (clearIfContinuousEvent(domEventName, nativeEvent), eventSystemFlags & 4 && -1 < discreteReplayableEvents.indexOf(domEventName)) {
        for (; null !== blockedOn; ) {
          var fiber = getInstanceFromNode(blockedOn);
          if (null !== fiber)
            switch (fiber.tag) {
              case 3:
                fiber = fiber.stateNode;
                if (fiber.current.memoizedState.isDehydrated) {
                  var lanes = getHighestPriorityLanes(fiber.pendingLanes);
                  if (0 !== lanes) {
                    var root2 = fiber;
                    root2.pendingLanes |= 2;
                    for (root2.entangledLanes |= 2; lanes; ) {
                      var lane = 1 << 31 - clz32(lanes);
                      root2.entanglements[1] |= lane;
                      lanes &= ~lane;
                    }
                    ensureRootIsScheduled(fiber);
                    0 === (executionContext & 6) && (workInProgressRootRenderTargetTime = now() + 500, flushSyncWorkAcrossRoots_impl(0));
                  }
                }
                break;
              case 31:
              case 13:
                root2 = enqueueConcurrentRenderForLane(fiber, 2), null !== root2 && scheduleUpdateOnFiber(root2, fiber, 2), flushSyncWork$1(), markRetryLaneIfNotHydrated(fiber, 2);
            }
          fiber = findInstanceBlockingEvent(nativeEvent);
          null === fiber && dispatchEventForPluginEventSystem(
            domEventName,
            eventSystemFlags,
            nativeEvent,
            return_targetInst,
            targetContainer
          );
          if (fiber === blockedOn) break;
          blockedOn = fiber;
        }
        null !== blockedOn && nativeEvent.stopPropagation();
      } else
        dispatchEventForPluginEventSystem(
          domEventName,
          eventSystemFlags,
          nativeEvent,
          null,
          targetContainer
        );
    }
  }
  function findInstanceBlockingEvent(nativeEvent) {
    nativeEvent = getEventTarget(nativeEvent);
    return findInstanceBlockingTarget(nativeEvent);
  }
  var return_targetInst = null;
  function findInstanceBlockingTarget(targetNode) {
    return_targetInst = null;
    targetNode = getClosestInstanceFromNode(targetNode);
    if (null !== targetNode) {
      var nearestMounted = getNearestMountedFiber(targetNode);
      if (null === nearestMounted) targetNode = null;
      else {
        var tag = nearestMounted.tag;
        if (13 === tag) {
          targetNode = getSuspenseInstanceFromFiber(nearestMounted);
          if (null !== targetNode) return targetNode;
          targetNode = null;
        } else if (31 === tag) {
          targetNode = getActivityInstanceFromFiber(nearestMounted);
          if (null !== targetNode) return targetNode;
          targetNode = null;
        } else if (3 === tag) {
          if (nearestMounted.stateNode.current.memoizedState.isDehydrated)
            return 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
          targetNode = null;
        } else nearestMounted !== targetNode && (targetNode = null);
      }
    }
    return_targetInst = targetNode;
    return null;
  }
  function getEventPriority(domEventName) {
    switch (domEventName) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (getCurrentPriorityLevel()) {
          case ImmediatePriority:
            return 2;
          case UserBlockingPriority:
            return 8;
          case NormalPriority$1:
          case LowPriority:
            return 32;
          case IdlePriority:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var hasScheduledReplayAttempt = false, queuedFocus = null, queuedDrag = null, queuedMouse = null, queuedPointers = /* @__PURE__ */ new Map(), queuedPointerCaptures = /* @__PURE__ */ new Map(), queuedExplicitHydrationTargets = [], discreteReplayableEvents = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function clearIfContinuousEvent(domEventName, nativeEvent) {
    switch (domEventName) {
      case "focusin":
      case "focusout":
        queuedFocus = null;
        break;
      case "dragenter":
      case "dragleave":
        queuedDrag = null;
        break;
      case "mouseover":
      case "mouseout":
        queuedMouse = null;
        break;
      case "pointerover":
      case "pointerout":
        queuedPointers.delete(nativeEvent.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        queuedPointerCaptures.delete(nativeEvent.pointerId);
    }
  }
  function accumulateOrCreateContinuousQueuedReplayableEvent(existingQueuedEvent, blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
    if (null === existingQueuedEvent || existingQueuedEvent.nativeEvent !== nativeEvent)
      return existingQueuedEvent = {
        blockedOn,
        domEventName,
        eventSystemFlags,
        nativeEvent,
        targetContainers: [targetContainer]
      }, null !== blockedOn && (blockedOn = getInstanceFromNode(blockedOn), null !== blockedOn && attemptContinuousHydration(blockedOn)), existingQueuedEvent;
    existingQueuedEvent.eventSystemFlags |= eventSystemFlags;
    blockedOn = existingQueuedEvent.targetContainers;
    null !== targetContainer && -1 === blockedOn.indexOf(targetContainer) && blockedOn.push(targetContainer);
    return existingQueuedEvent;
  }
  function queueIfContinuousEvent(blockedOn, domEventName, eventSystemFlags, targetContainer, nativeEvent) {
    switch (domEventName) {
      case "focusin":
        return queuedFocus = accumulateOrCreateContinuousQueuedReplayableEvent(
          queuedFocus,
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent
        ), true;
      case "dragenter":
        return queuedDrag = accumulateOrCreateContinuousQueuedReplayableEvent(
          queuedDrag,
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent
        ), true;
      case "mouseover":
        return queuedMouse = accumulateOrCreateContinuousQueuedReplayableEvent(
          queuedMouse,
          blockedOn,
          domEventName,
          eventSystemFlags,
          targetContainer,
          nativeEvent
        ), true;
      case "pointerover":
        var pointerId = nativeEvent.pointerId;
        queuedPointers.set(
          pointerId,
          accumulateOrCreateContinuousQueuedReplayableEvent(
            queuedPointers.get(pointerId) || null,
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          )
        );
        return true;
      case "gotpointercapture":
        return pointerId = nativeEvent.pointerId, queuedPointerCaptures.set(
          pointerId,
          accumulateOrCreateContinuousQueuedReplayableEvent(
            queuedPointerCaptures.get(pointerId) || null,
            blockedOn,
            domEventName,
            eventSystemFlags,
            targetContainer,
            nativeEvent
          )
        ), true;
    }
    return false;
  }
  function attemptExplicitHydrationTarget(queuedTarget) {
    var targetInst = getClosestInstanceFromNode(queuedTarget.target);
    if (null !== targetInst) {
      var nearestMounted = getNearestMountedFiber(targetInst);
      if (null !== nearestMounted) {
        if (targetInst = nearestMounted.tag, 13 === targetInst) {
          if (targetInst = getSuspenseInstanceFromFiber(nearestMounted), null !== targetInst) {
            queuedTarget.blockedOn = targetInst;
            runWithPriority(queuedTarget.priority, function() {
              attemptHydrationAtCurrentPriority(nearestMounted);
            });
            return;
          }
        } else if (31 === targetInst) {
          if (targetInst = getActivityInstanceFromFiber(nearestMounted), null !== targetInst) {
            queuedTarget.blockedOn = targetInst;
            runWithPriority(queuedTarget.priority, function() {
              attemptHydrationAtCurrentPriority(nearestMounted);
            });
            return;
          }
        } else if (3 === targetInst && nearestMounted.stateNode.current.memoizedState.isDehydrated) {
          queuedTarget.blockedOn = 3 === nearestMounted.tag ? nearestMounted.stateNode.containerInfo : null;
          return;
        }
      }
    }
    queuedTarget.blockedOn = null;
  }
  function attemptReplayContinuousQueuedEvent(queuedEvent) {
    if (null !== queuedEvent.blockedOn) return false;
    for (var targetContainers = queuedEvent.targetContainers; 0 < targetContainers.length; ) {
      var nextBlockedOn = findInstanceBlockingEvent(queuedEvent.nativeEvent);
      if (null === nextBlockedOn) {
        nextBlockedOn = queuedEvent.nativeEvent;
        var nativeEventClone = new nextBlockedOn.constructor(
          nextBlockedOn.type,
          nextBlockedOn
        );
        currentReplayingEvent = nativeEventClone;
        nextBlockedOn.target.dispatchEvent(nativeEventClone);
        currentReplayingEvent = null;
      } else
        return targetContainers = getInstanceFromNode(nextBlockedOn), null !== targetContainers && attemptContinuousHydration(targetContainers), queuedEvent.blockedOn = nextBlockedOn, false;
      targetContainers.shift();
    }
    return true;
  }
  function attemptReplayContinuousQueuedEventInMap(queuedEvent, key, map) {
    attemptReplayContinuousQueuedEvent(queuedEvent) && map.delete(key);
  }
  function replayUnblockedEvents() {
    hasScheduledReplayAttempt = false;
    null !== queuedFocus && attemptReplayContinuousQueuedEvent(queuedFocus) && (queuedFocus = null);
    null !== queuedDrag && attemptReplayContinuousQueuedEvent(queuedDrag) && (queuedDrag = null);
    null !== queuedMouse && attemptReplayContinuousQueuedEvent(queuedMouse) && (queuedMouse = null);
    queuedPointers.forEach(attemptReplayContinuousQueuedEventInMap);
    queuedPointerCaptures.forEach(attemptReplayContinuousQueuedEventInMap);
  }
  function scheduleCallbackIfUnblocked(queuedEvent, unblocked) {
    queuedEvent.blockedOn === unblocked && (queuedEvent.blockedOn = null, hasScheduledReplayAttempt || (hasScheduledReplayAttempt = true, Scheduler.unstable_scheduleCallback(
      Scheduler.unstable_NormalPriority,
      replayUnblockedEvents
    )));
  }
  var lastScheduledReplayQueue = null;
  function scheduleReplayQueueIfNeeded(formReplayingQueue) {
    lastScheduledReplayQueue !== formReplayingQueue && (lastScheduledReplayQueue = formReplayingQueue, Scheduler.unstable_scheduleCallback(
      Scheduler.unstable_NormalPriority,
      function() {
        lastScheduledReplayQueue === formReplayingQueue && (lastScheduledReplayQueue = null);
        for (var i = 0; i < formReplayingQueue.length; i += 3) {
          var form = formReplayingQueue[i], submitterOrAction = formReplayingQueue[i + 1], formData = formReplayingQueue[i + 2];
          if ("function" !== typeof submitterOrAction)
            if (null === findInstanceBlockingTarget(submitterOrAction || form))
              continue;
            else break;
          var formInst = getInstanceFromNode(form);
          null !== formInst && (formReplayingQueue.splice(i, 3), i -= 3, startHostTransition(
            formInst,
            {
              pending: true,
              data: formData,
              method: form.method,
              action: submitterOrAction
            },
            submitterOrAction,
            formData
          ));
        }
      }
    ));
  }
  function retryIfBlockedOn(unblocked) {
    function unblock(queuedEvent) {
      return scheduleCallbackIfUnblocked(queuedEvent, unblocked);
    }
    null !== queuedFocus && scheduleCallbackIfUnblocked(queuedFocus, unblocked);
    null !== queuedDrag && scheduleCallbackIfUnblocked(queuedDrag, unblocked);
    null !== queuedMouse && scheduleCallbackIfUnblocked(queuedMouse, unblocked);
    queuedPointers.forEach(unblock);
    queuedPointerCaptures.forEach(unblock);
    for (var i = 0; i < queuedExplicitHydrationTargets.length; i++) {
      var queuedTarget = queuedExplicitHydrationTargets[i];
      queuedTarget.blockedOn === unblocked && (queuedTarget.blockedOn = null);
    }
    for (; 0 < queuedExplicitHydrationTargets.length && (i = queuedExplicitHydrationTargets[0], null === i.blockedOn); )
      attemptExplicitHydrationTarget(i), null === i.blockedOn && queuedExplicitHydrationTargets.shift();
    i = (unblocked.ownerDocument || unblocked).$$reactFormReplay;
    if (null != i)
      for (queuedTarget = 0; queuedTarget < i.length; queuedTarget += 3) {
        var form = i[queuedTarget], submitterOrAction = i[queuedTarget + 1], formProps = form[internalPropsKey] || null;
        if ("function" === typeof submitterOrAction)
          formProps || scheduleReplayQueueIfNeeded(i);
        else if (formProps) {
          var action = null;
          if (submitterOrAction && submitterOrAction.hasAttribute("formAction"))
            if (form = submitterOrAction, formProps = submitterOrAction[internalPropsKey] || null)
              action = formProps.formAction;
            else {
              if (null !== findInstanceBlockingTarget(form)) continue;
            }
          else action = formProps.action;
          "function" === typeof action ? i[queuedTarget + 1] = action : (i.splice(queuedTarget, 3), queuedTarget -= 3);
          scheduleReplayQueueIfNeeded(i);
        }
      }
  }
  function defaultOnDefaultTransitionIndicator() {
    function handleNavigate(event) {
      event.canIntercept && "react-transition" === event.info && event.intercept({
        handler: function() {
          return new Promise(function(resolve) {
            return pendingResolve = resolve;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function handleNavigateComplete() {
      null !== pendingResolve && (pendingResolve(), pendingResolve = null);
      isCancelled || setTimeout(startFakeNavigation, 20);
    }
    function startFakeNavigation() {
      if (!isCancelled && !navigation.transition) {
        var currentEntry = navigation.currentEntry;
        currentEntry && null != currentEntry.url && navigation.navigate(currentEntry.url, {
          state: currentEntry.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if ("object" === typeof navigation) {
      var isCancelled = false, pendingResolve = null;
      navigation.addEventListener("navigate", handleNavigate);
      navigation.addEventListener("navigatesuccess", handleNavigateComplete);
      navigation.addEventListener("navigateerror", handleNavigateComplete);
      setTimeout(startFakeNavigation, 100);
      return function() {
        isCancelled = true;
        navigation.removeEventListener("navigate", handleNavigate);
        navigation.removeEventListener("navigatesuccess", handleNavigateComplete);
        navigation.removeEventListener("navigateerror", handleNavigateComplete);
        null !== pendingResolve && (pendingResolve(), pendingResolve = null);
      };
    }
  }
  function ReactDOMRoot(internalRoot) {
    this._internalRoot = internalRoot;
  }
  ReactDOMHydrationRoot.prototype.render = ReactDOMRoot.prototype.render = function(children) {
    var root2 = this._internalRoot;
    if (null === root2) throw Error(formatProdErrorMessage(409));
    var current = root2.current, lane = requestUpdateLane();
    updateContainerImpl(current, lane, children, root2, null, null);
  };
  ReactDOMHydrationRoot.prototype.unmount = ReactDOMRoot.prototype.unmount = function() {
    var root2 = this._internalRoot;
    if (null !== root2) {
      this._internalRoot = null;
      var container = root2.containerInfo;
      updateContainerImpl(root2.current, 2, null, root2, null, null);
      flushSyncWork$1();
      container[internalContainerInstanceKey] = null;
    }
  };
  function ReactDOMHydrationRoot(internalRoot) {
    this._internalRoot = internalRoot;
  }
  ReactDOMHydrationRoot.prototype.unstable_scheduleHydration = function(target) {
    if (target) {
      var updatePriority = resolveUpdatePriority();
      target = { blockedOn: null, target, priority: updatePriority };
      for (var i = 0; i < queuedExplicitHydrationTargets.length && 0 !== updatePriority && updatePriority < queuedExplicitHydrationTargets[i].priority; i++) ;
      queuedExplicitHydrationTargets.splice(i, 0, target);
      0 === i && attemptExplicitHydrationTarget(target);
    }
  };
  var isomorphicReactPackageVersion$jscomp$inline_1840 = React.version;
  if ("19.2.4" !== isomorphicReactPackageVersion$jscomp$inline_1840)
    throw Error(
      formatProdErrorMessage(
        527,
        isomorphicReactPackageVersion$jscomp$inline_1840,
        "19.2.4"
      )
    );
  ReactDOMSharedInternals.findDOMNode = function(componentOrElement) {
    var fiber = componentOrElement._reactInternals;
    if (void 0 === fiber) {
      if ("function" === typeof componentOrElement.render)
        throw Error(formatProdErrorMessage(188));
      componentOrElement = Object.keys(componentOrElement).join(",");
      throw Error(formatProdErrorMessage(268, componentOrElement));
    }
    componentOrElement = findCurrentFiberUsingSlowPath(fiber);
    componentOrElement = null !== componentOrElement ? findCurrentHostFiberImpl(componentOrElement) : null;
    componentOrElement = null === componentOrElement ? null : componentOrElement.stateNode;
    return componentOrElement;
  };
  var internals$jscomp$inline_2347 = {
    bundleType: 0,
    version: "19.2.4",
    rendererPackageName: "react-dom",
    currentDispatcherRef: ReactSharedInternals,
    reconcilerVersion: "19.2.4"
  };
  if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
    var hook$jscomp$inline_2348 = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook$jscomp$inline_2348.isDisabled && hook$jscomp$inline_2348.supportsFiber)
      try {
        rendererID = hook$jscomp$inline_2348.inject(
          internals$jscomp$inline_2347
        ), injectedHook = hook$jscomp$inline_2348;
      } catch (err) {
      }
  }
  reactDomClient_production.createRoot = function(container, options2) {
    if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
    var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError;
    null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError));
    options2 = createFiberRoot(
      container,
      1,
      false,
      null,
      null,
      isStrictMode,
      identifierPrefix,
      null,
      onUncaughtError,
      onCaughtError,
      onRecoverableError,
      defaultOnDefaultTransitionIndicator
    );
    container[internalContainerInstanceKey] = options2.current;
    listenToAllSupportedEvents(container);
    return new ReactDOMRoot(options2);
  };
  reactDomClient_production.hydrateRoot = function(container, initialChildren, options2) {
    if (!isValidContainer(container)) throw Error(formatProdErrorMessage(299));
    var isStrictMode = false, identifierPrefix = "", onUncaughtError = defaultOnUncaughtError, onCaughtError = defaultOnCaughtError, onRecoverableError = defaultOnRecoverableError, formState = null;
    null !== options2 && void 0 !== options2 && (true === options2.unstable_strictMode && (isStrictMode = true), void 0 !== options2.identifierPrefix && (identifierPrefix = options2.identifierPrefix), void 0 !== options2.onUncaughtError && (onUncaughtError = options2.onUncaughtError), void 0 !== options2.onCaughtError && (onCaughtError = options2.onCaughtError), void 0 !== options2.onRecoverableError && (onRecoverableError = options2.onRecoverableError), void 0 !== options2.formState && (formState = options2.formState));
    initialChildren = createFiberRoot(
      container,
      1,
      true,
      initialChildren,
      null != options2 ? options2 : null,
      isStrictMode,
      identifierPrefix,
      formState,
      onUncaughtError,
      onCaughtError,
      onRecoverableError,
      defaultOnDefaultTransitionIndicator
    );
    initialChildren.context = getContextForSubtree(null);
    options2 = initialChildren.current;
    isStrictMode = requestUpdateLane();
    isStrictMode = getBumpedLaneForHydrationByLane(isStrictMode);
    identifierPrefix = createUpdate(isStrictMode);
    identifierPrefix.callback = null;
    enqueueUpdate(options2, identifierPrefix, isStrictMode);
    options2 = isStrictMode;
    initialChildren.current.lanes = options2;
    markRootUpdated$1(initialChildren, options2);
    ensureRootIsScheduled(initialChildren);
    container[internalContainerInstanceKey] = initialChildren.current;
    listenToAllSupportedEvents(container);
    return new ReactDOMHydrationRoot(initialChildren);
  };
  reactDomClient_production.version = "19.2.4";
  return reactDomClient_production;
}
var hasRequiredClient;
function requireClient() {
  if (hasRequiredClient) return client.exports;
  hasRequiredClient = 1;
  function checkDCE() {
    if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
      return;
    }
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
    } catch (err) {
      console.error(err);
    }
  }
  {
    checkDCE();
    client.exports = requireReactDomClient_production();
  }
  return client.exports;
}
var clientExports = requireClient();
const cssText = '/*! tailwindcss v4.2.2 | MIT License | https://tailwindcss.com */\n@layer properties {\n  @supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color: rgb(from red r g b)))) {\n    *, :before, :after, ::backdrop {\n      --tw-translate-x: 0;\n      --tw-translate-y: 0;\n      --tw-translate-z: 0;\n      --tw-rotate-x: initial;\n      --tw-rotate-y: initial;\n      --tw-rotate-z: initial;\n      --tw-skew-x: initial;\n      --tw-skew-y: initial;\n      --tw-space-y-reverse: 0;\n      --tw-space-x-reverse: 0;\n      --tw-border-style: solid;\n      --tw-leading: initial;\n      --tw-font-weight: initial;\n      --tw-tracking: initial;\n      --tw-ordinal: initial;\n      --tw-slashed-zero: initial;\n      --tw-numeric-figure: initial;\n      --tw-numeric-spacing: initial;\n      --tw-numeric-fraction: initial;\n      --tw-shadow: 0 0 #0000;\n      --tw-shadow-color: initial;\n      --tw-shadow-alpha: 100%;\n      --tw-inset-shadow: 0 0 #0000;\n      --tw-inset-shadow-color: initial;\n      --tw-inset-shadow-alpha: 100%;\n      --tw-ring-color: initial;\n      --tw-ring-shadow: 0 0 #0000;\n      --tw-inset-ring-color: initial;\n      --tw-inset-ring-shadow: 0 0 #0000;\n      --tw-ring-inset: initial;\n      --tw-ring-offset-width: 0px;\n      --tw-ring-offset-color: #fff;\n      --tw-ring-offset-shadow: 0 0 #0000;\n      --tw-outline-style: solid;\n      --tw-blur: initial;\n      --tw-brightness: initial;\n      --tw-contrast: initial;\n      --tw-grayscale: initial;\n      --tw-hue-rotate: initial;\n      --tw-invert: initial;\n      --tw-opacity: initial;\n      --tw-saturate: initial;\n      --tw-sepia: initial;\n      --tw-drop-shadow: initial;\n      --tw-drop-shadow-color: initial;\n      --tw-drop-shadow-alpha: 100%;\n      --tw-drop-shadow-size: initial;\n      --tw-backdrop-blur: initial;\n      --tw-backdrop-brightness: initial;\n      --tw-backdrop-contrast: initial;\n      --tw-backdrop-grayscale: initial;\n      --tw-backdrop-hue-rotate: initial;\n      --tw-backdrop-invert: initial;\n      --tw-backdrop-opacity: initial;\n      --tw-backdrop-saturate: initial;\n      --tw-backdrop-sepia: initial;\n      --tw-duration: initial;\n      --tw-ease: initial;\n    }\n  }\n}\n\n@layer theme {\n  :root, :host {\n    --font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",\n      "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";\n    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",\n      "Courier New", monospace;\n    --color-red-50: oklch(97.1% .013 17.38);\n    --color-red-300: oklch(80.8% .114 19.571);\n    --color-red-400: oklch(70.4% .191 22.216);\n    --color-red-600: oklch(57.7% .245 27.325);\n    --color-amber-100: oklch(96.2% .059 95.617);\n    --color-amber-200: oklch(92.4% .12 95.746);\n    --color-emerald-100: oklch(95% .052 163.051);\n    --color-emerald-300: oklch(84.5% .143 164.978);\n    --color-cyan-100: oklch(95.6% .045 203.388);\n    --color-cyan-200: oklch(91.7% .08 205.041);\n    --color-cyan-300: oklch(86.5% .127 207.078);\n    --color-sky-100: oklch(95.1% .026 236.824);\n    --color-sky-300: oklch(82.8% .111 230.318);\n    --color-blue-300: oklch(80.9% .105 251.813);\n    --color-fuchsia-100: oklch(95.2% .037 318.852);\n    --color-fuchsia-200: oklch(90.3% .076 319.62);\n    --color-fuchsia-300: oklch(83.3% .145 321.434);\n    --color-rose-200: oklch(89.2% .058 10.001);\n    --color-rose-300: oklch(81% .117 11.638);\n    --color-rose-400: oklch(71.2% .194 13.428);\n    --color-slate-50: oklch(98.4% .003 247.858);\n    --color-slate-100: oklch(96.8% .007 247.896);\n    --color-slate-200: oklch(92.9% .013 255.508);\n    --color-slate-300: oklch(86.9% .022 252.894);\n    --color-slate-400: oklch(70.4% .04 256.788);\n    --color-black: #000;\n    --color-white: #fff;\n    --spacing: .25rem;\n    --container-sm: 24rem;\n    --container-lg: 32rem;\n    --container-2xl: 42rem;\n    --text-xs: .75rem;\n    --text-xs--line-height: calc(1 / .75);\n    --text-sm: .875rem;\n    --text-sm--line-height: calc(1.25 / .875);\n    --text-base: 1rem;\n    --text-base--line-height: calc(1.5 / 1);\n    --text-lg: 1.125rem;\n    --text-lg--line-height: calc(1.75 / 1.125);\n    --text-2xl: 1.5rem;\n    --text-2xl--line-height: calc(2 / 1.5);\n    --text-3xl: 1.875rem;\n    --text-3xl--line-height: calc(2.25 / 1.875);\n    --font-weight-normal: 400;\n    --font-weight-medium: 500;\n    --font-weight-semibold: 600;\n    --font-weight-bold: 700;\n    --tracking-tight: -.025em;\n    --tracking-wide: .025em;\n    --tracking-widest: .1em;\n    --leading-snug: 1.375;\n    --leading-normal: 1.5;\n    --leading-relaxed: 1.625;\n    --radius-xs: .125rem;\n    --radius-sm: .25rem;\n    --radius-md: .375rem;\n    --radius-lg: .5rem;\n    --radius-xl: .75rem;\n    --radius-2xl: 1rem;\n    --ease-in-out: cubic-bezier(.4, 0, .2, 1);\n    --animate-spin: spin 1s linear infinite;\n    --animate-pulse: pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;\n    --blur-md: 12px;\n    --blur-xl: 24px;\n    --aspect-video: 16 / 9;\n    --default-transition-duration: .15s;\n    --default-transition-timing-function: cubic-bezier(.4, 0, .2, 1);\n    --default-font-family: var(--font-sans);\n    --default-mono-font-family: var(--font-mono);\n  }\n}\n\n@layer base {\n  *, :after, :before, ::backdrop {\n    box-sizing: border-box;\n    border: 0 solid;\n    margin: 0;\n    padding: 0;\n  }\n\n  ::file-selector-button {\n    box-sizing: border-box;\n    border: 0 solid;\n    margin: 0;\n    padding: 0;\n  }\n\n  html, :host {\n    -webkit-text-size-adjust: 100%;\n    tab-size: 4;\n    line-height: 1.5;\n    font-family: var(--default-font-family, ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji");\n    font-feature-settings: var(--default-font-feature-settings, normal);\n    font-variation-settings: var(--default-font-variation-settings, normal);\n    -webkit-tap-highlight-color: transparent;\n  }\n\n  hr {\n    height: 0;\n    color: inherit;\n    border-top-width: 1px;\n  }\n\n  abbr:where([title]) {\n    -webkit-text-decoration: underline dotted;\n    text-decoration: underline dotted;\n  }\n\n  h1, h2, h3, h4, h5, h6 {\n    font-size: inherit;\n    font-weight: inherit;\n  }\n\n  a {\n    color: inherit;\n    -webkit-text-decoration: inherit;\n    -webkit-text-decoration: inherit;\n    -webkit-text-decoration: inherit;\n    text-decoration: inherit;\n  }\n\n  b, strong {\n    font-weight: bolder;\n  }\n\n  code, kbd, samp, pre {\n    font-family: var(--default-mono-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);\n    font-feature-settings: var(--default-mono-font-feature-settings, normal);\n    font-variation-settings: var(--default-mono-font-variation-settings, normal);\n    font-size: 1em;\n  }\n\n  small {\n    font-size: 80%;\n  }\n\n  sub, sup {\n    vertical-align: baseline;\n    font-size: 75%;\n    line-height: 0;\n    position: relative;\n  }\n\n  sub {\n    bottom: -.25em;\n  }\n\n  sup {\n    top: -.5em;\n  }\n\n  table {\n    text-indent: 0;\n    border-color: inherit;\n    border-collapse: collapse;\n  }\n\n  :-moz-focusring {\n    outline: auto;\n  }\n\n  progress {\n    vertical-align: baseline;\n  }\n\n  summary {\n    display: list-item;\n  }\n\n  ol, ul, menu {\n    list-style: none;\n  }\n\n  img, svg, video, canvas, audio, iframe, embed, object {\n    vertical-align: middle;\n    display: block;\n  }\n\n  img, video {\n    max-width: 100%;\n    height: auto;\n  }\n\n  button, input, select, optgroup, textarea {\n    font: inherit;\n    font-feature-settings: inherit;\n    font-variation-settings: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    opacity: 1;\n    background-color: #0000;\n    border-radius: 0;\n  }\n\n  ::file-selector-button {\n    font: inherit;\n    font-feature-settings: inherit;\n    font-variation-settings: inherit;\n    letter-spacing: inherit;\n    color: inherit;\n    opacity: 1;\n    background-color: #0000;\n    border-radius: 0;\n  }\n\n  :where(select:is([multiple], [size])) optgroup {\n    font-weight: bolder;\n  }\n\n  :where(select:is([multiple], [size])) optgroup option {\n    padding-inline-start: 20px;\n  }\n\n  ::file-selector-button {\n    margin-inline-end: 4px;\n  }\n\n  ::placeholder {\n    opacity: 1;\n  }\n\n  @supports (not ((-webkit-appearance: -apple-pay-button))) or (contain-intrinsic-size: 1px) {\n    ::placeholder {\n      color: currentColor;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      ::placeholder {\n        color: color-mix(in oklab, currentcolor 50%, transparent);\n      }\n    }\n  }\n\n  textarea {\n    resize: vertical;\n  }\n\n  ::-webkit-search-decoration {\n    -webkit-appearance: none;\n  }\n\n  ::-webkit-date-and-time-value {\n    min-height: 1lh;\n    text-align: inherit;\n  }\n\n  ::-webkit-datetime-edit {\n    display: inline-flex;\n  }\n\n  ::-webkit-datetime-edit-fields-wrapper {\n    padding: 0;\n  }\n\n  ::-webkit-datetime-edit {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-year-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-month-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-day-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-hour-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-minute-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-second-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-millisecond-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-datetime-edit-meridiem-field {\n    padding-block: 0;\n  }\n\n  ::-webkit-calendar-picker-indicator {\n    line-height: 1;\n  }\n\n  :-moz-ui-invalid {\n    box-shadow: none;\n  }\n\n  button, input:where([type="button"], [type="reset"], [type="submit"]) {\n    appearance: button;\n  }\n\n  ::file-selector-button {\n    appearance: button;\n  }\n\n  ::-webkit-inner-spin-button {\n    height: auto;\n  }\n\n  ::-webkit-outer-spin-button {\n    height: auto;\n  }\n\n  [hidden]:where(:not([hidden="until-found"])) {\n    display: none !important;\n  }\n}\n\n@layer components;\n\n@layer utilities {\n  .pointer-events-auto {\n    pointer-events: auto;\n  }\n\n  .pointer-events-none {\n    pointer-events: none;\n  }\n\n  .collapse {\n    visibility: collapse;\n  }\n\n  .invisible {\n    visibility: hidden;\n  }\n\n  .visible {\n    visibility: visible;\n  }\n\n  .sr-only {\n    clip-path: inset(50%);\n    white-space: nowrap;\n    border-width: 0;\n    width: 1px;\n    height: 1px;\n    margin: -1px;\n    padding: 0;\n    position: absolute;\n    overflow: hidden;\n  }\n\n  .absolute {\n    position: absolute;\n  }\n\n  .fixed {\n    position: fixed;\n  }\n\n  .relative {\n    position: relative;\n  }\n\n  .static {\n    position: static;\n  }\n\n  .sticky {\n    position: sticky;\n  }\n\n  .inset-0 {\n    inset: calc(var(--spacing) * 0);\n  }\n\n  .inset-1 {\n    inset: calc(var(--spacing) * 1);\n  }\n\n  .inset-x-0 {\n    inset-inline: calc(var(--spacing) * 0);\n  }\n\n  .inset-y-0 {\n    inset-block: calc(var(--spacing) * 0);\n  }\n\n  .inset-y-4 {\n    inset-block: calc(var(--spacing) * 4);\n  }\n\n  .start {\n    inset-inline-start: var(--spacing);\n  }\n\n  .end {\n    inset-inline-end: var(--spacing);\n  }\n\n  .-top-12 {\n    top: calc(var(--spacing) * -12);\n  }\n\n  .top-0 {\n    top: calc(var(--spacing) * 0);\n  }\n\n  .top-0\\.5 {\n    top: calc(var(--spacing) * .5);\n  }\n\n  .top-1 {\n    top: calc(var(--spacing) * 1);\n  }\n\n  .top-1\\/2 {\n    top: 50%;\n  }\n\n  .top-2 {\n    top: calc(var(--spacing) * 2);\n  }\n\n  .top-3 {\n    top: calc(var(--spacing) * 3);\n  }\n\n  .top-4 {\n    top: calc(var(--spacing) * 4);\n  }\n\n  .top-full {\n    top: 100%;\n  }\n\n  .-right-12 {\n    right: calc(var(--spacing) * -12);\n  }\n\n  .right-0 {\n    right: calc(var(--spacing) * 0);\n  }\n\n  .right-1 {\n    right: calc(var(--spacing) * 1);\n  }\n\n  .right-2 {\n    right: calc(var(--spacing) * 2);\n  }\n\n  .right-3 {\n    right: calc(var(--spacing) * 3);\n  }\n\n  .right-4 {\n    right: calc(var(--spacing) * 4);\n  }\n\n  .-bottom-12 {\n    bottom: calc(var(--spacing) * -12);\n  }\n\n  .bottom-0 {\n    bottom: calc(var(--spacing) * 0);\n  }\n\n  .bottom-4 {\n    bottom: calc(var(--spacing) * 4);\n  }\n\n  .-left-12 {\n    left: calc(var(--spacing) * -12);\n  }\n\n  .left-0 {\n    left: calc(var(--spacing) * 0);\n  }\n\n  .left-1 {\n    left: calc(var(--spacing) * 1);\n  }\n\n  .left-1\\/2 {\n    left: 50%;\n  }\n\n  .left-2 {\n    left: calc(var(--spacing) * 2);\n  }\n\n  .isolate {\n    isolation: isolate;\n  }\n\n  .z-10 {\n    z-index: 10;\n  }\n\n  .z-20 {\n    z-index: 20;\n  }\n\n  .z-40 {\n    z-index: 40;\n  }\n\n  .z-50 {\n    z-index: 50;\n  }\n\n  .order-1 {\n    order: 1;\n  }\n\n  .order-first {\n    order: -9999;\n  }\n\n  .order-last {\n    order: 9999;\n  }\n\n  .col-start-2 {\n    grid-column-start: 2;\n  }\n\n  .row-span-2 {\n    grid-row: span 2 / span 2;\n  }\n\n  .row-start-1 {\n    grid-row-start: 1;\n  }\n\n  .\\!container {\n    width: 100% !important;\n  }\n\n  @media (min-width: 40rem) {\n    .\\!container {\n      max-width: 40rem !important;\n    }\n  }\n\n  @media (min-width: 48rem) {\n    .\\!container {\n      max-width: 48rem !important;\n    }\n  }\n\n  @media (min-width: 64rem) {\n    .\\!container {\n      max-width: 64rem !important;\n    }\n  }\n\n  @media (min-width: 80rem) {\n    .\\!container {\n      max-width: 80rem !important;\n    }\n  }\n\n  @media (min-width: 96rem) {\n    .\\!container {\n      max-width: 96rem !important;\n    }\n  }\n\n  .container {\n    width: 100%;\n  }\n\n  @media (min-width: 40rem) {\n    .container {\n      max-width: 40rem;\n    }\n  }\n\n  @media (min-width: 48rem) {\n    .container {\n      max-width: 48rem;\n    }\n  }\n\n  @media (min-width: 64rem) {\n    .container {\n      max-width: 64rem;\n    }\n  }\n\n  @media (min-width: 80rem) {\n    .container {\n      max-width: 80rem;\n    }\n  }\n\n  @media (min-width: 96rem) {\n    .container {\n      max-width: 96rem;\n    }\n  }\n\n  .m-1 {\n    margin: calc(var(--spacing) * 1);\n  }\n\n  .-mx-1 {\n    margin-inline: calc(var(--spacing) * -1);\n  }\n\n  .mx-2 {\n    margin-inline: calc(var(--spacing) * 2);\n  }\n\n  .mx-3 {\n    margin-inline: calc(var(--spacing) * 3);\n  }\n\n  .mx-auto {\n    margin-inline: auto;\n  }\n\n  .-my-2 {\n    margin-block: calc(var(--spacing) * -2);\n  }\n\n  .my-0 {\n    margin-block: calc(var(--spacing) * 0);\n  }\n\n  .my-1 {\n    margin-block: calc(var(--spacing) * 1);\n  }\n\n  .-mt-4 {\n    margin-top: calc(var(--spacing) * -4);\n  }\n\n  .mt-1 {\n    margin-top: calc(var(--spacing) * 1);\n  }\n\n  .mt-2 {\n    margin-top: calc(var(--spacing) * 2);\n  }\n\n  .mt-4 {\n    margin-top: calc(var(--spacing) * 4);\n  }\n\n  .mt-auto {\n    margin-top: auto;\n  }\n\n  .mb-2 {\n    margin-bottom: calc(var(--spacing) * 2);\n  }\n\n  .mb-3 {\n    margin-bottom: calc(var(--spacing) * 3);\n  }\n\n  .mb-4 {\n    margin-bottom: calc(var(--spacing) * 4);\n  }\n\n  .-ml-4 {\n    margin-left: calc(var(--spacing) * -4);\n  }\n\n  .ml-1 {\n    margin-left: calc(var(--spacing) * 1);\n  }\n\n  .ml-4 {\n    margin-left: calc(var(--spacing) * 4);\n  }\n\n  .ml-auto {\n    margin-left: auto;\n  }\n\n  .line-clamp-1 {\n    -webkit-line-clamp: 1;\n    -webkit-box-orient: vertical;\n    display: -webkit-box;\n    overflow: hidden;\n  }\n\n  .line-clamp-2 {\n    -webkit-line-clamp: 2;\n    -webkit-box-orient: vertical;\n    display: -webkit-box;\n    overflow: hidden;\n  }\n\n  .block {\n    display: block;\n  }\n\n  .contents {\n    display: contents;\n  }\n\n  .flex {\n    display: flex;\n  }\n\n  .grid {\n    display: grid;\n  }\n\n  .hidden {\n    display: none;\n  }\n\n  .inline {\n    display: inline;\n  }\n\n  .inline-flex {\n    display: inline-flex;\n  }\n\n  .inline-grid {\n    display: inline-grid;\n  }\n\n  .table {\n    display: table;\n  }\n\n  .table-caption {\n    display: table-caption;\n  }\n\n  .table-cell {\n    display: table-cell;\n  }\n\n  .table-row {\n    display: table-row;\n  }\n\n  .field-sizing-content {\n    field-sizing: content;\n  }\n\n  .aspect-\\[5\\/3\\] {\n    aspect-ratio: 5 / 3;\n  }\n\n  .aspect-square {\n    aspect-ratio: 1;\n  }\n\n  .aspect-video {\n    aspect-ratio: var(--aspect-video);\n  }\n\n  .size-2 {\n    width: calc(var(--spacing) * 2);\n    height: calc(var(--spacing) * 2);\n  }\n\n  .size-3 {\n    width: calc(var(--spacing) * 3);\n    height: calc(var(--spacing) * 3);\n  }\n\n  .size-4 {\n    width: calc(var(--spacing) * 4);\n    height: calc(var(--spacing) * 4);\n  }\n\n  .size-6 {\n    width: calc(var(--spacing) * 6);\n    height: calc(var(--spacing) * 6);\n  }\n\n  .size-7 {\n    width: calc(var(--spacing) * 7);\n    height: calc(var(--spacing) * 7);\n  }\n\n  .size-8 {\n    width: calc(var(--spacing) * 8);\n    height: calc(var(--spacing) * 8);\n  }\n\n  .size-9 {\n    width: calc(var(--spacing) * 9);\n    height: calc(var(--spacing) * 9);\n  }\n\n  .size-10 {\n    width: calc(var(--spacing) * 10);\n    height: calc(var(--spacing) * 10);\n  }\n\n  .size-auto {\n    width: auto;\n    height: auto;\n  }\n\n  .size-full {\n    width: 100%;\n    height: 100%;\n  }\n\n  .h-1 {\n    height: calc(var(--spacing) * 1);\n  }\n\n  .h-1\\.5 {\n    height: calc(var(--spacing) * 1.5);\n  }\n\n  .h-2 {\n    height: calc(var(--spacing) * 2);\n  }\n\n  .h-3 {\n    height: calc(var(--spacing) * 3);\n  }\n\n  .h-3\\.5 {\n    height: calc(var(--spacing) * 3.5);\n  }\n\n  .h-4 {\n    height: calc(var(--spacing) * 4);\n  }\n\n  .h-5 {\n    height: calc(var(--spacing) * 5);\n  }\n\n  .h-6 {\n    height: calc(var(--spacing) * 6);\n  }\n\n  .h-7 {\n    height: calc(var(--spacing) * 7);\n  }\n\n  .h-8 {\n    height: calc(var(--spacing) * 8);\n  }\n\n  .h-9 {\n    height: calc(var(--spacing) * 9);\n  }\n\n  .h-10 {\n    height: calc(var(--spacing) * 10);\n  }\n\n  .h-11 {\n    height: calc(var(--spacing) * 11);\n  }\n\n  .h-12 {\n    height: calc(var(--spacing) * 12);\n  }\n\n  .h-24 {\n    height: calc(var(--spacing) * 24);\n  }\n\n  .h-32 {\n    height: calc(var(--spacing) * 32);\n  }\n\n  .h-44 {\n    height: calc(var(--spacing) * 44);\n  }\n\n  .h-\\[18px\\] {\n    height: 18px;\n  }\n\n  .h-\\[118px\\] {\n    height: 118px;\n  }\n\n  .h-\\[180px\\] {\n    height: 180px;\n  }\n\n  .h-\\[190px\\] {\n    height: 190px;\n  }\n\n  .h-\\[320px\\] {\n    height: 320px;\n  }\n\n  .h-auto {\n    height: auto;\n  }\n\n  .h-full {\n    height: 100%;\n  }\n\n  .h-px {\n    height: 1px;\n  }\n\n  .h-svh {\n    height: 100svh;\n  }\n\n  .max-h-40 {\n    max-height: calc(var(--spacing) * 40);\n  }\n\n  .max-h-screen {\n    max-height: 100vh;\n  }\n\n  .min-h-0 {\n    min-height: calc(var(--spacing) * 0);\n  }\n\n  .min-h-4 {\n    min-height: calc(var(--spacing) * 4);\n  }\n\n  .min-h-16 {\n    min-height: calc(var(--spacing) * 16);\n  }\n\n  .min-h-\\[100dvh\\] {\n    min-height: 100dvh;\n  }\n\n  .min-h-\\[220px\\] {\n    min-height: 220px;\n  }\n\n  .min-h-\\[calc\\(100dvh-2rem\\)\\] {\n    min-height: calc(100dvh - 2rem);\n  }\n\n  .min-h-full {\n    min-height: 100%;\n  }\n\n  .min-h-screen {\n    min-height: 100vh;\n  }\n\n  .min-h-svh {\n    min-height: 100svh;\n  }\n\n  .w-0 {\n    width: calc(var(--spacing) * 0);\n  }\n\n  .w-0\\.5 {\n    width: calc(var(--spacing) * .5);\n  }\n\n  .w-1 {\n    width: calc(var(--spacing) * 1);\n  }\n\n  .w-2 {\n    width: calc(var(--spacing) * 2);\n  }\n\n  .w-3 {\n    width: calc(var(--spacing) * 3);\n  }\n\n  .w-3\\.5 {\n    width: calc(var(--spacing) * 3.5);\n  }\n\n  .w-4 {\n    width: calc(var(--spacing) * 4);\n  }\n\n  .w-5 {\n    width: calc(var(--spacing) * 5);\n  }\n\n  .w-6 {\n    width: calc(var(--spacing) * 6);\n  }\n\n  .w-8 {\n    width: calc(var(--spacing) * 8);\n  }\n\n  .w-9 {\n    width: calc(var(--spacing) * 9);\n  }\n\n  .w-10 {\n    width: calc(var(--spacing) * 10);\n  }\n\n  .w-11 {\n    width: calc(var(--spacing) * 11);\n  }\n\n  .w-12 {\n    width: calc(var(--spacing) * 12);\n  }\n\n  .w-16 {\n    width: calc(var(--spacing) * 16);\n  }\n\n  .w-24 {\n    width: calc(var(--spacing) * 24);\n  }\n\n  .w-64 {\n    width: calc(var(--spacing) * 64);\n  }\n\n  .w-72 {\n    width: calc(var(--spacing) * 72);\n  }\n\n  .w-\\[18px\\] {\n    width: 18px;\n  }\n\n  .w-auto {\n    width: auto;\n  }\n\n  .w-fit {\n    width: fit-content;\n  }\n\n  .w-full {\n    width: 100%;\n  }\n\n  .w-max {\n    width: max-content;\n  }\n\n  .w-px {\n    width: 1px;\n  }\n\n  .max-w-2xl {\n    max-width: var(--container-2xl);\n  }\n\n  .max-w-\\[34ch\\] {\n    max-width: 34ch;\n  }\n\n  .max-w-\\[280px\\] {\n    max-width: 280px;\n  }\n\n  .max-w-\\[1080px\\] {\n    max-width: 1080px;\n  }\n\n  .max-w-max {\n    max-width: max-content;\n  }\n\n  .max-w-sm {\n    max-width: var(--container-sm);\n  }\n\n  .min-w-0 {\n    min-width: calc(var(--spacing) * 0);\n  }\n\n  .min-w-5 {\n    min-width: calc(var(--spacing) * 5);\n  }\n\n  .min-w-8 {\n    min-width: calc(var(--spacing) * 8);\n  }\n\n  .min-w-9 {\n    min-width: calc(var(--spacing) * 9);\n  }\n\n  .min-w-10 {\n    min-width: calc(var(--spacing) * 10);\n  }\n\n  .min-w-12 {\n    min-width: calc(var(--spacing) * 12);\n  }\n\n  .min-w-full {\n    min-width: 100%;\n  }\n\n  .flex-1 {\n    flex: 1;\n  }\n\n  .flex-shrink, .shrink {\n    flex-shrink: 1;\n  }\n\n  .shrink-0 {\n    flex-shrink: 0;\n  }\n\n  .flex-grow, .grow {\n    flex-grow: 1;\n  }\n\n  .grow-0 {\n    flex-grow: 0;\n  }\n\n  .basis-full {\n    flex-basis: 100%;\n  }\n\n  .caption-bottom {\n    caption-side: bottom;\n  }\n\n  .border-collapse {\n    border-collapse: collapse;\n  }\n\n  .-translate-x-1 {\n    --tw-translate-x: calc(var(--spacing) * -1);\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .-translate-x-1\\/2 {\n    --tw-translate-x: calc(calc(1 / 2 * 100%) * -1);\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .-translate-x-px {\n    --tw-translate-x: -1px;\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .translate-x-px {\n    --tw-translate-x: 1px;\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .-translate-y-1 {\n    --tw-translate-y: calc(var(--spacing) * -1);\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .-translate-y-1\\/2 {\n    --tw-translate-y: calc(calc(1 / 2 * 100%) * -1);\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .translate-y-0 {\n    --tw-translate-y: calc(var(--spacing) * 0);\n    translate: var(--tw-translate-x) var(--tw-translate-y);\n  }\n\n  .rotate-45 {\n    rotate: 45deg;\n  }\n\n  .rotate-90 {\n    rotate: 90deg;\n  }\n\n  .rotate-180 {\n    rotate: 180deg;\n  }\n\n  .transform {\n    transform: var(--tw-rotate-x, ) var(--tw-rotate-y, ) var(--tw-rotate-z, ) var(--tw-skew-x, ) var(--tw-skew-y, );\n  }\n\n  .animate-pulse {\n    animation: var(--animate-pulse);\n  }\n\n  .animate-spin {\n    animation: var(--animate-spin);\n  }\n\n  .cursor-default {\n    cursor: default;\n  }\n\n  .cursor-ew-resize {\n    cursor: ew-resize;\n  }\n\n  .cursor-grab {\n    cursor: grab;\n  }\n\n  .cursor-move {\n    cursor: move;\n  }\n\n  .cursor-ns-resize {\n    cursor: ns-resize;\n  }\n\n  .cursor-pointer {\n    cursor: pointer;\n  }\n\n  .cursor-text {\n    cursor: text;\n  }\n\n  .touch-none {\n    touch-action: none;\n  }\n\n  .resize {\n    resize: both;\n  }\n\n  .resize-none {\n    resize: none;\n  }\n\n  .scroll-my-1 {\n    scroll-margin-block: calc(var(--spacing) * 1);\n  }\n\n  .scroll-py-1 {\n    scroll-padding-block: calc(var(--spacing) * 1);\n  }\n\n  .list-disc {\n    list-style-type: disc;\n  }\n\n  .list-none {\n    list-style-type: none;\n  }\n\n  .appearance-none {\n    appearance: none;\n  }\n\n  .auto-rows-max {\n    grid-auto-rows: max-content;\n  }\n\n  .auto-rows-min {\n    grid-auto-rows: min-content;\n  }\n\n  .grid-cols-1 {\n    grid-template-columns: repeat(1, minmax(0, 1fr));\n  }\n\n  .grid-cols-2 {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .grid-cols-3 {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .grid-cols-4 {\n    grid-template-columns: repeat(4, minmax(0, 1fr));\n  }\n\n  .grid-cols-5 {\n    grid-template-columns: repeat(5, minmax(0, 1fr));\n  }\n\n  .grid-cols-\\[56px_minmax\\(0\\,1fr\\)\\] {\n    grid-template-columns: 56px minmax(0, 1fr);\n  }\n\n  .grid-cols-\\[minmax\\(0\\,1fr\\)_88px\\] {\n    grid-template-columns: minmax(0, 1fr) 88px;\n  }\n\n  .grid-cols-\\[minmax\\(0\\,1fr\\)_92px\\] {\n    grid-template-columns: minmax(0, 1fr) 92px;\n  }\n\n  .grid-cols-\\[minmax\\(0\\,1fr\\)_92px_auto\\] {\n    grid-template-columns: minmax(0, 1fr) 92px auto;\n  }\n\n  .grid-cols-\\[minmax\\(0\\,1fr\\)_auto\\] {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .grid-rows-\\[auto_minmax\\(0\\,1fr\\)_auto\\] {\n    grid-template-rows: auto minmax(0, 1fr) auto;\n  }\n\n  .flex-col {\n    flex-direction: column;\n  }\n\n  .flex-col-reverse {\n    flex-direction: column-reverse;\n  }\n\n  .flex-row {\n    flex-direction: row;\n  }\n\n  .flex-wrap {\n    flex-wrap: wrap;\n  }\n\n  .content-start {\n    align-content: flex-start;\n  }\n\n  .items-center {\n    align-items: center;\n  }\n\n  .items-end {\n    align-items: flex-end;\n  }\n\n  .items-start {\n    align-items: flex-start;\n  }\n\n  .items-stretch {\n    align-items: stretch;\n  }\n\n  .justify-between {\n    justify-content: space-between;\n  }\n\n  .justify-center {\n    justify-content: center;\n  }\n\n  .justify-end {\n    justify-content: flex-end;\n  }\n\n  .justify-start {\n    justify-content: flex-start;\n  }\n\n  .justify-items-start {\n    justify-items: start;\n  }\n\n  .gap-0 {\n    gap: calc(var(--spacing) * 0);\n  }\n\n  .gap-1 {\n    gap: calc(var(--spacing) * 1);\n  }\n\n  .gap-1\\.5 {\n    gap: calc(var(--spacing) * 1.5);\n  }\n\n  .gap-2 {\n    gap: calc(var(--spacing) * 2);\n  }\n\n  .gap-3 {\n    gap: calc(var(--spacing) * 3);\n  }\n\n  .gap-4 {\n    gap: calc(var(--spacing) * 4);\n  }\n\n  .gap-5 {\n    gap: calc(var(--spacing) * 5);\n  }\n\n  .gap-6 {\n    gap: calc(var(--spacing) * 6);\n  }\n\n  .gap-7 {\n    gap: calc(var(--spacing) * 7);\n  }\n\n  :where(.space-y-1 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-1\\.5 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 1.5) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 1.5) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-y-3 > :not(:last-child)) {\n    --tw-space-y-reverse: 0;\n    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));\n    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));\n  }\n\n  :where(.space-x-4 > :not(:last-child)) {\n    --tw-space-x-reverse: 0;\n    margin-inline-start: calc(calc(var(--spacing) * 4) * var(--tw-space-x-reverse));\n    margin-inline-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)));\n  }\n\n  .gap-y-0 {\n    row-gap: calc(var(--spacing) * 0);\n  }\n\n  .self-center {\n    align-self: center;\n  }\n\n  .self-end {\n    align-self: flex-end;\n  }\n\n  .self-start {\n    align-self: flex-start;\n  }\n\n  .self-stretch {\n    align-self: stretch;\n  }\n\n  .justify-self-end {\n    justify-self: flex-end;\n  }\n\n  .truncate {\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    overflow: hidden;\n  }\n\n  .overflow-auto {\n    overflow: auto;\n  }\n\n  .overflow-hidden {\n    overflow: hidden;\n  }\n\n  .overflow-visible {\n    overflow: visible;\n  }\n\n  .overflow-x-auto {\n    overflow-x: auto;\n  }\n\n  .overflow-x-hidden {\n    overflow-x: hidden;\n  }\n\n  .overflow-y-auto {\n    overflow-y: auto;\n  }\n\n  .rounded {\n    border-radius: .25rem;\n  }\n\n  .rounded-2xl {\n    border-radius: var(--radius-2xl);\n  }\n\n  .rounded-\\[14px\\] {\n    border-radius: 14px;\n  }\n\n  .rounded-\\[16px\\] {\n    border-radius: 16px;\n  }\n\n  .rounded-\\[18px\\] {\n    border-radius: 18px;\n  }\n\n  .rounded-\\[20px\\] {\n    border-radius: 20px;\n  }\n\n  .rounded-\\[22px\\] {\n    border-radius: 22px;\n  }\n\n  .rounded-\\[24px\\] {\n    border-radius: 24px;\n  }\n\n  .rounded-\\[28px\\] {\n    border-radius: 28px;\n  }\n\n  .rounded-\\[30px\\] {\n    border-radius: 30px;\n  }\n\n  .rounded-full {\n    border-radius: 3.40282e38px;\n  }\n\n  .rounded-lg {\n    border-radius: var(--radius-lg);\n  }\n\n  .rounded-md {\n    border-radius: var(--radius-md);\n  }\n\n  .rounded-none {\n    border-radius: 0;\n  }\n\n  .rounded-sm {\n    border-radius: var(--radius-sm);\n  }\n\n  .rounded-xl {\n    border-radius: var(--radius-xl);\n  }\n\n  .rounded-xs {\n    border-radius: var(--radius-xs);\n  }\n\n  .rounded-l-md {\n    border-top-left-radius: var(--radius-md);\n    border-bottom-left-radius: var(--radius-md);\n  }\n\n  .rounded-tl-sm {\n    border-top-left-radius: var(--radius-sm);\n  }\n\n  .rounded-r-md {\n    border-top-right-radius: var(--radius-md);\n    border-bottom-right-radius: var(--radius-md);\n  }\n\n  .border {\n    border-style: var(--tw-border-style);\n    border-width: 1px;\n  }\n\n  .border-0 {\n    border-style: var(--tw-border-style);\n    border-width: 0;\n  }\n\n  .border-y {\n    border-block-style: var(--tw-border-style);\n    border-block-width: 1px;\n  }\n\n  .border-t {\n    border-top-style: var(--tw-border-style);\n    border-top-width: 1px;\n  }\n\n  .border-r {\n    border-right-style: var(--tw-border-style);\n    border-right-width: 1px;\n  }\n\n  .border-b {\n    border-bottom-style: var(--tw-border-style);\n    border-bottom-width: 1px;\n  }\n\n  .border-l {\n    border-left-style: var(--tw-border-style);\n    border-left-width: 1px;\n  }\n\n  .border-dashed {\n    --tw-border-style: dashed;\n    border-style: dashed;\n  }\n\n  .border-amber-200 {\n    border-color: var(--color-amber-200);\n  }\n\n  .border-amber-200\\/18 {\n    border-color: #fee6852e;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-amber-200\\/18 {\n      border-color: color-mix(in oklab, var(--color-amber-200) 18%, transparent);\n    }\n  }\n\n  .border-cyan-200 {\n    border-color: var(--color-cyan-200);\n  }\n\n  .border-cyan-200\\/28 {\n    border-color: #a2f4fd47;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-cyan-200\\/28 {\n      border-color: color-mix(in oklab, var(--color-cyan-200) 28%, transparent);\n    }\n  }\n\n  .border-cyan-300 {\n    border-color: var(--color-cyan-300);\n  }\n\n  .border-fuchsia-300 {\n    border-color: var(--color-fuchsia-300);\n  }\n\n  .border-fuchsia-300\\/15 {\n    border-color: #f2a9ff26;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-fuchsia-300\\/15 {\n      border-color: color-mix(in oklab, var(--color-fuchsia-300) 15%, transparent);\n    }\n  }\n\n  .border-rose-300 {\n    border-color: var(--color-rose-300);\n  }\n\n  .border-rose-300\\/10 {\n    border-color: #ffa2ae1a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-rose-300\\/10 {\n      border-color: color-mix(in oklab, var(--color-rose-300) 10%, transparent);\n    }\n  }\n\n  .border-sky-300 {\n    border-color: var(--color-sky-300);\n  }\n\n  .border-transparent {\n    border-color: #0000;\n  }\n\n  .border-white {\n    border-color: var(--color-white);\n  }\n\n  .border-white\\/6 {\n    border-color: #ffffff0f;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/6 {\n      border-color: color-mix(in oklab, var(--color-white) 6%, transparent);\n    }\n  }\n\n  .border-white\\/8 {\n    border-color: #ffffff14;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/8 {\n      border-color: color-mix(in oklab, var(--color-white) 8%, transparent);\n    }\n  }\n\n  .border-white\\/10 {\n    border-color: #ffffff1a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/10 {\n      border-color: color-mix(in oklab, var(--color-white) 10%, transparent);\n    }\n  }\n\n  .border-white\\/\\[0\\.04\\] {\n    border-color: #ffffff0a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/\\[0\\.04\\] {\n      border-color: color-mix(in oklab, var(--color-white) 4%, transparent);\n    }\n  }\n\n  .border-white\\/\\[0\\.05\\] {\n    border-color: #ffffff0d;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/\\[0\\.05\\] {\n      border-color: color-mix(in oklab, var(--color-white) 5%, transparent);\n    }\n  }\n\n  .border-white\\/\\[0\\.08\\] {\n    border-color: #ffffff14;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/\\[0\\.08\\] {\n      border-color: color-mix(in oklab, var(--color-white) 8%, transparent);\n    }\n  }\n\n  .border-white\\/\\[0\\.10\\] {\n    border-color: #ffffff1a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .border-white\\/\\[0\\.10\\] {\n      border-color: color-mix(in oklab, var(--color-white) 10%, transparent);\n    }\n  }\n\n  .border-t-transparent {\n    border-top-color: #0000;\n  }\n\n  .border-l-transparent {\n    border-left-color: #0000;\n  }\n\n  .bg-\\[\\#070b16\\] {\n    background-color: #070b16;\n  }\n\n  .bg-\\[\\#09101d\\]\\/95 {\n    background-color: oklab(17.3432% -.0040513 -.029082 / .95);\n  }\n\n  .bg-\\[\\#030711\\]\\/85 {\n    background-color: oklab(12.8817% -.00430492 -.0249884 / .85);\n  }\n\n  .bg-black {\n    background-color: var(--color-black);\n  }\n\n  .bg-black\\/18 {\n    background-color: #0000002e;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/18 {\n      background-color: color-mix(in oklab, var(--color-black) 18%, transparent);\n    }\n  }\n\n  .bg-black\\/20 {\n    background-color: #0003;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/20 {\n      background-color: color-mix(in oklab, var(--color-black) 20%, transparent);\n    }\n  }\n\n  .bg-black\\/25 {\n    background-color: #00000040;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/25 {\n      background-color: color-mix(in oklab, var(--color-black) 25%, transparent);\n    }\n  }\n\n  .bg-black\\/30 {\n    background-color: #0000004d;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/30 {\n      background-color: color-mix(in oklab, var(--color-black) 30%, transparent);\n    }\n  }\n\n  .bg-black\\/35 {\n    background-color: #00000059;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/35 {\n      background-color: color-mix(in oklab, var(--color-black) 35%, transparent);\n    }\n  }\n\n  .bg-black\\/40 {\n    background-color: #0006;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/40 {\n      background-color: color-mix(in oklab, var(--color-black) 40%, transparent);\n    }\n  }\n\n  .bg-black\\/42 {\n    background-color: #0000006b;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/42 {\n      background-color: color-mix(in oklab, var(--color-black) 42%, transparent);\n    }\n  }\n\n  .bg-black\\/45 {\n    background-color: #00000073;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/45 {\n      background-color: color-mix(in oklab, var(--color-black) 45%, transparent);\n    }\n  }\n\n  .bg-black\\/48 {\n    background-color: #0000007a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-black\\/48 {\n      background-color: color-mix(in oklab, var(--color-black) 48%, transparent);\n    }\n  }\n\n  .bg-cyan-300 {\n    background-color: var(--color-cyan-300);\n  }\n\n  .bg-cyan-300\\/18 {\n    background-color: #53eafd2e;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-cyan-300\\/18 {\n      background-color: color-mix(in oklab, var(--color-cyan-300) 18%, transparent);\n    }\n  }\n\n  .bg-cyan-300\\/\\[0\\.08\\] {\n    background-color: #53eafd14;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-cyan-300\\/\\[0\\.08\\] {\n      background-color: color-mix(in oklab, var(--color-cyan-300) 8%, transparent);\n    }\n  }\n\n  .bg-emerald-300 {\n    background-color: var(--color-emerald-300);\n  }\n\n  .bg-emerald-300\\/18 {\n    background-color: #5ee9b52e;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-emerald-300\\/18 {\n      background-color: color-mix(in oklab, var(--color-emerald-300) 18%, transparent);\n    }\n  }\n\n  .bg-fuchsia-300 {\n    background-color: var(--color-fuchsia-300);\n  }\n\n  .bg-fuchsia-300\\/8 {\n    background-color: #f2a9ff14;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-fuchsia-300\\/8 {\n      background-color: color-mix(in oklab, var(--color-fuchsia-300) 8%, transparent);\n    }\n  }\n\n  .bg-rose-400 {\n    background-color: var(--color-rose-400);\n  }\n\n  .bg-rose-400\\/\\[0\\.04\\] {\n    background-color: #ff667f0a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-rose-400\\/\\[0\\.04\\] {\n      background-color: color-mix(in oklab, var(--color-rose-400) 4%, transparent);\n    }\n  }\n\n  .bg-sky-300 {\n    background-color: var(--color-sky-300);\n  }\n\n  .bg-transparent {\n    background-color: #0000;\n  }\n\n  .bg-white {\n    background-color: var(--color-white);\n  }\n\n  .bg-white\\/\\[0\\.03\\] {\n    background-color: #ffffff08;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/\\[0\\.03\\] {\n      background-color: color-mix(in oklab, var(--color-white) 3%, transparent);\n    }\n  }\n\n  .bg-white\\/\\[0\\.04\\] {\n    background-color: #ffffff0a;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/\\[0\\.04\\] {\n      background-color: color-mix(in oklab, var(--color-white) 4%, transparent);\n    }\n  }\n\n  .bg-white\\/\\[0\\.08\\] {\n    background-color: #ffffff14;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/\\[0\\.08\\] {\n      background-color: color-mix(in oklab, var(--color-white) 8%, transparent);\n    }\n  }\n\n  .bg-white\\/\\[0\\.025\\] {\n    background-color: #ffffff06;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .bg-white\\/\\[0\\.025\\] {\n      background-color: color-mix(in oklab, var(--color-white) 2.5%, transparent);\n    }\n  }\n\n  .bg-\\[linear-gradient\\(180deg\\,rgba\\(2\\,6\\,18\\,0\\.95\\)\\,rgba\\(1\\,3\\,9\\,1\\)\\)\\] {\n    background-image: linear-gradient(#020612f2, #010309);\n  }\n\n  .bg-\\[linear-gradient\\(180deg\\,rgba\\(9\\,13\\,24\\,0\\.98\\)\\,rgba\\(3\\,5\\,12\\,0\\.98\\)\\)\\] {\n    background-image: linear-gradient(#090d18fa, #03050cfa);\n  }\n\n  .bg-\\[linear-gradient\\(180deg\\,rgba\\(17\\,22\\,33\\,0\\.94\\)\\,rgba\\(5\\,8\\,16\\,0\\.98\\)\\)\\] {\n    background-image: linear-gradient(#111621f0, #050810fa);\n  }\n\n  .bg-\\[linear-gradient\\(180deg\\,rgba\\(18\\,25\\,40\\,0\\.94\\)\\,rgba\\(4\\,7\\,16\\,0\\.98\\)\\)\\] {\n    background-image: linear-gradient(#121928f0, #040710fa);\n  }\n\n  .bg-\\[linear-gradient\\(180deg\\,rgba\\(255\\,255\\,255\\,0\\.02\\)\\,rgba\\(255\\,255\\,255\\,0\\.01\\)\\)\\,linear-gradient\\(180deg\\,rgba\\(5\\,9\\,19\\,0\\.92\\)\\,rgba\\(7\\,13\\,24\\,0\\.96\\)\\)\\] {\n    background-image: linear-gradient(#ffffff05, #ffffff03), linear-gradient(#050913eb, #070d18f5);\n  }\n\n  .bg-\\[radial-gradient\\(circle_at_18\\%_22\\%\\,rgba\\(109\\,216\\,255\\,0\\.10\\)\\,transparent_26\\%\\)\\,radial-gradient\\(circle_at_82\\%_78\\%\\,rgba\\(248\\,184\\,77\\,0\\.10\\)\\,transparent_20\\%\\)\\] {\n    background-image: radial-gradient(circle at 18% 22%, #6dd8ff1a, #0000 26%), radial-gradient(circle at 82% 78%, #f8b84d1a, #0000 20%);\n  }\n\n  .bg-\\[radial-gradient\\(circle_at_top\\,rgba\\(93\\,173\\,255\\,0\\.14\\)\\,transparent_34\\%\\)\\,linear-gradient\\(180deg\\,rgba\\(6\\,10\\,22\\,0\\.98\\)\\,rgba\\(2\\,4\\,11\\,1\\)\\)\\] {\n    background-image: radial-gradient(circle at top, #5dadff24, #0000 34%), linear-gradient(#060a16fa, #02040b);\n  }\n\n  .bg-\\[radial-gradient\\(circle_at_top\\,rgba\\(120\\,112\\,255\\,0\\.10\\)\\,transparent_38\\%\\)\\,linear-gradient\\(180deg\\,rgba\\(5\\,8\\,18\\,1\\)\\,rgba\\(2\\,3\\,10\\,1\\)\\)\\] {\n    background-image: radial-gradient(circle at top, #7870ff1a, #0000 38%), linear-gradient(#050812, #02030a);\n  }\n\n  .bg-\\[radial-gradient\\(circle_at_top_left\\,rgba\\(248\\,113\\,113\\,0\\.14\\)\\,transparent_34\\%\\)\\,linear-gradient\\(180deg\\,rgba\\(9\\,8\\,15\\,0\\.98\\)\\,rgba\\(2\\,4\\,11\\,1\\)\\)\\] {\n    background-image: radial-gradient(circle at 0 0, #f8717124, #0000 34%), linear-gradient(#09080ffa, #02040b);\n  }\n\n  .mask-repeat {\n    -webkit-mask-repeat: repeat;\n    mask-repeat: repeat;\n  }\n\n  .fill-current {\n    fill: currentColor;\n  }\n\n  .fill-cyan-200 {\n    fill: var(--color-cyan-200);\n  }\n\n  .fill-fuchsia-200 {\n    fill: var(--color-fuchsia-200);\n  }\n\n  .p-0 {\n    padding: calc(var(--spacing) * 0);\n  }\n\n  .p-1 {\n    padding: calc(var(--spacing) * 1);\n  }\n\n  .p-2 {\n    padding: calc(var(--spacing) * 2);\n  }\n\n  .p-3 {\n    padding: calc(var(--spacing) * 3);\n  }\n\n  .p-4 {\n    padding: calc(var(--spacing) * 4);\n  }\n\n  .p-5 {\n    padding: calc(var(--spacing) * 5);\n  }\n\n  .p-6 {\n    padding: calc(var(--spacing) * 6);\n  }\n\n  .p-8 {\n    padding: calc(var(--spacing) * 8);\n  }\n\n  .p-px {\n    padding: 1px;\n  }\n\n  .px-0 {\n    padding-inline: calc(var(--spacing) * 0);\n  }\n\n  .px-1 {\n    padding-inline: calc(var(--spacing) * 1);\n  }\n\n  .px-1\\.5 {\n    padding-inline: calc(var(--spacing) * 1.5);\n  }\n\n  .px-2 {\n    padding-inline: calc(var(--spacing) * 2);\n  }\n\n  .px-2\\.5 {\n    padding-inline: calc(var(--spacing) * 2.5);\n  }\n\n  .px-3 {\n    padding-inline: calc(var(--spacing) * 3);\n  }\n\n  .px-4 {\n    padding-inline: calc(var(--spacing) * 4);\n  }\n\n  .px-5 {\n    padding-inline: calc(var(--spacing) * 5);\n  }\n\n  .px-6 {\n    padding-inline: calc(var(--spacing) * 6);\n  }\n\n  .py-0 {\n    padding-block: calc(var(--spacing) * 0);\n  }\n\n  .py-0\\.5 {\n    padding-block: calc(var(--spacing) * .5);\n  }\n\n  .py-1 {\n    padding-block: calc(var(--spacing) * 1);\n  }\n\n  .py-1\\.5 {\n    padding-block: calc(var(--spacing) * 1.5);\n  }\n\n  .py-2 {\n    padding-block: calc(var(--spacing) * 2);\n  }\n\n  .py-2\\.5 {\n    padding-block: calc(var(--spacing) * 2.5);\n  }\n\n  .py-3 {\n    padding-block: calc(var(--spacing) * 3);\n  }\n\n  .py-4 {\n    padding-block: calc(var(--spacing) * 4);\n  }\n\n  .py-5 {\n    padding-block: calc(var(--spacing) * 5);\n  }\n\n  .py-6 {\n    padding-block: calc(var(--spacing) * 6);\n  }\n\n  .py-8 {\n    padding-block: calc(var(--spacing) * 8);\n  }\n\n  .pt-0 {\n    padding-top: calc(var(--spacing) * 0);\n  }\n\n  .pt-1 {\n    padding-top: calc(var(--spacing) * 1);\n  }\n\n  .pt-3 {\n    padding-top: calc(var(--spacing) * 3);\n  }\n\n  .pt-4 {\n    padding-top: calc(var(--spacing) * 4);\n  }\n\n  .pr-1 {\n    padding-right: calc(var(--spacing) * 1);\n  }\n\n  .pr-2 {\n    padding-right: calc(var(--spacing) * 2);\n  }\n\n  .pr-3 {\n    padding-right: calc(var(--spacing) * 3);\n  }\n\n  .pr-4 {\n    padding-right: calc(var(--spacing) * 4);\n  }\n\n  .pr-8 {\n    padding-right: calc(var(--spacing) * 8);\n  }\n\n  .pr-10 {\n    padding-right: calc(var(--spacing) * 10);\n  }\n\n  .pr-11 {\n    padding-right: calc(var(--spacing) * 11);\n  }\n\n  .pb-1 {\n    padding-bottom: calc(var(--spacing) * 1);\n  }\n\n  .pb-3 {\n    padding-bottom: calc(var(--spacing) * 3);\n  }\n\n  .pb-4 {\n    padding-bottom: calc(var(--spacing) * 4);\n  }\n\n  .pb-5 {\n    padding-bottom: calc(var(--spacing) * 5);\n  }\n\n  .pl-2 {\n    padding-left: calc(var(--spacing) * 2);\n  }\n\n  .pl-3 {\n    padding-left: calc(var(--spacing) * 3);\n  }\n\n  .pl-4 {\n    padding-left: calc(var(--spacing) * 4);\n  }\n\n  .pl-8 {\n    padding-left: calc(var(--spacing) * 8);\n  }\n\n  .text-center {\n    text-align: center;\n  }\n\n  .text-left {\n    text-align: left;\n  }\n\n  .text-right {\n    text-align: right;\n  }\n\n  .align-middle {\n    vertical-align: middle;\n  }\n\n  .font-mono {\n    font-family: var(--font-mono);\n  }\n\n  .font-sans {\n    font-family: var(--font-sans);\n  }\n\n  .text-2xl {\n    font-size: var(--text-2xl);\n    line-height: var(--tw-leading, var(--text-2xl--line-height));\n  }\n\n  .text-3xl {\n    font-size: var(--text-3xl);\n    line-height: var(--tw-leading, var(--text-3xl--line-height));\n  }\n\n  .text-base {\n    font-size: var(--text-base);\n    line-height: var(--tw-leading, var(--text-base--line-height));\n  }\n\n  .text-lg {\n    font-size: var(--text-lg);\n    line-height: var(--tw-leading, var(--text-lg--line-height));\n  }\n\n  .text-sm {\n    font-size: var(--text-sm);\n    line-height: var(--tw-leading, var(--text-sm--line-height));\n  }\n\n  .text-xs {\n    font-size: var(--text-xs);\n    line-height: var(--tw-leading, var(--text-xs--line-height));\n  }\n\n  .text-\\[10px\\] {\n    font-size: 10px;\n  }\n\n  .text-\\[11px\\] {\n    font-size: 11px;\n  }\n\n  .text-\\[12px\\] {\n    font-size: 12px;\n  }\n\n  .text-\\[13px\\] {\n    font-size: 13px;\n  }\n\n  .text-\\[20px\\] {\n    font-size: 20px;\n  }\n\n  .leading-none {\n    --tw-leading: 1;\n    line-height: 1;\n  }\n\n  .leading-normal {\n    --tw-leading: var(--leading-normal);\n    line-height: var(--leading-normal);\n  }\n\n  .leading-relaxed {\n    --tw-leading: var(--leading-relaxed);\n    line-height: var(--leading-relaxed);\n  }\n\n  .leading-snug {\n    --tw-leading: var(--leading-snug);\n    line-height: var(--leading-snug);\n  }\n\n  .font-bold {\n    --tw-font-weight: var(--font-weight-bold);\n    font-weight: var(--font-weight-bold);\n  }\n\n  .font-medium {\n    --tw-font-weight: var(--font-weight-medium);\n    font-weight: var(--font-weight-medium);\n  }\n\n  .font-normal {\n    --tw-font-weight: var(--font-weight-normal);\n    font-weight: var(--font-weight-normal);\n  }\n\n  .font-semibold {\n    --tw-font-weight: var(--font-weight-semibold);\n    font-weight: var(--font-weight-semibold);\n  }\n\n  .tracking-\\[-0\\.03em\\] {\n    --tw-tracking: -.03em;\n    letter-spacing: -.03em;\n  }\n\n  .tracking-\\[-0\\.04em\\] {\n    --tw-tracking: -.04em;\n    letter-spacing: -.04em;\n  }\n\n  .tracking-\\[0\\.2em\\] {\n    --tw-tracking: .2em;\n    letter-spacing: .2em;\n  }\n\n  .tracking-\\[0\\.12em\\] {\n    --tw-tracking: .12em;\n    letter-spacing: .12em;\n  }\n\n  .tracking-\\[0\\.16em\\] {\n    --tw-tracking: .16em;\n    letter-spacing: .16em;\n  }\n\n  .tracking-\\[0\\.18em\\] {\n    --tw-tracking: .18em;\n    letter-spacing: .18em;\n  }\n\n  .tracking-\\[0\\.22em\\] {\n    --tw-tracking: .22em;\n    letter-spacing: .22em;\n  }\n\n  .tracking-\\[0\\.24em\\] {\n    --tw-tracking: .24em;\n    letter-spacing: .24em;\n  }\n\n  .tracking-tight {\n    --tw-tracking: var(--tracking-tight);\n    letter-spacing: var(--tracking-tight);\n  }\n\n  .tracking-wide {\n    --tw-tracking: var(--tracking-wide);\n    letter-spacing: var(--tracking-wide);\n  }\n\n  .tracking-widest {\n    --tw-tracking: var(--tracking-widest);\n    letter-spacing: var(--tracking-widest);\n  }\n\n  .text-balance {\n    text-wrap: balance;\n  }\n\n  .text-wrap {\n    text-wrap: wrap;\n  }\n\n  .break-words {\n    overflow-wrap: break-word;\n  }\n\n  .whitespace-nowrap {\n    white-space: nowrap;\n  }\n\n  .text-amber-100 {\n    color: var(--color-amber-100);\n  }\n\n  .text-amber-200 {\n    color: var(--color-amber-200);\n  }\n\n  .text-amber-200\\/78 {\n    color: #fee685c7;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-amber-200\\/78 {\n      color: color-mix(in oklab, var(--color-amber-200) 78%, transparent);\n    }\n  }\n\n  .text-blue-300 {\n    color: var(--color-blue-300);\n  }\n\n  .text-blue-300\\/70 {\n    color: #90c5ffb3;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-blue-300\\/70 {\n      color: color-mix(in oklab, var(--color-blue-300) 70%, transparent);\n    }\n  }\n\n  .text-current {\n    color: currentColor;\n  }\n\n  .text-cyan-100 {\n    color: var(--color-cyan-100);\n  }\n\n  .text-cyan-100\\/58 {\n    color: #cefafe94;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-cyan-100\\/58 {\n      color: color-mix(in oklab, var(--color-cyan-100) 58%, transparent);\n    }\n  }\n\n  .text-cyan-100\\/75 {\n    color: #cefafebf;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-cyan-100\\/75 {\n      color: color-mix(in oklab, var(--color-cyan-100) 75%, transparent);\n    }\n  }\n\n  .text-cyan-100\\/88 {\n    color: #cefafee0;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-cyan-100\\/88 {\n      color: color-mix(in oklab, var(--color-cyan-100) 88%, transparent);\n    }\n  }\n\n  .text-cyan-200 {\n    color: var(--color-cyan-200);\n  }\n\n  .text-cyan-200\\/70 {\n    color: #a2f4fdb3;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-cyan-200\\/70 {\n      color: color-mix(in oklab, var(--color-cyan-200) 70%, transparent);\n    }\n  }\n\n  .text-cyan-200\\/80 {\n    color: #a2f4fdcc;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-cyan-200\\/80 {\n      color: color-mix(in oklab, var(--color-cyan-200) 80%, transparent);\n    }\n  }\n\n  .text-cyan-300 {\n    color: var(--color-cyan-300);\n  }\n\n  .text-emerald-100 {\n    color: var(--color-emerald-100);\n  }\n\n  .text-emerald-300 {\n    color: var(--color-emerald-300);\n  }\n\n  .text-fuchsia-100 {\n    color: var(--color-fuchsia-100);\n  }\n\n  .text-fuchsia-100\\/90 {\n    color: #fae8ffe6;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-fuchsia-100\\/90 {\n      color: color-mix(in oklab, var(--color-fuchsia-100) 90%, transparent);\n    }\n  }\n\n  .text-fuchsia-200 {\n    color: var(--color-fuchsia-200);\n  }\n\n  .text-fuchsia-200\\/80 {\n    color: #f6cfffcc;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-fuchsia-200\\/80 {\n      color: color-mix(in oklab, var(--color-fuchsia-200) 80%, transparent);\n    }\n  }\n\n  .text-rose-200 {\n    color: var(--color-rose-200);\n  }\n\n  .text-rose-200\\/70 {\n    color: #ffccd3b3;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-rose-200\\/70 {\n      color: color-mix(in oklab, var(--color-rose-200) 70%, transparent);\n    }\n  }\n\n  .text-rose-200\\/88 {\n    color: #ffccd3e0;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-rose-200\\/88 {\n      color: color-mix(in oklab, var(--color-rose-200) 88%, transparent);\n    }\n  }\n\n  .text-sky-100 {\n    color: var(--color-sky-100);\n  }\n\n  .text-sky-300 {\n    color: var(--color-sky-300);\n  }\n\n  .text-slate-50 {\n    color: var(--color-slate-50);\n  }\n\n  .text-slate-100 {\n    color: var(--color-slate-100);\n  }\n\n  .text-slate-100\\/88 {\n    color: #f1f5f9e0;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-100\\/88 {\n      color: color-mix(in oklab, var(--color-slate-100) 88%, transparent);\n    }\n  }\n\n  .text-slate-200 {\n    color: var(--color-slate-200);\n  }\n\n  .text-slate-200\\/70 {\n    color: #e2e8f0b3;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-200\\/70 {\n      color: color-mix(in oklab, var(--color-slate-200) 70%, transparent);\n    }\n  }\n\n  .text-slate-200\\/78 {\n    color: #e2e8f0c7;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-200\\/78 {\n      color: color-mix(in oklab, var(--color-slate-200) 78%, transparent);\n    }\n  }\n\n  .text-slate-200\\/80 {\n    color: #e2e8f0cc;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-200\\/80 {\n      color: color-mix(in oklab, var(--color-slate-200) 80%, transparent);\n    }\n  }\n\n  .text-slate-300 {\n    color: var(--color-slate-300);\n  }\n\n  .text-slate-300\\/55 {\n    color: #cad5e28c;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/55 {\n      color: color-mix(in oklab, var(--color-slate-300) 55%, transparent);\n    }\n  }\n\n  .text-slate-300\\/60 {\n    color: #cad5e299;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/60 {\n      color: color-mix(in oklab, var(--color-slate-300) 60%, transparent);\n    }\n  }\n\n  .text-slate-300\\/62 {\n    color: #cad5e29e;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/62 {\n      color: color-mix(in oklab, var(--color-slate-300) 62%, transparent);\n    }\n  }\n\n  .text-slate-300\\/65 {\n    color: #cad5e2a6;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/65 {\n      color: color-mix(in oklab, var(--color-slate-300) 65%, transparent);\n    }\n  }\n\n  .text-slate-300\\/70 {\n    color: #cad5e2b3;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/70 {\n      color: color-mix(in oklab, var(--color-slate-300) 70%, transparent);\n    }\n  }\n\n  .text-slate-300\\/72 {\n    color: #cad5e2b8;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/72 {\n      color: color-mix(in oklab, var(--color-slate-300) 72%, transparent);\n    }\n  }\n\n  .text-slate-300\\/75 {\n    color: #cad5e2bf;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-300\\/75 {\n      color: color-mix(in oklab, var(--color-slate-300) 75%, transparent);\n    }\n  }\n\n  .text-slate-400 {\n    color: var(--color-slate-400);\n  }\n\n  .text-slate-400\\/74 {\n    color: #90a1b9bd;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-400\\/74 {\n      color: color-mix(in oklab, var(--color-slate-400) 74%, transparent);\n    }\n  }\n\n  .text-slate-400\\/80 {\n    color: #90a1b9cc;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-400\\/80 {\n      color: color-mix(in oklab, var(--color-slate-400) 80%, transparent);\n    }\n  }\n\n  .text-slate-400\\/85 {\n    color: #90a1b9d9;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .text-slate-400\\/85 {\n      color: color-mix(in oklab, var(--color-slate-400) 85%, transparent);\n    }\n  }\n\n  .text-white {\n    color: var(--color-white);\n  }\n\n  .lowercase {\n    text-transform: lowercase;\n  }\n\n  .uppercase {\n    text-transform: uppercase;\n  }\n\n  .ordinal {\n    --tw-ordinal: ordinal;\n    font-variant-numeric: var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, );\n  }\n\n  .tabular-nums {\n    --tw-numeric-spacing: tabular-nums;\n    font-variant-numeric: var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, );\n  }\n\n  .underline {\n    text-decoration-line: underline;\n  }\n\n  .underline-offset-4 {\n    text-underline-offset: 4px;\n  }\n\n  .antialiased {\n    -webkit-font-smoothing: antialiased;\n    -moz-osx-font-smoothing: grayscale;\n  }\n\n  .opacity-0 {\n    opacity: 0;\n  }\n\n  .opacity-40 {\n    opacity: .4;\n  }\n\n  .opacity-50 {\n    opacity: .5;\n  }\n\n  .opacity-70 {\n    opacity: .7;\n  }\n\n  .opacity-90 {\n    opacity: .9;\n  }\n\n  .shadow {\n    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_10px_28px_rgba\\(0\\,0\\,0\\,0\\.22\\)\\] {\n    --tw-shadow: 0 10px 28px var(--tw-shadow-color, #00000038);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_10px_28px_rgba\\(0\\,0\\,0\\,0\\.26\\)\\,inset_0_1px_0_rgba\\(255\\,255\\,255\\,0\\.05\\)\\] {\n    --tw-shadow: 0 10px 28px var(--tw-shadow-color, #00000042), inset 0 1px 0 var(--tw-shadow-color, #ffffff0d);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_10px_28px_rgba\\(0\\,0\\,0\\,0\\.28\\)\\] {\n    --tw-shadow: 0 10px 28px var(--tw-shadow-color, #00000047);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_12px_28px_rgba\\(0\\,0\\,0\\,0\\.32\\)\\] {\n    --tw-shadow: 0 12px 28px var(--tw-shadow-color, #00000052);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_18px_40px_rgba\\(0\\,0\\,0\\,0\\.45\\)\\] {\n    --tw-shadow: 0 18px 40px var(--tw-shadow-color, #00000073);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_18px_42px_rgba\\(3\\,6\\,18\\,0\\.45\\)\\] {\n    --tw-shadow: 0 18px 42px var(--tw-shadow-color, #03061273);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_22px_40px_rgba\\(0\\,0\\,0\\,0\\.32\\)\\] {\n    --tw-shadow: 0 22px 40px var(--tw-shadow-color, #00000052);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_26px_80px_rgba\\(0\\,0\\,0\\,0\\.48\\)\\] {\n    --tw-shadow: 0 26px 80px var(--tw-shadow-color, #0000007a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_28px_80px_rgba\\(0\\,0\\,0\\,0\\.56\\)\\] {\n    --tw-shadow: 0 28px 80px var(--tw-shadow-color, #0000008f);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[0_36px_80px_rgba\\(0\\,0\\,0\\,0\\.5\\)\\] {\n    --tw-shadow: 0 36px 80px var(--tw-shadow-color, #00000080);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[inset_0_0_0_1px_rgba\\(143\\,232\\,255\\,0\\.18\\)\\] {\n    --tw-shadow: inset 0 0 0 1px var(--tw-shadow-color, #8fe8ff2e);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[inset_0_1px_0_rgba\\(255\\,255\\,255\\,0\\.04\\)\\] {\n    --tw-shadow: inset 0 1px 0 var(--tw-shadow-color, #ffffff0a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[inset_0_1px_0_rgba\\(255\\,255\\,255\\,0\\.06\\)\\] {\n    --tw-shadow: inset 0 1px 0 var(--tw-shadow-color, #ffffff0f);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-\\[inset_0_1px_0_rgba\\(255\\,255\\,255\\,0\\.08\\)\\,inset_0_-64px_80px_rgba\\(0\\,0\\,0\\,0\\.34\\)\\] {\n    --tw-shadow: inset 0 1px 0 var(--tw-shadow-color, #ffffff14), inset 0 -64px 80px var(--tw-shadow-color, #00000057);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-lg {\n    --tw-shadow: 0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-md {\n    --tw-shadow: 0 4px 6px -1px var(--tw-shadow-color, #0000001a), 0 2px 4px -2px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-none {\n    --tw-shadow: 0 0 #0000;\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-sm {\n    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-xl {\n    --tw-shadow: 0 20px 25px -5px var(--tw-shadow-color, #0000001a), 0 8px 10px -6px var(--tw-shadow-color, #0000001a);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .shadow-xs {\n    --tw-shadow: 0 1px 2px 0 var(--tw-shadow-color, #0000000d);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .ring {\n    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .ring-0 {\n    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);\n    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);\n  }\n\n  .outline-hidden {\n    --tw-outline-style: none;\n    outline-style: none;\n  }\n\n  @media (forced-colors: active) {\n    .outline-hidden {\n      outline-offset: 2px;\n      outline: 2px solid #0000;\n    }\n  }\n\n  .outline {\n    outline-style: var(--tw-outline-style);\n    outline-width: 1px;\n  }\n\n  .blur {\n    --tw-blur: blur(8px);\n    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );\n  }\n\n  .invert {\n    --tw-invert: invert(100%);\n    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );\n  }\n\n  .filter {\n    filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );\n  }\n\n  .backdrop-blur-md {\n    --tw-backdrop-blur: blur(var(--blur-md));\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .backdrop-blur-xl {\n    --tw-backdrop-blur: blur(var(--blur-xl));\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .backdrop-filter {\n    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );\n  }\n\n  .transition {\n    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-all {\n    transition-property: all;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-colors {\n    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-opacity {\n    transition-property: opacity;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-shadow {\n    transition-property: box-shadow;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-transform {\n    transition-property: transform, translate, scale, rotate;\n    transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));\n    transition-duration: var(--tw-duration, var(--default-transition-duration));\n  }\n\n  .transition-none {\n    transition-property: none;\n  }\n\n  .duration-100 {\n    --tw-duration: .1s;\n    transition-duration: .1s;\n  }\n\n  .duration-200 {\n    --tw-duration: .2s;\n    transition-duration: .2s;\n  }\n\n  .duration-300 {\n    --tw-duration: .3s;\n    transition-duration: .3s;\n  }\n\n  .duration-1000 {\n    --tw-duration: 1s;\n    transition-duration: 1s;\n  }\n\n  .ease-in-out {\n    --tw-ease: var(--ease-in-out);\n    transition-timing-function: var(--ease-in-out);\n  }\n\n  .ease-linear {\n    --tw-ease: linear;\n    transition-timing-function: linear;\n  }\n\n  .outline-none {\n    --tw-outline-style: none;\n    outline-style: none;\n  }\n\n  .select-none {\n    -webkit-user-select: none;\n    user-select: none;\n  }\n\n  @media (hover: hover) {\n    .group-hover\\:opacity-100:is(:where(.group):hover *) {\n      opacity: 1;\n    }\n  }\n\n  .selection\\:bg-cyan-300\\/25 ::selection {\n    background-color: #53eafd40;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .selection\\:bg-cyan-300\\/25 ::selection {\n      background-color: color-mix(in oklab, var(--color-cyan-300) 25%, transparent);\n    }\n  }\n\n  .selection\\:bg-cyan-300\\/25::selection {\n    background-color: #53eafd40;\n  }\n\n  @supports (color: color-mix(in lab, red, red)) {\n    .selection\\:bg-cyan-300\\/25::selection {\n      background-color: color-mix(in oklab, var(--color-cyan-300) 25%, transparent);\n    }\n  }\n\n  @media (hover: hover) {\n    .hover\\:border-amber-200\\/30:hover {\n      border-color: #fee6854d;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:border-amber-200\\/30:hover {\n        border-color: color-mix(in oklab, var(--color-amber-200) 30%, transparent);\n      }\n    }\n\n    .hover\\:border-cyan-200\\/25:hover {\n      border-color: #a2f4fd40;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:border-cyan-200\\/25:hover {\n        border-color: color-mix(in oklab, var(--color-cyan-200) 25%, transparent);\n      }\n    }\n\n    .hover\\:border-cyan-200\\/30:hover {\n      border-color: #a2f4fd4d;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:border-cyan-200\\/30:hover {\n        border-color: color-mix(in oklab, var(--color-cyan-200) 30%, transparent);\n      }\n    }\n\n    .hover\\:border-white\\/12:hover {\n      border-color: #ffffff1f;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:border-white\\/12:hover {\n        border-color: color-mix(in oklab, var(--color-white) 12%, transparent);\n      }\n    }\n\n    .hover\\:border-white\\/18:hover {\n      border-color: #ffffff2e;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:border-white\\/18:hover {\n        border-color: color-mix(in oklab, var(--color-white) 18%, transparent);\n      }\n    }\n\n    .hover\\:bg-black\\/24:hover {\n      background-color: #0000003d;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:bg-black\\/24:hover {\n        background-color: color-mix(in oklab, var(--color-black) 24%, transparent);\n      }\n    }\n\n    .hover\\:bg-white\\/\\[0\\.04\\]:hover {\n      background-color: #ffffff0a;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:bg-white\\/\\[0\\.04\\]:hover {\n        background-color: color-mix(in oklab, var(--color-white) 4%, transparent);\n      }\n    }\n\n    .hover\\:bg-white\\/\\[0\\.05\\]:hover {\n      background-color: #ffffff0d;\n    }\n\n    @supports (color: color-mix(in lab, red, red)) {\n      .hover\\:bg-white\\/\\[0\\.05\\]:hover {\n        background-color: color-mix(in oklab, var(--color-white) 5%, transparent);\n      }\n    }\n\n    .hover\\:text-cyan-100:hover {\n      color: var(--color-cyan-100);\n    }\n\n    .hover\\:text-slate-100:hover {\n      color: var(--color-slate-100);\n    }\n  }\n\n  .focus\\:text-amber-200:focus {\n    color: var(--color-amber-200);\n  }\n\n  .focus-visible\\:opacity-100:focus-visible {\n    opacity: 1;\n  }\n\n  .active\\:cursor-grabbing:active {\n    cursor: grabbing;\n  }\n\n  .disabled\\:opacity-35:disabled {\n    opacity: .35;\n  }\n\n  .disabled\\:opacity-40:disabled {\n    opacity: .4;\n  }\n\n  @media (min-width: 40rem) {\n    .sm\\:block {\n      display: block;\n    }\n\n    .sm\\:inline {\n      display: inline;\n    }\n  }\n\n  @media (min-width: 48rem) {\n    .md\\:grid-cols-2 {\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n    }\n  }\n\n  @media (min-width: 80rem) {\n    .xl\\:grid-cols-\\[minmax\\(0\\,1\\.5fr\\)_340px\\] {\n      grid-template-columns: minmax(0, 1.5fr) 340px;\n    }\n  }\n}\n\n:host {\n  box-sizing: border-box;\n  overscroll-behavior: none;\n  color: #eef2f5;\n  color-scheme: dark;\n  --cosimo-ios-top-inset: 0px;\n  --cosimo-ios-right-inset: 0px;\n  --cosimo-ios-bottom-inset: 0px;\n  --cosimo-ios-left-inset: 0px;\n  --cosimo-ios-safe-top: calc(env(safe-area-inset-top) + var(--cosimo-ios-top-inset));\n  --cosimo-ios-safe-right: calc(env(safe-area-inset-right) + var(--cosimo-ios-right-inset));\n  --cosimo-ios-safe-bottom: calc(env(safe-area-inset-bottom) + var(--cosimo-ios-bottom-inset));\n  --cosimo-ios-safe-left: calc(env(safe-area-inset-left) + var(--cosimo-ios-left-inset));\n  --cosimo-stage-min-height: 248px;\n  --cosimo-keyboard-height: 94px;\n  --cosimo-control-height: 54px;\n  background: #04070f;\n  width: 100%;\n  height: 100%;\n  min-height: 100dvh;\n  font-family: SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, Avenir Next, sans-serif;\n  display: block;\n  overflow-x: hidden;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbutton, input, select {\n  font: inherit;\n}\n\n.cosimo-mod-amount-field {\n  justify-content: flex-end;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n  display: flex;\n}\n\n.cosimo-mod-direction-toggle {\n  background: #ffffff0a;\n  border: 1px solid #ffffff1a;\n  border-radius: 16px;\n  gap: 4px;\n  padding: 4px;\n  display: grid;\n}\n\n.cosimo-mod-direction-button {\n  color: #e2e8f0b8;\n  background: none;\n  border: 0;\n  border-radius: 11px;\n  width: 26px;\n  height: 26px;\n  font-size: 14px;\n  font-weight: 700;\n  line-height: 1;\n}\n\n.cosimo-mod-direction-button[data-active="true"] {\n  color: #cffafe;\n  background: #67e8f92e;\n}\n\n.cosimo-mod-knob {\n  flex: none;\n  width: 66px;\n  height: 66px;\n  position: relative;\n}\n\n.cosimo-mod-knob-stack {\n  justify-items: center;\n  gap: 4px;\n  min-width: 0;\n  display: grid;\n}\n\n.cosimo-mod-knob-track {\n  border: 1px solid #ffffff14;\n  border-radius: 999px;\n  width: 100%;\n  height: 100%;\n  position: relative;\n  box-shadow: inset 0 1px #ffffff14, 0 10px 20px #00000038;\n}\n\n.cosimo-mod-knob-arc {\n  pointer-events: none;\n  width: 100%;\n  height: 100%;\n  position: absolute;\n  inset: 0;\n  overflow: visible;\n}\n\n.cosimo-mod-knob-arc-track {\n  fill: none;\n  stroke: #ffffff1a;\n  stroke-width: 4px;\n  stroke-linecap: round;\n}\n\n.cosimo-mod-knob-arc-fill {\n  fill: none;\n  stroke: #67e8f9eb;\n  stroke-width: 4px;\n  stroke-linecap: round;\n  filter: drop-shadow(0 0 8px #67e8f947);\n}\n\n.cosimo-mod-knob-core {\n  color: #cffafe;\n  background: radial-gradient(circle at 35% 28%, #ffffff1a, #0000 38%), linear-gradient(#0c1222fa, #060914fa);\n  border-radius: 999px;\n  place-items: center;\n  display: grid;\n  position: absolute;\n  inset: 9px;\n}\n\n.cosimo-mod-knob-percent {\n  letter-spacing: .12em;\n  text-transform: uppercase;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n  font-size: 10px;\n  font-weight: 700;\n}\n\n.cosimo-mod-knob-indicator {\n  transform-origin: 50% 26px;\n  pointer-events: none;\n  background: linear-gradient(#fef3c7 0%, #f472b6 100%);\n  border-radius: 999px;\n  width: 3px;\n  height: 19px;\n  position: absolute;\n  top: 7px;\n  left: 50%;\n  box-shadow: 0 0 12px #f472b65c;\n}\n\n.cosimo-mod-knob-center-marker {\n  pointer-events: none;\n  background: #fff6;\n  border-radius: 999px;\n  width: 2px;\n  height: 9px;\n  position: absolute;\n  top: 3px;\n  left: 50%;\n  transform: translateX(-50%);\n}\n\n.cosimo-mod-knob[data-polarity="bipolar"] .cosimo-mod-knob-center-marker {\n  background: #e2e8f0d6;\n  box-shadow: 0 0 8px #e2e8f03d;\n}\n\n.cosimo-mod-knob-input {\n  opacity: 0;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  position: absolute;\n  inset: 0;\n}\n\n.cosimo-mod-amount-copy {\n  gap: 2px;\n  min-width: 0;\n  display: grid;\n}\n\n.cosimo-mod-amount-readout {\n  letter-spacing: .08em;\n  color: #e2e8f0;\n  white-space: nowrap;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n  font-size: 11px;\n  font-weight: 600;\n}\n\n.cosimo-mod-amount-caption {\n  letter-spacing: .18em;\n  text-transform: uppercase;\n  color: #94a3b8bd;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n  font-size: 9px;\n}\n\n.ios-shell {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  min-height: 100dvh;\n  padding: var(--cosimo-ios-safe-top) var(--cosimo-ios-safe-right) var(--cosimo-ios-safe-bottom) var(--cosimo-ios-safe-left);\n  grid-template-rows: minmax(0, 1fr) auto;\n  min-width: 0;\n  display: grid;\n}\n\n.ios-top-row {\n  grid-template-rows: minmax(0, 1fr);\n  grid-template-columns: minmax(0, 1fr);\n  min-height: 0;\n  display: grid;\n  position: relative;\n  overflow: hidden;\n}\n\n.ios-main-view {\n  grid-area: 1 / 1;\n  min-height: 0;\n  display: grid;\n}\n\n.ios-main-view[data-hidden="true"] {\n  visibility: hidden;\n  pointer-events: none;\n}\n\n.ios-scroll {\n  overscroll-behavior: contain;\n  -webkit-overflow-scrolling: touch;\n  height: 100%;\n  min-height: 0;\n  overflow-y: auto;\n}\n\n.ios-content {\n  align-content: start;\n  gap: 16px;\n  min-width: 0;\n  padding: 0 16px;\n  display: grid;\n}\n\n.wavetable-panel, .play-panel, .mseg-shell, .keyboard-footer {\n  min-width: 0;\n}\n\n.section-label, .display-status, .bank-readout, .mini-label, .octave-readout, .glide-time-readout, .mseg-depth-readout, .mseg-rate-readout, .mseg-launcher-rate-readout {\n  letter-spacing: .16em;\n  text-transform: uppercase;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n}\n\n.wavetable-stage {\n  width: 100%;\n  min-width: 0;\n  max-width: 100%;\n  min-height: var(--cosimo-stage-min-height);\n  aspect-ratio: 1.55;\n  touch-action: none;\n  background: none;\n  position: relative;\n  overflow: hidden;\n}\n\n.wavetable-stage:before {\n  content: "";\n  opacity: .24;\n  pointer-events: none;\n  background-color: #0000;\n  background-image: linear-gradient(#ffffff07 1px, #0000 1px), linear-gradient(90deg, #ffffff07 1px, #0000 1px);\n  background-position: 0 0, 0 0;\n  background-repeat: repeat, repeat;\n  background-size: 28px 28px;\n  background-attachment: scroll, scroll;\n  background-origin: padding-box, padding-box;\n  background-clip: border-box, border-box;\n  position: absolute;\n  inset: 0;\n}\n\n.wavetable-display-stack {\n  position: absolute;\n  inset: 0;\n}\n\n.wavetable-layer {\n  will-change: transform;\n  position: absolute;\n  inset: 0;\n}\n\n.display-overlay {\n  text-align: center;\n  color: #ffd8acdb;\n  -webkit-backdrop-filter: blur(4px);\n  backdrop-filter: blur(4px);\n  background: #040712d1;\n  place-items: center;\n  padding: 20px;\n  font-size: 13px;\n  display: grid;\n  position: absolute;\n  inset: 0;\n}\n\n.display-overlay[hidden] {\n  display: none;\n}\n\n.stage-copy {\n  pointer-events: none;\n  grid-template-rows: auto 1fr auto;\n  gap: 8px;\n  padding: 12px;\n  display: grid;\n  position: absolute;\n  inset: 0;\n}\n\n.stage-copy-row {\n  pointer-events: auto;\n  justify-content: space-between;\n  align-items: center;\n  gap: 8px;\n  display: flex;\n}\n\n.stage-copy-row:last-child {\n  align-items: end;\n}\n\n.mini-label {\n  color: #d4dce657;\n  font-size: 10px;\n}\n\n.mini-label.active {\n  color: #87d7f5;\n}\n\n.mini-label.warm {\n  color: #f2b86b;\n}\n\n.display-status, .bank-readout {\n  color: #d4dce66b;\n  font-size: 10px;\n}\n\n.display-status {\n  background: #ffffff0a;\n  border-radius: 999px;\n  justify-self: start;\n  padding: 6px 10px;\n}\n\n.shape-readout {\n  letter-spacing: -.03em;\n  color: #87d7f5;\n  font-family: SF Pro Display, SF Pro Text, -apple-system, BlinkMacSystemFont, sans-serif;\n  font-size: 12px;\n  font-weight: 600;\n}\n\n.bank-picker-trigger {\n  pointer-events: auto;\n  align-items: end;\n  min-width: 0;\n  max-width: min(72%, 260px);\n  display: inline-flex;\n  position: relative;\n}\n\n.table-select-overlay {\n  opacity: .001;\n  appearance: none;\n  color: #0000;\n  cursor: pointer;\n  background: none;\n  border: 0;\n  width: calc(100% + 20px);\n  min-height: 40px;\n  font-size: 16px;\n  position: absolute;\n  inset: -8px -10px;\n}\n\n.bank-readout {\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  min-width: 0;\n  overflow: hidden;\n}\n\n.table-retry-button {\n  color: #ffd8e8;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  pointer-events: auto;\n  background: #f56cb614;\n  border: 1px solid #f56cb647;\n  border-radius: 999px;\n  padding: 6px 10px;\n  font-size: 10px;\n}\n\n.table-retry-button[hidden] {\n  display: none;\n}\n\n.table-error-banner {\n  color: #ffd8e8;\n  background: #f56cb61f;\n  border: 1px solid #f56cb63d;\n  border-radius: 14px;\n  min-width: 0;\n  padding: 10px 12px;\n  font-size: 12px;\n  line-height: 1.35;\n  display: block;\n}\n\n.table-error-banner[hidden] {\n  display: none;\n}\n\n.play-grid {\n  grid-template-columns: minmax(132px, 160px) minmax(0, 1fr);\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n  display: grid;\n}\n\n.play-field {\n  min-width: 0;\n  display: grid;\n}\n\n.play-select {\n  color: #eef2f5;\n  background: #ffffff0a;\n  border: 1px solid #ffffff1a;\n  border-radius: 12px;\n  width: 100%;\n  min-height: 36px;\n  padding: 8px 10px;\n  font-size: 13px;\n}\n\n.glide-field-body {\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 10px;\n  display: grid;\n}\n\n.glide-time-slider {\n  width: 100%;\n}\n\n.glide-time-readout, .mseg-depth-readout, .mseg-rate-readout, .mseg-launcher-rate-readout {\n  color: #87d7f5;\n  letter-spacing: .08em;\n  white-space: nowrap;\n  font-size: 12px;\n}\n\n.mseg-shell {\n  gap: 10px;\n  display: grid;\n}\n\n.mseg-launcher {\n  gap: 12px;\n  display: grid;\n}\n\n.mseg-launcher-head {\n  justify-content: space-between;\n  align-items: end;\n  gap: 12px;\n  display: flex;\n}\n\n.mseg-launcher-copy, .mseg-modal-copy {\n  gap: 4px;\n  min-width: 0;\n  display: grid;\n}\n\n.mseg-eyebrow {\n  letter-spacing: .16em;\n  text-transform: uppercase;\n  color: #d4dce657;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n  font-size: 10px;\n}\n\n.mseg-route-title {\n  color: #eef2f5;\n  letter-spacing: -.03em;\n  font-size: 15px;\n  font-weight: 600;\n}\n\n.mseg-preview-button {\n  appearance: none;\n  text-align: left;\n  background: none;\n  border: 0;\n  width: 100%;\n  padding: 0;\n  display: block;\n}\n\n.mseg-preview-shell {\n  height: 128px;\n  min-height: 128px;\n}\n\n.mseg-preview-footer {\n  justify-content: space-between;\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.mseg-controls {\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 10px;\n  display: grid;\n}\n\n.mseg-depth {\n  gap: 8px;\n  display: grid;\n}\n\n.mseg-depth-label {\n  letter-spacing: .16em;\n  text-transform: uppercase;\n  color: #d4dce657;\n  font-family: SF Mono, IBM Plex Mono, Menlo, monospace;\n  font-size: 10px;\n}\n\n.mseg-depth-slider, .mseg-rate-slider {\n  width: 100%;\n}\n\n.mseg-modal-layer {\n  pointer-events: none;\n  grid-area: 1 / 1;\n  min-height: 0;\n  padding: 0;\n  position: relative;\n  inset: auto;\n}\n\n.mseg-modal-layer[data-open="true"] {\n  pointer-events: auto;\n}\n\n.mseg-modal-backdrop {\n  display: none;\n}\n\n.mseg-modal {\n  grid-template-rows: auto minmax(0, 1fr) auto;\n  gap: 4px;\n  min-height: 100%;\n  padding: 0 8px;\n  display: grid;\n  position: relative;\n}\n\n.mseg-modal-copy {\n  display: none;\n}\n\n.mseg-modal-head {\n  justify-content: end;\n  align-items: start;\n  min-height: 24px;\n  padding: 0;\n  display: flex;\n}\n\n.mseg-modal-close {\n  appearance: none;\n  color: #eef2f5;\n  letter-spacing: 0;\n  text-transform: none;\n  background: none;\n  border: 0;\n  border-radius: 0;\n  justify-content: center;\n  align-items: center;\n  width: 28px;\n  min-width: 28px;\n  height: 24px;\n  min-height: 24px;\n  padding: 0;\n  font-size: 15px;\n  font-weight: 600;\n  line-height: 1;\n  display: inline-flex;\n}\n\n.mseg-modal-stage {\n  min-height: 0;\n  padding-top: 3px;\n}\n\n.mseg-modal-editor-shell {\n  height: 100%;\n  min-height: 0;\n}\n\n.mseg-modal-surface {\n  touch-action: none;\n  width: 100%;\n  height: 100%;\n  min-height: 148px;\n  display: block;\n}\n\n.mseg-modal-footer {\n  grid-template-columns: minmax(0, 1fr) auto auto;\n  align-items: center;\n  gap: 12px;\n  display: grid;\n}\n\n.mseg-rate {\n  gap: 8px;\n  display: grid;\n}\n\n.mseg-modal-footer-actions {\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.mseg-loop-button {\n  color: #87d7f5;\n  background: none;\n  border: 0;\n  border-radius: 999px;\n  min-width: 36px;\n  min-height: 36px;\n  padding: 0;\n}\n\n.mseg-loop-button svg {\n  fill: currentColor;\n  width: 20px;\n  height: 20px;\n}\n\n.keyboard-footer {\n  z-index: 1;\n  background: #04070f;\n  gap: 0;\n  padding: 0 12px;\n  display: grid;\n  position: relative;\n}\n\n.keyboard-toolbar {\n  justify-content: center;\n  align-items: center;\n  display: flex;\n}\n\n.octave-controls {\n  grid-template-columns: auto auto auto;\n  align-items: center;\n  gap: 8px;\n  display: inline-grid;\n}\n\n.octave-button {\n  color: #eef2f5;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  background: #ffffff0a;\n  border: 1px solid #ffffff1a;\n  border-radius: 999px;\n  min-width: 72px;\n  min-height: 34px;\n  font-size: 12px;\n}\n\n.octave-button:disabled {\n  opacity: .32;\n}\n\n.octave-readout {\n  text-align: center;\n  color: #87d7f5;\n  min-width: 88px;\n  font-size: 12px;\n}\n\n.keyboard-host {\n  min-width: 0;\n  min-height: var(--cosimo-keyboard-height);\n  align-items: stretch;\n  display: grid;\n}\n\n.keyboard {\n  width: 100%;\n  height: var(--cosimo-keyboard-height);\n  touch-action: none;\n  background: linear-gradient(#ffffff06, #0000 18%), linear-gradient(#0a0d12ad, #07090deb);\n  border-radius: 14px 14px 0 0;\n  padding: 6px 6px 0;\n  overflow: hidden;\n}\n\n.cosimo-grid-line {\n  stroke: #ffffff14;\n  stroke-width: 1px;\n}\n\n.cosimo-curve-fill {\n  fill: #87d7f514;\n}\n\n.cosimo-curve-line {\n  fill: none;\n  stroke: #87d7f5;\n  stroke-width: 3px;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.cosimo-curve-fill-muted {\n  fill: #e1e7f00a;\n}\n\n.cosimo-curve-line-muted {\n  stroke: #e1e7f061;\n}\n\n.cosimo-curve-line-highlight {\n  stroke: #32f0bc;\n}\n\n.cosimo-mseg-point-default {\n  fill: #87d7f5;\n  stroke: #050913;\n  stroke-width: 2px;\n}\n\n.cosimo-mseg-point-selected {\n  fill: #f5d0fe;\n  stroke: #050913;\n  stroke-width: 3px;\n}\n\n.cosimo-mseg-point-highlight {\n  fill: #32f0bc;\n  stroke: #050913;\n  stroke-width: 2px;\n}\n\n.cosimo-mseg-point-muted {\n  fill: #e1e7f0c7;\n  stroke: #050913;\n  stroke-width: 2px;\n  opacity: .62;\n}\n\n@media (max-height: 720px) {\n  .ios-content {\n    gap: 14px;\n  }\n\n  .mseg-preview-shell, .mseg-modal-surface {\n    height: 136px;\n    min-height: 136px;\n  }\n}\n\n@property --tw-translate-x {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-translate-y {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-translate-z {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-rotate-x {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-rotate-y {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-rotate-z {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-skew-x {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-skew-y {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-space-y-reverse {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-space-x-reverse {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-border-style {\n  syntax: "*";\n  inherits: false;\n  initial-value: solid;\n}\n\n@property --tw-leading {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-font-weight {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-tracking {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ordinal {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-slashed-zero {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-numeric-figure {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-numeric-spacing {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-numeric-fraction {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-inset-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-inset-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-inset-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-ring-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ring-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-inset-ring-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-inset-ring-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-ring-inset {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ring-offset-width {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0;\n}\n\n@property --tw-ring-offset-color {\n  syntax: "*";\n  inherits: false;\n  initial-value: #fff;\n}\n\n@property --tw-ring-offset-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}\n\n@property --tw-outline-style {\n  syntax: "*";\n  inherits: false;\n  initial-value: solid;\n}\n\n@property --tw-blur {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-brightness {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-contrast {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-grayscale {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-hue-rotate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-invert {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-opacity {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-saturate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-sepia {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow-color {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-drop-shadow-alpha {\n  syntax: "<percentage>";\n  inherits: false;\n  initial-value: 100%;\n}\n\n@property --tw-drop-shadow-size {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-blur {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-brightness {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-contrast {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-grayscale {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-hue-rotate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-invert {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-opacity {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-saturate {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-backdrop-sepia {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-duration {\n  syntax: "*";\n  inherits: false\n}\n\n@property --tw-ease {\n  syntax: "*";\n  inherits: false\n}\n\n@keyframes spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes pulse {\n  50% {\n    opacity: .5;\n  }\n}\n';
function assert$1(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function readAscii(view, offset, length) {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}
function isAbsoluteURL(value) {
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}
function encodeTextPayload(text) {
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text);
  }
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}
function describePayload(payload) {
  if (payload === null) {
    return "null";
  }
  if (payload === void 0) {
    return "undefined";
  }
  const type = typeof payload;
  const constructorName = payload?.constructor?.name;
  if (type !== "object") {
    return constructorName ? `${type}:${constructorName}` : type;
  }
  const keys = Object.keys(payload).slice(0, 6);
  const keySummary = keys.length > 0 ? ` keys=${keys.join(",")}` : "";
  return constructorName ? `${type}:${constructorName}${keySummary}` : `${type}${keySummary}`;
}
function getDefaultPatchRootUrl() {
  const locationHref = globalThis.location?.href;
  if (typeof locationHref === "string" && locationHref.length > 0) {
    return new URL("/", locationHref);
  }
  const moduleUrl = new URL(import.meta.url);
  const modulePath = moduleUrl.pathname;
  if (modulePath.includes("/patch_gui/desktop/")) {
    moduleUrl.pathname = modulePath.replace(/\/patch_gui\/desktop\/[^/]+$/, "/");
    return moduleUrl;
  }
  if (modulePath.includes("/patch_gui/")) {
    moduleUrl.pathname = modulePath.replace(/\/patch_gui\/[^/]+$/, "/");
    return moduleUrl;
  }
  if (modulePath.includes("/ui/shared/")) {
    moduleUrl.pathname = modulePath.replace(/\/ui\/shared\/[^/]+$/, "/");
    return moduleUrl;
  }
  moduleUrl.pathname = modulePath.replace(/\/[^/]+$/, "/");
  return moduleUrl;
}
function resourceAddressToUrl(path, resourceAddress) {
  const patchRootUrl = getDefaultPatchRootUrl();
  if (resourceAddress instanceof URL) {
    return resourceAddress;
  }
  if (typeof resourceAddress === "string" && resourceAddress.length > 0) {
    if (isAbsoluteURL(resourceAddress)) {
      return new URL(resourceAddress);
    }
    const normalizedPath = resourceAddress.startsWith("/") ? resourceAddress.slice(1) : resourceAddress;
    return new URL(normalizedPath, patchRootUrl);
  }
  return new URL(path, patchRootUrl);
}
async function decodeTextPayload(payload) {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload.text === "function") {
    return payload.text();
  }
  if (payload instanceof ArrayBuffer) {
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(new Uint8Array(payload));
    }
    return String.fromCharCode(...new Uint8Array(payload));
  }
  if (ArrayBuffer.isView(payload)) {
    const bytes = new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(bytes);
    }
    return String.fromCharCode(...bytes);
  }
  if (Array.isArray(payload)) {
    const bytes = Uint8Array.from(payload);
    if (typeof TextDecoder === "function") {
      return new TextDecoder().decode(bytes);
    }
    return String.fromCharCode(...bytes);
  }
  throw new Error(`Unsupported text resource payload (${describePayload(payload)})`);
}
function normalizeBytesPayload(payload) {
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload.slice(0));
  }
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
  }
  if (Array.isArray(payload)) {
    return Uint8Array.from(payload);
  }
  if (typeof payload === "string") {
    return encodeTextPayload(payload);
  }
  throw new Error(`Unsupported binary resource payload (${describePayload(payload)})`);
}
function normalizeDecodedAudioFileSamples(audioFile) {
  const frames = audioFile?.frames;
  assert$1(
    Array.isArray(frames) || ArrayBuffer.isView(frames),
    "Decoded audio data must provide a frames array"
  );
  const frameArray = Array.from(frames);
  const samples = new Float32Array(frameArray.length);
  for (let index = 0; index < frameArray.length; index += 1) {
    const frame = frameArray[index];
    if (typeof frame === "number") {
      samples[index] = frame;
      continue;
    }
    if (ArrayBuffer.isView(frame) || Array.isArray(frame)) {
      const monoFrame = frame;
      assert$1(monoFrame.length === 1, "Only mono wavetable source files are supported");
      samples[index] = Number(monoFrame[0]) || 0;
      continue;
    }
    throw new Error("Decoded audio frames must contain numeric mono samples");
  }
  return {
    sampleRate: Number(audioFile?.sampleRate) || 0,
    samples
  };
}
function parseWaveFile(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  assert$1(readAscii(view, 0, 4) === "RIFF", "Expected a RIFF wave file");
  assert$1(readAscii(view, 8, 4) === "WAVE", "Expected a WAVE file");
  let format = null;
  let channelCount = null;
  let sampleRate = null;
  let bitsPerSample = null;
  let blockAlign = null;
  let dataOffset = null;
  let dataSize = null;
  let cursor = 12;
  while (cursor + 8 <= view.byteLength) {
    const chunkID = readAscii(view, cursor, 4);
    const chunkSize = view.getUint32(cursor + 4, true);
    const chunkDataOffset = cursor + 8;
    if (chunkID === "fmt ") {
      format = view.getUint16(chunkDataOffset, true);
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      blockAlign = view.getUint16(chunkDataOffset + 12, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkID === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }
    cursor = chunkDataOffset + chunkSize + chunkSize % 2;
  }
  assert$1(format !== null, "Wave file is missing a fmt chunk");
  assert$1(dataOffset !== null && dataSize !== null, "Wave file is missing a data chunk");
  assert$1(channelCount === 1, "Only mono wavetable bank files are supported");
  let samples;
  if (format === 3 && bitsPerSample === 32) {
    samples = new Float32Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
  } else if (format === 1 && bitsPerSample === 16) {
    const sampleCount = dataSize / 2;
    const pcm = new Int16Array(arrayBuffer.slice(dataOffset, dataOffset + dataSize));
    samples = new Float32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      samples[index] = pcm[index] / 32768;
    }
  } else {
    throw new Error(`Unsupported WAV format: format=${format}, bitsPerSample=${bitsPerSample}`);
  }
  return {
    format,
    channelCount,
    sampleRate: sampleRate ?? 0,
    bitsPerSample,
    blockAlign: blockAlign ?? 0,
    samples
  };
}
async function fetchArrayBuffer(url) {
  assert$1(typeof fetch === "function", `Could not fetch ${url}: global fetch is unavailable`);
  const response = await fetch(url.toString());
  assert$1(response.ok, `Failed to fetch resource from ${url}`);
  return response.arrayBuffer();
}
function readTextFromBytes(bytes) {
  if (typeof TextDecoder === "function") {
    return new TextDecoder().decode(bytes);
  }
  return String.fromCharCode(...bytes);
}
function readAudioFromBytes(bytes) {
  const arrayBuffer = new Uint8Array(bytes).buffer;
  const parsedWave = parseWaveFile(arrayBuffer);
  return {
    sampleRate: parsedWave.sampleRate,
    samples: parsedWave.samples
  };
}
function createResourceClient(source, {
  textPreference = "bridge",
  audioPreference = "url"
} = {}) {
  const readResourcePayload = async (path) => {
    assert$1(typeof source.readResource === "function", `Resource bridge cannot read ${path}`);
    return source.readResource(path);
  };
  const readAudioBridge = async (path) => {
    assert$1(typeof source.readResourceAsAudioData === "function", `Audio resource bridge cannot read ${path}`);
    const audioFile = await source.readResourceAsAudioData(path);
    return normalizeDecodedAudioFileSamples(audioFile);
  };
  const getExplicitResourceAddress = (path) => {
    const resourceAddress = source.getResourceAddress?.(path);
    return resourceAddress !== null && resourceAddress !== void 0 ? resourceAddress : null;
  };
  const fetchAudioFromUrl = async (path, resourceAddress = source.getResourceAddress?.(path)) => {
    const url = resourceAddressToUrl(path, resourceAddress);
    const arrayBuffer = await fetchArrayBuffer(url);
    const parsedWave = parseWaveFile(arrayBuffer);
    return {
      sampleRate: parsedWave.sampleRate,
      samples: parsedWave.samples
    };
  };
  const fetchBytesFromUrl = async (path, resourceAddress = source.getResourceAddress?.(path)) => {
    const url = resourceAddressToUrl(path, resourceAddress);
    return new Uint8Array(await fetchArrayBuffer(url));
  };
  return {
    async readText(path) {
      if (textPreference === "bridge" && typeof source.readResource === "function") {
        return decodeTextPayload(await readResourcePayload(path));
      }
      const explicitResourceAddress = getExplicitResourceAddress(path);
      if (textPreference === "url" && explicitResourceAddress !== null) {
        return readTextFromBytes(await fetchBytesFromUrl(path, explicitResourceAddress));
      }
      if (typeof source.readResource === "function") {
        return decodeTextPayload(await readResourcePayload(path));
      }
      return readTextFromBytes(await fetchBytesFromUrl(path, explicitResourceAddress));
    },
    async readJSON(path) {
      return JSON.parse(await this.readText(path));
    },
    async readBytes(path) {
      if (typeof source.readResource === "function") {
        return normalizeBytesPayload(await readResourcePayload(path));
      }
      return fetchBytesFromUrl(path);
    },
    async readAudio(path) {
      if (audioPreference === "bridge" && typeof source.readResourceAsAudioData === "function") {
        return readAudioBridge(path);
      }
      const explicitResourceAddress = getExplicitResourceAddress(path);
      if (audioPreference === "url" && explicitResourceAddress !== null) {
        return fetchAudioFromUrl(path, explicitResourceAddress);
      }
      if (typeof source.readResourceAsAudioData === "function") {
        return readAudioBridge(path);
      }
      return readAudioFromBytes(await this.readBytes(path));
    },
    getURL(path) {
      return resourceAddressToUrl(path, source.getResourceAddress?.(path));
    }
  };
}
function createPatchConnectionResourceClient(source) {
  const normalizedSource = source ?? {};
  const prefersBridgeAudio = Boolean(normalizedSource.prefersAudioResourceReadBridge);
  return createResourceClient(normalizedSource, {
    textPreference: "bridge",
    audioPreference: prefersBridgeAudio ? "bridge" : "url"
  });
}
function createIOSResourceClient(source) {
  return createResourceClient(source ?? {}, {
    textPreference: "bridge",
    audioPreference: "url"
  });
}
function normalizeResourceClient(value) {
  const readText = typeof value.readText === "function" ? value.readText.bind(value) : null;
  const readJSON = typeof value.readJSON === "function" ? value.readJSON.bind(value) : null;
  const readBytes = typeof value.readBytes === "function" ? value.readBytes.bind(value) : null;
  const readAudio = typeof value.readAudio === "function" ? value.readAudio.bind(value) : null;
  const getURL = typeof value.getURL === "function" ? value.getURL.bind(value) : null;
  return {
    async readText(path) {
      if (readText) {
        return readText(path);
      }
      if (readJSON) {
        return JSON.stringify(await readJSON(path));
      }
      if (readBytes) {
        return readTextFromBytes(await readBytes(path));
      }
      throw new Error(`Resource client cannot read text ${path}`);
    },
    async readJSON(path) {
      if (readJSON) {
        return readJSON(path);
      }
      return JSON.parse(await this.readText(path));
    },
    async readBytes(path) {
      if (readBytes) {
        return readBytes(path);
      }
      if (readText) {
        return encodeTextPayload(await readText(path));
      }
      if (readJSON) {
        return encodeTextPayload(JSON.stringify(await readJSON(path)));
      }
      throw new Error(`Resource client cannot read bytes ${path}`);
    },
    async readAudio(path) {
      if (readAudio) {
        return readAudio(path);
      }
      return readAudioFromBytes(await this.readBytes(path));
    },
    getURL(path) {
      return getURL ? getURL(path) : null;
    }
  };
}
function isResourceClient(value) {
  return typeof value?.readText === "function" || typeof value?.readJSON === "function" || typeof value?.readBytes === "function" || typeof value?.readAudio === "function";
}
function asResourceClient(value) {
  if (isResourceClient(value)) {
    return normalizeResourceClient(value);
  }
  return createPatchConnectionResourceClient(value);
}
const PatchHostContext = reactExports.createContext(null);
function PatchConnectionProvider({
  patchConnection,
  resourceClient,
  children
}) {
  const host = reactExports.useMemo(() => ({
    patchConnection,
    resourceClient: resourceClient ?? createPatchConnectionResourceClient(patchConnection)
  }), [patchConnection, resourceClient]);
  return reactExports.createElement(PatchHostContext.Provider, { value: host }, children);
}
function usePatchHost() {
  const patchHost = reactExports.useContext(PatchHostContext);
  if (!patchHost) {
    throw new Error("PatchConnectionProvider is missing.");
  }
  return patchHost;
}
function usePatchConnection() {
  return usePatchHost().patchConnection;
}
function useResourceClient() {
  return usePatchHost().resourceClient;
}
function usePatchParameter(endpointID, initialValue = 0) {
  const patchConnection = usePatchConnection();
  const [value, setValue] = reactExports.useState(initialValue);
  reactExports.useEffect(() => {
    const listener = (nextValue) => setValue(nextValue);
    patchConnection.addParameterListener?.(endpointID, listener);
    patchConnection.requestParameterValue?.(endpointID);
    return () => {
      patchConnection.removeParameterListener?.(endpointID, listener);
    };
  }, [endpointID, patchConnection]);
  const setParameterValue = reactExports.useCallback((nextValue) => {
    patchConnection.sendEventOrValue?.(endpointID, nextValue);
    setValue(nextValue);
  }, [endpointID, patchConnection]);
  const beginGesture = reactExports.useCallback(() => {
    patchConnection.sendParameterGestureStart?.(endpointID);
  }, [endpointID, patchConnection]);
  const endGesture = reactExports.useCallback(() => {
    patchConnection.sendParameterGestureEnd?.(endpointID);
  }, [endpointID, patchConnection]);
  return reactExports.useMemo(() => ({
    value,
    setValue: setParameterValue,
    beginGesture,
    endGesture
  }), [beginGesture, endGesture, setParameterValue, value]);
}
function usePatchEndpoint(endpointID, initialValue) {
  const patchConnection = usePatchConnection();
  const [value, setValue] = reactExports.useState(initialValue);
  reactExports.useEffect(() => {
    const listener = (nextValue) => setValue(nextValue);
    patchConnection.addEndpointListener?.(endpointID, listener);
    return () => {
      patchConnection.removeEndpointListener?.(endpointID, listener);
    };
  }, [endpointID, patchConnection]);
  return value;
}
const runtimeFailurePhaseLoadSource = 1;
const runtimeFailurePhaseBuildMip = 2;
const runtimeFailurePhaseTransferMip = 3;
const runtimeFailureReasonTimeout = 2;
const runtimeFailureScopeService = 1;
const FILTER_MODE_OFF = 0;
const FILTER_MODE_PEAK = 5;
const WARP_MODE_OFF$1 = 0;
const WARP_MODE_MIRROR$1 = 4;
const FILTER_CUTOFF_MIN_HZ = 20;
const FILTER_CUTOFF_MAX_HZ = 2e4;
const FILTER_Q_MIN$1 = 0.1;
const FILTER_Q_MAX$1 = 20;
function clamp$7(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function clampFilterCutoffHz(value) {
  return clamp$7(Number(value) || 0, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ);
}
function clampFilterQ(value) {
  return clamp$7(Number(value) || 0, FILTER_Q_MIN$1, FILTER_Q_MAX$1);
}
function clampFilterMode(value) {
  return clamp$7(Math.round(Number(value) || 0), FILTER_MODE_OFF, FILTER_MODE_PEAK);
}
function clampWarpMode(value) {
  return clamp$7(Math.round(Number(value) || 0), WARP_MODE_OFF$1, WARP_MODE_MIRROR$1);
}
function clampWarpAmount(value) {
  return clamp$7(Number(value) || 0, 0, 1);
}
function clampDisplayPosition(value) {
  return clamp$7(Number(value) || 0, 0, 1);
}
function mapDisplayDragToPosition(startValue, startClientY, nextClientY, dragSpan) {
  const safeSpan = Math.max(1, Number(dragSpan) || 0);
  const delta = (Number(startClientY) || 0) - (Number(nextClientY) || 0);
  return clampDisplayPosition((Number(startValue) || 0) + delta / safeSpan);
}
function normalizeEffectiveWavetablePositionMessage(message) {
  const payload = message?.event ?? message;
  if (payload === null || payload === void 0) {
    return null;
  }
  if (typeof payload === "number") {
    return {
      voiceGeneration: 0,
      position: clampDisplayPosition(payload)
    };
  }
  const rawPosition = Number(payload.position);
  if (!Number.isFinite(rawPosition)) {
    return null;
  }
  const rawGeneration = Number(payload.voiceGeneration);
  return {
    voiceGeneration: Number.isFinite(rawGeneration) ? Math.max(0, Math.trunc(rawGeneration)) : 0,
    position: clampDisplayPosition(rawPosition)
  };
}
function selectObservedWavetablePositionState(currentState, message) {
  const previousState = currentState && typeof currentState === "object" ? {
    voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration)) ? Math.trunc(Number(currentState.voiceGeneration)) : -1,
    position: clampDisplayPosition(currentState.position)
  } : {
    voiceGeneration: -1,
    position: 0
  };
  const nextState = normalizeEffectiveWavetablePositionMessage(message);
  if (!nextState) {
    return previousState;
  }
  if (nextState.voiceGeneration < previousState.voiceGeneration) {
    return previousState;
  }
  return nextState;
}
function normalizeEffectiveFilterStateMessage(message) {
  const payload = message?.event ?? message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const rawCutoff = Number(payload.cutoffHz);
  const rawQ = Number(payload.q);
  if (!Number.isFinite(rawCutoff) || !Number.isFinite(rawQ)) {
    return null;
  }
  const rawGeneration = Number(payload.voiceGeneration);
  const rawHasActive = payload.hasActive;
  return {
    voiceGeneration: Number.isFinite(rawGeneration) ? Math.max(0, Math.trunc(rawGeneration)) : 0,
    hasActive: Boolean(rawHasActive),
    mode: clampFilterMode(payload.mode),
    cutoffHz: clampFilterCutoffHz(rawCutoff),
    q: clampFilterQ(rawQ)
  };
}
function selectObservedEffectiveFilterState(currentState, message) {
  const previousState = currentState && typeof currentState === "object" ? {
    voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration)) ? Math.trunc(Number(currentState.voiceGeneration)) : -1,
    hasActive: Boolean(currentState.hasActive),
    mode: clampFilterMode(currentState.mode),
    cutoffHz: clampFilterCutoffHz(currentState.cutoffHz),
    q: clampFilterQ(currentState.q)
  } : {
    voiceGeneration: -1,
    hasActive: false,
    mode: FILTER_MODE_OFF,
    cutoffHz: FILTER_CUTOFF_MIN_HZ,
    q: 0.707107
  };
  const nextState = normalizeEffectiveFilterStateMessage(message);
  if (!nextState) {
    return previousState;
  }
  if (nextState.voiceGeneration < previousState.voiceGeneration) {
    return previousState;
  }
  return nextState;
}
function normalizeEffectiveWarpStateMessage(message) {
  const payload = message?.event ?? message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const rawAmount = Number(payload.amount);
  if (!Number.isFinite(rawAmount)) {
    return null;
  }
  const rawGeneration = Number(payload.voiceGeneration);
  const rawHasActive = payload.hasActive;
  return {
    voiceGeneration: Number.isFinite(rawGeneration) ? Math.max(0, Math.trunc(rawGeneration)) : 0,
    hasActive: Boolean(rawHasActive),
    mode: clampWarpMode(payload.mode),
    amount: clampWarpAmount(rawAmount)
  };
}
function selectObservedEffectiveWarpState(currentState, message) {
  const previousState = currentState && typeof currentState === "object" ? {
    voiceGeneration: Number.isFinite(Number(currentState.voiceGeneration)) ? Math.trunc(Number(currentState.voiceGeneration)) : -1,
    hasActive: Boolean(currentState.hasActive),
    mode: clampWarpMode(currentState.mode),
    amount: clampWarpAmount(currentState.amount)
  } : {
    voiceGeneration: -1,
    hasActive: false,
    mode: WARP_MODE_OFF$1,
    amount: 0
  };
  const nextState = normalizeEffectiveWarpStateMessage(message);
  if (!nextState) {
    return previousState;
  }
  if (nextState.voiceGeneration < previousState.voiceGeneration) {
    return previousState;
  }
  return nextState;
}
function normalizeRuntimeTableState(message) {
  const payload = message?.event ?? message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = payload;
  return {
    desiredTableIndex: Math.max(0, Math.trunc(Number(value.desiredTableIndex) || 0)),
    desiredIntentSerial: Math.max(0, Math.trunc(Number(value.desiredIntentSerial) || 0)),
    serviceState: Math.max(0, Math.trunc(Number(value.serviceState) || 0)),
    hasActive: Boolean(value.hasActive),
    activeTableIndex: Math.max(0, Math.trunc(Number(value.activeTableIndex) || 0)),
    activeGeneration: Math.max(0, Math.trunc(Number(value.activeGeneration) || 0)),
    hasLoading: Boolean(value.hasLoading),
    loadingTableIndex: Math.max(0, Math.trunc(Number(value.loadingTableIndex) || 0)),
    loadingGeneration: Math.max(0, Math.trunc(Number(value.loadingGeneration) || 0)),
    hasFailure: Boolean(value.hasFailure),
    failedTableIndex: Math.max(0, Math.trunc(Number(value.failedTableIndex) || 0)),
    failedGeneration: Math.max(0, Math.trunc(Number(value.failedGeneration) || 0)),
    failureScope: Math.max(0, Math.trunc(Number(value.failureScope) || 0)),
    failurePhase: Math.max(0, Math.trunc(Number(value.failurePhase) || 0)),
    failureReasonCode: Math.max(0, Math.trunc(Number(value.failureReasonCode) || 0))
  };
}
function describeRuntimeTableFailure(normalized) {
  if (!normalized?.hasFailure) {
    return null;
  }
  if (normalized.failurePhase === runtimeFailurePhaseTransferMip && normalized.failureReasonCode === runtimeFailureReasonTimeout) {
    return "Wavetable load timed out.";
  }
  if (normalized.failurePhase === runtimeFailurePhaseLoadSource) {
    return "Could not read wavetable source.";
  }
  if (normalized.failurePhase === runtimeFailurePhaseBuildMip) {
    return "Could not build wavetable mip data.";
  }
  if (normalized.failurePhase === runtimeFailurePhaseTransferMip) {
    return "Could not transfer wavetable mip data.";
  }
  return "Wavetable load failed.";
}
function describeRuntimeTableFailureDetails(normalized, tableName = "Requested wavetable") {
  if (!normalized?.hasFailure) {
    return null;
  }
  const phaseLabel = normalized.failurePhase === runtimeFailurePhaseLoadSource ? "source read" : normalized.failurePhase === runtimeFailurePhaseBuildMip ? "mip build" : normalized.failurePhase === runtimeFailurePhaseTransferMip ? "mip transfer" : "unknown phase";
  const scopeLabel = normalized.failureScope === runtimeFailureScopeService ? "committed load" : "candidate load";
  const generationLabel = normalized.failedGeneration > 0 ? `generation ${normalized.failedGeneration}` : "candidate generation";
  const reasonLabel = normalized.failureReasonCode === runtimeFailureReasonTimeout ? "timeout" : "generic failure";
  return `${tableName} failed during ${phaseLabel} (${scopeLabel}, ${generationLabel}, ${reasonLabel}).`;
}
function resolveRuntimeTablePresentation(message, fallbackTableIndex = 0) {
  const normalized = normalizeRuntimeTableState(message);
  const safeFallbackTableIndex = Math.max(0, Math.trunc(Number(fallbackTableIndex) || 0));
  if (!normalized) {
    return {
      desiredTableIndex: safeFallbackTableIndex,
      presentedTableIndex: safeFallbackTableIndex,
      activeTableIndex: null,
      activeGeneration: null,
      loadingTableIndex: null,
      loadingGeneration: null,
      isPendingSelection: false,
      isRetryableFailure: false,
      failureMessage: null
    };
  }
  const activeTableIndex = normalized.hasActive ? normalized.activeTableIndex : null;
  const activeGeneration = normalized.hasActive ? normalized.activeGeneration : null;
  const loadingTableIndex = normalized.hasLoading ? normalized.loadingTableIndex : null;
  const loadingGeneration = normalized.hasLoading ? normalized.loadingGeneration : null;
  const presentedTableIndex = activeTableIndex ?? loadingTableIndex ?? normalized.desiredTableIndex;
  return {
    desiredTableIndex: normalized.desiredTableIndex,
    presentedTableIndex,
    activeTableIndex,
    activeGeneration,
    loadingTableIndex,
    loadingGeneration,
    isPendingSelection: loadingTableIndex !== null || activeTableIndex !== null && normalized.desiredTableIndex !== activeTableIndex,
    isRetryableFailure: normalized.hasFailure && normalized.failedTableIndex === normalized.desiredTableIndex,
    failureMessage: describeRuntimeTableFailure(normalized)
  };
}
const MSEG_BODY_SAMPLES = 2048;
const MSEG_PADDED_SAMPLES = MSEG_BODY_SAMPLES + 3;
const MSEG_CURVE_POWER_LIMIT = 20;
const MSEG_DEFAULT_NAME = "MSEG 1";
const MSEG_DEFAULT_DEPTH = 1;
const MSEG_RATE_MIN_SECONDS = 0;
const MSEG_RATE_MAX_SECONDS = 2;
const MSEG_POINT_HIT_RADIUS_PX = 16;
const MSEG_SEGMENT_HIT_RADIUS_PX = 10;
const MSEG_POINT_RADIUS_PX = 8;
const MSEG_SELECTED_POINT_RADIUS_PX = 10;
const MSEG_EDITOR_HORIZONTAL_PADDING_PX = 14;
const MSEG_EDITOR_VERTICAL_PADDING_PX = 14;
const MSEG_EDITOR_CURVE_TOLERANCE_PX = 0.5;
const MSEG_EDITOR_MAX_SUBDIVISION_DEPTH = 12;
const MSEG_NOTE_OFF_POLICY_VALUES = /* @__PURE__ */ new Set([
  "finish_loop",
  "immediate",
  "ignore"
]);
function clamp$6(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function almostEqual(left, right, epsilon = 1e-12) {
  return Math.abs(left - right) <= epsilon;
}
function clampCurvePower(value) {
  return clamp$6(Number.isFinite(value) ? value : 0, -MSEG_CURVE_POWER_LIMIT, MSEG_CURVE_POWER_LIMIT);
}
function clamp01(value) {
  return clamp$6(Number.isFinite(value) ? value : 0, 0, 1);
}
function createDefaultMsegShape(name = MSEG_DEFAULT_NAME) {
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name,
    globalSmooth: false,
    points: [
      { x: 0, y: 0, curvePower: 0 },
      { x: 1, y: 1, curvePower: 0 }
    ]
  };
}
function createDefaultMsegPlayback() {
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: 1
    },
    loop: { startX: 0, endX: 1 },
    noteOffPolicy: "finish_loop",
    legatoRestarts: false,
    holdFinalValue: true
  };
}
function clampMsegRateSeconds(value) {
  const numericValue = Number(value);
  return clamp$6(
    Number.isFinite(numericValue) ? numericValue : 1,
    MSEG_RATE_MIN_SECONDS,
    MSEG_RATE_MAX_SECONDS
  );
}
function createMsegEditorMetrics(width, height, {
  pointRadius = MSEG_POINT_RADIUS_PX,
  horizontalPadding = MSEG_EDITOR_HORIZONTAL_PADDING_PX,
  verticalPadding = MSEG_EDITOR_VERTICAL_PADDING_PX
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 0);
  const safeHeight = Math.max(1, Number(height) || 0);
  const safePointRadius = Math.max(0, Number(pointRadius) || 0);
  const safeHorizontalPadding = Math.max(0, Number(horizontalPadding) || 0);
  const safeVerticalPadding = Math.max(0, Number(verticalPadding) || 0);
  const maxInsetX = Math.max(0, (safeWidth - 1) * 0.5);
  const maxInsetY = Math.max(0, (safeHeight - 1) * 0.5);
  const insetX = Math.min(maxInsetX, safePointRadius + safeHorizontalPadding);
  const insetY = Math.min(maxInsetY, safePointRadius + safeVerticalPadding);
  const plotLeft = insetX;
  const plotTop = insetY;
  const plotRight = Math.max(plotLeft + 1, safeWidth - insetX);
  const plotBottom = Math.max(plotTop + 1, safeHeight - insetY);
  return {
    width: safeWidth,
    height: safeHeight,
    pointRadius: safePointRadius,
    plotLeft,
    plotTop,
    plotRight,
    plotBottom,
    plotWidth: Math.max(1, plotRight - plotLeft),
    plotHeight: Math.max(1, plotBottom - plotTop)
  };
}
function pointToMsegEditorCoordinates(point, width, height, options = {}) {
  const metrics = createMsegEditorMetrics(width, height, options);
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  const normalizedX = clamp01(Number(point?.x));
  const normalizedY = clamp01(Number(point?.y));
  if (orientation === "vertical") {
    return {
      x: metrics.plotLeft + normalizedY * metrics.plotWidth,
      y: metrics.plotTop + normalizedX * metrics.plotHeight
    };
  }
  return {
    x: metrics.plotLeft + normalizedX * metrics.plotWidth,
    y: metrics.plotTop + (1 - normalizedY) * metrics.plotHeight
  };
}
function msegEditorCoordinatesToPoint(editorX, editorY, width, height, options = {}) {
  const metrics = createMsegEditorMetrics(width, height, options);
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  if (orientation === "vertical") {
    return {
      x: clamp01((Number(editorY) - metrics.plotTop) / metrics.plotHeight),
      y: clamp01((Number(editorX) - metrics.plotLeft) / metrics.plotWidth)
    };
  }
  return {
    x: clamp01((Number(editorX) - metrics.plotLeft) / metrics.plotWidth),
    y: clamp01(1 - (Number(editorY) - metrics.plotTop) / metrics.plotHeight)
  };
}
function normalizeMsegLoop(loop) {
  if (!loop || typeof loop !== "object") {
    return null;
  }
  const nextLoop = loop;
  const startX = clamp01(Number(nextLoop.startX));
  const endX = clamp01(Number(nextLoop.endX));
  if (almostEqual(startX, endX)) {
    return null;
  }
  if (endX < startX) {
    return {
      startX: endX,
      endX: startX
    };
  }
  return { startX, endX };
}
function normalizeMsegPlayback(playback = createDefaultMsegPlayback()) {
  const next = playback && typeof playback === "object" ? playback : {};
  const rate = next.rate && typeof next.rate === "object" ? next.rate : {};
  const seconds = Number(rate.seconds);
  const noteOffPolicyCandidate = next.noteOffPolicy;
  const noteOffPolicy = MSEG_NOTE_OFF_POLICY_VALUES.has(noteOffPolicyCandidate) ? noteOffPolicyCandidate : "finish_loop";
  return {
    format: "cosimo.mseg.playback",
    version: 1,
    rate: {
      kind: "seconds",
      seconds: clampMsegRateSeconds(Number.isFinite(seconds) ? seconds : 1)
    },
    loop: normalizeMsegLoop(next.loop),
    noteOffPolicy,
    legatoRestarts: Boolean(next.legatoRestarts),
    holdFinalValue: next.holdFinalValue !== false
  };
}
function normalizePoint(point, pointIndex, pointCount) {
  const nextPoint = point && typeof point === "object" ? point : {};
  let x = Number(nextPoint.x);
  if (!Number.isFinite(x)) {
    x = pointIndex === 0 ? 0 : pointIndex === pointCount - 1 ? 1 : 0;
  }
  if (pointIndex !== 0 && pointIndex !== pointCount - 1) {
    x = clamp01(x);
  }
  return {
    x,
    y: clamp01(Number(nextPoint.y)),
    curvePower: clampCurvePower(Number(nextPoint.curvePower))
  };
}
function normalizeMsegShape(shape = createDefaultMsegShape()) {
  const next = shape && typeof shape === "object" ? shape : {};
  const inputPoints = Array.isArray(next.points) ? next.points : [];
  if (inputPoints.length < 2) {
    throw new Error("MSEG shapes require at least two points");
  }
  const points = inputPoints.map((point, index) => normalizePoint(point, index, inputPoints.length));
  if (!almostEqual(points[0].x, 0) || !almostEqual(points[points.length - 1].x, 1)) {
    throw new Error("MSEG shapes must start at x = 0 and end at x = 1");
  }
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x < points[index - 1].x) {
      throw new Error("MSEG shape points must stay in non-decreasing x order");
    }
  }
  return {
    format: "cosimo.mseg.shape",
    version: 1,
    name: typeof next.name === "string" && next.name.trim() ? next.name : MSEG_DEFAULT_NAME,
    globalSmooth: Boolean(next.globalSmooth),
    points
  };
}
function serializeMsegShape(shape) {
  return JSON.stringify(normalizeMsegShape(shape));
}
function serializeMsegPlayback(playback) {
  return JSON.stringify(normalizeMsegPlayback(playback));
}
function powerScale(value, power) {
  if (Math.abs(power) < 0.01) {
    return value;
  }
  const numerator = Math.exp(power * value) - 1;
  const denominator = Math.exp(power) - 1;
  return numerator / denominator;
}
function evaluateMsegSegmentPoint(from, to, t) {
  const clampedT = clamp01(t);
  const curvedT = clamp01(powerScale(clampedT, from.curvePower));
  return {
    x: from.x + (to.x - from.x) * clampedT,
    y: from.y + (to.y - from.y) * curvedT,
    curvePower: from.curvePower
  };
}
function distanceSquaredToLineSegment(targetX, targetY, fromX, fromY, toX, toY) {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (segmentLengthSquared <= 1e-12) {
    const pointDeltaX2 = targetX - fromX;
    const pointDeltaY2 = targetY - fromY;
    return pointDeltaX2 * pointDeltaX2 + pointDeltaY2 * pointDeltaY2;
  }
  const projection = clamp$6(
    ((targetX - fromX) * deltaX + (targetY - fromY) * deltaY) / segmentLengthSquared,
    0,
    1
  );
  const closestX = fromX + deltaX * projection;
  const closestY = fromY + deltaY * projection;
  const pointDeltaX = targetX - closestX;
  const pointDeltaY = targetY - closestY;
  return pointDeltaX * pointDeltaX + pointDeltaY * pointDeltaY;
}
function sampleMsegSegmentEditorPolyline(shape, segmentIndex, width, height, editorOptions = {}) {
  const normalizedShape = normalizeMsegShape(shape);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
    return [];
  }
  const from = normalizedShape.points[segmentIndex];
  const to = normalizedShape.points[segmentIndex + 1];
  const startCoordinates = pointToMsegEditorCoordinates(from, width, height, editorOptions);
  const endCoordinates = pointToMsegEditorCoordinates(to, width, height, editorOptions);
  if (almostEqual(from.x, to.x)) {
    return [startCoordinates, endCoordinates];
  }
  const polyline = [startCoordinates];
  const errorToleranceSquared = MSEG_EDITOR_CURVE_TOLERANCE_PX * MSEG_EDITOR_CURVE_TOLERANCE_PX;
  const appendAdaptiveSamples = (startT, endT, startPointCoordinates, endPointCoordinates, depth) => {
    if (depth >= MSEG_EDITOR_MAX_SUBDIVISION_DEPTH) {
      polyline.push(endPointCoordinates);
      return;
    }
    const midpointT = startT + (endT - startT) * 0.5;
    const midpoint = evaluateMsegSegmentPoint(from, to, midpointT);
    const midpointCoordinates = pointToMsegEditorCoordinates(midpoint, width, height, editorOptions);
    const errorSquared = distanceSquaredToLineSegment(
      midpointCoordinates.x,
      midpointCoordinates.y,
      startPointCoordinates.x,
      startPointCoordinates.y,
      endPointCoordinates.x,
      endPointCoordinates.y
    );
    if (errorSquared <= errorToleranceSquared) {
      polyline.push(endPointCoordinates);
      return;
    }
    appendAdaptiveSamples(startT, midpointT, startPointCoordinates, midpointCoordinates, depth + 1);
    appendAdaptiveSamples(midpointT, endT, midpointCoordinates, endPointCoordinates, depth + 1);
  };
  appendAdaptiveSamples(0, 1, startCoordinates, endCoordinates, 0);
  return polyline;
}
function sampleMsegEditorPolyline(shape, width, height, editorOptions = {}) {
  const normalizedShape = normalizeMsegShape(shape);
  const polyline = [];
  for (let segmentIndex = 0; segmentIndex < normalizedShape.points.length - 1; segmentIndex += 1) {
    const segmentPolyline = sampleMsegSegmentEditorPolyline(
      normalizedShape,
      segmentIndex,
      width,
      height,
      editorOptions
    );
    if (segmentPolyline.length === 0) {
      continue;
    }
    if (polyline.length === 0) {
      polyline.push(...segmentPolyline);
      continue;
    }
    polyline.push(...segmentPolyline.slice(1));
  }
  return polyline;
}
function findEvaluationSegment(points, x) {
  if (x <= points[0].x) {
    return { from: points[0], to: points[0], laterPointWins: false };
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (x < to.x) {
      return { from, to, laterPointWins: false };
    }
    if (almostEqual(x, to.x)) {
      let latestIndex = index + 1;
      while (latestIndex + 1 < points.length && almostEqual(points[latestIndex + 1].x, x)) {
        latestIndex += 1;
      }
      return {
        from: points[latestIndex],
        to: points[latestIndex],
        laterPointWins: true
      };
    }
  }
  return {
    from: points[points.length - 1],
    to: points[points.length - 1],
    laterPointWins: false
  };
}
function evaluateNormalizedMsegShape(points, x) {
  const clampedX = clamp01(Number(x));
  const segment = findEvaluationSegment(points, clampedX);
  if (segment.laterPointWins || almostEqual(segment.from.x, segment.to.x)) {
    return segment.to.y;
  }
  const width = segment.to.x - segment.from.x;
  const t = width <= 0 ? 1 : (clampedX - segment.from.x) / width;
  const curvedT = clamp01(powerScale(t, segment.from.curvePower));
  return segment.from.y + (segment.to.y - segment.from.y) * curvedT;
}
function evaluateMsegShape(shape, x) {
  return evaluateNormalizedMsegShape(normalizeMsegShape(shape).points, x);
}
function renderMsegShape(shape) {
  const normalizedShape = normalizeMsegShape(shape);
  const body = new Float32Array(MSEG_BODY_SAMPLES);
  for (let sampleIndex = 0; sampleIndex < MSEG_BODY_SAMPLES; sampleIndex += 1) {
    const x = sampleIndex / (MSEG_BODY_SAMPLES - 1);
    body[sampleIndex] = evaluateMsegShape(normalizedShape, x);
  }
  const padded = new Float32Array(MSEG_PADDED_SAMPLES);
  padded[0] = body[0];
  padded.set(body, 1);
  padded[MSEG_BODY_SAMPLES + 1] = body[MSEG_BODY_SAMPLES - 1];
  padded[MSEG_BODY_SAMPLES + 2] = body[MSEG_BODY_SAMPLES - 1];
  return padded;
}
function findMsegPointHitIndex(shape, editorX, editorY, width, height, hitRadius = MSEG_POINT_HIT_RADIUS_PX, editorOptions = {}) {
  const points = normalizeMsegShape(shape).points;
  const targetX = Number(editorX);
  const targetY = Number(editorY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return -1;
  }
  const safeHitRadius = Math.max(0, Number(hitRadius) || 0);
  let closestPointIndex = -1;
  let closestDistanceSquared = safeHitRadius * safeHitRadius;
  points.forEach((point, pointIndex) => {
    const coordinates = pointToMsegEditorCoordinates(point, width, height, editorOptions);
    const deltaX = targetX - coordinates.x;
    const deltaY = targetY - coordinates.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared <= closestDistanceSquared) {
      closestPointIndex = pointIndex;
      closestDistanceSquared = distanceSquared;
    }
  });
  return closestPointIndex;
}
function findMsegSegmentHitIndex(shape, editorX, editorY, width, height, hitRadius = MSEG_SEGMENT_HIT_RADIUS_PX, editorOptions = {}) {
  const normalizedShape = normalizeMsegShape(shape);
  const targetX = Number(editorX);
  const targetY = Number(editorY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
    return -1;
  }
  const safeHitRadius = Math.max(0, Number(hitRadius) || 0);
  let closestSegmentIndex = -1;
  let closestDistanceSquared = safeHitRadius * safeHitRadius;
  for (let segmentIndex = 0; segmentIndex < normalizedShape.points.length - 1; segmentIndex += 1) {
    const polyline = sampleMsegSegmentEditorPolyline(
      normalizedShape,
      segmentIndex,
      width,
      height,
      editorOptions
    );
    for (let pointIndex = 0; pointIndex < polyline.length - 1; pointIndex += 1) {
      const from = polyline[pointIndex];
      const to = polyline[pointIndex + 1];
      const distanceSquared = distanceSquaredToLineSegment(
        targetX,
        targetY,
        from.x,
        from.y,
        to.x,
        to.y
      );
      if (distanceSquared <= closestDistanceSquared) {
        closestSegmentIndex = segmentIndex;
        closestDistanceSquared = distanceSquared;
      }
    }
  }
  return closestSegmentIndex;
}
function deriveMsegSegmentCurvePower(shape, segmentIndex, x, y) {
  const normalizedShape = normalizeMsegShape(shape);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
    throw new Error("segmentIndex must address a segment inside the shape");
  }
  const from = normalizedShape.points[segmentIndex];
  const to = normalizedShape.points[segmentIndex + 1];
  const width = to.x - from.x;
  const deltaY = to.y - from.y;
  if (width <= 1e-12 || Math.abs(deltaY) <= 1e-12) {
    return 0;
  }
  const localX = clamp$6(clamp01(Number(x)), from.x, to.x);
  const t = clamp$6((localX - from.x) / width, 1e-4, 1 - 1e-4);
  const targetCurvedT = clamp$6((Number(y) - from.y) / deltaY, 1e-4, 1 - 1e-4);
  if (!Number.isFinite(targetCurvedT) || almostEqual(targetCurvedT, t, 1e-4)) {
    return 0;
  }
  let low = -MSEG_CURVE_POWER_LIMIT;
  let high = MSEG_CURVE_POWER_LIMIT;
  let lowValue = powerScale(t, low);
  let highValue = powerScale(t, high);
  const target = clamp$6(targetCurvedT, Math.min(lowValue, highValue), Math.max(lowValue, highValue));
  const ascending = lowValue <= highValue;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const middle = (low + high) * 0.5;
    const middleValue = powerScale(t, middle);
    if (almostEqual(middleValue, target, 1e-5)) {
      return clampCurvePower(middle);
    }
    if (ascending && middleValue < target || !ascending && middleValue > target) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
      highValue = middleValue;
    }
  }
  return clampCurvePower((low + high) * 0.5);
}
function msegShapesEqual(left, right) {
  return serializeMsegShape(left) === serializeMsegShape(right);
}
function msegPlaybacksEqual(left, right) {
  return serializeMsegPlayback(left) === serializeMsegPlayback(right);
}
function addMsegPoint(shape, x, y) {
  const normalizedShape = normalizeMsegShape(shape);
  const points = normalizedShape.points.map((point) => ({ ...point }));
  const nextPoint = {
    x: clamp01(Number(x)),
    y: clamp01(Number(y)),
    curvePower: 0
  };
  let insertIndex = points.length - 1;
  while (insertIndex > 0 && points[insertIndex - 1].x > nextPoint.x) {
    insertIndex -= 1;
  }
  points.splice(insertIndex, 0, nextPoint);
  return normalizeMsegShape({
    ...normalizedShape,
    points
  });
}
function moveMsegPoint(shape, pointIndex, x, y) {
  const normalizedShape = normalizeMsegShape(shape);
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= normalizedShape.points.length) {
    throw new Error("pointIndex must address a point inside the shape");
  }
  const points = normalizedShape.points.map((point) => ({ ...point }));
  const previousX = pointIndex > 0 ? points[pointIndex - 1].x : 0;
  const nextX = pointIndex < points.length - 1 ? points[pointIndex + 1].x : 1;
  const moved = { ...points[pointIndex] };
  moved.y = clamp01(Number(y));
  if (pointIndex === 0) {
    moved.x = 0;
  } else if (pointIndex === points.length - 1) {
    moved.x = 1;
  } else {
    moved.x = clamp$6(clamp01(Number(x)), previousX, nextX);
  }
  points[pointIndex] = moved;
  return normalizeMsegShape({
    ...normalizedShape,
    points
  });
}
function deleteMsegPoint(shape, pointIndex) {
  const normalizedShape = normalizeMsegShape(shape);
  if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= normalizedShape.points.length) {
    throw new Error("pointIndex must address a point inside the shape");
  }
  if (pointIndex === 0 || pointIndex === normalizedShape.points.length - 1) {
    return normalizedShape;
  }
  const points = normalizedShape.points.filter((_, index) => index !== pointIndex);
  return normalizeMsegShape({
    ...normalizedShape,
    points
  });
}
function setMsegSegmentCurvePower(shape, segmentIndex, curvePower) {
  const normalizedShape = normalizeMsegShape(shape);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= normalizedShape.points.length - 1) {
    throw new Error("segmentIndex must address a segment inside the shape");
  }
  const points = normalizedShape.points.map((point) => ({ ...point }));
  points[segmentIndex].curvePower = clampCurvePower(Number(curvePower));
  return normalizeMsegShape({
    ...normalizedShape,
    points
  });
}
const DEFAULT_PATCH_THEME = {
  backgroundTop: "#04070f",
  backgroundBottom: "#04070f",
  backgroundRGB: [4, 7, 15],
  panelStroke: "rgba(132, 149, 255, 0.0)",
  frameBlueRGB: [94, 118, 255],
  accentBlue: "#87d7f5",
  accentBlueRGB: [135, 215, 245],
  accentBlueDeep: "#5f7aff",
  accentBlueDeepRGB: [95, 122, 255],
  guideBlue: "rgba(129, 150, 255, 0.12)",
  warmText: "#ffd8a6",
  warmTextRGB: [255, 216, 166],
  highlightPink: "#f56cb6",
  highlightPinkRGB: [245, 108, 182],
  shadowColor: "rgba(7, 11, 28, 0.36)"
};
function createDefaultWavetableTheme(theme = DEFAULT_PATCH_THEME) {
  return {
    backgroundTop: theme.backgroundTop,
    backgroundBottom: theme.backgroundBottom,
    backgroundRGB: [...theme.backgroundRGB],
    panelStroke: theme.panelStroke,
    frameColor: [...theme.frameBlueRGB],
    meshColor: [...theme.accentBlueRGB],
    highlightColor: [...theme.highlightPinkRGB],
    guideColor: theme.guideBlue,
    textColor: `rgba(${theme.warmTextRGB.join(", ")}, 0.94)`,
    shadowColor: theme.shadowColor
  };
}
const CAMERA_YAW = 15 * (Math.PI / 180);
const CAMERA_PITCH = 26 * (Math.PI / 180);
const CAMERA_DISTANCE = 10.5;
const CAMERA_FOCAL_LENGTH = 2.4;
const FRAME_DEPTH_EXTENT = 3.6;
const AMPLITUDE_SCALE = 0.3;
const DISCONTINUITY_THRESHOLD = 0.5;
const FLOOR_Y = -0.64;
const GUIDE_TOP_Y = 0.28;
const WARP_MODE_OFF = 0;
const WARP_MODE_BEND = 1;
const WARP_MODE_PWM = 2;
const WARP_MODE_ASYM = 3;
const WARP_MODE_MIRROR = 4;
const DEFAULT_WAVETABLE_THEME = createDefaultWavetableTheme();
function clamp$5(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function requestNextAnimationFrame(callback) {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(Date.now()), 0);
}
function cancelNextAnimationFrame(handle) {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle);
}
function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
function mixRGB(from, to, amount) {
  return [
    Math.round(lerp(from[0], to[0], amount)),
    Math.round(lerp(from[1], to[1], amount)),
    Math.round(lerp(from[2], to[2], amount))
  ];
}
function toRGBA(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;
}
function assertFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("frames must be a non-empty array of sample arrays");
  }
  const expectedLength = frames[0].length;
  for (const frame of frames) {
    if (!(frame instanceof Float32Array) && !Array.isArray(frame)) {
      throw new Error("every frame must be an array-like set of samples");
    }
    if (frame.length !== expectedLength) {
      throw new Error("all frames must have the same sample count");
    }
  }
}
function resolveWarpMode(rawMode) {
  return clamp$5(Math.round(Number(rawMode) || 0), WARP_MODE_OFF, WARP_MODE_MIRROR);
}
function isIdentityWarp(warpMode, warpAmount) {
  const clampedAmount = clamp$5(Number(warpAmount) || 0, 0, 1);
  if (warpMode <= WARP_MODE_OFF) {
    return true;
  }
  if (warpMode === WARP_MODE_BEND) {
    return Math.abs(clampedAmount - 0.5) <= 1e-6;
  }
  if (warpMode === WARP_MODE_PWM) {
    return clampedAmount <= 1e-6;
  }
  if (warpMode === WARP_MODE_ASYM) {
    return Math.abs(clampedAmount - 0.5) <= 1e-6;
  }
  if (warpMode === WARP_MODE_MIRROR) {
    return false;
  }
  return true;
}
function curvedWarpRight(phase, amount) {
  const clampedPhase = clamp$5(Number(phase) || 0, 0, 1);
  const clampedAmount = clamp$5(Number(amount) || 0, 0, 1);
  const exponent = Math.pow(2, 4 * clampedAmount);
  return Math.pow(clampedPhase, exponent);
}
function curvedWarpLeft(phase, amount) {
  const clampedPhase = clamp$5(Number(phase) || 0, 0, 1);
  const clampedAmount = clamp$5(Number(amount) || 0, 0, 1);
  const exponent = Math.pow(2, 4 * clampedAmount);
  return 1 - Math.pow(1 - clampedPhase, exponent);
}
function curvedAsymSigned(phase, dial) {
  const clampedDial = clamp$5(Number(dial) || 0, 0, 1);
  const signedAmount = 2 * clampedDial - 1;
  const magnitude = Math.abs(signedAmount);
  return signedAmount >= 0 ? curvedWarpRight(phase, magnitude) : curvedWarpLeft(phase, magnitude);
}
function linearSkewSigned(phase, dial) {
  const clampedPhase = clamp$5(Number(phase) || 0, 0, 1);
  const clampedDial = clamp$5(Number(dial) || 0, 0, 1);
  const signedAmount = 2 * clampedDial - 1;
  const split = clamp$5(0.5 + 0.48 * signedAmount, 0.02, 0.98);
  if (clampedPhase < split) {
    return 0.5 * (clampedPhase / split);
  }
  return 0.5 + 0.5 * ((clampedPhase - split) / (1 - split));
}
function mirrorBasePhase(phase) {
  const clampedPhase = clamp$5(Number(phase) || 0, 0, 1);
  if (clampedPhase < 0.5) {
    return clampedPhase * 2;
  }
  return 2 - 2 * clampedPhase;
}
function pwmActivePortion(amount) {
  const clampedAmount = clamp$5(Number(amount) || 0, 0, 1);
  return 1 - (1 - 0.02) * clampedAmount;
}
function resolveDisplayWarpPhase(warpMode, warpAmount, phase) {
  const clampedPhase = clamp$5(Number(phase) || 0, 0, 1);
  const result = {
    shouldLookup: true,
    phase: clampedPhase
  };
  if (warpMode <= WARP_MODE_OFF || clampedPhase >= 1) {
    return result;
  }
  const clampedAmount = clamp$5(Number(warpAmount) || 0, 0, 1);
  if (warpMode === WARP_MODE_BEND) {
    const invertedDial = 1 - clampedAmount;
    if (clampedPhase < 0.5) {
      result.phase = 0.5 * curvedAsymSigned(clampedPhase * 2, invertedDial);
    } else {
      result.phase = 1 - 0.5 * curvedAsymSigned(2 - 2 * clampedPhase, invertedDial);
    }
    return result;
  }
  if (warpMode === WARP_MODE_PWM) {
    const activePortion = pwmActivePortion(clampedAmount);
    if (clampedPhase < activePortion) {
      result.phase = clampedPhase / activePortion;
    } else {
      result.phase = 1;
    }
    return result;
  }
  if (warpMode === WARP_MODE_ASYM) {
    result.phase = linearSkewSigned(clampedPhase, clampedAmount);
    return result;
  }
  if (warpMode === WARP_MODE_MIRROR) {
    result.phase = linearSkewSigned(mirrorBasePhase(clampedPhase), clampedAmount);
    return result;
  }
  return result;
}
function sampleDisplayFrame(frame, phase) {
  const safePhase = clamp$5(Number(phase) || 0, 0, 1);
  const frameLength = frame.length;
  if (frameLength === 0) {
    return 0;
  }
  if (frameLength === 1 || safePhase >= 1) {
    return frame[frameLength - 1];
  }
  const samplePosition = safePhase * (frameLength - 1);
  const sampleIndex = Math.floor(samplePosition);
  const sampleT = samplePosition - sampleIndex;
  const nextIndex = Math.min(sampleIndex + 1, frameLength - 1);
  return lerp(frame[sampleIndex], frame[nextIndex], sampleT);
}
function buildWarpedFrame(lowFrame, highFrame, amount, warpMode, warpAmount) {
  const output = new Float32Array(lowFrame.length);
  const denominator = Math.max(1, lowFrame.length - 1);
  for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
    const phase = sampleIndex / denominator;
    const warpedPhase = resolveDisplayWarpPhase(warpMode, warpAmount, phase);
    if (!warpedPhase.shouldLookup) {
      output[sampleIndex] = 0;
      continue;
    }
    const lowSample = sampleDisplayFrame(lowFrame, warpedPhase.phase);
    const highSample = sampleDisplayFrame(highFrame, warpedPhase.phase);
    output[sampleIndex] = lerp(lowSample, highSample, amount);
  }
  return output;
}
function getFrameDepth(frameIndex, frameCount) {
  if (frameCount <= 1) {
    return 0;
  }
  return frameIndex / (frameCount - 1) * FRAME_DEPTH_EXTENT;
}
function getSceneDepth(frameIndex, frameCount) {
  return getFrameDepth(frameIndex, frameCount);
}
function getBackness(frameIndex, frameCount) {
  if (frameCount <= 1) {
    return 0;
  }
  return frameIndex / (frameCount - 1);
}
function getSceneDepthAt(frameIndex, frameCount) {
  if (frameCount <= 1) {
    return FRAME_DEPTH_EXTENT * 0.5;
  }
  return frameIndex / (frameCount - 1) * FRAME_DEPTH_EXTENT;
}
function getBacknessAt(frameIndex, frameCount) {
  if (frameCount <= 1) {
    return 0;
  }
  return frameIndex / (frameCount - 1);
}
function subtractPoints(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}
function crossProduct(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}
function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function normaliseVector(vector) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude < 1e-5) {
    return { x: 0, y: 1, z: 0 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude
  };
}
function createCamera() {
  const target = {
    x: 0,
    y: FLOOR_Y,
    z: FRAME_DEPTH_EXTENT * 0.5
  };
  const horizontalDistance = Math.cos(CAMERA_PITCH) * CAMERA_DISTANCE;
  const position = {
    x: target.x + Math.sin(CAMERA_YAW) * horizontalDistance,
    y: target.y + Math.sin(CAMERA_PITCH) * CAMERA_DISTANCE,
    z: target.z - Math.cos(CAMERA_YAW) * horizontalDistance
  };
  const worldUp = { x: 0, y: 1, z: 0 };
  const forward = normaliseVector(subtractPoints(target, position));
  const right = normaliseVector(crossProduct(worldUp, forward));
  const up = normaliseVector(crossProduct(forward, right));
  return {
    position,
    target,
    forward,
    right,
    up
  };
}
function createViewportPadding(width, height) {
  return {
    left: clamp$5(width * 0.06, 22, 48),
    right: clamp$5(width * 0.06, 22, 48),
    top: clamp$5(height * 0.1, 20, 56),
    bottom: clamp$5(height * 0.09, 20, 52)
  };
}
function projectWorldPoint(point, camera) {
  const relative = subtractPoints(point, camera.position);
  const cameraX = dotProduct(relative, camera.right);
  const cameraY = dotProduct(relative, camera.up);
  const cameraDepth = Math.max(1e-3, dotProduct(relative, camera.forward));
  const perspective = CAMERA_FOCAL_LENGTH / cameraDepth;
  return {
    projectedX: cameraX * perspective,
    projectedY: cameraY * perspective,
    cameraDepth,
    perspective
  };
}
function projectToScreen(projectedPoint, projection) {
  return {
    x: projection.centerX + (projectedPoint.projectedX - projection.projectedCenterX) * projection.scale,
    y: projection.centerY - (projectedPoint.projectedY - projection.projectedCenterY) * projection.scale,
    cameraDepth: projectedPoint.cameraDepth,
    perspective: projectedPoint.perspective
  };
}
function createProjection(points, width, height) {
  const padding = createViewportPadding(width, height);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.projectedX);
    maxX = Math.max(maxX, point.projectedX);
    minY = Math.min(minY, point.projectedY);
    maxY = Math.max(maxY, point.projectedY);
  }
  const spanX = Math.max(1e-3, maxX - minX);
  const spanY = Math.max(1e-3, maxY - minY);
  const scale = Math.min(
    (width - padding.left - padding.right) / spanX,
    (height - padding.top - padding.bottom) / spanY
  );
  return {
    width,
    height,
    scale,
    padding,
    projectedCenterX: (minX + maxX) * 0.5,
    projectedCenterY: (minY + maxY) * 0.5,
    centerX: width * 0.5,
    centerY: height * 0.46
  };
}
function getSurfacePointCount(width, sampleCount) {
  return clamp$5(Math.round(width / 10), 64, Math.min(128, sampleCount));
}
function getContourPointCount(width, sampleCount) {
  return clamp$5(Math.round(width / 4), 128, Math.min(256, sampleCount));
}
function createObjectPoints(samples, depth) {
  const points = new Array(samples.length);
  const denominator = Math.max(1, samples.length - 1);
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
    const phase = sampleIndex / denominator;
    points[sampleIndex] = {
      x: lerp(-1, 1, phase),
      y: samples[sampleIndex] * AMPLITUDE_SCALE,
      z: depth
    };
  }
  return points;
}
function createProjectedFrame(samples, frameIndex, frameCount, camera, projection) {
  const depth = getSceneDepth(frameIndex, frameCount);
  const objectPoints = createObjectPoints(samples, depth);
  const points = objectPoints.map((point) => {
    const projectedPoint = projectWorldPoint(point, camera);
    return {
      ...projectToScreen(projectedPoint, projection),
      objectPoint: point
    };
  });
  return {
    frameIndex,
    depth,
    depthNormalized: getBackness(frameIndex, frameCount),
    samples,
    objectPoints,
    points,
    averageCameraDepth: points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1)
  };
}
function createGuideLine(pointList, camera, projection) {
  return pointList.map((point) => {
    const projectedPoint = projectWorldPoint(point, camera);
    return projectToScreen(projectedPoint, projection);
  });
}
function createGuideLines(camera, projection) {
  const frontFloor = [
    { x: -1, y: FLOOR_Y, z: 0 },
    { x: 1, y: FLOOR_Y, z: 0 }
  ];
  const backFloor = [
    { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const leftEdge = [
    { x: -1, y: FLOOR_Y, z: 0 },
    { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const rightEdge = [
    { x: 1, y: FLOOR_Y, z: 0 },
    { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const centreDepth = [
    { x: 0, y: FLOOR_Y, z: 0 },
    { x: 0, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const zeroPlane = [
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }
  ];
  const topFront = [
    { x: -1, y: GUIDE_TOP_Y, z: 0 },
    { x: 1, y: GUIDE_TOP_Y, z: 0 }
  ];
  const topBack = [
    { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const topLeft = [
    { x: -1, y: GUIDE_TOP_Y, z: 0 },
    { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const topRight = [
    { x: 1, y: GUIDE_TOP_Y, z: 0 },
    { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT }
  ];
  return [
    { kind: "frame", strength: 0.78, points: createGuideLine(frontFloor, camera, projection) },
    { kind: "frame", strength: 0.7, points: createGuideLine(backFloor, camera, projection) },
    { kind: "frame", strength: 0.52, points: createGuideLine(leftEdge, camera, projection) },
    { kind: "frame", strength: 0.52, points: createGuideLine(rightEdge, camera, projection) },
    { kind: "guide", strength: 0.28, points: createGuideLine(centreDepth, camera, projection) },
    { kind: "guide", strength: 0.36, points: createGuideLine(zeroPlane, camera, projection) },
    { kind: "frame", strength: 0.28, points: createGuideLine(topFront, camera, projection) },
    { kind: "frame", strength: 0.2, points: createGuideLine(topBack, camera, projection) },
    { kind: "frame", strength: 0.18, points: createGuideLine(topLeft, camera, projection) },
    { kind: "frame", strength: 0.18, points: createGuideLine(topRight, camera, projection) }
  ];
}
function buildProjectionFromFrames(contourSamples, width, height, frameCount) {
  const camera = createCamera();
  const stableWorldPoints = [
    { x: -1, y: FLOOR_Y, z: 0 },
    { x: 1, y: FLOOR_Y, z: 0 },
    { x: -1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    { x: 1, y: FLOOR_Y, z: FRAME_DEPTH_EXTENT },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: FRAME_DEPTH_EXTENT },
    { x: 1, y: 0, z: FRAME_DEPTH_EXTENT },
    { x: -1, y: GUIDE_TOP_Y, z: 0 },
    { x: 1, y: GUIDE_TOP_Y, z: 0 },
    { x: -1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT },
    { x: 1, y: GUIDE_TOP_Y, z: FRAME_DEPTH_EXTENT }
  ];
  const projectedAnchors = stableWorldPoints.map((point) => projectWorldPoint(point, camera));
  return {
    camera,
    projection: createProjection(projectedAnchors, width, height)
  };
}
function getSparseContourIndices(frameCount, frameState) {
  const contourIndices = /* @__PURE__ */ new Set([0, frameCount - 1, frameState.frameLo, frameState.frameHi]);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 4) {
    contourIndices.add(frameIndex);
  }
  return [...contourIndices].sort((left, right) => left - right);
}
function createContourDescriptors(projectedFrames, frameState) {
  return getSparseContourIndices(projectedFrames.length, frameState).map((frameIndex) => {
    const frame = projectedFrames[frameIndex];
    const distance = Math.abs(frameState.frameIndex - frameIndex);
    const proximity = Math.max(0, 1 - distance / 5.5);
    const frontFactor = 1 - frame.depthNormalized;
    return {
      frameIndex,
      depthNormalized: frame.depthNormalized,
      points: frame.points,
      segments: createPolylineSegments(frame.points, frame.samples),
      samples: frame.samples,
      averageCameraDepth: frame.averageCameraDepth,
      lineWidth: lerp(0.45, 0.9, frontFactor) + proximity * 0.1,
      alpha: lerp(0.03, 0.09, frontFactor) * lerp(0.84, 1, proximity),
      colourMix: lerp(0.58, 0.9, frame.depthNormalized) - proximity * 0.04
    };
  });
}
function createSurfaceBands(projectedFrames) {
  const bands = [];
  for (let frameIndex = 0; frameIndex < projectedFrames.length - 1; frameIndex += 1) {
    const frontFrame = projectedFrames[frameIndex];
    const backFrame = projectedFrames[frameIndex + 1];
    for (let sampleIndex = 0; sampleIndex < frontFrame.points.length - 1; sampleIndex += 1) {
      const frontJump = Math.abs(frontFrame.samples[sampleIndex + 1] - frontFrame.samples[sampleIndex]);
      const backJump = Math.abs(backFrame.samples[sampleIndex + 1] - backFrame.samples[sampleIndex]);
      if (frontJump > DISCONTINUITY_THRESHOLD || backJump > DISCONTINUITY_THRESHOLD) {
        continue;
      }
      const quad = [
        frontFrame.points[sampleIndex],
        frontFrame.points[sampleIndex + 1],
        backFrame.points[sampleIndex + 1],
        backFrame.points[sampleIndex]
      ];
      const objectQuad = [
        frontFrame.objectPoints[sampleIndex],
        frontFrame.objectPoints[sampleIndex + 1],
        backFrame.objectPoints[sampleIndex + 1],
        backFrame.objectPoints[sampleIndex]
      ];
      const surfaceNormal = normaliseVector(
        crossProduct(
          subtractPoints(objectQuad[1], objectQuad[0]),
          subtractPoints(objectQuad[3], objectQuad[0])
        )
      );
      const lightDirection = normaliseVector({ x: -0.2, y: 0.95, z: -0.5 });
      const averageCameraDepth = quad.reduce((total, point) => total + point.cameraDepth, 0) / quad.length;
      const depthNormalized = (frontFrame.depthNormalized + backFrame.depthNormalized) * 0.5;
      const slopeLight = clamp$5((dotProduct(surfaceNormal, lightDirection) + 1) * 0.5, 0, 1);
      const ridgeAmount = clamp$5(
        Math.abs(frontFrame.samples[sampleIndex + 1] - frontFrame.samples[sampleIndex]) * 0.95 + Math.abs(backFrame.samples[sampleIndex + 1] - backFrame.samples[sampleIndex]) * 0.95,
        0,
        1
      );
      bands.push({
        frameLo: frontFrame.frameIndex,
        frameHi: backFrame.frameIndex,
        sampleIndex,
        points: quad,
        averageCameraDepth,
        depthNormalized,
        slopeLight,
        ridgeAmount
      });
    }
  }
  bands.sort((left, right) => right.averageCameraDepth - left.averageCameraDepth);
  return bands;
}
function createSurfaceRibs(projectedFrames) {
  const sampleCount = projectedFrames[0]?.points.length ?? 0;
  if (sampleCount < 3) {
    return [];
  }
  const desiredRibCount = clamp$5(Math.round(sampleCount / 10), 8, 14);
  const selectedColumns = /* @__PURE__ */ new Set([0, sampleCount - 1]);
  for (let ribIndex = 1; ribIndex < desiredRibCount - 1; ribIndex += 1) {
    selectedColumns.add(
      Math.round(ribIndex * (sampleCount - 1) / (desiredRibCount - 1))
    );
  }
  return [...selectedColumns].sort((left, right) => left - right).map((sampleIndex) => {
    const points = projectedFrames.map((frame) => frame.points[sampleIndex]);
    const averageDepth = points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1);
    const frontness = 1 - projectedFrames.reduce((total, frame) => total + frame.depthNormalized, 0) / Math.max(projectedFrames.length, 1);
    return {
      sampleIndex,
      points,
      averageDepth,
      alpha: lerp(0.05, 0.12, frontness)
    };
  });
}
function createPolylineSegments(points, samples, threshold = DISCONTINUITY_THRESHOLD) {
  if (points.length <= 1) {
    return [];
  }
  const segments = [];
  let startIndex = 0;
  for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
    if (Math.abs(samples[pointIndex + 1] - samples[pointIndex]) > threshold) {
      if (pointIndex - startIndex >= 1) {
        segments.push(points.slice(startIndex, pointIndex + 1));
      }
      startIndex = pointIndex + 1;
    }
  }
  if (points.length - 1 - startIndex >= 1) {
    segments.push(points.slice(startIndex));
  }
  return segments;
}
function createInterpolatedSurfaceSlices(sourceFrames, camera, projection) {
  const frameCount = sourceFrames.length;
  if (frameCount === 0) {
    return [];
  }
  const sliceCount = clamp$5(frameCount * 3 - 2, 17, 41);
  const slices = [];
  for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
    const framePosition = sliceIndex * (frameCount - 1) / Math.max(1, sliceCount - 1);
    const frameLo = Math.floor(framePosition);
    const frameHi = Math.min(frameLo + 1, frameCount - 1);
    const frameT = framePosition - frameLo;
    const samples = buildInterpolatedFrame(
      sourceFrames[frameLo].samples,
      sourceFrames[frameHi].samples,
      frameT
    );
    const depth = getSceneDepthAt(framePosition, frameCount);
    const objectPoints = createObjectPoints(samples, depth);
    const points = objectPoints.map(
      (point) => projectToScreen(projectWorldPoint(point, camera), projection)
    );
    const averageDepth = points.reduce((total, point) => total + point.cameraDepth, 0) / Math.max(points.length, 1);
    slices.push({
      frameIndex: framePosition,
      depthNormalized: getBacknessAt(framePosition, frameCount),
      samples,
      points,
      segments: createPolylineSegments(points, samples),
      averageDepth,
      alpha: lerp(0.07, 0.16, 1 - getBacknessAt(framePosition, frameCount))
    });
  }
  return slices;
}
function buildInterpolatedFrame(lowFrame, highFrame, amount) {
  const output = new Float32Array(lowFrame.length);
  for (let sampleIndex = 0; sampleIndex < lowFrame.length; sampleIndex += 1) {
    output[sampleIndex] = lerp(lowFrame[sampleIndex], highFrame[sampleIndex], amount);
  }
  return output;
}
function createCurrentSlice(staticScene, frameState) {
  const lowFrame = staticScene.contourFrames[frameState.frameLo];
  const highFrame = staticScene.contourFrames[frameState.frameHi];
  const warpMode = resolveWarpMode(frameState.warpMode);
  const warpAmount = clamp$5(Number(frameState.warpAmount) || 0, 0, 1);
  const blendedSamples = isIdentityWarp(warpMode, warpAmount) ? buildInterpolatedFrame(lowFrame.samples, highFrame.samples, frameState.frameT) : buildWarpedFrame(lowFrame.samples, highFrame.samples, frameState.frameT, warpMode, warpAmount);
  const depth = getSceneDepth(frameState.frameIndex, staticScene.frameCount);
  const objectPoints = createObjectPoints(blendedSamples, depth);
  const floorObjectPoints = objectPoints.map((point) => ({ x: point.x, y: FLOOR_Y, z: point.z }));
  const points = objectPoints.map(
    (point) => projectToScreen(projectWorldPoint(point, staticScene.camera), staticScene.projection)
  );
  const floorPoints = floorObjectPoints.map(
    (point) => projectToScreen(projectWorldPoint(point, staticScene.camera), staticScene.projection)
  );
  const labelAnchor = points[Math.floor(points.length * 0.78)] ?? points[points.length - 1];
  const label = {
    text: buildCurrentSliceLabel(frameState, staticScene.frameCount),
    x: clamp$5(labelAnchor.x + 14, 18, staticScene.width - 236),
    y: clamp$5(labelAnchor.y - 18, 24, staticScene.height - 24)
  };
  return {
    frameState,
    samples: blendedSamples,
    points,
    segments: [points],
    floorPoints,
    label,
    lineWidth: 2.35,
    glowBlur: 12
  };
}
function buildCurrentSliceLabel(frameState, frameCount) {
  const warpMode = resolveWarpMode(frameState.warpMode);
  const warpAmount = clamp$5(Number(frameState.warpAmount) || 0, 0, 1);
  const baseLabel = `Frame ${frameState.frameIndex.toFixed(2)} / ${frameCount - 1}`;
  if (isIdentityWarp(warpMode, warpAmount)) {
    return baseLabel;
  }
  if (warpMode === WARP_MODE_BEND) {
    const signedAmount = Math.round((warpAmount - 0.5) * 200);
    return `${baseLabel} · Bend ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
  }
  if (warpMode === WARP_MODE_PWM) {
    return `${baseLabel} · PWM ${Math.round(warpAmount * 100)}%`;
  }
  if (warpMode === WARP_MODE_ASYM) {
    const signedAmount = Math.round((warpAmount - 0.5) * 200);
    return `${baseLabel} · Asym ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
  }
  if (warpMode === WARP_MODE_MIRROR) {
    const signedAmount = Math.round((warpAmount - 0.5) * 200);
    return `${baseLabel} · Mirror ${signedAmount > 0 ? "+" : ""}${signedAmount}%`;
  }
  return baseLabel;
}
function createFrameState(frameCount, position, warpMode = 0, warpAmount = 0) {
  const safeFrameCount = Math.max(1, Number(frameCount) || 0);
  const clampedPosition = clamp$5(Number(position) || 0, 0, 1);
  const frameIndex = clampedPosition * (safeFrameCount - 1);
  const frameLo = Math.floor(frameIndex);
  const frameHi = Math.min(frameLo + 1, safeFrameCount - 1);
  const frameT = frameIndex - frameLo;
  return {
    frameCount: safeFrameCount,
    position: clampedPosition,
    frameIndex,
    frameLo,
    frameHi,
    frameT,
    warpMode: resolveWarpMode(warpMode),
    warpAmount: clamp$5(Number(warpAmount) || 0, 0, 1)
  };
}
function decimateFrame(frame, targetPointCount) {
  const source = frame instanceof Float32Array ? frame : Float32Array.from(frame);
  const clampedPointCount = Math.max(2, Math.floor(targetPointCount || source.length));
  if (clampedPointCount >= source.length) {
    return source.slice();
  }
  const output = new Float32Array(clampedPointCount);
  const lastSourceIndex = source.length - 1;
  for (let pointIndex = 0; pointIndex < clampedPointCount; pointIndex += 1) {
    const sampleIndex = Math.round(pointIndex * lastSourceIndex / (clampedPointCount - 1));
    output[pointIndex] = source[sampleIndex];
  }
  return output;
}
function buildWavetableStaticScene({
  frames,
  width = 640,
  height = 320,
  pixelRatio = 1
}) {
  assertFrames(frames);
  const safeWidth = Math.max(180, Math.floor(width || 0));
  const safeHeight = Math.max(140, Math.floor(height || 0));
  const frameCount = frames.length;
  const contourPointCount = getContourPointCount(safeWidth, frames[0].length);
  const surfacePointCount = getSurfacePointCount(safeWidth, frames[0].length);
  const contourSamples = frames.map((frame) => decimateFrame(frame, contourPointCount));
  const surfaceSamples = frames.map((frame) => decimateFrame(frame, surfacePointCount));
  const { camera, projection } = buildProjectionFromFrames(contourSamples, safeWidth, safeHeight);
  const contourFrames = contourSamples.map(
    (samples, frameIndex) => createProjectedFrame(samples, frameIndex, frameCount, camera, projection)
  );
  const surfaceFrames = surfaceSamples.map(
    (samples, frameIndex) => createProjectedFrame(samples, frameIndex, frameCount, camera, projection)
  );
  return {
    width: safeWidth,
    height: safeHeight,
    pixelRatio: Math.max(1, Number(pixelRatio) || 1),
    frameCount,
    camera,
    contourPointCount,
    surfacePointCount,
    projection,
    contourFrames,
    surfaceFrames,
    surfaceBands: createSurfaceBands(surfaceFrames),
    surfaceRibs: createSurfaceRibs(surfaceFrames),
    surfaceSlices: createInterpolatedSurfaceSlices(contourFrames, camera, projection),
    guideLines: createGuideLines(camera, projection)
  };
}
function buildWavetableRenderModel({
  frames = null,
  position = 0,
  warpMode = 0,
  warpAmount = 0,
  width = 640,
  height = 320,
  pixelRatio = 1,
  staticScene = null
}) {
  const scene = staticScene ?? buildWavetableStaticScene({
    frames,
    width,
    height,
    pixelRatio
  });
  const frameState = createFrameState(scene.frameCount, position, warpMode, warpAmount);
  return {
    ...scene,
    frameState,
    contours: createContourDescriptors(scene.contourFrames, frameState),
    currentSlice: createCurrentSlice(scene, frameState)
  };
}
function tracePath(context, points) {
  points.forEach((point, pointIndex) => {
    if (pointIndex === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
}
function strokePolylineSegments(context, segments) {
  for (const segment of segments) {
    if (segment.length < 2) {
      continue;
    }
    context.beginPath();
    tracePath(context, segment);
    context.stroke();
  }
}
function drawWavetableModel(context, model, theme = DEFAULT_WAVETABLE_THEME) {
  const meshColour = mixRGB(theme.meshColor, [214, 246, 255], 0.34);
  const gradient = context.createLinearGradient?.(0, 0, 0, model.height);
  if (gradient) {
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(1, theme.backgroundBottom);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = theme.backgroundBottom;
  }
  context.clearRect(0, 0, model.width, model.height);
  context.fillRect(0, 0, model.width, model.height);
  context.save();
  context.strokeStyle = theme.panelStroke;
  context.lineWidth = 1;
  context.strokeRect?.(0.5, 0.5, model.width - 1, model.height - 1);
  context.restore();
  context.save();
  context.strokeStyle = theme.guideColor;
  context.lineWidth = 1;
  for (const guideLine of model.guideLines) {
    context.beginPath();
    context.strokeStyle = toRGBA(theme.frameColor, guideLine.strength * 0.22);
    context.lineWidth = guideLine.kind === "frame" ? 1.15 : 0.9;
    tracePath(context, guideLine.points);
    context.stroke();
  }
  context.restore();
  for (const band of model.surfaceBands) {
    const alpha = lerp(0.085, 0.024, band.depthNormalized) + band.ridgeAmount * 0.018;
    const bandColour = mixRGB(
      mixRGB(theme.frameColor, theme.highlightColor, band.slopeLight * 0.24),
      theme.backgroundRGB,
      lerp(0.08, 0.68, band.depthNormalized) - band.slopeLight * 0.06
    );
    context.save();
    context.fillStyle = toRGBA(bandColour, alpha);
    context.beginPath();
    tracePath(context, band.points);
    context.closePath?.();
    context.fill();
    context.restore();
  }
  for (const slice of model.surfaceSlices) {
    context.save();
    context.strokeStyle = toRGBA(meshColour, Math.min(0.46, slice.alpha * 2.05));
    context.lineWidth = 1.15;
    context.shadowBlur = 8;
    context.shadowColor = toRGBA(theme.meshColor, 0.2);
    strokePolylineSegments(context, slice.segments);
    context.restore();
  }
  for (const rib of model.surfaceRibs) {
    context.save();
    context.strokeStyle = toRGBA(meshColour, Math.min(0.42, rib.alpha * 1.95));
    context.lineWidth = 1.1;
    context.shadowBlur = 7;
    context.shadowColor = toRGBA(theme.meshColor, 0.18);
    context.beginPath();
    tracePath(context, rib.points);
    context.stroke();
    context.restore();
  }
  for (const contour of model.contours) {
    const strokeColour = mixRGB(theme.frameColor, theme.backgroundRGB, clamp$5(contour.colourMix, 0, 0.92));
    context.save();
    context.strokeStyle = toRGBA(strokeColour, contour.alpha);
    context.lineWidth = contour.lineWidth;
    strokePolylineSegments(context, contour.segments);
    context.restore();
  }
  context.save();
  context.strokeStyle = toRGBA(theme.highlightColor, 0.98);
  context.lineWidth = model.currentSlice.lineWidth;
  context.shadowBlur = model.currentSlice.glowBlur + 4;
  context.shadowColor = toRGBA(theme.highlightColor, 0.52);
  strokePolylineSegments(context, model.currentSlice.segments);
  context.restore();
  context.save();
  context.fillStyle = toRGBA(theme.backgroundRGB, 0.74);
  context.fillRect(model.currentSlice.label.x - 10, model.currentSlice.label.y - 14, 210, 24);
  context.fillStyle = theme.textColor;
  context.font = "600 12px Avenir Next, Avenir, sans-serif";
  context.textAlign = "left";
  context.fillText(model.currentSlice.label.text, model.currentSlice.label.x, model.currentSlice.label.y + 2);
  context.restore();
}
class CanvasWavetableDisplay {
  constructor(canvas, {
    theme = DEFAULT_WAVETABLE_THEME,
    requestAnimationFrame = requestNextAnimationFrame,
    cancelAnimationFrame = cancelNextAnimationFrame
  } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.theme = theme;
    this.requestAnimationFrame = requestAnimationFrame;
    this.cancelAnimationFrame = cancelAnimationFrame;
    this.frames = [];
    this.position = 0;
    this.warpMode = 0;
    this.warpAmount = 0;
    this.devicePixelRatio = 1;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.staticScene = null;
    this.staticKey = "";
    this.pendingRenderHandle = null;
  }
  invalidateStaticScene() {
    this.staticScene = null;
    this.staticKey = "";
  }
  setFrames(frames) {
    assertFrames(frames);
    this.frames = frames.map(
      (frame) => frame instanceof Float32Array ? frame.slice() : Float32Array.from(frame)
    );
    this.invalidateStaticScene();
    this.queueRender();
  }
  setPosition(position) {
    this.position = clamp$5(Number(position) || 0, 0, 1);
    this.queueRender();
  }
  setWarp(mode, amount) {
    this.warpMode = resolveWarpMode(mode);
    this.warpAmount = clamp$5(Number(amount) || 0, 0, 1);
    this.queueRender();
  }
  resize(width, height, devicePixelRatio = 1) {
    const nextWidth = Math.max(1, Math.floor(width || this.canvas.clientWidth || 1));
    const nextHeight = Math.max(1, Math.floor(height || this.canvas.clientHeight || 1));
    const nextRatio = Math.max(1, Number(devicePixelRatio) || 1);
    this.cssWidth = nextWidth;
    this.cssHeight = nextHeight;
    this.devicePixelRatio = nextRatio;
    this.canvas.width = Math.max(1, Math.round(nextWidth * nextRatio));
    this.canvas.height = Math.max(1, Math.round(nextHeight * nextRatio));
    this.canvas.style.width = `${nextWidth}px`;
    this.canvas.style.height = `${nextHeight}px`;
    this.invalidateStaticScene();
    this.queueRender();
  }
  getStaticScene(width, height) {
    const nextKey = [
      this.frames.length,
      this.frames[0]?.length ?? 0,
      width,
      height,
      this.devicePixelRatio
    ].join(":");
    if (this.staticScene && this.staticKey === nextKey) {
      return this.staticScene;
    }
    this.staticKey = nextKey;
    this.staticScene = buildWavetableStaticScene({
      frames: this.frames,
      width,
      height,
      pixelRatio: this.devicePixelRatio
    });
    return this.staticScene;
  }
  queueRender() {
    if (this.pendingRenderHandle !== null) {
      return;
    }
    this.pendingRenderHandle = this.requestAnimationFrame(() => {
      this.pendingRenderHandle = null;
      this.render();
    });
  }
  render() {
    if (this.pendingRenderHandle !== null) {
      this.cancelAnimationFrame(this.pendingRenderHandle);
      this.pendingRenderHandle = null;
    }
    if (!this.context || this.canvas.width === 0 || this.canvas.height === 0) {
      return;
    }
    const width = this.cssWidth || this.canvas.clientWidth || Math.round(this.canvas.width / this.devicePixelRatio);
    const height = this.cssHeight || this.canvas.clientHeight || Math.round(this.canvas.height / this.devicePixelRatio);
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    if (this.frames.length === 0) {
      this.context.clearRect(0, 0, width, height);
      return;
    }
    const model = buildWavetableRenderModel({
      staticScene: this.getStaticScene(width, height),
      position: this.position,
      warpMode: this.warpMode,
      warpAmount: this.warpAmount
    });
    drawWavetableModel(this.context, model, this.theme);
  }
}
function coerceFiniteNumber$1(value) {
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
}
function normalizeFilterSpectrumMessage(message) {
  const payload = message?.event ?? message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const sampleRateHz = coerceFiniteNumber$1(payload.sampleRateHz);
  const magnitudes = payload.magnitudes;
  if (!sampleRateHz || sampleRateHz <= 0 || !Array.isArray(magnitudes) || magnitudes.length < 8) {
    return null;
  }
  return {
    sampleRateHz,
    magnitudes: magnitudes.map((value) => Math.max(0, Number(value) || 0))
  };
}
const MODULATION_STATE_KEY = "modulation.v1";
const MODULATION_MAX_ROUTES = 12;
const MODULATION_MSEG_SLOT_COUNT = 3;
const MODULATION_ENV_SLOT_COUNT = 3;
const MODULATION_CLEAR_ENDPOINT_ID = "modulationClear";
const MODULATION_ENABLE_ENDPOINT_ID = "modulationEnable";
const MODULATION_MSEG_BUFFER_ENDPOINT_ID = "modulationMsegBuffer";
const MODULATION_MSEG_PLAYBACK_ENDPOINT_ID = "modulationMsegPlayback";
const MODULATION_ENV_ENDPOINT_ID = "modulationEnvelope";
const MODULATION_ROUTE_ENDPOINT_ID = "modulationRoute";
const MOD_SOURCE_MSEG = 1;
const MOD_SOURCE_ENV = 2;
const MOD_SOURCE_VELOCITY = 3;
const MOD_SOURCE_PRESSURE = 4;
const MOD_SOURCE_SLIDE = 5;
const MOD_POLARITY_UNIPOLAR = 0;
const MOD_POLARITY_BIPOLAR = 1;
const MOD_TARGET_WAVETABLE_POSITION = 1;
const MOD_TARGET_WARP_AMOUNT = 2;
const MOD_TARGET_FILTER_CUTOFF_OCTAVES = 3;
const MOD_TARGET_FILTER_Q = 4;
const MOD_TARGET_PITCH_SEMITONES = 5;
const MOD_TARGET_AMP_GAIN_DB = 6;
const MOD_TARGET_PAN = 7;
const MSEG_SLOT_NAMES = ["MSEG 1", "MSEG 2", "MSEG 3"];
const ENV_SLOT_NAMES = ["Env 1", "Env 2", "Env 3"];
const ENV_MIN_SECONDS = 1e-3;
const ENV_MAX_SECONDS = 10;
const FILTER_Q_MIN = 0.1;
const FILTER_Q_MAX = 20;
const ROUTE_AMOUNT_LIMITS = {
  wavetablePosition: { min: -1, max: 1 },
  warpAmount: { min: -1, max: 1 },
  filterCutoffOctaves: { min: -6, max: 6 },
  filterQ: { min: -19.9, max: FILTER_Q_MAX - FILTER_Q_MIN },
  pitchSemitones: { min: -48, max: 48 },
  ampGainDb: { min: -48, max: 6 },
  pan: { min: -1, max: 1 }
};
const MODULATION_SOURCE_OPTIONS = [
  { value: "mseg-1", label: "MSEG 1", sourceKind: "mseg", sourceSlot: 1 },
  { value: "mseg-2", label: "MSEG 2", sourceKind: "mseg", sourceSlot: 2 },
  { value: "mseg-3", label: "MSEG 3", sourceKind: "mseg", sourceSlot: 3 },
  { value: "env-1", label: "ENV 1", sourceKind: "env", sourceSlot: 1 },
  { value: "env-2", label: "ENV 2", sourceKind: "env", sourceSlot: 2 },
  { value: "env-3", label: "ENV 3", sourceKind: "env", sourceSlot: 3 },
  { value: "velocity", label: "VEL", sourceKind: "velocity", sourceSlot: null },
  { value: "pressure", label: "AT", sourceKind: "pressure", sourceSlot: null },
  { value: "slide", label: "SLIDE", sourceKind: "slide", sourceSlot: null }
];
const MODULATION_TARGET_OPTIONS = [
  { value: "wavetablePosition", label: "WT POS" },
  { value: "warpAmount", label: "WARP" },
  { value: "filterCutoffOctaves", label: "CUTOFF" },
  { value: "filterQ", label: "RES" },
  { value: "pitchSemitones", label: "PITCH" },
  { value: "ampGainDb", label: "AMP" },
  { value: "pan", label: "PAN" }
];
let generatedRouteIdCounter = 1;
function clamp$4(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function clampEnvSeconds(value, fallback) {
  const numeric = Number(value);
  return clamp$4(Number.isFinite(numeric) ? numeric : fallback, ENV_MIN_SECONDS, ENV_MAX_SECONDS);
}
function formatMagnitude(value, digits) {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.abs(numeric).toFixed(digits);
}
function getRouteAmountLimit(targetKind) {
  return ROUTE_AMOUNT_LIMITS[targetKind];
}
function getRouteAmountMagnitudeLimit(targetKind) {
  const limits = getRouteAmountLimit(targetKind);
  return Math.max(Math.abs(limits.min), Math.abs(limits.max));
}
function getRouteAmountSideLimit(targetKind, amount) {
  const limits = getRouteAmountLimit(targetKind);
  if (amount < 0) {
    return Math.abs(limits.min);
  }
  if (amount > 0) {
    return Math.abs(limits.max);
  }
  return getRouteAmountMagnitudeLimit(targetKind);
}
function createGeneratedRouteId() {
  const routeId = `mod-route-auto-${generatedRouteIdCounter}`;
  generatedRouteIdCounter += 1;
  return routeId;
}
function normalizeRouteId(value, routeIndex) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return `mod-route-${routeIndex + 1}`;
}
function normalizePolarity(value) {
  return value === "bipolar" ? "bipolar" : "unipolar";
}
function polarityToCode(polarity) {
  return polarity === "bipolar" ? MOD_POLARITY_BIPOLAR : MOD_POLARITY_UNIPOLAR;
}
function clampModulationRouteAmount(targetKind, value) {
  const limits = ROUTE_AMOUNT_LIMITS[targetKind];
  const numeric = Number(value);
  return clamp$4(Number.isFinite(numeric) ? numeric : 0, limits.min, limits.max);
}
function getModulationAmountDepth(targetKind, amount) {
  const clampedAmount = clampModulationRouteAmount(targetKind, amount);
  const limit = getRouteAmountSideLimit(targetKind, clampedAmount);
  if (limit <= 0) {
    return 0;
  }
  return clamp$4(Math.abs(clampedAmount) / limit, 0, 1);
}
function composeModulationAmount(targetKind, depth) {
  const limits = getRouteAmountLimit(targetKind);
  const clampedDepth = clamp$4(Number.isFinite(depth) ? depth : 0, 0, 1);
  if (Math.abs(clampedDepth - 0.5) <= 1e-9) {
    return 0;
  }
  if (clampedDepth <= 0.5) {
    if (Math.abs(limits.min) <= 1e-9) {
      return 0;
    }
    const negativeRatio = 1 - clampedDepth / 0.5;
    return clampModulationRouteAmount(targetKind, limits.min * negativeRatio);
  }
  if (Math.abs(limits.max) <= 1e-9) {
    return 0;
  }
  const positiveRatio = (clampedDepth - 0.5) / 0.5;
  return clampModulationRouteAmount(targetKind, limits.max * positiveRatio);
}
function getModulationAmountSliderPosition(targetKind, amount) {
  const limits = getRouteAmountLimit(targetKind);
  const clampedAmount = clampModulationRouteAmount(targetKind, amount);
  if (Math.abs(clampedAmount) <= 1e-9) {
    return 0.5;
  }
  if (clampedAmount < 0) {
    if (Math.abs(limits.min) <= 1e-9) {
      return 0.5;
    }
    return clamp$4(0.5 * (1 - Math.abs(clampedAmount) / Math.abs(limits.min)), 0, 0.5);
  }
  if (Math.abs(limits.max) <= 1e-9) {
    return 0.5;
  }
  return clamp$4(0.5 + 0.5 * (clampedAmount / limits.max), 0.5, 1);
}
function formatModulationAmountReadout(targetKind, amount, polarity = "unipolar") {
  const clampedAmount = clampModulationRouteAmount(targetKind, amount);
  const prefix = polarity === "bipolar" ? Math.abs(clampedAmount) <= 1e-9 ? "" : "±" : clampedAmount > 0 ? "+" : clampedAmount < 0 ? "-" : "";
  switch (targetKind) {
    case "wavetablePosition":
      return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
    case "warpAmount":
      return `${prefix}${formatMagnitude(clampedAmount * 100, 0)}%`;
    case "filterCutoffOctaves":
      return `${prefix}${formatMagnitude(clampedAmount, 2)} oct`;
    case "filterQ":
      return `${prefix}${formatMagnitude(clampedAmount, 2)} Q`;
    case "pitchSemitones":
      return `${prefix}${formatMagnitude(clampedAmount, 1)} st`;
    case "ampGainDb":
      return `${prefix}${formatMagnitude(clampedAmount, 1)} dB`;
    case "pan": {
      const panPercent = Math.round(Math.abs(clampedAmount) * 100);
      if (panPercent === 0) {
        return "0%";
      }
      if (polarity === "bipolar") {
        return `±${panPercent}%`;
      }
      return `${panPercent}% ${clampedAmount < 0 ? "L" : "R"}`;
    }
    default:
      return `${prefix}${formatMagnitude(clampedAmount, 3)}`;
  }
}
function getModulationAmountPercentLabel(targetKind, amount) {
  return `${Math.round(getModulationAmountDepth(targetKind, amount) * 100)}%`;
}
function getModulationTargetClampHint(targetKind) {
  switch (targetKind) {
    case "wavetablePosition":
      return "Wavetable scan still clamps to the table range.";
    case "warpAmount":
      return "Warp amount still clamps to the oscillator's warp range.";
    case "filterCutoffOctaves":
      return "Requested cutoff movement is converted to Hz and still clamps to the filter range.";
    case "filterQ":
      return "Resonance still clamps to the synth's Q range.";
    case "pitchSemitones":
      return "Pitch depth adds on top of note, glide, and bend.";
    case "ampGainDb":
      return "Amplitude still clamps to the synth's gain range.";
    case "pan":
      return "Pan still clamps between full left and full right.";
    default:
      return "";
  }
}
function normalizeSourceKind(value) {
  if (value === "mseg" || value === "env" || value === "velocity" || value === "pressure" || value === "slide") {
    return value;
  }
  return "mseg";
}
function normalizeTargetKind(value) {
  if (value === "wavetablePosition" || value === "warpAmount" || value === "filterCutoffOctaves" || value === "filterQ" || value === "pitchSemitones" || value === "ampGainDb" || value === "pan") {
    return value;
  }
  return "wavetablePosition";
}
function normalizeSourceSlot(sourceKind, rawSlot) {
  const numericSlot = Math.round(Number(rawSlot));
  if (sourceKind === "velocity" || sourceKind === "pressure" || sourceKind === "slide") {
    return null;
  }
  const maxSlot = sourceKind === "mseg" ? MODULATION_MSEG_SLOT_COUNT : MODULATION_ENV_SLOT_COUNT;
  return clamp$4(Number.isFinite(numericSlot) ? numericSlot : 1, 1, maxSlot);
}
function createDefaultEnvelope(slotIndex) {
  return {
    name: ENV_SLOT_NAMES[slotIndex] ?? `Env ${slotIndex + 1}`,
    attackSeconds: 0.01,
    decaySeconds: 0.25,
    sustain: 0.5,
    releaseSeconds: 0.2
  };
}
function normalizeEnvelope(value, slotIndex = 0) {
  const nextValue = value && typeof value === "object" ? value : {};
  const fallback = createDefaultEnvelope(slotIndex);
  return {
    name: typeof nextValue.name === "string" && nextValue.name.trim() ? nextValue.name : fallback.name,
    attackSeconds: clampEnvSeconds(nextValue.attackSeconds ?? fallback.attackSeconds, fallback.attackSeconds),
    decaySeconds: clampEnvSeconds(nextValue.decaySeconds ?? fallback.decaySeconds, fallback.decaySeconds),
    sustain: clamp01(nextValue.sustain ?? fallback.sustain),
    releaseSeconds: clampEnvSeconds(nextValue.releaseSeconds ?? fallback.releaseSeconds, fallback.releaseSeconds)
  };
}
function createDefaultRoute(overrides = {}) {
  return {
    id: overrides.id ?? createGeneratedRouteId(),
    enabled: true,
    sourceKind: "mseg",
    sourceSlot: 1,
    polarity: "unipolar",
    targetKind: "wavetablePosition",
    amount: 0,
    ...overrides
  };
}
function normalizeRoute(value, routeIndex = 0) {
  const nextValue = value && typeof value === "object" ? value : {};
  const sourceKind = normalizeSourceKind(nextValue.sourceKind);
  const targetKind = normalizeTargetKind(nextValue.targetKind);
  const numericAmount = Number(nextValue.amount);
  return {
    id: normalizeRouteId(nextValue.id, routeIndex),
    enabled: nextValue.enabled !== false,
    sourceKind,
    sourceSlot: normalizeSourceSlot(sourceKind, nextValue.sourceSlot),
    polarity: normalizePolarity(nextValue.polarity),
    targetKind,
    amount: clampModulationRouteAmount(targetKind, numericAmount)
  };
}
function normalizeMsegSlot(value, slotIndex) {
  const nextValue = value && typeof value === "object" ? value : {};
  const defaultShape = createDefaultMsegShape(MSEG_SLOT_NAMES[slotIndex] ?? `MSEG ${slotIndex + 1}`);
  return {
    shape: normalizeMsegShape(nextValue.shape ?? defaultShape),
    playback: normalizeMsegPlayback(nextValue.playback ?? createDefaultMsegPlayback())
  };
}
function createDefaultModulationState() {
  return {
    format: "cosimo.modulation",
    version: 1,
    msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot({}, slotIndex)),
    envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => createDefaultEnvelope(slotIndex)),
    routes: [createDefaultRoute({ id: "mod-route-1" })]
  };
}
function normalizeModulationState(value = createDefaultModulationState()) {
  const nextValue = value && typeof value === "object" ? value : {};
  const inputMsegSlots = Array.isArray(nextValue.msegSlots) ? nextValue.msegSlots : [];
  const inputEnvelopeSlots = Array.isArray(nextValue.envelopeSlots) ? nextValue.envelopeSlots : [];
  const inputRoutes = Array.isArray(nextValue.routes) ? nextValue.routes : [];
  return {
    format: "cosimo.modulation",
    version: 1,
    msegSlots: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => normalizeMsegSlot(inputMsegSlots[slotIndex], slotIndex)),
    envelopeSlots: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => normalizeEnvelope(inputEnvelopeSlots[slotIndex], slotIndex)),
    routes: inputRoutes.slice(0, MODULATION_MAX_ROUTES).map((route, routeIndex) => normalizeRoute(route, routeIndex))
  };
}
function serializeModulationState(state) {
  return JSON.stringify(normalizeModulationState(state));
}
function deserializeModulationState(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return createDefaultModulationState();
  }
  try {
    return normalizeModulationState(JSON.parse(value));
  } catch {
    return createDefaultModulationState();
  }
}
function modulationStatesEqual(left, right) {
  return serializeModulationState(left) === serializeModulationState(right);
}
function toStoredStateEchoToken(value) {
  try {
    return `${typeof value}:${JSON.stringify(value)}`;
  } catch {
    return `${typeof value}:${String(value)}`;
  }
}
function sourceKindToCode(sourceKind) {
  if (sourceKind === "mseg") return MOD_SOURCE_MSEG;
  if (sourceKind === "env") return MOD_SOURCE_ENV;
  if (sourceKind === "velocity") return MOD_SOURCE_VELOCITY;
  if (sourceKind === "pressure") return MOD_SOURCE_PRESSURE;
  return MOD_SOURCE_SLIDE;
}
function targetKindToCode(targetKind) {
  if (targetKind === "wavetablePosition") return MOD_TARGET_WAVETABLE_POSITION;
  if (targetKind === "warpAmount") return MOD_TARGET_WARP_AMOUNT;
  if (targetKind === "filterCutoffOctaves") return MOD_TARGET_FILTER_CUTOFF_OCTAVES;
  if (targetKind === "filterQ") return MOD_TARGET_FILTER_Q;
  if (targetKind === "pitchSemitones") return MOD_TARGET_PITCH_SEMITONES;
  if (targetKind === "ampGainDb") return MOD_TARGET_AMP_GAIN_DB;
  return MOD_TARGET_PAN;
}
function toMsegPlaybackUpload(slotIndex, playback) {
  return {
    slot: slotIndex + 1,
    seconds: clampMsegRateSeconds(playback.rate.seconds),
    holdFinalValue: playback.holdFinalValue !== false,
    rateKind: 0,
    loopEnabled: Boolean(playback.loop),
    loopStart: playback.loop?.startX ?? 0,
    loopEnd: playback.loop?.endX ?? 1,
    noteOffPolicy: playback.noteOffPolicy === "immediate" ? 1 : playback.noteOffPolicy === "ignore" ? 2 : 0,
    legatoRestarts: Boolean(playback.legatoRestarts)
  };
}
function toMsegBufferUpload(slotIndex, shape) {
  return {
    slot: slotIndex + 1,
    buffer: Array.from(renderMsegShape(shape))
  };
}
function toEnvelopeUpload(slotIndex, envelope) {
  return {
    slot: slotIndex + 1,
    attackSeconds: envelope.attackSeconds,
    decaySeconds: envelope.decaySeconds,
    sustain: envelope.sustain,
    releaseSeconds: envelope.releaseSeconds
  };
}
function toRouteUpload(routeIndex, route) {
  const normalizedRoute = route ? normalizeRoute(route) : null;
  const isEnabled = normalizedRoute?.enabled ?? false;
  return {
    routeIndex,
    enabled: isEnabled,
    sourceKind: sourceKindToCode(normalizedRoute?.sourceKind ?? "mseg"),
    sourceSlot: isEnabled ? normalizedRoute?.sourceSlot ?? 0 : 0,
    polarityKind: polarityToCode(normalizedRoute?.polarity ?? "unipolar"),
    targetKind: targetKindToCode(normalizedRoute?.targetKind ?? "wavetablePosition"),
    amount: isEnabled ? normalizedRoute?.amount ?? 0 : 0
  };
}
function getModulationSourceOptionValue(route) {
  const match = MODULATION_SOURCE_OPTIONS.find((option) => option.sourceKind === route.sourceKind && option.sourceSlot === route.sourceSlot);
  return match?.value ?? MODULATION_SOURCE_OPTIONS[0].value;
}
function applyModulationSourceOption(route, sourceValue) {
  const option = MODULATION_SOURCE_OPTIONS.find((candidate) => candidate.value === sourceValue) ?? MODULATION_SOURCE_OPTIONS[0];
  return {
    ...route,
    sourceKind: option.sourceKind,
    sourceSlot: option.sourceSlot
  };
}
class ModulationMsegSlotController {
  bridge;
  slotIndex;
  constructor(bridge, slotIndex) {
    this.bridge = bridge;
    this.slotIndex = slotIndex;
  }
  getState() {
    const slot = this.bridge.getState().msegSlots[this.slotIndex];
    return {
      shape: slot.shape,
      playback: slot.playback,
      depth: MSEG_DEFAULT_DEPTH
    };
  }
  setShape(nextShape) {
    this.bridge.setMsegSlotShape(this.slotIndex, nextShape);
  }
  setPlayback(nextPlayback) {
    this.bridge.setMsegSlotPlayback(this.slotIndex, nextPlayback);
  }
  addPoint(x, y) {
    this.setShape(addMsegPoint(this.getState().shape, x, y));
  }
  movePoint(pointIndex, x, y) {
    this.setShape(moveMsegPoint(this.getState().shape, pointIndex, x, y));
  }
  deletePoint(pointIndex) {
    this.setShape(deleteMsegPoint(this.getState().shape, pointIndex));
  }
  setSegmentCurvePower(segmentIndex, curvePower) {
    this.setShape(setMsegSegmentCurvePower(this.getState().shape, segmentIndex, curvePower));
  }
}
class ModulationRuntimeBridge {
  patchConnection;
  state = createDefaultModulationState();
  suppressStoredStateEvents = 0;
  pendingStoredStateEchoes = /* @__PURE__ */ new Map();
  stateListeners = /* @__PURE__ */ new Set();
  slotControllers = Array.from(
    { length: MODULATION_MSEG_SLOT_COUNT },
    (_, slotIndex) => new ModulationMsegSlotController(this, slotIndex)
  );
  constructor(patchConnection) {
    this.patchConnection = patchConnection;
    this.handleStoredStateValue = this.handleStoredStateValue.bind(this);
  }
  attach() {
    this.patchConnection.addStoredStateValueListener?.(this.handleStoredStateValue);
  }
  detach() {
    this.patchConnection.removeStoredStateValueListener?.(this.handleStoredStateValue);
  }
  requestBootState() {
    if (typeof this.patchConnection.requestFullStoredState === "function") {
      this.patchConnection.requestFullStoredState((storedState) => {
        const fullState = storedState && typeof storedState === "object" ? storedState : {};
        this.applyStoredState(fullState[MODULATION_STATE_KEY], true);
      });
      return;
    }
    if (typeof this.patchConnection.requestStoredStateValue === "function") {
      this.patchConnection.requestStoredStateValue(MODULATION_STATE_KEY);
      return;
    }
    this.uploadAll();
    this.emitStateChange();
  }
  getState() {
    return this.state;
  }
  subscribe(listener) {
    this.stateListeners.add(listener);
  }
  unsubscribe(listener) {
    this.stateListeners.delete(listener);
  }
  getMsegSlotController(slotIndex) {
    return this.slotControllers[clamp$4(Math.round(slotIndex), 0, MODULATION_MSEG_SLOT_COUNT - 1)];
  }
  setState(nextState) {
    const normalizedState = normalizeModulationState(nextState);
    if (modulationStatesEqual(this.state, normalizedState)) {
      return;
    }
    this.state = normalizedState;
    this.persistState();
    this.uploadAll();
    this.emitStateChange();
  }
  setMsegSlotShape(slotIndex, nextShape) {
    const normalizedShape = normalizeMsegShape(nextShape);
    const currentSlot = this.state.msegSlots[slotIndex];
    if (msegShapesEqual(currentSlot.shape, normalizedShape)) {
      return;
    }
    this.updateState((previousState) => {
      const nextMsegSlots = previousState.msegSlots.map((slot, index) => index === slotIndex ? { ...slot, shape: normalizedShape } : slot);
      return {
        ...previousState,
        msegSlots: nextMsegSlots
      };
    });
    this.uploadMsegBuffer(slotIndex);
  }
  setMsegSlotPlayback(slotIndex, nextPlayback) {
    const normalizedPlayback = normalizeMsegPlayback(nextPlayback);
    const currentSlot = this.state.msegSlots[slotIndex];
    if (msegPlaybacksEqual(currentSlot.playback, normalizedPlayback)) {
      return;
    }
    this.updateState((previousState) => {
      const nextMsegSlots = previousState.msegSlots.map((slot, index) => index === slotIndex ? { ...slot, playback: normalizedPlayback } : slot);
      return {
        ...previousState,
        msegSlots: nextMsegSlots
      };
    });
    this.uploadMsegPlayback(slotIndex);
  }
  setEnvelope(slotIndex, nextEnvelope) {
    const normalizedEnvelope = normalizeEnvelope(nextEnvelope, slotIndex);
    const currentEnvelope = this.state.envelopeSlots[slotIndex];
    if (JSON.stringify(currentEnvelope) === JSON.stringify(normalizedEnvelope)) {
      return;
    }
    this.updateState((previousState) => ({
      ...previousState,
      envelopeSlots: previousState.envelopeSlots.map((envelope, index) => index === slotIndex ? normalizedEnvelope : envelope)
    }));
    this.uploadEnvelope(slotIndex);
  }
  replaceRoutes(nextRoutes) {
    const normalizedRoutes = Array.isArray(nextRoutes) ? nextRoutes.slice(0, MODULATION_MAX_ROUTES).map((route, routeIndex) => normalizeRoute(route, routeIndex)) : [];
    if (JSON.stringify(this.state.routes) === JSON.stringify(normalizedRoutes)) {
      return;
    }
    this.updateState((previousState) => ({
      ...previousState,
      routes: normalizedRoutes
    }));
    this.uploadRoutes();
  }
  setRoute(routeIndex, nextRoute) {
    const normalizedRoute = normalizeRoute(nextRoute, routeIndex);
    const currentRoutes = [...this.state.routes];
    while (currentRoutes.length <= routeIndex) {
      currentRoutes.push(createDefaultRoute());
    }
    if (JSON.stringify(currentRoutes[routeIndex]) === JSON.stringify(normalizedRoute)) {
      return;
    }
    currentRoutes[routeIndex] = normalizedRoute;
    this.replaceRoutes(currentRoutes);
  }
  addRoute(nextRoute = createDefaultRoute()) {
    if (this.state.routes.length >= MODULATION_MAX_ROUTES) {
      return;
    }
    this.replaceRoutes([...this.state.routes, normalizeRoute(nextRoute, this.state.routes.length)]);
  }
  removeRoute(routeIndex) {
    if (routeIndex < 0 || routeIndex >= this.state.routes.length) {
      return;
    }
    const nextRoutes = this.state.routes.filter((_, index) => index !== routeIndex);
    this.replaceRoutes(nextRoutes);
  }
  updateState(update) {
    const nextState = normalizeModulationState(update(this.state));
    if (modulationStatesEqual(this.state, nextState)) {
      return;
    }
    this.state = nextState;
    this.persistState();
    this.emitStateChange();
  }
  applyStoredState(rawValue, uploadAll) {
    const nextState = deserializeModulationState(rawValue);
    this.state = nextState;
    if (uploadAll) {
      this.uploadAll();
    }
    this.emitStateChange();
  }
  handleStoredStateValue(message) {
    if (!message || typeof message !== "object") {
      return;
    }
    const nextMessage = message;
    if (this.suppressStoredStateEvents > 0) {
      return;
    }
    if (typeof nextMessage.key === "string" && this.consumePendingStoredStateEcho(nextMessage.key, nextMessage.value)) {
      return;
    }
    if (nextMessage.key === MODULATION_STATE_KEY) {
      this.applyStoredState(nextMessage.value, true);
    }
  }
  persistState() {
    if (typeof this.patchConnection.sendStoredStateValue !== "function") {
      return;
    }
    const persistedModulationState = serializeModulationState(this.state);
    this.suppressStoredStateEvents += 1;
    try {
      this.rememberPendingStoredStateEcho(MODULATION_STATE_KEY, persistedModulationState);
      this.patchConnection.sendStoredStateValue(MODULATION_STATE_KEY, persistedModulationState);
    } finally {
      this.suppressStoredStateEvents -= 1;
    }
  }
  uploadAll() {
    this.patchConnection.sendEventOrValue?.(MODULATION_ENABLE_ENDPOINT_ID, 0);
    this.patchConnection.sendEventOrValue?.(MODULATION_CLEAR_ENDPOINT_ID, 1);
    for (let slotIndex = 0; slotIndex < MODULATION_MSEG_SLOT_COUNT; slotIndex += 1) {
      this.uploadMsegSlot(slotIndex);
    }
    for (let slotIndex = 0; slotIndex < MODULATION_ENV_SLOT_COUNT; slotIndex += 1) {
      this.uploadEnvelope(slotIndex);
    }
    this.uploadRoutes();
    this.patchConnection.sendEventOrValue?.(MODULATION_ENABLE_ENDPOINT_ID, 1);
  }
  uploadMsegSlot(slotIndex) {
    this.uploadMsegBuffer(slotIndex);
    this.uploadMsegPlayback(slotIndex);
  }
  uploadMsegBuffer(slotIndex) {
    const slot = this.state.msegSlots[slotIndex];
    this.patchConnection.sendEventOrValue?.(
      MODULATION_MSEG_BUFFER_ENDPOINT_ID,
      toMsegBufferUpload(slotIndex, slot.shape)
    );
  }
  uploadMsegPlayback(slotIndex) {
    const slot = this.state.msegSlots[slotIndex];
    this.patchConnection.sendEventOrValue?.(
      MODULATION_MSEG_PLAYBACK_ENDPOINT_ID,
      toMsegPlaybackUpload(slotIndex, slot.playback)
    );
  }
  uploadEnvelope(slotIndex) {
    this.patchConnection.sendEventOrValue?.(
      MODULATION_ENV_ENDPOINT_ID,
      toEnvelopeUpload(slotIndex, this.state.envelopeSlots[slotIndex])
    );
  }
  uploadRoutes() {
    for (let routeIndex = 0; routeIndex < MODULATION_MAX_ROUTES; routeIndex += 1) {
      this.patchConnection.sendEventOrValue?.(
        MODULATION_ROUTE_ENDPOINT_ID,
        toRouteUpload(routeIndex, this.state.routes[routeIndex] ?? null)
      );
    }
  }
  emitStateChange() {
    this.stateListeners.forEach((listener) => listener(this.state));
  }
  rememberPendingStoredStateEcho(key, value) {
    const token = toStoredStateEchoToken(value);
    const pendingByToken = this.pendingStoredStateEchoes.get(key) ?? /* @__PURE__ */ new Map();
    pendingByToken.set(token, (pendingByToken.get(token) ?? 0) + 1);
    this.pendingStoredStateEchoes.set(key, pendingByToken);
  }
  consumePendingStoredStateEcho(key, value) {
    const pendingByToken = this.pendingStoredStateEchoes.get(key);
    if (!pendingByToken) {
      return false;
    }
    const token = toStoredStateEchoToken(value);
    const pendingCount = pendingByToken.get(token) ?? 0;
    if (pendingCount <= 0) {
      return false;
    }
    if (pendingCount === 1) {
      pendingByToken.delete(token);
    } else {
      pendingByToken.set(token, pendingCount - 1);
    }
    if (pendingByToken.size === 0) {
      this.pendingStoredStateEchoes.delete(key);
    }
    return true;
  }
}
function buildDisplayedMsegState(bridge, slotIndex) {
  return bridge.getMsegSlotController(slotIndex).getState();
}
const sharedRuntimeBridges = /* @__PURE__ */ new WeakMap();
function acquireModulationRuntimeBridge(patchConnection) {
  const existingEntry = sharedRuntimeBridges.get(patchConnection);
  if (existingEntry) {
    existingEntry.refCount += 1;
    return existingEntry.bridge;
  }
  const bridge = new ModulationRuntimeBridge(patchConnection);
  bridge.attach();
  bridge.requestBootState();
  sharedRuntimeBridges.set(patchConnection, {
    bridge,
    refCount: 1
  });
  return bridge;
}
function releaseModulationRuntimeBridge(patchConnection) {
  const entry = sharedRuntimeBridges.get(patchConnection);
  if (!entry) {
    return;
  }
  entry.refCount -= 1;
  if (entry.refCount > 0) {
    return;
  }
  entry.bridge.detach();
  sharedRuntimeBridges.delete(patchConnection);
}
const VOICE_MODE_OPTIONS = [
  { value: 0, label: "Poly" },
  { value: 1, label: "Mono" },
  { value: 2, label: "Legato" }
];
const MSEG_GRID_STEPS = [0.25, 0.5, 0.75];
const MSEG_PREVIEW_HORIZONTAL_PADDING_PX = 24;
const MSEG_PREVIEW_VERTICAL_PADDING_PX = 22;
const MOD_KNOB_VIEWBOX_SIZE = 72;
const MOD_KNOB_CENTER = MOD_KNOB_VIEWBOX_SIZE / 2;
const MOD_KNOB_RADIUS = 30;
const MOD_KNOB_SIDE_SWEEP_DEGREES = 132;
function polarPointFromTop(center, radius, degreesFromTop) {
  const radians = (degreesFromTop - 90) * Math.PI / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians)
  };
}
function describeArcPath(center, radius, startDegreesFromTop, endDegreesFromTop) {
  const start = polarPointFromTop(center, radius, startDegreesFromTop);
  const end = polarPointFromTop(center, radius, endDegreesFromTop);
  const largeArcFlag = Math.abs(endDegreesFromTop - startDegreesFromTop) > 180 ? 1 : 0;
  const sweepFlag = endDegreesFromTop >= startDegreesFromTop ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}
function joinClasses$1(...classes) {
  return classes.filter(Boolean).join(" ");
}
function useResizeObserver$1(ref) {
  const [size, setSize] = reactExports.useState({ width: 1, height: 1 });
  reactExports.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const host = element;
      setSize({
        width: Math.max(1, bounds.width || host.clientWidth || 1),
        height: Math.max(1, bounds.height || host.clientHeight || 1)
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
function buildMsegSurfacePaths(points, width, height, options = {}) {
  const metrics = createMsegEditorMetrics(width, height, {
    pointRadius: options.pointRadius,
    horizontalPadding: options.horizontalPadding ?? MSEG_EDITOR_HORIZONTAL_PADDING_PX,
    verticalPadding: options.verticalPadding ?? MSEG_EDITOR_VERTICAL_PADDING_PX
  });
  const curvePath = polylineToSvgPath(sampleMsegEditorPolyline(
    { points },
    width,
    height,
    {
      orientation: options.orientation,
      pointRadius: options.pointRadius,
      horizontalPadding: options.horizontalPadding,
      verticalPadding: options.verticalPadding
    }
  ));
  const fillPath = options.orientation === "vertical" ? `${curvePath} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotTop.toFixed(3)} Z` : `${curvePath} L ${metrics.plotRight.toFixed(3)} ${metrics.plotBottom.toFixed(3)} L ${metrics.plotLeft.toFixed(3)} ${metrics.plotBottom.toFixed(3)} Z`;
  return { curvePath, fillPath, metrics };
}
function polylineToSvgPath(polyline) {
  if (polyline.length === 0) {
    return "";
  }
  return polyline.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`).join(" ");
}
function buildMsegSegmentPath(points, segmentIndex, width, height, options = {}) {
  return polylineToSvgPath(sampleMsegSegmentEditorPolyline(
    { points },
    segmentIndex,
    width,
    height,
    options
  ));
}
function MsegPreview({
  points,
  orientation = "horizontal",
  className
}) {
  const viewportRef = reactExports.useRef(null);
  const size = useResizeObserver$1(viewportRef);
  const { curvePath, fillPath, metrics } = reactExports.useMemo(() => {
    return buildMsegSurfacePaths(points, size.width, size.height, {
      orientation,
      pointRadius: 0,
      horizontalPadding: MSEG_PREVIEW_HORIZONTAL_PADDING_PX,
      verticalPadding: MSEG_PREVIEW_VERTICAL_PADDING_PX
    });
  }, [orientation, points, size.height, size.width]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "svg",
    {
      ref: viewportRef,
      className: className ?? "h-32 w-full overflow-hidden rounded-[20px] bg-white/[0.03]",
      viewBox: `0 0 ${size.width} ${size.height}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
          MSEG_GRID_STEPS.map((step) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              className: "cosimo-grid-line",
              x1: metrics.plotLeft,
              y1: metrics.plotTop + metrics.plotHeight * (1 - step),
              x2: metrics.plotRight,
              y2: metrics.plotTop + metrics.plotHeight * (1 - step)
            },
            `h-${step}`
          )),
          MSEG_GRID_STEPS.map((step) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              className: "cosimo-grid-line",
              x1: metrics.plotLeft + metrics.plotWidth * step,
              y1: metrics.plotTop,
              x2: metrics.plotLeft + metrics.plotWidth * step,
              y2: metrics.plotBottom
            },
            `v-${step}`
          ))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("path", { className: "cosimo-curve-fill", d: fillPath }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("path", { className: "cosimo-curve-line", d: curvePath })
      ]
    }
  );
}
function WavetableCanvas({
  frames,
  position,
  warpMode,
  warpAmount
}) {
  const canvasRef = reactExports.useRef(null);
  const viewportRef = reactExports.useRef(null);
  const size = useResizeObserver$1(viewportRef);
  const displayRef = reactExports.useRef(null);
  reactExports.useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    displayRef.current = new CanvasWavetableDisplay(canvasRef.current);
    return () => {
      displayRef.current = null;
    };
  }, []);
  reactExports.useEffect(() => {
    if (!displayRef.current || !frames) {
      return;
    }
    displayRef.current.setFrames(frames);
  }, [frames]);
  reactExports.useEffect(() => {
    displayRef.current?.setPosition(position);
  }, [position]);
  reactExports.useEffect(() => {
    displayRef.current?.setWarp(warpMode, warpAmount);
  }, [warpAmount, warpMode]);
  reactExports.useEffect(() => {
    displayRef.current?.resize(size.width, size.height, window.devicePixelRatio || 1);
  }, [size]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: viewportRef, className: "absolute inset-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("canvas", { ref: canvasRef, className: "h-full w-full" }) });
}
function EditableMsegSurface({
  surfaceRef,
  points,
  selectedPointIndex,
  hoveredSegmentIndex = -1,
  activeSegmentIndex = -1,
  orientation = "horizontal",
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  className,
  dataRole
}) {
  const size = useResizeObserver$1(surfaceRef);
  const emphasizedSegmentIndex = activeSegmentIndex >= 0 ? activeSegmentIndex : hoveredSegmentIndex;
  const hasEmphasizedSegment = emphasizedSegmentIndex >= 0;
  const { curvePath, fillPath, highlightedSegmentPath, metrics } = reactExports.useMemo(() => {
    const basePaths = buildMsegSurfacePaths(points, size.width, size.height, {
      orientation
    });
    const nextHighlightedSegmentPath = emphasizedSegmentIndex >= 0 ? buildMsegSegmentPath(points, emphasizedSegmentIndex, size.width, size.height, { orientation }) : "";
    return {
      ...basePaths,
      highlightedSegmentPath: nextHighlightedSegmentPath
    };
  }, [emphasizedSegmentIndex, orientation, points, size.height, size.width]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "svg",
    {
      ref: surfaceRef,
      "data-role": dataRole,
      className: joinClasses$1(
        "h-full w-full touch-none overflow-hidden rounded-[20px] bg-white/[0.03]",
        className
      ),
      viewBox: `0 0 ${size.width} ${size.height}`,
      onPointerDown,
      onPointerMove,
      onPointerLeave,
      onPointerUp,
      onPointerCancel: onPointerUp,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
          MSEG_GRID_STEPS.map((step) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              className: "cosimo-grid-line",
              x1: metrics.plotLeft,
              y1: metrics.plotTop + metrics.plotHeight * (1 - step),
              x2: metrics.plotRight,
              y2: metrics.plotTop + metrics.plotHeight * (1 - step)
            },
            `editable-h-${step}`
          )),
          MSEG_GRID_STEPS.map((step) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              className: "cosimo-grid-line",
              x1: metrics.plotLeft + metrics.plotWidth * step,
              y1: metrics.plotTop,
              x2: metrics.plotLeft + metrics.plotWidth * step,
              y2: metrics.plotBottom
            },
            `editable-v-${step}`
          ))
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "path",
          {
            "data-role": "mseg-base-fill",
            className: joinClasses$1("cosimo-curve-fill", hasEmphasizedSegment && "cosimo-curve-fill-muted"),
            d: fillPath
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "path",
          {
            "data-role": "mseg-base-curve",
            className: joinClasses$1("cosimo-curve-line", hasEmphasizedSegment && "cosimo-curve-line-muted"),
            d: curvePath
          }
        ),
        highlightedSegmentPath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          "path",
          {
            "data-role": "mseg-highlight-segment",
            "data-segment-index": String(emphasizedSegmentIndex),
            className: "cosimo-curve-line cosimo-curve-line-highlight",
            d: highlightedSegmentPath
          }
        ) : null,
        /* @__PURE__ */ jsxRuntimeExports.jsx("g", { children: points.map((point, pointIndex) => {
          const coordinates = pointToMsegEditorCoordinates(point, size.width, size.height, {
            orientation
          });
          const isSelected = pointIndex === selectedPointIndex;
          const isEmphasizedSegmentEndpoint = hasEmphasizedSegment && (pointIndex === emphasizedSegmentIndex || pointIndex === emphasizedSegmentIndex + 1);
          const pointState = hasEmphasizedSegment ? isEmphasizedSegmentEndpoint ? "highlighted" : "muted" : isSelected ? "selected" : "default";
          const radius = pointState === "selected" ? MSEG_SELECTED_POINT_RADIUS_PX : MSEG_POINT_RADIUS_PX;
          const pointClassName = pointState === "selected" ? "cosimo-mseg-point-selected" : pointState === "highlighted" ? "cosimo-mseg-point-highlight" : pointState === "muted" ? "cosimo-mseg-point-muted" : "cosimo-mseg-point-default";
          return /* @__PURE__ */ jsxRuntimeExports.jsx(
            "circle",
            {
              "data-role": "mseg-point",
              "data-point-index": String(pointIndex),
              "data-point-state": pointState,
              cx: coordinates.x,
              cy: coordinates.y,
              r: radius,
              className: pointClassName,
              vectorEffect: "non-scaling-stroke"
            },
            `point-${pointIndex}-${point.x}-${point.y}`
          );
        }) })
      ]
    }
  );
}
function ModulationAmountField({
  targetKind,
  polarity,
  amount,
  onChange,
  onPolarityChange,
  knobAriaLabel,
  polarityAriaLabel,
  className
}) {
  getModulationAmountDepth(targetKind, amount);
  const knobPosition = getModulationAmountSliderPosition(targetKind, amount);
  const depthLabel = getModulationAmountPercentLabel(targetKind, amount);
  const unitReadout = formatModulationAmountReadout(targetKind, amount, polarity);
  const clampHint = getModulationTargetClampHint(targetKind);
  const knobIndicatorDegrees = (knobPosition - 0.5) * (MOD_KNOB_SIDE_SWEEP_DEGREES * 2);
  const knobFillExtentDegrees = Math.abs(knobIndicatorDegrees);
  const knobTrackPath = reactExports.useMemo(
    () => describeArcPath(MOD_KNOB_CENTER, MOD_KNOB_RADIUS, -MOD_KNOB_SIDE_SWEEP_DEGREES, MOD_KNOB_SIDE_SWEEP_DEGREES),
    []
  );
  const knobFillPath = reactExports.useMemo(() => {
    if (knobFillExtentDegrees <= 1e-4) {
      return null;
    }
    if (polarity === "bipolar") {
      return describeArcPath(
        MOD_KNOB_CENTER,
        MOD_KNOB_RADIUS,
        -knobFillExtentDegrees,
        knobFillExtentDegrees
      );
    }
    if (knobIndicatorDegrees < 0) {
      return describeArcPath(
        MOD_KNOB_CENTER,
        MOD_KNOB_RADIUS,
        knobIndicatorDegrees,
        0
      );
    }
    return describeArcPath(
      MOD_KNOB_CENTER,
      MOD_KNOB_RADIUS,
      0,
      knobIndicatorDegrees
    );
  }, [knobFillExtentDegrees, knobIndicatorDegrees, polarity]);
  const shellClassName = className ? `cosimo-mod-amount-field ${className}` : "cosimo-mod-amount-field";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: shellClassName, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cosimo-mod-direction-toggle", role: "group", "aria-label": polarityAriaLabel, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          "aria-label": `${polarityAriaLabel} unipolar`,
          "aria-pressed": polarity === "unipolar" ? "true" : "false",
          className: "cosimo-mod-direction-button",
          "data-active": polarity === "unipolar" ? "true" : "false",
          onClick: () => onPolarityChange("unipolar"),
          children: "+"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          "aria-label": `${polarityAriaLabel} bipolar`,
          "aria-pressed": polarity === "bipolar" ? "true" : "false",
          className: "cosimo-mod-direction-button",
          "data-active": polarity === "bipolar" ? "true" : "false",
          onClick: () => onPolarityChange("bipolar"),
          children: "±"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cosimo-mod-knob-stack", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cosimo-mod-knob", title: clampHint, "data-polarity": polarity, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cosimo-mod-knob-track", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "cosimo-mod-knob-arc", viewBox: `0 0 ${MOD_KNOB_VIEWBOX_SIZE} ${MOD_KNOB_VIEWBOX_SIZE}`, "aria-hidden": "true", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "path",
              {
                d: knobTrackPath,
                className: "cosimo-mod-knob-arc-track",
                pathLength: "1"
              }
            ),
            knobFillPath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
              "path",
              {
                d: knobFillPath,
                className: "cosimo-mod-knob-arc-fill",
                pathLength: "1"
              }
            ) : null
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cosimo-mod-knob-core", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cosimo-mod-knob-percent", children: depthLabel }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cosimo-mod-knob-center-marker" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "cosimo-mod-knob-indicator",
              style: { transform: `translateX(-50%) rotate(${knobIndicatorDegrees}deg)` }
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "cosimo-mod-knob-input",
            type: "range",
            min: "0",
            max: "1",
            step: "0.001",
            "aria-label": knobAriaLabel,
            value: knobPosition.toFixed(3),
            onChange: (event) => onChange(composeModulationAmount(targetKind, Number(event.target.value)))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cosimo-mod-amount-copy", title: clampHint, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cosimo-mod-amount-readout", children: unitReadout }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cosimo-mod-amount-caption", children: "Requested" })
      ] })
    ] })
  ] });
}
const DISTORTION_SCOPE_ENDPOINT_ID = "distortionScope";
const DISTORTION_SCOPE_CLIP_EPSILON = 25e-4;
const DISTORTION_FIXED_DISPLAY_RANGE = 2;
const DISTORTION_CURVE_POINT_COUNT = 241;
const DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT = 81;
const DISTORTION_TRANSFER_OCCUPANCY_ACTIVITY_EPSILON = 0.035;
function clamp$3(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function coerceFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
function coerceNumberArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map((entry) => coerceFiniteNumber(entry)).filter((entry) => entry !== null);
}
function findPeak(samples) {
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  return peak;
}
function normalizeDistortionScopeMessage(message) {
  const payload = message && typeof message === "object" && "event" in message && message.event ? message.event : message;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload;
  const inputSamples = coerceNumberArray(record.inputSamples);
  const outputSamples = coerceNumberArray(record.outputSamples);
  if (!inputSamples || !outputSamples) {
    return null;
  }
  const sampleCount = Math.min(inputSamples.length, outputSamples.length);
  if (sampleCount <= 0) {
    return null;
  }
  const normalizedInput = inputSamples.slice(0, sampleCount);
  const normalizedOutput = outputSamples.slice(0, sampleCount);
  const computedInputPeak = findPeak(normalizedInput);
  const computedOutputPeak = findPeak(normalizedOutput);
  const computedRemovedPeak = findPeak(normalizedInput.map((inputSample, index) => inputSample - normalizedOutput[index]));
  return {
    sampleRateHz: Math.max(1, coerceFiniteNumber(record.sampleRateHz) ?? 44100),
    dominantChannel: clamp$3(Math.round(coerceFiniteNumber(record.dominantChannel) ?? 0), 0, 1),
    inputPeak: Math.max(0, coerceFiniteNumber(record.inputPeak) ?? computedInputPeak),
    outputPeak: Math.max(0, coerceFiniteNumber(record.outputPeak) ?? computedOutputPeak),
    removedPeak: Math.max(0, coerceFiniteNumber(record.removedPeak) ?? computedRemovedPeak),
    inputSamples: normalizedInput,
    outputSamples: normalizedOutput
  };
}
function shapeDistortionSample(inputSample, knee) {
  const clampedKnee = clamp$3(Number(knee) || 0, 0, 1);
  const exponent = 2 + 14 * clampedKnee * clampedKnee;
  const magnitude = Math.abs(Number(inputSample) || 0);
  const denominator = Math.pow(1 + Math.pow(magnitude, exponent), 1 / exponent);
  return inputSample / denominator;
}
function buildDistortionSamplePoints(frame) {
  const sampleCount = Math.min(frame.inputSamples.length, frame.outputSamples.length);
  const points = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const input = frame.inputSamples[index] ?? 0;
    const output = frame.outputSamples[index] ?? 0;
    const removed = input - output;
    points.push({
      input,
      output,
      removed,
      clipped: Math.abs(removed) >= DISTORTION_SCOPE_CLIP_EPSILON
    });
  }
  return points;
}
function smoothSeries(values) {
  const kernel = [1, 2, 3, 2, 1];
  return values.map((_, index) => {
    let weightedTotal = 0;
    let weightTotal = 0;
    for (let kernelIndex = 0; kernelIndex < kernel.length; kernelIndex += 1) {
      const offset = kernelIndex - 2;
      const value = values[index + offset];
      if (value === void 0) {
        continue;
      }
      const weight = kernel[kernelIndex] ?? 0;
      weightedTotal += value * weight;
      weightTotal += weight;
    }
    return weightTotal > 0 ? weightedTotal / weightTotal : 0;
  });
}
function normalizeSeries(values) {
  const peak = values.reduce((currentPeak, value) => Math.max(currentPeak, value), 0);
  if (peak <= 1e-6) {
    return values.map(() => 0);
  }
  return values.map((value) => value / peak);
}
function buildDistortionTransferOccupancy({
  samplePoints,
  knee,
  inputRange,
  binCount = DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT
}) {
  const safeInputRange = Math.max(1, Number(inputRange) || DISTORTION_FIXED_DISPLAY_RANGE);
  const safeBinCount = Math.max(9, Math.round(Number(binCount) || DISTORTION_TRANSFER_OCCUPANCY_BIN_COUNT));
  const densityBins = new Array(safeBinCount).fill(0);
  const removedBins = new Array(safeBinCount).fill(0);
  const clippedBins = new Array(safeBinCount).fill(0);
  let leftOverflowCount = 0;
  let rightOverflowCount = 0;
  for (const point of samplePoints) {
    if (point.input < -safeInputRange) {
      leftOverflowCount += 1;
      continue;
    }
    if (point.input > safeInputRange) {
      rightOverflowCount += 1;
      continue;
    }
    const normalized = (point.input + safeInputRange) / (safeInputRange * 2);
    const binIndex = clamp$3(
      Math.round(normalized * (safeBinCount - 1)),
      0,
      safeBinCount - 1
    );
    densityBins[binIndex] += 1;
    removedBins[binIndex] += Math.abs(point.removed);
    clippedBins[binIndex] += point.clipped ? 1 : 0;
  }
  const smoothedDensity = normalizeSeries(smoothSeries(densityBins));
  const smoothedRemoved = normalizeSeries(smoothSeries(removedBins));
  const smoothedClipped = smoothSeries(clippedBins).map((value, index) => {
    const density = densityBins[index] ?? 0;
    return density > 0 ? clamp$3(value / density, 0, 1) : 0;
  });
  const rawPoints = Array.from({ length: safeBinCount }, (_, index) => {
    const normalized = safeBinCount <= 1 ? 0 : index / (safeBinCount - 1);
    const input = normalized * safeInputRange * 2 - safeInputRange;
    return {
      input,
      output: shapeDistortionSample(input, knee),
      density: smoothedDensity[index] ?? 0,
      removed: smoothedRemoved[index] ?? 0,
      clipped: clamp$3(smoothedClipped[index] ?? 0, 0, 1)
    };
  });
  const segments = [];
  let currentSegment = [];
  for (const point of rawPoints) {
    if (point.density >= DISTORTION_TRANSFER_OCCUPANCY_ACTIVITY_EPSILON) {
      currentSegment.push(point);
      continue;
    }
    if (currentSegment.length >= 2) {
      segments.push(currentSegment);
    }
    currentSegment = [];
  }
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }
  return {
    segments,
    leftOverflowCount,
    rightOverflowCount,
    peakDensity: smoothedDensity.reduce((currentPeak, value) => Math.max(currentPeak, value), 0),
    peakRemoved: smoothedRemoved.reduce((currentPeak, value) => Math.max(currentPeak, value), 0)
  };
}
function sampleDistortionCurve({
  knee,
  inputRange,
  pointCount = DISTORTION_CURVE_POINT_COUNT
}) {
  const safePointCount = Math.max(3, Math.round(pointCount || DISTORTION_CURVE_POINT_COUNT));
  const safeInputRange = Math.max(1, Number(inputRange) || DISTORTION_FIXED_DISPLAY_RANGE);
  return Array.from({ length: safePointCount }, (_, index) => {
    const normalized = safePointCount <= 1 ? 0 : index / (safePointCount - 1);
    const input = normalized * safeInputRange * 2 - safeInputRange;
    return {
      input,
      output: shapeDistortionSample(input, knee)
    };
  });
}
function advanceDistortionDisplayState(previousState, frame, timestampMs) {
  return {
    frame,
    displayRange: DISTORTION_FIXED_DISPLAY_RANGE
  };
}
const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 532;
const TRANSFER_PLOT = {
  left: 34,
  top: 30,
  width: 572,
  height: 248
};
const HISTORY_PLOT = {
  left: 34,
  top: 322,
  width: 572,
  height: 164
};
const HISTORY_CLIPPED_POINT_STRIDE = 9;
function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}
function clamp$2(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function mapPlotX(sampleValue, plot, range) {
  const normalized = clamp$2((sampleValue + range) / (Math.max(range, 1e-6) * 2), 0, 1);
  return plot.left + plot.width * normalized;
}
function mapPlotY(sampleValue, plot, range) {
  const normalized = clamp$2((range - sampleValue) / (Math.max(range, 1e-6) * 2), 0, 1);
  return plot.top + plot.height * normalized;
}
function mapHistoryX(sampleIndex, sampleCount) {
  const normalized = sampleCount <= 1 ? 0 : sampleIndex / (sampleCount - 1);
  return HISTORY_PLOT.left + HISTORY_PLOT.width * normalized;
}
function buildPolylinePath(points) {
  if (points.length === 0) {
    return "";
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}
function buildFilledBridgePath(upper, lower) {
  if (upper.length === 0 || lower.length === 0 || upper.length !== lower.length) {
    return "";
  }
  const head = buildPolylinePath(upper);
  const tail = lower.slice().reverse().map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  return `${head} ${tail} Z`;
}
function normalizeVector(dx, dy) {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= 1e-6) {
    return {
      x: 0,
      y: -1
    };
  }
  return {
    x: dx / magnitude,
    y: dy / magnitude
  };
}
function buildRibbonPath(points) {
  if (points.length < 2) {
    return "";
  }
  const upper = [];
  const lower = [];
  for (let index = 0; index < points.length; index += 1) {
    const currentPoint = points[index];
    if (!currentPoint) {
      continue;
    }
    const previousPoint = points[Math.max(0, index - 1)] ?? currentPoint;
    const nextPoint = points[Math.min(points.length - 1, index + 1)] ?? currentPoint;
    const tangent = normalizeVector(
      nextPoint.x - previousPoint.x,
      nextPoint.y - previousPoint.y
    );
    const normal = {
      x: -tangent.y,
      y: tangent.x
    };
    const halfWidth = Math.max(0, currentPoint.width) * 0.5;
    upper.push({
      x: currentPoint.x + normal.x * halfWidth,
      y: currentPoint.y + normal.y * halfWidth
    });
    lower.push({
      x: currentPoint.x - normal.x * halfWidth,
      y: currentPoint.y - normal.y * halfWidth
    });
  }
  return buildFilledBridgePath(upper, lower);
}
function buildAxisLabelX(sampleValue, plot, range) {
  return mapPlotX(sampleValue, plot, range);
}
function buildAxisLabelY(sampleValue, plot, range) {
  return mapPlotY(sampleValue, plot, range);
}
function DistortionVisualizer({
  knee,
  frame,
  className
}) {
  const [displayState, setDisplayState] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!frame) {
      return;
    }
    setDisplayState((previousState) => advanceDistortionDisplayState(previousState, frame, performance.now()));
  }, [frame]);
  const activeFrame = displayState?.frame ?? frame;
  const displayRange = displayState?.displayRange ?? 2;
  const samplePoints = reactExports.useMemo(
    () => activeFrame ? buildDistortionSamplePoints(activeFrame) : [],
    [activeFrame]
  );
  const transferCurve = reactExports.useMemo(
    () => sampleDistortionCurve({ knee, inputRange: displayRange }),
    [displayRange, knee]
  );
  const transferOccupancy = reactExports.useMemo(() => buildDistortionTransferOccupancy({
    samplePoints,
    knee,
    inputRange: displayRange
  }), [displayRange, knee, samplePoints]);
  const transferCurvePath = reactExports.useMemo(() => buildPolylinePath(
    transferCurve.map((point) => ({
      x: mapPlotX(point.input, TRANSFER_PLOT, displayRange),
      y: mapPlotY(point.output, TRANSFER_PLOT, displayRange)
    }))
  ), [displayRange, transferCurve]);
  const transferOccupancyPaths = reactExports.useMemo(() => transferOccupancy.segments.map((segment) => {
    const mappedPoints = segment.map((point) => ({
      x: mapPlotX(point.input, TRANSFER_PLOT, displayRange),
      y: mapPlotY(point.output, TRANSFER_PLOT, displayRange),
      density: point.density,
      removed: point.removed,
      clipped: point.clipped
    }));
    const occupancyPath = buildRibbonPath(mappedPoints.map((point) => ({
      x: point.x,
      y: point.y,
      width: 8 + point.density * 18
    })));
    const clippedPath = buildRibbonPath(mappedPoints.map((point) => ({
      x: point.x,
      y: point.y,
      width: Math.max(0, point.density * point.removed * Math.max(0.25, point.clipped) * 28)
    })));
    const peakDensity = mappedPoints.reduce((peak, point) => Math.max(peak, point.density), 0);
    const peakRemoved = mappedPoints.reduce((peak, point) => Math.max(peak, point.removed), 0);
    const peakClipped = mappedPoints.reduce((peak, point) => Math.max(peak, point.clipped), 0);
    return {
      occupancyPath,
      clippedPath,
      occupancyOpacity: clamp$2(0.14 + peakDensity * 0.34, 0.14, 0.48),
      clippedOpacity: clamp$2(peakRemoved * 0.62 + peakClipped * 0.24, 0, 0.72)
    };
  }).filter((segment) => segment.occupancyPath), [displayRange, transferOccupancy]);
  const historyInputPoints = reactExports.useMemo(() => samplePoints.map((point, index) => ({
    x: mapHistoryX(index, samplePoints.length),
    y: mapPlotY(point.input, HISTORY_PLOT, displayRange),
    clipped: point.clipped
  })), [displayRange, samplePoints]);
  const historyOutputPoints = reactExports.useMemo(() => samplePoints.map((point, index) => ({
    x: mapHistoryX(index, samplePoints.length),
    y: mapPlotY(point.output, HISTORY_PLOT, displayRange),
    clipped: point.clipped
  })), [displayRange, samplePoints]);
  const historyInputPath = reactExports.useMemo(() => buildPolylinePath(
    historyInputPoints.map(({ x, y }) => ({ x, y }))
  ), [historyInputPoints]);
  const historyOutputPath = reactExports.useMemo(() => buildPolylinePath(
    historyOutputPoints.map(({ x, y }) => ({ x, y }))
  ), [historyOutputPoints]);
  const removedFillPath = reactExports.useMemo(() => buildFilledBridgePath(
    historyInputPoints.map(({ x, y }) => ({ x, y })),
    historyOutputPoints.map(({ x, y }) => ({ x, y }))
  ), [historyInputPoints, historyOutputPoints]);
  const clippedHistoryPoints = reactExports.useMemo(() => historyInputPoints.filter((point, index) => point.clipped && index % HISTORY_CLIPPED_POINT_STRIDE === 0), [historyInputPoints]);
  const overshoot = Math.max(0, (activeFrame?.inputPeak ?? 0) - 1);
  const headroom = Math.max(0, 1 - (activeFrame?.inputPeak ?? 0));
  const clippedSampleCount = samplePoints.reduce((count, point) => count + (point.clipped ? 1 : 0), 0);
  const debugState = reactExports.useMemo(() => ({
    hasScope: Boolean(activeFrame),
    displayRange,
    sampleCount: samplePoints.length,
    clippedSampleCount,
    inputPeak: activeFrame?.inputPeak ?? 0,
    outputPeak: activeFrame?.outputPeak ?? 0,
    removedPeak: activeFrame?.removedPeak ?? 0,
    overshoot,
    headroom,
    transfer: {
      samplePointCount: samplePoints.length,
      occupancySegmentCount: transferOccupancyPaths.length,
      clippedOccupancySegmentCount: transferOccupancyPaths.filter((segment) => segment.clippedPath).length,
      peakDensity: transferOccupancy.peakDensity,
      peakRemoved: transferOccupancy.peakRemoved,
      leftOverflowCount: transferOccupancy.leftOverflowCount,
      rightOverflowCount: transferOccupancy.rightOverflowCount,
      plot: TRANSFER_PLOT
    },
    history: {
      pointCount: historyInputPoints.length,
      clippedPointCount: clippedHistoryPoints.length,
      plot: HISTORY_PLOT
    }
  }), [
    activeFrame,
    clippedHistoryPoints.length,
    clippedSampleCount,
    displayRange,
    headroom,
    historyInputPoints.length,
    overshoot,
    samplePoints.length,
    transferOccupancy.leftOverflowCount,
    transferOccupancy.peakDensity,
    transferOccupancy.peakRemoved,
    transferOccupancy.rightOverflowCount,
    transferOccupancyPaths
  ]);
  const ceilingYTransferTop = buildAxisLabelY(1, TRANSFER_PLOT, displayRange);
  const ceilingYTransferBottom = buildAxisLabelY(-1, TRANSFER_PLOT, displayRange);
  const ceilingXTransferLeft = buildAxisLabelX(-1, TRANSFER_PLOT, displayRange);
  const ceilingXTransferRight = buildAxisLabelX(1, TRANSFER_PLOT, displayRange);
  const ceilingYHistoryTop = buildAxisLabelY(1, HISTORY_PLOT, displayRange);
  const ceilingYHistoryBottom = buildAxisLabelY(-1, HISTORY_PLOT, displayRange);
  const zeroYTransfer = buildAxisLabelY(0, TRANSFER_PLOT, displayRange);
  const zeroXTransfer = buildAxisLabelX(0, TRANSFER_PLOT, displayRange);
  const zeroYHistory = buildAxisLabelY(0, HISTORY_PLOT, displayRange);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: joinClasses("grid gap-3", className), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-300/62", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: "Wet Transfer" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[10px] tracking-[0.18em] text-cyan-100/75", children: overshoot > 0 ? `Overshoot +${overshoot.toFixed(2)}` : `Headroom ${(headroom * 100).toFixed(0)}%` })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(2,6,18,0.95),rgba(1,3,9,1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "svg",
      {
        "data-role": "distortion-visualizer",
        viewBox: `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
        className: "block h-auto w-full",
        "aria-label": "Distortion visualization",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("defs", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("linearGradient", { id: "distortionRemovedFill", x1: "0", x2: "0", y1: "0", y2: "1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "0%", stopColor: "rgba(251,113,133,0.42)" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "100%", stopColor: "rgba(239,68,68,0.04)" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("filter", { id: "distortionTransferOccupancyGlow", x: "-18%", y: "-18%", width: "136%", height: "136%", children: /* @__PURE__ */ jsxRuntimeExports.jsx("feGaussianBlur", { stdDeviation: "5.6" }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("rect", { x: "0", y: "0", width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT, fill: "#020611" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "rect",
            {
              x: TRANSFER_PLOT.left,
              y: TRANSFER_PLOT.top,
              width: TRANSFER_PLOT.width,
              height: TRANSFER_PLOT.height,
              rx: "22",
              fill: "rgba(255,255,255,0.025)",
              stroke: "rgba(255,255,255,0.06)"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "rect",
            {
              x: HISTORY_PLOT.left,
              y: HISTORY_PLOT.top,
              width: HISTORY_PLOT.width,
              height: HISTORY_PLOT.height,
              rx: "22",
              fill: "rgba(255,255,255,0.025)",
              stroke: "rgba(255,255,255,0.06)"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: TRANSFER_PLOT.left + 14, y: TRANSFER_PLOT.top + 22, fill: "rgba(226,232,240,0.58)", fontSize: "11", letterSpacing: "0.2em", children: "CURVE DOMAIN" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: HISTORY_PLOT.left + 14, y: HISTORY_PLOT.top + 22, fill: "rgba(226,232,240,0.58)", fontSize: "11", letterSpacing: "0.2em", children: "TIME HISTORY" }),
          [ceilingYTransferTop, zeroYTransfer, ceilingYTransferBottom].map((yValue, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              x1: TRANSFER_PLOT.left,
              x2: TRANSFER_PLOT.left + TRANSFER_PLOT.width,
              y1: yValue,
              y2: yValue,
              stroke: index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.22)",
              strokeDasharray: index === 1 ? "0" : "6 6",
              strokeWidth: index === 1 ? "1.2" : "1"
            },
            `transfer-horizontal-${index}`
          )),
          [ceilingXTransferLeft, zeroXTransfer, ceilingXTransferRight].map((xValue, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              y1: TRANSFER_PLOT.top,
              y2: TRANSFER_PLOT.top + TRANSFER_PLOT.height,
              x1: xValue,
              x2: xValue,
              stroke: index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.18)",
              strokeDasharray: index === 1 ? "0" : "6 6",
              strokeWidth: index === 1 ? "1.2" : "1"
            },
            `transfer-vertical-${index}`
          )),
          [ceilingYHistoryTop, zeroYHistory, ceilingYHistoryBottom].map((yValue, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "line",
            {
              x1: HISTORY_PLOT.left,
              x2: HISTORY_PLOT.left + HISTORY_PLOT.width,
              y1: yValue,
              y2: yValue,
              stroke: index === 1 ? "rgba(255,255,255,0.12)" : "rgba(248,113,113,0.22)",
              strokeDasharray: index === 1 ? "0" : "6 6",
              strokeWidth: index === 1 ? "1.2" : "1"
            },
            `history-horizontal-${index}`
          )),
          removedFillPath ? /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: removedFillPath, fill: "url(#distortionRemovedFill)" }) : null,
          transferOccupancyPaths.map((segment, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("g", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "path",
              {
                "data-role": "distortion-transfer-occupancy",
                d: segment.occupancyPath,
                fill: "rgba(255,255,255,0.14)",
                opacity: segment.occupancyOpacity,
                filter: "url(#distortionTransferOccupancyGlow)"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "path",
              {
                "data-role": "distortion-transfer-occupancy",
                d: segment.occupancyPath,
                fill: "rgba(255,255,255,0.26)",
                opacity: Math.min(1, segment.occupancyOpacity + 0.1)
              }
            ),
            segment.clippedPath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
              "path",
              {
                "data-role": "distortion-transfer-clipped-occupancy",
                d: segment.clippedPath,
                fill: "rgba(251,113,133,0.36)",
                opacity: segment.clippedOpacity
              }
            ) : null
          ] }, `transfer-occupancy-${index}`)),
          transferCurvePath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "path",
            {
              d: transferCurvePath,
              fill: "none",
              stroke: "rgba(103,232,249,0.98)",
              strokeWidth: "3.2",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ) : null,
          historyInputPath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "path",
            {
              d: historyInputPath,
              fill: "none",
              stroke: "rgba(255,255,255,0.42)",
              strokeWidth: "1.35",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ) : null,
          historyOutputPath ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "path",
            {
              d: historyOutputPath,
              fill: "none",
              stroke: "rgba(103,232,249,0.96)",
              strokeWidth: "2.4",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            }
          ) : null,
          clippedHistoryPoints.map((point, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "circle",
            {
              cx: point.x,
              cy: point.y,
              r: "2.3",
              fill: "rgba(251,113,133,0.84)"
            },
            `history-clipped-${index}`
          )),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: TRANSFER_PLOT.left + 8, y: ceilingYTransferTop - 6, fill: "rgba(248,113,113,0.74)", fontSize: "11", children: "+1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: TRANSFER_PLOT.left + 8, y: zeroYTransfer - 6, fill: "rgba(226,232,240,0.54)", fontSize: "11", children: "0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: TRANSFER_PLOT.left + 8, y: ceilingYTransferBottom - 6, fill: "rgba(248,113,113,0.74)", fontSize: "11", children: "-1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: ceilingXTransferLeft - 9, y: TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10, fill: "rgba(248,113,113,0.74)", fontSize: "11", textAnchor: "end", children: "-1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: zeroXTransfer, y: TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10, fill: "rgba(226,232,240,0.54)", fontSize: "11", textAnchor: "middle", children: "0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: ceilingXTransferRight + 9, y: TRANSFER_PLOT.top + TRANSFER_PLOT.height - 10, fill: "rgba(248,113,113,0.74)", fontSize: "11", children: "+1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: HISTORY_PLOT.left + 8, y: ceilingYHistoryTop - 6, fill: "rgba(248,113,113,0.74)", fontSize: "11", children: "+1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: HISTORY_PLOT.left + 8, y: zeroYHistory - 6, fill: "rgba(226,232,240,0.54)", fontSize: "11", children: "0" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("text", { x: HISTORY_PLOT.left + 8, y: ceilingYHistoryBottom - 6, fill: "rgba(248,113,113,0.74)", fontSize: "11", children: "-1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("text", { x: TRANSFER_PLOT.left + TRANSFER_PLOT.width - 10, y: TRANSFER_PLOT.top + 24, fill: "rgba(226,232,240,0.54)", fontSize: "11", textAnchor: "end", children: [
            "fixed ±",
            displayRange.toFixed(2)
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("text", { x: HISTORY_PLOT.left + HISTORY_PLOT.width - 10, y: HISTORY_PLOT.top + 24, fill: "rgba(226,232,240,0.54)", fontSize: "11", textAnchor: "end", children: [
            "removed ",
            (activeFrame?.removedPeak ?? 0).toFixed(3)
          ] })
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { "data-role": "distortion-graph-debug", className: "hidden", children: JSON.stringify(debugState) })
  ] });
}
const DISPLAY_GESTURE_AXIS_LOCK_PX = 12;
const DISPLAY_SWIPE_MIN_COMMIT_PX = 48;
const DISPLAY_SWIPE_COMMIT_RATIO = 0.18;
function resolveDisplayGestureAxis(deltaX, deltaY, axisLockThreshold = DISPLAY_GESTURE_AXIS_LOCK_PX) {
  const safeDeltaX = Math.abs(Number(deltaX) || 0);
  const safeDeltaY = Math.abs(Number(deltaY) || 0);
  if (Math.max(safeDeltaX, safeDeltaY) < axisLockThreshold) {
    return "pending";
  }
  return safeDeltaX > safeDeltaY ? "horizontal" : "vertical";
}
function resolveHorizontalSwipeTarget(startTableIndex, deltaX, tableCount) {
  const safeTableCount = Math.max(1, Math.round(Number(tableCount) || 1));
  const safeStartIndex = Math.min(
    Math.max(Math.round(Number(startTableIndex) || 0), 0),
    safeTableCount - 1
  );
  const safeDeltaX = Number(deltaX) || 0;
  const direction = safeDeltaX < 0 ? 1 : safeDeltaX > 0 ? -1 : 0;
  if (direction === 0) {
    return {
      direction,
      targetTableIndex: safeStartIndex,
      hasTarget: false
    };
  }
  const targetTableIndex = Math.min(
    Math.max(safeStartIndex + direction, 0),
    safeTableCount - 1
  );
  return {
    direction,
    targetTableIndex,
    hasTarget: targetTableIndex !== safeStartIndex
  };
}
function shouldCommitHorizontalSwipe(deltaX, stageWidth) {
  const safeStageWidth = Math.max(0, Number(stageWidth) || 0);
  const commitDistance = Math.max(DISPLAY_SWIPE_MIN_COMMIT_PX, safeStageWidth * DISPLAY_SWIPE_COMMIT_RATIO);
  return Math.abs(Number(deltaX) || 0) >= commitDistance;
}
function serializeIdentity(value) {
  return value;
}
function usePatchParameterBinding({
  endpointID,
  initialValue,
  coerce,
  serialize = serializeIdentity
}) {
  const parameter = usePatchParameter(endpointID, serialize(initialValue));
  const value = reactExports.useMemo(() => coerce(parameter.value), [coerce, parameter.value]);
  const setValue = reactExports.useCallback((nextValue) => {
    parameter.setValue(serialize(nextValue));
  }, [parameter.setValue, serialize]);
  const commitValue = reactExports.useCallback((nextValue) => {
    parameter.beginGesture();
    parameter.setValue(serialize(nextValue));
    parameter.endGesture();
  }, [parameter.beginGesture, parameter.endGesture, parameter.setValue, serialize]);
  return reactExports.useMemo(() => ({
    endpointID,
    value,
    setValue,
    commitValue,
    beginGesture: parameter.beginGesture,
    endGesture: parameter.endGesture
  }), [endpointID, parameter.beginGesture, parameter.endGesture, value, setValue, commitValue]);
}
function usePatchEventTrigger(endpointID) {
  const patchConnection = usePatchConnection();
  return reactExports.useCallback((value) => {
    patchConnection.sendEventOrValue?.(endpointID, value);
  }, [endpointID, patchConnection]);
}
function hasCommandModifier(event) {
  return event.metaKey || event.ctrlKey || event.altKey;
}
function useSynthInputRouter(keyboardRef, {
  handleKeyboardOctaveDown,
  handleKeyboardOctaveUp
} = {}) {
  const activeArrowTargetRef = reactExports.useRef(null);
  const textEntryDepthRef = reactExports.useRef(0);
  const handleKeyboardOctaveDownRef = reactExports.useRef(handleKeyboardOctaveDown);
  const handleKeyboardOctaveUpRef = reactExports.useRef(handleKeyboardOctaveUp);
  reactExports.useEffect(() => {
    handleKeyboardOctaveDownRef.current = handleKeyboardOctaveDown;
  }, [handleKeyboardOctaveDown]);
  reactExports.useEffect(() => {
    handleKeyboardOctaveUpRef.current = handleKeyboardOctaveUp;
  }, [handleKeyboardOctaveUp]);
  const activateArrowTarget = reactExports.useCallback((target) => {
    activeArrowTargetRef.current = target;
  }, []);
  const beginTextEntry = reactExports.useCallback((target) => {
    activeArrowTargetRef.current = target;
    textEntryDepthRef.current += 1;
    keyboardRef.current?.allNotesOff?.();
  }, [keyboardRef]);
  const endTextEntry = reactExports.useCallback(() => {
    textEntryDepthRef.current = Math.max(0, textEntryDepthRef.current - 1);
  }, []);
  reactExports.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || hasCommandModifier(event)) {
        return;
      }
      const activeArrowTarget = activeArrowTargetRef.current;
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && activeArrowTarget) {
        activeArrowTarget.onArrowStep(event.key === "ArrowRight" ? 1 : -1);
        event.preventDefault();
        return;
      }
      if (textEntryDepthRef.current > 0) {
        return;
      }
      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "z" && handleKeyboardOctaveDownRef.current) {
        if (!event.repeat) {
          const didShiftKeyboardOctave = handleKeyboardOctaveDownRef.current();
          if (didShiftKeyboardOctave) {
            keyboardRef.current?.allNotesOff?.();
          }
        }
        event.preventDefault();
        return;
      }
      if (normalizedKey === "x" && handleKeyboardOctaveUpRef.current) {
        if (!event.repeat) {
          const didShiftKeyboardOctave = handleKeyboardOctaveUpRef.current();
          if (didShiftKeyboardOctave) {
            keyboardRef.current?.allNotesOff?.();
          }
        }
        event.preventDefault();
        return;
      }
      keyboardRef.current?.handleKey?.(event, true);
    };
    const handleKeyUp = (event) => {
      if (hasCommandModifier(event) || textEntryDepthRef.current > 0) {
        return;
      }
      const normalizedKey = event.key.toLowerCase();
      if (normalizedKey === "z" && handleKeyboardOctaveDownRef.current || normalizedKey === "x" && handleKeyboardOctaveUpRef.current) {
        event.preventDefault();
        return;
      }
      keyboardRef.current?.handleKey?.(event, false);
    };
    const handleWindowBlur = () => {
      keyboardRef.current?.allNotesOff?.();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [keyboardRef]);
  const bindArrowTarget = reactExports.useCallback((target) => ({
    onPointerDownCapture: () => activateArrowTarget(target),
    onFocusCapture: () => activateArrowTarget(target)
  }), [activateArrowTarget]);
  const bindTextEntryTarget = reactExports.useCallback((target) => ({
    onPointerDownCapture: () => activateArrowTarget(target),
    onFocusCapture: () => beginTextEntry(target),
    onBlurCapture: () => endTextEntry()
  }), [activateArrowTarget, beginTextEntry, endTextEntry]);
  return reactExports.useMemo(() => ({
    activateArrowTarget,
    beginTextEntry,
    endTextEntry,
    bindArrowTarget,
    bindTextEntryTarget
  }), [activateArrowTarget, beginTextEntry, endTextEntry, bindArrowTarget, bindTextEntryTarget]);
}
const DEFAULT_SAMPLES_PER_FRAME = 2048;
const DEFAULT_FACTORY_BANK_CATALOG_PATH = "assets/factory-bank-catalog.json";
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function clampToRange(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function canonicalizeFrame(frame) {
  let sum = 0;
  for (let index = 0; index < frame.length; index += 1) {
    sum += Number(frame[index]) || 0;
  }
  const mean = sum / Math.max(1, frame.length);
  const canonical = new Float32Array(frame.length);
  for (let index = 0; index < frame.length; index += 1) {
    canonical[index] = (Number(frame[index]) || 0) - mean;
  }
  return canonical;
}
function getFactoryBankCatalogValue(catalogValue) {
  assert(
    Array.isArray(catalogValue?.tables),
    "Factory bank catalog must provide a tables array"
  );
  const catalog = catalogValue;
  catalog.tables.forEach((table, tableIndex) => {
    assert(
      typeof table?.tableId === "string" && table.tableId.length > 0,
      `Factory bank catalog table ${tableIndex} must provide tableId`
    );
    assert(
      typeof table?.name === "string" && table.name.length > 0,
      `Factory bank catalog table ${tableIndex} must provide name`
    );
    assert(
      Number.isInteger(Number(table?.frameCount)) && Number(table.frameCount) > 0,
      `Factory bank catalog table ${tableIndex} must provide a positive frameCount`
    );
    assert(
      typeof table?.sourceWav === "string" && table.sourceWav.length > 0,
      `Factory bank catalog table ${tableIndex} must provide sourceWav`
    );
  });
  return catalog;
}
function extractSourceFrames(samples, {
  expectedFrameCount,
  samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME
} = {}) {
  assert(
    samples.length % samplesPerFrame === 0,
    `Source wavetable files must contain a whole number of ${samplesPerFrame}-sample frames`
  );
  const frameCount = samples.length / samplesPerFrame;
  assert(frameCount > 0, "Source wavetable files must contain at least one frame");
  if (expectedFrameCount !== void 0) {
    assert(
      frameCount === expectedFrameCount,
      `Source wavetable frame count mismatch: expected ${expectedFrameCount}, got ${frameCount}`
    );
  }
  const frames = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * samplesPerFrame;
    const end = start + samplesPerFrame;
    frames.push(canonicalizeFrame(samples.slice(start, end)));
  }
  return {
    frameCount,
    frames
  };
}
async function loadFactoryBankCatalog(resourceClientInput, {
  catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH
} = {}) {
  const resourceClient = asResourceClient(resourceClientInput);
  return getFactoryBankCatalogValue(await resourceClient.readJSON(catalogPath));
}
async function loadFactoryBankFrames(resourceClientInput, {
  catalogPath = DEFAULT_FACTORY_BANK_CATALOG_PATH,
  tableIndex = 0,
  samplesPerFrame = DEFAULT_SAMPLES_PER_FRAME
} = {}) {
  const resourceClient = asResourceClient(resourceClientInput);
  const catalogValue = await loadFactoryBankCatalog(resourceClient, { catalogPath });
  const clampedTableIndex = clampToRange(tableIndex, 0, catalogValue.tables.length - 1);
  const sourceTableMeta = catalogValue.tables[clampedTableIndex];
  const sourceAudio = await resourceClient.readAudio(sourceTableMeta.sourceWav);
  const sourceFrames = extractSourceFrames(sourceAudio.samples, {
    expectedFrameCount: Number(sourceTableMeta.frameCount),
    samplesPerFrame
  });
  return {
    sampleRate: sourceAudio.sampleRate,
    sampleBlobPath: sourceTableMeta.sourceWav,
    tableIndex: clampedTableIndex,
    frameCount: sourceFrames.frameCount,
    samples: sourceAudio.samples,
    frames: sourceFrames.frames
  };
}
const EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID = "effectiveWavetablePosition";
const EFFECTIVE_WARP_STATE_ENDPOINT_ID = "effectiveWarpState";
const EFFECTIVE_FILTER_STATE_ENDPOINT_ID = "effectiveFilterState";
const FILTER_SPECTRUM_ENDPOINT_ID = "filterSpectrum";
const DISPLAY_SWIPE_THRESHOLD_PX = 2;
const MSEG_DRAG_THRESHOLD_PX = 8;
const WAVETABLE_POSITION_ENDPOINT_ID = "wavetablePosition";
const WAVETABLE_SELECT_ENDPOINT_ID = "wavetableSelect";
const PLAY_MODE_ENDPOINT_ID = "playMode";
const GLIDE_TIME_ENDPOINT_ID = "glideTime";
const PAN_ENDPOINT_ID = "pan";
const WARP_MODE_ENDPOINT_ID = "warpMode";
const WARP_AMOUNT_ENDPOINT_ID = "warpAmount";
const FILTER_MODE_ENDPOINT_ID = "filterMode";
const FILTER_CUTOFF_ENDPOINT_ID = "filterCutoff";
const FILTER_Q_ENDPOINT_ID = "filterQ";
const DISTORTION_DRIVE_DB_ENDPOINT_ID = "distortionDriveDb";
const DISTORTION_KNEE_ENDPOINT_ID = "distortionKnee";
const DISTORTION_WET_ENDPOINT_ID = "distortionWet";
const DISTORTION_WET_HP_HZ_ENDPOINT_ID = "distortionWetHPHz";
const DISTORTION_WET_LP_HZ_ENDPOINT_ID = "distortionWetLPHz";
const RUNTIME_SYNC_REQUEST_ENDPOINT_ID = "runtimeSyncRequest";
const RUNTIME_STATE_ENDPOINT_ID = "runtimeState";
const RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID = "retryDesiredTableRequest";
const GLIDE_TIME_MIN_SECONDS = 0;
const GLIDE_TIME_MAX_SECONDS = 2;
const GLIDE_TIME_STEP_SECONDS = 1e-3;
function describeErrorMessage(error) {
  if (error && typeof error === "object") {
    const maybeError = error;
    return maybeError.stack || maybeError.message || String(error);
  }
  return String(error);
}
function clamp$1(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function useFactoryBankCatalog() {
  const resourceClient = useResourceClient();
  const [state, setState] = reactExports.useState({
    catalog: null,
    error: null
  });
  reactExports.useEffect(() => {
    let cancelled = false;
    void loadFactoryBankCatalog(resourceClient).then((catalog) => {
      if (!cancelled) {
        setState({
          catalog,
          error: null
        });
      }
    }).catch((error) => {
      if (!cancelled) {
        setState({
          catalog: null,
          error: describeErrorMessage(error)
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resourceClient]);
  return state;
}
function useFactoryTableFrames(tableIndex) {
  const resourceClient = useResourceClient();
  const [state, setState] = reactExports.useState({
    frames: null,
    error: null
  });
  reactExports.useEffect(() => {
    let cancelled = false;
    void loadFactoryBankFrames(resourceClient, { tableIndex }).then((nextFrames) => {
      if (!cancelled) {
        setState({
          frames: nextFrames.frames,
          error: null
        });
      }
    }).catch((error) => {
      if (!cancelled) {
        setState({
          frames: null,
          error: describeErrorMessage(error)
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resourceClient, tableIndex]);
  return state;
}
function useObservedDisplayPosition(parameterPosition) {
  const message = usePatchEndpoint(EFFECTIVE_WAVETABLE_POSITION_ENDPOINT_ID, null);
  const [observedState, setObservedState] = reactExports.useState(() => ({
    voiceGeneration: -1,
    position: parameterPosition
  }));
  reactExports.useEffect(() => {
    setObservedState((previousState) => selectObservedWavetablePositionState(previousState, message));
  }, [message]);
  return message ? observedState.position : parameterPosition;
}
function useObservedFilterState({
  filterMode,
  filterCutoff,
  filterQ
}) {
  const message = usePatchEndpoint(EFFECTIVE_FILTER_STATE_ENDPOINT_ID, null);
  const [observedState, setObservedState] = reactExports.useState(() => ({
    voiceGeneration: -1,
    hasActive: false,
    mode: Math.round(filterMode) || 0,
    cutoffHz: Number(filterCutoff) || 1e3,
    q: Number(filterQ) || 0.707107
  }));
  reactExports.useEffect(() => {
    setObservedState((previousState) => selectObservedEffectiveFilterState(previousState, message));
  }, [message]);
  reactExports.useEffect(() => {
    if (message) {
      return;
    }
    setObservedState({
      voiceGeneration: -1,
      hasActive: false,
      mode: Math.round(filterMode) || 0,
      cutoffHz: Number(filterCutoff) || 1e3,
      q: Number(filterQ) || 0.707107
    });
  }, [filterCutoff, filterMode, filterQ, message]);
  if (!message) {
    return {
      voiceGeneration: -1,
      hasActive: false,
      mode: Math.round(filterMode) || 0,
      cutoffHz: Number(filterCutoff) || 1e3,
      q: Number(filterQ) || 0.707107
    };
  }
  return observedState ?? {
    voiceGeneration: -1,
    hasActive: false,
    mode: Math.round(filterMode) || 0,
    cutoffHz: Number(filterCutoff) || 1e3,
    q: Number(filterQ) || 0.707107
  };
}
function useObservedFilterSpectrum() {
  const message = usePatchEndpoint(FILTER_SPECTRUM_ENDPOINT_ID, null);
  const [observedState, setObservedState] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!message) {
      return;
    }
    const normalizedState = normalizeFilterSpectrumMessage(message);
    if (!normalizedState) {
      return;
    }
    setObservedState(normalizedState);
  }, [message]);
  return observedState;
}
function useObservedDistortionScope() {
  const message = usePatchEndpoint(DISTORTION_SCOPE_ENDPOINT_ID, null);
  const [observedState, setObservedState] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!message) {
      return;
    }
    const normalizedState = normalizeDistortionScopeMessage(message);
    if (!normalizedState) {
      return;
    }
    setObservedState(normalizedState);
  }, [message]);
  return observedState;
}
function useObservedWarpState({
  warpMode,
  warpAmount
}) {
  const message = usePatchEndpoint(EFFECTIVE_WARP_STATE_ENDPOINT_ID, null);
  const [observedState, setObservedState] = reactExports.useState(() => ({
    voiceGeneration: -1,
    hasActive: false,
    mode: Math.round(warpMode) || 0,
    amount: Number(warpAmount) || 0
  }));
  reactExports.useEffect(() => {
    setObservedState((previousState) => selectObservedEffectiveWarpState(previousState, message));
  }, [message]);
  reactExports.useEffect(() => {
    if (message) {
      return;
    }
    setObservedState({
      voiceGeneration: -1,
      hasActive: false,
      mode: Math.round(warpMode) || 0,
      amount: Number(warpAmount) || 0
    });
  }, [message, warpAmount, warpMode]);
  if (!message) {
    return {
      voiceGeneration: -1,
      hasActive: false,
      mode: Math.round(warpMode) || 0,
      amount: Number(warpAmount) || 0
    };
  }
  return observedState ?? {
    voiceGeneration: -1,
    hasActive: false,
    mode: Math.round(warpMode) || 0,
    amount: Number(warpAmount) || 0
  };
}
function useModulationState() {
  const patchConnection = usePatchConnection();
  const [state, setState] = reactExports.useState(null);
  const bridgeRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const bridge = acquireModulationRuntimeBridge(patchConnection);
    bridgeRef.current = bridge;
    setState(bridge.getState());
    bridge.subscribe(setState);
    return () => {
      bridge.unsubscribe(setState);
      releaseModulationRuntimeBridge(patchConnection);
      bridgeRef.current = null;
    };
  }, [patchConnection]);
  return {
    state,
    bridge: bridgeRef
  };
}
function useStagePositionDrag({
  stageRef,
  observedPosition,
  binding
}) {
  const [activeDisplayDrag, setActiveDisplayDrag] = reactExports.useState(null);
  const beginPositionGesture = reactExports.useCallback(() => {
    binding.beginGesture();
  }, [binding]);
  const endPositionGesture = reactExports.useCallback(() => {
    binding.endGesture();
  }, [binding]);
  const handleStagePointerDown = reactExports.useCallback((event) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target?.closest?.("select, button, input")) {
      return;
    }
    beginPositionGesture();
    setActiveDisplayDrag({
      pointerId: event.pointerId,
      startPosition: observedPosition,
      startClientY: event.clientY
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [beginPositionGesture, observedPosition]);
  const handleStagePointerMove = reactExports.useCallback((event) => {
    if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId || !stageRef.current) {
      return;
    }
    if (Math.abs(event.clientY - activeDisplayDrag.startClientY) < DISPLAY_SWIPE_THRESHOLD_PX) {
      return;
    }
    const bounds = stageRef.current.getBoundingClientRect();
    const nextPosition = mapDisplayDragToPosition(
      activeDisplayDrag.startPosition,
      activeDisplayDrag.startClientY,
      event.clientY,
      bounds.height
    );
    binding.setValue(nextPosition);
  }, [activeDisplayDrag, binding, stageRef]);
  const handleStagePointerUp = reactExports.useCallback((event) => {
    if (!activeDisplayDrag || activeDisplayDrag.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setActiveDisplayDrag(null);
    endPositionGesture();
  }, [activeDisplayDrag, endPositionGesture]);
  return {
    handleStagePointerDown,
    handleStagePointerMove,
    handleStagePointerUp
  };
}
function useMsegEditorInteractions({
  msegState,
  msegController,
  surfaceRef,
  orientation = "horizontal",
  curveEditActivationMode = "immediate",
  curveEditHoldDelayMs = 350,
  onCurveEditHoldActivated = null
}) {
  const [isOpen, setIsOpen] = reactExports.useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = reactExports.useState(0);
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = reactExports.useState(-1);
  const [activeSegmentIndex, setActiveSegmentIndex] = reactExports.useState(-1);
  const activePointerRef = reactExports.useRef(null);
  const clearPendingSegmentTimer = reactExports.useCallback((pointerState) => {
    if (pointerState?.kind === "pending-segment" && pointerState.holdTimeoutId !== null) {
      window.clearTimeout(pointerState.holdTimeoutId);
      pointerState.holdTimeoutId = null;
    }
  }, []);
  reactExports.useEffect(() => {
    if (!msegState) {
      return;
    }
    setSelectedPointIndex((previousIndex) => clamp$1(
      previousIndex,
      0,
      Math.max(0, msegState.shape.points.length - 1)
    ));
  }, [msegState]);
  const resolvePointerLocation = reactExports.useCallback((clientX, clientY) => {
    if (!msegState || !surfaceRef.current) {
      return null;
    }
    const bounds = surfaceRef.current.getBoundingClientRect();
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    const currentShape = msegController.current?.getState().shape ?? msegState.shape;
    const pointIndex = findMsegPointHitIndex(
      currentShape,
      localX,
      localY,
      bounds.width,
      bounds.height,
      void 0,
      { orientation }
    );
    const segmentIndex = pointIndex >= 0 ? -1 : findMsegSegmentHitIndex(
      currentShape,
      localX,
      localY,
      bounds.width,
      bounds.height,
      void 0,
      { orientation }
    );
    return {
      bounds,
      localX,
      localY,
      pointIndex,
      segmentIndex
    };
  }, [msegController, msegState, orientation, surfaceRef]);
  const updateHoveredSegmentIndex = reactExports.useCallback((clientX, clientY) => {
    const pointerLocation = resolvePointerLocation(clientX, clientY);
    setHoveredSegmentIndex(pointerLocation?.segmentIndex ?? -1);
    return pointerLocation;
  }, [resolvePointerLocation]);
  reactExports.useEffect(() => {
    if (!isOpen) {
      clearPendingSegmentTimer(activePointerRef.current);
      activePointerRef.current = null;
      setHoveredSegmentIndex(-1);
      setActiveSegmentIndex(-1);
      return;
    }
    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [clearPendingSegmentTimer, isOpen]);
  const openEditor = reactExports.useCallback(() => {
    setIsOpen(true);
  }, []);
  const closeEditor = reactExports.useCallback(() => {
    setIsOpen(false);
    clearPendingSegmentTimer(activePointerRef.current);
    activePointerRef.current = null;
    setHoveredSegmentIndex(-1);
    setActiveSegmentIndex(-1);
  }, [clearPendingSegmentTimer]);
  const applyCurveEditFromClientCoordinates = reactExports.useCallback((segmentIndex, clientX, clientY) => {
    if (!surfaceRef.current || !msegController.current) {
      return;
    }
    const currentShape = msegController.current.getState().shape ?? msegState?.shape;
    if (!currentShape) {
      return;
    }
    const bounds = surfaceRef.current.getBoundingClientRect();
    const point = msegEditorCoordinatesToPoint(
      clientX - bounds.left,
      clientY - bounds.top,
      bounds.width,
      bounds.height,
      { orientation }
    );
    const curvePower = deriveMsegSegmentCurvePower(currentShape, segmentIndex, point.x, point.y);
    msegController.current.setSegmentCurvePower(segmentIndex, curvePower);
  }, [msegController, msegState?.shape, orientation, surfaceRef]);
  const handlePointerDown = reactExports.useCallback((event) => {
    if (event.button !== 0 || !msegState || !surfaceRef.current) {
      return;
    }
    const pointerLocation = updateHoveredSegmentIndex(event.clientX, event.clientY);
    if (!pointerLocation) {
      return;
    }
    if (pointerLocation.pointIndex >= 0) {
      setSelectedPointIndex(pointerLocation.pointIndex);
      setActiveSegmentIndex(-1);
      activePointerRef.current = {
        kind: "point-drag",
        pointerId: event.pointerId,
        pointIndex: pointerLocation.pointIndex,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
        deleteOnRelease: pointerLocation.pointIndex > 0 && pointerLocation.pointIndex < msegState.shape.points.length - 1
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (pointerLocation.segmentIndex >= 0) {
      setActiveSegmentIndex(pointerLocation.segmentIndex);
      setHoveredSegmentIndex(pointerLocation.segmentIndex);
      if (curveEditActivationMode === "immediate") {
        activePointerRef.current = {
          kind: "curve-drag",
          pointerId: event.pointerId,
          segmentIndex: pointerLocation.segmentIndex
        };
      } else {
        const holdTimeoutId = window.setTimeout(() => {
          const activePointer = activePointerRef.current;
          if (!activePointer || activePointer.kind !== "pending-segment" || activePointer.pointerId !== event.pointerId) {
            return;
          }
          activePointerRef.current = {
            kind: "curve-drag",
            pointerId: activePointer.pointerId,
            segmentIndex: activePointer.segmentIndex
          };
          setActiveSegmentIndex(activePointer.segmentIndex);
          setHoveredSegmentIndex(activePointer.segmentIndex);
          onCurveEditHoldActivated?.();
        }, curveEditHoldDelayMs);
        activePointerRef.current = {
          kind: "pending-segment",
          pointerId: event.pointerId,
          segmentIndex: pointerLocation.segmentIndex,
          startClientX: event.clientX,
          startClientY: event.clientY,
          holdTimeoutId
        };
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const point = msegEditorCoordinatesToPoint(
      pointerLocation.localX,
      pointerLocation.localY,
      pointerLocation.bounds.width,
      pointerLocation.bounds.height,
      { orientation }
    );
    msegController.current?.addPoint(point.x, point.y);
    const points = msegController.current?.getState().shape.points ?? [];
    const nextPointIndex = points.findIndex(
      (nextPoint) => Math.abs(nextPoint.x - point.x) <= 1e-6 && Math.abs(nextPoint.y - point.y) <= 1e-6
    );
    if (nextPointIndex >= 0) {
      setSelectedPointIndex(nextPointIndex);
    }
    setActiveSegmentIndex(-1);
    event.preventDefault();
  }, [
    curveEditActivationMode,
    curveEditHoldDelayMs,
    msegController,
    msegState,
    onCurveEditHoldActivated,
    orientation,
    surfaceRef,
    updateHoveredSegmentIndex
  ]);
  const handlePointerMove = reactExports.useCallback((event) => {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId || !surfaceRef.current) {
      updateHoveredSegmentIndex(event.clientX, event.clientY);
      return;
    }
    if (activePointer.kind === "curve-drag") {
      applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
      setActiveSegmentIndex(activePointer.segmentIndex);
      setHoveredSegmentIndex(activePointer.segmentIndex);
      event.preventDefault();
      return;
    }
    if (activePointer.kind === "pending-segment") {
      const movementDistance2 = Math.hypot(
        event.clientX - activePointer.startClientX,
        event.clientY - activePointer.startClientY
      );
      if (movementDistance2 < MSEG_DRAG_THRESHOLD_PX) {
        return;
      }
      clearPendingSegmentTimer(activePointer);
      activePointerRef.current = {
        kind: "curve-drag",
        pointerId: activePointer.pointerId,
        segmentIndex: activePointer.segmentIndex
      };
      setActiveSegmentIndex(activePointer.segmentIndex);
      setHoveredSegmentIndex(activePointer.segmentIndex);
      applyCurveEditFromClientCoordinates(activePointer.segmentIndex, event.clientX, event.clientY);
      event.preventDefault();
      return;
    }
    const movementDistance = Math.hypot(
      event.clientX - activePointer.startClientX,
      event.clientY - activePointer.startClientY
    );
    if (!activePointer.moved && movementDistance < MSEG_DRAG_THRESHOLD_PX) {
      return;
    }
    const bounds = surfaceRef.current.getBoundingClientRect();
    const point = msegEditorCoordinatesToPoint(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
      bounds.height,
      { orientation }
    );
    if (!activePointer.moved) {
      activePointerRef.current = {
        ...activePointer,
        moved: true
      };
    }
    msegController.current?.movePoint(activePointer.pointIndex, point.x, point.y);
    setSelectedPointIndex(activePointer.pointIndex);
    setHoveredSegmentIndex(-1);
    setActiveSegmentIndex(-1);
    event.preventDefault();
  }, [
    applyCurveEditFromClientCoordinates,
    clearPendingSegmentTimer,
    msegController,
    orientation,
    surfaceRef,
    updateHoveredSegmentIndex
  ]);
  const handlePointerLeave = reactExports.useCallback((event) => {
    if (activePointerRef.current?.pointerId === event.pointerId) {
      return;
    }
    setHoveredSegmentIndex(-1);
  }, []);
  const handlePointerUp = reactExports.useCallback((event) => {
    const activePointer = activePointerRef.current;
    if (!activePointer || activePointer.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const pointerState = activePointer;
    activePointerRef.current = null;
    setActiveSegmentIndex(-1);
    if (pointerState.kind === "pending-segment") {
      clearPendingSegmentTimer(pointerState);
      if (surfaceRef.current) {
        const bounds = surfaceRef.current.getBoundingClientRect();
        const point = msegEditorCoordinatesToPoint(
          event.clientX - bounds.left,
          event.clientY - bounds.top,
          bounds.width,
          bounds.height,
          { orientation }
        );
        msegController.current?.addPoint(point.x, point.y);
        const points = msegController.current?.getState().shape.points ?? [];
        const nextPointIndex = points.findIndex(
          (nextPoint) => Math.abs(nextPoint.x - point.x) <= 1e-6 && Math.abs(nextPoint.y - point.y) <= 1e-6
        );
        if (nextPointIndex >= 0) {
          setSelectedPointIndex(nextPointIndex);
        }
      }
      event.preventDefault();
      setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
      return;
    }
    if (pointerState.kind === "curve-drag") {
      setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
      event.preventDefault();
      return;
    }
    if (!pointerState.moved && pointerState.deleteOnRelease && msegController.current) {
      msegController.current.deletePoint(pointerState.pointIndex);
      const pointCount = msegController.current.getState().shape.points.length;
      setSelectedPointIndex(clamp$1(pointerState.pointIndex - 1, 0, Math.max(0, pointCount - 1)));
    }
    setHoveredSegmentIndex(resolvePointerLocation(event.clientX, event.clientY)?.segmentIndex ?? -1);
    event.preventDefault();
  }, [
    clearPendingSegmentTimer,
    msegController,
    orientation,
    resolvePointerLocation,
    surfaceRef
  ]);
  return {
    isOpen,
    selectedPointIndex,
    hoveredSegmentIndex,
    activeSegmentIndex,
    openEditor,
    closeEditor,
    handlePointerDown,
    handlePointerMove,
    handlePointerLeave,
    handlePointerUp
  };
}
function useStableArrowTarget(targetID, onArrowStep) {
  const onArrowStepRef = reactExports.useRef(onArrowStep);
  reactExports.useEffect(() => {
    onArrowStepRef.current = onArrowStep;
  }, [onArrowStep]);
  return reactExports.useMemo(() => ({
    id: targetID,
    onArrowStep: (direction) => {
      onArrowStepRef.current(direction);
    }
  }), [targetID]);
}
function useSynthKeyboardRouting({
  keyboardRef,
  onStepWavetable,
  onStepPlayMode,
  onStepMsegRate,
  onStepGlideTime,
  onKeyboardOctaveDown,
  onKeyboardOctaveUp
}) {
  const synthInputRouter = useSynthInputRouter(keyboardRef, {
    handleKeyboardOctaveDown: onKeyboardOctaveDown,
    handleKeyboardOctaveUp: onKeyboardOctaveUp
  });
  const wavetableTarget = useStableArrowTarget("wavetable-select", onStepWavetable);
  const playModeTarget = useStableArrowTarget("play-mode", onStepPlayMode);
  const msegRateTarget = useStableArrowTarget("mseg-rate", onStepMsegRate);
  const glideTarget = useStableArrowTarget("glide-time", onStepGlideTime);
  return reactExports.useMemo(() => ({
    wavetableFocusBindings: synthInputRouter.bindArrowTarget(wavetableTarget),
    playModeFocusBindings: synthInputRouter.bindArrowTarget(playModeTarget),
    msegRateFocusBindings: synthInputRouter.bindArrowTarget(msegRateTarget),
    glideFocusTarget: {
      onActivate: () => synthInputRouter.activateArrowTarget(glideTarget),
      onBeginTextEntry: () => synthInputRouter.beginTextEntry(glideTarget),
      onEndTextEntry: () => synthInputRouter.endTextEntry()
    }
  }), [
    glideTarget,
    msegRateTarget,
    playModeTarget,
    synthInputRouter,
    wavetableTarget
  ]);
}
function useSynthPatchViewModel({
  stageRef,
  msegEditorSurfaceRef,
  keyboardRef,
  voiceModeCount,
  msegSurfaceOrientation = "horizontal",
  msegCurveEditActivationMode = "immediate",
  onMsegCurveEditHoldActivated = null,
  onKeyboardOctaveDown,
  onKeyboardOctaveUp
}) {
  const runtimeStateMessage = usePatchEndpoint(RUNTIME_STATE_ENDPOINT_ID, null);
  const normalizedRuntimeState = reactExports.useMemo(
    () => normalizeRuntimeTableState(runtimeStateMessage),
    [runtimeStateMessage]
  );
  const { catalog, error: catalogError } = useFactoryBankCatalog();
  const wavetablePosition = usePatchParameterBinding({
    endpointID: WAVETABLE_POSITION_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clampDisplayPosition(value)
  });
  const wavetableSelect = usePatchParameterBinding({
    endpointID: WAVETABLE_SELECT_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => Math.max(0, Math.trunc(Number(value) || 0))
  });
  const playMode = usePatchParameterBinding({
    endpointID: PLAY_MODE_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Math.round(Number(value) || 0), 0, Math.max(0, voiceModeCount - 1))
  });
  const glideTime = usePatchParameterBinding({
    endpointID: GLIDE_TIME_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Number(value) || 0, GLIDE_TIME_MIN_SECONDS, GLIDE_TIME_MAX_SECONDS)
  });
  const pan = usePatchParameterBinding({
    endpointID: PAN_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Number(value) || 0, -1, 1)
  });
  const warpMode = usePatchParameterBinding({
    endpointID: WARP_MODE_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Math.round(Number(value) || 0), 0, 4)
  });
  const warpAmount = usePatchParameterBinding({
    endpointID: WARP_AMOUNT_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Number(value) || 0, 0, 1)
  });
  const filterMode = usePatchParameterBinding({
    endpointID: FILTER_MODE_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Math.round(Number(value) || 0), 0, 5)
  });
  const filterCutoff = usePatchParameterBinding({
    endpointID: FILTER_CUTOFF_ENDPOINT_ID,
    initialValue: 1e3,
    coerce: (value) => clamp$1(Number(value) || 0, 20, 2e4)
  });
  const filterQ = usePatchParameterBinding({
    endpointID: FILTER_Q_ENDPOINT_ID,
    initialValue: 0.707107,
    coerce: (value) => clamp$1(Number(value) || 0, 0.1, 20)
  });
  const distortionDriveDb = usePatchParameterBinding({
    endpointID: DISTORTION_DRIVE_DB_ENDPOINT_ID,
    initialValue: 12,
    coerce: (value) => clamp$1(Number(value) || 0, 0, 36)
  });
  const distortionKnee = usePatchParameterBinding({
    endpointID: DISTORTION_KNEE_ENDPOINT_ID,
    initialValue: 0.35,
    coerce: (value) => clamp$1(Number(value) || 0, 0, 1)
  });
  const distortionWet = usePatchParameterBinding({
    endpointID: DISTORTION_WET_ENDPOINT_ID,
    initialValue: 0,
    coerce: (value) => clamp$1(Number(value) || 0, 0, 1)
  });
  const distortionWetHPHz = usePatchParameterBinding({
    endpointID: DISTORTION_WET_HP_HZ_ENDPOINT_ID,
    initialValue: 40,
    coerce: (value) => clamp$1(Number(value) || 0, 20, 4e3)
  });
  const distortionWetLPHz = usePatchParameterBinding({
    endpointID: DISTORTION_WET_LP_HZ_ENDPOINT_ID,
    initialValue: 18e3,
    coerce: (value) => clamp$1(Number(value) || 0, 20, 2e4)
  });
  const requestRuntimeSync = usePatchEventTrigger(RUNTIME_SYNC_REQUEST_ENDPOINT_ID);
  const retryDesiredTableLoad = usePatchEventTrigger(RETRY_DESIRED_TABLE_REQUEST_ENDPOINT_ID);
  const observedPosition = useObservedDisplayPosition(Number(wavetablePosition.value) || 0);
  const observedWarpState = useObservedWarpState({
    warpMode: warpMode.value,
    warpAmount: warpAmount.value
  });
  const observedFilterState = useObservedFilterState({
    filterMode: filterMode.value,
    filterCutoff: filterCutoff.value,
    filterQ: filterQ.value
  });
  const observedFilterSpectrum = useObservedFilterSpectrum();
  const observedDistortionScope = useObservedDistortionScope();
  const runtimePresentation = reactExports.useMemo(
    () => resolveRuntimeTablePresentation(runtimeStateMessage, Number(wavetableSelect.value) || 0),
    [runtimeStateMessage, wavetableSelect.value]
  );
  const presentedTableIndex = runtimePresentation.presentedTableIndex ?? 0;
  const desiredTableIndex = runtimePresentation.desiredTableIndex ?? 0;
  const { frames, error: frameError } = useFactoryTableFrames(presentedTableIndex);
  const { state: modulationState, bridge: modulationBridge } = useModulationState();
  const [selectedMsegSlot, setSelectedMsegSlot] = reactExports.useState(0);
  const [selectedEnvelopeSlot, setSelectedEnvelopeSlot] = reactExports.useState(0);
  const displayedMsegControllerRef = reactExports.useRef(null);
  displayedMsegControllerRef.current = modulationBridge.current?.getMsegSlotController(selectedMsegSlot) ?? null;
  const routes = modulationState?.routes ?? [];
  const msegState = reactExports.useMemo(() => {
    if (!modulationState || !modulationBridge.current) {
      return null;
    }
    return buildDisplayedMsegState(modulationBridge.current, selectedMsegSlot);
  }, [modulationBridge, modulationState, selectedMsegSlot]);
  const selectedEnvelope = modulationState?.envelopeSlots[selectedEnvelopeSlot] ?? null;
  const stageBindings = useStagePositionDrag({
    stageRef,
    observedPosition,
    binding: wavetablePosition
  });
  const msegEditor = useMsegEditorInteractions({
    msegState,
    msegController: displayedMsegControllerRef,
    surfaceRef: msegEditorSurfaceRef,
    orientation: msegSurfaceOrientation,
    curveEditActivationMode: msegCurveEditActivationMode,
    onCurveEditHoldActivated: onMsegCurveEditHoldActivated
  });
  const displayedTable = catalog?.tables?.[presentedTableIndex] ?? null;
  const desiredTable = catalog?.tables?.[desiredTableIndex] ?? displayedTable;
  const displayedFrameCount = displayedTable?.frameCount ?? frames?.length ?? 1;
  const failureDetail = describeRuntimeTableFailureDetails(
    runtimePresentation.isRetryableFailure ? normalizedRuntimeState : null,
    desiredTable?.name ?? "Requested wavetable"
  );
  const topStatus = runtimePresentation.failureMessage ?? (runtimePresentation.isPendingSelection && desiredTable ? `Loading ${desiredTable.name}…` : null) ?? (catalogError ? "Could not load the factory bank." : null) ?? (frameError ? "Could not render the current wavetable." : null) ?? "Ready";
  reactExports.useEffect(() => {
    requestRuntimeSync(1);
  }, [requestRuntimeSync]);
  const handleSelectWavetable = reactExports.useCallback((nextValue) => {
    wavetableSelect.commitValue(nextValue);
  }, [wavetableSelect]);
  const handleStepWavetable = reactExports.useCallback((direction) => {
    const maxTableIndex = Math.max(0, (catalog?.tables?.length ?? 1) - 1);
    wavetableSelect.commitValue(clamp$1(desiredTableIndex + direction, 0, maxTableIndex));
  }, [catalog?.tables?.length, desiredTableIndex, wavetableSelect]);
  const handleRetryLoad = reactExports.useCallback(() => {
    retryDesiredTableLoad(1);
  }, [retryDesiredTableLoad]);
  const handleSelectMsegSlot = reactExports.useCallback((slotIndex) => {
    setSelectedMsegSlot(clamp$1(Math.round(slotIndex), 0, 2));
  }, []);
  const handleSelectEnvelopeSlot = reactExports.useCallback((slotIndex) => {
    setSelectedEnvelopeSlot(clamp$1(Math.round(slotIndex), 0, 2));
  }, []);
  const handleMsegRateChange = reactExports.useCallback((nextValue) => {
    if (!msegState) {
      return;
    }
    displayedMsegControllerRef.current?.setPlayback({
      ...msegState.playback,
      rate: {
        kind: "seconds",
        seconds: nextValue
      }
    });
  }, [msegState]);
  const handleStepMsegRate = reactExports.useCallback((direction) => {
    if (!msegState) {
      return;
    }
    const nextRateSeconds = clampMsegRateSeconds(msegState.playback.rate.seconds + direction * 1e-3);
    displayedMsegControllerRef.current?.setPlayback({
      ...msegState.playback,
      rate: {
        kind: "seconds",
        seconds: nextRateSeconds
      }
    });
  }, [msegState]);
  const handleToggleMsegLoop = reactExports.useCallback(() => {
    if (!msegState) {
      return;
    }
    displayedMsegControllerRef.current?.setPlayback({
      ...msegState.playback,
      loop: msegState.playback.loop ? null : { startX: 0, endX: 1 },
      noteOffPolicy: "finish_loop"
    });
  }, [msegState]);
  const handleEnvelopeChange = reactExports.useCallback((field, nextValue) => {
    if (!selectedEnvelope) {
      return;
    }
    const currentEnvelope = modulationBridge.current?.getState().envelopeSlots[selectedEnvelopeSlot] ?? selectedEnvelope;
    modulationBridge.current?.setEnvelope(selectedEnvelopeSlot, {
      ...currentEnvelope,
      [field]: nextValue
    });
  }, [modulationBridge, selectedEnvelope, selectedEnvelopeSlot]);
  const handleAddRoute = reactExports.useCallback(() => {
    modulationBridge.current?.addRoute(createDefaultRoute());
  }, [modulationBridge]);
  const handleRemoveRoute = reactExports.useCallback((routeIndex) => {
    modulationBridge.current?.removeRoute(routeIndex);
  }, [modulationBridge]);
  const handleRouteChange = reactExports.useCallback((routeIndex, nextRoute) => {
    modulationBridge.current?.setRoute(routeIndex, nextRoute);
  }, [modulationBridge]);
  const handleStepPlayMode = reactExports.useCallback((direction) => {
    playMode.commitValue(
      clamp$1(playMode.value + direction, 0, Math.max(0, voiceModeCount - 1))
    );
  }, [playMode, voiceModeCount]);
  const handleStepGlideTime = reactExports.useCallback((direction) => {
    glideTime.commitValue(clamp$1(
      glideTime.value + direction * GLIDE_TIME_STEP_SECONDS,
      GLIDE_TIME_MIN_SECONDS,
      GLIDE_TIME_MAX_SECONDS
    ));
  }, [glideTime]);
  const keyboardRouting = useSynthKeyboardRouting({
    keyboardRef,
    onStepWavetable: handleStepWavetable,
    onStepPlayMode: handleStepPlayMode,
    onStepMsegRate: handleStepMsegRate,
    onStepGlideTime: handleStepGlideTime,
    onKeyboardOctaveDown,
    onKeyboardOctaveUp
  });
  return {
    frames,
    catalogError,
    frameError,
    observedPosition,
    topStatus,
    failureDetail,
    runtimePresentation,
    displayedTableIndex: presentedTableIndex,
    displayedTableName: displayedTable?.name ?? "Factory bank",
    displayedFrameCount,
    desiredTableIndex,
    desiredTableName: desiredTable?.name ?? displayedTable?.name ?? "Factory bank",
    tableOptions: catalog?.tables ?? [],
    canRetryDesiredTableLoad: runtimePresentation.isRetryableFailure,
    wavetablePosition,
    playMode,
    glideTime,
    pan,
    warpMode,
    warpAmount,
    filterMode,
    filterCutoff,
    filterQ,
    distortionDriveDb,
    distortionKnee,
    distortionWet,
    distortionWetHPHz,
    distortionWetLPHz,
    observedFilterState,
    observedFilterSpectrum,
    observedDistortionScope,
    observedWarpState,
    modulationState,
    selectedMsegSlot,
    selectedEnvelopeSlot,
    selectedEnvelope,
    routes,
    msegState,
    handleSelectMsegSlot,
    handleSelectEnvelopeSlot,
    handleEnvelopeChange,
    handleAddRoute,
    handleRemoveRoute,
    handleRouteChange,
    handleSelectWavetable,
    handleRetryLoad,
    handleMsegRateChange,
    handleToggleMsegLoop,
    stageBindings,
    msegEditor,
    keyboardRouting
  };
}
function getPitchClass(noteNumber) {
  const safeNoteNumber = Math.round(Number(noteNumber) || 0);
  return (safeNoteNumber % 12 + 12) % 12;
}
function isNaturalNoteNumber(noteNumber) {
  const pitchClass = getPitchClass(noteNumber);
  return pitchClass === 0 || pitchClass === 2 || pitchClass === 4 || pitchClass === 5 || pitchClass === 7 || pitchClass === 9 || pitchClass === 11;
}
function countNaturalNotesInRange(rootNote, noteCount) {
  const safeRootNote = Math.round(Number(rootNote) || 0);
  const safeNoteCount = Math.max(1, Math.round(Number(noteCount) || 0));
  let naturalCount = 0;
  for (let noteOffset = 0; noteOffset < safeNoteCount; noteOffset += 1) {
    if (isNaturalNoteNumber(safeRootNote + noteOffset)) {
      naturalCount += 1;
    }
  }
  return Math.max(1, naturalCount);
}
function computeKeyboardDimensions({
  rootNote,
  noteCount,
  availableWidth,
  minNaturalWidth = 18
}) {
  const naturalCount = countNaturalNotesInRange(rootNote, noteCount);
  const safeAvailableWidth = Math.max(0, Number(availableWidth) || 0);
  const unclampedNaturalWidth = Math.max(1, (safeAvailableWidth - 1) / naturalCount);
  const naturalWidth = Math.max(Number(minNaturalWidth) || 0, unclampedNaturalWidth);
  const accidentalWidth = Math.max(8, naturalWidth * 0.58);
  return {
    naturalCount,
    naturalWidth,
    accidentalWidth
  };
}
const MIDI_INPUT_ENDPOINT_ID = "midiIn";
function useResizeObserver(ref) {
  const [size, setSize] = reactExports.useState({ width: 1, height: 1 });
  reactExports.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const host = element;
      setSize({
        width: Math.max(1, bounds.width || host.clientWidth || 1),
        height: Math.max(1, bounds.height || host.clientHeight || 1)
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
function getKeyboardTagName(styleName) {
  return `cosimo-react-ios-keyboard-${styleName}`;
}
function ensureIOSKeyboardElement(patchConnection, styleName, keyboardOptions) {
  if (!patchConnection.utilities?.PianoKeyboard) {
    return null;
  }
  const tagName = getKeyboardTagName(styleName);
  if (!window.customElements.get(tagName)) {
    const BaseKeyboard = patchConnection.utilities.PianoKeyboard;
    class CosimoIOSKeyboard extends BaseKeyboard {
      constructor() {
        super({
          naturalNoteWidth: keyboardOptions.naturalNoteWidth,
          accidentalWidth: keyboardOptions.accidentalWidth,
          accidentalPercentageHeight: 64,
          pressedNoteColour: "#f56cb6"
        });
      }
      bindRenderedTouchHandlers() {
        const keyboard = this;
        for (const child of Array.from(keyboard.root.children)) {
          const touchTarget = child;
          touchTarget.addEventListener("touchstart", (event) => keyboard.touchStart?.(event), { passive: false });
          touchTarget.addEventListener("touchend", (event) => keyboard.touchEnd?.(event));
        }
      }
      attributeChangedCallback(name, oldValue, newValue) {
        const keyboard = this;
        const baseAttributeChanged = BaseKeyboard.prototype.attributeChangedCallback;
        baseAttributeChanged?.call(this, name, oldValue, newValue);
        if (oldValue === newValue) {
          return;
        }
        keyboard.notes = [];
        keyboard.refreshHTML();
        this.bindRenderedTouchHandlers();
        keyboard.refreshActiveNoteElements();
      }
    }
    window.customElements.define(tagName, CosimoIOSKeyboard);
  }
  return tagName;
}
function IOSKeyboardDock({
  rootNote,
  noteCount,
  naturalNoteWidth,
  accidentalWidth,
  keyboardRef
}) {
  const patchConnection = usePatchConnection();
  const hostRef = reactExports.useRef(null);
  const hostSize = useResizeObserver(hostRef);
  reactExports.useEffect(() => {
    const tagName = ensureIOSKeyboardElement(
      patchConnection,
      `ios-${noteCount}-${naturalNoteWidth}-${accidentalWidth}`,
      {
        naturalNoteWidth,
        accidentalWidth
      }
    );
    const host = hostRef.current;
    if (!tagName || !host) {
      return;
    }
    const KeyboardElement = window.customElements.get(tagName);
    if (!KeyboardElement) {
      return;
    }
    const keyboard = new KeyboardElement();
    keyboard.classList.add("keyboard");
    keyboard.style.display = "block";
    keyboard.style.width = "100%";
    keyboard.style.height = "100%";
    keyboard.setAttribute("root-note", String(rootNote));
    keyboard.setAttribute("note-count", String(noteCount));
    keyboard.refreshHTML();
    keyboard.bindRenderedTouchHandlers?.();
    keyboard.attachToPatchConnection?.(patchConnection, MIDI_INPUT_ENDPOINT_ID);
    keyboard.refreshActiveNoteElements?.();
    keyboardRef.current = keyboard;
    host.replaceChildren(keyboard);
    return () => {
      keyboard.detachPatchConnection?.(patchConnection);
      keyboardRef.current = null;
      host.replaceChildren();
    };
  }, [accidentalWidth, naturalNoteWidth, noteCount, patchConnection, rootNote, keyboardRef]);
  reactExports.useEffect(() => {
    const keyboard = keyboardRef.current;
    if (!keyboard) {
      return;
    }
    keyboard.setAttribute("root-note", String(rootNote));
    keyboard.setAttribute("note-count", String(noteCount));
  }, [noteCount, rootNote, keyboardRef]);
  reactExports.useEffect(() => {
    const keyboard = keyboardRef.current;
    const host = hostRef.current;
    if (!keyboard || !host || hostSize.width <= 0) {
      return;
    }
    const nextDimensions = computeKeyboardDimensions({
      rootNote,
      noteCount,
      availableWidth: hostSize.width,
      minNaturalWidth: naturalNoteWidth
    });
    const currentNaturalWidth = Number(keyboard.naturalWidth) || 0;
    const currentAccidentalWidth = Number(keyboard.accidentalWidth) || 0;
    if (Math.abs(currentNaturalWidth - nextDimensions.naturalWidth) < 0.01 && Math.abs(currentAccidentalWidth - nextDimensions.accidentalWidth) < 0.01) {
      return;
    }
    keyboard.naturalWidth = nextDimensions.naturalWidth;
    keyboard.accidentalWidth = nextDimensions.accidentalWidth;
    keyboard.notes = [];
    keyboard.refreshHTML();
    keyboard.bindRenderedTouchHandlers?.();
    keyboard.refreshActiveNoteElements?.();
  }, [hostSize.width, naturalNoteWidth, noteCount, rootNote, keyboardRef]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: hostRef, className: "keyboard-host" });
}
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const KEYBOARD_ROOT_NOTE_DEFAULT = 36;
const KEYBOARD_ROOT_NOTE_MIN = 12;
const KEYBOARD_ROOT_NOTE_MAX = 72;
const DISTORTION_WET_HP_MIN_HZ = 20;
const DISTORTION_WET_HP_MAX_HZ = 4e3;
const DISTORTION_WET_LP_MIN_HZ = 20;
const DISTORTION_WET_LP_MAX_HZ = 2e4;
function triggerIOSHaptic(style = "light") {
  const hapticTrigger = globalThis.cmaj_triggerHaptic;
  hapticTrigger?.(style);
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function formatGlideTime(seconds) {
  return `${Number(seconds).toFixed(3)} s`;
}
function formatSeconds(seconds) {
  return `${clampMsegRateSeconds(seconds).toFixed(3)} s`;
}
function formatDriveDb(value) {
  return `${Number(value).toFixed(1)} dB`;
}
function formatPercent(value) {
  return `${Math.round(clamp(Number(value) || 0, 0, 1) * 100)}%`;
}
function formatFrequencyHz(value) {
  const safeValue = Math.max(20, Number(value) || 0);
  if (safeValue >= 1e4) {
    return `${(safeValue / 1e3).toFixed(1)} kHz`;
  }
  if (safeValue >= 1e3) {
    return `${(safeValue / 1e3).toFixed(2)} kHz`;
  }
  return `${Math.round(safeValue)} Hz`;
}
function frequencyHzToLogNormalized(value, minHz, maxHz) {
  const safeValue = clamp(value, minHz, maxHz);
  return Math.log(safeValue / minHz) / Math.log(maxHz / minHz);
}
function normalizedToLogFrequencyHz(normalized, minHz, maxHz) {
  return minHz * Math.pow(maxHz / minHz, clamp(normalized, 0, 1));
}
function formatFrameReadout(position, frameCount) {
  const safeFrameCount = Math.max(1, frameCount);
  const frameIndex = Math.round(clampDisplayPosition(position) * Math.max(0, safeFrameCount - 1)) + 1;
  return `${String(frameIndex).padStart(2, "0")}/${String(safeFrameCount).padStart(2, "0")}`;
}
function formatKeyboardRangeLabel(rootNote, noteCount) {
  const startNote = Math.max(0, Math.round(Number(rootNote) || 0));
  const lastNote = startNote + Math.max(0, Math.round(Number(noteCount) || 0) - 1);
  const formatNote = (noteNumber) => `${NOTE_NAMES[noteNumber % 12]}${Math.floor(noteNumber / 12) - 1}`;
  return `${formatNote(startNote)} - ${formatNote(lastNote)}`;
}
function formatIOSFactoryLibraryLoadMessage(prefix, detail) {
  return `${prefix}: ${detail}. Import the factory wavetable zip from the native library bar, then reopen the patch.`;
}
function computeIOSResponsiveLayout(width, height) {
  const safeWidth = Math.max(Number(width) || 0, 0);
  const safeHeight = Math.max(Number(height) || 0, 0);
  const isPortrait = safeHeight > safeWidth;
  const shortLandscape = safeHeight < 460;
  const compact = safeWidth < 760;
  return {
    isPortrait,
    noteCount: 18,
    stageMinHeight: compact ? 216 : shortLandscape ? 180 : 252,
    controlHeight: shortLandscape ? 48 : 54,
    keyboardHeight: compact ? 94 : shortLandscape ? 88 : 102,
    keyboardNaturalNoteWidth: compact ? 22 : shortLandscape ? 20 : 24,
    keyboardAccidentalWidth: compact ? 12 : shortLandscape ? 11 : 13
  };
}
function useIOSViewportLayout() {
  const [layout, setLayout] = reactExports.useState(() => computeIOSResponsiveLayout(
    Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
    Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844
  ));
  reactExports.useEffect(() => {
    const update = () => {
      setLayout(computeIOSResponsiveLayout(
        Number(globalThis.visualViewport?.width) || Number(globalThis.window?.innerWidth) || 390,
        Number(globalThis.visualViewport?.height) || Number(globalThis.window?.innerHeight) || 844
      ));
    };
    globalThis.visualViewport?.addEventListener?.("resize", update);
    globalThis.window?.addEventListener?.("resize", update);
    update();
    return () => {
      globalThis.visualViewport?.removeEventListener?.("resize", update);
      globalThis.window?.removeEventListener?.("resize", update);
    };
  }, []);
  return layout;
}
function arePlayPanelPropsEqual(previousProps, nextProps) {
  return previousProps.playModeValue === nextProps.playModeValue && previousProps.onPlayModeChange === nextProps.onPlayModeChange && previousProps.playModeFocusBindings.onPointerDownCapture === nextProps.playModeFocusBindings.onPointerDownCapture && previousProps.playModeFocusBindings.onFocusCapture === nextProps.playModeFocusBindings.onFocusCapture && previousProps.glideValue === nextProps.glideValue && previousProps.onGlideChange === nextProps.onGlideChange && previousProps.glideFocusTarget.onActivate === nextProps.glideFocusTarget.onActivate && previousProps.glideFocusTarget.onBeginTextEntry === nextProps.glideFocusTarget.onBeginTextEntry && previousProps.glideFocusTarget.onEndTextEntry === nextProps.glideFocusTarget.onEndTextEntry;
}
const IOSPlayPanel = reactExports.memo(function IOSPlayPanel2({
  playModeValue,
  onPlayModeChange,
  playModeFocusBindings,
  glideValue,
  onGlideChange,
  glideFocusTarget
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "play-panel", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "play-grid", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "play-field", "aria-label": "Voice mode", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "select",
      {
        className: "play-select play-mode-select",
        "aria-label": "Voice mode",
        value: String(playModeValue),
        onChange: (event) => onPlayModeChange(Number(event.target.value)),
        ...playModeFocusBindings,
        children: VOICE_MODE_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "play-field", "aria-label": "Glide time", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glide-field-body", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          className: "glide-time-slider",
          type: "range",
          min: "0",
          max: "1",
          step: "0.001",
          value: Math.min(glideValue, 1).toFixed(3),
          "aria-label": "Glide time",
          onPointerDownCapture: glideFocusTarget.onActivate,
          onFocusCapture: glideFocusTarget.onActivate,
          onChange: (event) => onGlideChange(Number(event.target.value))
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glide-time-readout", "data-role": "glide-time-readout", children: formatGlideTime(glideValue) })
    ] }) })
  ] }) });
}, arePlayPanelPropsEqual);
const IOSMsegLauncher = reactExports.memo(function IOSMsegLauncher2({
  msegState,
  selectedMsegSlot,
  previewOrientation,
  onOpenEditor,
  onToggleLoop,
  panValue,
  onPanChange,
  onSelectMsegSlot
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-shell", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-launcher", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-launcher-head", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-launcher-copy", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-eyebrow", children: `MSEG ${selectedMsegSlot + 1}` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "mseg-route-title", children: "Modulation Shape" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }, children: Array.from({ length: MODULATION_MSEG_SLOT_COUNT }, (_, slotIndex) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        "aria-label": `Select MSEG ${slotIndex + 1}`,
        onClick: () => onSelectMsegSlot(slotIndex),
        style: {
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "0.35rem 0.8rem",
          background: selectedMsegSlot === slotIndex ? "rgba(88, 234, 208, 0.18)" : "rgba(255,255,255,0.04)",
          color: "rgba(240,248,255,0.92)",
          fontSize: "0.7rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase"
        },
        children: slotIndex + 1
      },
      `ios-mseg-slot-${slotIndex + 1}`
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "mseg-preview-button",
        type: "button",
        "aria-label": "Open MSEG editor",
        onClick: onOpenEditor,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-preview-shell", children: msegState ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          MsegPreview,
          {
            points: msegState.shape.points,
            orientation: previewOrientation,
            className: "h-full w-full overflow-hidden rounded-[20px] bg-white/[0.03]"
          }
        ) : null })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-preview-footer", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-launcher-rate-readout", "data-role": "mseg-launcher-rate-readout", children: msegState ? formatSeconds(msegState.playback.rate.seconds) : "1.000 s" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "mseg-loop-button mseg-launcher-loop-button",
          type: "button",
          "data-role": "mseg-launcher-loop-button",
          "aria-pressed": msegState?.playback.loop ? "true" : "false",
          "aria-label": "Toggle full-shape loop",
          onClick: onToggleLoop,
          children: "Loop"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-controls", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "mseg-depth", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: "Pan" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "mseg-depth-slider",
            type: "range",
            min: "-1",
            max: "1",
            step: "0.001",
            value: Number(panValue).toFixed(3),
            onChange: (event) => onPanChange(Number(event.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-depth-readout", children: Number(panValue).toFixed(3) })
    ] })
  ] }) });
});
const IOSKeyboardToolbar = reactExports.memo(function IOSKeyboardToolbar2({
  keyboardRootLabel,
  canOctaveDown,
  canOctaveUp,
  onOctaveDown,
  onOctaveUp
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "keyboard-toolbar", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "octave-controls", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "octave-button octave-down",
        type: "button",
        disabled: !canOctaveDown,
        onClick: onOctaveDown,
        children: "Oct -"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "octave-readout", "data-role": "octave-readout", children: keyboardRootLabel }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "octave-button octave-up",
        type: "button",
        disabled: !canOctaveUp,
        onClick: onOctaveUp,
        children: "Oct +"
      }
    )
  ] }) });
});
const IOSModulationMatrixPanel = reactExports.memo(function IOSModulationMatrixPanel2({
  selectedEnvelopeSlot,
  selectedEnvelope,
  routes,
  onSelectEnvelopeSlot,
  onEnvelopeChange,
  onAddRoute,
  onRemoveRoute,
  onRouteChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      style: {
        display: "grid",
        gap: "0.9rem",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px",
        padding: "1rem",
        background: "rgba(255,255,255,0.03)"
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-eyebrow", children: "Envelopes + Routes" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "mseg-route-title", children: "Modulation Matrix" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: Array.from({ length: MODULATION_ENV_SLOT_COUNT }, (_, slotIndex) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            "aria-label": `Select envelope ${slotIndex + 1}`,
            onClick: () => onSelectEnvelopeSlot(slotIndex),
            style: {
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "0.35rem 0.8rem",
              background: selectedEnvelopeSlot === slotIndex ? "rgba(52, 211, 153, 0.2)" : "rgba(255,255,255,0.04)",
              color: "rgba(240,248,255,0.92)",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase"
            },
            children: `Env ${slotIndex + 1}`
          },
          `ios-env-slot-${slotIndex + 1}`
        )) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { display: "grid", gap: "0.75rem" }, children: [
          ["attackSeconds", "Attack", 1e-3, 10, 1e-3, Number(selectedEnvelope?.attackSeconds ?? 0.01)],
          ["decaySeconds", "Decay", 1e-3, 10, 1e-3, Number(selectedEnvelope?.decaySeconds ?? 0.25)],
          ["sustain", "Sustain", 0, 1, 1e-3, Number(selectedEnvelope?.sustain ?? 0.5)],
          ["releaseSeconds", "Release", 1e-3, 10, 1e-3, Number(selectedEnvelope?.releaseSeconds ?? 0.2)]
        ].map(([field, label, min, max, step, value]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "grid", gap: "0.35rem" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: String(label) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "mseg-rate-slider",
              type: "range",
              min: String(min),
              max: String(max),
              step: String(step),
              value: Number(value).toFixed(3),
              onChange: (event) => onEnvelopeChange(field, Number(event.target.value))
            }
          )
        ] }, String(field))) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gap: "0.75rem" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-depth-label", children: "Route Rows" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "mseg-loop-button", type: "button", "aria-label": "Add route", onClick: onAddRoute, children: "Add Route" })
          ] }),
          routes.map((route, routeIndex) => {
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                style: {
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto auto",
                  alignItems: "center",
                  borderRadius: "18px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "0.75rem",
                  background: "rgba(0,0,0,0.16)"
                },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "select",
                    {
                      "aria-label": `Route ${routeIndex + 1} source`,
                      value: getModulationSourceOptionValue(route),
                      onChange: (event) => {
                        onRouteChange(routeIndex, applyModulationSourceOption(route, event.target.value));
                      },
                      children: MODULATION_SOURCE_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "select",
                    {
                      "aria-label": `Route ${routeIndex + 1} target`,
                      value: route.targetKind,
                      onChange: (event) => {
                        const nextTargetKind = event.target.value;
                        onRouteChange(routeIndex, {
                          ...route,
                          targetKind: nextTargetKind,
                          amount: clampModulationRouteAmount(nextTargetKind, route.amount)
                        });
                      },
                      children: MODULATION_TARGET_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: option.value, children: option.label }, option.value))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    ModulationAmountField,
                    {
                      targetKind: route.targetKind,
                      polarity: route.polarity,
                      amount: route.amount,
                      onPolarityChange: (nextPolarity) => {
                        onRouteChange(routeIndex, {
                          ...route,
                          polarity: nextPolarity
                        });
                      },
                      knobAriaLabel: `Route ${routeIndex + 1} depth`,
                      polarityAriaLabel: `Route ${routeIndex + 1} polarity`,
                      onChange: (nextAmount) => {
                        onRouteChange(routeIndex, {
                          ...route,
                          amount: nextAmount
                        });
                      }
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      className: "mseg-loop-button",
                      type: "button",
                      "aria-label": `Remove route ${routeIndex + 1}`,
                      onClick: () => onRemoveRoute(routeIndex),
                      children: "x"
                    }
                  )
                ]
              },
              route.id
            );
          }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              style: {
                color: "rgba(226,232,240,0.58)",
                fontSize: "0.72rem",
                lineHeight: 1.45
              },
              children: "Depth shows the movement this row asks for at full source. Position, warp, cutoff, Q, amp, and pan still stop at the synth's real limits."
            }
          )
        ] })
      ]
    }
  );
});
const IOSDistortionPanel = reactExports.memo(function IOSDistortionPanel2({
  driveValue,
  kneeValue,
  wetValue,
  wetHPHzValue,
  wetLPHzValue,
  scopeFrame,
  onDriveChange,
  onKneeChange,
  onWetChange,
  onWetHPHzChange,
  onWetLPHzChange
}) {
  const inputPeak = scopeFrame?.inputPeak ?? 0;
  const outputPeak = scopeFrame?.outputPeak ?? 0;
  const removedPeak = scopeFrame?.removedPeak ?? 0;
  const overshoot = Math.max(0, inputPeak - 1);
  const headroom = Math.max(0, 1 - inputPeak);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-role": "ios-distortion-panel",
      style: {
        display: "grid",
        gap: "0.9rem",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px",
        padding: "1rem",
        background: "linear-gradient(180deg, rgba(22,10,16,0.96), rgba(7,8,14,0.98))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.75rem" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-eyebrow", children: "Distortion" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "mseg-route-title", children: "Wet Curve + Waveform" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              style: {
                display: "grid",
                gap: "0.2rem",
                textAlign: "right",
                fontFamily: '"SF Mono", Menlo, monospace',
                fontSize: "0.66rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(226,232,240,0.76)"
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: overshoot > 0 ? `Ceiling +${overshoot.toFixed(2)}` : `Ceiling ${Math.round(headroom * 100)}% clear` }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: `Out ${outputPeak.toFixed(3)} • Removed ${removedPeak.toFixed(3)}` })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          DistortionVisualizer,
          {
            knee: kneeValue,
            frame: scopeFrame
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gap: "0.8rem" }, children: [
          [
            {
              label: "Drive",
              value: driveValue,
              min: 0,
              max: 36,
              step: 0.01,
              readout: formatDriveDb(driveValue),
              onChange: onDriveChange,
              dataRole: "distortion-drive-slider",
              readoutRole: "distortion-drive-readout"
            },
            {
              label: "Knee",
              value: kneeValue,
              min: 0,
              max: 1,
              step: 1e-3,
              readout: formatPercent(kneeValue),
              onChange: onKneeChange,
              dataRole: "distortion-knee-slider",
              readoutRole: null
            },
            {
              label: "Mix",
              value: wetValue,
              min: 0,
              max: 1,
              step: 1e-3,
              readout: formatPercent(wetValue),
              onChange: onWetChange,
              dataRole: "distortion-mix-slider",
              readoutRole: "distortion-mix-readout"
            }
          ].map((field) => /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "grid", gap: "0.32rem" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "0.75rem" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: field.label }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  "data-role": field.readoutRole ?? void 0,
                  style: {
                    fontFamily: '"SF Mono", Menlo, monospace',
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    color: "rgba(226,232,240,0.92)"
                  },
                  children: field.readout
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                "data-role": field.dataRole,
                className: "mseg-rate-slider",
                type: "range",
                min: String(field.min),
                max: String(field.max),
                step: String(field.step),
                value: Number(field.value).toFixed(3),
                onChange: (event) => field.onChange(Number(event.target.value))
              }
            )
          ] }, field.label)),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "grid", gap: "0.32rem" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "0.75rem" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: "Wet HP" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  style: {
                    fontFamily: '"SF Mono", Menlo, monospace',
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    color: "rgba(226,232,240,0.92)"
                  },
                  children: formatFrequencyHz(wetHPHzValue)
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                "data-role": "distortion-wet-hp-slider",
                className: "mseg-rate-slider",
                type: "range",
                min: "0",
                max: "1",
                step: "0.001",
                value: frequencyHzToLogNormalized(wetHPHzValue, DISTORTION_WET_HP_MIN_HZ, DISTORTION_WET_HP_MAX_HZ).toFixed(3),
                onChange: (event) => {
                  const nextValue = clamp(
                    normalizedToLogFrequencyHz(Number(event.target.value), DISTORTION_WET_HP_MIN_HZ, DISTORTION_WET_HP_MAX_HZ),
                    DISTORTION_WET_HP_MIN_HZ,
                    Math.min(DISTORTION_WET_HP_MAX_HZ, wetLPHzValue)
                  );
                  onWetHPHzChange(nextValue);
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { style: { display: "grid", gap: "0.32rem" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: "0.75rem" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: "Wet LP" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  style: {
                    fontFamily: '"SF Mono", Menlo, monospace',
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    color: "rgba(226,232,240,0.92)"
                  },
                  children: formatFrequencyHz(wetLPHzValue)
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                "data-role": "distortion-wet-lp-slider",
                className: "mseg-rate-slider",
                type: "range",
                min: "0",
                max: "1",
                step: "0.001",
                value: frequencyHzToLogNormalized(wetLPHzValue, DISTORTION_WET_LP_MIN_HZ, DISTORTION_WET_LP_MAX_HZ).toFixed(3),
                onChange: (event) => {
                  const nextValue = clamp(
                    normalizedToLogFrequencyHz(Number(event.target.value), DISTORTION_WET_LP_MIN_HZ, DISTORTION_WET_LP_MAX_HZ),
                    Math.max(DISTORTION_WET_LP_MIN_HZ, wetHPHzValue),
                    DISTORTION_WET_LP_MAX_HZ
                  );
                  onWetLPHzChange(nextValue);
                }
              }
            )
          ] })
        ] })
      ]
    }
  );
});
const IOSMsegModal = reactExports.memo(function IOSMsegModal2({
  isOpen,
  onClose,
  slotLabel,
  msegState,
  surfaceRef,
  orientation,
  selectedPointIndex,
  hoveredSegmentIndex,
  activeSegmentIndex,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  rateSeconds,
  onRateChange,
  onToggleLoop,
  rateFocusBindings
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-modal-layer", "data-role": "mseg-modal-layer", "data-open": isOpen ? "true" : "false", children: isOpen ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "section",
    {
      className: "mseg-modal",
      "data-role": "mseg-modal",
      "aria-hidden": isOpen ? "false" : "true",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-modal-head", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-modal-copy", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-eyebrow", children: slotLabel }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "mseg-route-title", children: "Modulation Shape" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              className: "mseg-modal-close",
              type: "button",
              "aria-label": "Close MSEG editor",
              "data-role": "mseg-modal-close",
              onClick: onClose,
              children: "x"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-modal-stage", children: msegState ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          EditableMsegSurface,
          {
            surfaceRef,
            dataRole: "mseg-modal-viewport",
            className: "mseg-surface mseg-modal-surface",
            orientation,
            points: msegState.shape.points,
            selectedPointIndex,
            hoveredSegmentIndex,
            activeSegmentIndex,
            onPointerDown,
            onPointerMove,
            onPointerLeave,
            onPointerUp
          }
        ) : null }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-modal-footer", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "mseg-rate", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mseg-depth-label", children: "Time In Seconds" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                className: "mseg-rate-slider",
                type: "range",
                "aria-label": "MSEG time in seconds",
                min: MSEG_RATE_MIN_SECONDS.toFixed(3),
                max: MSEG_RATE_MAX_SECONDS.toFixed(3),
                step: "0.001",
                value: clampMsegRateSeconds(rateSeconds).toFixed(3),
                onChange: (event) => onRateChange(Number(event.target.value)),
                ...rateFocusBindings
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mseg-modal-footer-actions", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mseg-rate-readout", "data-role": "mseg-rate-readout", children: formatSeconds(rateSeconds) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "mseg-loop-button",
                type: "button",
                "data-role": "mseg-loop-button",
                "aria-pressed": msegState?.playback.loop ? "true" : "false",
                "aria-label": "Toggle full-shape loop",
                onClick: onToggleLoop,
                children: "Loop"
              }
            )
          ] })
        ] })
      ]
    }
  ) : null });
});
const IOSWavetablePanel = reactExports.memo(function IOSWavetablePanel2({
  stageRef,
  frames,
  observedPosition,
  warpMode,
  warpAmount,
  displayedFrameCount,
  displayedTableIndex,
  desiredTableIndex,
  tableOptions,
  shouldShowOverlay,
  displayStatus,
  tableErrorText,
  bankReadout,
  canRetryDesiredTableLoad,
  wavetableFocusBindings,
  wavetablePosition,
  onSelectWavetable,
  onRetryLoad
}) {
  const activeStageGestureRef = reactExports.useRef(null);
  const handleStagePointerDown = reactExports.useCallback((event) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target?.closest?.(".bank-picker-trigger, select, button, input")) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    activeStageGestureRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTableIndex: displayedTableIndex,
      startPosition: observedPosition,
      dragSpanX: bounds.width,
      dragSpanY: bounds.height,
      currentDeltaX: 0,
      mode: "pending"
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [displayedTableIndex, observedPosition]);
  const handleStagePointerMove = reactExports.useCallback((event) => {
    const activeStageGesture = activeStageGestureRef.current;
    if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - activeStageGesture.startClientX;
    const deltaY = event.clientY - activeStageGesture.startClientY;
    const gestureAxis = resolveDisplayGestureAxis(deltaX, deltaY);
    if (activeStageGesture.mode === "pending" && gestureAxis !== "pending") {
      activeStageGesture.mode = gestureAxis;
      if (gestureAxis === "vertical") {
        wavetablePosition.beginGesture();
      }
    }
    if (activeStageGesture.mode === "horizontal") {
      activeStageGesture.currentDeltaX = deltaX;
      event.preventDefault();
      return;
    }
    if (activeStageGesture.mode !== "vertical") {
      return;
    }
    const nextPosition = clampDisplayPosition(
      activeStageGesture.startPosition + (activeStageGesture.startClientY - event.clientY) / Math.max(1, activeStageGesture.dragSpanY)
    );
    wavetablePosition.setValue(nextPosition);
    event.preventDefault();
  }, [wavetablePosition]);
  const endStageGesture = reactExports.useCallback((event) => {
    const activeStageGesture = activeStageGestureRef.current;
    if (!activeStageGesture || activeStageGesture.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (activeStageGesture.mode === "vertical") {
      wavetablePosition.endGesture();
      activeStageGestureRef.current = null;
      event.preventDefault();
      return;
    }
    if (activeStageGesture.mode === "horizontal") {
      const swipeTarget = resolveHorizontalSwipeTarget(
        activeStageGesture.startTableIndex,
        activeStageGesture.currentDeltaX,
        tableOptions.length
      );
      if (swipeTarget.hasTarget && shouldCommitHorizontalSwipe(activeStageGesture.currentDeltaX, activeStageGesture.dragSpanX)) {
        onSelectWavetable(swipeTarget.targetTableIndex);
      }
    }
    activeStageGestureRef.current = null;
    event.preventDefault();
  }, [onSelectWavetable, tableOptions.length, wavetablePosition]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "wavetable-panel", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: stageRef,
      className: "wavetable-stage",
      "data-state": shouldShowOverlay ? "loading" : "ready",
      onPointerDown: handleStagePointerDown,
      onPointerMove: handleStagePointerMove,
      onPointerUp: endStageGesture,
      onPointerCancel: endStageGesture,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "wavetable-display-stack", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "wavetable-layer", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            WavetableCanvas,
            {
              frames,
              position: observedPosition,
              warpMode,
              warpAmount
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "wavetable-layer", "aria-hidden": "true" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "display-overlay", hidden: !shouldShowOverlay, children: displayStatus }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stage-copy", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stage-copy-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mini-label active", children: "Wavescan" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "display-status", "data-role": "display-status", children: displayStatus }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shape-readout", "data-role": "hero-frame-readout", children: formatFrameReadout(observedPosition, displayedFrameCount) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "table-error-banner",
              "data-role": "table-error-banner",
              hidden: !tableErrorText,
              children: tableErrorText ?? ""
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stage-copy-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "bank-picker-trigger", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bank-readout", children: bankReadout }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "select",
                {
                  className: "table-select table-select-overlay",
                  "aria-label": "Select wavetable",
                  value: String(desiredTableIndex),
                  onChange: (event) => onSelectWavetable(Number(event.target.value)),
                  ...wavetableFocusBindings,
                  children: tableOptions.map((table, tableIndex) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: tableIndex, children: table.name }, `${table.tableId}-${tableIndex}`))
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "table-retry-button",
                type: "button",
                hidden: !canRetryDesiredTableLoad,
                disabled: !canRetryDesiredTableLoad,
                onClick: onRetryLoad,
                children: "Retry"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mini-label warm", "data-role": "stage-gesture-hint", children: "Swipe + Drag" })
          ] })
        ] })
      ]
    }
  ) });
});
function IOSPatchViewBody() {
  const stageRef = reactExports.useRef(null);
  const msegEditorSurfaceRef = reactExports.useRef(null);
  const keyboardRef = reactExports.useRef(null);
  const [keyboardRootNote, setKeyboardRootNote] = reactExports.useState(KEYBOARD_ROOT_NOTE_DEFAULT);
  const [isMsegModalOpen, setIsMsegModalOpen] = reactExports.useState(false);
  const layout = useIOSViewportLayout();
  const msegPreviewOrientation = "horizontal";
  const msegEditorOrientation = layout.isPortrait ? "vertical" : "horizontal";
  const synthView = useSynthPatchViewModel({
    stageRef,
    msegEditorSurfaceRef,
    keyboardRef,
    voiceModeCount: VOICE_MODE_OPTIONS.length,
    msegSurfaceOrientation: msegEditorOrientation,
    msegCurveEditActivationMode: "hold-or-drag",
    onMsegCurveEditHoldActivated: () => {
      triggerIOSHaptic("light");
    }
  });
  const shellStyle = reactExports.useMemo(() => ({
    ["--cosimo-stage-min-height"]: `${layout.stageMinHeight}px`,
    ["--cosimo-keyboard-height"]: `${layout.keyboardHeight}px`,
    ["--cosimo-control-height"]: `${layout.controlHeight}px`
  }), [layout.controlHeight, layout.keyboardHeight, layout.stageMinHeight]);
  const displayStatus = reactExports.useMemo(() => {
    if (synthView.frameError) {
      return formatIOSFactoryLibraryLoadMessage("Could not load wavetable bank", synthView.frameError);
    }
    if (synthView.catalogError) {
      return formatIOSFactoryLibraryLoadMessage("Could not load wavetable catalog", synthView.catalogError);
    }
    if (synthView.runtimePresentation.failureMessage) {
      return synthView.runtimePresentation.failureMessage;
    }
    if (synthView.runtimePresentation.isPendingSelection && synthView.desiredTableName !== synthView.displayedTableName) {
      return `Loading ${synthView.desiredTableName}…`;
    }
    if (!synthView.frames) {
      return "Loading wavetable bank…";
    }
    return `${synthView.displayedFrameCount} shapes`;
  }, [
    synthView.catalogError,
    synthView.desiredTableName,
    synthView.displayedFrameCount,
    synthView.displayedTableName,
    synthView.frameError,
    synthView.frames,
    synthView.runtimePresentation.failureMessage,
    synthView.runtimePresentation.isPendingSelection
  ]);
  const bankReadout = reactExports.useMemo(() => {
    if (synthView.frameError) {
      return "Display unavailable";
    }
    if (synthView.runtimePresentation.failureMessage) {
      if (synthView.desiredTableName !== synthView.displayedTableName) {
        return `${synthView.displayedTableName} -> ${synthView.desiredTableName} • ${synthView.runtimePresentation.failureMessage}`;
      }
      return `${synthView.displayedTableName} • ${synthView.runtimePresentation.failureMessage}`;
    }
    if (synthView.runtimePresentation.isPendingSelection && synthView.desiredTableName !== synthView.displayedTableName) {
      return `${synthView.displayedTableName} -> ${synthView.desiredTableName}`;
    }
    return synthView.displayedTableName;
  }, [
    synthView.desiredTableName,
    synthView.displayedTableName,
    synthView.frameError,
    synthView.runtimePresentation.failureMessage,
    synthView.runtimePresentation.isPendingSelection
  ]);
  const tableErrorText = synthView.runtimePresentation.failureMessage ? synthView.failureDetail : null;
  const shouldShowOverlay = !synthView.frames || Boolean(synthView.frameError || synthView.catalogError);
  const handleSelectWavetable = reactExports.useCallback((nextValue) => {
    synthView.handleSelectWavetable(nextValue);
  }, [synthView]);
  const openMsegModal = reactExports.useCallback(() => {
    setIsMsegModalOpen(true);
  }, []);
  const closeMsegModal = reactExports.useCallback(() => {
    setIsMsegModalOpen(false);
  }, []);
  const handleOctaveDown = reactExports.useCallback(() => {
    setKeyboardRootNote((previousRootNote) => clamp(previousRootNote - 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
  }, []);
  const handleOctaveUp = reactExports.useCallback(() => {
    setKeyboardRootNote((previousRootNote) => clamp(previousRootNote + 12, KEYBOARD_ROOT_NOTE_MIN, KEYBOARD_ROOT_NOTE_MAX));
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ios-shell", style: shellStyle, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ios-top-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "ios-main-view",
          "data-hidden": isMsegModalOpen ? "true" : "false",
          "aria-hidden": isMsegModalOpen ? "true" : "false",
          children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "ios-scroll", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ios-content", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSWavetablePanel,
              {
                stageRef,
                frames: synthView.frames,
                observedPosition: synthView.observedPosition,
                warpMode: synthView.observedWarpState.hasActive ? synthView.observedWarpState.mode : synthView.warpMode.value,
                warpAmount: synthView.observedWarpState.hasActive ? synthView.observedWarpState.amount : synthView.warpAmount.value,
                displayedFrameCount: synthView.displayedFrameCount,
                displayedTableIndex: synthView.displayedTableIndex,
                desiredTableIndex: synthView.desiredTableIndex,
                tableOptions: synthView.tableOptions,
                shouldShowOverlay,
                displayStatus,
                tableErrorText,
                bankReadout,
                canRetryDesiredTableLoad: synthView.canRetryDesiredTableLoad,
                wavetableFocusBindings: synthView.keyboardRouting.wavetableFocusBindings,
                wavetablePosition: synthView.wavetablePosition,
                onSelectWavetable: handleSelectWavetable,
                onRetryLoad: synthView.handleRetryLoad
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSPlayPanel,
              {
                playModeValue: synthView.playMode.value,
                onPlayModeChange: synthView.playMode.commitValue,
                playModeFocusBindings: synthView.keyboardRouting.playModeFocusBindings,
                glideValue: synthView.glideTime.value,
                onGlideChange: synthView.glideTime.commitValue,
                glideFocusTarget: synthView.keyboardRouting.glideFocusTarget
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSDistortionPanel,
              {
                driveValue: synthView.distortionDriveDb.value,
                kneeValue: synthView.distortionKnee.value,
                wetValue: synthView.distortionWet.value,
                wetHPHzValue: synthView.distortionWetHPHz.value,
                wetLPHzValue: synthView.distortionWetLPHz.value,
                scopeFrame: synthView.observedDistortionScope,
                onDriveChange: synthView.distortionDriveDb.commitValue,
                onKneeChange: synthView.distortionKnee.commitValue,
                onWetChange: synthView.distortionWet.commitValue,
                onWetHPHzChange: synthView.distortionWetHPHz.commitValue,
                onWetLPHzChange: synthView.distortionWetLPHz.commitValue
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSMsegLauncher,
              {
                msegState: synthView.msegState,
                selectedMsegSlot: synthView.selectedMsegSlot,
                previewOrientation: msegPreviewOrientation,
                onOpenEditor: openMsegModal,
                onToggleLoop: synthView.handleToggleMsegLoop,
                panValue: synthView.pan.value,
                onPanChange: synthView.pan.commitValue,
                onSelectMsegSlot: synthView.handleSelectMsegSlot
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSModulationMatrixPanel,
              {
                selectedEnvelopeSlot: synthView.selectedEnvelopeSlot,
                selectedEnvelope: synthView.selectedEnvelope,
                routes: synthView.routes,
                onSelectEnvelopeSlot: synthView.handleSelectEnvelopeSlot,
                onEnvelopeChange: synthView.handleEnvelopeChange,
                onAddRoute: synthView.handleAddRoute,
                onRemoveRoute: synthView.handleRemoveRoute,
                onRouteChange: synthView.handleRouteChange
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              IOSKeyboardToolbar,
              {
                keyboardRootLabel: formatKeyboardRangeLabel(keyboardRootNote, layout.noteCount),
                canOctaveDown: keyboardRootNote > KEYBOARD_ROOT_NOTE_MIN,
                canOctaveUp: keyboardRootNote < KEYBOARD_ROOT_NOTE_MAX,
                onOctaveDown: handleOctaveDown,
                onOctaveUp: handleOctaveUp
              }
            )
          ] }) })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        IOSMsegModal,
        {
          isOpen: isMsegModalOpen,
          onClose: closeMsegModal,
          slotLabel: `MSEG ${synthView.selectedMsegSlot + 1}`,
          msegState: synthView.msegState,
          surfaceRef: msegEditorSurfaceRef,
          orientation: msegEditorOrientation,
          selectedPointIndex: synthView.msegEditor.selectedPointIndex,
          hoveredSegmentIndex: synthView.msegEditor.hoveredSegmentIndex,
          activeSegmentIndex: synthView.msegEditor.activeSegmentIndex,
          onPointerDown: synthView.msegEditor.handlePointerDown,
          onPointerMove: synthView.msegEditor.handlePointerMove,
          onPointerLeave: synthView.msegEditor.handlePointerLeave,
          onPointerUp: synthView.msegEditor.handlePointerUp,
          rateSeconds: synthView.msegState?.playback.rate.seconds ?? 1,
          onRateChange: synthView.handleMsegRateChange,
          onToggleLoop: synthView.handleToggleMsegLoop,
          rateFocusBindings: synthView.keyboardRouting.msegRateFocusBindings
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "keyboard-footer", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      IOSKeyboardDock,
      {
        rootNote: keyboardRootNote,
        noteCount: layout.noteCount,
        naturalNoteWidth: layout.keyboardNaturalNoteWidth,
        accidentalWidth: layout.keyboardAccidentalWidth,
        keyboardRef
      }
    ) })
  ] });
}
function IOSPatchView({
  patchConnection,
  resourceClient
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(PatchConnectionProvider, { patchConnection, resourceClient, children: /* @__PURE__ */ jsxRuntimeExports.jsx(IOSPatchViewBody, {}) });
}
function formatErrorMessage(error) {
  if (error && typeof error === "object") {
    const maybeError = error;
    return maybeError.stack || maybeError.message || String(error);
  }
  return String(error);
}
class IOSPatchErrorBoundary extends reactExports.Component {
  state = {
    errorMessage: null
  };
  static getDerivedStateFromError(error) {
    return {
      errorMessage: formatErrorMessage(error)
    };
  }
  componentDidCatch(error, errorInfo) {
    const combinedMessage = [
      formatErrorMessage(error),
      errorInfo.componentStack
    ].filter(Boolean).join("\n\n");
    this.setState({ errorMessage: combinedMessage });
    console.error("Cosimo iPhone patch view crashed during render", error, errorInfo);
  }
  render() {
    if (this.state.errorMessage) {
      return reactExports.createElement(
        "pre",
        {
          style: {
            display: "block",
            width: "100%",
            height: "100%",
            overflow: "auto",
            margin: "0",
            padding: "16px",
            background: "#080b14",
            color: "#ffd7df",
            font: "12px/1.45 Menlo, Monaco, monospace",
            whiteSpace: "pre-wrap"
          }
        },
        this.state.errorMessage
      );
    }
    return this.props.children;
  }
}
class CosimoIOSReactViewElement extends HTMLElement {
  patchConnection = null;
  resourceClient = null;
  root = null;
  mountPoint = null;
  modulationRuntimePatchConnection = null;
  setPatchConnection(patchConnection, resourceClient) {
    if (this.modulationRuntimePatchConnection && this.modulationRuntimePatchConnection !== patchConnection) {
      releaseModulationRuntimeBridge(this.modulationRuntimePatchConnection);
      this.modulationRuntimePatchConnection = null;
    }
    this.patchConnection = patchConnection;
    this.resourceClient = resourceClient ?? null;
    if (!this.modulationRuntimePatchConnection) {
      acquireModulationRuntimeBridge(patchConnection);
      this.modulationRuntimePatchConnection = patchConnection;
    }
    this.renderApp();
  }
  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
    if (!this.mountPoint || !this.root) {
      const shadowRoot = this.shadowRoot;
      const style = document.createElement("style");
      style.textContent = cssText;
      const mountPoint = document.createElement("div");
      mountPoint.style.width = "100%";
      mountPoint.style.height = "100%";
      shadowRoot.replaceChildren(style, mountPoint);
      this.mountPoint = mountPoint;
      this.root = clientExports.createRoot(mountPoint);
    }
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";
    this.renderApp();
  }
  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
    if (this.modulationRuntimePatchConnection) {
      releaseModulationRuntimeBridge(this.modulationRuntimePatchConnection);
      this.modulationRuntimePatchConnection = null;
    }
  }
  renderApp() {
    if (!this.root || !this.patchConnection) {
      return;
    }
    this.root.render(
      /* @__PURE__ */ jsxRuntimeExports.jsx(IOSPatchErrorBoundary, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        IOSPatchView,
        {
          patchConnection: this.patchConnection,
          resourceClient: this.resourceClient ?? createIOSResourceClient(this.patchConnection)
        }
      ) })
    );
  }
}
function getTagName() {
  return "cosimo-synth-view";
}
function createIOSPatchView(patchConnection, options = {}) {
  const tagName = getTagName();
  if (!window.customElements.get(tagName)) {
    window.customElements.define(tagName, CosimoIOSReactViewElement);
  }
  const element = document.createElement(tagName);
  element.setPatchConnection(patchConnection, options.resourceClient);
  return element;
}
function createPatchView(patchConnection) {
  return createIOSPatchView(patchConnection);
}
export {
  createIOSPatchView,
  createPatchView as default
};
//# sourceMappingURL=index.ios.js.map
