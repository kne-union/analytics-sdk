
# analytics-sdk


### 描述

完成用户行为的分析上报


### 安装

```shell
npm i --save @kne/analytics-sdk
```

### 示例


#### 示例样式

```scss
.ant-card {
  border-color: black;
  text-align: center;
  width: 200px;
}
```

#### 示例代码

- 这里填写示例标题
- 这里填写示例说明
- _AnalyticsSdk(@kne/current-lib_analytics-sdk)[import * as _AnalyticsSdk from "@kne/analytics-sdk"]

```jsx
const { init: AnalyticsSdk } = _AnalyticsSdk;

AnalyticsSdk('test', {
  cacheTime: 1000,
  reportAdapterUrl: window.PUBLIC_URL + '/report.json',
  getScrollElement: () => document.querySelector('.simplebar-content-wrapper')
});
const BaseExample = () => {
  return <div data-event-id="check-inner-resource" data-event-receiver="true" data-event-data={JSON.stringify({
    serialNumber: '123', language: 'zh-cn', goalId: '345'
  })}>
    页面
    <button>按钮</button>
  </div>;
};

render(<BaseExample />);

```


### API

| 属性名 | 说明 | 类型 | 默认值 |
|-----|----|----|-----|
|     |    |    |     |

