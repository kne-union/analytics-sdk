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
