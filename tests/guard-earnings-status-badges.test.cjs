const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./helpers/enterprise-module.cjs');
const PayoutTable = load('app/guard/earnings/PayoutTable.tsx').default;

function render(status, amount = 80) {
  return renderToStaticMarkup(React.createElement(PayoutTable, {
    earnings: [{ id: 'owned-assignment', status: 'completed', payment_status: status,
      jobs: { job_title: 'Controlled QA receipt', status: 'completed' } }],
    payoutsMap: { 'owned-assignment': { status, amount: 100, net_amount: amount } },
    calculateEarnings: () => 100,
    onViewDetails: () => {},
  }));
}

test('actual earnings table labels every recognised paid receipt as Paid, including paid_out', () => {
  for (const status of ['paid_out', 'paid', 'completed', 'succeeded', 'transferred', 'payout_paid', 'PAID-OUT']) {
    const html = render(status, 0);
    assert.match(html, />Paid<\/span>/, status);
    assert.doesNotMatch(html, />Pending<\/span>/, status);
    assert.match(html, /text-green-700/, status);
    assert.match(html, />Completed<\/span>/, status);
    assert.match(html, /£0\.00/, 'zero net is preserved');
  }
});

test('actual earnings table keeps cancelled and refunded outcomes out of the Pending badge', () => {
  for (const [status, label] of [['cancelled', 'Cancelled'], ['refunded', 'Refunded'], ['refund_completed', 'Refunded'], ['reversed', 'Reversed']]) {
    const html = render(status);
    assert.match(html, new RegExp('>' + label + '</span>'), status);
    assert.doesNotMatch(html, />Pending<\/span>|>Paid<\/span>|>Completed<\/span>/, status);
  }
  assert.match(render('pending'), />Pending<\/span>/);
  assert.match(render('processing'), />Processing<\/span>/);
  assert.match(render('held'), />On Hold<\/span>/);
  assert.match(render('failed'), />Failed<\/span>/);
});
