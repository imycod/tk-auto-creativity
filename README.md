详细参阅 docs

## 发布与部署

```
git fetch --tags
git checkout v2.0.0
```

## Changelogs

### v1.0.0

完成基本功能，如：Consumer 自动打开目标网站，自动Prompt和Image回填，自动submit，Downloader自动下载目标视频到本地

### v2.0.0 （release）

增加Profile最大并发数，每个Profile同一时间轮询内最多消费3个任务，每个任务生成完毕并且下载完毕后，才能继续消费任务，根据status判断

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

### Docker

#### Portainer

##### Stack

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
docker build --no-cache -t auto-vi .
docker build --no-cache -t vi-admin .
docker save -o vi-system.tar vi-system:latest
docker compose up -d --build 
```

docker-compose.yaml 多个服务集合可使用最后compose构建， 前后端需要ng代理转发，需要在前端提供nginx然后一同构建进镜像

找到Image进行镜像导入去到Stack 进入到相关的 Stack （vi-system） details  -> update the stack

## Changelogs:

### v2.1.1
1.极端情况：当视频下载出错（可能网络问题）会弹出悬浮层遮住提交按钮时，那么提交之前会先去检测，并入库出错，并且关闭Download failed 继续submit提交。 （待检验）
2.积分检测，每次消费视频是在提交前检测积分够不够，积分不够报错入库
3.视频生成出错，抓取错误信息入库

### v2.1.0

新增duration，每个任务视频可选时间4-15s，优化任务prompt超长提示词限制解除，添加notice通知功能

### v2.0.0

每个profile 2min同时并发消费数限制3以内

### v1.0.0

基础功能可用，tk-core (任务消费者任务下载者)，auto-vi（restful api 服务提供者），vi-admin （管理面板）