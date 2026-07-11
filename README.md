详细参阅 docs

## Dev 开发

先启动restful api server 服务

```
// cd auto-vi
npm run start:dev
```

再启动 tk-auto 消费服务

```
// cd tk-auto
npm run start:dev
```

最后去到 vi-admin

```
// cd vi-admin
npm run dev
```

消费服务 tk-auto 可单独部署，在另一台机子上消费，2个轮询一个轮询是浏览器特定地址的自动化，第二个轮询是把生成好的视频下载到NAS里协议samba, 浏览器多开手动登录，程序会记录不同的profile根据profile下标分别消费生成视频任务，后续下载视频时根据profile下标找到该任务所在浏览器下载。


## Prod 正式

### Portainer

#### Stack

```yaml
version: "3"

services:
  # 后端 NestJS
  auto-vi:
    image: auto-vi:latest  # 先占位，后面说怎么填
    container_name: auto-vi
    restart: unless-stopped
    ports:
      - "3000:3000"   # 左边是NAS端口，右边是容器内端口
    environment:
      - NODE_ENV=development
      - PORT=3000
      - PUBLIC_BASE_URL=http://192.168.50.100:9444/api
      - UPLOAD_DIR=/app/uploads/images
    volumes:
      - /volume1/docker/vi-system/uploads:/app/uploads
      - /volume1/docker/vi-system/data:/app/data
      
  # 前端 Vue
  vi-admin:
    image: vi-admin:latest
    container_name: vi-admin
    restart: unless-stopped
    ports:
      - "9444:80"    # 访问 192.168.50.100:8080 就是你的前端
    depends_on:
      - auto-vi      # 等后端启动后再启动前端

# 显式声明网络，两个容器在同一网络里才能用容器名互访
networks:
  default:
    name: vi-system-network
    
volumes:
  vi-system-uploads:
    external: true    # 引用刚才手动创建的volume
  vi-system-data:
    external: true
```

本地 docker 构建镜像 然后 导出 在 导入到 Portainer Image

```
ocker build --no-cache -t auto-vi .
ocker build --no-cache -t vi-admin .
docker save -o vi-system.tar vi-system:latest
docker compose up -d --build 
```

docker-compose.yaml 多个服务集合可使用最后compose构建， 前后端需要ng代理转发，需要在前端提供nginx然后一同构建进镜像

找到Image进行镜像导入去到Stack 进入到相关的 Stack （vi-system） details  -> update the stack