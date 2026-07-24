/** Curated location options for Nova Jobs Agent dropdowns. */

export const JOB_REGIONS = [
  "Worldwide",
  "North America",
  "Europe",
  "Latin America",
  "Asia",
  "Middle East",
  "Africa",
  "Oceania",
] as const;

export type JobRegion = (typeof JOB_REGIONS)[number];

type CountryEntry = { name: string; region: JobRegion; cities: string[] };

/** Common hiring markets + major cities (enough for dropdown UX without a huge dataset). */
export const JOB_COUNTRIES: CountryEntry[] = [
  {
    name: "Canada",
    region: "North America",
    cities: ["Toronto", "Vancouver", "Montreal", "Ottawa", "Calgary", "Edmonton", "Winnipeg", "Quebec City", "Halifax", "Remote"],
  },
  {
    name: "United States",
    region: "North America",
    cities: [
      "New York",
      "San Francisco",
      "Los Angeles",
      "Seattle",
      "Austin",
      "Chicago",
      "Boston",
      "Denver",
      "Miami",
      "Washington DC",
      "Remote",
    ],
  },
  {
    name: "United Kingdom",
    region: "Europe",
    cities: ["London", "Manchester", "Edinburgh", "Birmingham", "Bristol", "Glasgow", "Remote"],
  },
  {
    name: "Germany",
    region: "Europe",
    cities: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Remote"],
  },
  {
    name: "Netherlands",
    region: "Europe",
    cities: ["Amsterdam", "Rotterdam", "Utrecht", "The Hague", "Remote"],
  },
  {
    name: "France",
    region: "Europe",
    cities: ["Paris", "Lyon", "Marseille", "Remote"],
  },
  {
    name: "Spain",
    region: "Europe",
    cities: ["Madrid", "Barcelona", "Valencia", "Remote"],
  },
  {
    name: "Ireland",
    region: "Europe",
    cities: ["Dublin", "Cork", "Remote"],
  },
  {
    name: "India",
    region: "Asia",
    cities: ["Bengaluru", "Hyderabad", "Mumbai", "Pune", "Delhi", "Chennai", "Remote"],
  },
  {
    name: "Singapore",
    region: "Asia",
    cities: ["Singapore", "Remote"],
  },
  {
    name: "Australia",
    region: "Oceania",
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Remote"],
  },
  {
    name: "Brazil",
    region: "Latin America",
    cities: ["São Paulo", "Rio de Janeiro", "Remote"],
  },
  {
    name: "Mexico",
    region: "Latin America",
    cities: ["Mexico City", "Guadalajara", "Monterrey", "Remote"],
  },
  {
    name: "Nigeria",
    region: "Africa",
    cities: ["Lagos", "Abuja", "Remote"],
  },
  {
    name: "South Africa",
    region: "Africa",
    cities: ["Cape Town", "Johannesburg", "Remote"],
  },
  {
    name: "United Arab Emirates",
    region: "Middle East",
    cities: ["Dubai", "Abu Dhabi", "Remote"],
  },
];

export function countriesForRegion(region: string | null | undefined): CountryEntry[] {
  if (!region || region === "Worldwide") return JOB_COUNTRIES;
  return JOB_COUNTRIES.filter((c) => c.region === region);
}

export function citiesForCountry(country: string | null | undefined): string[] {
  if (!country) return [];
  const entry = JOB_COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase());
  return entry?.cities ?? [];
}

export function regionForCountry(country: string | null | undefined): JobRegion | null {
  if (!country) return null;
  return JOB_COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase())?.region ?? null;
}
