import { createFunction } from '@kne/create-props';
import { EventEmitter } from 'fbemitter';
import axios from 'axios';
import { get, merge, isPlainObject, transform, omit } from 'lodash';

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
  let result = [];
  let hexDigits = '0123456789abcdef';
  for (let i = 0; i < 36; i++) {
    result[i] = hexDigits.substring(Math.floor(Math.random() * 0x10), 1);
  }
  // bits 12-15 of the time_hi_and_version field to 0010
  result[14] = '4';
  // bits 6-7 of the clock_seq_hi_and_reserved to 01
  result[19] = hexDigits.substr((result[19] & 0x3) | 0x8, 1);
  result[8] = result[13] = result[18] = result[23] = '-';
  return result.join('');
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

const emitter = new EventEmitter();

// 事件触发器实现
export const eventTrigger = createFunction(
  'eventTrigger',
  z => {
    return {
      args: [
        z
          .object({
            name: z.string().describe('事件名称'),
            data: z.object({}).passthrough().describe('上报数据')
          })
          .required({ name: true })
      ]
    };
  },
  ''
)(({ name, data }) => {
  //基础信息收集 1. 所在页面url localStorage sessionStorage cookie navigator.userAgent navigator.language 视口大小 页面滚动位置
  emitter.emit(`acs-event-trigger`, { name, data });
});

// 初始化
const init = createFunction(
  'init',
  z => {
    return {
      args: [
        z.string().describe('系统唯一标识'),
        z
          .object({
            version: z.string().default('0.0.1').describe('系统版本'),
            lastPublishTimestamp: z.number().default(0).describe('系统最后发布时间'),
            reportAdapterUrl: z.string().describe('上报适配器配置url地址'),
            cacheTime: z.number().default(0).describe('上报缓存时间'),
            eventName: z.string().default('acs-event-trigger').describe('事件名称'),
            uuidName: z.string().default('_acs_uuid').describe('uuid的localStorage存储key'),
            fingerprintName: z.string().default('_acs_fingerprint').describe('fingerprint的localStorage存储key'),
            getScrollElement: z
              .function()
              .returns(z.object({}).passthrough().describe('scrollElement'))
              .default(() => document.documentElement)
              .describe('页面滚动元素')
          })
          .passthrough()
          .default({})
          .describe('可选参数')
      ]
    };
  },
  '初始化'
)(async (systemName, { version, lastPublishTimestamp, reportAdapterUrl, cacheTime, uuidName, fingerprintName, eventName, getScrollElement }) => {
  performance.mark('first-contentful-paint');
  //页面加载
  document.addEventListener('DOMContentLoaded', () => {
    window.performance.mark('first-screen-render');
    window.performance.measure('DOMContentLoadedTime', 'first-contentful-paint', 'first-screen-render');
    const duration = window.performance.getEntriesByName('DOMContentLoadedTime')[0].duration;
    eventTrigger({
      name: 'DOMContentLoaded',
      data: { duration }
    });
  });
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

  const { data } = await axios.get(reportAdapterUrl);
  let reportOptions = data;

  const reportAction = (({ cacheTime }) => {
    let cache = {};
    if (cacheTime > 0) {
      setInterval(() => {
        Object.keys(cache).forEach(name => {
          if (cache[name] && cache[name].length > 0) {
            const { paramsType, ...requestOptions } = cache[name][0];
            axios(Object.assign({}, requestOptions, { [paramsType]: cache[name].map(item => item[[paramsType]]) }));
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
      axios(omit(option, ['paramsType']));
    };
  })({ cacheTime });

  document.addEventListener(
    'click',
    e => {
      const target = e.target;
      const elementId = target.getAttribute('data-event-id');
      const elementData = target.getAttribute('data-event-data');
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

  emitter.addListener(eventName, ({ name, data }) => {
    const url = window.location.href,
      time = Date.now();

    const { element } = data;

    const reportOriginData = {
      eventName: name,
      basic: {
        url,
        time,
        userAgent,
        uuid,
        fingerprint,
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
      },
      element
    };

    const rule = reportOptions.rules.find(rule => {
      if (rule.matcher.eventName && rule.matcher.eventName !== reportOriginData.eventName) {
        return false;
      }
      if (rule.matcher.elementId && rule.matcher.elementId !== reportOriginData.element.id) {
        return false;
      }
      return true;
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

    const requestData = objectDataFormat(
      merge({}, api?.data, rule.data),
      Object.assign({}, reportOriginData, {
        ruleProps: rule.props
      })
    );

    reportAction(apiName, Object.assign({}, api, { [api.paramsType]: requestData }));
  });
});

export default init;
