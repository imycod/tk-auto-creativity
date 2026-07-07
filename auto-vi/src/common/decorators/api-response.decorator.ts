import { SetMetadata } from '@nestjs/common';

export const API_RESPONSE = 'API_RESPONSE';
export const ApiResponse = (message: string) => SetMetadata(API_RESPONSE, message);