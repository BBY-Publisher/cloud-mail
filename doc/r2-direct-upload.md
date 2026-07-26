# R2 浏览器直传配置

邮件附件使用两段式上传：

1. 浏览器向 Worker 的 `POST /api/email/attachment/presign` 提交文件名、类型和大小。
2. Worker 返回 5 分钟有效的单对象 `PUT` 预签名 URL。
3. 浏览器将文件内容直接上传到 R2 的 S3 API 域名。
4. 发送邮件时，Worker 只接收对象 key，并通过 R2 `head` 校验对象存在且不超过 64 MiB。

附件二进制不会经过 Worker。

## R2 API 配置

R2 binding 与 S3 API 配置必须指向同一个 bucket。

在 Cloudflare R2 中创建仅限该 bucket 的 Object Read & Write API Token，然后在系统设置的 S3 配置中填写：

- `Bucket`：R2 bucket 名称。
- `Endpoint`：`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`。
- `Region`：`auto`。
- `Access Key`：R2 API Token 的 Access Key ID。
- `Secret Key`：R2 API Token 的 Secret Access Key。
- `ForcePathStyle`：推荐关闭，使用 R2 的虚拟主机格式。

Secret Key 只保存在服务端。浏览器只能拿到短期预签名 URL，不会得到 R2 API 凭据。

## Bucket CORS

浏览器直传必须在 R2 bucket 的 Settings / CORS Policy 中配置准确的网站 origin。将下面的 `https://mail.example.com` 替换为实际部署地址：

```json
[
  {
    "AllowedOrigins": ["https://mail.example.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Disposition",
      "x-amz-meta-filename"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

生产环境不要把 `AllowedOrigins` 设置成 `*`。如果本地开发也需要直传，可以另外加入准确的本地 origin，例如 `http://localhost:5173`。

