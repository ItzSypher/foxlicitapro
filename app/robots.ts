import type { MetadataRoute } from "next";

const SITE = "https://licitapro.foxtisolutions.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/documentacao", "/login"], disallow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
