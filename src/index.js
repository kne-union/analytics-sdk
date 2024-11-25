import get from 'lodash/get';
import uuid from 'short-uuid';
import merge from 'lodash/merge';
import isPlainObject from 'lodash/isPlainObject';
import transform from 'lodash/transform';
import omit from 'lodash/omit';
import axios from 'axios';

const ajax = (...args) => {
  const instance = axios.create({});
  return instance(...args).catch(() => {});
};

const createFingerprint = domain => {
  let fingerprint;

  function bin2hex(s) {
    let i,
      l,
      n,
      o = '';
    s += '';
    for (i = 0, l = s.length; i < l; i++) {
      n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  let canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');
  let txt = domain || window.location.host;
  ctx.textBaseline = 'top';
  ctx.font = "14px 'Arial'";
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText(txt, 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText(txt, 4, 17);
  let b64 = canvas.toDataURL().replace('data:image/png;base64,', '');
  let bin = window.atob(b64);
  fingerprint = bin2hex(bin.slice(-16, -12));
  return fingerprint;
};

const createUUID = () => {
  return uuid.generate();
};

const domReady = fn => {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
};

const objectDataFormat = (target, data) => {
  const core = target => {
    if (isPlainObject(target)) {
      return transform(
        target,
        (result, value, key) => {
          result[key] = core(value);
        },
        {}
      );
    }
    if (Array.isArray(target)) {
      return transform(
        target,
        (result, value) => {
          result.push(core(value));
        },
        []
      );
    }

    if (typeof target === 'string' && /^\$/.test(target)) {
      return get(data, target.substring(1)) || '';
    }

    return target;
  };

  return core(target);
};

performance.mark('first-contentful-paint');
domReady(() => {
  window.performance.mark('first-screen-render');
});

// 初始化
const init = (systemName, options) => {
  const { version, lastPublishTimestamp, reportAdapterUrl, cacheTime, cacheName, uuidName, fingerprintName, eventName, getScrollElement, debug } = Object.assign(
    {},
    {
      cacheTime: 0,
      eventName: 'acs-event-trigger',
      uuidName: '_acs_uuid',
      fingerprintName: '_acs_fingerprint',
      getScrollElement: () => document.documentElement,
      debug: false
    },
    options
  );

  const userAgent = window.navigator.userAgent,
    language = window.navigator.language,
    { width: screenWidth, height: screenHeight, pixelDepth: screenPixelDepth } = window.screen;
  let fingerprint = window.localStorage.getItem(fingerprintName);
  if (!fingerprint) {
    fingerprint = createFingerprint();
    window.localStorage.setItem(fingerprintName, fingerprint);
  }
  let uuid = window.localStorage.getItem(uuidName);
  if (!uuid) {
    uuid = createUUID();
    window.localStorage.setItem(uuidName, uuid);
  }
  const taskPromise = (async () => {
    await new Promise(resolve => {
      domReady(resolve);
    });
    const { data } = await ajax({ url: reportAdapterUrl, method: 'GET' });
    let reportOptions = data;

    const reportAction = (({ cacheTime = 0 }) => {
      let cache = {};
      if (cacheTime > 0) {
        setInterval(() => {
          Object.keys(cache).forEach(name => {
            if (cache[name] && cache[name].length > 0) {
              const { paramsType, ...requestOptions } = cache[name][0];
              const sendData = cache[name].map(item => item[[paramsType]]);
              ajax(Object.assign({}, requestOptions, { [paramsType]: cacheName ? { [cacheName]: sendData } : sendData }));
              cache[name] = [];
            }
          });
        }, cacheTime);
      }
      return (name, option) => {
        if (cacheTime > 0) {
          if (!cache[name]) {
            cache[name] = [];
          }
          cache[name].push(option);
          return;
        }
        ajax(omit(option, ['paramsType'])).catch(() => {});
      };
    })({ cacheTime });

    document.addEventListener(eventName, e => {
      const { name, data } = e.detail;
      const url = window.location.href,
        time = Date.now();

      const reportOriginData = Object.assign({}, data, {
        eventName: name,
        basic: {
          url,
          time,
          userAgent,
          uuid,
          fingerprint,
          fingerprintAndUUID: `${uuid}_${fingerprint}`,
          language,
          screenWidth,
          screenHeight,
          screenPixelDepth,
          systemName,
          version,
          lastPublishTimestamp
        },
        localInfo: {
          localStorage: {},
          sessionStorage: {},
          cookie: {}
        }
      });

      if (debug) {
        console.log(`event:${name}`, reportOriginData);
      }

      const rule = reportOptions.rules.find(rule => {
        return !!(rule.matcher || []).find(matcher => {
          return Object.keys(matcher).every(name => {
            const value = matcher[name];
            const data = get(reportOriginData, name);
            if (/^\/.+\/$/.test(value)) {
              const regExp = new RegExp(value.substring(0, value.length - 2));
              return regExp.test(data);
            }
            return value === data;
          });
        });
      });

      if (!rule) {
        return;
      }

      const localInfo = merge({}, reportOptions.localInfo, rule.localInfo);

      //获取本地存储信息
      if (localInfo?.localStorage && localInfo.localStorage.length > 0) {
        localInfo.localStorage.forEach(name => {
          const target = window.localStorage.getItem(name);
          if (target) {
            reportOriginData.localInfo.localStorage[name] = target;
          }
        });
      }
      if (localInfo?.sessionStorage && localInfo.sessionStorage.length > 0) {
        localInfo.sessionStorage.forEach(name => {
          const target = window.sessionStorage.getItem(name);
          if (target) {
            reportOriginData.localInfo.sessionStorage[name] = target;
          }
        });
      }
      if (localInfo?.cookie && localInfo.cookie.length > 0) {
        const cookieData = new Map();
        document.cookie.split(';').forEach(token => {
          const [name, value] = token.split('=').map(item => item.trim());
          cookieData.set(name, value);
        });
        localInfo.cookie.forEach(name => {
          const target = cookieData.get(name);
          if (target) {
            reportOriginData.localInfo.cookie[name] = target;
          }
        });
      }
      const apiName = rule.api || reportOptions.defaultApi || Object.keys(reportOptions.apis)?.[0];
      const api = reportOptions.apis[apiName];
      const requestDataTemplate = merge({}, api?.[api.paramsType], rule?.[api.paramsType]);
      const requestData = objectDataFormat(
        requestDataTemplate,
        Object.assign({}, reportOriginData, {
          ruleProps: rule.props
        })
      );

      if (debug) {
        console.log('rule:', rule, api, requestDataTemplate, reportOptions, requestData);
      }
      reportAction(apiName, Object.assign({}, api, { [api.paramsType]: requestData }));
    });
  })();

  const eventTrigger = ({ name, data }) => {
    const event = new CustomEvent(eventName, {
      detail: { name, data }
    });
    taskPromise.then(() => {
      document.dispatchEvent(event);
    });
  };

  domReady(() => {
    window.performance.measure('DOMContentLoadedTime', 'first-contentful-paint', 'first-screen-render');
    const duration = window.performance.getEntriesByName('DOMContentLoadedTime')[0].duration;
    eventTrigger({
      name: 'DOMContentLoaded',
      data: { duration, location: window.location }
    });
    document.addEventListener(
      'click',
      e => {
        const target = e.target;
        const currentElement = (({ target }) => {
          const receiverElements = document.querySelectorAll('[data-event-receiver]');
          if (receiverElements.length === 0) {
            return target;
          }
          const parentElement = [].find.call(receiverElements, current => {
            return current.contains(target);
          });

          if (parentElement) {
            return parentElement;
          }

          return target;
        })({ target });

        const elementId = currentElement.getAttribute('data-event-id'),
          elementData = currentElement.getAttribute('data-event-data');

        const scrollElement = getScrollElement();
        eventTrigger({
          name: 'click',
          data: {
            element: {
              id: elementId,
              data: elementData ? JSON.parse(elementData) : {},
              clientX: e.clientX,
              clientY: e.clientY,
              scrollLeft: scrollElement.scrollLeft,
              scrollTop: scrollElement.scrollTop
            }
          }
        });
      },
      true
    );

    window.addEventListener('hashchange', () => {
      eventTrigger({
        name: 'hashchange',
        data: { location: window.location }
      });
    });

    window.addEventListener('popstate', () => {
      eventTrigger({
        name: 'popstate',
        data: { location: window.location }
      });
    });

    document.addEventListener(
      'error',
      error => {
        eventTrigger({
          name: 'error',
          data: {
            message: error.message,
            stack: error.stack
          }
        });
      },
      true
    );
  });

  return {
    eventTrigger,
    onReady: callback => {
      taskPromise.then(callback || (() => {}));
    }
  };
};

export { init };
