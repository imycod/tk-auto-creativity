import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_RESPONSE } from '../decorators/api-response.decorator';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
    constructor(private reflector: Reflector) { }
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const message = this.reflector.get<string>(
            API_RESPONSE,
            context.getHandler(),
        ) || '操作成功';

        return next.handle().pipe(
            map((data) => ({
                code: 200,
                message,
                data: data ?? null,   // 如果没有数据就返回 null
            })),
        );
    }
}