// 本地候选预览和 Cloudflare 静态发布共用，不含账号或认证信息。
export const headers = Object.freeze({
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "public, max-age=0, must-revalidate"
});
export const collectorHeaders={...headers,"Content-Security-Policy":headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'"),"X-Frame-Options":"SAMEORIGIN"};
export const downloadHeaders=Object.freeze({'Content-Disposition':'attachment; filename="refellow-collector-0.4.0.zip"'});
export const pagesHeaders = () => "/*\n" + Object.entries(headers).map(([key,value]) => "  " + key + ": " + value).join("\n") + "\n/collector/*\n  ! Content-Security-Policy\n  ! X-Frame-Options\n  Content-Security-Policy: "+collectorHeaders['Content-Security-Policy']+"\n  X-Frame-Options: SAMEORIGIN\n/assets/collector.zip\n"+Object.entries(downloadHeaders).map(([key,value])=>'  '+key+': '+value).join('\n')+'\n';
