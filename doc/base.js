const { default: AnalyticsSdk } = _AnalyticsSdk;

AnalyticsSdk('test', {
  cacheTime: 1000,
  reportAdapterUrl: window.PUBLIC_URL + '/report.json',
  getScrollElement: () => document.querySelector('.simplebar-content-wrapper')
});
const BaseExample = () => {
  return <div data-event-id="check-inner-resource" data-event-data={JSON.stringify({
    serialNumber: '123', language: 'zh-cn', goalId: '345'
  })}>
    页面
  </div>;
};

render(<BaseExample />);
