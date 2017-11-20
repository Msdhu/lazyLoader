const awaitStack = [];
const loadMap = new Map();
const cacheMap = new Map();
const cacheSize = 200;
let taskId = 1;

class Task {
  constructor(url, timeout = 4000) {
    this.id = taskId;
    taskId += 1;
    this.url = url;
    this.timeout = timeout;
    this.timeoutId = 0;
    this.state = 'pending';
    this.failedCount = 0;
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }
}

function isCached(url) {
  const cachedImage = cacheMap.get(url);
  if (cachedImage) {
    cacheMap.delete(url);
    cacheMap.set(url, cachedImage);
    return true;
  }
  return false;
}

function createTaskPromise(task) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    task.image = image;
    image.onload = () => {
      if (task.state !== 'rejected') {
        resolve(task);
      }
    };
    image.onerror = () => {
      reject(task);
    };
    image.src = task.url;

    task.timeoutId = setTimeout(() => {
      if (task.state !== 'resolved') {
        reject(task);
      }
    }, task.timeout);
  });
}

async function _load() {
  if (awaitStack.length === 0 || loadMap.size >= 4) {
    return;
  }

  // 从等待栈尾部获取任务
  const task = awaitStack.pop();
  if (isCached(task.url)) {
    task.state = 'resolved';
    task._resolve(cacheMap.get(task.url));
    _load();
    return;
  }
  loadMap.set(task.id, task);

  try {
    await createTaskPromise(task);
    if (!isCached(task.url)) {
      // 超出缓存数量 清除最早缓存的数据
      if (cacheMap.size > cacheSize) {
        let index = 0;
        for (const url of cacheMap.keys()) {
          if (index > Math.round(cacheSize / 10)) {
            break;
          }
          cacheMap.delete(url);
          index += 1;
        }
      }
      cacheMap.set(task.url, task.image);
    }
    task.state = 'resolved';
    task._resolve(task.image);
  } catch (_task) {
    // 增加失败计数
    task.failedCount += 1;
    // 失败次数小于4次 任务重新放入等待栈头部
    if (task.failedCount >= 4) {
      task.state = 'rejected';
      task._reject({ url: task.url });
    } else {
      awaitStack.unshift(task);
    }
  } finally {
    task.image.onload = null;
    task.image.onerror = null;
    clearTimeout(task.timeoutId);
    loadMap.delete(task.id);
    _load();
  }
}

export default function loadImage(url, timeout) {
  if (isCached(url)) {
    return Promise.resolve(cacheMap.get(url));
  }
  const task = new Task(url, timeout);
  awaitStack.push(task);
  _load();
  return task.promise;
}
export { loadImage };
