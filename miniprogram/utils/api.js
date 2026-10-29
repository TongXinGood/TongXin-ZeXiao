/**
 * 数据层：所有数据都从这里取
 * - mock 模式：读 mock/data.js
 * - 线上模式：请求服务器 JSON，并按 meta.version 做本地缓存
 */
const config = require('../config')

const CACHE_PREFIX = 'api_cache_'
let memMeta = null
let metaPromise = null // 同时有多个请求要 meta 时，共用同一次网络请求

// 本地调试数据（config.USE_MOCK=true 时用）；没生成时给出明确提示
function mock() {
  const d = require('../mock/data.js')
  if (!d) throw new Error('本地调试数据未生成：请运行 node scripts/build.js --mock，或把 config.js 的 USE_MOCK 改为 false')
  return d
}

function request(path) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.BASE_URL + path,
      timeout: 10000,
      success(res) {
        if (res.statusCode === 200 && res.data && typeof res.data === 'object') resolve(res.data)
        else reject(new Error('数据加载失败（' + res.statusCode + '），请稍后再试'))
      },
      fail(err) {
        console.error('[api] 请求失败', path, err)
        reject(new Error('网络连接失败，请检查网络后重试'))
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
  if (config.USE_MOCK) return Promise.resolve().then(() => mock().meta)
  if (memMeta && !force) return Promise.resolve(memMeta)
  if (metaPromise && !force) return metaPromise
  metaPromise = request('/meta.json')
    .then((meta) => {
      metaPromise = null
      memMeta = meta
      writeCache('meta', meta.version, meta)
      return meta
    })
    .catch((e) => {
      metaPromise = null
      const c = readCache('meta')
      if (c) {
        memMeta = c.data
        return c.data
      }
      throw e
    })
  return metaPromise
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
  if (config.USE_MOCK) return Promise.resolve().then(() => mock().programs)
  return getVersioned('programs', '/programs.json', force)
}

function getSchoolDetail(schoolId) {
  if (config.USE_MOCK) {
    return Promise.resolve().then(() => {
      const d = mock().details[schoolId]
      if (!d) throw new Error('未找到该院校数据')
      return d
    })
  }
  return getVersioned('detail_' + schoolId, '/detail/' + schoolId + '.json')
}

function getNews(force) {
  if (config.USE_MOCK) return Promise.resolve().then(() => mock().news || { countdown: null, items: [] })
  return getVersioned('news', '/news.json', force)
}

module.exports = { getMeta, getPrograms, getSchoolDetail, getNews }
