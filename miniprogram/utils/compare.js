/** 对比清单：只存专业 id，保存在本地缓存 */
const { MAX_COMPARE } = require('../config')
const KEY = 'compare_ids'

function getIds() {
  try {
    return wx.getStorageSync(KEY) || []
  } catch (e) {
    return []
  }
}

function save(ids) {
  try {
    wx.setStorageSync(KEY, ids)
  } catch (e) {}
}

/** 加入/移出，返回 { ids, added, full } */
function toggle(id) {
  const ids = getIds()
  const i = ids.indexOf(id)
  if (i >= 0) {
    ids.splice(i, 1)
    save(ids)
    return { ids, added: false, full: false }
  }
  if (ids.length >= MAX_COMPARE) return { ids, added: false, full: true }
  ids.push(id)
  save(ids)
  return { ids, added: true, full: false }
}

function remove(id) {
  save(getIds().filter((x) => x !== id))
}

function clear() {
  save([])
}

module.exports = { getIds, toggle, remove, clear }
