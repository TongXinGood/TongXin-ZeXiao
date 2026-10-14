/**
 * 数据层：所有数据都从这里取
 * - mock 模式：读 mock/data.js
 * - 线上模式：请求服务器 JSON，并按 meta.version 做本地缓存
 */
const config = require('../config')

const CACHE_PREFIX = 'api_cache_'
let memMeta = null

function request(path) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.BASE_URL + path,
      timeout: 10000,
      success(res) {
        if (res.statusCode === 200 && res.data && typeof res.data === 'object') resolve(res.data)
        else reject(new Error('服务器返回异常（' + res.statusCode + '）'))
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络请求失败'))
      }
    })
  })
}

function readCache(key) {
  try {
    return wx.getStorageSync(CACHE_PREFIX + key) || null
  } catch (e) {
    return null
  }
}

function writeCache(key, version, data) {
  try {
    wx.setStorageSync(CACHE_PREFIX + key, { version, data })
  } catch (e) {}
}

/** meta 每次冷启动都请求一次，拿最新版本号；失败时退回缓存 */
function getMeta(force) {
  if (config.USE_MOCK) return Promise.resolve(require('../mock/data.js').meta)
  if (memMeta && !force) return Promise.resolve(memMeta)
  return request('/meta.json')
    .then((meta) => {
      memMeta = meta
      writeCache('meta', meta.version, meta)
      return meta
    })
    .catch((e) => {
      const c = readCache('meta')
      if (c) {
        memMeta = c.data
        return c.data
      }
      throw e
    })
}

/** 版本一致用缓存，不一致重新下载 */
function getVersioned(key, path, force) {
  return getMeta(force).then((meta) => {
    const c = readCache(key)
    if (c && c.version === meta.version) return c.data
    return request(path)
      .then((data) => {
        writeCache(key, meta.version, data)
        return data
      })
      .catch((e) => {
        if (c) return c.data // 网络失败时用旧缓存兜底
        throw e
      })
  })
}

function getPrograms(force) {
  if (config.USE_MOCK) return Promise.resolve(require('../mock/data.js').programs)
  return getVersioned('programs', '/programs.json', force)
}

function getSchoolDetail(schoolId) {
  if (config.USE_MOCK) {
    const d = require('../mock/data.js').details[schoolId]
    return d ? Promise.resolve(d) : Promise.reject(new Error('未找到该院校数据'))
  }
  return getVersioned('detail_' + schoolId, '/detail/' + schoolId + '.json')
}

module.exports = { getMeta, getPrograms, getSchoolDetail }
