import domainUtils from '../utils/domain-uitls';
import { sanitizeEmailHtml } from '../utils/sanitize-email-html';

export default function emailHtmlTemplate(html, domain) {
	const resolvedHtml = String(html || '')
		.replace(/{{domain}}/g, domainUtils.toOssDomain(domain) + '/');
	const sanitizedHtml = sanitizeEmailHtml(resolvedHtml);

	return `<!DOCTYPE html>
<html lang='en' >
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            background: #FFF;
        }

        .content-box {
        		padding: 15px 10px;
            width: 100%;
            height: 100%;
            overflow: auto; /* 改为 auto 允许滚动 */
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .content-html {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class='content-box'>${sanitizedHtml}</div>
</body>
</html>`
}
