// Define a type for venue data
export interface VenueData {
  id: string; // URL-friendly slug
  name: string; // Display name
  queueSkips: number;
  price: number;
  imageUrl: string;
  description: string;
  refreshTime?: string; // Optional refresh time
}

// Our venue data
export const venues: VenueData[] = [
  {
    id: "the-espy",
    name: "The Espy",
    queueSkips: 3,
    price: 30,
    imageUrl: "/espy-venue.png",
    description:
      "Hotel Esplanade, affectionately known as The Espy, is one of Melbourne's most iconic live music venues and cultural landmarks.",
  },
  {
    id: "the-provincial",
    name: "The Provincial",
    queueSkips: 8,
    price: 25,
    imageUrl: "/provincial-venue.png",
    description:
      "The Provincial is a popular venue with great music and an amazing atmosphere.",
  },
  {
    id: "harlow-bar",
    name: "Harlow Bar",
    queueSkips: 8,
    price: 25,
    imageUrl: "/harlow-venue.png",
    description: "",
  },
  {
    id: "college-lawn",
    name: "College Lawn",
    queueSkips: 8,
    price: 25,
    imageUrl: "/college-lawn-venue.png",
    description: "",
  },
  {
    id: "garden-state-hotel",
    name: "Garden State Hotel",
    queueSkips: 8,
    price: 25,
    imageUrl: "/garden-state-hotel-venue.png",
    description: "",
  },
];

// // Helper function to create a slug from venue name
export function createVenueSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}
