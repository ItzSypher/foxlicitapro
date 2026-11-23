import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://licitapro.foxtisolutions.com.br/documentacao", changeFrequency: "monthly", priority: 1 }];
}
