import { describe, it, expect } from 'vitest'
import { matchRegionNames } from '../src/utils/regionName'

describe('区域名称匹配（db.json 简称 → DataV geojson 全称）', () => {
  it('将省份简称映射为 geojson 全称', () => {
    const featureNames = ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '湖南省', '广东省', '广西壮族自治区', '贵州省']
    const regions = [
      { name: '湖南', value: 762 },
      { name: '广东', value: 534 },
      { name: '广西', value: 198 },
      { name: '贵州', value: 128 }
    ]
    const result = matchRegionNames(regions, featureNames)
    expect(result.map((r) => r.name)).toEqual(['湖南省', '广东省', '广西壮族自治区', '贵州省'])
    expect(result.map((r) => r.value)).toEqual([762, 534, 198, 128])
  })

  it('featureNames 为空时原样返回（离线条形图模式）', () => {
    const regions = [{ name: '湖南', value: 762 }]
    expect(matchRegionNames(regions, [])).toEqual(regions)
    expect(matchRegionNames(regions, null)).toEqual(regions)
  })

  it('未匹配到的地区原样保留', () => {
    const result = matchRegionNames([{ name: '亚特兰蒂斯', value: 1 }], ['湖南省'])
    expect(result[0].name).toBe('亚特兰蒂斯')
  })

  it('已是全称的数据不被误改（精确匹配优先）', () => {
    const result = matchRegionNames([{ name: '湖南省', value: 100 }], ['湖南省', '湖北省'])
    expect(result[0].name).toBe('湖南省')
  })

  it('相邻简称不发生误匹配（湖南≠湖北、江苏≠江西、山东≠山西）', () => {
    const featureNames = ['河北省', '山西省', '辽宁省', '江苏省', '浙江省', '江西省', '山东省', '河南省', '湖北省', '湖南省']
    const regions = [
      { name: '湖南', value: 1 },
      { name: '湖北', value: 2 },
      { name: '江苏', value: 3 },
      { name: '江西', value: 4 },
      { name: '山东', value: 5 },
      { name: '山西', value: 6 }
    ]
    const result = matchRegionNames(regions, featureNames)
    expect(result.map((r) => r.name)).toEqual(['湖南省', '湖北省', '江苏省', '江西省', '山东省', '山西省'])
  })
})