/**
 * 共用字典：数据构建脚本、问卷、院校库筛选都从这里取选项，保证三处一致
 * （scripts/build.js 也会 require 这个文件）
 */

const LEVELS = ['C9', '985', '211', '双一流', '研究院', '双非']

// 大区 → 省份（顺序即页面显示顺序）
const REGION_PROVINCES = [
  { region: '华东', provinces: ['上海', '江苏', '浙江', '安徽', '福建', '江西', '山东'] },
  { region: '华北', provinces: ['北京', '天津', '河北', '山西', '内蒙古'] },
  { region: '华中', provinces: ['河南', '湖北', '湖南'] },
  { region: '华南', provinces: ['广东', '广西', '海南'] },
  { region: '西南', provinces: ['重庆', '四川', '贵州', '云南', '西藏'] },
  { region: '西北', provinces: ['陕西', '甘肃', '青海', '宁夏', '新疆'] },
  { region: '东北', provinces: ['辽宁', '吉林', '黑龙江'] }
]

function regionOf(province) {
  const g = REGION_PROVINCES.filter((x) => x.provinces.indexOf(province) >= 0)[0]
  return g ? g.region : ''
}

// 专业方向：学硕 / 专硕各自的可选方向
const DIRECTIONS = {
  academic: ['计算机科学与技术', '软件工程', '网络空间安全', '人工智能', '交叉学科'],
  professional: ['计算机技术', '软件工程', '人工智能', '大数据技术与工程', '网络与信息安全', '电子信息', '交叉学科']
}

// 专业代码 → 方向（数据里可用 direction 字段手动覆盖）
const DIRECTION_BY_CODE = {
  '081200': '计算机科学与技术',
  '083500': '软件工程',
  '083900': '网络空间安全',
  '085400': '电子信息',
  '085404': '计算机技术',
  '085405': '软件工程',
  '085410': '人工智能',
  '085411': '大数据技术与工程',
  '085412': '网络与信息安全'
}

/** 推断方向：手动指定 > 专业代码 > 名称含「人工智能」> 代码以 14 开头（交叉学科门类） */
function directionOf(p) {
  if (p.direction) return p.direction
  if (DIRECTION_BY_CODE[p.majorCode]) return DIRECTION_BY_CODE[p.majorCode]
  if ((p.majorName || '').indexOf('人工智能') >= 0) return '人工智能'
  if (/^14/.test(p.majorCode || '')) return '交叉学科'
  return ''
}

const STUDY_MODES = { full: '全日制', part: '非全日制' }

module.exports = { LEVELS, REGION_PROVINCES, regionOf, DIRECTIONS, DIRECTION_BY_CODE, directionOf, STUDY_MODES }
