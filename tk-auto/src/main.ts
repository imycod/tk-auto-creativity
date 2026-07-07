import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

// Playwright 偶发超时 rejection 若未捕获会导致 Node 直接退出，这里兜底保证进程继续跑
process.on('unhandledRejection', (reason) => {
  const message =
    reason instanceof Error ? reason.message : String(reason ?? 'unknown');
  bootstrapLogger.error(`未处理的 Promise rejection（已吞掉）: ${message}`);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
