export function shouldBlockStripeOperation(
  settingValue,
  queryFailed = false,
) {
  return queryFailed || settingValue !== 'false';
}
