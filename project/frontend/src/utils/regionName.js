export function matchRegionNames(regions, featureNames) {
  if (!featureNames || !featureNames.length) {
    return regions
  }
  return regions.map((region) => {
    if (!region || !region.name) {
      return region
    }
    const match = featureNames.find(
      (n) => n === region.name || n.startsWith(region.name) || region.name.startsWith(n)
    )
    return match ? { ...region, name: match } : region
  })
}