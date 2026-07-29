export interface AirportInfo {
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

/** Curated set of major/common IATA airport codes with coordinates, used to
 * validate extracted 3-letter codes and to compute approximate great-circle
 * distances for the "miles flown" stat. Not exhaustive by design — unknown
 * codes are still kept as the route, just excluded from the mileage total. */
export const AIRPORTS: Record<string, AirportInfo> = {
  JFK: { name: "John F. Kennedy Intl", city: "New York", country: "US", lat: 40.6413, lon: -73.7781 },
  EWR: { name: "Newark Liberty Intl", city: "Newark", country: "US", lat: 40.6895, lon: -74.1745 },
  LGA: { name: "LaGuardia", city: "New York", country: "US", lat: 40.7769, lon: -73.874 },
  BOS: { name: "Logan Intl", city: "Boston", country: "US", lat: 42.3656, lon: -71.0096 },
  ORD: { name: "O'Hare Intl", city: "Chicago", country: "US", lat: 41.9742, lon: -87.9073 },
  MDW: { name: "Midway Intl", city: "Chicago", country: "US", lat: 41.786, lon: -87.7524 },
  DFW: { name: "Dallas/Fort Worth Intl", city: "Dallas", country: "US", lat: 32.8998, lon: -97.0403 },
  IAH: { name: "George Bush Intercontinental", city: "Houston", country: "US", lat: 29.9902, lon: -95.3368 },
  ATL: { name: "Hartsfield-Jackson Intl", city: "Atlanta", country: "US", lat: 33.6407, lon: -84.4277 },
  MIA: { name: "Miami Intl", city: "Miami", country: "US", lat: 25.7959, lon: -80.287 },
  MCO: { name: "Orlando Intl", city: "Orlando", country: "US", lat: 28.4312, lon: -81.3081 },
  FLL: { name: "Fort Lauderdale-Hollywood Intl", city: "Fort Lauderdale", country: "US", lat: 26.0742, lon: -80.1506 },
  DCA: { name: "Reagan National", city: "Washington", country: "US", lat: 38.8512, lon: -77.0402 },
  IAD: { name: "Dulles Intl", city: "Washington", country: "US", lat: 38.9531, lon: -77.4565 },
  PHL: { name: "Philadelphia Intl", city: "Philadelphia", country: "US", lat: 39.8744, lon: -75.2424 },
  SFO: { name: "San Francisco Intl", city: "San Francisco", country: "US", lat: 37.6213, lon: -122.379 },
  OAK: { name: "Oakland Intl", city: "Oakland", country: "US", lat: 37.7126, lon: -122.221 },
  SJC: { name: "San Jose Intl", city: "San Jose", country: "US", lat: 37.3639, lon: -121.929 },
  LAX: { name: "Los Angeles Intl", city: "Los Angeles", country: "US", lat: 33.9416, lon: -118.4085 },
  SAN: { name: "San Diego Intl", city: "San Diego", country: "US", lat: 32.7338, lon: -117.1933 },
  SEA: { name: "Seattle-Tacoma Intl", city: "Seattle", country: "US", lat: 47.4502, lon: -122.3088 },
  PDX: { name: "Portland Intl", city: "Portland", country: "US", lat: 45.5898, lon: -122.5951 },
  DEN: { name: "Denver Intl", city: "Denver", country: "US", lat: 39.8561, lon: -104.6737 },
  PHX: { name: "Sky Harbor Intl", city: "Phoenix", country: "US", lat: 33.4373, lon: -112.0078 },
  LAS: { name: "Harry Reid Intl", city: "Las Vegas", country: "US", lat: 36.084, lon: -115.1537 },
  SLC: { name: "Salt Lake City Intl", city: "Salt Lake City", country: "US", lat: 40.7899, lon: -111.9791 },
  MSP: { name: "Minneapolis-Saint Paul Intl", city: "Minneapolis", country: "US", lat: 44.8848, lon: -93.2223 },
  DTW: { name: "Detroit Metro", city: "Detroit", country: "US", lat: 42.2124, lon: -83.3534 },
  CLT: { name: "Charlotte Douglas Intl", city: "Charlotte", country: "US", lat: 35.214, lon: -80.9431 },
  BWI: { name: "Baltimore/Washington Intl", city: "Baltimore", country: "US", lat: 39.1774, lon: -76.6684 },
  AUS: { name: "Austin-Bergstrom Intl", city: "Austin", country: "US", lat: 30.1975, lon: -97.6664 },
  AYT: { name: "Antalya Airport", city: "Antalya", country: "TR", lat: 36.8987, lon: 30.8005 },
  HNL: { name: "Daniel K. Inouye Intl", city: "Honolulu", country: "US", lat: 21.3245, lon: -157.9251 },
  YYZ: { name: "Toronto Pearson Intl", city: "Toronto", country: "CA", lat: 43.6777, lon: -79.6248 },
  YVR: { name: "Vancouver Intl", city: "Vancouver", country: "CA", lat: 49.1947, lon: -123.1792 },
  YUL: { name: "Montreal-Trudeau Intl", city: "Montreal", country: "CA", lat: 45.4706, lon: -73.7408 },
  MEX: { name: "Mexico City Intl", city: "Mexico City", country: "MX", lat: 19.4363, lon: -99.0721 },
  CUN: { name: "Cancun Intl", city: "Cancun", country: "MX", lat: 21.0365, lon: -86.8771 },
  GRU: { name: "Sao Paulo-Guarulhos Intl", city: "Sao Paulo", country: "BR", lat: -23.4356, lon: -46.4731 },
  GIG: { name: "Rio de Janeiro-Galeao Intl", city: "Rio de Janeiro", country: "BR", lat: -22.81, lon: -43.2506 },
  EZE: { name: "Ministro Pistarini Intl", city: "Buenos Aires", country: "AR", lat: -34.8222, lon: -58.5358 },
  BOG: { name: "El Dorado Intl", city: "Bogota", country: "CO", lat: 4.7016, lon: -74.1469 },
  LIM: { name: "Jorge Chavez Intl", city: "Lima", country: "PE", lat: -12.0219, lon: -77.1143 },
  SCL: { name: "Arturo Merino Benitez Intl", city: "Santiago", country: "CL", lat: -33.393, lon: -70.7858 },
  LHR: { name: "Heathrow", city: "London", country: "GB", lat: 51.47, lon: -0.4543 },
  LGW: { name: "Gatwick", city: "London", country: "GB", lat: 51.1537, lon: -0.1821 },
  STN: { name: "Stansted", city: "London", country: "GB", lat: 51.885, lon: 0.235 },
  LCY: { name: "London City", city: "London", country: "GB", lat: 51.5053, lon: 0.0553 },
  MAN: { name: "Manchester Airport", city: "Manchester", country: "GB", lat: 53.3537, lon: -2.275 },
  EDI: { name: "Edinburgh Airport", city: "Edinburgh", country: "GB", lat: 55.95, lon: -3.3725 },
  DUB: { name: "Dublin Airport", city: "Dublin", country: "IE", lat: 53.4213, lon: -6.2701 },
  CDG: { name: "Charles de Gaulle", city: "Paris", country: "FR", lat: 49.0097, lon: 2.5479 },
  ORY: { name: "Orly Airport", city: "Paris", country: "FR", lat: 48.7233, lon: 2.3794 },
  NCE: { name: "Nice Cote d'Azur", city: "Nice", country: "FR", lat: 43.6584, lon: 7.2159 },
  AMS: { name: "Schiphol", city: "Amsterdam", country: "NL", lat: 52.3105, lon: 4.7683 },
  FRA: { name: "Frankfurt Airport", city: "Frankfurt", country: "DE", lat: 50.0379, lon: 8.5622 },
  MUC: { name: "Munich Airport", city: "Munich", country: "DE", lat: 48.3538, lon: 11.7861 },
  BER: { name: "Berlin Brandenburg", city: "Berlin", country: "DE", lat: 52.3667, lon: 13.5033 },
  DUS: { name: "Dusseldorf Airport", city: "Dusseldorf", country: "DE", lat: 51.2895, lon: 6.7668 },
  HAM: { name: "Hamburg Airport", city: "Hamburg", country: "DE", lat: 53.6304, lon: 9.9882 },
  ZRH: { name: "Zurich Airport", city: "Zurich", country: "CH", lat: 47.4647, lon: 8.5492 },
  GVA: { name: "Geneva Airport", city: "Geneva", country: "CH", lat: 46.2381, lon: 6.1089 },
  VIE: { name: "Vienna Intl", city: "Vienna", country: "AT", lat: 48.1103, lon: 16.5697 },
  BRU: { name: "Brussels Airport", city: "Brussels", country: "BE", lat: 50.9014, lon: 4.4844 },
  MAD: { name: "Adolfo Suarez Madrid-Barajas", city: "Madrid", country: "ES", lat: 40.4936, lon: -3.5668 },
  BCN: { name: "Barcelona-El Prat", city: "Barcelona", country: "ES", lat: 41.2971, lon: 2.0785 },
  LIS: { name: "Humberto Delgado Airport", city: "Lisbon", country: "PT", lat: 38.7813, lon: -9.1359 },
  OPO: { name: "Francisco Sa Carneiro", city: "Porto", country: "PT", lat: 41.2481, lon: -8.6814 },
  FCO: { name: "Leonardo da Vinci-Fiumicino", city: "Rome", country: "IT", lat: 41.8003, lon: 12.2389 },
  MXP: { name: "Malpensa", city: "Milan", country: "IT", lat: 45.63, lon: 8.7231 },
  VCE: { name: "Venice Marco Polo", city: "Venice", country: "IT", lat: 45.5053, lon: 12.3519 },
  NAP: { name: "Naples Intl", city: "Naples", country: "IT", lat: 40.8862, lon: 14.2908 },
  ATH: { name: "Athens Intl", city: "Athens", country: "GR", lat: 37.9364, lon: 23.9445 },
  IST: { name: "Istanbul Airport", city: "Istanbul", country: "TR", lat: 41.2753, lon: 28.7519 },
  SAW: { name: "Sabiha Gokcen Intl", city: "Istanbul", country: "TR", lat: 40.8986, lon: 29.3092 },
  HEL: { name: "Helsinki-Vantaa", city: "Helsinki", country: "FI", lat: 60.3172, lon: 24.9633 },
  ARN: { name: "Stockholm Arlanda", city: "Stockholm", country: "SE", lat: 59.6519, lon: 17.9186 },
  OSL: { name: "Oslo Airport", city: "Oslo", country: "NO", lat: 60.1976, lon: 11.1004 },
  CPH: { name: "Copenhagen Airport", city: "Copenhagen", country: "DK", lat: 55.618, lon: 12.656 },
  WAW: { name: "Warsaw Chopin", city: "Warsaw", country: "PL", lat: 52.1657, lon: 20.9671 },
  PRG: { name: "Vaclav Havel Airport", city: "Prague", country: "CZ", lat: 50.1008, lon: 14.26 },
  BUD: { name: "Budapest Ferenc Liszt Intl", city: "Budapest", country: "HU", lat: 47.4298, lon: 19.2611 },
  MRU: { name: "Sir Seewoosagur Ramgoolam Intl", city: "Mauritius", country: "MU", lat: -20.4302, lon: 57.6836 },
  DXB: { name: "Dubai Intl", city: "Dubai", country: "AE", lat: 25.2532, lon: 55.3657 },
  AUH: { name: "Abu Dhabi Intl", city: "Abu Dhabi", country: "AE", lat: 24.433, lon: 54.6511 },
  DOH: { name: "Hamad Intl", city: "Doha", country: "QA", lat: 25.2731, lon: 51.6081 },
  TLV: { name: "Ben Gurion Airport", city: "Tel Aviv", country: "IL", lat: 32.0055, lon: 34.8854 },
  CAI: { name: "Cairo Intl", city: "Cairo", country: "EG", lat: 30.1219, lon: 31.4056 },
  JNB: { name: "OR Tambo Intl", city: "Johannesburg", country: "ZA", lat: -26.1392, lon: 28.246 },
  CPT: { name: "Cape Town Intl", city: "Cape Town", country: "ZA", lat: -33.9648, lon: 18.6017 },
  NBO: { name: "Jomo Kenyatta Intl", city: "Nairobi", country: "KE", lat: -1.3192, lon: 36.9278 },
  LOS: { name: "Murtala Muhammed Intl", city: "Lagos", country: "NG", lat: 6.5774, lon: 3.3212 },
  DEL: { name: "Indira Gandhi Intl", city: "Delhi", country: "IN", lat: 28.5562, lon: 77.1 },
  BOM: { name: "Chhatrapati Shivaji Maharaj Intl", city: "Mumbai", country: "IN", lat: 19.0896, lon: 72.8656 },
  BLR: { name: "Kempegowda Intl", city: "Bengaluru", country: "IN", lat: 13.1986, lon: 77.7066 },
  SIN: { name: "Changi Airport", city: "Singapore", country: "SG", lat: 1.3644, lon: 103.9915 },
  HKG: { name: "Hong Kong Intl", city: "Hong Kong", country: "HK", lat: 22.308, lon: 113.9185 },
  BKK: { name: "Suvarnabhumi Airport", city: "Bangkok", country: "TH", lat: 13.69, lon: 100.7501 },
  KUL: { name: "Kuala Lumpur Intl", city: "Kuala Lumpur", country: "MY", lat: 2.7456, lon: 101.7099 },
  CGK: { name: "Soekarno-Hatta Intl", city: "Jakarta", country: "ID", lat: -6.1256, lon: 106.6559 },
  MNL: { name: "Ninoy Aquino Intl", city: "Manila", country: "PH", lat: 14.5086, lon: 121.0198 },
  SGN: { name: "Tan Son Nhat Intl", city: "Ho Chi Minh City", country: "VN", lat: 10.8188, lon: 106.652 },
  HAN: { name: "Noi Bai Intl", city: "Hanoi", country: "VN", lat: 21.2212, lon: 105.807 },
  NRT: { name: "Narita Intl", city: "Tokyo", country: "JP", lat: 35.7647, lon: 140.3864 },
  HND: { name: "Haneda Airport", city: "Tokyo", country: "JP", lat: 35.5494, lon: 139.7798 },
  KIX: { name: "Kansai Intl", city: "Osaka", country: "JP", lat: 34.4347, lon: 135.2441 },
  ICN: { name: "Incheon Intl", city: "Seoul", country: "KR", lat: 37.4602, lon: 126.4407 },
  PEK: { name: "Beijing Capital Intl", city: "Beijing", country: "CN", lat: 40.0799, lon: 116.6031 },
  PVG: { name: "Shanghai Pudong Intl", city: "Shanghai", country: "CN", lat: 31.1443, lon: 121.8083 },
  CAN: { name: "Guangzhou Baiyun Intl", city: "Guangzhou", country: "CN", lat: 23.3959, lon: 113.308 },
  TPE: { name: "Taiwan Taoyuan Intl", city: "Taipei", country: "TW", lat: 25.0797, lon: 121.2342 },
  SYD: { name: "Sydney Kingsford Smith", city: "Sydney", country: "AU", lat: -33.9399, lon: 151.1753 },
  MEL: { name: "Melbourne Airport", city: "Melbourne", country: "AU", lat: -37.669, lon: 144.841 },
  BNE: { name: "Brisbane Airport", city: "Brisbane", country: "AU", lat: -27.3842, lon: 153.1175 },
  AKL: { name: "Auckland Airport", city: "Auckland", country: "NZ", lat: -37.0082, lon: 174.785 },
  KEF: { name: "Keflavik Intl", city: "Reykjavik", country: "IS", lat: 63.985, lon: -22.6056 },
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in statute miles between two IATA airport codes.
 * Returns null if either code is not in the curated dataset. */
export function distanceMiles(from: string, to: string): number | null {
  const a = AIRPORTS[from.toUpperCase()];
  const b = AIRPORTS[to.toUpperCase()];
  if (!a || !b) return null;

  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

export function isKnownAirport(code: string): boolean {
  return code.toUpperCase() in AIRPORTS;
}

/** Continent per ISO country code, covering every country present in
 * AIRPORTS above. Transcontinental cases (Turkey, Russia, ...) are grouped
 * by travel-industry convention rather than strict geography. */
const COUNTRY_CONTINENT: Record<string, string> = {
  US: "North America",
  CA: "North America",
  MX: "North America",
  BR: "South America",
  AR: "South America",
  CO: "South America",
  PE: "South America",
  CL: "South America",
  GB: "Europe",
  IE: "Europe",
  FR: "Europe",
  NL: "Europe",
  DE: "Europe",
  CH: "Europe",
  AT: "Europe",
  BE: "Europe",
  ES: "Europe",
  PT: "Europe",
  IT: "Europe",
  GR: "Europe",
  TR: "Europe",
  FI: "Europe",
  SE: "Europe",
  NO: "Europe",
  DK: "Europe",
  PL: "Europe",
  CZ: "Europe",
  HU: "Europe",
  IS: "Europe",
  MU: "Africa",
  EG: "Africa",
  ZA: "Africa",
  KE: "Africa",
  NG: "Africa",
  AE: "Asia",
  QA: "Asia",
  IL: "Asia",
  IN: "Asia",
  SG: "Asia",
  HK: "Asia",
  TH: "Asia",
  MY: "Asia",
  ID: "Asia",
  PH: "Asia",
  VN: "Asia",
  JP: "Asia",
  KR: "Asia",
  CN: "Asia",
  TW: "Asia",
  AU: "Oceania",
  NZ: "Oceania",
};

export function getContinent(countryCode: string): string | null {
  return COUNTRY_CONTINENT[countryCode.toUpperCase()] ?? null;
}
