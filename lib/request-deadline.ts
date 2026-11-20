/** A timeout is an uncertain result; callers retain their operation ID for retry. */
export function withRequestDeadline<T>(request: PromiseLike<T>, milliseconds = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out. Retry the same request.')), milliseconds);
    // Node-only test/server timers should not keep an otherwise retired request alive.
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    Promise.resolve(request).then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
