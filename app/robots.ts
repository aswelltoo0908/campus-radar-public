import type {MetadataRoute} from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:["/","/docs","/privacy"],disallow:["/api/","/admin","/beta","/unsubscribe"]},sitemap:"https://campus-radar-umich.aswelltoo.chatgpt.site/sitemap.xml"};}
