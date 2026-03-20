import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

export const client = createClient({
  projectId: "385v6f7f",
  dataset: "production",
  useCdn: true,
  apiVersion: "2026-03-20",
});

// Helper function to generate image URLs from Sanity
const builder = imageUrlBuilder(client);

export function urlFor(source) {
  return builder.image(source);
}
