// The world repeats each lap; markers from distant laps would imply false proximity.
export function nearbyMapStations(stations, distance, lapLength) {
  return stations.filter(station => station.dist >= distance - 40 && station.dist < distance + lapLength - 40)
}
